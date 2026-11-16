-- 어드민 예외 이메일(2026-11-16 사용자 요청, 33 3장 ‘로그인’, DEV_GUIDE ‘어드민 인증’).
-- 네이버웍스 체험 기간이 끝나 회사 메일(@sweetwo.kr)을 못 받는 동안, 허용 목록의 이메일만 회사 도메인처럼 통과.
-- 다른 단계는 그대로: Cloudflare Access(허용 이메일·IP), 매직 링크(그 메일함 소유 증명), 인증 앱 OTP(aal2).
--
-- - admin_email_exception: 허용 목록. RLS 켜고 anon·authenticated 권한 없음(서버 함수만 읽음)
-- - is_admin_email_allowed(email): @sweetwo.kr 또는 허용 목록. 서버 안에서만 부름
-- - admin_claim_exception(): 예외 이메일이 로그인했는데 admin_user가 없으면 관리자가 이미 있어도 최고 관리자로 연결 + 감사 로그.
--   aal2와 이 세션이 이메일 링크로 시작됐는지(amr: magiclink, otp, email/signup)를 서버가 확인. 비밀번호·소셜 로그인 세션은 안 됨.
--   일반 @sweetwo.kr은 지금 규칙(관리자 0명일 때 첫 최고 관리자) 그대로
-- - admin_bootstrap(): 어드민 앱이 not_admin일 때 부르는 그 함수. 예외 이메일이면 admin_claim_exception으로
-- 운영 출시 전에 예외 줄을 지울지는 [확인 필요](33 3장)

create table public.admin_email_exception (
  email text primary key check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+$'),
  note text not null default '' check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);
alter table public.admin_email_exception enable row level security;
revoke all on public.admin_email_exception from public, anon, authenticated;

insert into public.admin_email_exception (email, note)
  values ('yeabin0909@gmail.com', '네이버웍스 체험 종료로 회사 메일 못 받는 동안(2026-11-16)');

create or replace function public.is_admin_email_allowed(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(lower(btrim(p_email)) ~ '@sweetwo\.kr$', false)
    or exists (select 1 from public.admin_email_exception where email = lower(btrim(p_email)));
$$;
revoke execute on function public.is_admin_email_allowed(text) from public, anon, authenticated;

-- 이 세션이 이메일 링크(메일함 소유 증명)로 시작됐는지
create or replace function public.jwt_email_link_login() returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from jsonb_array_elements(
      coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb->'amr', '[]'::jsonb)) m
    where jsonb_typeof(m) = 'object' and m->>'method' in ('magiclink', 'otp', 'email/signup'));
$$;
revoke execute on function public.jwt_email_link_login() from public, anon, authenticated;

create or replace function public.admin_claim_exception()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  em text;
  a public.admin_user;
begin
  if auth.uid() is null then
    return false;
  end if;
  select lower(email) into em from auth.users where id = auth.uid();
  if em is null or not exists (select 1 from public.admin_email_exception where email = em) then
    return false;
  end if;
  if coalesce(public.jwt_aal(), '') <> 'aal2' or not public.jwt_email_link_login() then
    return false;
  end if;
  if exists (select 1 from public.admin_user where email = em) then
    return false; -- 이미 있으면 admin_me가 연결(잠긴 계정은 풀지 않음)
  end if;
  insert into public.admin_user (id, email, name, roles)
    values (auth.uid(), em, split_part(em, '@', 1), array['super']::public.admin_role[])
    returning * into a;
  perform public.admin_log(a, 'execute', 'AD-18', em, '예외 이메일 최고 관리자', jsonb_build_object('exception', true));
  return true;
end;
$$;
revoke execute on function public.admin_claim_exception() from public, anon, authenticated;

-- 첫 최고 관리자: @sweetwo.kr은 그대로(관리자 0명일 때만). 예외 이메일은 admin_claim_exception
create or replace function public.admin_bootstrap()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  em text;
begin
  select lower(email) into em from auth.users where id = auth.uid();
  if em is null or not public.is_admin_email_allowed(em) then
    return false;
  end if;
  if em !~ '@sweetwo\.kr$' then
    return public.admin_claim_exception();
  end if;
  if exists (select 1 from public.admin_user) then
    return false;
  end if;
  insert into public.admin_user (id, email, name, roles) values (auth.uid(), em, split_part(em, '@', 1), array['super']::public.admin_role[]);
  insert into public.admin_audit (admin_id, admin_email, action, screen, target, reason)
    values (auth.uid(), em, 'execute', 'AD-18', em, '첫 최고 관리자');
  return true;
end;
$$;
revoke execute on function public.admin_bootstrap() from public, anon;
grant execute on function public.admin_bootstrap() to authenticated;
