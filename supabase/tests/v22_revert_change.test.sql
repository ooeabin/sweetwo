-- pgTAP: ‘이전 값으로 돌리기’(20261210090000, 14 N-01·N-02, 08 4장, R-08).
-- 찬우(시작)·예빈(합류) 합쳐서 엔진. 예빈이 공동 저금·공동 월급 계획을 고치면 찬우가 받은 알림에서 돌림
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.flush() returns integer language sql as $$
  select public.flush_partner_changes(now() + interval '11 minutes');
$$;
-- 받은 사람의 가장 최근 변경 알림
create function pg_temp.last_noti(p_user uuid) returns uuid language sql as $$
  select id from public.notification where user_id = p_user and kind in ('partner_change', 'partner_activity')
    and dedupe like 'pc:%' order by created_at desc, dedupe desc limit 1;
$$;
create function pg_temp.can(p_noti uuid) returns boolean language plpgsql as $$
declare
  r boolean;
begin
  perform pg_temp.login_as('11111111-1111-1111-1111-111111111111');
  set local role authenticated;
  r := p_noti in (select public.revertible_notifications());
  reset role;
  return r;
end;
$$;

-- 찬우 공간 + 예빈 합류, 합쳐서(둘이 같이)
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '찬우', monthly_income = 3500000, payday = 25 where id = auth.uid();
select set_config('test.code', (select code from public.create_invite()), true);
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈', monthly_income = 2700000, payday = 10 where id = auth.uid();
select public.complete_join(jsonb_build_array(jsonb_build_object('kind', 'allowance', 'amount', 300000)));
reset role;
select set_config('test.sp', (select space_id::text from public.app_user where id = '11111111-1111-1111-1111-111111111111'), true);
update public.couple_space set salary_mode = 'joint', couple_state = 'connected' where id = current_setting('test.sp')::uuid;
insert into public.goal (id, space_id, template, name, kind, priority, target_amount)
  values ('a0000000-0000-0000-0000-000000000001', current_setting('test.sp')::uuid, 'home', '내 집 마련', 'once', 1, 100000000);
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.save_split('[{"kind":"fixed","amount":680000},{"kind":"living","amount":880000}]'::jsonb, null);
reset role;
delete from public.partner_change;
delete from public.notification;

-- 1. 예빈이 공동 저금 목표 금액을 바꿈 → 찬우 알림 → 돌릴 수 있음
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
update public.goal set target_amount = 120000000 where id = 'a0000000-0000-0000-0000-000000000001';
select results_eq($$ select before_raw, after_raw from public.partner_change where field = 'amount' $$,
  $$ values ('100000000'::jsonb, '120000000'::jsonb) $$, '원래 값 열(jsonb)');
select ok(pg_temp.flush() >= 1, '알림 보냄');
select set_config('test.n1', pg_temp.last_noti('11111111-1111-1111-1111-111111111111')::text, true);
select ok(pg_temp.can(current_setting('test.n1')::uuid), '돌릴 수 있는 알림');
-- 예빈(남의 알림)은 못 돌림
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select throws_ok(format($$ select public.revert_partner_change(%L) $$, current_setting('test.n1')), '42501', 'no_notification',
  '남의 알림은 못 돌림');
reset role;
delete from public.notification where user_id = '22222222-2222-2222-2222-222222222222';
-- 찬우 돌리기
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is(public.revert_partner_change(current_setting('test.n1')::uuid), 1, '1개 돌림');
reset role;
select is((select target_amount from public.goal where id = 'a0000000-0000-0000-0000-000000000001'), 100000000::bigint,
  '목표 금액이 원래 값으로');
select ok((select bool_and(reverted_at is not null and reverted_by = '11111111-1111-1111-1111-111111111111')
  from public.partner_change where actor_id = '22222222-2222-2222-2222-222222222222'), '돌렸다고 기록');
select results_eq($$ select title, body from public.notification where user_id = '22222222-2222-2222-2222-222222222222' $$,
  $$ values ('찬우님이 이전 값으로 돌렸어요', '내 집 마련') $$, '바꾼 사람에게 알림 1건');
-- 돌리면서 남긴 기록은 다시 알리지 않음
select is((select count(*)::int from public.partner_change where actor_id = '11111111-1111-1111-1111-111111111111' and sent_at is null),
  0, '돌린 기록은 보낸 것으로');
select is(pg_temp.flush(), 0, '같은 변경 알림 두 번 없음');
select ok(not pg_temp.can(current_setting('test.n1')::uuid), '한 번 돌리면 끝');
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select throws_ok(format($$ select public.revert_partner_change(%L) $$, current_setting('test.n1')), '22023', 'not_revertible',
  '다시 돌리기 거절');
reset role;

-- 2. 그 뒤 또 바뀌면(누가 바꿨든) 돌리지 않음
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
update public.goal set deadline = '2028-05-01' where id = 'a0000000-0000-0000-0000-000000000001';
select pg_temp.flush();
select set_config('test.n2', pg_temp.last_noti('11111111-1111-1111-1111-111111111111')::text, true);
select ok(pg_temp.can(current_setting('test.n2')::uuid), '기한 변경 돌릴 수 있음');
update public.goal set deadline = '2029-05-01' where id = 'a0000000-0000-0000-0000-000000000001';
select ok(not pg_temp.can(current_setting('test.n2')::uuid), '그 뒤 또 바뀌면 못 돌림');

-- 3. 공동 월급 계획 줄 금액(save_split) → 돌리면 줄 금액이 원래대로 + 확인 목록 맞춤
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.save_split('[{"kind":"fixed","amount":700000},{"kind":"living","amount":880000}]'::jsonb, null);
reset role;
select pg_temp.flush();
select set_config('test.n3', pg_temp.last_noti('11111111-1111-1111-1111-111111111111')::text, true);
select ok(pg_temp.can(current_setting('test.n3')::uuid), '월급 계획 줄 금액 돌릴 수 있음');
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is(public.revert_partner_change(current_setting('test.n3')::uuid), 1, '줄 하나 돌림');
reset role;
select is((select l.amount from public.split_line l join public.salary_split s on s.id = l.split_id
  where s.owner_user_id is null and l.kind = 'fixed'), 680000::bigint, '고정지출 원래 금액');

-- 4. 원래 값이 없는 예전 기록, 해제 대기 중에는 돌리지 않음
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
update public.goal set name = '우리 집' where id = 'a0000000-0000-0000-0000-000000000001';
select pg_temp.flush();
select set_config('test.n4', pg_temp.last_noti('11111111-1111-1111-1111-111111111111')::text, true);
update public.couple_space set couple_state = 'unlink_pending' where id = current_setting('test.sp')::uuid;
select ok(not pg_temp.can(current_setting('test.n4')::uuid), '해제 대기 중에는 못 돌림');
update public.couple_space set couple_state = 'connected' where id = current_setting('test.sp')::uuid;
update public.partner_change set before_raw = null where field = 'name';
select ok(not pg_temp.can(current_setting('test.n4')::uuid), '원래 값이 없는 기록은 못 돌림');

select * from finish();
rollback;
