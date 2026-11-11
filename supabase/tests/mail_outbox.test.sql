-- pgTAP: 알림 메일 쌓기(2026-11-04 자동 예비로만: 꼭 필요한 메일만), 주간 요약은 알림만, 꺼내기·결과(14).
-- 찬우(시작한 사람), 예빈(합류한 사람)
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '찬우', monthly_income = 3500000, payday = 25 where id = auth.uid();
insert into public.goal (space_id, template, name, kind, priority, target_amount)
  select space_id, 'home', '내 집 마련', 'once', 1, 100000000 from public.app_user where id = auth.uid();
select set_config('test.code', (select code from public.create_invite()), true);
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈', monthly_income = 2700000, payday = 10 where id = auth.uid();
reset role; -- 합류 중인 사람은 공간 데이터를 못 읽음(D1), 줄 초안은 앱이 join_context로 만듦
select set_config('test.home', (select id::text from public.goal where template = 'home'), true);
set local role authenticated;
select public.complete_join(jsonb_build_array(
  jsonb_build_object('kind', 'saving', 'goal_id', current_setting('test.home')::uuid, 'amount', 1070000),
  jsonb_build_object('kind', 'living', 'amount', 680000)
));
reset role;
update public.app_user set notify_email = 'chanwoo@example.com' where id = '11111111-1111-1111-1111-111111111111';

-- 쌓기(2026-11-04 이메일은 자동 예비로만): 상한 안 메일(종류별 알림)은 안 쌓음, 꼭 필요한 메일은 설정과 상관없이 쌓음
select is(public.enqueue_mail('11111111-1111-1111-1111-111111111111', 'x_test', 'money', '제목', '본문', '<p>본문</p>', true, 'x:1'),
  false, '종류별 알림 메일은 안 보냄');
select is(public.enqueue_mail('11111111-1111-1111-1111-111111111111', 'x_test', null, '제목', '본문', '<p>본문</p>', false, 'x:2'),
  true, '꼭 필요한 메일은 쌓음');
update public.app_user set noti_prefs = '{"email":false}' where id = '22222222-2222-2222-2222-222222222222';
select is(public.enqueue_mail('22222222-2222-2222-2222-222222222222', 'x_test', null, '제목', '본문', '<p>본문</p>', false, 'x:3'),
  true, '예전 이메일 끄기 설정과 상관없이 쌓음');
delete from public.mail_outbox;

-- 주간 요약: 예빈이 우리 목표 금액을 바꿈 → 월요일 찬우에게 알림만(메일 없음)
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
update public.goal set target_amount = 150000000 where template = 'home';
select is(public.send_weekly_summary(public.kst_today() + 1), 1, '요약 하나');
select is((select count(*)::int from public.mail_outbox), 0, '주간 요약 메일은 안 보냄');
select is((select count(*)::int from public.notification where kind = 'weekly_summary'), 1, '알림은 남김');
select ok((select body_text like '예빈님이 바꾼 것' || E'\n' || '- 목표 금액 1억 원 → 1억 5,000만 원%'
  from public.weekly_mail_body('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', public.kst_today() + 1)),
  '요약 본문 바뀐 것 전 → 후');

select public.enqueue_mail('11111111-1111-1111-1111-111111111111', 'x_test', null, '제목', '본문', '<p>본문</p>', false, 'x:4');
-- 꺼내기 → 실패 기록 → 다시 꺼냄 → 보냄
select is((select count(*)::int from public.claim_mail(10)), 1, '꺼냄');
select public.finish_mail((select id from public.mail_outbox), null, 'ses 500');
select public.claim_mail(10);
select public.finish_mail((select id from public.mail_outbox), 'ses-1', null);
select results_eq($$ select attempts::int, message_id, sent_at is not null from public.mail_outbox $$,
  $$ values (2, 'ses-1', true) $$, '두 번째에 보냄');

select * from finish();
rollback;
