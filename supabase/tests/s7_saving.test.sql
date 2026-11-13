-- pgTAP: QA 7구간 저금(2026-11-12, 20261123090000). 찬우, 예빈
-- D1 = A: 합쳐서 모드에서는 주인이 있는 저금도 두 사람 모두 고치고 체크(각자 모드 파트너 것은 보기만),
-- goal Realtime 발행(S7-02), 연결 해제 대기 중 바로 고치기 막기(S7-05)
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
-- v2.2 D1 첫 사이클 소급 없음(20261201090000): 이 테스트는 이번 사이클 목록이 필요해 월급 계획 시작일 제한을 풂
create function pg_temp.no_backdate() returns void language sql security definer as $$
  update public.salary_split set checklist_from = null;
$$;
create function pg_temp.item(n text) returns uuid language sql as $$
  select id from public.goal where name = n and deleted_at is null order by created_at desc limit 1;
$$;

-- Realtime 발행(발행이 있는 환경에서만)
select ok(
  not exists (select 1 from pg_publication where pubname = 'supabase_realtime')
  or exists (select 1 from pg_publication_tables
             where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'goal'),
  'goal은 Realtime 발행에 있음(S7-02)');

-- 찬우: 각자 모드 월급 계획 + 저금 둘(모두 보여 주기 ‘여행’, 금액만 보여 주기 ‘비밀’)
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '찬우', monthly_income = 3500000, payday = 25 where id = auth.uid();
select public.save_split(jsonb_build_array(
  jsonb_build_object('kind', 'fixed', 'amount', 880000),
  jsonb_build_object('kind', 'living', 'amount', 880000),
  jsonb_build_object('kind', 'allowance', 'amount', 350000)
), auth.uid());
select pg_temp.no_backdate();
select public.start_checklist(auth.uid());
select set_config('test.code', (select code from public.create_invite()), true);
select public.add_saving_item('여행', 500000, 1000000);
select public.add_saving_item('비밀', 100000);
update public.goal set visibility = 'all' where id = pg_temp.item('여행');
update public.goal set visibility = 'amount' where id = pg_temp.item('비밀');
reset role;
select set_config('test.trip', pg_temp.item('여행')::text, true);
select set_config('test.secret', pg_temp.item('비밀')::text, true);

-- 예빈 합류(각자): 찬우 저금은 보기만(서버도 거절)
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈', monthly_income = 2700000, payday = 10 where id = auth.uid();
select public.complete_join(jsonb_build_array(
  jsonb_build_object('kind', 'fixed', 'amount', 680000),
  jsonb_build_object('kind', 'living', 'amount', 680000),
  jsonb_build_object('kind', 'allowance', 'amount', 270000)
));
select throws_ok($$ select public.saving_item_keep(current_setting('test.trip')::uuid) $$, '42501', 'not_owner',
  '각자: 파트너 저금 달성 뒤 선택은 거절');
update public.goal set name = '예빈이 바꿈' where id = current_setting('test.trip')::uuid;
reset role;
select is((select name from public.goal where id = current_setting('test.trip')::uuid), '여행',
  '각자: 파트너 저금 이름 바로 고치기는 RLS가 막음');

-- 합쳐서로 바꿈: 찬우 저금은 주인(찬우) 그대로, 공동 월급 계획 줄
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
reset role; select public.set_salary_mode('joint'); set local role authenticated; -- 앱 역할은 못 부름(20261205090000)
reset role;
select is((select owner_user_id from public.goal where id = current_setting('test.trip')::uuid),
  '11111111-1111-1111-1111-111111111111'::uuid, '합쳐서: 각자일 때 만든 저금은 주인 그대로');

-- D1: 예빈도 고치고(이름, 목표 금액) 달성 뒤 선택·그만 모음까지
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select lives_ok($$ update public.goal set name = '여름 여행', target_amount = 600000
  where id = current_setting('test.trip')::uuid $$, '합쳐서: 파트너 저금도 바로 고침');
reset role;
select results_eq($$ select name, target_amount from public.goal where id = current_setting('test.trip')::uuid $$,
  $$ values ('여름 여행'::text, 600000::bigint) $$, '바뀐 값이 저장됨');
select is((select count(*)::int from public.partner_change where topic = 'goal'
  and ref_id = current_setting('test.trip')::uuid), 1, '같이 쓰는 저금이라 목표 금액 변경은 활동 기록(상대 알림)');
