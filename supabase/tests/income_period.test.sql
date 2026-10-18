-- pgTAP: 기간 수입 변경(F-05f·F-07c). 저장, 기간 플랜 보충 줄(지금 있는 것 + 새로 생기는 것), 알림, 분담 제안, 기간 끝나면 되돌림. 찬우, 예빈
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
update public.app_user set nickname = '찬우', side = 'groom', monthly_income = 3500000;
update public.couple_space set account_mode = 'roles', split_mode = 'custom', split_ratio = 60;
select set_config('test.code', (select code from public.create_invite()), true);
select public.start_first_plan(date_trunc('month', current_date)::date, current_date - 3, current_date + 26, null, false, false, '{}', '[]');
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈', side = 'bride', monthly_income = 2700000;
select public.finish_join();
-- 예빈 이번 달부터 3달 육아휴직: 월 120만, 보충 150만, 분담 제안
select set_config('test.p', public.set_income_period(date_trunc('month', current_date)::date,
  (date_trunc('month', current_date) + interval '2 months')::date, 1200000, 1500000, current_date + 10)::text, true);
select results_eq(
  $$ select amount, base_income, supplement from public.income_period $$,
  $$ values (1200000::bigint, 2700000::bigint, 1500000::bigint) $$,
  '기간, 바꾸기 전 수입, 보충');
select results_eq(
  $$ select kind::text, amount, amount_groom, amount_bride from public.plan_line where income_period_id is not null $$,
  $$ values ('emergency_to_living'::text, 1500000::bigint, 0::bigint, 1500000::bigint) $$,
  '이번 달 플랜에 비상금 → 공동 생활비 보충 줄(내 몫)');
select is((select item from public.proposal where id = (select split_proposal_id from public.income_period)), 'split', '분담 버는 만큼 제안');
select throws_ok($$ select public.set_income_period(date_trunc('month', current_date)::date, date_trunc('month', current_date)::date, 0, 0) $$,
  '22023', 'overlap', '겹치는 기간은 안 됨');
select throws_ok($$ select public.set_income_period((date_trunc('month', current_date) - interval '1 month')::date, date_trunc('month', current_date)::date, 0, 0) $$,
  '22023', 'bad_value', '지난 달부터는 안 됨');
reset role;

select is((select count(*) from public.notification where kind = 'income_period'), 1::bigint, '찬우에게 바로 알림');

-- 다음 달 플랜이 생기면 보충 줄
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.respond_proposal((select split_proposal_id from public.income_period), 'like');
select is((select split_mode::text from public.couple_space), 'income', '좋아요면 기간 분담 적용');
reset role;
insert into public.monthly_plan (space_id, label_month, cycle_start, cycle_end, is_temp, snapshot)
  select space_id, (date_trunc('month', current_date) + interval '1 month')::date, current_date + 27, current_date + 56, false, '{}'
  from public.income_period;
select is((select count(*) from public.plan_line where income_period_id is not null), 2::bigint, '새 플랜에도 보충 줄');
insert into public.monthly_plan (space_id, label_month, cycle_start, cycle_end, is_temp, snapshot)
  select space_id, (date_trunc('month', current_date) + interval '3 months')::date, current_date + 90, current_date + 119, false, '{}'
  from public.income_period;
select is((select count(*) from public.plan_line where income_period_id is not null), 2::bigint, '기간 밖 플랜에는 없음');

-- 기간이 끝나면 원래 분담
update public.income_period set end_month = (date_trunc('month', current_date) - interval '1 month')::date,
  start_month = (date_trunc('month', current_date) - interval '2 months')::date;
select is(public.end_income_periods(), 1, '끝난 기간 하나');
select results_eq(
  $$ select split_mode::text, split_ratio::int from public.couple_space $$,
  $$ values ('custom'::text, 60) $$,
  '원래 분담으로 되돌림');

select * from finish();
rollback;
