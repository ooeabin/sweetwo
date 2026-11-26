-- pgTAP: 새 기기 로그인 푸시는 로그인한 그 기기(세션)의 토큰을 빼고 보냄(2026-11-26, 14 ‘새 기기 로그인’).
-- 같은 세션 토큰 제외, 다른 세션 토큰 포함, 세션 없는 옛 토큰 포함. 다른 알림 종류는 모든 토큰으로.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao');
create function pg_temp.on_session(sid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111',
    'role', 'authenticated', 'session_id', sid)::text, true);
$$;

-- 세션 1(기존 기기), 세션 2(새로 로그인한 기기)에서 각각 토큰 등록
select pg_temp.on_session('aaaaaaaa-0000-0000-0000-000000000001');
set local role authenticated;
select public.complete_signup('kakao', 'chanwoo@example.com', false, 'v1');
select public.ensure_my_space();
select public.register_push_device('ios', 'apns-old-device-session-0001', '1.0.0');
reset role;
select pg_temp.on_session('aaaaaaaa-0000-0000-0000-000000000002');
set local role authenticated;
select public.register_push_device('android', 'fcm-new-device-session-0002', '1.0.0');
reset role;
-- 세션 id 없는 옛 토큰(이 변경 전에 등록)
insert into public.push_device (user_id, platform, token)
  values ('11111111-1111-1111-1111-111111111111', 'ios', 'apns-legacy-no-session-0003');
update public.app_user set quiet_start = 0, quiet_end = 0;

select is((select session_id from public.push_device where token = 'fcm-new-device-session-0002'),
  'aaaaaaaa-0000-0000-0000-000000000002', '등록할 때 지금 세션 id를 남김');

-- 세션 2에서 로그인 → 새 기기 알림 푸시는 세션 2 토큰을 뺌
select public.notify('11111111-1111-1111-1111-111111111111', null, 'new_device', '새 기기에서 로그인했어요',
  '본인이 아니면 바로 로그아웃해 주세요', '/new-device/aaaaaaaa-0000-0000-0000-000000000002', 'shield-warning', null,
  'login:aaaaaaaa-0000-0000-0000-000000000002');
create temp table sent as select * from public.claim_push(100, now());
select is((select count(*)::int from sent where token = 'fcm-new-device-session-0002'), 0,
  '로그인한 그 세션의 토큰으로는 안 보냄');
select is((select count(*)::int from sent where token = 'apns-old-device-session-0001'), 1,
  '다른 세션(기존 기기) 토큰으로는 보냄');
select is((select count(*)::int from sent where token = 'apns-legacy-no-session-0003'), 1,
  '세션 id 없는 옛 토큰으로는 보냄');

-- 다른 알림 종류는 그대로 모든 토큰으로
select public.notify('11111111-1111-1111-1111-111111111111', null, 'payday', '오늘은 월급날이에요', null,
  '/new-device/aaaaaaaa-0000-0000-0000-000000000002', 'calendar', null, 'pd1');
select is((select count(*)::int from public.claim_push(100, now())), 3, '다른 알림 종류는 모든 토큰으로');

-- 같은 토큰을 다른 세션에서 다시 등록하면 세션 id가 바뀜(그 세션 기준으로 뺌)
select pg_temp.on_session('aaaaaaaa-0000-0000-0000-000000000003');
set local role authenticated;
select public.register_push_device('android', 'fcm-new-device-session-0002', '1.0.1');
reset role;
select is((select session_id from public.push_device where token = 'fcm-new-device-session-0002'),
  'aaaaaaaa-0000-0000-0000-000000000003', '다른 세션에서 다시 등록하면 세션 id 갱신');
select public.notify('11111111-1111-1111-1111-111111111111', null, 'new_device', '새 기기에서 로그인했어요',
  '본인이 아니면 바로 로그아웃해 주세요', '/new-device/aaaaaaaa-0000-0000-0000-000000000003', 'shield-warning', null,
  'login:aaaaaaaa-0000-0000-0000-000000000003');
select results_eq($$ select token from public.claim_push(100, now()) order by token $$,
  $$ values ('apns-legacy-no-session-0003'), ('apns-old-device-session-0001') $$,
  '새로 로그인한 세션 3의 토큰만 빠짐');

select * from finish();
rollback;
