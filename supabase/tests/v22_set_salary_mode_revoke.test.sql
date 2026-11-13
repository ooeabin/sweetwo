-- pgTAP: v2.2 PR 11(20261205090000). 앱 역할은 옛 set_salary_mode를 못 부르고, 바꾸기는 request_mode_change로만.
-- request_mode_change(바로 적용 경로)는 안에서 set_salary_mode를 그대로 씀
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);
insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select ok(not has_function_privilege('authenticated', 'public.set_salary_mode(public.salary_mode)', 'execute'),
  '앱 역할은 set_salary_mode 실행 권한 없음');
select ok(not has_function_privilege('anon', 'public.set_salary_mode(public.salary_mode)', 'execute'),
  '익명도 없음');
select ok(has_function_privilege('authenticated', 'public.request_mode_change(boolean, boolean, text, text)', 'execute'),
  'request_mode_change는 그대로');

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
select throws_ok($$ select public.set_salary_mode('joint') $$, '42501', null, '앱 역할이 부르면 거절');
-- 혼자(연결 전)는 바로 적용: 안에서 set_salary_mode가 돎
select is(public.request_mode_change(true, null, 'together'), 'applied', '세 질문으로 바꾸기는 됨');
select is((select salary_mode::text from public.couple_space), 'joint', '엔진도 합쳐서로');
reset role;

select * from finish();
rollback;
