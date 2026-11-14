-- pgTAP: v2.2 후속(20261208090000 계약 1·3·4·5). 공개 ‘했어요만’이면 상대가 저금 이름·목표 금액·모은 금액을
-- 어느 길로도 못 받음(goal 읽기, space_goals, goal_saved_sums, goal_move_public, goal_story, saving_note, partner_plan_view,
-- 달성 알림, 묶음), ‘저금만’은 그대로 보임. 자산 공개 첫 선택은 연결된 뒤에만, asset.quick, 순자산 = 앱 netWorthOf
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

-- 찬우(시작한 사람), 예빈(합류, 각자)
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '찬우', monthly_income = 3500000, payday = 25 where id = auth.uid();
select public.save_split(jsonb_build_array(jsonb_build_object('kind', 'fixed', 'amount', 680000)), auth.uid());
select set_config('test.code', (select code from public.create_invite()), true);
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈', monthly_income = 2700000, payday = 10 where id = auth.uid();
select public.complete_join(jsonb_build_array(jsonb_build_object('kind', 'fixed', 'amount', 680000)));
reset role;
delete from public.notification;
-- 예빈 저금 둘: 여행(목표 1,000만, 시작 300만), 결혼 비용(묶을 것, 목표 2,000만, 시작 500만). 찬우 결혼 비용(시작 1,000만)
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select set_config('test.yt', public.add_saving_item('여행', 200000, 10000000, null, 3000000)::text, true);
select set_config('test.yw', public.add_saving_item('결혼 비용', 300000, 20000000, null, 5000000)::text, true);
update public.app_user set plan_share = 'done_only' where id = auth.uid();
insert into public.saving_note (space_id, goal_id, name, amount)
  select space_id, current_setting('test.yt')::uuid, '항공권', 800000 from public.app_user where id = auth.uid();
reset role;
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select set_config('test.cw', public.add_saving_item('결혼 비용', 500000, 30000000, null, 10000000)::text, true);
reset role;
insert into public.goal_move (space_id, goal_id, kind, amount, created_by, reason_code)
  select space_id, current_setting('test.yt')::uuid, 'in', 100000, '22222222-2222-2222-2222-222222222222', 'fix'
  from public.app_user where id = '22222222-2222-2222-2222-222222222222';

-- 1. 했어요만: 찬우가 받는 것
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is((select count(*)::int from public.goal where id = current_setting('test.yt')::uuid), 0, 'goal 읽기(Realtime 포함): 행 없음');
select results_eq(format($$ select name, target_amount, start_saved, deadline from public.space_goals() where id = %L $$,
    current_setting('test.yt')),
  $$ values ('개인 저금'::text, null::bigint, 0::bigint, null::date) $$, 'space_goals: “개인 저금”, 금액·기한 없음');
select is((select count(*)::int from public.goal_saved_sums() where goal_id = current_setting('test.yt')::uuid), 0,
  'goal_saved_sums: 모은 금액 없음');
select is((select count(*)::int from public.goal_move_public where goal_id = current_setting('test.yt')::uuid), 0,
  'goal_move_public: 돈 움직임 없음');
select is((select count(*)::int from public.goal_move where goal_id = current_setting('test.yt')::uuid), 0,
  'goal_move 직접 읽기도 없음');
select is((select months from public.goal_story(current_setting('test.yt')::uuid)), 0, 'goal_story: 없음');
select is((select count(*)::int from public.saving_note where goal_id = current_setting('test.yt')::uuid), 0, '쓸 곳 메모 없음');
select results_eq($$ select l->>'kind', l->>'name', l->>'amount', l ? 'state'
    from jsonb_array_elements(public.partner_plan_view()->'lines') l order by l->>'goal_id' $$,
  $$ values ('saving'::text, null::text, null::text, true), ('saving', null, null, true) $$,
  'partner_plan_view: 저금 줄 이름·금액 없이 확인 여부 자리만');
reset role;
-- 예빈 자신은 그대로
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select results_eq(format($$ select name, target_amount from public.space_goals() where id = %L $$, current_setting('test.yt')),
  $$ values ('여행'::text, 10000000::bigint) $$, '주인은 그대로');
select is((select saved from public.goal_saved_sums() where goal_id = current_setting('test.yt')::uuid), 3100000::bigint,
  '주인 모은 금액 그대로');
reset role;
-- 달성 알림: 상대에게는 이름 없이
select public.goal_mark_achieved(current_setting('test.yt')::uuid, null);
select results_eq($$ select user_id, title, target from public.notification where kind = 'goal_achieved' order by user_id $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid, '개인 저금 목표 금액을 다 모았어요!',
             '/salary?who=22222222-2222-2222-2222-222222222222'),
            ('22222222-2222-2222-2222-222222222222'::uuid, '여행 목표 금액을 다 모았어요!',
             '/salary/items/' || current_setting('test.yt') || '/achieved') $$,
  '달성 알림: 상대는 “개인 저금” + W-01 파트너 탭');
