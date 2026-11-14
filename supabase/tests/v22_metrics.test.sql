-- pgTAP: v2.2 지표(20261209090000, 32 0장, PR 14).
-- 1 서버 이벤트(auto_line_confirmed, progress_news_sent, salary_change_applied, unlink_resolved timeout, 분석 끔)
-- 2 북극성 metric_couple_month(확인 끝 + 모음, 손 줄 없음, 날짜 없는 사람 돈 들어왔어요, 바로잡기는 셈에서 뺌)
-- 3 admin_metrics(관리자 aal2만, 사람·커플 ID 없음, 가드레일 넷 + 경보)
-- 4 save_split: 각자 계열 보내기 줄은 맨 뒤, 옛 설정 이어받기
-- 찬우(시작, 25일), 예빈(합류, 10일, P-04 보내요), 혼자 쓰는 사람(3333, 날짜 없음)
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'solo@example.com'),
  ('aaaaaaaa-0000-0000-0000-000000000009', 'analyst@sweetwo.kr');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao'),
  ('kakao-s', '33333333-3333-3333-3333-333333333333', '{}', 'kakao');
create function pg_temp.login_as(uid uuid, aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
$$;
create function pg_temp.ev(n text) returns bigint language sql as $$
  select count(*) from public.server_event where name = n;
$$;

-- 찬우·예빈 연결(각자), 혼자 쓰는 사람
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '찬우', monthly_income = 3500000, payday = 25 where id = auth.uid();
insert into public.goal (space_id, template, name, kind, priority, target_amount)
  select space_id, 'home', '내 집 마련', 'once', 1, 100000000 from public.app_user where id = auth.uid();
select public.save_split(jsonb_build_array(
  jsonb_build_object('kind', 'saving', 'goal_id', (select id from public.goal where template = 'home'), 'amount', 950000),
  jsonb_build_object('kind', 'fixed', 'amount', 680000)
), auth.uid());
select set_config('test.code', (select code from public.create_invite()), true);
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈', monthly_income = 2700000, payday = 10 where id = auth.uid();
select public.complete_join(jsonb_build_array(jsonb_build_object('kind', 'allowance', 'amount', 300000)));
select public.request_mode_change(true, true, 'partner', 'p04_send');
reset role;
select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '혼자', payday_none = true where id = auth.uid();
insert into public.goal (space_id, template, name, kind, priority)
  select space_id, 'trip', '여행', 'once', 1 from public.app_user where id = auth.uid();
reset role;
select set_config('test.sp', (select space_id::text from public.app_user where id = '11111111-1111-1111-1111-111111111111'), true);
select set_config('test.solo', (select space_id::text from public.app_user where id = '33333333-3333-3333-3333-333333333333'), true);
select set_config('test.m0', date_trunc('month', public.kst_today())::date::text, true);
delete from public.pay_checklist;
delete from public.server_event;

-- ── 4. save_split: 보내기 줄은 맨 뒤, 설정 이어받기 ──
create function pg_temp.yorder() returns text language sql as $$
  select string_agg(l.kind::text, ',' order by l.sort) from public.split_line l join public.salary_split s on s.id = l.split_id
  where s.owner_user_id = '22222222-2222-2222-2222-222222222222';
$$;
select is(pg_temp.yorder(), 'allowance,send', '보내요: 보내기 줄은 뒤');
update public.split_line set auto_day = 15 where kind = 'send';
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.save_split('[{"kind":"allowance","amount":350000},{"kind":"fixed","amount":100000},{"kind":"living","amount":50000}]'::jsonb,
  auth.uid());
reset role;
select is(pg_temp.yorder(), 'allowance,fixed,living,send', '각자 save_split 뒤에도 보내기 줄은 맨 뒤(예전 sort 0으로 맨 위)');
select is((select count(distinct sort)::int from public.split_line l join public.salary_split s on s.id = l.split_id
  where s.owner_user_id = '22222222-2222-2222-2222-222222222222'), 4, '순서 번호가 겹치지 않음');
select results_eq($$ select amount, auto_day, in_checklist, auto_pay from public.split_line where kind = 'send' $$,
  $$ values (2350000::bigint, 15::smallint, true, true) $$, '금액은 다시 계산, 나가는 날 설정은 이어받음');

-- ── 1. 서버 이벤트 ──
-- 찬우 이번 달 확인 목록: 저금(손), 고정지출(자동, 나가는 날 오늘)
insert into public.pay_checklist (id, space_id, split_id, owner_user_id, cycle_start, cycle_end, label) values
  ('c0000000-0000-0000-0000-000000000001', current_setting('test.sp')::uuid,
   (select id from public.salary_split where owner_user_id = '11111111-1111-1111-1111-111111111111'),
   '11111111-1111-1111-1111-111111111111', current_setting('test.m0')::date,
   (current_setting('test.m0')::date + interval '1 month' - interval '1 day')::date, '이번 달 월급'),
  ('c0000000-0000-0000-0000-000000000002', current_setting('test.sp')::uuid,
   (select id from public.salary_split where owner_user_id = '22222222-2222-2222-2222-222222222222'),
   '22222222-2222-2222-2222-222222222222', current_setting('test.m0')::date + 9,
   (current_setting('test.m0')::date + interval '1 month' + interval '8 day')::date, '이번 달 월급');
insert into public.pay_check_line (id, checklist_id, space_id, kind, goal_id, planned, sort, auto, auto_due, state) values
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', current_setting('test.sp')::uuid,
   'saving', (select id from public.goal where template = 'home'), 950000, 0, false, null, 'wait'),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', current_setting('test.sp')::uuid,
   'fixed', null, 680000, 1, true, public.kst_today(), 'wait'),
  ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', current_setting('test.sp')::uuid,
   'fixed', null, 100000, 0, false, null, 'wait');
