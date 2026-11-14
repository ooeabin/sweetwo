-- pgTAP: 실구동 재테스트 2차(20261214090000). R1 한 사람 관리형 합류 완료, 40001 대신 P0001, R3 월급날 앞당기기
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- ── R1: 찬우가 ‘제가 주로 해요’(한 사람 관리형)로 시작, 공동 월급 계획을 만들고 초대 ──
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '찬우', monthly_income = 3500000, payday = 10 where id = auth.uid();
select is(public.request_mode_change(true, true, 'me'), 'applied', '혼자면 바로');
select public.save_split(jsonb_build_array(
  jsonb_build_object('kind', 'fixed', 'amount', 1000000),
  jsonb_build_object('kind', 'allowance', 'amount', 300000, 'user_id', '11111111-1111-1111-1111-111111111111')), null);
select set_config('test.code', (select code from public.create_invite()), true);
reset role;

-- 예빈: 합류하는 중 본 version으로 P-05c 저장
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈', monthly_income = 2700000, payday = 10 where id = auth.uid();
select is(public.join_context()->>'manager', 'starter', '시작한 사람이 관리');
select set_config('test.v', public.join_context()->'joint'->>'version', true);
-- 옛 version이면 다시(SQLSTATE는 P0001: 40001이면 PostgREST가 끝없이 다시 돌림)
select throws_ok(format($$ select public.complete_join(%L::jsonb, %s) $$,
  (public.join_context()->'joint'->'lines')::text, current_setting('test.v')::int - 1),
  'P0001', 'split_changed', '본 것보다 옛 version이면 split_changed(P0001)');
-- 본 version이면 공간에 넣으며 보내기 줄 때문에 version이 올라도 합류를 마침(R1)
select lives_ok(format($$ select public.complete_join(%L::jsonb || jsonb_build_array(
    jsonb_build_object('kind', 'allowance', 'amount', 400000, 'user_id', '22222222-2222-2222-2222-222222222222')), %s) $$,
  (public.join_context()->'joint'->'lines')::text, current_setting('test.v')),
  '본 version이면 합류를 마침');
reset role;
select is((select couple_state::text from public.couple_space where created_by = '11111111-1111-1111-1111-111111111111'),
  'connected', '연결됨');
select results_eq($$ select l.user_id, l.amount from public.split_line l where l.kind = 'send' $$,
  $$ values ('22222222-2222-2222-2222-222222222222'::uuid, 2300000::bigint) $$, '예빈 보내기 = 월급 − 용돈');

-- ── 40001을 쓰는 함수가 남지 않음 ──
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f' and pg_get_functiondef(p.oid) like '%errcode = ''40001''%'), 0, '40001을 내는 함수 없음');

-- ── R3: 월급날 10일. 2027-01-10은 일요일 → 1월 8일(금). 2027-02-10(수)은 공휴일로 두면 설 연휴(2월 8~9일) 앞 2월 5일(금) ──
insert into public.holiday (date, name) values ('2027-02-10', '시험 공휴일');
delete from public.pay_checklist;
update public.salary_split set checklist_from = '2026-12-01';
select is(public.make_checklist(s.id, null, '2027-01-07'::date) is not null, true, '1월 7일엔 지난 사이클')
  from public.couple_space s where s.created_by = '11111111-1111-1111-1111-111111111111';
select results_eq($$ select cycle_start, cycle_end from public.pay_checklist order by cycle_start $$,
  $$ values ('2026-12-10'::date, '2027-01-07'::date) $$, '12월 10일(목) ~ 앞당긴 1월 8일 전날');
select public.make_checklist(s.id, null, '2027-01-08'::date)
  from public.couple_space s where s.created_by = '11111111-1111-1111-1111-111111111111';
select results_eq($$ select cycle_start, cycle_end, label from public.pay_checklist where state <> 'closed' $$,
  $$ values ('2027-01-08'::date, '2027-02-04'::date, '1월 월급') $$,
  '주말이면 금요일에 생기고, 다음 월급날(2월 10일 공휴일, 그 앞 설 연휴)은 2월 5일이라 4일까지');
select is((select public.late_check_until(id) from public.pay_checklist where cycle_start = '2026-12-10'),
  '2027-02-04'::date, '늦은 확인 마지막 날도 앞당긴 날 − 1일');
-- 앞당기기 끄면 원래 날
update public.couple_space set holiday_shift = false;
delete from public.pay_checklist;
select is((select public.make_checklist(s.id, null, '2027-01-08'::date) is null), false, '끄면 1월 8일은 지난 사이클')
  from public.couple_space s where s.created_by = '11111111-1111-1111-1111-111111111111';
select results_eq($$ select cycle_start, cycle_end from public.pay_checklist $$,
  $$ values ('2026-12-10'::date, '2027-01-09'::date) $$, '앞당기기 끄면 원래 날 그대로');

select * from finish();
rollback;
