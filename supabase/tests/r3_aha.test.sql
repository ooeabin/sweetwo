-- pgTAP: 3차 검토 아하 순간(20261216090000). 합류 때 모은 금액 → 상대 같이 모으기에 바로 묶음(P-09),
-- 매달 ‘이번 달 우리 둘’ 카드·알림(H-14, month_us): 받는 사람, 날, 금액 가림, 일정, 용돈, 알림 종류 끄기
begin;
create extension if not exists pgtap with schema extensions;
select plan(37);
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- 찬우(시작한 사람, 25일, 각자), 예빈 합류(10일)
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '찬우', monthly_income = 3500000, payday = 25,
  onboarding_done_at = now() where id = auth.uid();
select public.save_split(jsonb_build_array(jsonb_build_object('kind', 'custom', 'name', '식비', 'category', 'living', 'in_checklist', false, 'amount', 880000)), auth.uid());
select set_config('test.cg', public.add_saving_item('결혼 비용', 500000, 30000000, null, 10000000)::text, true);
select set_config('test.code', (select code from public.create_invite()), true);
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈', monthly_income = 2700000, payday = 10 where id = auth.uid();
select public.complete_join(jsonb_build_array(
  jsonb_build_object('kind', 'custom', 'name', '식비', 'category', 'living', 'in_checklist', false, 'amount', 680000),
  jsonb_build_object('kind', 'allowance', 'amount', 300000)));
reset role;
delete from public.notification;

-- 1. 합류 때 모은 금액
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is((public.join_saving_offer()->>'goal_id')::uuid, current_setting('test.cg')::uuid, '묶을 곳 = 찬우 첫 저금');
select is(public.join_saving_offer()->>'name', '결혼 비용', '이름은 찬우 저금 이름');
select throws_ok('select public.join_saving_start(-1)', '22023', 'bad_amount', '음수 거절');
select set_config('test.r', public.join_saving_start(4000000)::text, true);
select is((select count(*)::int from public.goal where owner_user_id = auth.uid()), 1, '예빈 새 저금 하나');
select is((select start_saved from public.goal where owner_user_id = auth.uid()), 4000000::bigint, '시작할 때 모은 금액 = 넣은 금액');
select is((select bundle_id from public.goal where owner_user_id = auth.uid()),
  (current_setting('test.r')::jsonb->>'bundle_id')::uuid, '예빈 저금이 묶음에 듦');
select is((select (v->>'total')::bigint from jsonb_array_elements(public.bundle_view()) v), 14000000::bigint,
  '첫날 합계 = 찬우 1,000만 + 예빈 400만');
select is((select (v->>'pct')::int from jsonb_array_elements(public.bundle_view()) v), 46, '목표 금액 3,000만의 46%');
select is(public.join_saving_offer(), null, '이미 묶였으면 더 없음');
select throws_ok('select public.join_saving_start(1)', '22023', 'no_offer', '두 번은 안 됨');
reset role;
select is((select bundle_id from public.goal where id = current_setting('test.cg')::uuid),
  (current_setting('test.r')::jsonb->>'bundle_id')::uuid, '찬우 저금도 같은 묶음');
select results_eq($$ select member_a, member_b, target_amount from public.saving_bundle $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 30000000::bigint) $$,
  '구성원 a = 찬우, 목표 금액 = 찬우 저금 것');
select is((select title from public.notification where user_id = '11111111-1111-1111-1111-111111111111' and kind = 'bundle_changed'),
  '예빈님도 ‘결혼 비용’에 같이 모아요', '찬우에게 인앱 한 줄');
select is(public.noti_inapp_only('bundle_changed'), true, '푸시 없음');
select is((select count(*)::int from public.split_line l join public.salary_split s on s.id = l.split_id
  where s.owner_user_id = '22222222-2222-2222-2222-222222222222' and l.kind = 'saving'), 1, '예빈 월급 계획에 저금 줄');

