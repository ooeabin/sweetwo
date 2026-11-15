-- pgTAP: 5차 검토 묶음 B(20261218090000). B1 이번 달 우리 둘 날(앞당긴 월급날 다음 날), B3 쓸 곳 메모 D-7,
-- B4 분담 ‘좋아요’ 뒤 줄어든 줄 알림, B5 혼자 쓰다 연결할 때 자산 공개 한 번 묻기
begin;
create extension if not exists pgtap with schema extensions;
select plan(35);
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
insert into public.holiday (date, name) values ('2026-12-25', '성탄절'), ('2027-01-01', '1월 1일')
  on conflict (date) do nothing;

-- 찬우(시작한 사람, 25일, 각자): 혼자일 때 내 명의 자산 둘(‘모두’ 하나, ‘총액만’ 하나)
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '찬우', monthly_income = 3500000, payday = 25,
  onboarding_done_at = now() where id = auth.uid();
select public.save_split(jsonb_build_array(jsonb_build_object('kind', 'living', 'amount', 880000)), auth.uid());
select set_config('test.cg', public.add_saving_item('결혼 비용', 500000, 30000000, null, 0)::text, true);
insert into public.asset (space_id, side, grp, kind, name, amount, owner, owner_user_id)
  select space_id, 'asset', 'deposit', 'saving', '찬우 적금', 5000000, 'person', id from public.app_user where id = auth.uid();
insert into public.asset (space_id, side, grp, kind, name, amount, owner, owner_user_id, visibility)
  select space_id, 'asset', 'deposit', 'saving', '찬우 예금', 1000000, 'person', id, 'sum' from public.app_user where id = auth.uid();
select set_config('test.code', (select code from public.create_invite()), true);
reset role;
select is((select visibility::text from public.asset where name = '찬우 적금'), 'all', '연결 전에는 그대로 모두');

-- 예빈 합류(10일)
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈', monthly_income = 2700000, payday = 10 where id = auth.uid();
select public.complete_join(jsonb_build_array(jsonb_build_object('kind', 'living', 'amount', 680000)));
reset role;
update public.app_user set onboarding_done_at = now() where onboarding_done_at is null;
delete from public.notification;

-- ─── B5 연결할 때 자산 공개 ───
select results_eq($$ select name, visibility::text, share_pending from public.asset order by name $$,
  $$ values ('찬우 예금'::text, 'sum'::text, false), ('찬우 적금', 'private', true) $$,
  '연결 순간 모두 자산만 숨기고 묻기 표시');
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is((select count(*)::int from public.asset where name = '찬우 적금'), 0, '예빈은 고르기 전 찬우 적금을 못 봄');
reset role;
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is(public.answer_asset_share('sum'), 1, '고른 값으로 한 개');
select results_eq($$ select visibility::text, share_pending from public.asset where name = '찬우 적금' $$,
  $$ values ('sum'::text, false) $$, '총액만 + 묻기 끝');
select is((select asset_share_default::text from public.app_user where id = auth.uid()), 'sum', '기본값도 고른 값');
select is(public.answer_asset_share('all'), 0, '두 번째는 바꿀 것 없음');
select is((select visibility::text from public.asset where name = '찬우 적금'), 'sum', '두 번째 답은 자산을 안 바꿈');
reset role;
-- 이미 고른 사람은 다음 연결에서 숨기지 않음(트리거만 확인)
update public.asset set visibility = 'all' where name = '찬우 적금';
update public.couple_space set couple_state = 'not_joined';
update public.couple_space set couple_state = 'connected';
select is((select visibility::text from public.asset where name = '찬우 적금'), 'all', '기본값이 있으면 그대로');

-- ─── B1 이번 달 우리 둘 날 ───
select is(public.send_month_us('2026-11-25'), 0, '월급날 당일은 없음');
select is(public.send_month_us('2026-11-26'), 1, '찬우 11월 25일(수) 다음 날');
select is(public.send_month_us('2026-12-25'), 1, '12월 25일(공휴일) → 24일로 앞당긴 월급날 다음 날 25일');
select results_eq($$ select month_key, sent_on from public.month_us
  where user_id = '11111111-1111-1111-1111-111111111111' and sent_on = '2026-12-25' $$,
  $$ values ('2026-12'::text, '2026-12-25'::date) $$, '달 키 = 그 월급날의 달');
