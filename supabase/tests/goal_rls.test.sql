-- pgTAP: 목표 행 권한(우리 목표 둘 다, 내 목표 주인만, ‘금액만 보여 주기’는 표에서 못 읽음, 상태·템플릿은 함수로만)
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

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
insert into public.goal (space_id, template, name, kind, priority, target_amount, owner_user_id, visibility)
  select space_id, 'custom', '비밀 취미', 'once', 1, 3000000, id, 'amount' from public.app_user;
insert into public.goal (space_id, template, name, kind, priority, target_amount, owner_user_id, visibility)
  select space_id, 'custom', '자기계발', 'once', 2, 2000000, id, 'all' from public.app_user;
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
select public.finish_join();
select results_eq($$ select name from public.goal order by name $$, $$ values ('자기계발'), ('집') $$,
  '‘금액만 보여 주기’ 배우자 목표는 표에서 안 보임');
select results_eq($$ select name from public.space_goals() where owner_user_id is not null order by name $$,
  $$ values ('개인 목표'), ('자기계발') $$, 'space_goals로는 이름 가려서 보임');
update public.goal set target_amount = 1 where name = '자기계발';
select is((select target_amount from public.goal where name = '자기계발'), 2000000::bigint, '배우자 내 목표는 못 고침');
update public.goal set name = '우리 집' where name = '집';
select is((select count(*)::int from public.goal where name = '우리 집'), 1, '우리 목표는 고침');
select throws_ok($$ update public.goal set owner_user_id = '11111111-1111-1111-1111-111111111111' where name = '우리 집' $$,
  '42501', null, '주인을 배우자로 바꿀 수 없음');
select throws_ok($$ update public.goal set template = 'custom' where name = '우리 집' $$,
  '42501', null, '템플릿은 못 바꿈');
select throws_ok($$ update public.goal set status = 'achieved' where name = '우리 집' $$,
  '42501', null, '달성은 함수로만');
update public.goal set status = 'paused' where name = '우리 집';
select is((select status::text from public.goal where name = '우리 집'), 'paused', '보류는 바로');
select throws_ok($$ insert into public.goal (space_id, template, name, kind, priority, owner_user_id)
  select space_id, 'custom', '남의 것', 'once', 9, '11111111-1111-1111-1111-111111111111' from public.app_user
  where id = auth.uid() $$, '42501', null, '배우자 주인으로 추가할 수 없음');
reset role;

select * from finish();
rollback;
