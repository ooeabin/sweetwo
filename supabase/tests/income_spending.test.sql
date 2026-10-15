-- pgTAP: 수입·용돈 열, 공간 지출 답, 고정지출 항목 권한(온보딩 파트 3·5)
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'k@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('google-k', '33333333-3333-3333-3333-333333333333', '{}', 'google');

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
select lives_ok($$ update public.app_user set monthly_income = 3500000, payday = 25, allowance = 500000 $$, '내 수입, 월급날, 용돈 저장');
select throws_ok($$ update public.app_user set payday = 32 $$, '23514', null, '월급날은 1~31');
select lives_ok(
  $$ update public.couple_space set partner_income = 2500000, partner_income_estimated = true, fixed_total = 1000000,
     living_budget = 1300000, loan_repayment = 300000, split_mode = 'custom', split_ratio = 60 $$,
  '공간 지출 답과 분담 저장');
select throws_ok($$ update public.couple_space set split_ratio = 62 $$, '23514', null, '분담 비율은 5% 단위');
insert into public.fixed_expense (space_id, group_key, name)
  select space_id, 'housing', '관리비' from public.app_user;
select is((select count(*)::int from public.fixed_expense), 1, '고정지출 항목 추가');
select throws_ok($$ delete from public.fixed_expense $$, '42501', null, '고정지출은 영구 삭제 못 한다(휴지통만)');
reset role;

select set_config('test.chanwoo_space', (select space_id::text from public.app_user where id = '11111111-1111-1111-1111-111111111111'), true);
select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select public.complete_signup('google', null, false, 'v1');
select public.ensure_my_space();
select is((select count(*)::int from public.fixed_expense), 0, '다른 부부의 고정지출은 안 보인다');
select throws_ok(
  $$ insert into public.fixed_expense (space_id, group_key, name) values (current_setting('test.chanwoo_space')::uuid, 'housing', '월세') $$,
  '42501', null, '다른 부부 공간에 고정지출을 못 넣는다');
update public.couple_space set fixed_total = 1 where id = current_setting('test.chanwoo_space')::uuid;
reset role;
select is((select fixed_total from public.couple_space where id = current_setting('test.chanwoo_space')::uuid), 1000000::bigint, '다른 부부는 공간 답을 못 바꾼다');

set local role anon;
select is((select count(*)::int from public.fixed_expense), 0, '익명은 고정지출을 못 본다');
reset role;

select * from finish();
rollback;
