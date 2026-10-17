-- pgTAP: 놓친 달 쉬어가기(rest_missed_months). 찬우, 다른 사용자 K
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'k@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('google-k', '33333333-3333-3333-3333-333333333333', '{}', 'google');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
select public.start_first_plan(date_trunc('month', current_date - 40)::date, current_date - 40, current_date - 11, null, false, false, '{}', '[]');
select public.create_cycle_plan(date_trunc('month', current_date - 10)::date, current_date - 10, current_date + 19, false, '{}', '[]');
select throws_ok(format($$ select public.rest_missed_months(array[%L]::uuid[]) $$,
  (select id from public.monthly_plan where cycle_start = current_date - 10)), '22023', 'bad_plan', '이번 플랜은 쉬어갈 수 없음');
select is(public.rest_missed_months(array[(select id from public.monthly_plan where cycle_start = current_date - 40)]), 1, '지난 플랜 쉬어감');
select is((select status::text from public.monthly_plan where cycle_start = current_date - 40), 'skipped', '상태 쉬어감');
select lives_ok($$ insert into public.month_close (space_id, plan_id, late, rested)
  select space_id, (select id from public.monthly_plan where cycle_start = current_date - 40), true, true from public.app_user $$, '늦은 정리 기록');
reset role;

select set_config('test.plan', (select id::text from public.monthly_plan where cycle_start = current_date - 10), true);
select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select public.complete_signup('google', null, false, 'v1');
select public.ensure_my_space();
select throws_ok(format($$ select public.rest_missed_months(array[%L]::uuid[]) $$, current_setting('test.plan')),
  '22023', 'bad_plan', '다른 부부 플랜은 못 바꿈');
reset role;

select * from finish();
rollback;