select ok(public.auto_confirm_due_lines(public.kst_today()) >= 1, '자동 줄 나가는 날 확인');
select results_eq($$ select user_id, props from public.server_event where name = 'auto_line_confirmed' $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid, '{"kind": "fixed"}'::jsonb) $$, 'auto_line_confirmed {kind}');
-- 사람이 다시 확인한 줄은 이벤트 없음
update public.pay_check_line set state = 'wait' where id = 'd0000000-0000-0000-0000-000000000002';
update public.pay_check_line set state = 'checked', checked_by = '11111111-1111-1111-1111-111111111111', actual = 700000
  where id = 'd0000000-0000-0000-0000-000000000002';
select is(pg_temp.ev('auto_line_confirmed'), 1::bigint, '사람이 확인하면 auto_line_confirmed 없음');
-- 날짜 없는 사람의 자동 저금(goal_move auto)
insert into public.goal_move (space_id, goal_id, kind, amount, reason_code, auto_line_id, auto_on)
  select current_setting('test.solo')::uuid, g.id, 'in', 100000, 'auto',
    (select id from public.split_line where kind = 'fixed' limit 1), public.kst_today()
  from public.goal g where g.template = 'trip';
select is(pg_temp.ev('auto_line_confirmed'), 2::bigint, '날짜 없는 자동 저금도 auto_line_confirmed {saving}');
-- 진행 소식
select public.notify('11111111-1111-1111-1111-111111111111', current_setting('test.sp')::uuid, 'progress_news', '월급날이에요',
  '내 집 마련 1%까지 왔어요', '/', 'piggy-bank', null, 'progress:test');
select is(pg_temp.ev('progress_news_sent'), 1::bigint, 'progress_news_sent');
-- 분석 수집을 끈 사람은 남기지 않음
update public.app_user set analytics_off = true where id = '22222222-2222-2222-2222-222222222222';
select public.notify('22222222-2222-2222-2222-222222222222', current_setting('test.sp')::uuid, 'progress_news', '월급날이에요',
  '1%', '/', 'piggy-bank', null, 'progress:test2');
select is(pg_temp.ev('progress_news_sent'), 1::bigint, '분석 끔이면 없음');
update public.app_user set analytics_off = false where id = '22222222-2222-2222-2222-222222222222';
-- 월급 변경 적용: 이번 달 예약 → 석 달 뒤 적용, 끝 달 있음
insert into public.salary_change (id, user_id, space_id, amount, effective_from, until_month, revert_amount) values
  ('e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', current_setting('test.sp')::uuid, 3000000,
   (current_setting('test.m0')::date + interval '3 month')::date, (current_setting('test.m0')::date + interval '4 month')::date, 3500000);
update public.salary_change set applied_at = now() where id = 'e0000000-0000-0000-0000-000000000001';
select is((select props from public.server_event where name = 'salary_change_applied'),
  '{"has_until": true, "months_ahead": 3}'::jsonb, 'salary_change_applied {months_ahead, has_until}');
update public.salary_change set applied_at = now() where id = 'e0000000-0000-0000-0000-000000000001';
select is(pg_temp.ev('salary_change_applied'), 1::bigint, '한 번만');
-- 해제 14일 기한
insert into public.couple_unlink (id, space_id, requested_by, requested_at, deadline, ratio, plan) values
  ('f0000000-0000-0000-0000-000000000001', current_setting('test.solo')::uuid, '33333333-3333-3333-3333-333333333333',
   now() - interval '14 days', public.kst_today(), 50, '[]');
update public.couple_unlink set status = 'confirmed', confirmed_at = now(), how = 'deadline'
  where id = 'f0000000-0000-0000-0000-000000000001';
select is((select props from public.server_event where name = 'unlink_resolved'),
  '{"path": "timeout", "days_pending": 14, "exported_data": null}'::jsonb, 'unlink_resolved timeout');
delete from public.couple_unlink;

-- ── 2. 북극성 ──
create function pg_temp.ns(p_space text) returns text language sql as $$
  select confirmed || ':' || saved || ':' || manual from public.metric_couple_month(p_space::uuid, current_setting('test.m0')::date);
$$;
-- 찬우 저금 손 줄·예빈 손 줄이 남음: 확인 끝 아님. 자동 줄(고정지출)은 모음이 아님
select is(pg_temp.ns(current_setting('test.sp')), 'false:false:false', '손 줄이 남으면 확인 끝 아님, 고정지출만으로는 모음 아님');
update public.pay_check_line set state = 'checked', checked_by = '11111111-1111-1111-1111-111111111111', checked_at = now()
  where id = 'd0000000-0000-0000-0000-000000000001';
