-- pgTAP: v2.2 확인 루프(20261201090000, plan v2.2 9-2 PR 2 ①~⑧).
-- 찬우(시작한 사람, 월급날 1일), 예빈(합류, 10일), 혼자 쓰는 사람 둘(날짜 없음 3333, 늦은 확인 4444).
-- 미래 날짜(2027)는 make_checklist(p_today)로, 늦은 확인은 실제 오늘 기준 지난 달·지지난 달로
begin;
create extension if not exists pgtap with schema extensions;
select plan(52);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'none@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'late@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao'),
  ('kakao-n', '33333333-3333-3333-3333-333333333333', '{}', 'kakao'),
  ('kakao-l', '44444444-4444-4444-4444-444444444444', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.sl(p_owner uuid, k text, g text default null) returns uuid language sql as $$
  select l.id from public.split_line l join public.salary_split s on s.id = l.split_id
  left join public.goal x on x.id = l.goal_id
  where s.owner_user_id is not distinct from p_owner and l.kind::text = k and (g is null or x.name = g) limit 1;
$$;
create function pg_temp.cl(p_owner uuid, p_start date) returns uuid language sql as $$
  select id from public.pay_checklist where owner_user_id is not distinct from p_owner and cycle_start = p_start;
$$;
create function pg_temp.line(list uuid, k text, g text default null) returns uuid language sql as $$
  select l.id from public.pay_check_line l left join public.goal x on x.id = l.goal_id
  where l.checklist_id = list and l.kind::text = k and (g is null or x.name = g) limit 1;
$$;

-- ── 찬우: 월급 계획 ──
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.couple_space set holiday_shift = false; -- 앞당기기(20261214090000 계약 3)와 상관없이 원래 날로 봄
update public.app_user set nickname = '찬우', monthly_income = 3500000, payday = 1 where id = auth.uid();
insert into public.goal (space_id, template, name, kind, priority, target_amount)
  select space_id, 'home', '내 집 마련', 'once', 1, 3000000 from public.app_user where id = auth.uid();
insert into public.goal (space_id, template, name, kind, priority, target_amount, start_saved)
  select space_id, 'trip', '여행', 'once', 2, 1000000, 500000 from public.app_user where id = auth.uid();
select public.save_split(jsonb_build_array(
  jsonb_build_object('kind', 'saving', 'goal_id', (select id from public.goal where template = 'home'), 'amount', 950000),
  jsonb_build_object('kind', 'saving', 'goal_id', (select id from public.goal where template = 'trip'), 'amount', 500000),
  jsonb_build_object('kind', 'fixed', 'amount', 680000),
  jsonb_build_object('kind', 'living', 'amount', 880000),
  jsonb_build_object('kind', 'allowance', 'amount', 350000)
), auth.uid());

-- ① 새 줄 기본값: 생활비·용돈은 확인 목록에서 빠짐, 자동 줄 아님
select is((select string_agg(kind::text || ':' || in_checklist || ':' || auto_pay, ',' order by sort) from public.split_line),
  'saving:true:false,saving:true:false,fixed:true:false,living:false:false,allowance:false:false', '① 줄 기본값(D2)');

-- ⑧ 온보딩(첫 월급 계획)에서는 이미 시작한 사이클 목록을 만들지 않음(D1). 오늘이 1일이면 오늘 시작이라 만듦
select is(public.start_checklist(auth.uid()) is null, public.kst_today() <> date_trunc('month', public.kst_today())::date,
  '⑧ 첫 사이클 소급 없음');
select is((select checklist_from from public.salary_split), public.kst_today(), '⑧ 월급 계획 시작일 = 만든 날');

-- 줄 설정(W-01d): 고정지출 자동 26일, 여행 저금 자동(월급날)
select lives_ok(format($$ select public.split_lines_configure(jsonb_build_array(
    jsonb_build_object('id', %L, 'auto_pay', true, 'auto_day', 26),
    jsonb_build_object('id', %L, 'auto_pay', true))) $$,
  pg_temp.sl(auth.uid(), 'fixed'), pg_temp.sl(auth.uid(), 'saving', '여행')), '줄 설정 저장');
select throws_ok(format($$ select public.split_lines_configure(jsonb_build_array(jsonb_build_object('id', %L, 'auto_day', 32))) $$,
  pg_temp.sl(auth.uid(), 'fixed')), '22023', 'bad_day', '나가는 날 1~31');
-- save_split으로 금액을 바꿔도 설정은 같은 줄에서 이어받음
select public.save_split(jsonb_build_array(
  jsonb_build_object('kind', 'saving', 'goal_id', (select id from public.goal where template = 'home'), 'amount', 950000),
  jsonb_build_object('kind', 'saving', 'goal_id', (select id from public.goal where template = 'trip'), 'amount', 500000),
  jsonb_build_object('kind', 'fixed', 'amount', 700000),
  jsonb_build_object('kind', 'living', 'amount', 880000),
  jsonb_build_object('kind', 'allowance', 'amount', 350000)
), auth.uid());
select is((select auto_pay || ':' || auto_day from public.split_line where id = pg_temp.sl(auth.uid(), 'fixed')), 'true:26',
  'save_split 뒤에도 자동 26일');
select is((select auto_pay from public.split_line where id = pg_temp.sl(auth.uid(), 'saving', '여행')), true, '여행 자동 그대로');
reset role;

-- ① 생성(2027년 3월 1일): 생활비·용돈 빼고 3줄, 자동 줄은 나가는 날
select isnt(public.make_checklist((select space_id from public.app_user where id = '11111111-1111-1111-1111-111111111111'),
  '11111111-1111-1111-1111-111111111111', '2027-03-01'), null, '① 3월 목록');
select set_config('test.mar', pg_temp.cl('11111111-1111-1111-1111-111111111111', '2027-03-01')::text, true);
select results_eq(
  $$ select l.kind::text, l.auto, l.auto_due, l.state from public.pay_check_line l
     where l.checklist_id = current_setting('test.mar')::uuid order by l.sort $$,
  $$ values ('saving', false, null::date, 'wait'), ('saving', true, '2027-03-01'::date, 'checked'), ('fixed', true, '2027-03-26'::date, 'wait') $$,
  '① 생활비·용돈 없음, 월급날 자동 줄은 만들 때 바로 확인');

-- ② 자동 줄: 나가는 날 전엔 그대로, 그날 checked(누가 체크했는지 없음), 저금이면 모은 금액 + 달성
select is(public.goal_saved((select id from public.goal where template = 'trip')), 1000000::bigint, '② 여행 모은 금액 = 시작 50만 + 자동 50만');
select is((select status::text || ':' || cardinality(achieved_seen) from public.goal where template = 'trip'), 'achieved:0',
  '② 목표 금액에 닿으면 서버가 달성(두 사람 모두 아직 안 봄)');
select is((select count(*)::int from public.notification where kind = 'goal_achieved'), 1, '② 달성 알림');
select is(public.auto_confirm_due_lines('2027-03-25'), 0, '② 나가는 날 전');
select is(public.auto_confirm_due_lines('2027-03-26'), 1, '② 나가는 날 0시');
select is((select state || ':' || coalesce(checked_by::text, '-') from public.pay_check_line
  where id = pg_temp.line(current_setting('test.mar')::uuid, 'fixed')), 'checked:-', '② 자동 확인');

-- ③ 나가는 날 계산(말일, 짧은 달, 사이클 끝)
select is(public.auto_due_date('2027-02-25', '2027-03-24', 31::smallint), '2027-02-28'::date, '③ 말일(31) 2월은 28일');
select is(public.auto_due_date('2027-02-25', '2027-03-24', 3::smallint), '2027-03-03'::date, '③ 월급날보다 앞이면 다음 달');
select is(public.auto_due_date('2027-01-31', '2027-02-27', 30::smallint), '2027-02-27'::date, '③ 사이클 끝을 넘으면 끝 날');
select is(public.auto_due_date('2027-01-25', '2027-02-24', null), '2027-01-25'::date, '③ null = 월급날');

-- ⑥ 알림: 손 줄(내 집 마련)이 있으면 월급날 알림 + 진행 소식 없음
select is(public.send_morning_notifications('2027-03-01'), 1, '⑥ 손 줄 있음 → 월급날');
select is((select body from public.notification where kind = 'payday'), '계획대로 됐는지 한 번만 확인해 주세요', '⑥ 월급날 문구');
select is(public.send_progress_news('2027-03-01'), 0, '⑥ 손 줄 있으면 진행 소식 없음');
select is(public.send_evening_notifications('2027-03-29'), 1, '⑥ 월급 전 확인(손 줄 남음)');
select is((select title from public.notification where kind = 'review_due'), '3월 1일 월급에서 확인할 게 1개 남았어요',
  '⑥ 월급 전 확인 문구(자동 줄은 셈하지 않음)');

-- ⑥ 손 줄이 0인 달: 월급날·월급 전 확인 없음, 진행 소식 1건(금액 없음)
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.split_lines_configure(jsonb_build_array(
  jsonb_build_object('id', pg_temp.sl(auth.uid(), 'saving', '내 집 마련'), 'auto_pay', true)));
reset role;
select public.make_checklist((select space_id from public.app_user where id = '11111111-1111-1111-1111-111111111111'),
  '11111111-1111-1111-1111-111111111111', '2027-04-01');
delete from public.notification;
select is(public.send_morning_notifications('2027-04-01'), 0, '⑥ 손 줄 0 → 월급날 알림 없음');
select is(public.send_progress_news('2027-04-01'), 1, '⑥ 진행 소식 1건');
select results_eq($$ select title, body from public.notification where kind = 'progress_news' $$,
  $$ values ('월급날이에요', '내 집 마련 31%까지 왔어요') $$, '⑥ 진행 소식 문구(대표 저금 이름 + %, 금액 없음)');
select is(public.send_progress_news('2027-04-01'), 1, '⑥ 다시 돌려도 알림은 한 번(dedupe)');
select is((select count(*)::int from public.notification where kind = 'progress_news'), 1, '⑥ 한 건');
select is(public.send_evening_notifications('2027-04-28'), 0, '⑥ 손 줄 0 → 월급 전 확인 없음');
-- 진행 소식을 끄면 없음, 알림 종류 키
update public.app_user set push_kinds = '{"progress_news": false}' where id = '11111111-1111-1111-1111-111111111111';
delete from public.notification;
select is(public.send_progress_news('2027-04-01'), 0, '⑥ 진행 소식 끔');
select results_eq(
  $$ select public.push_kind_on('{"progress_news": false}', k) from unnest(array['progress_news', 'payday', 'partner_done']) k $$,
  $$ values (false), (true), (true) $$, '알림 종류 끄기(없는 키 = 켬)');

-- ④ 한 번 확인: 각자 목록은 주인만
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select set_config('test.code', (select code from public.create_invite()), true);
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈', monthly_income = 2700000, payday = 10 where id = auth.uid();
select public.complete_join(jsonb_build_array(jsonb_build_object('kind', 'fixed', 'amount', 680000)));
select throws_ok(format('select public.confirm_payday(%L)', pg_temp.cl('11111111-1111-1111-1111-111111111111', '2027-04-01')),
  '42501', 'not_owner', '④ 각자: 파트너 목록은 한 번 확인 못 함');
reset role;

-- ④ 합쳐서: 누구나 한 번 확인, 남의 용돈 줄은 건너뜀
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
reset role; select public.set_salary_mode('joint'); set local role authenticated; -- 앱 역할은 못 부름(20261205090000)
select public.split_lines_configure((select jsonb_agg(jsonb_build_object('id', l.id, 'in_checklist', true, 'auto_pay', false))
  from public.split_line l join public.salary_split s on s.id = l.split_id where s.owner_user_id is null));
reset role;
select isnt(public.make_checklist((select space_id from public.app_user where id = '11111111-1111-1111-1111-111111111111'),
  null, '2027-06-10'), null, '④ 공동 목록');
select set_config('test.jl', (select id::text from public.pay_checklist where owner_user_id is null), true);
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select throws_ok(format('select public.check_pay_line(%L, %L)', (select l.id from public.pay_check_line l
    where l.checklist_id = current_setting('test.jl')::uuid and l.kind = 'allowance'
      and l.user_id = '11111111-1111-1111-1111-111111111111'), 'checked'),
  '42501', 'not_owner', '④ 합쳐서 남의 용돈 줄은 체크 못 함(B7)');
select cmp_ok(public.confirm_payday(current_setting('test.jl')::uuid), '>', 0, '④ 합쳐서: 파트너도 한 번 확인');
reset role;
select results_eq(
  $$ select count(*) filter (where state = 'wait')::int, (select confirmed_by from public.pay_checklist
       where id = current_setting('test.jl')::uuid) from public.pay_check_line where checklist_id = current_setting('test.jl')::uuid $$,
  $$ values (1, '22222222-2222-2222-2222-222222222222'::uuid) $$, '④ 찬우 용돈 줄만 남음, 확인한 사람 기록');
select is((select state from public.pay_check_line where checklist_id = current_setting('test.jl')::uuid
  and kind = 'allowance' and user_id = '11111111-1111-1111-1111-111111111111'), 'wait', '④ 남의 용돈 줄은 그대로');

-- ⑦ 날짜 없음: 목록 없음, 자동 저금 줄은 매달 1일 모은 금액에 더함(한 번만)
select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.couple_space set holiday_shift = false; -- 앞당기기(20261214090000 계약 3)와 상관없이 원래 날로 봄
update public.app_user set nickname = '프리', monthly_income = 3000000, payday = null, payday_none = true where id = auth.uid();
insert into public.goal (space_id, template, name, kind, priority, target_amount)
  select space_id, 'rainy', '비상금', 'once', 1, 10000000 from public.app_user where id = auth.uid();
select public.save_split(jsonb_build_array(
  jsonb_build_object('kind', 'saving', 'goal_id', (select id from public.goal where template = 'rainy'), 'amount', 500000,
    'auto_pay', true),
  jsonb_build_object('kind', 'living', 'amount', 1000000)), auth.uid());
select is(public.start_checklist(auth.uid()), null, '⑦ 날짜 없음 → 확인 목록 없음');
reset role;
select is(public.cycle_day((select space_id from public.app_user where id = '33333333-3333-3333-3333-333333333333'),
  '33333333-3333-3333-3333-333333333333'), null, '⑦ 기준일 없음');
select is(public.auto_confirm_due_lines('2027-05-02'), 0, '⑦ 1일이 아니면 없음');
select is(public.auto_confirm_due_lines('2027-05-01'), 1, '⑦ 1일에 자동 넣기');
select is(public.auto_confirm_due_lines('2027-05-01'), 0, '⑦ 같은 날 다시 돌려도 한 번');
select results_eq(
  $$ select kind, amount, reason_code::text, created_by from public.goal_move $$,
  $$ values ('in', 500000::bigint, 'auto', null::uuid) $$, '⑦ goal_move(in, auto)');
select is(public.goal_saved((select id from public.goal where template = 'rainy')), 500000::bigint, '⑦ 모은 금액에 셈');
delete from public.notification;
select is(public.send_progress_news('2027-05-01'), 1, '⑦ 날짜 없는 사람은 1일에 진행 소식');

-- ⑤ 늦은 확인: 지난 사이클 목록은 다음 사이클 끝까지(late), 그 전 사이클은 거절. 월급날 1일 = 달력 달
select pg_temp.login_as('44444444-4444-4444-4444-444444444444');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.couple_space set holiday_shift = false; -- 앞당기기(20261214090000 계약 3)와 상관없이 원래 날로 봄
update public.app_user set monthly_income = 3000000, payday = 1 where id = auth.uid();
select public.save_split(jsonb_build_array(jsonb_build_object('kind', 'fixed', 'amount', 500000),
  jsonb_build_object('kind', 'custom', 'name', '관리비', 'amount', 200000)), auth.uid());
reset role;
update public.salary_split set checklist_from = null where owner_user_id = '44444444-4444-4444-4444-444444444444';
select public.make_checklist((select space_id from public.app_user where id = '44444444-4444-4444-4444-444444444444'),
  '44444444-4444-4444-4444-444444444444', (date_trunc('month', public.kst_today()) - interval '2 months')::date);
select public.make_checklist((select space_id from public.app_user where id = '44444444-4444-4444-4444-444444444444'),
  '44444444-4444-4444-4444-444444444444', (date_trunc('month', public.kst_today()) - interval '1 month')::date);
select set_config('test.a', pg_temp.cl('44444444-4444-4444-4444-444444444444',
  (date_trunc('month', public.kst_today()) - interval '2 months')::date)::text, true);
select set_config('test.b', pg_temp.cl('44444444-4444-4444-4444-444444444444',
  (date_trunc('month', public.kst_today()) - interval '1 month')::date)::text, true);
select pg_temp.login_as('44444444-4444-4444-4444-444444444444');
set local role authenticated;
select throws_ok(format('select public.check_pay_line(%L, %L)', pg_temp.line(current_setting('test.a')::uuid, 'fixed'), 'checked'),
  '22023', 'closed', '⑤ 지지난 사이클은 늦은 확인도 끝');
select lives_ok(format('select public.check_pay_line(%L, %L)', pg_temp.line(current_setting('test.b')::uuid, 'fixed'), 'checked'),
  '⑤ 지난 사이클은 이번 사이클 끝까지');
select is((select state || ':' || late from public.pay_check_line where id = pg_temp.line(current_setting('test.b')::uuid, 'fixed')),
  'checked:true', '⑤ 늦은 확인 표시');
select is(public.confirm_payday(current_setting('test.b')::uuid), 1, '⑤ 지난 사이클 한 번 확인(서버가 건너뜀으로 둔 줄)');
select public.check_pay_line(pg_temp.line(current_setting('test.b')::uuid, 'fixed'), 'wait');
select is((select state from public.pay_check_line where id = pg_temp.line(current_setting('test.b')::uuid, 'fixed')), 'skipped',
  '⑤ 끝난 사이클에서 풀면 건너뜀');
reset role;
select is(public.late_check_until(current_setting('test.b')::uuid),
  (date_trunc('month', public.kst_today()) + interval '1 month - 1 day')::date, '⑤ 늦은 확인 끝 = 이번 사이클 끝');

select * from finish();
rollback;
