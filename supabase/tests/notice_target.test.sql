-- pgTAP: 공지 대상 조건(커플 상태·플랫폼·앱 버전·가입 주차), 대상 수, 앱이 읽는 공지, 승인 요청(대상 0명 불가),
-- 장애 고지 메일은 대상에 맞는 사람만(약관 개정은 모두), 테스트 발송은 관리자 본인 메일로만.
-- 찬우(연결, 가입 5주차, 데스크톱 1.2.0), 예빈(연결, 1주차, iOS 1.5.0), 3번(혼자 쓰기, 1주차, 기기 없음, 메일 반송 2번)
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'solo@example.com'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'ops01@sweetwo.kr');
insert into public.couple_space (id, couple_state) values
  ('dddddddd-0000-0000-0000-000000000001', 'connected'),
  ('dddddddd-0000-0000-0000-000000000002', 'solo');
insert into public.app_user (id, provider, notify_email, notify_email_source, space_id, created_at) values
  ('11111111-1111-1111-1111-111111111111', 'kakao', 'chanwoo@example.com', 'provider', 'dddddddd-0000-0000-0000-000000000001', now() - interval '30 days'),
  ('22222222-2222-2222-2222-222222222222', 'kakao', 'yebin@example.com', 'provider', 'dddddddd-0000-0000-0000-000000000001', now() - interval '2 days'),
  ('33333333-3333-3333-3333-333333333333', 'kakao', 'solo@example.com', 'provider', 'dddddddd-0000-0000-0000-000000000002', now() - interval '3 days');
insert into public.app_device (user_id, install_id, platform, app_version) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-4000-8000-000000000001', 'desktop', '1.2.0'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-4000-8000-000000000002', 'ios', '1.5.0');
insert into public.mail_suppress (email, bounces) values ('solo@example.com', 2);
insert into public.admin_user (id, email, name, roles) values
  ('aaaaaaaa-0000-0000-0000-000000000004', 'ops01@sweetwo.kr', '운영1', array['ops']::public.admin_role[]);
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', 'aal2')::text, true);
$$;

-- 조건 모양
select is(public.notice_target_valid('{"couple_states":["moon"]}'), false, '없는 커플 상태는 안 됨');
select is(public.notice_target_valid('{"amount":1000}'), false, '금액 조건은 없음');
select is(public.notice_target_valid('{"weeks_min":4,"weeks_max":2}'), false, '가입 주차 처음이 끝보다 늦으면 안 됨');
select is(public.notice_target_valid('{"couple_states":["solo","connected"],"version_below":"1.3.0","weeks_min":1,"weeks_max":4}'), true, '조건 모두');
select throws_ok($$ insert into public.notice (kind, title, starts_at, ends_at, target)
  values ('terms', '이용약관이 바뀌어요', now(), now() + interval '1 day', '{"couple_states":["solo"]}') $$,
  '23514', null, '약관 개정은 대상 조건 없이 모두');

-- 대상 수(운영)
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000004');
set local role authenticated;
select is((public.admin_notice_audience('info', array['desktop','mobile'], '{}', false) ->> 'target')::int, 3, '조건 없음: 모두');
select is((public.admin_notice_audience('info', array['desktop','mobile'], '{"couple_states":["solo"]}', false) ->> 'target')::int, 1, '커플 상태');
select is((public.admin_notice_audience('info', array['mobile'], '{}', false) ->> 'target')::int, 1, '모바일 앱 기기가 있는 사람만');
select is((public.admin_notice_audience('maintenance', array['desktop','mobile'], '{"version_below":"1.3.0"}', false) ->> 'target')::int, 1, '1.3.0보다 낮은 앱');
select is((public.admin_notice_audience('info', array['desktop','mobile'], '{"weeks_max":1}', false) ->> 'target')::int, 2, '가입 1주차');
select is((public.admin_notice_audience('incident', array['desktop','mobile'], '{}', true) ->> 'target')::int, 2, '장애 메일: 막힌 주소 빼고');
select is((public.admin_notice_audience('incident', array['desktop','mobile'], '{}', true) ->> 'excluded')::int, 1, '장애 메일: 제외 1명(반송)');
select is((public.admin_notice_audience('terms', array['mobile'], '{"couple_states":["solo"]}', true) ->> 'target')::int, 2, '약관 개정은 조건·플랫폼과 상관없이 모두');
reset role;

