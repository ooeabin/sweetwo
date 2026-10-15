-- 로그인과 가입(docs/spec/15-login-signup.md A-02~A-05): app_user, consent, 가입 함수
-- 계정 = auth.users 1명 + app_user 1행. app_user는 A-05 ‘동의하고 계속하기’ 때 complete_signup()으로만 생긴다.
-- 부부 공간(space_id)은 온보딩, 합류 단계 마이그레이션에서 추가한다(스키마는 추가만).

create type public.auth_provider as enum ('kakao', 'google', 'apple');
create type public.account_status as enum ('active', 'deletion_requested', 'deleted');
create type public.email_source as enum ('provider', 'manual');
-- 동의 8종(docs/spec/31-security-privacy.md 5-1)
create type public.consent_kind as enum (
  'terms', 'privacy', 'space_sharing', 'family_info', 'photo', 'marketing', 'analytics', 'peer_stats'
);
create type public.consent_source as enum ('signup', 'prefill_review', 'care_day_first', 'settings', 'peer_stats_page');

create table public.app_user (
  id uuid primary key references auth.users (id) on delete cascade,
  provider public.auth_provider not null,
  notify_email text not null check (notify_email = lower(btrim(notify_email)) and notify_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  notify_email_source public.email_source not null,
  status public.account_status not null default 'active',
  deletion_requested_at timestamptz,
  onboarding_step text,
  onboarding_done_at timestamptz,
  analytics_off boolean not null default false,
  is_internal_tester boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);
comment on table public.app_user is '사용자. 행은 complete_signup()만 만든다. 상태, 로그인 수단, 테스트 표시는 서버 함수만 바꾼다.';

create trigger app_user_touch before update on public.app_user
  for each row execute function public.touch_row();

alter table public.app_user enable row level security;

create policy app_user_select on public.app_user
  for select to authenticated using (id = (select auth.uid()));
-- 추가는 complete_signup()만(정책 없음). 삭제는 계정 삭제 작업만(정책 없음).
create policy app_user_update on public.app_user
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- 본인이 바꿀 수 있는 열만 허용
revoke update on public.app_user from authenticated, anon;
grant update (notify_email, onboarding_step, onboarding_done_at, analytics_off) on public.app_user to authenticated;

-- 동의 기록: 추가만. 철회도 agreed = false인 새 행.
create table public.consent (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.app_user (id) on delete cascade,
  kind public.consent_kind not null,
  terms_version text not null,
  agreed boolean not null,
  source public.consent_source not null,
  created_at timestamptz not null default now()
);
create index consent_user_kind_idx on public.consent (user_id, kind, created_at desc);

alter table public.consent enable row level security;

create policy consent_select on public.consent
  for select to authenticated using (user_id = (select auth.uid()));
create policy consent_insert on public.consent
  for insert to authenticated with check (user_id = (select auth.uid()));
-- 수정, 삭제 정책 없음(기록은 추가만)
revoke update, delete on public.consent from authenticated, anon;

-- 로그인 직후 어디로 갈지(A-01, A-02, A-03 완료). 누른 제공자를 받으면 다른 소셜로 가입된 계정인지 본다(자동 합치기 없음).
-- 재방문(세션 유효)처럼 누른 버튼이 없으면 null.
-- state: new(가입 전) / existing / provider_conflict / deletion_requested
create or replace function public.login_state(p_provider public.auth_provider default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  u public.app_user;
  provider_email text;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into u from public.app_user where id = uid;
  if not found then
    select nullif(lower(btrim(email)), '') into provider_email from auth.users where id = uid;
    return jsonb_build_object('state', 'new', 'needs_email', provider_email is null);
  end if;
  if p_provider is not null and u.provider <> p_provider then
    return jsonb_build_object('state', 'provider_conflict', 'provider', u.provider);
  end if;
  if u.status = 'deletion_requested' then
    return jsonb_build_object('state', 'deletion_requested', 'provider', u.provider,
      'onboarding_done', u.onboarding_done_at is not null, 'onboarding_step', u.onboarding_step);
  end if;
  return jsonb_build_object('state', 'existing', 'provider', u.provider,
    'onboarding_done', u.onboarding_done_at is not null, 'onboarding_step', u.onboarding_step);
end;
$$;

-- A-05 ‘동의하고 계속하기’: 계정 생성 + 동의 기록(필수 3종 + 마케팅). 한 번만.
create or replace function public.complete_signup(
  p_provider public.auth_provider,
  p_notify_email text,
  p_marketing boolean,
  p_terms_version text
)
returns public.app_user
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  provider_email text;
  manual_email text := nullif(lower(btrim(coalesce(p_notify_email, ''))), '');
  result public.app_user;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.app_user where id = uid) then
    raise exception 'already_signed_up' using errcode = 'P0001';
  end if;
  if not exists (select 1 from auth.identities where user_id = uid and provider = p_provider::text) then
    raise exception 'provider_mismatch' using errcode = 'P0001';
  end if;
  if coalesce(btrim(p_terms_version), '') = '' then
    raise exception 'terms_version_required' using errcode = 'P0001';
  end if;
  select nullif(lower(btrim(email)), '') into provider_email from auth.users where id = uid;
  -- 소셜 이메일이 있으면 그것, 없으면(카카오 제공 거부) A-04 입력값
  if provider_email is null and manual_email is null then
    raise exception 'email_required' using errcode = 'P0001';
  end if;

  insert into public.app_user (id, provider, notify_email, notify_email_source)
  values (
    uid, p_provider,
    coalesce(provider_email, manual_email),
    case when provider_email is null then 'manual'::public.email_source else 'provider'::public.email_source end
  )
  returning * into result;

  insert into public.consent (user_id, kind, terms_version, agreed, source)
  values
    (uid, 'terms', p_terms_version, true, 'signup'),
    (uid, 'privacy', p_terms_version, true, 'signup'),
    (uid, 'space_sharing', p_terms_version, true, 'signup'),
    (uid, 'marketing', p_terms_version, coalesce(p_marketing, false), 'signup');

  return result;
end;
$$;

revoke execute on function public.login_state(public.auth_provider) from public, anon;
revoke execute on function public.complete_signup(public.auth_provider, text, boolean, text) from public, anon;
grant execute on function public.login_state(public.auth_provider) to authenticated;
grant execute on function public.complete_signup(public.auth_provider, text, boolean, text) to authenticated;
