-- pgTAP: v2.2 돈 들어왔어요와 기간(20261203090000 계약 5·6). 나눠 넣기 권한·합 한도, 읽기 권한,
-- 기간 예시(첫 돈, 15일째, 16일째 막대, 빈 날, 새 기간), 필요한 돈 = 모든 줄 합(생활비·용돈 포함)
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'other@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao'),
  ('kakao-o', '33333333-3333-3333-3333-333333333333', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.sl(p_owner uuid, k text, p_user uuid default null) returns uuid language sql as $$
  select l.id from public.split_line l join public.salary_split s on s.id = l.split_id
  where s.owner_user_id is not distinct from p_owner and l.kind::text = k and (p_user is null or l.user_id = p_user) limit 1;
$$;

-- 찬우(시작한 사람, 25일), 다른 사람(혼자)
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '찬우', monthly_income = 3500000, payday = 25 where id = auth.uid();
insert into public.goal (space_id, template, name, kind, priority, target_amount)
  select space_id, 'home', '내 집 마련', 'once', 1, 100000000 from public.app_user where id = auth.uid();
select public.save_split(jsonb_build_array(
  jsonb_build_object('kind', 'saving', 'goal_id', (select id from public.goal where template = 'home'), 'amount', 950000),
  jsonb_build_object('kind', 'fixed', 'amount', 680000),
  jsonb_build_object('kind', 'living', 'amount', 880000)
), auth.uid());
select set_config('test.code', (select code from public.create_invite()), true);
reset role;
select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈', monthly_income = 2700000, payday = 10 where id = auth.uid();
select public.complete_join(jsonb_build_array(jsonb_build_object('kind', 'fixed', 'amount', 680000)));
reset role;
delete from public.notification;
create function pg_temp.p(d date) returns jsonb language sql as $$ select public.money_in_period(null, d) $$;

-- 날짜 없는 사람: 혼자 쓰는 3333(프리랜서)
select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
update public.app_user set monthly_income = 3000000, payday_none = true where id = auth.uid();
select public.save_split(jsonb_build_array(
  jsonb_build_object('kind', 'living', 'amount', 1000000),
  jsonb_build_object('kind', 'allowance', 'amount', 300000)), auth.uid());
select set_config('test.g', public.add_saving_item('비상금', 500000, null, null, 0)::text, true);
select is(pg_temp.p('2026-07-31')->>'status', 'none', '돈이 들어오기 전엔 기간 없음');
select set_config('test.m1', public.log_money_in(2000000, '2026-08-01', 'work')::text, true);
select public.log_money_in(500000, '2026-08-20', 'bonus');
select throws_ok($$ select public.log_money_in(1000, (public.kst_today() + 1)) $$, '22023', 'future_date', '미래 날짜 안 됨');
-- 1~15일째: 들어온 돈만
select results_eq($$ select v->>'status', (v->>'day')::int, (v->>'received')::bigint, v->>'start' from pg_temp.p('2026-08-15') v $$,
  $$ values ('early', 15, 2000000::bigint, '2026-08-01') $$, '15일째까지 early');
-- 16일째부터 막대: 필요한 돈 = 저금 + 생활비 + 용돈
select results_eq($$ select v->>'status', (v->>'day')::int, (v->>'received')::bigint, (v->>'needed')::bigint from pg_temp.p('2026-08-16') v $$,
  $$ values ('bar', 16, 2000000::bigint, 1800000::bigint) $$, '16일째 막대, 필요한 돈에 생활비·용돈 포함');
select is((pg_temp.p('2026-08-30')->>'received')::bigint, 2500000::bigint, '기간 안 돈은 모두 더함(종류 상관없음)');
select is(pg_temp.p('2026-08-30')->>'end', '2026-08-30', '끝 = 시작 + 29일');
-- 빈 날: 마지막 받은 날부터 며칠
select results_eq($$ select v->>'status', (v->>'gap_days')::int from pg_temp.p('2026-09-10') v $$,
  $$ values ('gap', 21) $$, '기간 밖은 빈 날(지난번 돈이 들어온 지 21일)');
-- 새 기간: E 뒤 처음 돈 들어온 날
select public.log_money_in(1500000, '2026-09-12', 'work');
select results_eq($$ select v->>'status', v->>'start', (v->>'day')::int, (v->>'received')::bigint from pg_temp.p('2026-09-12') v $$,
  $$ values ('early', '2026-09-12', 1, 1500000::bigint) $$, '새 기간');
-- 받은 날을 고치면 기간을 옮김
select public.money_in_set(current_setting('test.m1')::uuid, null, '2026-09-13');
select results_eq($$ select v->>'start', (v->>'received')::bigint from pg_temp.p('2026-09-13') v $$,
  $$ values ('2026-08-20', 4000000::bigint) $$, '받은 날을 옮기면 기간을 다시 셈(8월 20일 시작, 세 번 모두)');

-- 나눠 넣기
select is(public.distribute_money_in(current_setting('test.m1')::uuid,
  jsonb_build_array(jsonb_build_object('goal_id', current_setting('test.g'), 'amount', 700000))), 1, '저금에 나눠 넣기');
select is((select saved from public.goal_saved_sums() where goal_id = current_setting('test.g')::uuid), 700000::bigint, '모은 금액에 더함');
select throws_ok(format('select public.distribute_money_in(%L, %L)', current_setting('test.m1'),
  jsonb_build_array(jsonb_build_object('goal_id', current_setting('test.g'), 'amount', 1400000))), '22023', 'over', '들어온 금액보다 많이 못 넣음');
select throws_ok(format('select public.money_in_set(%L, 500000)', current_setting('test.m1')), '22023', 'bad_amount',
  '나눠 넣은 것보다 적게 못 고침');
reset role;

-- 다른 사람의 돈·저금
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.log_money_in(300000, '2026-10-01', 'family');
select throws_ok(format('select public.distribute_money_in(%L, %L)', (select id from public.money_in limit 1),
  jsonb_build_array(jsonb_build_object('goal_id', current_setting('test.g'), 'amount', 100000))),
  '42501', 'not_owner', '남의 저금에는 못 넣음');
select throws_ok(format('select public.distribute_money_in(%L, %L)', current_setting('test.m1'), '[]'), '42501', 'not_found',
  '남의 돈 들어왔어요는 못 나눔');
reset role;
-- 읽기: 주인만, 공개 ‘모두’면 상대도
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is((select count(*)::int from public.money_in), 0, '상대 돈 들어왔어요는 기본으로 못 봄');
reset role;
update public.app_user set plan_share = 'all' where id = '22222222-2222-2222-2222-222222222222';
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is((select count(*)::int from public.money_in), 1, '상대가 모두 보여 주기면 봄');
select throws_ok($$ select public.money_in_period('22222222-2222-2222-2222-222222222222'::uuid, null) $$, '42501', 'not_found',
  '상대 기간은 못 부름');
reset role;

select is((select string_agg(tablename::text collate "C", ',' order by tablename::text collate "C") from pg_publication_tables
    where pubname::text = 'supabase_realtime' and tablename::text in ('money_in', 'saving_note', 'goal_move')),
  'money_in,saving_note', 'Realtime: money_in·saving_note(goal_move는 사유 열 때문에 뺌)');

select * from finish();
rollback;
