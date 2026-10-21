-- pgTAP: 첫 플랜 알림(18 P-11 대기). 찬우가 온보딩 중에 예빈이 먼저 합류 → 찬우가 첫 플랜을 만들면 예빈에게 한 번
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- 찬우: 온보딩 초반(호칭만), 초대 코드
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '찬우', side = 'groom';
update public.couple_space set partner_nickname = '예빈';
select set_config('test.code', (select code from public.create_invite()), true);
reset role;

-- 예빈: 내 정보까지 답하고 합류(플랜 없음)
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈', side = 'bride', monthly_income = 2700000, payday = 10, allowance = 500000;
select public.finish_join();
select is((select count(*)::int from public.monthly_plan), 0, '합류했지만 아직 플랜 없음(대기)');
reset role;

-- 찬우: 온보딩을 마치고 첫 플랜
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
update public.app_user set monthly_income = 3500000, payday = 25, allowance = 500000;
select public.start_first_plan(date_trunc('month', current_date - 60)::date, current_date - 60, current_date - 31,
  null, false, false, '{}', '[]');
select is((select count(*)::int from public.notification where kind = 'plan_ready'), 0, '만든 사람에게는 없음');
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select results_eq(
  $$ select kind, title, body, target, actor_id from public.notification where kind = 'plan_ready' $$,
  $$ values ('plan_ready', '찬우님이 첫 플랜을 만들었어요', '이번 달 월급 플랜을 같이 볼 수 있어요', '/',
             '11111111-1111-1111-1111-111111111111'::uuid) $$,
  '예빈: 첫 플랜 알림');
reset role;

-- 다음 사이클 플랜은 첫 플랜이 아니라 이 알림 없음
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
-- 다음 사이클은 오늘 이전에 시작해야 만들 수 있음
select public.create_cycle_plan(date_trunc('month', current_date - 30)::date, current_date - 30, current_date, false, '{}', '[]');
reset role;
select is((select count(*)::int from public.notification where dedupe like 'first_plan:%'), 1, '첫 플랜에만 한 번');

select * from finish();
rollback;
