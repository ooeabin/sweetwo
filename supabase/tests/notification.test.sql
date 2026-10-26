-- pgTAP: 알림. 내 알림만 보고 읽음 처리, 합류는 바로, 챙길 날(음력·서프라이즈)은 예약 작업으로,
-- 같은 알림은 한 번만
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
reset role;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select results_eq(
  $$ select kind, title from public.notification order by created_at, kind $$,
  $$ values ('partner_joined', '예빈님이 합류했어요') $$,
  '찬우: 합류');
select throws_ok($$ insert into public.notification (user_id, kind, title, target, dedupe)
  values (auth.uid(), 'x_y', 'x', '/', 'x') $$, '42501', null, '앱에서 알림을 못 넣음');
select is(public.mark_notifications_read(null), 1, '모두 읽음');
select is((select count(*)::int from public.notification where read_at is null), 0, '읽지 않은 알림 없음');
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
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

-- 월급날·월말 확인은 체크리스트 기준(checklist_cron_noti.test.sql)

select * from finish();
rollback;
