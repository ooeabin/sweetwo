-- pgTAP: 변동 수입 실제(W-04a2)와 다음 사이클 보충 줄. 찬우(변동 수입), 예빈
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

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
update public.app_user set nickname = '찬우', side = 'groom', monthly_income = 3000000;
select set_config('test.code', (select code from public.create_invite()), true);
select public.start_first_plan(date_trunc('month', current_date - 27)::date, current_date - 27, current_date + 2, null, false, false, '{}', '[]');
insert into public.month_close (space_id, plan_id) select u.space_id, p.id from public.app_user u, public.monthly_plan p;
select set_config('test.close', (select id::text from public.month_close), true);
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈';
select public.finish_join();
select throws_ok(format($$ select public.answer_actual_income(%L, 1) $$, current_setting('test.close')),
  '22023', 'not_variable', '변동 수입 당사자만');
reset role;

update public.app_user set income_variable = true where id = '11111111-1111-1111-1111-111111111111';
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is(public.answer_actual_income(current_setting('test.close')::uuid, 2600000), -400000::bigint, '기준보다 40만 적음');
select results_eq($$ select income_actual_groom, income_short, income_short_side::text, supplement_line_id is null from public.month_close $$,
  $$ values (2600000::bigint, 400000::bigint, 'groom', true) $$, '다음 플랜 전이라 남겨 둠');
reset role;
select is((select title from public.notification where kind = 'income_short'),
  '찬우님 이번 달 수입이 기준보다 40만 원 적어요', '예빈에게 알림');

-- 다음 플랜이 생기면 보충 줄
-- create_cycle_plan은 미래 사이클을 거절하므로 기준일이 온 것처럼 직접 넣음
insert into public.monthly_plan (space_id, label_month, cycle_start, cycle_end)
  select space_id, date_trunc('month', current_date + 3)::date, current_date + 3, current_date + 32 from public.app_user
  where id = '11111111-1111-1111-1111-111111111111';
select results_eq($$ select kind::text, amount, amount_groom, amount_bride from public.plan_line where kind = 'emergency_to_living' $$,
  $$ values ('emergency_to_living', 400000::bigint, 400000::bigint, 0::bigint) $$, '다음 플랜에 비상금 → 공동 생활비 줄');
select isnt((select supplement_line_id from public.month_close), null, '보충 줄 기록');

-- 다시 답하면(아직 안 옮긴 줄) 다시 계산
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.answer_actual_income(current_setting('test.close')::uuid, 3100000);
reset role;
select is((select count(*)::int from public.plan_line where kind = 'emergency_to_living'), 0, '기준 이상이면 보충 줄 없음');

select * from finish();
rollback;
