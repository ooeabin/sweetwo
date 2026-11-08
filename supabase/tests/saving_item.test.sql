-- pgTAP: 저금 항목(ADR 0007, 20 ‘저금 항목’, W-10~W-12, 06 4장). 찬우, 예빈
-- 모은 돈 = 체크한 저금 합, 저금 항목 추가(W-11), 달성 축하(W-12), 계속 모을게요 / 그만할게요(W-12a)와 되돌리기,
-- 각자 모드는 주인 월급 계획에만, 합쳐서 → 각자는 만든 사람에게 통째로
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.item(n text) returns uuid language sql as $$
  select id from public.goal where name = n and deleted_at is null order by created_at desc limit 1;
$$;

-- 찬우(350만, 25일): 월급 계획(저금 없음, 온보딩 직후와 같음) + 첫 체크리스트
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '찬우', monthly_income = 3500000, payday = 25 where id = auth.uid();
select public.save_split(jsonb_build_array(
  jsonb_build_object('kind', 'fixed', 'amount', 880000),
  jsonb_build_object('kind', 'living', 'amount', 880000),
  jsonb_build_object('kind', 'allowance', 'amount', 350000)
), auth.uid());
select public.start_checklist(auth.uid());
select set_config('test.code', (select code from public.create_invite()), true);

-- W-11: 이름 + 매달 금액 + 목표 금액 + 기한
select throws_ok($$ select public.add_saving_item('여행', 15000) $$, '22023', 'bad_amount', '매달 금액은 1만 원 단위');
select throws_ok($$ select public.add_saving_item('여행', 100000, null, '2030-01-01') $$, '22023', 'bad_deadline',
  '기한은 목표 금액이 있을 때만');
select throws_ok($$ select public.add_saving_item('', 100000) $$, '22023', 'bad_name', '이름 필요');
select lives_ok($$ select public.add_saving_item('여행', 500000, 1000000, '2030-01-15') $$, '목표 금액·기한 있는 저금 항목');
select lives_ok($$ select public.add_saving_item('적금', 300000) $$, '목표 금액 없는 저금 항목');
select is((select owner_user_id from public.goal where id = pg_temp.item('여행')), auth.uid(), '각자: 주인은 만든 사람');
select is((select deadline from public.goal where id = pg_temp.item('여행')), '2030-01-01'::date, '기한은 그 달 1일');
select results_eq(
  $$ select l.amount, l.sort from public.split_line l where l.goal_id = pg_temp.item('여행') $$,
  $$ values (500000::bigint, 0::smallint) $$, '내 월급 계획 저금 묶음에 W-11b 금액으로');
select is((select count(*)::int from public.pay_check_line where goal_id = pg_temp.item('적금') and state = 'wait'), 1,
  '이번 사이클 체크리스트에도 줄');

-- 모은 돈 = 체크한 금액 합(06 4-1)
select public.check_pay_line((select id from public.pay_check_line where goal_id = pg_temp.item('여행')), 'checked', 600000);
select is((select saved from public.goal_saved_sums() where goal_id = pg_temp.item('여행')), 600000::bigint,
  '다른 금액으로 보낸 60만 원');
select is(public.achieve_goal(pg_temp.item('여행')), false, '목표 금액 아래면 달성 아님');
select public.check_pay_line((select id from public.pay_check_line where goal_id = pg_temp.item('여행')), 'wait');
select is((select saved from public.goal_saved_sums() where goal_id = pg_temp.item('여행')), 0::bigint, '체크 풀면 뺌');
select public.check_pay_line((select id from public.pay_check_line where goal_id = pg_temp.item('적금')), 'skipped');
select is((select saved from public.goal_saved_sums() where goal_id = pg_temp.item('적금')), 0::bigint, '못 함은 더하지 않음');
reset role;
-- 예전 넣기·이미 모은 돈은 세지 않음
update public.goal set other_held = 5000000 where id = pg_temp.item('적금');
insert into public.goal_move (space_id, goal_id, kind, amount, created_by)
  select space_id, id, 'in', 700000, '11111111-1111-1111-1111-111111111111' from public.goal where id = pg_temp.item('적금');
select is((select saved from public.goal_saved_sums() where goal_id = pg_temp.item('적금')), 0::bigint,
  '이미 모은 돈·넣기는 모은 돈이 아님');

