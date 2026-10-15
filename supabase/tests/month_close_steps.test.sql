-- pgTAP: 월말 정리 소득, 큰 지출, 저축 납입 권한(W-04j, W-04k)
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

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
insert into public.month_close (space_id, plan_id) select u.space_id, p.id from public.app_user u, public.monthly_plan p;
select lives_ok(
  $$ update public.month_close set income = 6000000, started_by = '11111111-1111-1111-1111-111111111111', started_at = now() $$,
  '소득과 정리자 저장');
select throws_ok($$ update public.month_close set income = -1 $$, '23514', null, '소득은 0원부터');
select lives_ok(
  $$ insert into public.big_expense (month_close_id, space_id, kind, name, amount)
     select id, space_id, 'car_tax', '자동차세', 250000 from public.month_close
     on conflict (month_close_id, kind) do update set amount = excluded.amount, deleted_at = null $$,
  '큰 지출 저장');
select lives_ok(
  $$ insert into public.saving_deposit (month_close_id, space_id, name, amount)
     select id, space_id, '비상금', 390000 from public.month_close
     on conflict (month_close_id, name) do update set amount = excluded.amount $$,
  '저축 납입 저장');
select throws_ok($$ delete from public.big_expense $$, '42501', null, '큰 지출은 영구 삭제 못 한다');
reset role;

select set_config('test.close', (select id::text from public.month_close), true);
select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select public.complete_signup('google', null, false, 'v1');
select public.ensure_my_space();
select is((select count(*)::int from public.big_expense) + (select count(*)::int from public.saving_deposit), 0, '다른 부부의 큰 지출과 저축은 안 보인다');
select throws_ok(
  $$ insert into public.saving_deposit (month_close_id, space_id, name, amount)
     select current_setting('test.close')::uuid, space_id, '몰래', 1 from public.app_user $$,
  '42501', null, '다른 부부 정리에 저축을 못 넣는다');
reset role;

set local role anon;
select is((select count(*)::int from public.saving_deposit), 0, '익명은 저축을 못 본다');
reset role;

select * from finish();
rollback;
