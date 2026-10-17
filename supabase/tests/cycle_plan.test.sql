-- pgTAP: 다음 사이클 플랜(create_cycle_plan), 통장 방식 다음 사이클 적용, 해제 대기 중 연장
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao');
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
select throws_ok($$ select public.create_cycle_plan('2026-09-01', current_date - 10, current_date + 20, false, '{}', '[]') $$,
  'P0001', 'no_first_plan', '첫 플랜 전에는 없음');
select public.start_first_plan(date_trunc('month', current_date - 40)::date, current_date - 40, current_date - 11, null, false, false, '{}', '[]');
update public.couple_space set account_mode = 'single', account_mode_next = 'roles';
select throws_ok($$ select public.create_cycle_plan(date_trunc('month', current_date + 5)::date, current_date + 5, current_date + 30, false, '{}', '[]') $$,
  '22023', 'bad_cycle', '미래 사이클은 거절');
select isnt(
  public.create_cycle_plan(date_trunc('month', current_date - 10)::date, current_date - 10, current_date + 19, true, '{"basis":"couple"}',
    '[{"target":"account","account_role":"living","amount":900000,"amount_groom":500000,"amount_bride":400000}]'),
  null, '다음 사이클 플랜');
select results_eq($$ select count(*)::int, max(is_temp::int) from public.monthly_plan where cycle_start = current_date - 10 $$,
  $$ values (1, 1) $$, '하나만');
select is(public.create_cycle_plan(date_trunc('month', current_date - 10)::date, current_date - 10, current_date + 19, false, '{}', '[]'),
  (select id from public.monthly_plan where cycle_start = current_date - 10), '같은 사이클은 먼저 만든 것');
select is((select count(*)::int from public.plan_line), 1, '줄은 한 번만');
select results_eq($$ select account_mode::text, account_mode_next from public.couple_space $$,
  $$ values ('roles', null::public.account_mode) $$, '통장 방식은 다음 플랜부터');
reset role;

-- 해제 대기 중이면 지난 플랜 연장
update public.couple_space set couple_state = 'unlink_pending';
update public.monthly_plan set cycle_end = current_date - 1 where cycle_start = current_date - 10;
set local role authenticated;
select is(
  public.create_cycle_plan(date_trunc('month', current_date)::date, current_date, current_date + 29, false, '{}', '[]'),
  (select id from public.monthly_plan where cycle_start = current_date - 10), '해제 대기면 지난 플랜 연장');
select is((select cycle_end from public.monthly_plan where cycle_start = current_date - 10), current_date + 29, '끝이 늘어남');
reset role;

select * from finish();
rollback;
