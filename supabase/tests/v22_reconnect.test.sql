-- pgTAP: v2.2 다시 연결(20261204090000 계약 4·5). 복구 없는 새 연결 요청, 7일에 1번, ‘다시 받지 않기’면 조용히,
-- 수락하면 요청한 사람 공간 초대 코드, 잠금 화면 문구 가림
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'other@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao'),
  ('kakao-o', '33333333-3333-3333-3333-333333333333', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.sl(p_owner uuid, k text, p_user uuid default null) returns uuid language sql as $$
  select l.id from public.split_line l join public.salary_split s on s.id = l.split_id
  where s.owner_user_id is not distinct from p_owner and l.kind::text = k and (p_user is null or l.user_id = p_user) limit 1;
$$;

-- 찬우(시작한 사람, 25일), 다른 사람(혼자)
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '찬우', monthly_income = 3500000, payday = 25 where id = auth.uid();
insert into public.goal (space_id, template, name, kind, priority, target_amount)
  select space_id, 'home', '내 집 마련', 'once', 1, 100000000 from public.app_user where id = auth.uid();
select public.save_split(jsonb_build_array(
  jsonb_build_object('kind', 'saving', 'goal_id', (select id from public.goal where template = 'home'), 'amount', 950000),
  jsonb_build_object('kind', 'fixed', 'amount', 680000),
  jsonb_build_object('kind', 'living', 'amount', 880000)
), auth.uid());
select set_config('test.code', (select code from public.create_invite()), true);
reset role;
select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈', monthly_income = 2700000, payday = 10 where id = auth.uid();
select public.complete_join(jsonb_build_array(jsonb_build_object('kind', 'fixed', 'amount', 680000)));
reset role;
delete from public.notification;
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select throws_ok($$ select public.request_reconnect() $$, 'P0001', 'reconnect_closed', '해제 전에는 없음');
select public.request_unlink('연결 해제');
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.agree_unlink();
reset role;
delete from public.notification;

-- 찬우 요청 → 예빈에게 알림(잠금 화면 가림)
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select lives_ok($$ select public.request_reconnect() $$, '다시 연결 요청');
select throws_ok($$ select public.request_reconnect() $$, 'P0001', 'too_soon', '7일에 1번');
reset role;
select results_eq($$ select user_id, title, push_title, push_hidden from public.notification where kind = 'reconnect_requested' $$,
  $$ values ('22222222-2222-2222-2222-222222222222'::uuid, '찬우님이 다시 연결하자고 했어요', 'sweeTwo', true) $$, '요청 알림');
insert into public.push_device (user_id, platform, token) values ('22222222-2222-2222-2222-222222222222', 'ios', repeat('b', 64));
-- 방해 금지 시간(기본 22~8시)에 돌려도 같은 결과(2026-11-13 PR 14: KST 밤에 돌리면 보내지 않아 실패하던 것)
update public.app_user set quiet_start = 0, quiet_end = 0 where id = '22222222-2222-2222-2222-222222222222';
select results_eq($$ select title, body from public.claim_push() $$, $$ values ('sweeTwo', '확인할 알림이 있어요') $$,
  '잠금 화면은 앱 이름과 한 줄만');

-- 예빈: 거절 + 다시 받지 않기 → 찬우의 다음 요청은 조용히
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is(public.answer_reconnect(false, true), null, '괜찮아요 + 다시 받지 않기');
reset role;
update public.reconnect_request set created_at = now() - interval '8 days';
delete from public.notification;
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select lives_ok($$ select public.request_reconnect() $$, '차단돼도 요청한 사람에게는 오류 없음');
select is((select count(*)::int from public.reconnect_request where status = 'silenced'), 0, '조용히 막은 요청은 요청한 사람도 안 보임');
reset role;
select is((select count(*)::int from public.notification), 0, '조용히 거절(알림 없음)');
select is((select status from public.reconnect_request order by created_at desc limit 1), 'silenced', '기록은 남김');

-- 차단이 없을 때: 예빈 요청 → 찬우 수락 → 예빈 공간 초대 코드(복구 없음)
update public.reconnect_request set created_at = now() - interval '8 days';
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.request_reconnect();
reset role;
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select set_config('test.code2', public.answer_reconnect(true), true);
reset role;
select is((select space_id from public.invite where code = current_setting('test.code2')),
  (select space_id from public.app_user where id = '22222222-2222-2222-2222-222222222222'), '요청한 사람 공간 초대 코드');
select is((select couple_state::text from public.couple_space s join public.app_user u on u.space_id = s.id
  where u.id = '22222222-2222-2222-2222-222222222222'), 'not_joined', '요청한 사람 공간은 합류 기다림');
select is((select title from public.notification where kind = 'reconnected'), '찬우님이 다시 연결하기로 했어요', '‘되살렸어요’ 없음');

select * from finish();
rollback;
