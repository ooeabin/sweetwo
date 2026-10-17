-- pgTAP: 서프라이즈 일정. 만든 사람만 보고 고치고 기록함, 배우자에게는 날도 기록도 안 감, 낸 곳은 각자 돈, 숨기기 끄면 둘 다 봄
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
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
reset role;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select lives_ok($$
  insert into public.care_day (space_id, category, kind, name, date_rule, month, day, budget, carer, secret)
  select space_id, 'couple', 'partner_birthday', '예빈 생일', 'solar_yearly', 3, 9, 200000, 'groom', true from public.app_user $$,
  '서프라이즈 추가');
select throws_ok($$
  insert into public.care_day (space_id, category, kind, name, date_rule, month, day, secret)
  select space_id, 'family', 'birthday', '어머니 생신', 'solar_yearly', 3, 9, true from public.app_user $$,
  '23514', null, '양가 날은 숨기지 못함');
select set_config('test.c', (select id::text from public.care_day), true);
select is(
  (public.record_care(current_setting('test.c')::uuid, '2026-03-09', 150000, 'living', '{gift}', '향수', null, 150000))->>'line',
  '0', '낸 곳은 각자 돈, 줄 없음');
select is((select paid_from::text from public.care_record), 'personal', '기록은 각자 돈');
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is((select count(*)::int from public.care_day) + (select count(*)::int from public.care_record), 0,
  '배우자에게는 날도 기록도 안 감');
select is_empty($$ update public.care_day set secret = false returning id $$, '배우자는 숨기기를 못 끔');
select throws_ok(format($$ select public.record_care(%L, '2027-03-09', 1, 'personal', '{}', null, null, 0) $$,
  current_setting('test.c')), '42501', null, '배우자는 기록 못 함');
reset role;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
update public.care_day set secret = false;
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is((select count(*)::int from public.care_day), 1, '숨기기 끄면 배우자도 봄');
select is((select count(*)::int from public.care_record), 1, '그동안 기록도 함께');
reset role;

select * from finish();
rollback;
