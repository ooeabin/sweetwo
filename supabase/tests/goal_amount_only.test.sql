-- pgTAP: 내 목표 ‘금액만 보여 주기’는 배우자에게 이름 대신 “개인 목표”(22 공개, 25 S-13)
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

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
insert into public.goal (space_id, template, name, kind, priority, target_amount, owner_user_id, visibility)
  select space_id, 'hobby', '카메라', 'once', 1, 2000000, id, 'amount' from public.app_user;
insert into public.goal (space_id, template, name, kind, priority, target_amount, owner_user_id)
  select space_id, 'travel', '혼자 여행', 'once', 2, 1000000, id from public.app_user;
select results_eq($$ select name from public.space_goals() where owner_user_id is not null order by priority $$,
  $$ values ('카메라'), ('혼자 여행') $$, '주인은 이름 그대로');
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
select public.finish_join();
select results_eq(
  $$ select name, template, target_amount from public.space_goals() where owner_user_id is not null order by priority $$,
  $$ values ('개인 목표', 'custom', 2000000::bigint), ('혼자 여행', 'travel', 1000000::bigint) $$,
  '배우자: 금액만 보여 주기는 “개인 목표” + 금액, 모두 보여 주기는 그대로');
select is((select details from public.space_goals() where target_amount = 2000000), '{}'::jsonb, '답도 가림');
reset role;

select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select is((select count(*)::int from public.space_goals()), 0, '다른 부부는 못 봄');
reset role;

select * from finish();
rollback;
