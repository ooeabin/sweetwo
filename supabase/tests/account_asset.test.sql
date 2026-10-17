-- pgTAP: 통장을 만들면 현금성 자산이 함께 생겨 연결됨(09 통장, 06 1장, 23 F-02 9번)
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

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
select set_config('test.code', (select code from public.create_invite()), true);
insert into public.account (space_id, role, name, is_existing, start_balance)
  select space_id, 'emergency', '비상금 통장', true, 3000000 from public.app_user;
insert into public.account (space_id, role, name)
  select space_id, 'living', '생활비 통장' from public.app_user;
select results_eq(
  $$ select c.role::text, a.grp, a.kind, a.amount, a.owner::text
     from public.account c join public.asset a on a.id = c.asset_id order by c.role $$,
  $$ values ('living', 'cash', 'bank', 0::bigint, 'joint'),
            ('emergency', 'cash', 'role_account', 3000000::bigint, 'joint') $$,
  '통장마다 현금성 자산(시작 잔액, 공동)');
select is((select count(*)::int from public.asset_history), 2, '금액 이력도 남음');
select is((select n.net from public.net_worth_history(1) n), 3000000::bigint, '순자산에 들어감');
update public.account set name = '우리 비상금', start_balance = 3500000 where role = 'emergency';
select is((select a.name || ' ' || a.amount from public.account c join public.asset a on a.id = c.asset_id
  where c.role = 'emergency'), '우리 비상금 3500000', '만든 그대로인 자산은 통장 수정을 따라감');
update public.asset set amount = 3700000 where name = '우리 비상금';
update public.account set start_balance = 4000000 where role = 'emergency';
select is((select a.amount from public.account c join public.asset a on a.id = c.asset_id
  where c.role = 'emergency'), 3700000::bigint, '사람이 고친 자산은 그대로');
update public.account set deleted_at = now() where role = 'living';
select is((select count(*)::int from public.asset where deleted_at is null), 1, '만든 그대로인 통장 자산은 통장과 함께 휴지통');
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
select public.finish_join();
select is((select count(*)::int from public.account c join public.asset a on a.id = c.asset_id
  where c.deleted_at is null and a.deleted_at is null), 1,
  '배우자도 통장 자산을 봄');
select throws_ok(
  $$ update public.account set asset_id = gen_random_uuid() where role = 'emergency' $$,
  '23503', null, '없는 자산에는 연결 못 함');
reset role;

select * from finish();
rollback;
