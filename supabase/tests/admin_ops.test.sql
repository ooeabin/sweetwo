-- pgTAP: 어드민 운영(AD-10·14·15·16·18·19)과 2인 승인. boss(최고), boss2(최고), ops01(운영), 외부인 x
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'boss@sweetwo.kr'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'boss2@sweetwo.kr'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'ops01@sweetwo.kr'),
  ('aaaaaaaa-0000-0000-0000-000000000009', 'x@gmail.com');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', 'aal2')::text, true);
$$;

-- 첫 최고 관리자: 회사 도메인만, 한 번만
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000009');
set local role authenticated;
select is(public.admin_bootstrap(), false, '회사 도메인이 아니면 안 됨');
reset role;
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000002');
set local role authenticated;
select is(public.admin_bootstrap(), true, '첫 최고 관리자');
select is(public.admin_bootstrap(), false, '두 번째는 없음');
-- 관리자 추가는 승인 요청(본인 승인 불가)
select set_config('test.a1', public.admin_request_user('boss2@sweetwo.kr', '대표2', array['super']::public.admin_role[])::text, true);
select throws_ok(format($$ select public.admin_decide(%L, 'approve') $$, current_setting('test.a1')), '42501', 'self_approval', '본인 승인 불가');
reset role;
-- boss2가 없으니 흉내로 직접 넣고 승인
insert into public.admin_user (id, email, name, roles) values ('aaaaaaaa-0000-0000-0000-000000000003', 'boss2@sweetwo.kr', '대표2', array['super']::public.admin_role[]);
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000002');
set local role authenticated;
select set_config('test.a2', public.admin_request_user('ops01@sweetwo.kr', '운영1', array['ops']::public.admin_role[])::text, true);
reset role;
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000003');
set local role authenticated;
select lives_ok(format($$ select public.admin_decide(%L, 'approve') $$, current_setting('test.a2')), '다른 최고 관리자가 승인');
select is((select count(*)::int from public.admin_users() where email = 'ops01@sweetwo.kr' and roles = array['ops']::public.admin_role[]), 1, '관리자 추가 적용');
reset role;

-- 운영: 공지 저장 + 게시 요청(밤 10시~아침 8시 시작 불가)
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000004');
set local role authenticated;
select public.admin_me();
select throws_ok($$ select public.admin_save_notice(null, 'info', '점검 안내', '', 'must', array['desktop','web'],
  (current_date + 1)::timestamp at time zone 'Asia/Seoul' + interval '23 hours', (current_date + 3)::timestamp at time zone 'Asia/Seoul', true) $$,
  '22023', 'quiet_hours', '방해 금지 시간 시작은 저장 불가');
reset role;
-- 시각 의존을 피하려고 승인 흐름은 직접 넣은 공지로
insert into public.notice (id, kind, title, importance, starts_at, ends_at, status)
  values ('bbbbbbbb-0000-0000-0000-000000000001', 'info', '새 기능', 'normal', now() - interval '1 hour', now() + interval '1 day', 'requested');
insert into public.admin_approval (id, kind, payload, summary, requested_by)
  values ('cccccccc-0000-0000-0000-000000000001', 'notice_publish', '{"notice_id":"bbbbbbbb-0000-0000-0000-000000000001"}', '공지 게시: 새 기능', 'aaaaaaaa-0000-0000-0000-000000000004');
set local role anon;
select is((select count(*)::int from public.notice where id = 'bbbbbbbb-0000-0000-0000-000000000001'), 0, '승인 전에는 앱에 안 보임');
reset role;
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000004');
set local role authenticated;
select throws_ok($$ select public.admin_decide('cccccccc-0000-0000-0000-000000000001', 'approve') $$, '42501', 'no_permission', '운영은 승인 못 함');
reset role;
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000002');
set local role authenticated;
select public.admin_decide('cccccccc-0000-0000-0000-000000000001', 'approve');
reset role;
set local role anon;
select is((select title from public.notice where id = 'bbbbbbbb-0000-0000-0000-000000000001'), '새 기능', '승인되면 앱에 보임');
reset role;

-- 약관: 법률 검토 없으면 요청 불가, 승인되면 앱이 읽음
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000004');
set local role authenticated;
select throws_ok($$ select public.admin_add_terms_version('terms', 'v2', current_date + 30, true, false) $$, '22023', 'legal_check_required', '법률 검토 필요');
select isnt(public.admin_add_terms_version('terms', 'v2', current_date + 30, true, true), null, '약관 버전 요청');
-- 앱 버전·점검: 저장 = 승인 요청, 모르는 키 거절
select throws_ok($$ select public.admin_request_app_config('{"flags":{}}') $$, '22023', 'bad_value', '정해진 값만');
select set_config('test.cfg', public.admin_request_app_config(jsonb_build_object('min_version_desktop', '1.2.0',
  'maintenance_starts_at', now() + interval '1 day', 'maintenance_ends_at', now() + interval '1 day 2 hours', 'maintenance_message', '저장 기능 점검'))::text, true);
-- 기준 데이터
select lives_ok($$ select public.admin_set_loan_rate('credit', 650, current_date) $$, '평균 금리 바꿈');
select lives_ok($$ select public.admin_set_holiday('2026-12-31', '임시공휴일', 'temporary') $$, '공휴일 추가');
select lives_ok($$ select public.admin_add_content_version('faq', 'couple', '1.1', current_date, current_date, null) $$, '도움말 버전');
reset role;
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000003');
set local role authenticated;
select public.admin_decide((select id from public.admin_approvals() where kind = 'app_version'), 'approve');
select public.admin_decide((select id from public.admin_approvals() where kind = 'terms_version'), 'approve');
reset role;
select results_eq($$ select min_version_desktop, maintenance_message from public.app_config $$,
  $$ values ('1.2.0', '저장 기능 점검') $$, '앱 버전·점검 적용');
set local role anon;
select results_eq($$ select version, reconsent from public.terms_version $$, $$ values ('v2', true) $$, '승인된 약관 버전');
select is((select rate_bp from public.loan_rate where kind = 'credit'), 650, '앱은 평균 금리를 읽음');
reset role;

select * from finish();
rollback;
