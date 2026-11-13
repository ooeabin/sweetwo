-- pgTAP: v2.2 바로잡기·냈어요 되돌리기(20261207090000 계약 1·2). 내 바로잡기만, 상대 한 줄도 지움, 냈어요 되돌리기
-- 돈 들어왔어요 나눠 넣기는 되돌리지 않음
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);
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

-- 1. 바로잡기 되돌리기: 모은 금액이 돌아오고 상대 한 줄도 지움
select set_config('test.m1', public.adjust_saving(current_setting('test.trip')::uuid, -1000000, 'used', '항공권')::text, true);
reset role;
select is((select count(*)::int from public.notification where kind = 'saving_adjusted'), 1, '상대 한 줄이 감');
-- 상대는 남의 바로잡기를 못 되돌림
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select throws_ok(format('select public.undo_saving_adjust(%L)', current_setting('test.m1')), '42501', 'not_found', '남이 넣은 것은 못 되돌림');
reset role;
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select lives_ok(format('select public.undo_saving_adjust(%L)', current_setting('test.m1')), '되돌리기');
select is(pg_temp.saved(current_setting('test.trip')::uuid), 3000000::bigint, '모은 금액 300만으로 돌아옴');
reset role;
select is((select count(*)::int from public.notification where kind = 'saving_adjusted'), 0, '상대 한 줄도 지움');
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select throws_ok(format('select public.undo_saving_adjust(%L)', current_setting('test.m1')), '42501', 'not_found', '두 번은 안 됨');

-- 2. 냈어요 되돌리기: 뺀 것도 돌아오고 메모는 안 냄
insert into public.saving_note (space_id, goal_id, name, amount, due_on)
  select space_id, current_setting('test.trip')::uuid, '숙소 잔금', 700000, '2027-01-10' from public.app_user where id = auth.uid();
select public.mark_note_paid((select id from public.saving_note), true);
select is(pg_temp.saved(current_setting('test.trip')::uuid), 2300000::bigint, '냈어요로 70만 뺌');
select lives_ok($$ select public.unpay_saving_note((select id from public.saving_note)) $$, '냈어요 되돌리기');
select results_eq($$ select paid, paid_move_id from public.saving_note $$, $$ values (false, null::uuid) $$, '메모는 안 냄으로');
select is(pg_temp.saved(current_setting('test.trip')::uuid), 3000000::bigint, '모은 금액도 돌아옴');

-- 3. 돈 들어왔어요 나눠 넣기는 바로잡기 되돌리기로 지우지 않음(그 기록을 지우는 것은 money_in_delete)
select set_config('test.mi', public.log_money_in(500000, null, 'bonus')::text, true);
select public.distribute_money_in(current_setting('test.mi')::uuid,
  jsonb_build_array(jsonb_build_object('goal_id', current_setting('test.cam'), 'amount', 200000)));
select throws_ok(format('select public.undo_saving_adjust(%L)',
  (select id from public.goal_move_public where money_in_id = current_setting('test.mi')::uuid)), '42501', 'not_found',
  '나눠 넣은 것은 여기서 못 지움');
reset role;

select * from finish();
rollback;
