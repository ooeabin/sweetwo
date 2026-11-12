-- pgTAP: QA 10구간 알림(2026-11-12, 20261126090000). 찬우, 예빈
-- S10-02 D1 ‘금액만 보여 주기’ 저금 달성은 파트너에게 이름 없이 + W-02, S10-03 notification_sent 서버 이벤트,
-- S10-04 12시간 넘는 방해 금지 뒤에도 푸시, S10-06 메일 반송 → S-11b, S10-08 D3 관리 방식 변경 본문·링크
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.item(n text) returns uuid language sql as $$
  select id from public.goal where name = n and deleted_at is null order by created_at desc limit 1;
$$;
create function pg_temp.noti(u uuid, k text, ref text) returns text language sql as $$
  select title || ' | ' || target from public.notification
  where user_id = u and kind = k and dedupe like '%' || ref || '%' order by created_at desc limit 1;
$$;

-- 찬우: 각자 모드, 저금 둘(모두 보여 주기 ‘여행’, 금액만 보여 주기 ‘비밀’)
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
select public.start_checklist(auth.uid());
select set_config('test.code', (select code from public.create_invite()), true);
select public.add_saving_item('여행', 100000, 300000);
select public.add_saving_item('비밀', 100000, 300000);
update public.goal set visibility = 'amount' where id = pg_temp.item('비밀');
reset role;
select set_config('test.trip', pg_temp.item('여행')::text, true);
select set_config('test.secret', pg_temp.item('비밀')::text, true);
-- 모은 금액이 목표 금액에 닿음(체크 흉내)
update public.goal set start_saved = 300000 where id in (pg_temp.item('여행'), pg_temp.item('비밀'));

-- 예빈 합류(각자)
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
reset role;

-- S10-02 D1: 찬우 저금 달성
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is(public.achieve_goal(current_setting('test.secret')::uuid), true, '금액만 보여 주기 저금 달성');
select is(public.achieve_goal(current_setting('test.trip')::uuid), true, '모두 보여 주기 저금 달성');
reset role;
select is(pg_temp.noti('22222222-2222-2222-2222-222222222222', 'goal_achieved', current_setting('test.secret')),
  '개인 저금 목표 금액을 다 모았어요! | /salary?who=11111111-1111-1111-1111-111111111111',
  '금액만: 파트너에게는 이름 없이 “개인 저금 …” + W-02 그 사람 탭(D1)');
select is(pg_temp.noti('11111111-1111-1111-1111-111111111111', 'goal_achieved', current_setting('test.secret')),
  '비밀 목표 금액을 다 모았어요! | /salary/items/' || current_setting('test.secret') || '/achieved',
  '금액만: 주인 알림은 그대로(W-12)');
select is(pg_temp.noti('22222222-2222-2222-2222-222222222222', 'goal_achieved', current_setting('test.trip')),
  '여행 목표 금액을 다 모았어요! | /salary/items/' || current_setting('test.trip'),
  '모두 보여 주기: 파트너는 이름 + W-10 그대로');

-- S10-03 notification_sent(inapp): 알림 행마다 하나, type = kind
select is((select count(*)::int from public.server_event where name = 'notification_sent'
  and props->>'type' = 'goal_achieved' and props->>'channel' = 'inapp'), 4, '달성 알림 4개 → notification_sent inapp 4개');
select is((select count(*)::int from public.server_event e where e.name = 'notification_sent' and e.props->>'channel' = 'inapp'),
  (select count(*)::int from public.notification), '알림 행 수 = inapp 이벤트 수');
select is((select props->>'cap_scope' from public.server_event where name = 'notification_sent'
  and props->>'type' = 'goal_achieved' limit 1), 'in_cap', '상한 안 종류는 cap_scope in_cap');
