-- pgTAP: v2.2 후속 계약 2(20261208090000, P2 = A). 월급 변경 ‘이번 달부터’는 그 달 월급날 전이어도 바로 적용,
-- 한 사람 관리형 보내기 줄과 이번 사이클 확인 목록의 체크 안 한 줄만 다시 맞춤(체크한 줄은 그대로), 미래 달은 예약
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'other@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao'),
  ('kakao-o', '33333333-3333-3333-3333-333333333333', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.sl(p_owner uuid, k text, p_user uuid default null) returns uuid language sql as $$
  select l.id from public.split_line l join public.salary_split s on s.id = l.split_id
  where s.owner_user_id is not distinct from p_owner and l.kind::text = k and (p_user is null or l.user_id = p_user) limit 1;
$$;

-- 찬우(시작한 사람, 25일), 다른 사람(혼자)
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '찬우', monthly_income = 3500000, payday = 25 where id = auth.uid();
insert into public.goal (space_id, template, name, kind, priority, target_amount)
  select space_id, 'home', '내 집 마련', 'once', 1, 100000000 from public.app_user where id = auth.uid();
select public.save_split(jsonb_build_array(
  jsonb_build_object('kind', 'saving', 'goal_id', (select id from public.goal where template = 'home'), 'amount', 950000),
  jsonb_build_object('kind', 'fixed', 'amount', 680000),
  jsonb_build_object('kind', 'living', 'amount', 880000)
), auth.uid());
select set_config('test.code', (select code from public.create_invite()), true);
reset role;
select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈', monthly_income = 2700000, payday = 10 where id = auth.uid();
select public.complete_join(jsonb_build_array(jsonb_build_object('kind', 'fixed', 'amount', 680000)));
reset role;
delete from public.notification;
create function pg_temp.send_amt() returns bigint language sql security definer as $$
  select amount from public.split_line where kind = 'send' and user_id = '22222222-2222-2222-2222-222222222222';
$$;

-- 예빈 ‘월급은 대부분 찬우님에게 보내요’ → 찬우 수락
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.request_mode_change(true, true, 'partner', 'p04_send');
reset role;
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.answer_mode_change((select id from public.mode_change_request where status = 'open'), true);
reset role;
-- 예빈 용돈 30만, 월급날 말일(이번 달 사이클 시작일이 보통 오늘 뒤)
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.split_line_add((select id from public.salary_split where owner_user_id is null), 'allowance', 300000);
reset role;
update public.app_user set payday = null, payday_last = true where id = '22222222-2222-2222-2222-222222222222';
-- 이번 사이클 공동 확인 목록(보내기 줄은 손 줄로 두어 체크 안 한 상태)
update public.split_line set auto_pay = false where kind = 'send';
update public.salary_split set checklist_from = null;
insert into public.pay_checklist (space_id, owner_user_id, cycle_start, cycle_end, label)
  select space_id, null, public.kst_today() - 1, public.kst_today() + 20, '이번 달'
  from public.app_user where id = '11111111-1111-1111-1111-111111111111';
select public.sync_checklist((select id from public.salary_split where owner_user_id is null));
create function pg_temp.send_planned() returns bigint language sql security definer as $$
  select planned from public.pay_check_line where kind = 'send' and user_id = '22222222-2222-2222-2222-222222222222';
$$;
select is(pg_temp.send_planned(), 2400000::bigint, '처음 보내기 줄(270만 − 30만)');

-- 1. 이번 달부터 → 바로(월급날 전이어도)
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.schedule_salary_change(2500000, public.kst_today());
reset role;
select is((select monthly_income from public.app_user where id = '22222222-2222-2222-2222-222222222222'), 2500000::bigint,
  '이번 달부터는 바로 적용');
select is((select applied_at is not null from public.salary_change where amount = 2500000), true, '적용 기록');
select is(pg_temp.send_amt(), 2200000::bigint, '보내기 줄 다시 계산(250만 − 30만)');
select is(pg_temp.send_planned(), 2200000::bigint, '이번 사이클 체크 안 한 보내기 줄도 맞춤');
-- 2. 체크한 줄은 그대로
update public.pay_check_line set state = 'checked', checked_at = now() where kind = 'send';
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.schedule_salary_change(2300000, public.kst_today());
reset role;
select is(pg_temp.send_amt(), 2000000::bigint, '월급 계획 보내기 줄은 다시 계산');
select is(pg_temp.send_planned(), 2200000::bigint, '체크한 확인 목록 줄은 그대로');
-- 3. 미래 달은 예약
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.schedule_salary_change(1000000, (date_trunc('month', public.kst_today()) + interval '2 months')::date);
reset role;
select is((select monthly_income from public.app_user where id = '22222222-2222-2222-2222-222222222222'), 2300000::bigint,
  '미래 달은 그대로');
select is((select applied_at from public.salary_change where amount = 1000000), null, '미래 달은 예약');

select * from finish();
rollback;
