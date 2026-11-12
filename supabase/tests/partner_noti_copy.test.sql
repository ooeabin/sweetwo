-- pgTAP: 파트너 알림 문구(2026-11-11 QA 3구간 S3-10, S3-29, 2026-11-12 QA 10구간 S10-01). 기획 14 표와 같은지, 호칭이 없으면 ‘파트너가’.
-- 찬우(호칭 있음), 예빈(호칭 없이 합류)
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
create function pg_temp.last(k text) returns text language sql as $$
  select title || ' / ' || coalesce(body, '') from public.notification where kind = k order by created_at desc, id desc limit 1;
$$;

-- 사용자에게 가는 파트너 알림 문구에 ‘목표’가 없음(2026-11-08 목표 개념 없앰)
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('notify_joined', 'notify_first_goal', 'request_unlink', 'cancel_unlink', 'finish_unlink',
                      'request_reconnect', 'answer_reconnect', 'cancel_account_deletion', 'account_deletion_for')
    and pg_get_functiondef(p.oid) ~ '''[^'']*목표[^'']*'''), 0, '파트너 알림 문구에 ‘목표’ 없음');

-- 찬우: 공간, 코드. 초대 리마인드(호칭 없음 → ‘파트너에게’)
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '찬우' where id = auth.uid();
select set_config('test.code', (select code from public.create_invite()), true);
reset role;
update public.invite set expires_at = now() + interval '3 days' where code = current_setting('test.code');
select public.send_morning_notifications();
select alike(pg_temp.last('invite_remind'), '% / 파트너에게 다시 보내 볼까요?', '리마인드: 호칭 없으면 ‘파트너에게’');

-- 예빈: 호칭 없이 합류
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
select public.finish_join();
reset role;
select is(pg_temp.last('partner_joined'), '파트너가 합류했어요 / 이제 월급과 저금을 같이 봐요', '합류(14)');

-- 예빈 해제 요청 → 취소 → 다시 요청 → 찬우 확인
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.request_unlink('연결 해제');
reset role;
select alike(pg_temp.last('unlink_requested'), '파트너가 연결 해제를 요청했어요 / %에 해제돼요. 먼저 내보낼 데이터가 있는지 확인해 주세요', '해제 요청(14)');
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.cancel_unlink();
select public.request_unlink('연결 해제');
reset role;
select is(pg_temp.last('unlink_cancelled'), '파트너가 연결 해제 요청을 취소했어요 / ', '해제 요청 취소(14)');
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.agree_unlink();
select is(pg_temp.last('unlink_confirmed'), '연결이 해제됐어요 / 30일 안에 다시 연결할 수 있어요', '해제 완료(14)');
reset role;

-- 다시 연결: 예빈 요청 → 찬우 수락
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is(public.my_reconnect_ok(), true, '30일 안이면 다시 연결 가능(S3-20)');
select public.request_reconnect();
reset role;
select is(pg_temp.last('reconnect_requested'), '파트너가 다시 연결하자고 해요 / 연결하면 해제 전 같이 쓰던 데이터가 돌아와요', '다시 연결 요청(14)');
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.answer_reconnect(true);
reset role;
select is(pg_temp.last('reconnected'), '찬우님과 다시 연결됐어요 / 해제 전 공동 데이터를 되살렸어요', '다시 연결됨(14)');

-- 2026-11-12 QA 10구간 S10-01: 파트너 변경 묶음·주간 요약·열람 알림도 호칭이 없으면 ‘파트너가’
insert into public.partner_change (space_id, actor_id, receiver_id, topic, field, noun, before_v, after_v, urgent, target, created_at)
select space_id, id, '11111111-1111-1111-1111-111111111111', 'split', f, '생활비', '880000', '1000000', true, '/salary?view=plan',
  now() - interval '11 minutes'
from public.app_user, unnest(array['amount', 'name']) f where id = '22222222-2222-2222-2222-222222222222';
select public.flush_partner_changes();
select alike(pg_temp.last('partner_change'), '파트너가 2가지를 바꿨어요 / % 외 1개', '변경 묶음(여럿): ‘파트너가’');
insert into public.partner_change (space_id, actor_id, receiver_id, topic, field, noun, before_v, after_v, urgent, target, created_at)
select space_id, id, '11111111-1111-1111-1111-111111111111', 'asset', 'amount', '전세 보증금', '200000000', '220000000', false, '/assets',
  now() - interval '11 minutes'
from public.app_user where id = '22222222-2222-2222-2222-222222222222';
select public.flush_partner_changes();
select alike(pg_temp.last('partner_activity'), '파트너가 자산을 바꿨어요 / %', '활동 기록(하나): ‘파트너가’');
select public.send_weekly_summary(public.kst_today() + 1);
select is((select title from public.notification where kind = 'weekly_summary'), '이번 주 파트너가 바꾼 게 3개 있어요', '주간 요약: ‘파트너가’');
select alike((select body_text from public.weekly_mail_body('11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222', public.kst_today() + 1)), '파트너가 바꾼 것%', '주간 메일 본문: ‘파트너가’');
-- 예빈 문의 → 운영자 열람 동의 → 찬우에게 파트너 열람 알림
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.create_inquiry('couple', '연결이 안 돼요', '{"app_version":"1.0.0","os":"ios"}');
reset role;
insert into public.access_request (inquiry_id, user_id, scope) select id, user_id, '{income_spend}' from public.inquiry;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.answer_access_request((select id from public.access_request), true);
reset role;
select alike(pg_temp.last('access_partner'), '운영자가 파트너 문의를 확인하고 있어요 / 파트너가 동의한 범위만, %까지 봐요', '열람 알림(파트너): ‘파트너’');

-- 첫 월급 계획 알림 본문(14)
select is((select count(*)::int from pg_proc where proname = 'notify_first_goal'
  and pg_get_functiondef(oid) like '%이제 월급 계획을 같이 볼 수 있어요%'), 1, '첫 월급 계획 본문(14)');

-- 상대 계정 삭제(호칭 없음 → ‘파트너가’), 복구 본문
select public.account_deletion_for('22222222-2222-2222-2222-222222222222');
select is(pg_temp.last('partner_deleted'), '파트너가 계정을 삭제했어요 / 같이 쓰던 데이터는 지웠어요', '상대 계정 삭제(14)');
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.cancel_account_deletion();
reset role;
select is(pg_temp.last('partner_restored'), '파트너가 계정 삭제를 취소했어요 / 30일 안에 다시 연결할 수 있어요', '계정 복구(14)');

-- 호칭이 있으면 그 이름
update public.app_user set nickname = '예빈' where id = '22222222-2222-2222-2222-222222222222';
select is((select count(*)::int from public.notification where title like '님이%'), 0, '“님이 …”로 시작하는 알림 없음');
select is((select count(*)::int from public.notification where title like '%파트너님%'), 0, '‘파트너님’ 없음');

select * from finish();
rollback;