-- 같은 dedupe면 다시 안 남김
select public.notify('22222222-2222-2222-2222-222222222222', null, 'new_device', '새 기기에서 로그인했어요', null, '/', 'shield-warning', null, 's10:dup');
select public.notify('22222222-2222-2222-2222-222222222222', null, 'new_device', '새 기기에서 로그인했어요', null, '/', 'shield-warning', null, 's10:dup');
select is((select count(*)::int from public.server_event where props->>'type' = 'new_device'), 1, '같은 dedupe 알림은 이벤트 하나');
select is((select props->>'cap_scope' from public.server_event where props->>'type' = 'new_device'), 'out_of_cap', '보안 알림은 out_of_cap');
-- ‘분석 수집’을 끄면 안 남김
update public.app_user set analytics_off = true where id = '22222222-2222-2222-2222-222222222222';
select public.notify('22222222-2222-2222-2222-222222222222', null, 'payday', '오늘은 월급날이에요', null, '/salary', 'calendar-check', null, 's10:off');
select is((select count(*)::int from public.server_event where props->>'type' = 'payday'
  and user_id = '22222222-2222-2222-2222-222222222222'), 0, '분석 수집 끔: 안 남김');
update public.app_user set analytics_off = false where id = '22222222-2222-2222-2222-222222222222';

-- S10-04: 방해 금지 19~9시(14시간). 20시 월급 전 확인 → 23시 미룸 → 다음 날 9시 보냄(13시간 뒤)
select is(public.noti_send_window(22::smallint, 8::smallint), interval '12 hours', '기본 방해 금지(10시간): 12시간');
select is(public.noti_send_window(19::smallint, 9::smallint), interval '15 hours', '19~9시: 방해 금지 길이 + 1시간');
update public.notification set pushed_at = now();
update public.app_user set quiet_start = 19, quiet_end = 9 where id = '11111111-1111-1111-1111-111111111111';
insert into public.push_device (user_id, platform, token) values ('11111111-1111-1111-1111-111111111111', 'ios', repeat('a', 64));
insert into public.notification (user_id, kind, title, target, dedupe, created_at)
values ('11111111-1111-1111-1111-111111111111', 'review_due', '9월 월급에서 체크 안 한 게 2개 있어요', '/salary/review', 's10:quiet', '2026-10-22 20:00+09');
select is((select count(*)::int from public.claim_push(100, '2026-10-22 23:00+09')), 0, '방해 금지 중에는 미룸');
select is((select count(*)::int from public.claim_push(100, '2026-10-23 09:00+09')), 1, '방해 금지가 끝나면(13시간 뒤) 보냄');
select is((select count(*)::int from public.server_event where name = 'notification_sent'
  and props->>'type' = 'review_due' and props->>'channel' = 'os'), 1, '푸시를 꺼내면 notification_sent os');

-- 대신 메일(보안 알림, 상한 밖): email 이벤트
update public.app_user set notify_email = 'yebin@example.com' where id = '22222222-2222-2222-2222-222222222222';
update public.notification set mailed_at = now();
select public.notify('22222222-2222-2222-2222-222222222222', null, 'new_device', '새 기기에서 로그인했어요', null, '/', 'shield-warning', null, 's10:mail');
select public.mail_missed_notifications();
select is((select count(*)::int from public.server_event where name = 'notification_sent'
  and props->>'type' = 'new_device' and props->>'channel' = 'email'), 1, '메일로 보내면 notification_sent email');

-- S10-06: 반송 알림 → S-11b 알림 이메일
select public.note_mail_event('yebin@example.com', 'bounce');
select is((select target from public.notification where kind = 'mail_bounced'), '/settings/me/email', '반송 알림은 S-11b');

-- S10-08 D3: 관리 방식 변경 본문, 합류 중 링크
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.set_salary_mode('joint');
reset role;
select is((select title || ' / ' || body || ' | ' || target from public.notification where kind = 'salary_mode'
  and user_id = '22222222-2222-2222-2222-222222222222'),
  '찬우님이 월급 관리 방식을 바꿨어요 / 다음 월급날부터 합쳐서 관리해요 | /salary?view=plan', '관리 방식 변경(D3)');
select is((select count(*)::int from pg_proc where proname = 'set_join_salary_mode'
  and pg_get_functiondef(oid) like '%다음 월급날부터 각자 관리해요%'
  and pg_get_functiondef(oid) like '%/salary?view=plan%'
  and pg_get_functiondef(oid) not like '%/salary/split%'), 1, '합류 중 관리 방식: 본문(D3), 링크 W-01');

select * from finish();
rollback;
