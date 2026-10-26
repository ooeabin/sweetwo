-- pgTAP: 다녀온 뒤 기록(Y-08). 다녀왔어요, 기록만(목표·분배표는 안 건드림), 다른 부부 막힘
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'other@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-o', '33333333-3333-3333-3333-333333333333', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
insert into public.care_day (space_id, category, kind, name, side, date_rule, month, day, budget, carer)
  select space_id, 'family', 'birthday', '어머니 생신', 'groom', 'solar_yearly', 10, 14, 300000, 'groom' from public.app_user;
insert into public.care_day (space_id, category, kind, name, side, date_rule, month, day, budget, carer)
  select space_id, 'family', 'seollal', '설날', null, 'lunar_yearly', 1, 1, 500000, 'together' from public.app_user;
select set_config('test.c', (select id::text from public.care_day where kind = 'birthday'), true);
select set_config('test.s', (select id::text from public.care_day where kind = 'seollal'), true);

select is(
  (public.record_care(current_setting('test.c')::uuid, '2026-10-14', 300000, 'living', '{gift}', '안마기', null, 200000))->>'line',
  '0', '기록만, 옮길 줄 없음');
select results_eq(
  $$ select status::text, status_on from public.care_day where id = current_setting('test.c')::uuid $$,
  $$ values ('done', '2026-10-14'::date) $$, '다녀왔어요');
select results_eq(
  $$ select amount, paid_from::text, gift_name from public.care_record where care_day_id = current_setting('test.c')::uuid $$,
  $$ values (300000::bigint, 'personal', '안마기') $$, '쓴 돈과 선물 기록');
select is(
  (public.record_care(current_setting('test.s')::uuid, '2027-02-06', 400000, 'personal', '{cash}', null, '세뱃돈', 0))->>'line',
  '0', '각자 돈: 기록만');
reset role;

select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select throws_ok(format($$ select public.record_care(%L, '2026-10-14', 1, 'personal', '{}', null, null, 0) $$,
  current_setting('test.c')), '42501', null, '다른 부부 챙길 날은 기록 못 함');
reset role;

select * from finish();
rollback;
