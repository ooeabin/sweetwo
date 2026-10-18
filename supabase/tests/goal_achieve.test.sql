-- pgTAP: 목표 달성(G-05). 달성 표시와 축하 한 번, 알림, 사용 기록(낸 곳별), 남은 돈 비상금으로, 다른 목표로. 찬우, 예빈
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

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

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '찬우', side = 'groom';
update public.couple_space set account_mode = 'roles';
select set_config('test.code', (select code from public.create_invite()), true);
insert into public.goal (space_id, template, name, kind, priority, target_amount, other_held)
  select space_id, 'emergency', '비상금', 'once', 0, 9000000, 1000000 from public.app_user;
insert into public.goal (space_id, template, name, kind, priority, target_amount, other_held)
  select space_id, 'big_purchase', '가전 바꾸기', 'once', 1, 4000000, 4000000 from public.app_user;
insert into public.goal (space_id, template, name, kind, priority, target_amount, other_held)
  select space_id, 'travel', '여행', 'once', 2, 3000000, 3000000 from public.app_user;
select set_config('test.e', (select id::text from public.goal where template = 'emergency'), true);
select set_config('test.a', (select id::text from public.goal where template = 'big_purchase'), true);
select set_config('test.t', (select id::text from public.goal where template = 'travel'), true);
select public.start_first_plan(date_trunc('month', current_date - 3)::date, current_date - 3, current_date + 26, null, false, false, '{}', '[]');
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈', side = 'bride';
select public.finish_join();
reset role;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is(public.achieve_goal(current_setting('test.a')::uuid), true, '찬우가 달성을 보면 축하');
select is(public.achieve_goal(current_setting('test.a')::uuid), false, '축하는 사람마다 한 번');
select is((select status::text from public.goal where id = current_setting('test.a')::uuid), 'achieved', '상태 달성');
select is((select count(*) from public.notification where kind = 'goal_achieved'), 1::bigint, '내 알림 1건(두 사람 모두에게 감)');
select is((select months from public.goal_story(current_setting('test.a')::uuid)), 0, '모은 달 없음');
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is(public.achieve_goal(current_setting('test.a')::uuid), true, '예빈은 처음 열 때 한 번');
-- 생활비 통장·카드로 380만 → 차감 + 이번 달 나누기 줄, 남은 20만은 비상금으로
select is(
  (public.use_goal(current_setting('test.a')::uuid, 'spent', 3800000, 'living', 4000000))->>'line',
  '3800000', '생활비로 냈으면 나누기 줄');
select results_eq(
  $$ select kind::text, amount, amount_groom, amount_bride from public.plan_line where kind = 'goal_to_living' $$,
  $$ values ('goal_to_living'::text, 3800000::bigint, 0::bigint, 3800000::bigint) $$,
  '목표자금 → 공동 생활비 줄, 기록한 사람 몫');
select is((select other_held from public.goal where id = current_setting('test.e')::uuid), 1200000::bigint, '남은 20만은 비상금으로');
select is((select status::text from public.goal where id = current_setting('test.a')::uuid), 'used', '사용 완료');
select throws_ok(format($$ select public.use_goal(%L, 'spent', 1, 'goal_fund', 1) $$, current_setting('test.a')),
  '22023', 'already_used', '먼저 기록했으면 다시 못 함');
-- 남은 돈을 다른 목표로
select public.move_goal_rest((select id from public.goal_use where source = 'move' and goal_id = current_setting('test.a')::uuid),
  current_setting('test.t')::uuid);
select results_eq(
  $$ select (select other_held from public.goal where template = 'emergency'), (select other_held from public.goal where template = 'travel') $$,
  $$ values (1000000::bigint, 3200000::bigint) $$,
  '다른 목표로 옮기면 비상금에서 빼고 그 목표에');
-- 각자 돈은 기록만: 보유액 300만 전부 비상금으로
select public.achieve_goal(current_setting('test.t')::uuid);
select is(
  (public.use_goal(current_setting('test.t')::uuid, 'spent', 2500000, 'personal', 3200000))->>'rest',
  '3200000', '각자 돈이면 보유액 그대로 남은 돈');
reset role;

select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select throws_ok(format($$ select public.achieve_goal(%L) $$, current_setting('test.e')), '42501', null, '다른 부부 목표는 못 건드림');
reset role;

select * from finish();
rollback;
