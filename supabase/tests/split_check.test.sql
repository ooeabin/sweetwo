-- pgTAP: 월급 나누기 체크(W-02). 사람 몫마다 체크, 먼저 체크가 이김, 다른 금액, 취소, 안 나눈 몫만 다시 계산
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

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
select public.start_first_plan('2026-09-01', '2026-09-25', '2026-10-24', null, true, true, '{}',
  '[{"target":"account","account_role":"living","amount":870000,"amount_groom":520000,"amount_bride":350000},
    {"target":"account","account_role":"emergency","amount":220000,"amount_groom":220000,"amount_bride":0}]');
select set_config('test.l', (select id::text from public.plan_line where account_role = 'living'), true);
select set_config('test.e', (select id::text from public.plan_line where account_role = 'emergency'), true);

select is(public.check_split(current_setting('test.l')::uuid, 'groom'), 'ok', '내 몫 옮겼어요');
select is(public.check_split(current_setting('test.l')::uuid, 'groom'), 'already', '먼저 체크가 이김');
select is((select state::text from public.plan_line where id = current_setting('test.l')::uuid), 'pending', '한 사람만 끝나면 아직');
select is(public.check_split(current_setting('test.l')::uuid, 'bride', 300000), 'ok', '배우자 몫 대신 체크, 다른 금액');
select results_eq(
  $$ select state::text, done_amount, bride_done_by from public.plan_line where id = current_setting('test.l')::uuid $$,
  $$ values ('done', 820000::bigint, '11111111-1111-1111-1111-111111111111'::uuid) $$,
  '두 몫이 끝나면 done, 실제 금액 합계, 체크한 사람');
select is(public.check_split(current_setting('test.e')::uuid, 'groom'), 'ok', '몫이 한쪽뿐인 줄');
select is((select state::text from public.plan_line where id = current_setting('test.e')::uuid), 'done', '몫 없는 쪽은 끝난 것으로');
select public.uncheck_split(current_setting('test.l')::uuid, 'bride');
select public.update_pending_shares((select plan_id from public.plan_line where id = current_setting('test.l')::uuid),
  '[{"account_role":"living","amount_groom":1,"amount_bride":2}]', false);
select results_eq(
  $$ select amount_groom, amount_bride from public.plan_line where id = current_setting('test.l')::uuid $$,
  $$ values (520000::bigint, 2::bigint) $$,
  '취소하면 다시 안 나눈 몫, 다시 계산은 안 나눈 몫만');
reset role;

select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select throws_ok(format($$ select public.check_split(%L, 'groom') $$, current_setting('test.l')), '42501', null,
  '다른 부부 줄은 못 체크');
reset role;

select * from finish();
rollback;
