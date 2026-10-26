-- pgTAP: 배우자 분배표의 배우자 내 목표 줄 잠금(20 W-01 1번), 월급날 바꾸면 이번 사이클 끝 = 새 기준일 전날(07 3장).
-- 찬우(시작), 예빈(합류), 각자
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

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '찬우', monthly_income = 3500000, payday = 25 where id = auth.uid();
select set_config('test.code', (select code from public.create_invite()), true);
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
select public.finish_join();
update public.app_user set nickname = '예빈', monthly_income = 2700000, payday = 10 where id = auth.uid();
insert into public.goal (space_id, template, name, kind, priority, owner_user_id)
  select space_id, 'hobby', '예빈 카메라', 'once', 1, auth.uid() from public.app_user where id = auth.uid();
select set_config('test.g', (select id::text from public.goal where name = '예빈 카메라'), true);
select public.save_split(jsonb_build_array(
  jsonb_build_object('kind', 'saving', 'goal_id', current_setting('test.g'), 'amount', 100000),
  jsonb_build_object('kind', 'living', 'amount', 680000)
), auth.uid());
reset role;

-- 찬우가 예빈 분배표를 고침
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select throws_ok(format($$ select public.save_split(jsonb_build_array(
  jsonb_build_object('kind', 'saving', 'goal_id', %L, 'amount', 200000),
  jsonb_build_object('kind', 'living', 'amount', 680000)), '22222222-2222-2222-2222-222222222222') $$,
  current_setting('test.g')), '42501', 'locked_line', '배우자 내 목표 줄 금액은 못 바꿈');
select throws_ok($$ select public.save_split(jsonb_build_array(
  jsonb_build_object('kind', 'living', 'amount', 680000)), '22222222-2222-2222-2222-222222222222') $$,
  '42501', 'locked_line', '배우자 내 목표 줄을 빼지도 못 함');
select lives_ok(format($$ select public.save_split(jsonb_build_array(
  jsonb_build_object('kind', 'saving', 'goal_id', %L, 'amount', 100000),
  jsonb_build_object('kind', 'living', 'amount', 700000)), '22222222-2222-2222-2222-222222222222') $$,
  current_setting('test.g')), '다른 줄은 고칠 수 있음');
reset role;

-- 월급날 바꾸기: 찬우 이번 사이클 끝이 새 기준일 전날로
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.save_split(jsonb_build_array(jsonb_build_object('kind', 'living', 'amount', 880000)), auth.uid());
reset role;
insert into public.pay_checklist (space_id, owner_user_id, cycle_start, cycle_end, label)
  select space_id, id, public.kst_today() - 5, public.kst_today() + 25, '이번 달' from public.app_user
  where id = '11111111-1111-1111-1111-111111111111';
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
update public.app_user set payday = extract(day from public.kst_today() + 3)::smallint where id = auth.uid();
reset role;
select is((select cycle_end from public.pay_checklist where owner_user_id = '11111111-1111-1111-1111-111111111111'),
  public.kst_today() + 2, '이번 사이클 끝 = 새 월급날 전날');
select * from finish();
rollback;