select is(public.send_month_us('2026-12-26'), 0, '원래 날 다음 날(26일)은 없음');
update public.couple_space set holiday_shift = false;
delete from public.month_us where sent_on = '2026-12-25';
select is(public.send_month_us('2026-12-25'), 0, '앞당기기를 끄면 25일 아님');
select is(public.send_month_us('2026-12-26'), 1, '앞당기기를 끄면 원래 날 다음 날');
update public.couple_space set holiday_shift = true;
-- 예빈 1일 월급: 2027-01-01(공휴일) → 2026-12-31로 앞당김, 다음 날 1월 1일 = 1월 몫
update public.app_user set payday = 1 where id = '22222222-2222-2222-2222-222222222222';
select is(public.send_month_us('2026-12-02'), 1, '12월 1일(화) 다음 날');
select is(public.send_month_us('2027-01-01'), 1, '전 달 말일로 앞당긴 1월 월급날 다음 날');
select is((select month_key from public.month_us where user_id = '22222222-2222-2222-2222-222222222222' and sent_on = '2027-01-01'),
  '2027-01', '달 키 = 원래 달(12월 카드와 겹치지 않음)');
select is((select count(*)::int from public.notification where kind = 'month_us'
  and dedupe = 'month_us:22222222-2222-2222-2222-222222222222:2027-01'), 1, '알림 중복 키도 그 달');
-- 날짜 없는 사람: 매달 1일
update public.app_user set payday_none = true where id = '22222222-2222-2222-2222-222222222222';
select is(public.send_month_us('2027-03-02'), 0, '날짜 없으면 1일만');
select is(public.send_month_us('2027-03-01'), 1, '날짜 없는 사람 1일');
select is((select month_key from public.month_us where user_id = '22222222-2222-2222-2222-222222222222' and sent_on = '2027-03-01'),
  '2027-02', '달 키 = 전날의 달');

-- ─── B3 쓸 곳 메모 D-7 ───
delete from public.notification;
insert into public.saving_note (space_id, goal_id, name, amount, due_on)
  select space_id, id, '예식장 잔금', 3000000, '2026-12-03' from public.goal where id = current_setting('test.cg')::uuid;
insert into public.saving_note (space_id, goal_id, name, due_on, paid)
  select space_id, id, '낸 메모', '2026-12-03', true from public.goal where id = current_setting('test.cg')::uuid;
select is(public.send_note_reminders('2026-11-25'), 0, 'D-8은 없음');
select is(public.send_note_reminders('2026-11-26'), 1, 'D-7 한 번(주인 있는 저금 = 주인, 낸 메모 뺌)');
select results_eq($$ select user_id, title, body, target, kind from public.notification where kind = 'saving_note_due' $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid, '12월 3일 예식장 잔금이에요'::text, null::text,
             '/salary/items/' || current_setting('test.cg') || '/notes', 'saving_note_due'::text) $$,
  '문구·이동(W-14)');
select is(public.send_note_reminders('2026-11-26'), 1, '다시 불러도 알림은 하나(중복 키)');
select is((select count(*)::int from public.notification where kind = 'saving_note_due'), 1, '알림 하나');
select is(public.push_kind_key('saving_note_due'), 'care', '경조사와 같이 켬·끔');
update public.goal set owner_user_id = null where id = current_setting('test.cg')::uuid;
delete from public.notification;
select is(public.send_note_reminders('2026-11-26'), 2, '주인 없는 저금은 두 사람');

-- ─── B4 분담 ‘좋아요’ 뒤 줄어든 줄 ───
update public.app_user set payday_none = false, payday = 10 where id = '22222222-2222-2222-2222-222222222222';
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select set_config('test.s1', public.propose_split('생활비 통장', 1000000, 'half')::text, true);
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is(public.answer_split(current_setting('test.s1')::uuid, true), 'accepted', '좋아요');
reset role;
select is((select body from public.notification where kind = 'split_result'), '통장에 넣는 만큼 생활비를 줄였어요',
  '찬우 생활비 88만 → 38만: 결과 알림에 한 줄');
select is((select l.amount from public.split_line l join public.salary_split s on s.id = l.split_id
  where s.owner_user_id = '11111111-1111-1111-1111-111111111111' and l.kind = 'living'), 380000::bigint, '줄어든 생활비');
delete from public.notification;
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select set_config('test.s2', public.propose_split('데이트 통장', 200000, 'half')::text, true);
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is(public.answer_split(current_setting('test.s2')::uuid, false), 'declined', '지금처럼');
reset role;
select is((select body from public.notification where kind = 'split_result'), null, '거절이면 본문 없음');

select * from finish();
rollback;