-- 1-2. 찬우가 만든 들어갈 묶음이 있으면 그 묶음으로, ‘했어요만’이면 저금으로는 안 만듦
delete from public.goal where owner_user_id = '22222222-2222-2222-2222-222222222222';
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is(public.join_saving_offer()->>'bundle_id', current_setting('test.r')::jsonb->>'bundle_id', '찬우만 든 묶음이 먼저');
reset role;
update public.goal set bundle_id = null where id = current_setting('test.cg')::uuid;
update public.saving_bundle set status = 'closed';
update public.app_user set plan_share = 'done_only' where id = '11111111-1111-1111-1111-111111111111';
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is(public.join_saving_offer(), null, '찬우가 했어요만이면 저금으로 묶음을 만들지 않음');
reset role;
update public.app_user set plan_share = 'saving_only' where id = '11111111-1111-1111-1111-111111111111';
update public.couple_space set salary_mode = 'joint';
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is(public.join_saving_offer(), null, '합쳐서 엔진은 없음');
reset role;
update public.couple_space set salary_mode = 'separate';
-- 다시 묶어 둠(아래 카드용)
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select set_config('test.r2', public.join_saving_start(4000000)::text, true);
reset role;
update public.app_user set onboarding_done_at = now() where onboarding_done_at is null;

-- 2. 이번 달 우리 둘
insert into public.care_day (space_id, category, kind, name, date_rule, month, day, created_by)
  select space_id, 'family', 'birthday', '어머니 생신', 'solar_yearly', 12, 3, id from public.app_user where nickname = '찬우';
insert into public.care_day (space_id, category, kind, name, date_rule, month, day, created_by)
  select space_id, 'family', 'birthday', '먼 일정', 'solar_yearly', 3, 1, id from public.app_user where nickname = '찬우';
insert into public.care_day (space_id, category, kind, name, date_rule, month, day, secret, created_by)
  select space_id, 'couple', 'anniversary', '깜짝 일정', 'solar_yearly', 11, 30, true, id from public.app_user where nickname = '찬우';
select is(public.send_month_us('2026-11-25'), 0, '월급날 당일은 없음');
select is(public.send_month_us('2026-11-11'), 1, '예빈 월급날(10일) 다음 날 한 명');
select is((select user_id from public.month_us), '22222222-2222-2222-2222-222222222222'::uuid, '예빈 카드');
select results_eq($$ select month_key, saved_total, saved_delta, saving_count, care_count, allowance from public.month_us $$,
  $$ values ('2026-11'::text, 14000000::bigint, null::bigint, 1, 1, 300000::bigint) $$,
  '처음: 합계 1,400만(묶음 하나), 변화 없음, 30일 안 일정 1개(남의 비밀 일정 뺌), 용돈 30만');
select is((select care->0->>'name' from public.month_us), '어머니 생신', '일정 이름');
select is((select title || '/' || body from public.notification where kind = 'month_us'),
  '이번 달 우리 둘/모은 금액과 다가올 일정을 확인해 보세요', '알림 문구(금액 없음)');
select is(public.push_kind_key('month_us'), 'month_us', '알림 종류 키');
select is(public.send_month_us('2026-11-11'), 0, '같은 달 두 번 없음');
select is(public.send_month_us('2026-11-26'), 1, '찬우 월급날(25일) 다음 날');
-- 예빈 앱
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is((public.month_us_card('2026-11-12')->>'saved_total')::bigint, 14000000::bigint, '카드 읽기');
select is(public.month_us_card('2026-11-30'), null, '14일 지나면 없음');
select lives_ok(format('select public.dismiss_month_us(%L)', public.month_us_card('2026-11-12')->>'id'), '닫기');
select is(public.month_us_card('2026-11-12'), null, '닫으면 없음');
select throws_ok('select count(*) from public.month_us', '42501', null, '표는 직접 못 읽음');
reset role;
-- 다음 달: 변화(+), 했어요만이면 금액 가림, 알림 끈 사람은 카드만
update public.goal set start_saved = 5000000 where owner_user_id = '22222222-2222-2222-2222-222222222222';
update public.app_user set plan_share = 'done_only', push_kinds = '{"month_us": false}'
  where id = '22222222-2222-2222-2222-222222222222';
delete from public.notification;
select is(public.send_month_us('2026-12-11'), 1, '다음 달 예빈');
select is((select saved_delta from public.month_us where month_key = '2026-12' and user_id = '22222222-2222-2222-2222-222222222222'),
  1000000::bigint, '지난 카드보다 +100만');
select is((select count(*)::int from public.notification where kind = 'month_us'), 0, '알림 끈 사람은 알림 없음');
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is(public.month_us_card('2026-12-12')->>'saved_total', null, '했어요만이면 금액 가림');
reset role;
-- 같이 계열 관리하는 사람은 없음, 관리하지 않는 쪽만
update public.couple_space set salary_mode = 'joint', manager_user_id = '11111111-1111-1111-1111-111111111111';
select is(public.month_us_for('11111111-1111-1111-1111-111111111111'), false, '관리하는 사람은 받지 않음');
select * from finish();
rollback;
