-- pgTAP: v2.2 같이 모으기 묶음(20261203090000 계약 4). 합계만 응답, 둘 다 켜야 각자 금액, 하나라도 퍼센트만이면 %,
-- 합쳐서 엔진 거절, 합계 기준 달성(둘 다 알림), 상대의 묶인 저금 모은 금액 가림
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);
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
-- 찬우 결혼 비용(목표 3,000만, 시작 1,000만), 예빈 결혼 비용(목표 2,000만, 시작 500만)
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select set_config('test.cg', public.add_saving_item('결혼 비용', 500000, 30000000, null, 10000000)::text, true);
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select set_config('test.yg', public.add_saving_item('결혼 비용', 300000, 20000000, null, 5000000)::text, true);
reset role;
select is((select owner_user_id from public.goal where id = current_setting('test.cg')::uuid),
  '11111111-1111-1111-1111-111111111111'::uuid, '각자 모드 저금은 주인 있음');

-- 1. 만들기: 내 저금만, 각자 엔진만
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select throws_ok(format('select public.bundle_create(%L)', current_setting('test.yg')), '42501', 'not_owner', '남의 저금으로 못 만듦');
select set_config('test.b', public.bundle_create(current_setting('test.cg')::uuid)::text, true);
select is((select target_amount from public.saving_bundle), 30000000::bigint, '처음 목표 금액 = 내 저금 목표 금액');
reset role;
select is((select title from public.notification where kind = 'bundle_created'), '찬우님 ‘결혼 비용’에 같이 모을까요?', '상대에게 권유(인앱)');
select is(public.noti_inapp_only('bundle_created'), true, '인앱만');
-- 예빈이 자기 저금을 넣음 → 목표 금액 = 두 목표 금액 합(Q11)
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select lives_ok(format('select public.bundle_join(%L, %L)', current_setting('test.b'), current_setting('test.yg')), '예빈 합류');
select is((select target_amount from public.saving_bundle), 50000000::bigint, '목표 금액 = 3,000만 + 2,000만');

-- 2. 기본: 합계만(각자 금액 없음), 상대 저금 모은 금액도 목록에서 가림
select results_eq($$ select (v->>'total')::bigint, (v->>'mine')::bigint, v->>'partner', (v->>'pct')::int
    from jsonb_array_elements(public.bundle_view()) v $$,
  $$ values (15000000::bigint, 5000000::bigint, null::text, 30) $$, '합계만(1,500만 / 5,000만 = 30%)');
select is((select count(*)::int from public.goal_saved_sums() where goal_id = current_setting('test.cg')::uuid), 0,
  '상대의 묶인 저금 모은 금액은 목록에 없음');
-- 3. 한 사람만 켜면 그대로
select public.bundle_set_visibility(current_setting('test.b')::uuid, true);
select is((select v->>'partner' from jsonb_array_elements(public.bundle_view()) v), null, '한 사람만 켜면 각자 금액 없음');
reset role;
-- 4. 둘 다 켜면 각자 금액
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.bundle_set_visibility(current_setting('test.b')::uuid, true);
select is((select (v->>'partner')::bigint from jsonb_array_elements(public.bundle_view()) v), 5000000::bigint, '둘 다 켜면 상대 금액');
select is((select saved from public.goal_saved_sums() where goal_id = current_setting('test.yg')::uuid), 5000000::bigint,
  '둘 다 켜면 상대 저금 모은 금액도');
-- 5. 하나라도 퍼센트만이면 둘 모두 %만
select public.bundle_set_visibility(current_setting('test.b')::uuid, null, true);
select results_eq($$ select v->>'total', v->>'target', v->>'mine', v->>'partner', (v->>'pct')::int
    from jsonb_array_elements(public.bundle_view()) v $$,
  $$ values (null::text, null::text, null::text, null::text, 30) $$, '퍼센트만(찬우 화면)');
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is((select v->>'total' from jsonb_array_elements(public.bundle_view()) v), null, '퍼센트만(예빈 화면도)');
reset role;
-- 목표 금액이 없으면 퍼센트만 못 고름
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.bundle_set_visibility(current_setting('test.b')::uuid, null, false);
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.bundle_set_visibility(current_setting('test.b')::uuid, null, false);

-- 6. 합계 기준 달성: 예빈이 3,500만 더함 → 합계 5,000만 → 둘 다 알림
select public.adjust_saving(current_setting('test.yg')::uuid, 35000000, 'fix');
reset role;
select is((select status from public.saving_bundle), 'achieved', '합계가 목표 금액에 닿으면 달성');
select is((select count(*)::int from public.notification where kind = 'bundle_achieved'), 2, '두 사람 모두 달성 알림');
select is(public.noti_inapp_only('bundle_achieved'), false, '달성은 푸시');
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is(public.achieve_bundle(current_setting('test.b')::uuid), true, '축하는 사람마다 한 번');
select is(public.achieve_bundle(current_setting('test.b')::uuid), false, '두 번째는 없음');
reset role;

-- 7. 합쳐서 엔진에서는 못 만듦
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.bundle_leave(current_setting('test.b')::uuid);
select is((select count(*)::int from public.goal where bundle_id is not null), 0, '풀면 저금은 각자에게');
select public.set_salary_mode('joint');
select throws_ok(format('select public.bundle_create(%L)', current_setting('test.cg')), '22023', 'joint_engine', '합쳐서 엔진은 거절');
reset role;

select * from finish();
rollback;
