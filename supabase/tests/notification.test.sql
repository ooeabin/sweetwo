-- pgTAP: 알림. 내 알림만 보고 읽음 처리, 제안 도착·응답·합류는 바로, 챙길 날(음력·서프라이즈)·월급날·월말 정리는 예약 작업으로,
-- 같은 알림은 한 번만
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- 문구 도우미
select is(public.read_won(300000), '30만 원', '금액 읽기');
select is(public.read_won(3205000), '320만 5,000원', '금액 읽기(천 원 단위)');
select is(public.ko_subj('어머니 생신') || ', ' || public.ko_subj('설날 연휴') || ', ' || public.ko_is('예빈 생일'),
  '어머니 생신이, 설날 연휴가, 예빈 생일이에요', '조사');

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '찬우', side = 'groom', payday = 10;
select set_config('test.code', (select code from public.create_invite()), true);
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈', side = 'bride', payday = 25, allowance = 500000;
select public.finish_join();
select isnt(public.propose('allowance', '{"allowance":600000}', current_date + 30), null, '예빈 용돈 제안');
select is((select count(*)::int from public.notification), 0, '내가 보낸 제안은 내 센터에 없음');
reset role;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select results_eq(
  $$ select kind, title from public.notification order by created_at, kind $$,
  $$ values ('partner_joined', '예빈님이 합류했어요'),
            ('proposal_arrived', '예빈님이 용돈을 바꾸자고 제안했어요') $$,
  '찬우: 합류, 제안 도착');
select is((select actor_id from public.notification where kind = 'proposal_arrived'),
  '22222222-2222-2222-2222-222222222222'::uuid, '보낸 사람 Avatar');
select is(public.respond_proposal((select id from public.proposal where status = 'open'), 'like')::text, 'applied', '좋아요');
select throws_ok($$ insert into public.notification (user_id, kind, title, target, dedupe)
  values (auth.uid(), 'x_y', 'x', '/', 'x') $$, '42501', null, '앱에서 알림을 못 넣음');
select is(public.mark_notifications_read(null), 2, '모두 읽음');
select is((select count(*)::int from public.notification where read_at is null), 0, '읽지 않은 알림 없음');
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is((select title || ' / ' || body from public.notification where kind = 'proposal_answered'),
  '찬우님이 용돈 제안에 좋아요를 눌렀어요 / 바로 적용했어요', '예빈: 응답 결과');
-- 챙길 날: 음력 8월 15일(2026 추석 = 9월 25일) D-7 같이, 서프라이즈는 만든 사람만
insert into public.care_day (space_id, category, kind, name, date_rule, month, day, budget, carer)
  select space_id, 'family', 'chuseok', '추석', 'lunar_yearly', 8, 15, 500000, 'together' from public.app_user;
insert into public.care_day (space_id, category, kind, name, date_rule, month, day, carer, secret, alerts)
  select space_id, 'couple', 'partner_birthday', '찬우 생일', 'solar_yearly', 9, 18, 'bride', true, '{30,7,0}' from public.app_user;
reset role;

select is(public.send_morning_notifications('2026-09-18'), 3, '추석 D-7 둘 + 서프라이즈 당일 하나');
select public.send_morning_notifications('2026-09-18');
select results_eq(
  $$ select user_id, title, push_title, push_hidden from public.notification where kind = 'care_day' order by user_id, title $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid, '추석이 일주일 남았어요', null::text, false),
            ('22222222-2222-2222-2222-222222222222'::uuid, '오늘은 찬우 생일이에요', '챙길 날 알림이 있어요', true),
            ('22222222-2222-2222-2222-222222222222'::uuid, '추석이 일주일 남았어요', null::text, false) $$,
  '음력 날짜, 서프라이즈는 만든 사람만 + OS 알림 숨김, 다시 돌려도 한 번');

-- 월말 정리: 플랜 사이클 끝 3일 전(2026-10-22), 전날 리마인드는 정리 전일 때만
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.start_first_plan('2026-09-01', '2026-09-25', '2026-10-24', null, false, false, '{}',
  '[{"target":"account","account_role":"living","amount":870000,"amount_groom":520000,"amount_bride":350000}]');
reset role;
select is(public.send_evening_notifications('2026-10-22'), 2, '월말 정리 둘 다');
select is((select title from public.notification where kind = 'close_start' limit 1),
  '9월 월급 플랜을 정리할 차례예요', '월말 정리 문구');

select * from finish();
rollback;
