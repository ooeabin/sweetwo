-- pgTAP: v2.2 한 사람 관리형 보내기·용돈(20261202090000 계약 4, G9). 보내기 = 1만 원 내림(월급 − 용돈),
-- 월급·용돈이 바뀌면 다시 계산, 관리하는 사람의 상대 용돈 수정 + 알림, 보내기 직접 저장 거절, 둘이 같이는 용돈 주인만
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
create function pg_temp.send_amt() returns bigint language sql security definer as $$
  select amount from public.split_line where kind = 'send' and user_id = '22222222-2222-2222-2222-222222222222';
$$;

-- 예빈 ‘월급은 대부분 찬우님에게 보내요’ → 찬우 수락
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.request_mode_change(true, true, 'partner', 'p04_send');
reset role;
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.answer_mode_change((select id from public.mode_change_request where status = 'open'), true);
reset role;
select results_eq($$ select kind::text, user_id, amount, in_checklist, auto_pay, auto_day from public.split_line where kind = 'send' $$,
  $$ values ('send', '22222222-2222-2222-2222-222222222222'::uuid,
             2700000 - coalesce((select amount from public.split_line where kind = 'allowance'
               and user_id = '22222222-2222-2222-2222-222222222222'), 0), true, true, 10::smallint) $$,
  '관리하지 않는 쪽만 보내기 줄(자동, 나가는 날 = 예빈 월급날)');
select is((select count(*)::int from public.split_line where kind = 'send' and user_id = '11111111-1111-1111-1111-111111111111'), 0,
  '관리하는 사람은 보내기 줄 없음');

-- 예빈 용돈 33만 5천 → 보내기 = 1만 원 내림(270만 − 33.5만 = 236.5만 → 236만)
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.split_line_add((select id from public.salary_split where owner_user_id is null), 'allowance', 340000);
reset role;
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.split_line_add((select id from public.salary_split where owner_user_id is null), 'allowance', 500000);
reset role;
select is(pg_temp.send_amt(), 2360000::bigint, '용돈이 바뀌면 다시 계산');
-- 월급이 바뀌면(S-11c 즉시) 다시 계산
update public.app_user set monthly_income = 2755000 where id = '22222222-2222-2222-2222-222222222222';
select is(pg_temp.send_amt(), 2410000::bigint, '월급이 바뀌면 다시 계산(1만 원 내림)');
-- 0원 아래면 0
update public.app_user set monthly_income = 100000 where id = '22222222-2222-2222-2222-222222222222';
select is(pg_temp.send_amt(), 0::bigint, '월급보다 용돈이 많으면 0원');
update public.app_user set monthly_income = 2700000 where id = '22222222-2222-2222-2222-222222222222';

-- 관리하는 사람(찬우)이 예빈 용돈을 고침 → 됨 + 예빈에게 ‘내 용돈이 바뀌었을 때’(금액 없음)
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select lives_ok(format('select public.split_line_set(%L, 300000)',
  pg_temp.sl(null, 'allowance', '22222222-2222-2222-2222-222222222222')), '관리하는 사람이 상대 용돈 고침');
reset role;
select is(pg_temp.send_amt(), 2400000::bigint, '보내기도 다시 계산');
select results_eq($$ select user_id, title, body from public.notification where kind = 'my_allowance' $$,
  $$ values ('22222222-2222-2222-2222-222222222222'::uuid, '찬우님이 내 용돈을 바꿨어요', null::text) $$, '내 용돈 알림(금액 없음)');
select is(public.push_kind_on('{"my_allowance": false}', 'my_allowance'), false, '내 용돈 알림은 끌 수 있음');
-- 관리하지 않는 쪽은 관리하는 사람 용돈을 못 고침
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select throws_ok(format('select public.split_line_set(%L, 500000)',
  pg_temp.sl(null, 'allowance', '11111111-1111-1111-1111-111111111111')), '42501', 'not_owner', '관리하지 않는 쪽은 상대 용돈 못 고침');

-- 보내기 직접 저장 거절
select throws_ok(format('select public.split_line_set(%L, 100000)', pg_temp.sl(null, 'send')), '42501', 'send_locked', '보내기 금액 직접 못 고침');
select throws_ok(format('select public.split_line_delete(%L)', pg_temp.sl(null, 'send')), '42501', 'send_locked', '보내기 못 지움');
select throws_ok(format('select public.split_line_add(%L, %L, 100000)', (select id from public.salary_split where owner_user_id is null), 'send'),
  '22023', 'bad_kind', '보내기 못 추가');
select throws_ok($$ select public.save_split('[{"kind":"send","amount":100000}]'::jsonb) $$, '42501', 'send_locked', 'save_split 보내기 거절');
reset role;
-- save_split(관리하는 사람)으로 계획을 통째로 저장해도 보내기 줄은 서버가 다시 둠
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.save_split((select jsonb_agg(jsonb_build_object('kind', l.kind, 'goal_id', l.goal_id, 'user_id', l.user_id,
  'name', l.name, 'amount', l.amount) order by l.sort) from public.split_line l
  join public.salary_split s on s.id = l.split_id where s.owner_user_id is null and l.kind <> 'send'));
reset role;
select is(pg_temp.send_amt(), 2400000::bigint, 'save_split 뒤에도 보내기 줄');

-- 월급 변경 예약(G12) → 기준일 0시에 적용된 뒤 목록 생성(보내기 금액이 새 월급 기준)
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.schedule_salary_change(2000000, '2027-03-01');
reset role;
update public.salary_split set checklist_from = null;
select public.run_cycle_checklists('2027-03-25');
select is((select planned from public.pay_check_line l join public.pay_checklist c on c.id = l.checklist_id
  where c.cycle_start = '2027-03-25' and l.kind = 'send'), 1700000::bigint, '월급 변경 적용이 목록 생성보다 먼저(200만 − 30만)');

-- 둘이 같이(관리하는 사람 없음): 보내기 줄 없어지고, 용돈은 주인만(B7)
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.request_mode_change(true, true, 'together');
reset role;
select is((select count(*)::int from public.split_line where kind = 'send'), 0, '둘이 같이면 보내기 줄 없음');
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select throws_ok(format('select public.split_line_set(%L, 100000)',
  pg_temp.sl(null, 'allowance', '22222222-2222-2222-2222-222222222222')), '42501', 'not_owner', '둘이 같이: 남의 용돈 못 고침');
select throws_ok($$ select public.save_split((select jsonb_agg(jsonb_build_object('kind', l.kind, 'goal_id', l.goal_id,
  'user_id', l.user_id, 'name', l.name, 'amount', case when l.kind = 'allowance' and l.user_id <> auth.uid() then 0 else l.amount end)
  order by l.sort) from public.split_line l join public.salary_split s on s.id = l.split_id where s.owner_user_id is null)) $$,
  '42501', 'not_owner', '둘이 같이: save_split으로도 남의 용돈 못 바꿈');
reset role;

select * from finish();
rollback;
