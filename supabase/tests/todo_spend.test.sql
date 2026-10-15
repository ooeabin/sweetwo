-- pgTAP: 할 일, 지출 항목, 월말 정리 초안, 항목별 지출 권한(H-04, W-04j)
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

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
select lives_ok(
  $$ insert into public.todo (space_id, kind, screen, open_on, sort)
     select space_id, 'assets', 'O-41', '2026-10-08', 42 from public.app_user $$,
  '할 일 추가');
select throws_ok(
  $$ insert into public.todo (space_id, kind) select space_id, 'assets' from public.app_user $$,
  '23505', null, '같은 할 일은 하나');
select lives_ok($$ update public.todo set status = 'snoozed', snoozed_until = '2026-10-09' $$, '내일 할게요');
select throws_ok($$ delete from public.todo $$, '42501', null, '할 일은 영구 삭제 못 한다');
select lives_ok(
  $$ insert into public.spend_category (space_id, default_key, name, sort)
     select space_id, 'groceries', '장보기(식재료)', 0 from public.app_user $$,
  '지출 항목 추가');
select public.start_first_plan('2026-09-01', '2026-09-25', '2026-10-24', 0, false, true, '{}', '[]');
select lives_ok(
  $$ insert into public.month_close (space_id, plan_id) select u.space_id, p.id from public.app_user u, public.monthly_plan p $$,
  '월말 정리 초안');
select lives_ok(
  $$ insert into public.month_spend (month_close_id, space_id, category_id, amount)
     select c.id, c.space_id, k.id, 410000 from public.month_close c, public.spend_category k
     on conflict (month_close_id, category_id) do update set amount = excluded.amount $$,
  '항목별 지출 저장');
select is((select amount from public.month_spend), 410000::bigint, '저장한 금액');
reset role;

select set_config('test.close', (select id::text from public.month_close), true);
select set_config('test.category', (select id::text from public.spend_category), true);
select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select public.complete_signup('google', null, false, 'v1');
select public.ensure_my_space();
select is(
  (select count(*)::int from public.todo) + (select count(*)::int from public.month_spend) + (select count(*)::int from public.spend_category),
  0, '다른 부부의 할 일과 지출은 안 보인다');
select throws_ok(
  $$ insert into public.month_spend (month_close_id, space_id, category_id, amount)
     select current_setting('test.close')::uuid, space_id, current_setting('test.category')::uuid, 1 from public.app_user $$,
  '42501', null, '다른 부부 정리에 지출을 못 넣는다');
reset role;

set local role anon;
select is((select count(*)::int from public.month_spend), 0, '익명은 지출을 못 본다');
reset role;

select * from finish();
rollback;
