-- pgTAP: 알림 메일 쌓기(받는 방법·묶음 이메일 토글, 월 6회 상한), 주간 요약 메일 본문, 꺼내기·결과(14).
-- 찬우(시작한 사람), 예빈(합류한 사람)
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

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
select public.complete_join(jsonb_build_array(
  jsonb_build_object('kind', 'saving', 'goal_id', (select id from public.goal where template = 'home'), 'amount', 1070000),
  jsonb_build_object('kind', 'living', 'amount', 680000)
));
reset role;
update public.app_user set notify_email = 'chanwoo@example.com' where id = '11111111-1111-1111-1111-111111111111';

-- 쌓기: 받는 방법·묶음 이메일을 끄면 안 쌓음, 월 6회 상한(상한 밖 메일은 셈하지 않음)
select is(public.enqueue_mail('11111111-1111-1111-1111-111111111111', 'x_test', 'money', '제목', '본문', '<p>본문</p>', true, 'x:1'),
  true, '쌓음');
update public.app_user set noti_prefs = '{"topics":{"money":{"email":false}}}' where id = '11111111-1111-1111-1111-111111111111';
select is(public.enqueue_mail('11111111-1111-1111-1111-111111111111', 'x_test', 'money', '제목', '본문', '<p>본문</p>', true, 'x:2'),
  false, '묶음 이메일을 끄면 안 쌓음');
update public.app_user set noti_prefs = '{}' where id = '11111111-1111-1111-1111-111111111111';
select public.enqueue_mail('11111111-1111-1111-1111-111111111111', 'x_test', null, '제목', '본문', '<p>본문</p>', true, 'x:' || n)
  from generate_series(3, 7) n;
select is(public.enqueue_mail('11111111-1111-1111-1111-111111111111', 'x_test', null, '제목', '본문', '<p>본문</p>', true, 'x:8'),
  false, '월 6회 넘으면 안 쌓음');
select is(public.enqueue_mail('11111111-1111-1111-1111-111111111111', 'x_test', null, '제목', '본문', '<p>본문</p>', false, 'x:9'),
  true, '상한 밖 메일은 쌓음');
update public.app_user set noti_prefs = '{"email":false}' where id = '22222222-2222-2222-2222-222222222222';
select is(public.enqueue_mail('22222222-2222-2222-2222-222222222222', 'x_test', null, '제목', '본문', '<p>본문</p>', false, 'x:10'),
  false, '받는 방법 이메일을 끄면 안 쌓음');
delete from public.mail_outbox;

-- 주간 요약 메일: 예빈이 우리 목표 금액을 바꿈 → 월요일 찬우에게 알림 + 메일(상한 밖)
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
update public.goal set target_amount = 150000000 where template = 'home';
select is(public.send_weekly_summary(public.kst_today() + 1), 1, '요약 하나');
select results_eq(
  $$ select to_email, kind, subject, capped from public.mail_outbox $$,
  $$ values ('chanwoo@example.com', 'weekly_summary', '이번 주 예빈님이 바꾼 게 1개 있어요', false) $$,
  '메일 쌓임');
select ok((select body_text like '예빈님이 바꾼 것' || E'\n' || '- 목표 금액 1억 원 → 1억 5,000만 원%' from public.mail_outbox),
  '바뀐 것 전 → 후');
select ok((select body_html like '%<a href="https://sweetwo.kr/n">앱에서 보기</a>%<a href="https://sweetwo.kr/n/settings">알림 설정</a>%'
  from public.mail_outbox), '앱에서 보기, 알림 설정 링크');

-- 꺼내기 → 실패 기록 → 다시 꺼냄 → 보냄
select is((select count(*)::int from public.claim_mail(10)), 1, '꺼냄');
select public.finish_mail((select id from public.mail_outbox), null, 'ses 500');
select public.claim_mail(10);
select public.finish_mail((select id from public.mail_outbox), 'ses-1', null);
select results_eq($$ select attempts::int, message_id, sent_at is not null from public.mail_outbox $$,
  $$ values (2, 'ses-1', true) $$, '두 번째에 보냄');

select * from finish();
rollback;
