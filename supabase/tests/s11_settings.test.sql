-- pgTAP: QA 11구간 설정·계정·보안(2026-11-12). 찬우, 예빈
-- S11-03 D2: 연결 해제로 공간이 바뀌어도 프로필 사진이 남음(옮길 목록 → 복사 끝 → 새 경로, 옛 파일은 지울 목록), 상대는 못 읽음
-- S11-05: 계정 삭제 요청이면 그 사람의 모든 로그인 세션·갱신 토큰을 지움
-- S11-10: 넣을 월급 계획이 없는 저금 항목을 되살리면 'unlinked'
-- S11-11: my_login_email()
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

grant select on storage.objects to authenticated;
insert into auth.users (id, email, last_sign_in_at) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com', now()),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com', now()),
  ('33333333-3333-3333-3333-333333333333', 'solo@example.com', now());
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{"email": "chanwoo@kakao.example"}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao'),
  ('google-s', '33333333-3333-3333-3333-333333333333', '{}', 'google');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- 찬우: 공간, 사진, 초대
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
select set_config('test.code', (select code from public.create_invite()), true);
select set_config('test.sid', (select space_id::text from public.app_user), true);
select public.set_avatar(current_setting('test.sid') || '/11111111-1111-1111-1111-111111111111.jpg');
select is(public.my_login_email(), 'chanwoo@kakao.example', '로그인 줄: 소셜 계정 이메일(S11-11)');
reset role;
insert into storage.objects (bucket_id, name)
  values ('avatars', current_setting('test.sid') || '/11111111-1111-1111-1111-111111111111.jpg');

-- 예빈 합류
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
select public.finish_join();
select is(public.my_login_email(), 'yebin@example.com', '소셜 정보에 이메일이 없으면 계정 이메일');
select is((select count(*) from storage.objects where bucket_id = 'avatars'), 1::bigint, '합류한 예빈은 찬우 사진을 읽음');
reset role;

-- 연결 해제 확정(probe2 시나리오)
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.request_unlink('연결 해제');
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.agree_unlink();
reset role;

select isnt((select space_id::text from public.app_user where id = '11111111-1111-1111-1111-111111111111'),
  current_setting('test.sid'), '찬우는 새 공간');
select is((select count(*) from public.storage_move where done_at is null), 1::bigint, '옮길 사진 1개');
select is((select to_path from public.storage_move where done_at is null),
  (select space_id::text from public.app_user where id = '11111111-1111-1111-1111-111111111111')
    || '/11111111-1111-1111-1111-111111111111.jpg', '새 공간 폴더로');

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is((select count(*) from storage.objects where bucket_id = 'avatars'), 1::bigint,
  '옮기기 전에도 내 사진(옛 공간 경로)을 읽음');
select is((select count(*) from public.space_avatars() where path is not null), 1::bigint, '내 사진 경로가 남음');
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is((select count(*) from storage.objects where bucket_id = 'avatars'), 0::bigint, '해제 뒤 예빈은 찬우 사진을 못 읽음');
reset role;

-- 앱(authenticated)은 옮기기 함수를 못 부름
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select throws_ok($$ select * from public.claim_storage_move(10) $$, '42501', null, '앱은 옮길 목록을 못 꺼냄');
select throws_ok($$ select count(*) from public.storage_move $$, '42501', null, '앱은 옮길 목록 표를 못 읽음');
reset role;

-- Edge Function이 꺼내고(복사했다고 치고) 끝냄
select set_config('test.mid', (select id::text from public.claim_storage_move(10) limit 1), true);
select public.done_storage_move(array[current_setting('test.mid')::bigint]);
select is((select avatar_path from public.app_user where id = '11111111-1111-1111-1111-111111111111'),
  (select space_id::text from public.app_user where id = '11111111-1111-1111-1111-111111111111')
    || '/11111111-1111-1111-1111-111111111111.jpg', '복사가 끝나면 새 경로');
select is((select count(*) from public.storage_purge
  where bucket = 'avatars' and path = current_setting('test.sid') || '/11111111-1111-1111-1111-111111111111.jpg'
    and done_at is null), 1::bigint, '옛 파일은 지울 목록에');
select is((select count(*) from public.storage_move where done_at is null), 0::bigint, '옮길 것 없음');

-- 지금 누군가의 사진인 파일은 지우지 않음
insert into public.storage_purge (bucket, path)
  select 'avatars', avatar_path from public.app_user where id = '11111111-1111-1111-1111-111111111111';
select is((select count(*) from public.claim_storage_purge(100) c
  where c.path = (select avatar_path from public.app_user where id = '11111111-1111-1111-1111-111111111111')),
  0::bigint, '쓰는 사진 파일은 지울 목록에서 빠짐');

-- 사진을 지우면 그 파일도 지울 목록에
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.set_avatar(null);
reset role;
select is((select count(*) from public.storage_purge
  where path = (select space_id::text from public.app_user where id = '11111111-1111-1111-1111-111111111111')
    || '/11111111-1111-1111-1111-111111111111.jpg' and done_at is null), 1::bigint, '지운 사진 파일은 지울 목록에');

-- S11-05 계정 삭제: 모든 기기 로그아웃(probe1 시나리오)
insert into auth.sessions (user_id, user_agent) values
  ('33333333-3333-3333-3333-333333333333', 'phone'), ('33333333-3333-3333-3333-333333333333', 'tablet'),
  ('22222222-2222-2222-2222-222222222222', 'phone');
insert into auth.refresh_tokens (user_id, token, revoked)
  values ('33333333-3333-3333-3333-333333333333', 't1', false), ('22222222-2222-2222-2222-222222222222', 't2', false);
select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select public.complete_signup('google', null, false, 'v1');
select public.ensure_my_space();
-- S11-10: 넣을 월급 계획이 없는 저금 항목은 따로 되살림
insert into public.goal (space_id, template, name, kind, priority, owner_user_id)
  select space_id, 'custom', '여행', 'once', 1, id from public.app_user;
update public.goal set deleted_at = now();
reset role;
-- 공간에 주인 없는 월급 계획만 있음(각자 모드라 이 저금 항목을 넣을 곳이 아님)
insert into public.salary_split (space_id)
  select space_id from public.app_user where id = '33333333-3333-3333-3333-333333333333';
set local role authenticated;
select is(public.restore_trash('goal', (select id from public.goal limit 1)), 'unlinked',
  '넣을 월급 계획이 없으면 연결 없이 되살림');
select public.request_account_deletion();
reset role;
select is((select count(*) from auth.sessions where user_id = '33333333-3333-3333-3333-333333333333'), 0::bigint,
  '삭제 요청한 사람의 세션이 모두 지워짐');
select is((select count(*) from auth.refresh_tokens where user_id = '33333333-3333-3333-3333-333333333333'), 0::bigint,
  '갱신 토큰도 지워짐');
select is((select count(*) from auth.sessions where user_id = '22222222-2222-2222-2222-222222222222'), 1::bigint,
  '다른 사람 세션은 그대로');
select is((select status::text from public.app_user where id = '33333333-3333-3333-3333-333333333333'),
  'deletion_requested', '이용 중지');
select is((select count(*) from public.app_user where id = '33333333-3333-3333-3333-333333333333'), 1::bigint,
  '계정 행은 30일 남음');

select * from finish();
rollback;
