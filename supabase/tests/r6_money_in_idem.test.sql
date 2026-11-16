-- pgTAP: log_money_in 멱등(20261219090000). 같은 값을 다시 적으면 같은 기록, 나눠 넣은 뒤나 값이 다르면 새 기록
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);
insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao');
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '찬우', monthly_income = 3200000, payday = 25 where id = auth.uid();
select set_config('test.a', public.log_money_in(3200000, null, 'salary')::text, true);
select is(public.log_money_in(3200000, null, 'salary')::text, current_setting('test.a'), '같은 값을 다시 적으면 같은 기록');
select is((select count(*)::int from public.money_in where deleted_at is null), 1, '기록은 한 줄');
select isnt(public.log_money_in(3200000, null, 'bonus')::text, current_setting('test.a'), '종류가 다르면 새 기록');
select is((select count(*)::int from public.money_in where deleted_at is null), 2, '두 줄');
select * from finish();
rollback;
