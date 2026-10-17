-- pgTAP: 꼼꼼 모드 잔액(W-04b), 비상금 답(W-04d), 목표에서 쓴 돈 차액(W-04c). 찬우, 다른 사용자 K
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

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
select public.start_first_plan('2026-09-01', '2026-09-25', '2026-10-24', 0, false, true, '{}', '[]');
insert into public.account (space_id, role, name, start_balance) select space_id, 'goal_fund', '목표자금', 3000000 from public.app_user;
insert into public.goal (space_id, template, name, kind, priority, target_amount) select space_id, 'trip', '여행', 'once', 1, 2000000 from public.app_user;
insert into public.month_close (space_id, plan_id) select u.space_id, p.id from public.app_user u, public.monthly_plan p;
select lives_ok(
  $$ insert into public.close_balance (month_close_id, space_id, account_id, amount, expected)
     select c.id, c.space_id, a.id, 2850000, 3000000 from public.month_close c, public.account a $$,
  '잔액 저장');
select lives_ok($$ update public.month_close set detailed_at = now(), emergency_used = true, emergency_reason = 'hospital' $$, '비상금 사유');
select throws_ok($$ update public.month_close set emergency_used = false $$, '23514', null, '안 썼으면 사유 없음');
select lives_ok(
  $$ select public.answer_goal_gap((select id from public.month_close), 150000, (select id from public.goal)) $$,
  '차액은 고른 목표에서');
select results_eq($$ select amount, source::text from public.goal_use $$, $$ values (150000::bigint, 'close') $$, '목표 사용 기록 하나');
select public.answer_goal_gap((select id from public.month_close), 150000, null);
select results_eq($$ select (select count(*)::int from public.goal_use), (select goal_gap_not_goal from public.month_close) $$,
  $$ values (0, true) $$, '목표에서 쓴 돈이 아니에요면 기록 지움');
select throws_ok($$ delete from public.close_balance $$, '42501', null, '잔액은 영구 삭제 못 함');
reset role;

select set_config('test.close', (select id::text from public.month_close), true);
select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select public.complete_signup('google', null, false, 'v1');
select is((select count(*)::int from public.close_balance), 0, '다른 부부 잔액은 안 보임');
select throws_ok(format($$ select public.answer_goal_gap(%L, 1000, null) $$, current_setting('test.close')),
  '42501', 'not_member', '다른 부부 정리에 답 못 함');
reset role;

select * from finish();
rollback;
