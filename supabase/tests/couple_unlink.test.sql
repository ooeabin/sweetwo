-- pgTAP: 연결 해제 요청(S-12c)과 요청 취소. 찬우(시작, 요청), 예빈(합류)
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select is(public.unlink_share(24000000, 58), 13920000::bigint, '기본 몫 2,400만 × 58% = 1,392만');
select is(public.unlink_share(1234567, 50), 620000::bigint, '1만 원 단위 반올림');
select is(public.unlink_share(4000, 50), 0::bigint, '1만 원 미만은 0');

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '찬우', monthly_income = 3500000;
select throws_ok($$ select public.request_unlink('{}', '연결 해제') $$, '42501', 'not_connected', '미합류는 해제 요청 없음');
select set_config('test.code', (select code from public.create_invite()), true);
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈', monthly_income = 2500000;
select public.finish_join();
reset role;

update public.couple_space set split_mode = 'income';
insert into public.asset (space_id, side, grp, kind, name, amount, owner)
  select space_id, 'asset', 'cash', 'bank', '공동 적금', 24000000, 'joint'
  from public.app_user where id = '11111111-1111-1111-1111-111111111111';
insert into public.asset (space_id, side, grp, kind, name, amount, owner)
  select space_id, 'asset', 'cash', 'bank', '비상금 통장', 3000000, 'joint'
  from public.app_user where id = '11111111-1111-1111-1111-111111111111';
insert into public.asset (space_id, side, grp, kind, name, amount, owner, owner_user_id)
  select space_id, 'asset', 'cash', 'bank', '찬우 적금', 5000000, 'person', id
  from public.app_user where id = '11111111-1111-1111-1111-111111111111';
select set_config('test.emg', (select id::text from public.asset where name = '비상금 통장'), true);

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select throws_ok($$ select public.request_unlink('{}', '연결해제') $$, 'P0001', 'confirm_mismatch', '“연결 해제”와 다르면 거절');
select throws_ok(
  format($$ select public.request_unlink('{"%s": 3000001}', '연결 해제') $$, current_setting('test.emg')),
  '22023', null, '몫이 금액보다 크면 거절');
select lives_ok(
  format($$ select public.request_unlink('{"%s": 1000000}', '연결 해제') $$, current_setting('test.emg')),
  '해제 요청');
select is((select couple_state::text from public.couple_space), 'unlink_pending', '해제 대기');
select results_eq(
  $$ select ratio::int, deadline = public.kst_today() + 14, jsonb_array_length(plan) from public.couple_unlink $$,
  $$ values (58, true, 2) $$, '버는 만큼 58%, 기한 14일 뒤, 공동 자산 2개');
select results_eq(
  $$ select e->>'name', (e->>'mine')::bigint from public.couple_unlink, jsonb_array_elements(plan) e order by 1 $$,
  $$ values ('공동 적금', 13920000::bigint), ('비상금 통장', 1000000::bigint) $$, '기본 몫과 고친 몫');
select throws_ok($$ select public.propose('base_day', '{"base_day":25,"base_day_last":false}', current_date + 3) $$,
  '42501', null, '해제 대기 중에는 제안 멈춤');
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is((select title from public.notification), '찬우님이 연결 해제를 요청했어요', '상대에게 요청 알림');
select throws_ok($$ select public.cancel_unlink() $$, '42501', 'not_requester', '상대는 취소 못 함');
select throws_ok($$ insert into public.couple_unlink (space_id, requested_by, deadline, ratio, plan)
  select space_id, id, current_date, 50, '[]' from public.app_user where id = auth.uid() $$,
  '42501', null, '직접 못 넣는다');
reset role;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.cancel_unlink();
select results_eq(
  $$ select (select couple_state::text from public.couple_space), (select status from public.couple_unlink) $$,
  $$ values ('connected', 'cancelled') $$, '취소하면 연결로 복귀');
reset role;
select is(
  (select title from public.notification where kind = 'unlink_cancelled'),
  '찬우님이 연결 해제 요청을 취소했어요', '상대에게 취소 알림');

select * from finish();
rollback;
