-- pgTAP: 월급날 확인 → 월급 자동 수입 기록(20261224090000, 2026-11-20 사용자 결정).
-- 혼자 쓰는 사람(4444, 월급날 1일, 350만 원)의 지난 달·이번 달 목록, 찬우·예빈(합쳐서)의 공동 목록. 날짜는 실제 오늘 기준 이번 달·지난 달
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'solo@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao'),
  ('kakao-s', '44444444-4444-4444-4444-444444444444', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.cl(p_owner uuid, p_start date) returns uuid language sql as $$
  select id from public.pay_checklist where owner_user_id is not distinct from p_owner and cycle_start = p_start;
$$;
create function pg_temp.line(list uuid, k text, g text default null) returns uuid language sql as $$
  select l.id from public.pay_check_line l left join public.goal x on x.id = l.goal_id
  where l.checklist_id = list and (case when l.kind = 'custom' and l.name = '생활비' then 'living' else l.kind::text end) = k and (g is null or x.name = g) limit 1;
$$;
create function pg_temp.autos(p_owner uuid) returns integer language sql as $$
  select count(*)::int from public.money_in where owner_user_id = p_owner and source = 'payday_auto' and deleted_at is null;
$$;

-- ── 혼자 쓰는 사람: 월급 계획 + 저축·투자 줄 ──
select pg_temp.login_as('44444444-4444-4444-4444-444444444444');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.couple_space set holiday_shift = false;
update public.app_user set nickname = '혼자', monthly_income = 3500000, payday = 1 where id = auth.uid();
insert into public.goal (space_id, template, name, kind, priority, target_amount, start_saved)
  select space_id, 'trip', '여행', 'once', 1, 9000000, 500000 from public.app_user where id = auth.uid();
select public.save_split(jsonb_build_array(
  jsonb_build_object('kind', 'saving', 'goal_id', (select id from public.goal where template = 'trip'), 'amount', 500000),
  jsonb_build_object('kind', 'fixed', 'amount', 700000),
  jsonb_build_object('kind', 'custom', 'name', '관리비', 'amount', 200000)), auth.uid());
reset role;
update public.salary_split set checklist_from = null where owner_user_id = '44444444-4444-4444-4444-444444444444';
select public.make_checklist((select space_id from public.app_user where id = '44444444-4444-4444-4444-444444444444'),
  '44444444-4444-4444-4444-444444444444', (date_trunc('month', public.kst_today()) - interval '1 month')::date);
select public.make_checklist((select space_id from public.app_user where id = '44444444-4444-4444-4444-444444444444'),
  '44444444-4444-4444-4444-444444444444', public.kst_today());
select set_config('test.prev', pg_temp.cl('44444444-4444-4444-4444-444444444444',
  (date_trunc('month', public.kst_today()) - interval '1 month')::date)::text, true);
select set_config('test.cur', pg_temp.cl('44444444-4444-4444-4444-444444444444',
  date_trunc('month', public.kst_today())::date)::text, true);
select set_config('test.saved0', public.goal_saved((select id from public.goal where template = 'trip'))::text, true);

-- 이번 달 목록
select is(pg_temp.autos('44444444-4444-4444-4444-444444444444'), 0, '처음엔 자동 수입 없음');
select pg_temp.login_as('44444444-4444-4444-4444-444444444444');
set local role authenticated;
-- 풀기(wait → wait)는 확인이 아님
select public.check_pay_line(pg_temp.line(current_setting('test.cur')::uuid, 'fixed'), 'wait');
select is(pg_temp.autos('44444444-4444-4444-4444-444444444444'), 0, '체크를 푸는 것만으로는 안 넣음');
-- 첫 확인(저축·투자 줄)
select public.check_pay_line(pg_temp.line(current_setting('test.cur')::uuid, 'saving'), 'checked');
select results_eq(
  $$ select amount, kind::text, received_on, source, deleted_at is null from public.money_in where owner_user_id = auth.uid() $$,
  $$ select 3500000::bigint, 'salary', date_trunc('month', public.kst_today())::date, 'payday_auto', true $$,
  '첫 확인 → 그 사이클 월급날 날짜로 월급 3,500,000원 한 줄(종류 월급, 출처 자동)');
select isnt((select auto_income_at from public.pay_checklist where id = current_setting('test.cur')::uuid), null, '사이클에 한 번 넣었다는 표시');
reset role;
select is(public.goal_saved((select id from public.goal where template = 'trip')) - current_setting('test.saved0')::bigint, 500000::bigint,
  '모은 금액은 저금 줄 50만 원만 늘고 자동 수입은 안 들어감');
select pg_temp.login_as('44444444-4444-4444-4444-444444444444');
set local role authenticated;
select is((select count(*)::int from public.goal_move where money_in_id is not null), 0, '자동 수입에 저축·투자 배정(goal_move) 없음');
-- 멱등: 다른 줄 확인, 건너뜀, 한 번 확인, 다시 풀기·다시 확인
select public.check_pay_line(pg_temp.line(current_setting('test.cur')::uuid, 'fixed'), 'checked', 650000);
select public.check_pay_line(pg_temp.line(current_setting('test.cur')::uuid, 'custom'), 'skipped');
select is(public.confirm_payday(current_setting('test.cur')::uuid), 0, '한 번 확인(남은 손 줄 없음)');
select is((select count(*)::int from public.money_in where owner_user_id = auth.uid()), 1, '멱등: 여러 번 확인해도 한 줄');
-- 체크를 모두 풀어도 기록은 그대로
select public.check_pay_line(pg_temp.line(current_setting('test.cur')::uuid, 'saving'), 'wait');
select public.check_pay_line(pg_temp.line(current_setting('test.cur')::uuid, 'fixed'), 'wait');
select is(pg_temp.autos(auth.uid()), 1, '체크를 풀어도 수입 기록은 안 지워짐');
-- 지우고 다시 확인해도 다시 안 넣음
select public.money_in_delete((select id from public.money_in where owner_user_id = auth.uid()));
select is(pg_temp.autos(auth.uid()), 0, '사용자가 지움');
select public.check_pay_line(pg_temp.line(current_setting('test.cur')::uuid, 'saving'), 'checked');
select public.confirm_payday(current_setting('test.cur')::uuid);
select is((select count(*)::int from public.money_in where owner_user_id = auth.uid()), 1, '지운 뒤 같은 사이클에서 다시 확인해도 새 줄 없음');
select is(pg_temp.autos(auth.uid()), 0, '지운 기록은 그대로 지워짐');
-- 수정: 금액을 고칠 수 있음(나눠 넣은 게 없으니)
select public.money_in_restore((select id from public.money_in where owner_user_id = auth.uid()));
select lives_ok(format('select public.money_in_set(%L, 3300000)', (select id from public.money_in where owner_user_id = auth.uid())), '자동 기록도 고칠 수 있음');
-- 직접 적기는 자동 기록과 같은 값이어도 새 줄(멱등 검사는 직접 적은 기록만)
select public.log_money_in(3300000, date_trunc('month', public.kst_today())::date, 'salary');
select is((select count(*)::int from public.money_in where owner_user_id = auth.uid() and source = 'manual'), 1, '직접 적은 기록은 source = manual');
-- RLS: 앱은 자동 기록을 직접 못 넣고 내부 함수도 못 부름
select throws_ok($$ insert into public.money_in (space_id, owner_user_id, amount, received_on, kind, source)
    select space_id, id, 1000, public.kst_today(), 'salary', 'payday_auto' from public.app_user where id = auth.uid() $$,
  '42501', null, 'RLS: 직접 넣기 막힘');
select throws_ok(format('select public.pay_auto_income(%L)', current_setting('test.cur')), '42501', null, '내부 함수는 앱 역할이 못 부름');
reset role;

-- 지난 달(늦은 확인): 그 사이클 월급날 날짜로 넣음
select pg_temp.login_as('44444444-4444-4444-4444-444444444444');
set local role authenticated;
select public.check_pay_line(pg_temp.line(current_setting('test.prev')::uuid, 'fixed'), 'checked');
select is((select received_on from public.money_in where owner_user_id = auth.uid() and source = 'payday_auto'
    and received_on < date_trunc('month', public.kst_today())::date),
  (date_trunc('month', public.kst_today()) - interval '1 month')::date, '늦은 확인 → 지난 사이클 월급날 날짜');
select is((select late from public.pay_check_line where id = pg_temp.line(current_setting('test.prev')::uuid, 'fixed')), true, '늦은 확인 줄');
reset role;

-- 자동 줄의 자동 확인만으로는 안 넣음(2027년 목록)
select public.make_checklist((select space_id from public.app_user where id = '44444444-4444-4444-4444-444444444444'),
  '44444444-4444-4444-4444-444444444444', '2027-03-01');
update public.pay_check_line set auto = true, auto_due = '2027-03-26', state = 'wait'
  where checklist_id = pg_temp.cl('44444444-4444-4444-4444-444444444444', '2027-03-01') and kind = 'fixed';
select is(public.auto_confirm_due_lines('2027-03-26'), 1, '자동 줄이 나가는 날 자동 확인');
select is((select auto_income_at from public.pay_checklist where id = pg_temp.cl('44444444-4444-4444-4444-444444444444', '2027-03-01')), null,
  '자동 확인만으로는 수입 기록 안 넣음');

-- ── 찬우·예빈: 합쳐서 공동 목록 ──
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.couple_space set holiday_shift = false;
update public.app_user set nickname = '찬우', monthly_income = 3500000, payday = 1 where id = auth.uid();
select public.save_split(jsonb_build_array(jsonb_build_object('kind', 'fixed', 'amount', 680000),
  jsonb_build_object('kind', 'custom', 'name', '관리비', 'amount', 200000)), auth.uid());
select set_config('test.code', (select code from public.create_invite()), true);
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈', monthly_income = 2800000, payday = 1 where id = auth.uid();
select public.complete_join(jsonb_build_array(jsonb_build_object('kind', 'fixed', 'amount', 680000)));
reset role;
select public.set_salary_mode('joint');
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.split_lines_configure((select jsonb_agg(jsonb_build_object('id', l.id, 'in_checklist', true, 'auto_pay', false))
  from public.split_line l join public.salary_split s on s.id = l.split_id where s.owner_user_id is null));
reset role;
update public.salary_split set checklist_from = null where owner_user_id is null;
select public.make_checklist((select space_id from public.app_user where id = '11111111-1111-1111-1111-111111111111'),
  null, (date_trunc('month', public.kst_today()) - interval '1 month')::date);
select public.make_checklist((select space_id from public.app_user where id = '11111111-1111-1111-1111-111111111111'),
  null, public.kst_today());
select set_config('test.jprev', (select id::text from public.pay_checklist where owner_user_id is null
  and cycle_start < public.kst_today() order by cycle_start limit 1), true);
select set_config('test.jcur', (select id::text from public.pay_checklist where owner_user_id is null
  order by cycle_start desc limit 1), true);
select isnt(current_setting('test.jprev'), current_setting('test.jcur'), '공동 목록 둘(지난 달, 이번 달)');

-- 합쳐서: 예빈이 처음 확인해도 두 사람 모두 한 줄씩
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.check_pay_line((select l.id from public.pay_check_line l where l.checklist_id = current_setting('test.jprev')::uuid
  and l.kind = 'fixed' limit 1), 'checked');
reset role;
select results_eq(
  $$ select owner_user_id::text, amount, source from public.money_in where source = 'payday_auto'
     and owner_user_id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222') order by amount desc $$,
  $$ values ('11111111-1111-1111-1111-111111111111', 3500000::bigint, 'payday_auto'), ('22222222-2222-2222-2222-222222222222', 2800000::bigint, 'payday_auto') $$,
  '합쳐서: 공동 체크리스트를 처음 확인하면 두 사람 각자 한 줄(각자 월급)');
select is((select count(distinct received_on)::int from public.money_in where source = 'payday_auto'
  and owner_user_id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')), 1, '두 줄 모두 그 사이클 월급날');
-- 다시 확인해도 더 안 생김(찬우가 한 번 확인)
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.confirm_payday(current_setting('test.jprev')::uuid);
reset role;
select is((select count(*)::int from public.money_in where source = 'payday_auto'
  and owner_user_id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')), 2, '합쳐서도 멱등(두 줄 그대로)');
-- RLS: 합쳐서는 예빈이 찬우의 자동 월급 기록도 봄(직접 적은 기록은 공개 ‘모두’일 때만), 자기 것은 봄
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is((select count(*)::int from public.money_in where owner_user_id = '11111111-1111-1111-1111-111111111111'), 1,
  'RLS: 합쳐서는 파트너의 자동 월급 기록이 보임(수입 = 두 사람 합, 2026-11-23)');
select is((select count(*)::int from public.money_in where owner_user_id = '11111111-1111-1111-1111-111111111111' and source = 'manual'), 0,
  'RLS: 직접 적은 기록은 공개 단계대로');
select is((select count(*)::int from public.money_in where owner_user_id = auth.uid()), 1, '내 기록은 보임');
reset role;
-- 월급 0원인 사람은 안 넣음
update public.app_user set monthly_income = 0 where id = '22222222-2222-2222-2222-222222222222';
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.confirm_payday(current_setting('test.jcur')::uuid);
reset role;
select is((select count(*)::int from public.money_in where source = 'payday_auto' and owner_user_id = '22222222-2222-2222-2222-222222222222'), 1,
  '월급 0원인 사람은 이번 사이클에 안 넣음');
select is((select count(*)::int from public.money_in where source = 'payday_auto' and owner_user_id = '11111111-1111-1111-1111-111111111111'), 2,
  '월급이 있는 사람은 이번 사이클 한 줄 더');
select is((select count(*)::int from public.notification where kind::text like '%income%' or body like '%수입%'), 0, '자동 기록은 상대에게 알리지 않음');
select * from finish();
rollback;
