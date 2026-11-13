-- pgTAP: W-12a ‘목표 금액을 새로 정할게요’(2026-11-09 round 3, 20 W-12a·‘달성과 그만 모음’). 찬우(시작), 예빈(합류), 각자
-- 달성하고 고르기 전에만, 모은 금액보다 큰 새 목표 금액 → 모으는 중 + 기한 지움, 지난 달성 알림은 남기고 새로 닿으면 한 번 더.
-- 되돌리기(saving_item_unkeep) = 예전 목표 금액·기한, 달성. 파트너 저금(각자)은 못 바꿈
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao');
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
select set_config('test.code', (select code from public.create_invite()), true);
select public.add_saving_item('가전 바꾸기', 300000, 300000, '2027-06-01');
select public.add_saving_item('여행', 500000, 2000000);

-- 아직 달성 전이면 못 바꿈
select throws_ok($$ select public.saving_item_retarget(pg_temp.item('여행'), 3000000) $$, '22023', 'not_achieved',
  '달성 전에는 W-10a 목표 금액으로');

select public.check_pay_line(pg_temp.line('가전 바꾸기'), 'checked');
select is(public.achieve_goal(pg_temp.item('가전 바꾸기')), true, '체크로 달성');
select throws_ok($$ select public.saving_item_retarget(pg_temp.item('가전 바꾸기'), 300000) $$, '22023', 'not_above',
  '새 목표 금액은 모은 금액보다 커야 함');
select throws_ok($$ select public.saving_item_retarget(pg_temp.item('가전 바꾸기'), 0) $$, '22023', 'bad_amount',
  '0원은 안 됨');
select lives_ok($$ select public.saving_item_retarget(pg_temp.item('가전 바꾸기'), 600000) $$, '새 목표 60만 원');
select results_eq(
  $$ select status::text, target_amount, deadline, achieved_at is null, cardinality(achieved_seen), closed_at is null
     from public.goal where id = pg_temp.item('가전 바꾸기') $$,
  $$ values ('active', 600000::bigint, null::date, true, 0, true) $$, '모으는 중 + 새 목표 금액, 기한은 지움');
select is((select count(*)::int from public.split_line where goal_id = pg_temp.item('가전 바꾸기')), 1, '줄은 그대로');
select is((select saved from public.goal_saved_sums() where goal_id = pg_temp.item('가전 바꾸기')), 300000::bigint,
  '모은 금액 그대로');
reset role;
select is((select count(*)::int from public.notification where kind = 'goal_achieved'), 1, '지난 달성 알림은 남김');
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;

-- 새 목표 금액에 닿으면 다시 달성 + 알림 한 번 더(다른 금액 60만으로 고침)
select public.check_pay_line(pg_temp.line('가전 바꾸기'), 'checked', 600000);
select is(public.achieve_goal(pg_temp.item('가전 바꾸기')), true, '새 목표 금액에 닿으면 다시 축하');
reset role;
select is((select count(*)::int from public.notification where kind = 'goal_achieved'), 2, '달성 알림 한 번 더');
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;

-- 되돌리기(Toast) = 예전 목표 금액·기한, 달성
select public.saving_item_retarget(pg_temp.item('가전 바꾸기'), 900000);
select public.saving_item_unkeep(pg_temp.item('가전 바꾸기'), 600000, null);
select results_eq(
  $$ select status::text, target_amount from public.goal where id = pg_temp.item('가전 바꾸기') $$,
  $$ values ('achieved', 600000::bigint) $$, '되돌리면 예전 목표 금액으로 달성');
reset role;

-- 예빈 합류(각자): 찬우 저금은 보기만
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
select public.finish_join();
select throws_ok($$ select public.saving_item_retarget(pg_temp.item('가전 바꾸기'), 2000000) $$, '42501', 'not_owner',
  '파트너 저금(각자)은 못 바꿈');

select * from finish();
rollback;
