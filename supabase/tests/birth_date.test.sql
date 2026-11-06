-- pgTAP: 생년월일(O-13, P-04). 월, 일 저장, 만 나이로 미성년 삭제, 배우자 생일은 월, 일만
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'minor@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao'),
  ('kakao-m', '33333333-3333-3333-3333-333333333333', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
select lives_ok($$ update public.app_user set nickname = '찬우', birth_year = 1994, birth_month = 2, birth_day = 18 $$,
  '생년월일 저장');
select throws_ok($$ update public.app_user set birth_month = 13 $$, '23514', null, '월은 1~12');
select is((select count(*)::int from public.partner_birthday()), 0, '배우자 없으면 생일 없음');
select set_config('test.code', (select code from public.create_invite()), true);
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈', birth_year = 1996, birth_month = 10, birth_day = 3;
select results_eq($$ select month::int, day::int from public.partner_birthday() $$,
  $$ values (2, 18) $$, '예빈: 찬우 생일 월, 일');
reset role;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select results_eq($$ select month::int, day::int from public.partner_birthday() $$,
  $$ values (10, 3) $$, '찬우: 예빈 생일 월, 일');
reset role;

select * from finish();
rollback;
