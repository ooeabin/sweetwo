-- pgTAP: 어드민 예외 이메일(2026-11-16, 33 3장 ‘로그인’). 관리자 boss(@sweetwo.kr)가 이미 있을 때
-- 예외 이메일(yeabin0909@gmail.com)은 이메일 링크 + aal2면 최고 관리자, 다른 gmail은 안 됨, 일반 @sweetwo.kr은 지금 규칙 그대로
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'boss@sweetwo.kr'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'new01@sweetwo.kr'),
  ('aaaaaaaa-0000-0000-0000-000000000008', 'yeabin0909@gmail.com'),
  ('aaaaaaaa-0000-0000-0000-000000000009', 'x@gmail.com');
insert into public.admin_user (id, email, name, roles)
  values ('aaaaaaaa-0000-0000-0000-000000000002', 'boss@sweetwo.kr', '대표', array['super']::public.admin_role[]);
-- p_aal, 로그인 방법(amr 첫 줄)
create function pg_temp.login_as(uid uuid, p_aal text, p_method text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', p_aal,
    'amr', json_build_array(json_build_object('method', p_method, 'timestamp', extract(epoch from now())::bigint),
      json_build_object('method', 'totp', 'timestamp', extract(epoch from now())::bigint)))::text, true);
$$;

-- 허용 목록은 앱·어드민에서 못 읽음
set local role anon;
select throws_ok($$ select * from public.admin_email_exception $$, '42501', null, 'anon은 예외 목록 못 읽음');
reset role;
set local role authenticated;
select throws_ok($$ select * from public.admin_email_exception $$, '42501', null, 'authenticated도 못 읽음');
select throws_ok($$ select public.is_admin_email_allowed('yeabin0909@gmail.com') $$, '42501', null, '확인 함수도 직접 못 부름');
select throws_ok($$ select public.admin_claim_exception() $$, '42501', null, '연결 함수도 직접 못 부름');
reset role;

select ok(public.is_admin_email_allowed(' YeaBin0909@gmail.com '), '예외 이메일 통과(대소문자·공백 무시)');
select ok(public.is_admin_email_allowed('ops@sweetwo.kr'), '회사 도메인 통과');
select ok(not public.is_admin_email_allowed('x@gmail.com'), '다른 gmail 거부');
select ok(not public.is_admin_email_allowed('a@sweetwo.kr.evil.com'), '회사 도메인 흉내 거부');

-- 다른 gmail: 이메일 링크 + aal2여도 안 됨
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000009', 'aal2', 'magiclink');
set local role authenticated;
select is(public.admin_bootstrap(), false, '다른 gmail은 거부');
reset role;

-- 일반 @sweetwo.kr: 관리자가 이미 있으면 지금처럼 안 됨
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000005', 'aal2', 'magiclink');
set local role authenticated;
select is(public.admin_bootstrap(), false, '회사 도메인은 관리자가 있으면 안 됨(지금 규칙)');
reset role;

-- 예외 이메일: 인증 앱 확인 전(aal1)이나 비밀번호 로그인 세션이면 안 됨
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000008', 'aal1', 'magiclink');
set local role authenticated;
select is(public.admin_bootstrap(), false, 'aal1은 안 됨');
reset role;
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000008', 'aal2', 'password');
set local role authenticated;
select is(public.admin_bootstrap(), false, '이메일 링크가 아닌 로그인은 안 됨');
reset role;

-- 예외 이메일 + 이메일 링크 + aal2: 관리자가 있어도 최고 관리자, 감사 로그
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000008', 'aal2', 'magiclink');
set local role authenticated;
select is(public.admin_bootstrap(), true, '예외 이메일은 최고 관리자로 연결');
select is((public.admin_me()->'roles')::text, '["super"]', 'admin_me 최고 관리자');
reset role;
select is((select count(*)::int from public.admin_audit
  where admin_email = 'yeabin0909@gmail.com' and action = 'execute' and screen = 'AD-18'
    and reason = '예외 이메일 최고 관리자' and detail->>'exception' = 'true'), 1, '감사 로그 남음');
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000008', 'aal2', 'magiclink');
set local role authenticated;
select is(public.admin_bootstrap(), false, '두 번째는 없음(이미 관리자)');
reset role;

select * from finish();
rollback;
