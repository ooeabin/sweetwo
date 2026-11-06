-- pgTAP: 목표 연결 자산 합계(비공개 제외, 합계만 포함)(23 F-03i)
begin;
create extension if not exists pgtap with schema extensions;
select plan(2);

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
insert into public.goal (space_id, template, name, kind, priority, target_amount)
  select space_id, 'home', '집', 'once', 1, 100000000 from public.app_user;
select set_config('test.goal', (select id::text from public.goal), true);
insert into public.asset (space_id, side, grp, kind, name, amount, owner, owner_user_id, visibility, goal_id)
  select space_id, 'asset', 'subscription', 'housing_subscription', '청약', 5000000, 'person',
    '11111111-1111-1111-1111-111111111111', 'sum', current_setting('test.goal')::uuid from public.app_user;
insert into public.asset (space_id, side, grp, kind, name, amount, owner)
  select space_id, 'asset', 'cash', 'bank', '공동 통장', 1000000, 'joint' from public.app_user;
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
select public.finish_join();
insert into public.asset (space_id, side, grp, kind, name, amount, owner, owner_user_id, visibility, goal_id)
  select space_id, 'asset', 'deposit', 'saving', '비밀 적금', 3000000, 'person',
    '22222222-2222-2222-2222-222222222222', 'private', current_setting('test.goal')::uuid from public.app_user;
select results_eq($$ select n, total from public.goal_asset_sums() $$, $$ values (1, 5000000::bigint) $$,
  '배우자 합계만 포함, 비공개 제외');
reset role;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select results_eq($$ select n, total from public.goal_asset_sums() $$, $$ values (1, 5000000::bigint) $$,
  '찬우에게도 같은 값');
reset role;

select * from finish();
rollback;