-- 앱이 읽는 공지
insert into public.notice (id, kind, title, starts_at, ends_at, status, target) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'info', '모두', now() - interval '1 hour', now() + interval '1 day', 'published', '{}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'info', '혼자 쓰기만', now() - interval '1 hour', now() + interval '1 day', 'published', '{"couple_states":["solo"]}'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'maintenance', '업데이트해 주세요', now() - interval '1 hour', now() + interval '1 day', 'published', '{"version_below":"1.3.0"}');
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
set local role authenticated;
select is((select array_agg(x ->> 'title' order by x ->> 'title') from jsonb_array_elements(public.my_notices('desktop', '1.2.0')) x),
  array['모두', '업데이트해 주세요'], '찬우 1.2.0: 버전 공지 보임, 혼자 쓰기 공지 안 보임');
select is((select array_agg(x ->> 'title') from jsonb_array_elements(public.my_notices('desktop', '1.4.0')) x),
  array['모두'], '1.4.0이면 버전 공지 안 보임');
select is((select count(*)::int from public.notice where id::text like 'bbbbbbbb%'), 1, '직접 읽기는 조건 없는 공지만');
reset role;
select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333', 'role', 'authenticated')::text, true);
set local role authenticated;
select is((select array_agg(x ->> 'title' order by x ->> 'title') from jsonb_array_elements(public.my_notices('desktop', null)) x),
  array['모두', '혼자 쓰기만'], '혼자 쓰기: 버전 모르면 버전 공지 안 보임');
reset role;

-- 승인 요청: 대상 0명이면 안 됨
insert into public.notice (id, kind, title, starts_at, ends_at, status, target) values
  ('bbbbbbbb-0000-0000-0000-000000000004', 'info', '해제 대기만', now() + interval '1 day', now() + interval '2 days', 'draft', '{"couple_states":["unlink_pending"]}'),
  ('bbbbbbbb-0000-0000-0000-000000000005', 'info', '연결만', now() + interval '1 day', now() + interval '2 days', 'draft', '{"couple_states":["connected"]}');
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000004');
set local role authenticated;
select throws_ok($$ select public.admin_request_notice('bbbbbbbb-0000-0000-0000-000000000004') $$, '22023', 'no_audience', '대상 0명은 승인 요청 불가');
select lives_ok($$ select public.admin_request_notice('bbbbbbbb-0000-0000-0000-000000000005') $$, '대상이 있으면 승인 요청');
-- 테스트 발송: 메일 공지만, 본인 메일로만
select throws_ok($$ select public.admin_test_notice_mail('info', '안내', '') $$, '22023', 'bad_notice', '일반 공지는 테스트 메일 없음');
select lives_ok($$ select public.admin_test_notice_mail('incident', '서비스 이용에 문제가 있었어요', '지금은 정상이에요') $$, '장애 고지 테스트 메일');
reset role;
select is((select status from public.notice where id = 'bbbbbbbb-0000-0000-0000-000000000005'), 'requested', '승인 대기로');
select results_eq($$ select to_email, subject from public.mail_outbox where kind = 'notice_test' $$,
  $$ values ('ops01@sweetwo.kr'::text, '[테스트] 서비스 이용에 문제가 있었어요'::text) $$, '관리자 본인 메일로만, 제목 앞 [테스트]');

-- 장애 고지 메일: 대상(연결) 두 사람만
insert into public.notice (kind, title, body, starts_at, ends_at, status, email, target) values
  ('incident', '서비스 이용에 문제가 있었어요', '지금은 정상이에요', now() - interval '1 hour', now() + interval '1 day', 'published', true, '{"couple_states":["connected"]}');
select public.send_notice_mails(now());
select results_eq($$ select user_id from public.mail_outbox where kind = 'notice_incident' order by user_id $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid), ('22222222-2222-2222-2222-222222222222'::uuid) $$, '장애 고지 메일은 대상에 맞는 사람만');

select * from finish();
rollback;