delete from public.notification;
update public.goal set status = 'active', achieved_at = null where id = current_setting('test.yt')::uuid;

-- 2. 묶음: 예빈이 했어요만이면 둘 다 켜도 각자 금액 없음, 상대 묶인 저금 이름 없음, 합계·목표 금액은 그대로
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select set_config('test.b', public.bundle_create(current_setting('test.cw')::uuid)::text, true);
select public.bundle_set_visibility(current_setting('test.b')::uuid, true);
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.bundle_join(current_setting('test.b')::uuid, current_setting('test.yw')::uuid);
select public.bundle_set_visibility(current_setting('test.b')::uuid, true);
select results_eq($$ select (v->>'total')::bigint, (v->>'target')::bigint, v->>'partner', (v->>'show_each')::boolean
    from jsonb_array_elements(public.bundle_view()) v $$,
  $$ values (15000000::bigint, 50000000::bigint, null::text, false) $$, '했어요만인 예빈 화면도 상대 금액 없음(둘 다 같게)');
reset role;
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select results_eq($$ select (v->>'total')::bigint, (v->>'mine')::bigint, v->>'partner', (v->>'show_each')::boolean
    from jsonb_array_elements(public.bundle_view()) v $$,
  $$ values (15000000::bigint, 10000000::bigint, null::text, false) $$, '묶음: 합계는 보이고 각자 금액은 없음');
select is((select g->>'name' from jsonb_array_elements(public.bundle_view()) v, jsonb_array_elements(v->'goals') g
           where not (g->>'mine')::boolean), null, '묶음: 상대 저금 이름 없음');
select is((select count(*)::int from public.goal_saved_sums() where goal_id = current_setting('test.yw')::uuid), 0,
  '묶인 상대 저금 모은 금액 없음');
select is((select count(*)::int from public.goal where id = current_setting('test.yw')::uuid), 0, '묶인 상대 저금 행 없음');
select is(public.bundle_each_open(current_setting('test.b')::uuid), false, 'bundle_each_open 꺼짐');
reset role;

-- 3. ‘저금만’으로 바꾸면 다시 보임(이름·목표 금액·모은 금액·돈 움직임, 묶음 각자 금액)
update public.app_user set plan_share = 'saving_only' where id = '22222222-2222-2222-2222-222222222222';
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select results_eq(format($$ select name, target_amount from public.goal where id = %L $$, current_setting('test.yt')),
  $$ values ('여행'::text, 10000000::bigint) $$, '저금만: 저금 이름·목표 금액');
select is((select saved from public.goal_saved_sums() where goal_id = current_setting('test.yt')::uuid), 3100000::bigint,
  '저금만: 모은 금액');
select is((select count(*)::int from public.goal_move_public where goal_id = current_setting('test.yt')::uuid), 1,
  '저금만: 돈 움직임');
select is((select count(*)::int from public.saving_note where goal_id = current_setting('test.yt')::uuid), 1, '저금만: 쓸 곳 메모');
select ok((select bool_and(l->>'name' is not null and l->>'amount' is not null)
           from jsonb_array_elements(public.partner_plan_view()->'lines') l), '저금만: 줄 이름·금액');
select is((select (v->>'partner')::bigint from jsonb_array_elements(public.bundle_view()) v), 5000000::bigint,
  '저금만 + 둘 다 켬: 상대 금액');
reset role;
-- 묶인 상대 저금 돈 움직임(REST goal_move·goal_move_public): 각자 금액이 열려 있을 때만
insert into public.goal_move (space_id, goal_id, kind, amount, created_by, reason_code)
  select space_id, current_setting('test.yw')::uuid, 'in', 70000, '22222222-2222-2222-2222-222222222222', 'fix'
  from public.app_user where id = '22222222-2222-2222-2222-222222222222';
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is((select count(*)::int from public.goal_move_public where goal_id = current_setting('test.yw')::uuid), 1,
  '묶음 둘 다 켬: 상대 묶인 저금 돈 움직임 보임');
select public.bundle_set_visibility(current_setting('test.b')::uuid, false);
select is((select count(*)::int from public.goal_move where goal_id = current_setting('test.yw')::uuid), 0,
  '한 사람이 끄면: 상대 묶인 저금 돈 움직임 없음(REST goal_move)');
select is((select count(*)::int from public.goal_move_public where goal_id = current_setting('test.yw')::uuid), 0,
  '한 사람이 끄면: goal_move_public도 없음');
