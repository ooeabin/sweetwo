-- pgTAP: 달성 되돌리기(2026-11-09, 20 ‘달성과 그만 모음’, 06 5-4). 찬우
-- 체크로 달성한 뒤 고르기 전에 체크를 풀거나 못 함으로 바꿔 목표 금액 아래로 내려가면 모으는 중으로 + 달성 알림 지움.
-- 다시 닿으면 축하·알림 한 번 더. 고른 뒤(계속 모을게요 = 목표 금액 없음, 그만할게요)에는 그대로
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
-- v2.2 D1 첫 사이클 소급 없음(20261201090000): 이 테스트는 이번 사이클 목록이 필요해 월급 계획 시작일 제한을 풂
create function pg_temp.no_backdate() returns void language sql security definer as $$
  update public.salary_split set checklist_from = null;
$$;
create function pg_temp.item(n text) returns uuid language sql as $$
  select id from public.goal where name = n and deleted_at is null order by created_at desc limit 1;
$$;
create function pg_temp.line(n text) returns uuid language sql as $$
  select id from public.pay_check_line where goal_id = pg_temp.item(n) limit 1;
$$;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '찬우', monthly_income = 3500000, payday = 25 where id = auth.uid();
select public.save_split(jsonb_build_array(
  jsonb_build_object('kind', 'fixed', 'amount', 880000),
  jsonb_build_object('kind', 'living', 'amount', 880000),
  jsonb_build_object('kind', 'allowance', 'amount', 350000)
), auth.uid());
select pg_temp.no_backdate();
select public.start_checklist(auth.uid());
select public.add_saving_item('가전 바꾸기', 300000, 300000);
select public.add_saving_item('여행', 500000, 500000);

-- 체크 → 달성 → 체크 풀기(되돌리기 Toast와 같음)
select public.check_pay_line(pg_temp.line('가전 바꾸기'), 'checked');
select is(public.achieve_goal(pg_temp.item('가전 바꾸기')), true, '체크로 목표 금액에 닿아 달성');
select public.check_pay_line(pg_temp.line('가전 바꾸기'), 'wait');
select results_eq(
  $$ select status::text, achieved_at is null, cardinality(achieved_seen) from public.goal where id = pg_temp.item('가전 바꾸기') $$,
  $$ values ('active', true, 0) $$, '체크를 풀어 목표 금액 아래면 모으는 중으로');
reset role;
select is((select count(*)::int from public.notification where kind = 'goal_achieved'), 0, '달성 알림도 지움');
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is((select count(*)::int from public.split_line where goal_id = pg_temp.item('가전 바꾸기')), 1, '줄은 그대로');

-- 다시 체크하면 다시 달성, 축하와 알림 한 번 더
select public.check_pay_line(pg_temp.line('가전 바꾸기'), 'checked');
select is(public.achieve_goal(pg_temp.item('가전 바꾸기')), true, '다시 닿으면 다시 축하');
reset role;
select is((select count(*)::int from public.notification where kind = 'goal_achieved'), 1, '달성 알림 한 번 더');
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;

-- 다른 금액으로 더 많이 보낸 줄을 ‘못 함’으로(W-05)도 같음
select public.check_pay_line(pg_temp.line('여행'), 'checked', 700000);
select is(public.achieve_goal(pg_temp.item('여행')), true, '여행 달성');
select public.check_pay_line(pg_temp.line('여행'), 'skipped');
select is((select status::text from public.goal where id = pg_temp.item('여행')), 'active', '못 함으로 바꿔도 되돌림');

-- 목표 금액 아래로 안 내려가면 그대로: 다른 금액 70만 → 60만(목표 50만)
select public.check_pay_line(pg_temp.line('여행'), 'checked', 700000);
select public.achieve_goal(pg_temp.item('여행'));
select public.check_pay_line(pg_temp.line('여행'), 'checked', 600000);
select is((select status::text from public.goal where id = pg_temp.item('여행')), 'achieved', '아직 목표 금액 이상이면 달성 그대로');

-- 고른 뒤에는 그대로: 그만할게요 → 체크 풀기
select public.saving_item_stop(pg_temp.item('여행'));
select public.check_pay_line(pg_temp.line('여행'), 'wait');
select results_eq(
  $$ select status::text, closed_at is not null from public.goal where id = pg_temp.item('여행') $$,
  $$ values ('achieved', true) $$, '그만 모은 항목은 그대로');

-- 계속 모을게요(목표 금액 지움) → 체크 풀기
select public.saving_item_keep(pg_temp.item('가전 바꾸기'));
select public.check_pay_line(pg_temp.line('가전 바꾸기'), 'wait');
select results_eq(
  $$ select status::text, target_amount from public.goal where id = pg_temp.item('가전 바꾸기') $$,
  $$ values ('active', null::bigint) $$, '계속 모을게요 뒤에는 목표 금액이 없어 그대로');
select lives_ok($$ select public.check_pay_line(pg_temp.line('가전 바꾸기'), 'checked') $$, '지출·목표 금액 없는 줄도 그대로 체크');

select * from finish();
rollback;
