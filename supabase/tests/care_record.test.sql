-- pgTAP: 다녀온 뒤 기록(Y-08). 다녀왔어요, 낸 곳별 목표 사용과 ‘목표자금 → 공동 생활비’ 줄, 직접 쓰기 막힘, 다른 부부 막힘
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'other@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-o', '33333333-3333-3333-3333-333333333333', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.couple_space set account_mode = 'roles';
insert into public.goal (space_id, template, name, kind, owner, target_amount, priority)
  select space_id, 'family_cost', '양가 비용', 'yearly', 'together', 1900000, 1 from public.app_user;
select public.start_first_plan(
  date_trunc('month', current_date)::date, current_date - 5, current_date + 25, null, false, false, '{}',
  '[{"target":"account","account_role":"living","amount":870000,"amount_groom":520000,"amount_bride":350000},
    {"target":"account","account_role":"goal_fund","amount":300000,"amount_groom":150000,"amount_bride":150000}]');
insert into public.care_day (space_id, category, kind, name, side, date_rule, month, day, budget, carer)
  select space_id, 'family', 'birthday', '어머니 생신', 'groom', 'solar_yearly', 10, 14, 300000, 'groom' from public.app_user;
insert into public.care_day (space_id, category, kind, name, side, date_rule, month, day, budget, carer)
  select space_id, 'family', 'seollal', '설날', null, 'lunar_yearly', 1, 1, 500000, 'together' from public.app_user;
select set_config('test.c', (select id::text from public.care_day where kind = 'birthday'), true);
select set_config('test.s', (select id::text from public.care_day where kind = 'seollal'), true);

select is(
  (public.record_care(current_setting('test.c')::uuid, '2026-10-14', 300000, 'living', '{gift}', '안마기', null, 200000))->>'line',
  '200000', '생활비로 냄: 보유액만큼 줄');
select results_eq(
  $$ select status::text, status_on from public.care_day where id = current_setting('test.c')::uuid $$,
  $$ values ('done', '2026-10-14'::date) $$, '다녀왔어요');
select results_eq(
  $$ select kind::text, account_role::text, amount, amount_groom, amount_bride from public.plan_line where kind = 'goal_to_living' $$,
  $$ values ('goal_to_living', 'living', 200000::bigint, 200000::bigint, 0::bigint) $$,
  '목표자금 → 공동 생활비 줄, 담당 = 기록한 사람');
select results_eq(
  $$ select amount, paid_from::text, plan_line_id is not null from public.goal_use $$,
  $$ values (300000::bigint, 'living', true) $$, '쓴 돈 전체가 목표 사용');
select is(
  (public.record_care(current_setting('test.s')::uuid, '2027-02-06', 400000, 'personal', '{cash}', null, '세뱃돈', 0))->>'line',
  '0', '각자 돈: 기록만');
select is((select count(*)::int from public.goal_use), 1, '각자 돈은 목표 사용 없음');
select public.update_pending_shares((select plan_id from public.plan_line limit 1),
  '[{"account_role":"living","amount_groom":1,"amount_bride":2}]', false);
select is((select amount_groom from public.plan_line where kind = 'goal_to_living'), 200000::bigint,
  '몫 다시 계산은 월급 나누기 줄만');
reset role;

select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select throws_ok(format($$ select public.record_care(%L, '2026-10-14', 1, 'personal', '{}', null, null, 0) $$,
  current_setting('test.c')), '42501', null, '다른 부부 챙길 날은 기록 못 함');
reset role;

select * from finish();
rollback;