select is(pg_temp.ns(current_setting('test.sp')), 'false:true:true', '저금 확인 = 모음, 예빈 손 줄이 남아 확인 끝 아님');
update public.pay_check_line set state = 'skipped', checked_by = '22222222-2222-2222-2222-222222222222', checked_at = now()
  where id = 'd0000000-0000-0000-0000-000000000003';
select is(pg_temp.ns(current_setting('test.sp')), 'true:true:true', '둘 다 끝(건너뜀 포함) + 모음 = 같이 모은 커플');
-- 손 줄이 없는 사람은 자동으로 만족: 예빈 목록에 자동 줄만 있으면
update public.pay_check_line set auto = true, state = 'wait', checked_by = null where id = 'd0000000-0000-0000-0000-000000000003';
select is(split_part(pg_temp.ns(current_setting('test.sp')), ':', 1), 'true', '손 줄 없는 목록은 확인 끝');
-- 저금 체크를 풀면 모음 아님. 바로잡기(+)는 셈에서 뺌
update public.pay_check_line set state = 'wait', checked_by = null, checked_at = null where id = 'd0000000-0000-0000-0000-000000000001';
insert into public.goal_move (space_id, goal_id, kind, amount, reason_code)
  select current_setting('test.sp')::uuid, id, 'in', 50000, 'fix' from public.goal where template = 'home';
select is(split_part(pg_temp.ns(current_setting('test.sp')), ':', 2), 'false', '바로잡기 +는 모음이 아님');
-- 날짜 없는 혼자: 돈 들어왔어요(그 달에 걸친 기간) + 나눠 넣기
select is(split_part(pg_temp.ns(current_setting('test.solo')), ':', 1), 'false', '날짜 없음: 돈 들어왔어요가 없으면 확인 끝 아님');
insert into public.money_in (id, space_id, owner_user_id, amount, received_on) values
  ('b0000000-0000-0000-0000-000000000001', current_setting('test.solo')::uuid, '33333333-3333-3333-3333-333333333333',
   2000000, current_setting('test.m0')::date - 10);
select is(pg_temp.ns(current_setting('test.solo')), 'true:true:false', '지난 달 말 돈 들어왔어요(기간이 이 달에 걸침) + 자동 저금');

-- ── 3. admin_metrics ──
insert into public.admin_user (email, name, roles) values ('analyst@sweetwo.kr', '분석', array['analyst']::public.admin_role[]);
select pg_temp.login_as('22222222-2222-2222-2222-222222222222', 'aal2');
set local role authenticated;
select throws_ok($$ select public.admin_metrics() $$, '42501', 'not_admin', '사용자는 못 봄');
reset role;
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000009', 'aal1');
set local role authenticated;
select public.admin_me();
select throws_ok($$ select public.admin_metrics() $$, '42501', 'mfa_required', '2단계 인증 필요');
reset role;
-- 찬우 저금 다시 확인 → 이번 달 같이 모은 커플 1, 혼자 1
update public.pay_check_line set state = 'checked', checked_by = '11111111-1111-1111-1111-111111111111', checked_at = now()
  where id = 'd0000000-0000-0000-0000-000000000001';
select pg_temp.login_as('aaaaaaaa-0000-0000-0000-000000000009', 'aal2');
set local role authenticated;
select set_config('test.m', public.admin_metrics(3)::text, true);
reset role;
select is(jsonb_array_length(current_setting('test.m')::jsonb->'north_star'), 3, '달 셋');
select results_eq($$ select (x->>'couples')::int, (x->>'connected')::int, (x->>'solo')::int, (x->'manual'->>'pct')::int
    from jsonb_array_elements(current_setting('test.m')::jsonb->'north_star') x where x->>'month' = to_char(public.kst_today(), 'YYYY-MM') $$,
  $$ values (1, 1, 1, 100) $$, '이번 달: 같이 모은 커플 1 / 연결 1, 혼자 1, 사람이 직접 확인 100%');
select is((select string_agg(x->>'kind', ',') from jsonb_array_elements(current_setting('test.m')::jsonb->'guardrails') x),
  'request_declined,unlink,auto_line_changed,reconcile_minus', '가드레일 넷');
select results_eq($$ select (x->>'num')::int, (x->>'den')::int, (x->>'pct')::int, (x->>'alert')::boolean
    from jsonb_array_elements(current_setting('test.m')::jsonb->'guardrails') x where x->>'kind' = 'auto_line_changed' $$,
  $$ values (1, 1, 100, true) $$, '자동 줄을 사람이 다른 금액으로 = 바꿈 100% > 10% 경보');
select ok((current_setting('test.m')::jsonb - 'at')::text !~ '1111|2222|3333|chanwoo|찬우|예빈', '사람·커플 ID·이름 없음');
select is((current_setting('test.m')::jsonb->'leading'->'rank_pair'->>'den')::int, 1, '선행: 순위 같이 보기 분모 = 연결 커플');

select * from finish();
rollback;
