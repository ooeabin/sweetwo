-- pgTAP: 다른 수입(O-35b)과 상여금(O-35). 내 것만 넣고 고침, 배우자도 봄, 다른 수입 합계가 월 수입에 더해짐
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'other@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao'),
  ('kakao-o', '33333333-3333-3333-3333-333333333333', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
select set_config('test.code', (select code from public.create_invite()), true);
insert into public.income_item (space_id, owner_user_id, kind, monthly_amount)
  select space_id, id, 'side_job', 300000 from public.app_user;
insert into public.income_item (space_id, owner_user_id, kind, monthly_amount)
  select space_id, id, 'rent', 500000 from public.app_user;
select is((select other_income from public.app_user), 800000::bigint, '다른 수입 합계가 모임');
update public.income_item set deleted_at = now() where kind = 'rent';
select is((select other_income from public.app_user), 300000::bigint, '지운 건 빠짐');
insert into public.income_event (space_id, owner_user_id, name, amount, month)
  select space_id, id, '상여금', 2000000, 12 from public.app_user;
select throws_ok(
  $$ insert into public.income_item (space_id, owner_user_id, kind, monthly_amount)
     select space_id, '22222222-2222-2222-2222-222222222222', 'support', 1 from public.app_user $$,
  '42501', null, '남의 이름으로 못 넣음');
select throws_ok($$ update public.app_user set other_income = 1 $$, '42501', null, '합계는 직접 못 고침');
select throws_ok($$ delete from public.income_event $$, '42501', null, '영구 삭제 없음');
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
select public.finish_join();
select is((select count(*)::int from public.income_item where deleted_at is null) + (select count(*)::int from public.income_event), 2,
  '배우자도 봄');
select is((select other_income from public.partner_profile()), 300000::bigint, '배우자 프로필에 다른 수입');
update public.income_item set monthly_amount = 1;
select is((select monthly_amount from public.income_item where deleted_at is null), 300000::bigint, '배우자 것은 못 고침');
reset role;

select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select is((select count(*)::int from public.income_item) + (select count(*)::int from public.income_event), 0,
  '다른 부부는 못 봄');
reset role;

select * from finish();
rollback;
