-- pgTAP: 모바일 푸시 기기 등록, 보낼 알림 꺼내기(설정·방해 금지), 메일로 대신 안 함
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', 'yebin@example.com', false, 'v1');
select public.register_push_device('android', 'fcm-token-shared-0001', '1.0.0');
reset role;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', 'chanwoo@example.com', false, 'v1');
select public.ensure_my_space();
select public.register_push_device('ios', 'apns0123456789abcdef0123456789abcdef', '1.0.0');
-- 같은 휴대폰에서 다른 계정으로 로그인하면 토큰이 그 사람 것으로 옮김
select public.register_push_device('android', 'fcm-token-shared-0001', '1.0.0');
select is((select count(*)::int from public.push_device), 2, '내 기기만 보임(옮겨 온 토큰 포함)');
select throws_ok($$ insert into public.push_device (user_id, platform, token)
  values (auth.uid(), 'ios', 'abcdefghijklmnop1234') $$, '42501', null, '직접 넣을 수 없음');
reset role;
select is((select count(*)::int from public.push_device where user_id = '22222222-2222-2222-2222-222222222222'), 0,
  '예빈 기기에서 토큰이 빠짐');

-- 보낼 알림: 월급날(plan) → 두 기기로, 한 번만
update public.app_user set quiet_start = 22, quiet_end = 8;
select public.notify('11111111-1111-1111-1111-111111111111', null, 'payday', '오늘은 월급날이에요', '체크리스트를 확인해 주세요',
  '/salary', 'calendar', null, 'p1');
select is((select count(*)::int from public.claim_push(100, '2026-10-25 03:00:00+00')), 2, '두 기기로(낮 12시)');
select is((select count(*)::int from public.claim_push(100, '2026-10-25 03:01:00+00')), 0, '한 번만');

-- 인앱만(silent)과 끈 묶음은 보내지 않음
select public.notify('11111111-1111-1111-1111-111111111111', null, 'partner_activity', '활동', null, '/notifications',
  null, null, 'p2');
update public.app_user set noti_prefs = '{"topics": {"money": {"push": false}}}'
  where id = '11111111-1111-1111-1111-111111111111';
select public.notify('11111111-1111-1111-1111-111111111111', null, 'matured', '만기됐어요', null, '/assets', null, null, 'p3');
select is((select count(*)::int from public.claim_push(100, '2026-10-25 03:02:00+00')), 0, '인앱만, 끈 묶음은 안 보냄');

-- 방해 금지(밤 11시)는 미뤘다가 끝나면, 새 기기 로그인(보안)은 바로
select public.notify('11111111-1111-1111-1111-111111111111', null, 'goal_achieved', '목표를 이뤘어요', null, '/goals',
  null, null, 'p4');
select is((select count(*)::int from public.claim_push(100, '2026-10-25 14:00:00+00')), 0, '방해 금지 시간에는 미룸');
select public.notify('11111111-1111-1111-1111-111111111111', null, 'new_device', '새 기기에서 로그인했어요', null,
  '/settings/security', null, null, 'p5');
select results_eq($$ select distinct title from public.claim_push(100, '2026-10-25 14:01:00+00') $$,
  $$ values ('새 기기에서 로그인했어요') $$, '보안 알림은 방해 금지 중에도');
select is((select count(*)::int from public.claim_push(100, '2026-10-25 23:30:00+00')), 2, '방해 금지가 끝나면(8시 반)');

-- 메일로 대신: 푸시 기기가 있으면 접속 신호가 없어도 메일 안 보냄
update public.notification set mailed_at = now();
select public.notify('11111111-1111-1111-1111-111111111111', null, 'payday', '월급날', null, '/salary', null, null, 'p6');
update public.notification set created_at = '2026-10-25 02:00:00+00' where dedupe = 'p6';
select is(public.mail_missed_notifications('2026-10-25 03:00:00+00'), 0, '푸시 기기가 있으면 메일로 대신 안 함');

select is(public.drop_push_tokens(array['apns0123456789abcdef0123456789abcdef']), 1, '받을 수 없는 토큰 지움');

select * from finish();
rollback;
