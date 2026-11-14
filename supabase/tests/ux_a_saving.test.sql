-- pgTAP: 실구동 고침 A(20261213090000). 묶음은 한 쌍에 하나씩(bundle_open, 따로 고르면 만듦),
-- 묶음 이번 달 +(month_gain), 바로잡기 상대 한 줄은 사유대로 + ‘주간 요약에 넣지 않기’면 없음
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);
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
-- 찬우 결혼 비용(목표 3,000만, 시작 1,000만), 예빈 결혼 비용(목표 2,000만, 시작 500만)
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select set_config('test.cg', public.add_saving_item('결혼 비용', 500000, 30000000, null, 10000000)::text, true);
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select set_config('test.yg', public.add_saving_item('결혼 비용', 300000, 20000000, null, 5000000)::text, true);
reset role;
select is((select owner_user_id from public.goal where id = current_setting('test.cg')::uuid),
  '11111111-1111-1111-1111-111111111111'::uuid, '각자 모드 저금은 주인 있음');

-- 1. 묶음 하나씩(H1): 상대가 기다리는 묶음이 있으면 새로 못 만듦, 따로 고르면 만듦
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select set_config('test.b', public.bundle_create(current_setting('test.cg')::uuid)::text, true);
select set_config('test.cg2', public.add_saving_item('여행', 100000, null, null, 0)::text, true);
select throws_ok(format('select public.bundle_create(%L)', current_setting('test.cg2')), '22023', 'bundle_open',
  '내가 만든 묶음이 상대를 기다리면 새 묶음 거절');
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select throws_ok(format('select public.bundle_create(%L)', current_setting('test.yg')), '22023', 'bundle_open',
  '상대 묶음이 열려 있으면 새 묶음 거절(들어가기로)');
select lives_ok(format('select public.bundle_join(%L, %L)', current_setting('test.b'), current_setting('test.yg')),
  '들어가기는 됨');
reset role;
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select lives_ok(format('select public.bundle_create(%L)', current_setting('test.cg2')),
  '둘 다 든 묶음만 있으면 다른 저금은 묶을 수 있음');
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select set_config('test.yg2', public.add_saving_item('비상금', 100000, null, null, 0)::text, true);
select throws_ok(format('select public.bundle_create(%L)', current_setting('test.yg2')), '22023', 'bundle_open',
  '여행 묶음이 기다리면 또 거절');
select lives_ok(format('select public.bundle_create(%L, null, null, null, true)', current_setting('test.yg2')),
  '따로 모으기를 고르면 만듦');
reset role;

-- 2. 이번 달 +(M1): 상대 움직임을 못 봐도 묶음 응답에 돈 들어왔어요 금액
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.distribute_money_in(public.log_money_in(1000000, null, 'bonus'),
  jsonb_build_array(jsonb_build_object('goal_id', current_setting('test.cg'), 'amount', 1000000)));
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is((select count(*)::int from public.goal_move_public where goal_id = current_setting('test.cg')::uuid), 0,
  '예빈은 찬우 저금 움직임을 못 봄');
select is((select (v->>'month_gain')::bigint from jsonb_array_elements(public.bundle_view(current_setting('test.b')::uuid)) v),
  1000000::bigint, '묶음 이번 달 + = 돈 들어왔어요로 넣은 100만 원');
reset role;
select is((select title from public.notification where kind = 'saving_adjusted'
  and user_id = '22222222-2222-2222-2222-222222222222'), '같이 모으기에 더했어요', '돈 들어왔어요로 넣으면 더했어요');

-- 3. 바로잡기 상대 한 줄(M3): 사유대로, 주간 요약에 넣지 않기면 없음
delete from public.notification;
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.adjust_saving(current_setting('test.cg')::uuid, -100000, 'fix', '숫자를 맞춰요');
reset role;
select is((select title from public.notification where kind = 'saving_adjusted'), '같이 모으기 금액을 맞췄어요',
  '숫자를 맞춰요는 맞췄어요');
delete from public.notification;
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.adjust_saving(current_setting('test.cg')::uuid, -100000, 'used', '꺼내 썼어요', true);
reset role;
select is((select count(*)::int from public.notification where kind = 'saving_adjusted'), 0,
  '주간 요약에 넣지 않기면 상대 알림 없음');
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.adjust_saving(current_setting('test.cg')::uuid, -100000, 'used', '꺼내 썼어요');
reset role;
select is((select title from public.notification where kind = 'saving_adjusted'), '같이 모으기에서 꺼내 썼어요',
  '꺼내 썼어요만 꺼내 썼어요');
select is(public.send_weekly_summary(public.kst_today() + 1) >= 1, true, '주간 요약 돎');
select is((select title from public.notification where kind = 'weekly_saving'
  and user_id = '22222222-2222-2222-2222-222222222222'), '이번 주 같이 모으기에서 꺼내 썼어요', '주간 요약 한 줄');

-- 4. 돈 들어온 기록 지우기 되돌리기(M6)
select set_config('test.saved', public.goal_saved(current_setting('test.cg')::uuid)::text, true);
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select set_config('test.mi', public.log_money_in(50000, null, 'refund')::text, true);
select public.distribute_money_in(current_setting('test.mi')::uuid,
  jsonb_build_array(jsonb_build_object('goal_id', current_setting('test.cg'), 'amount', 50000)));
select public.money_in_delete(current_setting('test.mi')::uuid);
reset role;
select is(public.goal_saved(current_setting('test.cg')::uuid), current_setting('test.saved')::bigint, '지우면 넣은 금액도 빠짐');
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.money_in_restore(current_setting('test.mi')::uuid);
reset role;
select is(public.goal_saved(current_setting('test.cg')::uuid), current_setting('test.saved')::bigint + 50000,
  '되돌리면 기록과 넣은 금액이 돌아옴');

select * from finish();
rollback;
