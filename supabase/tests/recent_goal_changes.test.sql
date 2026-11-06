-- pgTAP: 배우자가 고친 목표(22 G-01 예외) — 나에게 온 것만, 목표마다 마지막 하나
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

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
  select space_id, 'travel', '여행', 'once', 1, 3000000 from public.app_user where id = auth.uid();
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
select public.finish_join();
reset role;
delete from public.partner_change;

-- 찬우가 금액 → 기한 순서로 고침
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
update public.goal set target_amount = 4000000 where name = '여행';
reset role;
update public.partner_change set created_at = now() - interval '1 hour';
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
update public.goal set deadline = '2027-12-01' where name = '여행';
select is((select count(*)::int from public.recent_goal_changes()), 0, '고친 사람에게는 없음');
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select results_eq(
  $$ select field, actor_id from public.recent_goal_changes() $$,
  $$ values ('deadline', '11111111-1111-1111-1111-111111111111'::uuid) $$,
  '예빈: 목표마다 마지막 변경 하나');
select throws_ok($$ select * from public.partner_change $$, '42501', null, 'partner_change는 직접 못 읽음');
reset role;

select * from finish();
rollback;
