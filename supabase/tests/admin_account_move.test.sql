-- pgTAP: AD-05 삭제 대리 접수, 로그인 수단 이전(고객 지원 요청 → 최고 관리자 승인). 찬우, 예빈
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'cs01@sweetwo.kr'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'super01@sweetwo.kr'),
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'chanwoo.new@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao'),
  ('google-c', '33333333-3333-3333-3333-333333333333', '{}', 'google');
insert into public.admin_user (email, name, roles) values
  ('cs01@sweetwo.kr', 'cs01', array['cs']::public.admin_role[]),
  ('super01@sweetwo.kr', 'super01', array['super']::public.admin_role[]);
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', 'aal2')::text, true);
$$;

-- 찬우(기존 계정), 예빈(삭제 대리 접수)
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
reset role;
with i as (insert into public.inquiry (category, body) values ('account', '로그인 못 해요') returning no)
select set_config('test.no', (select no from i), true);

-- 고객 지원
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000001');
set local role authenticated;
select public.admin_me();
select lives_ok(format($$ select public.admin_account_action('22222222-2222-2222-2222-222222222222', 'delete_request', %L, '본인 확인') $$,
  current_setting('test.no')), '삭제 대리 접수');
select throws_ok(format($$ select public.admin_request_login_move('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com', %L, '') $$,
  current_setting('test.no')), 'P0001', 'new_not_found', '같은 계정 이메일은 못 찾음');
select throws_ok(format($$ select public.admin_request_login_move('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', %L, '') $$,
  current_setting('test.no')), '22023', 'same_account', '같은 계정');
select throws_ok($$ select public.admin_request_login_move('11111111-1111-1111-1111-111111111111', 'chanwoo.new@example.com', 'A-0', '') $$,
  '22023', 'reason_required', '문의 번호 필요');
select set_config('test.req', public.admin_request_login_move('11111111-1111-1111-1111-111111111111', 'chanwoo.new@example.com',
  current_setting('test.no'), '확인 메일 회신')::text, true);
select throws_ok(format($$ select public.admin_request_login_move('11111111-1111-1111-1111-111111111111', 'chanwoo.new@example.com', %L, '') $$,
  current_setting('test.no')), 'P0001', 'already_requested', '같은 요청 두 번 안 됨');
select throws_ok(format($$ select public.admin_decide(%L, 'approve') $$, current_setting('test.req')), '42501', 'no_permission', '고객 지원은 승인 못 함');
reset role;

-- 최고 관리자 승인
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000002');
set local role authenticated;
select public.admin_me();
select lives_ok(format($$ select public.admin_decide(%L, 'approve') $$, current_setting('test.req')), '승인하면 옮김');
reset role;

select is((select status::text from public.app_user where id = '22222222-2222-2222-2222-222222222222'), 'deletion_requested', '30일 유예');
select results_eq($$ select provider_id from auth.identities where user_id = '11111111-1111-1111-1111-111111111111' $$,
  $$ values ('google-c'::text) $$, '새 로그인 수단만 남음');
select is((select count(*) from auth.users where id = '33333333-3333-3333-3333-333333333333'), 0::bigint, '새 계정은 지움');
select results_eq($$ select provider::text, (select count(*) from public.mail_outbox m where m.user_id = u.id and m.kind = 'login_moved')
                     from public.app_user u where u.id = '11111111-1111-1111-1111-111111111111' $$,
  $$ values ('google'::text, 1::bigint) $$, '로그인 수단 바뀜 + 완료 메일');

select * from finish();
rollback;
