-- pgTAP: 실구동 사용성 H4(2026-11-13) 다시 확인. 페르소나가 밟은 길 그대로 앱 RPC로:
-- 예빈(각자) 공개 ‘했어요만’ → 저금 만들기(add_saving_item) → 돈 들어왔어요(log_money_in + distribute_money_in)
-- → 모은 금액 바로잡기(adjust_saving, 사유 글) → 찬우가 W-13·W-10(space_goals, goal 읽기, goal_saved_sums,
-- goal_move_public, goal_story)·홈 H-09(goal_saved_sums)·W-01 파트너 탭(partner_plan_view)·알림에서 이름·금액을 못 받음.
-- 찬우에게 보이는 것은 “개인 저금”과 확인 여부 자리뿐. 예빈 자신은 그대로.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);
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
select public.save_split(jsonb_build_array(jsonb_build_object('kind', 'fixed', 'amount', 680000)), auth.uid());
select set_config('test.code', (select code from public.create_invite()), true);
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈', monthly_income = 2700000, payday = 10 where id = auth.uid();
select public.complete_join(jsonb_build_array(jsonb_build_object('kind', 'fixed', 'amount', 680000)));
-- 공개 ‘했어요만’ 먼저 고르고 저금을 만든다(페르소나 순서)
update public.app_user set plan_share = 'done_only' where id = auth.uid();
select set_config('test.g', public.add_saving_item('비상금 모으기', 250000, 6000000, null, 1200000)::text, true);
select set_config('test.m', public.log_money_in(400000)::text, true);
select is(public.distribute_money_in(current_setting('test.m')::uuid,
  jsonb_build_array(jsonb_build_object('goal_id', current_setting('test.g'), 'amount', 300000))), 1, '돈 들어왔어요 나눠 넣기');
select isnt(public.adjust_saving(current_setting('test.g')::uuid, -50000, 'fix', '병원비 꺼냄', false), null,
  '모은 금액 바로잡기(사유 글)');
select is((select saved from public.goal_saved_sums() where goal_id = current_setting('test.g')::uuid), 1450000::bigint,
  '예빈 자신: 120만 + 30만 − 5만');
reset role;

-- 찬우가 받는 것
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is((select count(*)::int from public.goal where id = current_setting('test.g')::uuid), 0, 'goal 읽기: 행 없음');
select results_eq(format($$ select name, target_amount, start_saved, deadline from public.space_goals() where id = %L $$,
    current_setting('test.g')),
  $$ values ('개인 저금'::text, null::bigint, 0::bigint, null::date) $$, 'W-13·W-10 space_goals: “개인 저금”만');
select is((select count(*)::int from public.goal_saved_sums() where goal_id = current_setting('test.g')::uuid), 0,
  'H-09·W-10 goal_saved_sums: 모은 금액 없음');
select is((select count(*)::int from public.goal_move_public where goal_id = current_setting('test.g')::uuid), 0,
  '돈 들어왔어요·바로잡기 움직임 없음');
select is((select count(*)::int from public.goal_move where goal_id = current_setting('test.g')::uuid), 0, 'goal_move 직접 읽기 없음');
select is((select months from public.goal_story(current_setting('test.g')::uuid)), 0, 'goal_story 없음');
select is((select count(*)::int from public.money_in where id = current_setting('test.m')::uuid), 0, '돈 들어왔어요 기록 없음');
select ok((select bool_and(l->>'name' is null and l->>'amount' is null)
           from jsonb_array_elements(public.partner_plan_view()->'lines') l where l->>'kind' = 'saving'),
  'W-01 파트너 탭: 저금 줄 이름·금액 없음');
select ok(exists (select 1 from jsonb_array_elements(public.partner_plan_view()->'lines') l
                  where l->>'kind' = 'saving' and l ? 'state'), 'W-01 파트너 탭: 확인 여부 자리는 있음');
reset role;
select is((select count(*)::int from public.notification where user_id = '11111111-1111-1111-1111-111111111111'
    and (title || coalesce(body, '')) ~ '(비상금 모으기|병원비|30만|5만|145만)'), 0, '찬우 알림에 저금 이름·금액·사유 없음');
select is((select count(*)::int from public.notification where user_id = '11111111-1111-1111-1111-111111111111'
    and target like '%' || current_setting('test.g') || '%'), 0, '찬우 알림이 예빈 저금 상세로 가지 않음');

select * from finish();
rollback;
