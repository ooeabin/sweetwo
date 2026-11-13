-- pgTAP: v2.2 후속 계약 6(20261208090000). 각자 계열에서 합류한 사람이 P-04 ‘보내요’(p04_send)를 보내면 요청이 열려 있을 때도,
-- ‘지금처럼 할게요’ 뒤에도 그 사람 각자 월급 계획에 서버가 ‘보내기’(월급 − 용돈) 줄을 둠. 취소하면 지우고, 수락하면 공동 월급 계획으로
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);
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
select public.complete_join(jsonb_build_array(jsonb_build_object('kind', 'allowance', 'amount', 300000, 'auto_pay', true, 'auto_day', 10)));
reset role;
delete from public.notification;
create function pg_temp.ysend() returns bigint language sql security definer as $$
  select l.amount from public.split_line l join public.salary_split s on s.id = l.split_id
  where s.owner_user_id = '22222222-2222-2222-2222-222222222222' and l.kind = 'send';
$$;
create function pg_temp.sends() returns integer language sql security definer as $$
  select count(*)::int from public.split_line where kind = 'send';
$$;
select is(pg_temp.sends(), 0, '처음엔 보내기 줄 없음');

-- 1. 예빈 ‘보내요’ → 요청(각자 그대로) + 예빈 각자 계획에 보내기 줄
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is(public.request_mode_change(true, true, 'partner', 'p04_send'), 'requested', '요청');
reset role;
select is((select salary_mode::text from public.couple_space where id = (select space_id from public.app_user
  where id = '22222222-2222-2222-2222-222222222222')), 'separate', '각자 그대로');
select results_eq($$ select l.user_id, l.amount, l.in_checklist, l.auto_pay, l.auto_day from public.split_line l
    join public.salary_split s on s.id = l.split_id where l.kind = 'send' $$,
  $$ values ('22222222-2222-2222-2222-222222222222'::uuid, 2400000::bigint, true, true, 10::smallint) $$,
  '예빈 각자 계획에만 보내기 자동 줄(270만 − 30만)');
-- 2. 예빈이 계획을 다시 저장(용돈 35만) → 서버가 보내기 줄을 다시 둠, 직접 저장은 거절
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.save_split('[{"kind":"allowance","amount":350000},{"kind":"fixed","amount":100000}]'::jsonb, auth.uid());
select throws_ok($$ select public.save_split('[{"kind":"send","amount":100000}]'::jsonb, auth.uid()) $$, '42501', 'send_locked',
  '보내기 직접 저장 거절');
reset role;
select is(pg_temp.ysend(), 2350000::bigint, 'save_split 뒤 다시 계산(270만 − 35만)');
select is(pg_temp.sends(), 1, '보내기 줄 하나');
-- 3. 찬우 ‘지금처럼 할게요’ → 보내기 + 용돈 그대로, 월급이 바뀌면 다시 계산
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.answer_mode_change((select id from public.mode_change_request where status = 'open'), false);
reset role;
select is(pg_temp.ysend(), 2350000::bigint, '거절 뒤에도 보내기 줄 그대로');
update public.app_user set monthly_income = 2800000 where id = '22222222-2222-2222-2222-222222222222';
select is(pg_temp.ysend(), 2450000::bigint, '월급이 바뀌면 다시 계산');
-- 4. 다시 보내고 취소하면 지움
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.request_mode_change(true, true, 'partner', 'p04_send');
select public.cancel_mode_change((select id from public.mode_change_request where status = 'open'));
reset role;
select is(pg_temp.sends(), 0, '취소하면 보내기 줄 없음');
select is((select send_intent_space from public.app_user where id = '22222222-2222-2222-2222-222222222222'), null, '기억도 지움');
-- 4b. 공간이 바뀌면(해제 확정·탈퇴) 기억을 지우고 원래 공간 보내기 줄도 다시 셈
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.request_mode_change(true, true, 'partner', 'p04_send');
reset role;
select set_config('test.ysp', (select space_id::text from public.app_user where id = '22222222-2222-2222-2222-222222222222'), true);
insert into public.couple_space (id, couple_state, created_by) values
  ('99999999-9999-9999-9999-999999999999', 'solo', '22222222-2222-2222-2222-222222222222');
update public.app_user set space_id = '99999999-9999-9999-9999-999999999999' where id = '22222222-2222-2222-2222-222222222222';
select is((select send_intent_space from public.app_user where id = '22222222-2222-2222-2222-222222222222'), null,
  '공간이 바뀌면 기억 지움');
update public.app_user set space_id = current_setting('test.ysp')::uuid where id = '22222222-2222-2222-2222-222222222222';
select is(pg_temp.sends(), 0, '돌아와도 기억이 없으니 보내기 줄 없음');
update public.mode_change_request set status = 'cancelled' where status = 'open';

-- 5. 다시 보내고 수락 → 찬우가 관리하는 같이 계열, 보내기 줄은 공동 월급 계획에 하나
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.request_mode_change(true, true, 'partner', 'p04_send');
reset role;
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.answer_mode_change((select id from public.mode_change_request where status = 'open'), true);
reset role;
select results_eq($$ select s.owner_user_id, l.user_id from public.split_line l join public.salary_split s on s.id = l.split_id
    where l.kind = 'send' $$,
  $$ values (null::uuid, '22222222-2222-2222-2222-222222222222'::uuid) $$, '수락: 공동 월급 계획에 예빈 보내기 줄 하나');
select is((select send_intent_space from public.app_user where id = '22222222-2222-2222-2222-222222222222'), null,
  '수락하면 기억 지움');

select * from finish();
rollback;
