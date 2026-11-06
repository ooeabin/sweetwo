-- pgTAP: AD-04 금액 원값은 최고 관리자 승인 뒤 사용자에게 요청, 거절이면 구간으로만. 찬우(사용자), cs01, boss
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'cs01@sweetwo.kr'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'boss@sweetwo.kr');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao');
insert into public.admin_user (email, name, roles) values
  ('cs01@sweetwo.kr', 'cs01', array['cs']::public.admin_role[]),
  ('boss@sweetwo.kr', '대표', array['super']::public.admin_role[]);
create function pg_temp.login_as(uid uuid, aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
$$;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
select public.create_inquiry('calc', '목표 금액이 이상해요', null);
reset role;
select set_config('test.qid', (select id::text from public.inquiry), true);

-- cs01: 원값은 화면 1개, 승인 요청만(사용자에게 아직 안 감)
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000001', 'aal2');
set local role authenticated;
select public.admin_me();
select throws_ok($$ select public.admin_request_access(current_setting('test.qid')::uuid, array['goals', 'assets'], true, '확인') $$,
  '22023', 'raw_one_screen', '원값은 화면 1개만');
select set_config('test.a1', public.admin_request_access(current_setting('test.qid')::uuid, array['goals'], true, '목표 금액 확인')::text, true);
select set_config('test.a2', public.admin_request_access(current_setting('test.qid')::uuid, array['assets'], true, '자산 확인')::text, true);
reset role;
select is((select count(*)::int from public.access_request), 0, '승인 전에는 사용자에게 요청 안 감');
select is((select count(*)::int from public.admin_approval where kind = 'access_raw' and status = 'requested'), 2, '최고 관리자 승인 대기');

-- boss: 하나는 승인(원값), 하나는 거절(구간으로만)
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000002', 'aal2');
set local role authenticated;
select public.admin_me();
select public.admin_decide(current_setting('test.a1')::uuid, 'approve');
select public.admin_decide(current_setting('test.a2')::uuid, 'reject');
reset role;
select results_eq($$ select scope[1], raw_amount, (select email from public.admin_user where id = admin_id) from public.access_request order by scope[1] $$,
  $$ values ('assets'::text, false, 'cs01@sweetwo.kr'::text), ('goals', true, 'cs01@sweetwo.kr') $$, '승인 = 원값, 거절 = 구간, 요청자는 고객 지원');
select is((select count(*)::int from public.notification where kind = 'access_request'), 2, '사용자에게 동의 요청 알림');
select is((select count(*)::int from public.admin_audit where action = 'request' and screen = 'AD-04' and admin_email = 'cs01@sweetwo.kr'), 4,
  '감사 로그: 승인 요청 2 + 사용자 요청 2');
select is((select count(*)::int from public.admin_audit where action = 'approve' and screen = 'AD-04'), 2, '결정 기록');

select * from finish();
rollback;
