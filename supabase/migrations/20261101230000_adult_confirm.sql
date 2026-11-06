-- A-05 “[필수] 만 18세 이상이에요” 확인 기록(15 A-05 2a: 동의 종류가 아니라 항목·시각 확인 기록).
-- 앱은 이 체크가 켜져야만 계정 생성(complete_signup)을 부르므로, 가입 시각을 확인 시각으로 남김.
-- 나이를 이유로 가입 뒤 계정을 지우지 않음(15 A-05 예외): 옛 delete_underage_account·delete_minor_account는 앱이 더는 안 씀(다음 단계에서 지움).
alter table public.app_user add column if not exists adult_confirmed_at timestamptz;

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
    (uid, 'terms', p_terms_version, true, 'signup'),
    (uid, 'privacy', p_terms_version, true, 'signup'),
    (uid, 'space_sharing', p_terms_version, true, 'signup'),
    (uid, 'marketing', p_terms_version, coalesce(p_marketing, false), 'signup');

  return result;
end;
$$;
