-- pgTAP: 이번 달만 바꾸기(W-01a). 차이는 빠지는 곳 줄이 받고 몫은 비율대로, 되돌리기, 옮긴 줄·다른 부부 막기
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

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
select set_config('test.p', public.start_first_plan('2026-09-01', '2026-09-25', '2026-10-24', null, true, true,
  '{"parts":{"living":1850000,"goalFund":3000000,"emergency":220000}}',
  '[{"target":"account","account_role":"living","amount":1850000,"amount_groom":1110000,"amount_bride":740000},
    {"target":"account","account_role":"goal_fund","amount":3000000,"amount_groom":1800000,"amount_bride":1200000}]')::text, true);

select public.adjust_plan(current_setting('test.p')::uuid, 'living', 2050000, 'goal_fund');
select results_eq(
  $$ select account_role::text, amount, amount_groom, amount_bride from public.plan_line order by sort $$,
  $$ values ('living', 2050000::bigint, 1230000::bigint, 820000::bigint),
            ('goal_fund', 2800000::bigint, 1680000::bigint, 1120000::bigint) $$,
  '차이는 목표자금이 받고 몫은 비율대로');
select is((select (snapshot->'parts'->>'goalFund')::bigint from public.monthly_plan), 2800000::bigint, '기준값도 맞춤');
select throws_ok(format($$ select public.adjust_plan(%L, 'living', 9000000, 'goal_fund') $$, current_setting('test.p')),
  '22023', 'not_enough', '빠지는 곳보다 많이는 못 바꿈');
select public.adjust_plan(current_setting('test.p')::uuid, 'living', 1850000, 'goal_fund');
select is((select amount from public.plan_line where account_role = 'goal_fund'), 3000000::bigint, '되돌리기');
select public.check_split((select id from public.plan_line where account_role = 'living'), 'groom');
select throws_ok(format($$ select public.adjust_plan(%L, 'living', 1, 'goal_fund') $$, current_setting('test.p')),
  '22023', 'already_split', '옮긴 줄은 못 바꿈');
reset role;

select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select throws_ok(format($$ select public.adjust_plan(%L, 'living', 1, 'goal_fund') $$, current_setting('test.p')),
  '42501', null, '다른 부부 플랜은 못 바꿈');
reset role;

select * from finish();
rollback;
