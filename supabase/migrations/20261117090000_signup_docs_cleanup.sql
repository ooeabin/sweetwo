-- 1구간 검토(2026-11-10) 가입 마무리:
-- 1) 동의 기록 버전(S1-17): 이용약관·개인정보는 서버가 AD-15에서 승인돼 시행 중인 버전을 종류별로 골라 기록.
--    시행 중 버전이 없을 때만 앱이 보여 준 문서 버전(p_versions). 공간 공유·마케팅은 앱이 보여 준 동의 문서 버전.
--    complete_signup_v2(p_versions jsonb)를 새로 두고, 예전 complete_signup(p_terms_version)은 같은 규칙으로 v2를 부름(옛 앱용).
-- 2) 가입을 끝내지 않은 계정 정리(S1-11, 15 A-04·A-05 ‘뒤로·앱 종료: 가입 취소’): 소셜 로그인으로 auth.users는 생겼지만
--    A-05에서 계정(app_user)을 만들지 않은 채 24시간이 지난 것은 지움. 관리자(admin_user)와 소셜 외 로그인은 건드리지 않음.
-- 3) 마케팅 수신 동의·거부 결과 통지(31 5-1, 정보통신망법 시행령): 마케팅 동의 기록이 생기면(설정 S-14, 재확인 A-05r,
--    가입 때 ‘받기’) 알림 센터에 처리 결과(날짜, 동의·거부, 보낸 곳 sweeTwo)를 남김. 앱은 같은 내용을 토스트로도 보여 줌.

-- ── 1) 시행 중 약관 버전 ─────────────────────────────────────────────────
create or replace function public.in_force_terms_version(p_kind text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select t.version from public.terms_version t
  where t.kind = p_kind and t.status = 'approved'
    and t.effective_on <= (now() at time zone 'Asia/Seoul')::date
  order by t.effective_on desc, t.approved_at desc nulls last
  limit 1;
$$;
revoke execute on function public.in_force_terms_version(text) from public, anon, authenticated;

create or replace function public.complete_signup_v2(
  p_provider public.auth_provider,
  p_notify_email text,
  p_marketing boolean,
  p_versions jsonb
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
  v_terms text;
  v_privacy text;
  v_space text;
  v_marketing text;
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
  v_terms := coalesce(public.in_force_terms_version('terms'), nullif(btrim(p_versions->>'terms'), ''));
  v_privacy := coalesce(public.in_force_terms_version('privacy'), nullif(btrim(p_versions->>'privacy'), ''));
  v_space := nullif(btrim(p_versions->>'space_sharing'), '');
  v_marketing := nullif(btrim(p_versions->>'marketing'), '');
  if v_terms is null or v_privacy is null or v_space is null or v_marketing is null
     or not (v_terms ~ '^[A-Za-z0-9._-]{1,32}$' and v_privacy ~ '^[A-Za-z0-9._-]{1,32}$'
             and v_space ~ '^[A-Za-z0-9._-]{1,32}$' and v_marketing ~ '^[A-Za-z0-9._-]{1,32}$') then
    raise exception 'terms_version_required' using errcode = 'P0001';
  end if;
  select nullif(lower(btrim(email)), '') into provider_email from auth.users where id = uid;
  if provider_email is null and manual_email is null then
    raise exception 'email_required' using errcode = 'P0001';
  end if;

  insert into public.app_user (id, provider, notify_email, notify_email_source, adult_confirmed_at)
  values (
    uid, p_provider,
    coalesce(provider_email, manual_email),
    case when provider_email is null then 'manual'::public.email_source else 'provider'::public.email_source end,
    now()
  )
  returning * into result;

  insert into public.consent (user_id, kind, terms_version, agreed, source)
  values
    (uid, 'terms', v_terms, true, 'signup'),
    (uid, 'privacy', v_privacy, true, 'signup'),
    (uid, 'space_sharing', v_space, true, 'signup'),
    (uid, 'marketing', v_marketing, coalesce(p_marketing, false), 'signup');

  return result;
end;
$$;
revoke execute on function public.complete_signup_v2(public.auth_provider, text, boolean, jsonb) from public, anon;
grant execute on function public.complete_signup_v2(public.auth_provider, text, boolean, jsonb) to authenticated;

-- 옛 앱: 버전 하나를 모든 종류에 쓰던 것. 이용약관·개인정보는 이제 서버가 시행 중 버전을 고름
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
begin
  if coalesce(btrim(p_terms_version), '') = '' then
    raise exception 'terms_version_required' using errcode = 'P0001';
  end if;
  return public.complete_signup_v2(p_provider, p_notify_email, p_marketing,
    jsonb_build_object('terms', p_terms_version, 'privacy', p_terms_version,
      'space_sharing', p_terms_version, 'marketing', p_terms_version));
end;
$$;

-- ── 2) 가입을 끝내지 않은 계정 정리 ──────────────────────────────────────
create or replace function public.purge_abandoned_signups(p_now timestamptz default now())
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  delete from auth.users u
  where u.created_at < p_now - interval '24 hours'
    and not exists (select 1 from public.app_user a where a.id = u.id)
    and not exists (select 1 from public.admin_user ad where ad.id = u.id)
    and exists (select 1 from auth.identities i
                where i.user_id = u.id and i.provider in ('kakao', 'google', 'apple'))
    and not exists (select 1 from auth.identities i
                    where i.user_id = u.id and i.provider not in ('kakao', 'google', 'apple'));
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.purge_abandoned_signups(timestamptz) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    -- 매일 KST 04:20(UTC 19:20). 다른 정리 작업(19:00~19:50)과 겹치지 않게
    perform cron.schedule('purge-abandoned-signups', '20 19 * * *', 'select public.purge_abandoned_signups()');
  end if;
end;
$$;

-- ── 3) 마케팅 수신 결과 통지 ─────────────────────────────────────────────
create or replace function public.note_marketing_result()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  d date := (new.created_at at time zone 'Asia/Seoul')::date;
begin
  if new.kind <> 'marketing' or (new.source = 'signup' and not new.agreed) then
    return new; -- 가입 때 안 받기는 바뀐 게 없어 알리지 않음
  end if;
  insert into public.notification (user_id, kind, title, body, target, icon, dedupe)
  values (
    new.user_id, 'marketing_result',
    case when new.agreed then '마케팅 정보 받기에 동의했어요' else '마케팅 정보 받기를 거부했어요' end,
    extract(year from d)::int || '년 ' || extract(month from d)::int || '월 ' || extract(day from d)::int
      || '일 sweeTwo가 처리했어요',
    '/settings/notifications', 'megaphone', 'marketing_result:' || new.id
  )
  on conflict (dedupe) do nothing;
  return new;
end;
$$;
revoke execute on function public.note_marketing_result() from public, anon, authenticated;

drop trigger if exists consent_marketing_result on public.consent;
create trigger consent_marketing_result after insert on public.consent
  for each row execute function public.note_marketing_result();