select public.bundle_set_visibility(current_setting('test.b')::uuid, true, true);
select is((select count(*)::int from public.goal_move_public where goal_id = current_setting('test.yw')::uuid), 0,
  '퍼센트만: 돈 움직임 없음');
select public.bundle_set_visibility(current_setting('test.b')::uuid, null, false);
reset role;

-- 4. 해제 대기: 상대 개인 저금은 행 없음(space_goals도)
update public.couple_space set couple_state = 'unlink_pending'
  where id = (select space_id from public.app_user where id = '11111111-1111-1111-1111-111111111111');
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is((select count(*)::int from public.space_goals() where owner_user_id = '22222222-2222-2222-2222-222222222222'), 0,
  '해제 대기: space_goals에 상대 저금 없음');
select is((select count(*)::int from public.goal_move_public where goal_id = current_setting('test.yt')::uuid), 0,
  '해제 대기: 돈 움직임 없음');
reset role;
update public.couple_space set couple_state = 'connected'
  where id = (select space_id from public.app_user where id = '11111111-1111-1111-1111-111111111111');

-- 5. 자산 공개 첫 선택: 연결된 뒤 첫 내 명의 자산이 기본값(계약 4), quick 열(계약 3)
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is((select asset_share_default from public.app_user where id = auth.uid()), null, '처음엔 없음');
insert into public.asset (space_id, side, grp, kind, name, amount, principal, owner, owner_user_id, visibility, quick)
  select space_id, 'asset', 'invest', 'stock', '투자', 8000000, 6000000, 'person', auth.uid(), 'sum', true
  from public.app_user where id = auth.uid();
select is((select asset_share_default::text from public.app_user where id = auth.uid()), 'sum', '연결된 뒤 첫 자산이 기본값');
select is((select quick from public.asset where name = '투자'), true, 'asset.quick 저장');
insert into public.asset (space_id, side, grp, kind, name, amount, owner, owner_user_id, visibility)
  select space_id, 'asset', 'cash', 'bank', '비상금', 1000000, 'person', auth.uid(), 'private' from public.app_user where id = auth.uid();
insert into public.asset (space_id, side, grp, kind, name, amount, owner, owner_user_id, visibility)
  select space_id, 'asset', 'cash', 'bank', '예빈 통장', 2000000, 'person', auth.uid(), 'all' from public.app_user where id = auth.uid();
select is((select quick from public.asset where name = '비상금'), false, 'quick 기본 false');
reset role;
-- 6. 순자산(찬우): 내 자산(내 숨기기 포함, 20261211130000 H3) + 예빈 ‘모두’ + 예빈 ‘총액만’ 합계, 예빈 ‘숨기기’ 빼고
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
insert into public.asset (space_id, side, grp, kind, name, amount, owner, owner_user_id, visibility)
  select space_id, 'asset', 'cash', 'bank', '찬우 통장', 5000000, 'person', auth.uid(), 'all' from public.app_user where id = auth.uid();
insert into public.asset (space_id, side, grp, kind, name, amount, owner, owner_user_id, visibility)
  select space_id, 'asset', 'cash', 'bank', '찬우 숨김', 9000000, 'person', auth.uid(), 'private' from public.app_user where id = auth.uid();
insert into public.asset (space_id, side, grp, kind, name, amount, owner)
  select space_id, 'debt', 'loan', 'credit', '공동 대출', 3000000, 'joint' from public.app_user where id = auth.uid();
select results_eq($$ select (r->>'assets')::bigint, (r->>'debts')::bigint, (r->>'net')::bigint, (r->>'principal_net')::bigint
    from public.networth_summary() r $$,
  $$ values (24000000::bigint, 3000000::bigint, 21000000::bigint, 19000000::bigint) $$,
  '순자산: 500만 + 내 숨김 900만 + 예빈 모두 200만 + 예빈 총액만 800만(원금 600만) − 대출 300만');
select is((select expected from public.net_worth_history(1)), 21000000::bigint, '월말 기록도 내 숨기기 포함, 예빈 숨기기 제외');
select is((select sum(total)::bigint from public.partner_asset_sums() where side = 'asset'), 8000000::bigint,
  '총액만 합계와 같은 행');
reset role;
-- 예빈이 보면 예빈 숨김 100만은 넣고 찬우 숨김 900만은 뺌(숨기기는 파트너에게만 안 보임)
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select results_eq($$ select (r->>'assets')::bigint, (r->>'net')::bigint from public.networth_summary() r $$,
  $$ values (16000000::bigint, 13000000::bigint) $$, '예빈 순자산: 내 숨김 포함, 찬우 숨김 제외');
reset role;

select * from finish();
rollback;