-- 달성(W-12): 모은 돈 ≥ 목표 금액, 줄은 그대로, 두 사람(지금은 찬우만)에게 알림
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.check_pay_line((select id from public.pay_check_line where goal_id = pg_temp.item('여행')), 'checked', 1000000);
select is(public.achieve_goal(pg_temp.item('여행')), true, '달성, 처음 봄');
select is(public.achieve_goal(pg_temp.item('여행')), false, '축하는 한 번');
select is((select count(*)::int from public.split_line where goal_id = pg_temp.item('여행')), 1, '달성해도 줄은 그대로');
reset role;
select is((select title from public.notification where kind = 'goal_achieved'), '여행 목표 금액을 다 모았어요!', '달성 알림');
select is((select target from public.notification where kind = 'goal_achieved'), '/salary/items/' || pg_temp.item('여행'),
  '알림은 저금 항목 상세로');

-- W-12a 계속 모을게요: 목표 금액·기한만 지움 → 되돌리기
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.saving_item_keep(pg_temp.item('여행'));
select results_eq($$ select target_amount, deadline, status::text from public.goal where id = pg_temp.item('여행') $$,
  $$ values (null::bigint, null::date, 'active') $$, '계속 모을게요: 목표 금액·기한 지움');
select is((select amount from public.split_line where goal_id = pg_temp.item('여행')), 500000::bigint, '줄은 그대로');
select public.saving_item_unkeep(pg_temp.item('여행'), 1000000, '2030-01-01');
select is((select status::text from public.goal where id = pg_temp.item('여행')), 'achieved', '되돌리면 다시 달성');

-- W-12a 그만할게요: 월급 계획에서 줄이 빠짐, 기록은 남김 → 되돌리면 그 금액으로
select public.saving_item_stop(pg_temp.item('여행'));
select is((select count(*)::int from public.split_line where goal_id = pg_temp.item('여행')), 0, '그만하면 월급 계획 줄 빠짐');
select is((select saved from public.goal_saved_sums() where goal_id = pg_temp.item('여행')), 1000000::bigint, '모은 기록은 남음');
select public.saving_item_reopen(pg_temp.item('여행'));
select is((select amount from public.split_line where goal_id = pg_temp.item('여행')), 500000::bigint, '되돌리면 그만두기 전 금액');
reset role;

-- 예빈 합류(각자): 찬우 저금 항목은 예빈 월급 계획에 없음, 예빈은 찬우 항목을 고칠 수 없음
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈', monthly_income = 2700000, payday = 10 where id = auth.uid();
select public.complete_join(jsonb_build_array(
  jsonb_build_object('kind', 'fixed', 'amount', 680000),
  jsonb_build_object('kind', 'living', 'amount', 680000),
  jsonb_build_object('kind', 'allowance', 'amount', 270000)
));
select is((select count(*)::int from public.split_line l join public.salary_split s on s.id = l.split_id
  where s.owner_user_id = auth.uid() and l.kind = 'saving'), 0, '예빈 월급 계획에는 찬우 저금 줄 없음');
select throws_ok($$ select public.saving_item_stop(pg_temp.item('적금')) $$, '42501', 'not_owner', '파트너 저금 항목은 보기만');
select public.add_saving_item('적금', 200000);
select is((select count(*)::int from public.goal where name = '적금' and deleted_at is null), 2, '같은 이름도 각자 따로');
reset role;

-- 합쳐서: 새 항목은 우리 둘 것(공동 월급 계획) → 다시 각자: 만든 사람 월급 계획으로 통째로 + 그 사람이 주인
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.set_salary_mode('joint');
select public.add_saving_item('이사', 400000);
select is((select owner_user_id from public.goal where id = pg_temp.item('이사')), null, '합쳐서: 주인 없음(우리 둘)');
select public.set_salary_mode('separate');
select results_eq(
  $$ select s.owner_user_id, l.amount from public.split_line l join public.salary_split s on s.id = l.split_id
     where l.goal_id = pg_temp.item('이사') $$,
  $$ values ('22222222-2222-2222-2222-222222222222'::uuid, 400000::bigint) $$, '각자로: 만든 사람 월급 계획에 통째로');
select is((select owner_user_id from public.goal where id = pg_temp.item('이사')),
  '22222222-2222-2222-2222-222222222222'::uuid, '만든 사람이 주인');
reset role;

-- ‘금액만 보여 주기’ 저금 항목은 파트너에게 “개인 저금”
update public.goal set visibility = 'amount' where id = pg_temp.item('이사');
select set_config('test.move', pg_temp.item('이사')::text, true);
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is((select name from public.space_goals() where id = current_setting('test.move')::uuid), '개인 저금',
  '파트너에게는 이름 가림');
reset role;

select * from finish();
rollback;
