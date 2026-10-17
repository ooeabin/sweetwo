-- pgTAP: 생활비 체크(W-03). 찬우(시작), 예빈(합류)
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
update public.app_user set nickname = '찬우', allowance = 500000, side = 'groom';
select set_config('test.code', (select code from public.create_invite()), true);
select public.start_first_plan(date_trunc('month', current_date - 15)::date, current_date - 15, current_date + 14, null, false, false, '{}', '[]');
select set_config('test.plan', (select id::text from public.monthly_plan), true);
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈';
select public.finish_join();
reset role;

select is(public.living_check_day('2026-10-25', '2026-11-24'), '2026-11-10'::date, '체크일 = 기준일 + 절반(반올림)');
select is(public.living_check_day('2026-11-25', '2026-12-24'), '2026-12-10'::date, '30일 사이클');

-- 꺼져 있으면 답할 수 없음, 알림 없음
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select throws_ok(format($$ select public.answer_living_check(%L, 'just') $$, current_setting('test.plan')),
  'P0001', 'not_open', '꺼져 있으면 없음');
reset role;
select is(public.send_living_check_notifications(current_date), 0, '꺼져 있으면 알림 없음');

-- 예빈이 켜면 부부 둘 다
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.set_living_check(true);
reset role;
select ok((select living_check from public.couple_space limit 1), '부부 단위로 켬');
select is(public.send_living_check_notifications(current_date), 2, '체크일 오후 8시 둘 다');
select is(public.send_living_check_notifications(current_date), 2, '같은 날 다시 불러도 알림은 한 번(dedupe)');
select is((select count(*)::int from public.notification where kind = 'living_check'), 2, '알림 2건');

-- 찬우가 답함: 용돈보다 많으면 거절, 내 용돈에서 → 예빈 알림
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select throws_ok(format($$ select public.answer_living_check(%L, 'over', 600000, 'allowance') $$, current_setting('test.plan')),
  '22023', 'over_allowance', '내 용돈보다 많으면 고를 수 없음');
select throws_ok(format($$ select public.answer_living_check(%L, 'over') $$, current_setting('test.plan')),
  '22023', 'bad_answer', '넘칠 것 같아요는 금액과 채울 곳이 필요');
select set_config('test.answer', public.answer_living_check(current_setting('test.plan')::uuid, 'over', 200000, 'allowance')::text, true);
select results_eq($$ select allowance_side::text, allowance_cut from public.living_check $$,
  $$ values ('groom', 200000::bigint) $$, '내 용돈에서 이번 달만 뺌');
reset role;
select is((select title from public.notification where kind = 'living_allowance'),
  '찬우님이 이번 달 용돈에서 20만 원을 생활비로 돌렸어요', '예빈에게 알림');

-- 한 명이 답하면 둘 다 끝
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select throws_ok(format($$ select public.answer_living_check(%L, 'just') $$, current_setting('test.plan')),
  'P0001', 'already_answered', '한 명이 답하면 끝');
reset role;

-- 되돌리기: 답한 사람만, 상대 알림도 지움
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.undo_living_check(current_setting('test.answer')::uuid);
reset role;
select results_eq($$ select (select count(*)::int from public.living_check), (select count(*)::int from public.notification where kind = 'living_allowance') $$,
  $$ values (0, 0) $$, '되돌리면 답과 알림이 사라짐');

select * from finish();
rollback;
