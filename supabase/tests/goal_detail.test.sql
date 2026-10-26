-- pgTAP: 우리 ↔ 내 목표 바꾸기는 상대에게 알림(22 G-02 ⋯ 종류 바꾸기)
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
update public.app_user set nickname = '찬우' where id = auth.uid();
select set_config('test.code', (select code from public.create_invite()), true);
insert into public.goal (space_id, template, name, kind, priority)
  select space_id, 'travel', '여행', 'once', 1 from public.app_user where id = auth.uid();
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
select public.finish_join();
reset role;
delete from public.partner_change;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
update public.goal set owner_user_id = auth.uid() where name = '여행';
reset role;
select results_eq(
  $$ select receiver_id, field, before_v, after_v from public.partner_change $$,
  $$ values ('22222222-2222-2222-2222-222222222222'::uuid, 'owner', '우리 목표', '내 목표') $$,
  '우리 → 내: 예빈에게 알림');
select is(public.partner_change_line('goal', 'owner', '여행', '우리 목표', '내 목표'), '종류 우리 목표 → 내 목표',
  '알림 줄 이름');

select * from finish();
rollback;
