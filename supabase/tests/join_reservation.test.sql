-- pgTAP: 합류 잡아 두기(2026-11-11 QA 3구간 D1, D2, S3-06, S3-20). 찬우(시작한 사람), 예빈(합류한 사람), 셋째·넷째 사람
begin;
create extension if not exists pgtap with schema extensions;
select plan(39);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'third@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'fourth@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao'),
  ('kakao-t', '33333333-3333-3333-3333-333333333333', '{}', 'kakao'),
  ('kakao-f', '44444444-4444-4444-4444-444444444444', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- 찬우: 공간, 예빈 명의 대신 입력 1개, 코드
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '찬우', side = 'groom' where id = auth.uid();
insert into public.asset (space_id, side, grp, kind, name, amount, owner)
  select space_id, 'asset', 'deposit', 'saving', '예빈 적금', 3000000, 'person' from public.app_user where id = auth.uid();
select set_config('test.code', (select code from public.create_invite()), true);
select set_config('test.space', (select space_id::text from public.app_user where id = auth.uid()), true);
reset role;

-- 예빈: ‘합류하기’ = 잡아 두기만. 공간 구성원이 아니라 공간 데이터를 못 읽음
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select is(public.join_space(current_setting('test.code')), 'joined', '예빈 합류 시작(잡아 둠)');
select is((select onboarding_step from public.app_user where id = auth.uid()), 'P-02B', '대신 입력한 항목이 있으면 P-02b부터');
select isnt((select space_id::text from public.app_user where id = auth.uid()), current_setting('test.space'), '아직 찬우 공간 구성원이 아님');
select is((select count(*)::int from public.couple_space where id = current_setting('test.space')::uuid), 0, 'RLS: 찬우 공간 행을 못 읽음');
select is((select count(*)::int from public.asset where name = '예빈 적금'), 0, 'RLS: 찬우 공간 자산을 못 읽음');
select is((select count(*)::int from public.invite), 0, 'RLS: 초대 코드 행을 못 읽음');
select is(public.join_context()->>'starter_nickname', '찬우', 'join_context: 시작한 사람 호칭');
select is(jsonb_array_length(public.join_context()->'prefill'), 1, 'join_context: 대신 입력한 내 명의 항목만');
select is((public.join_context()->>'has_plan')::boolean, false, 'join_context: 찬우 월급 계획 없음(대기 흐름)');
select is(public.join_space(current_setting('test.code')), 'resume', '같은 코드로 다시 = 이어서');
reset role;

-- 찬우: S-12 ‘합류하는 중’(잡아 둔 기한), 리마인드 안 보냄
select isnt((select reserved_until from public.invite where code = current_setting('test.code')), null, '잡아 둔 기한이 있음');
update public.invite set expires_at = now() + interval '3 days' where code = current_setting('test.code');
delete from public.notification;
select public.send_morning_notifications();
select is((select count(*)::int from public.notification where kind like 'invite%'), 0, '합류하는 중이면 초대 리마인드 안 보냄');

-- 셋째: 같은 코드는 ‘used’, 미리보기도 ‘used’
select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select is(public.join_space(current_setting('test.code')), 'used', '다른 사람이 합류하는 중이면 못 씀');
select is((select status from public.invite_preview(current_setting('test.code'), 'dev-third')), 'used', '미리보기도 사용 중');
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is((select status from public.invite_preview(current_setting('test.code'), 'dev-yebin')), 'ok', '잡아 둔 본인 미리보기는 ok(이어 하기)');
reset role;

-- 기한 지남 → 셋째가 잡을 수 있음, 예빈은 더 못 이어 감
update public.invite set reserved_until = now() - interval '1 minute' where code = current_setting('test.code');
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is(public.join_context(), null, '기한이 지나면 합류 중이 아님');
select throws_ok($$ select public.finish_join() $$, '42501', 'not_joining', '기한이 지나면 합류를 마칠 수 없음');
reset role;
select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select is(public.join_space(current_setting('test.code')), 'joined', '기한이 지난 자리는 다른 사람이 잡음');
reset role;

-- 찬우: 초대 취소 → 잡은 것 풀리고 코드도 못 씀
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select lives_ok($$ select public.cancel_invite() $$, '초대 취소');
reset role;
select is((select reserved_by from public.invite where code = current_setting('test.code')), null, '취소하면 잡은 것 풀림');
select is((select expires_at <= now() from public.invite where code = current_setting('test.code')), true, '취소한 코드는 만료');
select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select is(public.join_context(), null, '취소된 사람은 합류 중이 아님');
select is(public.join_space(current_setting('test.code')), 'expired', '취소한 코드는 못 씀');
reset role;

-- 새 코드 → 예빈이 잡음 → 찬우 새 코드 받기(renew)가 잡은 것을 풂
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select set_config('test.code2', (select code from public.create_invite()), true);
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is(public.join_space(current_setting('test.code2')), 'joined', '새 코드로 다시 잡음');
reset role;
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select set_config('test.code3', (select code from public.renew_invite()), true);
reset role;
select is((select count(*)::int from public.invite where reserved_by is not null and space_id = current_setting('test.space')::uuid), 0,
  '새 코드 받기는 합류하는 중인 사람을 풂');

-- 예빈이 code3로 끝까지 합류 → 공간 2명, 셋째는 들어올 수 없음(검사 + 트리거)
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is(public.join_space(current_setting('test.code3')), 'joined', '새 코드로 잡음');
select lives_ok($$ select public.finish_join() $$, '합류 마침');
select is((select space_id::text from public.app_user where id = auth.uid()), current_setting('test.space'), '마친 뒤에 구성원');
select is((select count(*)::int from public.asset where name = '예빈 적금' and owner_user_id = auth.uid()), 1, '마친 뒤 대신 입력한 항목이 내 것');
reset role;
select throws_ok(
  format($$ update public.app_user set space_id = %L where id = '33333333-3333-3333-3333-333333333333' $$, current_setting('test.space')),
  'P0001', 'space_full', '트리거: 공간은 2명까지');
select is((select count(*)::int from public.app_user where space_id = current_setting('test.space')::uuid), 2, '공간 구성원 2명');

-- S3-06: 연결 해제를 기다리는 사람이 다른 코드를 쓰면 already_connected(기록 옮기기로 가지 않음)
select pg_temp.login_as('44444444-4444-4444-4444-444444444444');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '넷째' where id = auth.uid();
select set_config('test.code4', (select code from public.create_invite()), true);
reset role;
update public.couple_space set couple_state = 'unlink_pending' where id = current_setting('test.space')::uuid;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is(public.join_space(current_setting('test.code4')), 'already_connected', '해제 대기 중이면 이미 연결됨');
select is(public.my_reconnect_ok(), false, '다시 연결할 해제 기록이 없으면 false');
reset role;

-- D2: 미리보기 시도 제한(기기 10분 20번, 접속 주소 10분 40번, 맞든 틀리든 셈)
set local role anon;
select count(p) from generate_series(1, 20) g, lateral (select * from public.invite_preview('AAAAAA', 'dev-anon' || left(g::text, 0))) p;
select is((select status from public.invite_preview(current_setting('test.code4'), 'dev-anon')), 'locked', '같은 기기 20번 넘으면 맞는 코드도 locked');
select set_config('request.headers', '{"cf-connecting-ip":"203.0.113.9"}', true);
select count(p) from generate_series(1, 40) g, lateral (select * from public.invite_preview('AAAAAA', 'dev-' || g)) p;
select is((select status from public.invite_preview(current_setting('test.code4'), 'dev-new')), 'locked', '같은 접속 주소 40번 넘으면 locked');
select set_config('request.headers', '{"cf-connecting-ip":"198.51.100.7"}', true);
select is((select status from public.invite_preview(current_setting('test.code4'), 'dev-other')), 'ok', '다른 접속 주소·기기는 그대로');
reset role;

-- 예전 방식 미완료 합류(used_by만, 구성원): 초대 취소하면 혼자 공간으로 빼고 내 명의 항목도 함께 옮김
select set_config('test.space4', (select space_id::text from public.app_user where id = '44444444-4444-4444-4444-444444444444'), true);
update public.invite set used_by = '33333333-3333-3333-3333-333333333333' where code = current_setting('test.code4');
update public.app_user set space_id = current_setting('test.space4')::uuid where id = '33333333-3333-3333-3333-333333333333';
insert into public.asset (space_id, side, grp, kind, name, amount, owner, owner_user_id, created_by)
  values (current_setting('test.space4')::uuid, 'asset', 'deposit', 'saving', '셋째 적금', 1000000, 'person',
          '33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333');
select pg_temp.login_as('44444444-4444-4444-4444-444444444444');
set local role authenticated;
select lives_ok($$ select public.cancel_invite() $$, '넷째 초대 취소');
reset role;
select isnt((select space_id::text from public.app_user where id = '33333333-3333-3333-3333-333333333333'), current_setting('test.space4'),
  '예전 방식 미완료 구성원은 공간에서 빠짐');
select is((select a.space_id = u.space_id from public.asset a, public.app_user u where a.name = '셋째 적금' and u.id = a.owner_user_id), true,
  '그 사람 명의 항목도 함께 옮김');

select * from finish();
rollback;
