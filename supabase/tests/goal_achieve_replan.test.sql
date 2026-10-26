-- pgTAP: G-05 달성 흐름(22). 달성하면 저금 줄이 빠지고 그 금액을 freed_lines에, 축하 문장 재료(체크리스트 기준),
-- 사용 기록(꺼내 쓰기 + 사용 완료, 남은 돈), 남은 돈 다른 목표로. 찬우 혼자
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

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
update public.app_user set nickname = '찬우', monthly_income = 3500000, payday = 25 where id = auth.uid();
insert into public.goal (space_id, template, name, kind, priority, target_amount, other_held)
  select space_id, 'appliance', '가전 바꾸기', 'once', 1, 1000000, 800000 from public.app_user where id = auth.uid();
insert into public.goal (space_id, template, name, kind, priority)
  select space_id, 'emergency', '비상금', 'once', 0 from public.app_user where id = auth.uid();
select public.save_split(jsonb_build_array(
  jsonb_build_object('kind', 'saving', 'goal_id', (select id from public.goal where template = 'appliance'), 'amount', 300000),
  jsonb_build_object('kind', 'saving', 'goal_id', (select id from public.goal where template = 'emergency'), 'amount', 100000),
  jsonb_build_object('kind', 'living', 'amount', 880000)
), auth.uid());
select public.start_checklist(auth.uid());
select public.check_pay_line((select id from public.pay_check_line where goal_id = (select id from public.goal where template = 'appliance')), 'checked');

-- 달성: 저금 줄이 빠지고 그 금액은 freed_lines에
select is(public.achieve_goal((select id from public.goal where template = 'appliance')), true, '달성, 처음 봄');
select is((select count(*)::int from public.split_line where goal_id = (select id from public.goal where template = 'appliance')), 0,
  '분배표에서 저금 줄 빠짐');
select is((select (freed_lines->>(select id::text from public.salary_split))::bigint from public.goal where template = 'appliance'),
  300000::bigint, '빠진 금액(매달 넣던 돈)');
select results_eq($$ select months, together from public.goal_story((select id from public.goal where template = 'appliance')) $$,
  $$ values (1, 0) $$, '체크한 달 1, 혼자');

-- 사용 기록: 100만 원 중 90만 원 씀 → 남은 20만 원(모은 돈 110만)
select is(public.finish_goal_use((select id from public.goal where template = 'appliance'), 900000), 200000::bigint, '남은 돈');
select is((select status::text from public.goal where template = 'appliance'), 'used', '사용 완료');
select throws_ok($$ select public.finish_goal_use((select id from public.goal where template = 'appliance'), 1) $$,
  '40001', 'goal_used', '두 번 기록 안 됨');

-- 남은 돈 비상금에 넣기
select is(public.move_goal_saved((select id from public.goal where template = 'appliance'), (select id from public.goal where template = 'emergency')),
  200000::bigint, '옮긴 금액');
select is((select saved from public.goal_saved_sums() where goal_id = (select id from public.goal where template = 'emergency')),
  200000::bigint, '비상금 모은 돈');
reset role;

select * from finish();
rollback;