-- 체크로 목표 금액에 닿으면(방식을 바꾼 달은 옛 체크리스트 그대로라 줄을 바로 체크한 것으로) 예빈도 달성
update public.pay_check_line set state = 'checked', actual = 600000, checked_at = now(),
  checked_by = '22222222-2222-2222-2222-222222222222' where goal_id = current_setting('test.trip')::uuid;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is(public.achieve_goal(current_setting('test.trip')::uuid), true, '합쳐서: 파트너 저금 달성도 축하');
reset role;
select is((select target from public.notification where kind = 'goal_achieved'
  and user_id = '11111111-1111-1111-1111-111111111111'),
  '/salary/items/' || current_setting('test.trip') || '/achieved', '주인(찬우) 알림은 W-12');
select is((select target from public.notification where kind = 'goal_achieved'
  and user_id = '22222222-2222-2222-2222-222222222222'),
  '/salary/items/' || current_setting('test.trip') || '/achieved', '합쳐서 파트너(예빈) 알림도 W-12(D1)');
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select lives_ok($$ select public.saving_item_keep(current_setting('test.trip')::uuid) $$, '합쳐서: 파트너도 계속 모을게요');
select lives_ok($$ select public.saving_item_stop(current_setting('test.trip')::uuid) $$, '합쳐서: 파트너도 그만할게요');
select lives_ok($$ select public.saving_item_reopen(current_setting('test.trip')::uuid) $$, '되돌리기도');
-- 주인은 바꿀 수 없음(내 것으로 가져오기, 남에게 넘기기)
select throws_ok($$ update public.goal set owner_user_id = auth.uid() where id = current_setting('test.trip')::uuid $$,
  '42501', 'not_owner', '파트너 저금을 내 것으로 바꿀 수 없음');
select throws_ok($$ update public.goal set owner_user_id = null where id = current_setting('test.trip')::uuid $$,
  '42501', 'not_owner', '파트너 저금을 우리 둘 것으로 바꿀 수 없음');
-- ‘금액만 보여 주기’ 파트너 저금은 합쳐서여도 보기만(이름이 가려짐)
select throws_ok($$ select public.saving_item_stop(current_setting('test.secret')::uuid) $$, '42501', 'not_owner',
  '금액만 보여 주기 파트너 저금은 보기만');
update public.goal set name = '바꿈' where id = current_setting('test.secret')::uuid;
reset role;
select is((select name from public.goal where id = current_setting('test.secret')::uuid), '비밀',
  '금액만 보여 주기 파트너 저금은 RLS가 막음');

-- 다시 각자: 파트너 저금은 다시 보기만
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
reset role; select public.set_salary_mode('separate'); set local role authenticated; -- 앱 역할은 못 부름(20261205090000)
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
select throws_ok($$ select public.saving_item_stop(current_setting('test.trip')::uuid) $$, '42501', 'not_owner',
  '다시 각자: 파트너 저금은 보기만');
reset role;

-- S7-05 연결 해제 대기 중: 앱이 바로 고치기·지우기(휴지통) 거절, 공개 범위만은 그대로
update public.couple_space set couple_state = 'unlink_pending'
  where id = (select space_id from public.goal where id = current_setting('test.trip')::uuid);
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select throws_ok($$ update public.goal set name = '바꿈' where id = current_setting('test.trip')::uuid $$,
  '42501', 'unlink_pending', '해제 대기 중 이름 바로 고치기 거절');
select throws_ok($$ update public.goal set target_amount = 2000000 where id = current_setting('test.trip')::uuid $$,
  '42501', 'unlink_pending', '해제 대기 중 목표 금액 거절');
select throws_ok($$ update public.goal set deleted_at = now() where id = current_setting('test.trip')::uuid $$,
  '42501', 'unlink_pending', '해제 대기 중 휴지통 거절');
select lives_ok($$ update public.goal set visibility = 'amount' where id = current_setting('test.trip')::uuid $$,
  '해제 대기 중 공개 범위는 바꿀 수 있음');
select throws_ok($$ select public.saving_item_keep(current_setting('test.trip')::uuid) $$, '42501', 'unlink_pending',
  '해제 대기 중 함수도 거절(그대로)');
reset role;
-- 서버 함수 안(관리자·예약 작업)은 걸리지 않음
select lives_ok($$ update public.goal set name = '정리' where id = current_setting('test.trip')::uuid $$,
  '함수 주인(서버)은 그대로');

select * from finish();
rollback;
