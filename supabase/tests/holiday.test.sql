-- pgTAP: 공휴일. 누구나 읽고, 앱에서는 못 씀. 앞당겨 표시는 기본 켜짐
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
select is((select name from public.holiday where date = '2026-09-25'), '추석', '공휴일을 읽음');
select throws_ok($$ insert into public.holiday (date, name) values ('2026-11-11', '빼빼로데이') $$, '42501', null,
  '앱에서는 못 넣음');
select throws_ok($$ update public.holiday set name = 'x' $$, '42501', null, '앱에서는 못 고침');
select is((select holiday_shift from public.couple_space), true, '앞당겨 표시 기본 켜짐');
reset role;

select * from finish();
rollback;
