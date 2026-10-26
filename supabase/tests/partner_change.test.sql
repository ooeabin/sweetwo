-- pgTAP: 배우자 변경 알림(08 4장, 14). 10분 묶기, 되돌리면 안 알림, 바로 알림과 주간 요약에만 가는 변경, 내 목표 제외, 주간 요약.
-- 찬우(시작한 사람), 예빈(합류한 사람). 고친 사람은 request.jwt.claims로만 정함(권한 검사는 다른 테스트)
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
select public.save_split(jsonb_build_array(
  jsonb_build_object('kind', 'saving', 'goal_id', (select id from public.goal where template = 'home'), 'amount', 950000),
  jsonb_build_object('kind', 'living', 'amount', 880000)
), auth.uid());
insert into public.asset (space_id, side, grp, kind, name, amount, owner)
  select space_id, 'asset', 'deposit', 'deposit_money', '전세 보증금', 200000000, 'joint' from public.app_user where id = auth.uid();
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
insert into public.goal (space_id, template, name, kind, priority, owner_user_id)
  select space_id, 'hobby', '자기계발', 'once', 2, auth.uid() from public.app_user where id = auth.uid();
reset role;
select is((select count(*)::int from public.partner_change), 0, '합류 전 변경과 내 목표 추가는 남기지 않음');
delete from public.notification;

-- 예빈(고친 사람)이 우리 목표 금액을 바꿈 → 10분 전에는 안 보냄, 지나면 찬우에게 하나
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
update public.goal set target_amount = 150000000 where template = 'home';
update public.goal set name = '내 공부' where template = 'hobby';
select is(public.flush_partner_changes(now() + interval '5 minutes'), 0, '10분 전에는 안 보냄');
select is(public.flush_partner_changes(now() + interval '11 minutes'), 1, '10분 지나면 보냄(내 목표는 없음)');
select results_eq(
  $$ select user_id, title, body, target, topic from public.notification $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid, '예빈님이 내 집 마련 목표를 바꿨어요', '목표 금액 1억 원 → 1억 5,000만 원',
             '/goals/' || (select id from public.goal where template = 'home'), 'partner_change') $$,
  '목표 변경 알림');

-- 되돌리기(같은 값으로 돌아옴)는 알리지 않음
update public.goal set target_amount = 200000000 where template = 'home';
update public.goal set target_amount = 150000000 where template = 'home';
select is(public.flush_partner_changes(now() + interval '11 minutes'), 0, '되돌린 변경은 안 알림');

-- 분배표 금액 + 월급 금액 → 묶어서 하나, 자산 금액은 활동 기록(인앱만)
select public.save_split(jsonb_build_array(
  jsonb_build_object('kind', 'saving', 'goal_id', (select id from public.goal where template = 'home'), 'amount', 1070000),
  jsonb_build_object('kind', 'living', 'amount', 700000)
), '22222222-2222-2222-2222-222222222222');
update public.app_user set monthly_income = 2800000 where id = '22222222-2222-2222-2222-222222222222';
update public.asset set amount = 220000000 where name = '전세 보증금';
select is(public.flush_partner_changes(now() + interval '11 minutes'), 2, '바로 알림 하나 + 활동 기록 하나');
select is((select title || ' / ' || body from public.notification where kind = 'partner_change' and body like '생활비%'),
  '예빈님이 2가지를 바꿨어요 / 생활비 68만 원 → 70만 원 외 1개', '여럿이면 묶음 문구');
select results_eq(
  $$ select title, body, topic from public.notification where kind = 'partner_activity' $$,
  $$ values ('예빈님이 우리 자산을 바꿨어요', '전세 보증금 2억 원 → 2억 2,000만 원', 'silent') $$,
  '자산 금액은 활동 기록만');
select is((select count(*)::int from public.notification where user_id = '22222222-2222-2222-2222-222222222222'), 0,
  '고친 사람에게는 알림 없음');

-- 월요일 주간 요약: 지난주 바꾼 것(같은 항목은 하나, 되돌린 것 빼고) = 목표 금액, 생활비, 월급, 자산 = 4
select is(public.send_weekly_summary(public.kst_today() + 1), 1, '찬우에게 요약 하나');
select is((select title from public.notification where kind = 'weekly_summary'), '이번 주 예빈님이 바꾼 게 4개 있어요', '요약 문구');

select * from finish();
rollback;
