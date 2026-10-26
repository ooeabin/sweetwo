-- pgTAP: 메일로 대신(데스크톱 접속 신호 없음), 상한 밖은 바로, 방해 금지는 미룸, 계정 삭제 접수 메일, 새 기기 로그인(14)
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email, last_sign_in_at) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com', now());
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao');
select set_config('request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
reset role;
update public.app_user set quiet_start = 22, quiet_end = 8;

-- 오후 3시(KST): 20분 전 알림, 접속 신호 없음 → 메일
insert into public.notification (user_id, kind, title, body, target, dedupe, created_at)
  values ('11111111-1111-1111-1111-111111111111', 'payday', '오늘은 월급날이에요', '분배표대로 보내고 체크해 주세요', '/salary', 'n1',
          '2027-03-25 05:40:00+00');
select is(public.mail_missed_notifications('2027-03-25 06:00:00+00'), 1, '접속 없으면 메일로 대신');
select is((select subject from public.mail_outbox where dedupe like 'noti:%'), '오늘은 월급날이에요', '알림 제목 그대로');

-- 접속 신호가 있으면 안 보냄
update public.app_user set app_seen_at = '2027-03-25 05:55:00+00';
insert into public.notification (user_id, kind, title, target, dedupe, created_at)
  values ('11111111-1111-1111-1111-111111111111', 'payday', '두 번째', '/salary', 'n2', '2027-03-25 05:56:00+00');
update public.app_user set app_seen_at = '2027-03-25 05:58:00+00';
select is(public.mail_missed_notifications('2027-03-25 06:10:00+00'), 0, '데스크톱이 켜져 있으면 메일 없음');

-- 밤 11시(KST)는 방해 금지: 미룸. 상한 밖(연결 해제 요청)은 바로
update public.app_user set app_seen_at = null;
insert into public.notification (user_id, kind, title, target, dedupe, created_at) values
  ('11111111-1111-1111-1111-111111111111', 'review_due', '월말 확인', '/salary/review', 'n3', '2027-03-25 13:30:00+00'),
  ('11111111-1111-1111-1111-111111111111', 'unlink_requested', '연결 해제 요청', '/settings/couple', 'n4', '2027-03-25 13:55:00+00');
select is(public.mail_missed_notifications('2027-03-25 14:00:00+00'), 1, '방해 금지면 상한 밖(연결 해제 요청)만 바로');
select is((select count(*)::int from public.notification where dedupe = 'n3' and mailed_at is null), 1, '월말 확인은 미룸');

-- 계정 삭제 접수 메일
select set_config('request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
set local role authenticated;
select public.request_account_deletion();
reset role;
select is((select count(*)::int from public.mail_outbox where kind = 'deletion_requested' and not capped), 1,
  '계정 삭제 접수 메일(상한 밖)');

-- 새 기기 로그인: 다른 세션이 있으면 알림
update public.app_user set status = 'active', deletion_requested_at = null;
insert into auth.sessions (id, user_id, created_at, updated_at, user_agent) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', now() - interval '1 day', now(), 'Mac'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', now(), now(), 'Phone');
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111',
  'role', 'authenticated', 'session_id', 'aaaaaaaa-0000-0000-0000-000000000002')::text, true);
set local role authenticated;
select is(public.note_login(), true, '새 기기 로그인 알림');
reset role;
select is((select target from public.notification where kind = 'new_device'),
  '/new-device/aaaaaaaa-0000-0000-0000-000000000002', '새 기기 알림은 나예요 / 내가 아니에요 화면으로');

select * from finish();
rollback;
