-- pgTAP: v2.2 바로잡기·잔액 맞추기·쓸 곳 메모(20261203090000 계약 1·3·8·9). 사유는 넣은 사람만,
-- 상대 한 줄에 사람·금액·사유 없음, 주간 요약 빼기, 잔액 맞추기 여러 건, 냈어요 빼기
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);
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
create function pg_temp.saved(g uuid) returns bigint language sql security definer as $$ select public.goal_saved(g) $$;
-- 공동 저금(주인 없음) ‘여행’, 찬우 개인 저금 ‘카메라’
insert into public.goal (space_id, template, name, kind, priority, target_amount, start_saved)
  select space_id, 'trip', '여행', 'once', 3, 5000000, 3000000 from public.app_user where id = '11111111-1111-1111-1111-111111111111';
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select set_config('test.cam', public.add_saving_item('카메라', 100000, 2000000, null, 1000000)::text, true);
select set_config('test.trip', (select id::text from public.goal where template = 'trip'), true);

-- 1. 바로잡기 −: 모은 금액 줄고, 사유는 나만
select isnt(public.adjust_saving(current_setting('test.trip')::uuid, -1000000, 'used', '항공권 결제', true), null, '꺼내 씀');
select is(pg_temp.saved(current_setting('test.trip')::uuid), 2000000::bigint, '모은 금액 300만 → 200만');
select is((select reason from public.goal_move_reasons(current_setting('test.trip')::uuid)), '항공권 결제', '내 사유는 보임');
select throws_ok($$ select reason from public.goal_move $$, '42501', null, '사유 열은 앱이 직접 못 읽음');
select throws_ok(format('select public.adjust_saving(%L, -9000000)', current_setting('test.trip')), '22023', 'below_zero', '0원 아래 못 뺌');
select throws_ok(format('select public.adjust_saving(%L, 10000, %L)', current_setting('test.trip'), 'auto'), '22023', 'bad_reason',
  '자동 사유는 서버만');
reset role;
-- 2. 상대(예빈): 사람·금액·사유 없는 한 줄, 사유는 못 읽음
-- 2026-11-14(20261213090000 계약 3): ‘주간 요약에 넣지 않기’면 상대 한 줄도 없음(문구·사유 규칙은 ux_a_saving)
select is((select count(*)::int from public.notification where kind = 'saving_adjusted'), 0,
  '주간 요약에 넣지 않기면 상대 한 줄도 없음');
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is((select count(*)::int from public.goal_move_reasons(current_setting('test.trip')::uuid)), 0, '상대 사유는 못 읽음');
select is((select count(*)::int from public.goal_move_public where goal_id = current_setting('test.trip')::uuid), 1,
  '사유 뺀 보기로는 움직임이 보임');
-- 상대 개인 저금은 못 고침
select throws_ok(format('select public.adjust_saving(%L, 10000)', current_setting('test.cam')), '42501', 'not_owner', '남의 개인 저금 못 고침');
reset role;
-- 3. 개인 저금(각자)은 알림 없음
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.adjust_saving(current_setting('test.cam')::uuid, 50000, 'interest');
reset role;
select is((select count(*)::int from public.notification where kind = 'saving_adjusted'), 0, '개인 저금 바로잡기는 알림 없음');
-- 4. 주간 요약: hide_from_summary면 뺌, 아니면 사람 없이 한 줄
delete from public.partner_change; -- 준비 때 남은 저금 추가 기록은 이 검사와 상관없음
select is(public.send_weekly_summary(public.kst_today() + 1), 0, '주간 요약에 넣지 않기를 고르면 없음');
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.adjust_saving(current_setting('test.trip')::uuid, 200000, 'fix');
reset role;
select is(public.send_weekly_summary(public.kst_today() + 1), 1, '주간 요약 한 줄');
select results_eq($$ select title, actor_id from public.notification where kind = 'weekly_saving' $$,
  $$ values ('이번 주 같이 모으기 금액을 맞췄어요', null::uuid) $$, '주간 요약 문구(사람 없음, 숫자를 맞춰요는 맞췄어요)');

-- 5. 잔액 맞추기: 여러 건 한 번에, 차이만큼
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is(public.reconcile_savings(jsonb_build_array(
  jsonb_build_object('goal_id', current_setting('test.trip'), 'actual', 2500000),
  jsonb_build_object('goal_id', current_setting('test.cam'), 'actual', 1050000))), 1, '차이가 있는 것만(카메라는 같음)');
select is(pg_temp.saved(current_setting('test.trip')::uuid), 2500000::bigint, '실제 잔액으로');
select ok((select last_reconciled_at is not null from public.app_user where id = auth.uid()), '마지막 맞춘 때');

-- 6. 쓸 곳 메모 냈어요: 빼기
insert into public.saving_note (space_id, goal_id, name, amount, due_on)
  select space_id, current_setting('test.trip')::uuid, '숙소 잔금', 700000, '2027-01-10' from public.app_user where id = auth.uid();
select throws_ok($$ update public.saving_note set paid = true $$, '42501', null, '냈어요는 함수로만');
select isnt(public.mark_note_paid((select id from public.saving_note), true), null, '냈어요 + 빼기');
select results_eq($$ select paid, (select reason_code::text from public.goal_move m where m.id = paid_move_id) from public.saving_note $$,
  $$ values (true, 'note_paid') $$, '메모에 바로잡기 연결');
reset role;

select * from finish();
rollback;
