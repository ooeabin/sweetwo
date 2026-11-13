-- pgTAP: QA 12구간 어드민 서버(2026-11-12). 찬우(문의한 사람), 예빈(찬우의 파트너), K(다른 회원), 관리자 cs01(CS), ops01(운영)
-- S12-06 AD-04 L1·AD-05는 그 회원(또는 지금 파트너)의 문의 번호만, S12-15 데스크톱·웹 버전 키 거절, 대시보드에서 데스크톱 기기 뺌
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'k@example.com'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'cs01@sweetwo.kr'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'ops01@sweetwo.kr');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao'),
  ('kakao-k', '33333333-3333-3333-3333-333333333333', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', 'aal2', 'amr', json_build_array(json_build_object('method', 'totp', 'timestamp', extract(epoch from now())::bigint)))::text, true);
$$;
create function pg_temp.signup(uid uuid) returns void language plpgsql as $$
begin
  perform pg_temp.login_as(uid);
  set local role authenticated;
  perform public.complete_signup('kakao', null, false, 'v1');
  perform public.ensure_my_space();
  reset role;
end $$;
select pg_temp.signup('11111111-1111-1111-1111-111111111111');
select pg_temp.signup('22222222-2222-2222-2222-222222222222');
select pg_temp.signup('33333333-3333-3333-3333-333333333333');
-- 예빈을 찬우 공간으로(파트너 연결 흉내)
update public.app_user set space_id = (select space_id from public.app_user where id = '11111111-1111-1111-1111-111111111111')
  where id = '22222222-2222-2222-2222-222222222222';

-- 찬우의 앱 문의, 회원 연결 없는 이메일 문의
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select set_config('test.no', public.create_inquiry('couple', '연결이 안 돼요', null), true);
reset role;
with i as (insert into public.inquiry (category, body, channel) values ('account', '메일 문의', 'email') returning no)
select set_config('test.mail', (select no from i), true);
insert into public.admin_user (email, name, roles) values
  ('cs01@sweetwo.kr', 'cs01', array['cs']::public.admin_role[]),
  ('ops01@sweetwo.kr', 'ops01', array['ops']::public.admin_role[]);

select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000001');
set local role authenticated;
select public.admin_me();
-- AD-04 L1
select is(public.admin_reveal('11111111-1111-1111-1111-111111111111', '본인 확인', current_setting('test.no'), array['email'])->>'email',
  'chanwoo@example.com', 'L1: 문의한 본인');
select is(public.admin_reveal('22222222-2222-2222-2222-222222222222', '본인 확인', lower(current_setting('test.no')), array['email'])->>'email',
  'yebin@example.com', 'L1: 문의한 사람의 지금 파트너(문의 번호 소문자도)');
select throws_ok(format($$ select public.admin_reveal('33333333-3333-3333-3333-333333333333', '본인 확인', %L, array['email']) $$,
  current_setting('test.no')), '22023', 'reason_required', 'L1: 다른 회원의 문의 번호면 거절');
select throws_ok(format($$ select public.admin_reveal('11111111-1111-1111-1111-111111111111', '본인 확인', %L, array['email']) $$,
  current_setting('test.mail')), '22023', 'reason_required', 'L1: 회원 연결 없는 이메일 문의 번호면 거절');
select throws_ok($$ select public.admin_reveal('11111111-1111-1111-1111-111111111111', '본인 확인', 'A-0', array['email']) $$,
  '22023', 'reason_required', 'L1: 없는 문의 번호');
-- AD-05
select throws_ok(format($$ select public.admin_account_action('33333333-3333-3333-3333-333333333333', 'sign_out_all', %L, '탈취 의심') $$,
  current_setting('test.no')), '22023', 'reason_required', 'AD-05: 다른 회원의 문의 번호면 거절');
select throws_ok(format($$ select public.admin_account_action('33333333-3333-3333-3333-333333333333', 'delete_request', %L, '본인 확인') $$,
  current_setting('test.no')), '22023', 'reason_required', 'AD-05: 삭제 대리 접수도 거절');
select lives_ok(format($$ select public.admin_account_action('22222222-2222-2222-2222-222222222222', 'rights_access', %L, '열람 요구') $$,
  current_setting('test.no')), 'AD-05: 파트너는 됨');
select lives_ok(format($$ select public.admin_account_action('11111111-1111-1111-1111-111111111111', 'sign_out_all', %L, '탈취 의심') $$,
  current_setting('test.no')), 'AD-05: 본인은 됨');
reset role;
select is((select count(*)::int from public.admin_audit where target = '33333333-3333-3333-3333-333333333333'), 0,
  '거절된 열람·조치는 감사 로그에도 없음');
select is((select status::text from public.app_user where id = '33333333-3333-3333-3333-333333333333'), 'active', 'K 계정은 그대로');
select ok(not has_function_privilege('authenticated', 'public.inquiry_is_about(text, uuid)', 'execute'), '도우미 함수는 앱에서 못 부름');

-- AD-16: 데스크톱·웹 버전 키 거절
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000004');
set local role authenticated;
select public.admin_me();
select throws_ok($$ select public.admin_request_app_config('{"min_version_desktop":"1.2.0"}') $$, '22023', 'bad_value', '데스크톱 최소 버전 거절');
select throws_ok($$ select public.admin_request_app_config('{"latest_version_desktop":"1.2.0"}') $$, '22023', 'bad_value', '데스크톱 최신 버전 거절');
select throws_ok($$ select public.admin_request_app_config('{"min_version_web":"1.2.0"}') $$, '22023', 'bad_value', '웹 최소 버전 거절');
reset role;

-- AD-01: 데스크톱 기기는 셈에서 뺌
update public.app_config set min_version_ios = '2.0.0', min_version_android = '2.0.0', min_version_desktop = '9.0.0' where id = 1;
insert into public.app_device (user_id, install_id, platform, app_version) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-4000-8000-000000000001', 'ios', '1.0.0'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-4000-8000-000000000002', 'desktop', '1.0.0'),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-4000-8000-000000000003', 'desktop', '1.0.0');
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000001');
set local role authenticated;
select is((public.admin_dashboard()->'versions'->>'below_min')::int, 1, '미만 기기는 iOS·Android만');
select is((select count(*)::int from jsonb_array_elements(public.admin_dashboard()->'versions'->'top') t where t->>'platform' = 'desktop'), 0,
  '버전별 기기 표에 데스크톱 없음');
reset role;

select * from finish();
rollback;
