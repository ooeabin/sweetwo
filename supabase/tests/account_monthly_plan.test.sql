-- pgTAP: 통장, 첫 월급 플랜, 플랜 줄 권한(온보딩 결과 O-63, O-66)
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

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
select lives_ok($$ update public.couple_space set account_mode = 'roles', base_day = 25 $$, '통장 방식과 기준일 저장');
select throws_ok($$ update public.couple_space set base_day = 32 $$, '23514', null, '기준일은 1~31');
select lives_ok(
  $$ insert into public.account (space_id, role, name, is_existing, start_balance)
     select space_id, 'living', '생활비 통장', true, 1200000 from public.app_user $$,
  '쓰던 통장 추가');
select throws_ok(
  $$ insert into public.account (space_id, role, name) select space_id, 'living', '또' from public.app_user $$,
  '23505', null, '공동 역할은 하나만');
select throws_ok($$ delete from public.account $$, '42501', null, '통장은 영구 삭제 못 한다');
select throws_ok(
  $$ insert into public.monthly_plan (space_id, label_month, cycle_start, cycle_end)
     select space_id, '2026-09-01', '2026-09-25', '2026-10-24' from public.app_user $$,
  '42501', null, '플랜은 직접 못 만든다');
select isnt(
  public.start_first_plan('2026-09-01', '2026-09-25', '2026-10-24', null, true, true, '{}',
    '[{"target":"account","account_role":"living","amount":870000,"amount_groom":520000,"amount_bride":350000}]'),
  null, '첫 플랜 시작');
select lives_ok(
  $$ select public.start_first_plan('2026-09-01', '2026-09-25', '2026-10-24', null, true, true, '{}', '[]') $$,
  '다시 눌러도 오류 없음');
select is((select count(*)::int from public.monthly_plan), 1, '같은 사이클 플랜은 하나');
select is((select count(*)::int from public.plan_line), 1, '줄은 처음 것 그대로');
select throws_ok($$ update public.plan_line set amount = 1 $$, '42501', null, '플랜 줄은 직접 못 고친다');
reset role;

select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select public.complete_signup('google', null, false, 'v1');
select public.ensure_my_space();
select is((select count(*)::int from public.monthly_plan) + (select count(*)::int from public.account), 0, '다른 부부의 플랜과 통장은 안 보인다');
reset role;

set local role anon;
select is((select count(*)::int from public.plan_line), 0, '익명은 플랜 줄을 못 본다');
reset role;

select * from finish();
rollback;
