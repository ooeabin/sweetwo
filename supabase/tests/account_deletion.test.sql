-- pgTAP: 계정 삭제(S-18b), 삭제 취소, 30일 뒤 지우기. 찬우(삭제), 예빈(배우자), 혼자 쓰는 K
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email, last_sign_in_at) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com', now()),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com', now() - interval '1 day'),
  ('33333333-3333-3333-3333-333333333333', 'k@example.com', now());
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao'),
  ('google-k', '33333333-3333-3333-3333-333333333333', '{}', 'google');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
update public.app_user set nickname = '찬우', side = 'groom';
select set_config('test.code', (select code from public.create_invite()), true);
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
update public.app_user set nickname = '예빈', side = 'bride';
select public.finish_join();
select throws_ok($$ select public.request_account_deletion() $$, 'P0001', 'reauth_required', '다시 로그인한 지 10분 넘으면 거절');
reset role;
select set_config('test.s', (select space_id::text from public.app_user where nickname = '찬우'), true);
insert into public.asset (space_id, side, grp, kind, name, amount, owner)
  values (current_setting('test.s')::uuid, 'asset', 'cash', 'bank', '공동 적금', 24000000, 'joint');
insert into public.asset (space_id, side, grp, kind, name, amount, owner, owner_user_id)
  values (current_setting('test.s')::uuid, 'asset', 'cash', 'bank', '찬우 통장', 1000000, 'person',
    '11111111-1111-1111-1111-111111111111');

-- 연결된 찬우가 삭제
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select is(public.request_account_deletion(), (now() at time zone 'Asia/Seoul')::date + 30, '30일 뒤 날짜');
select is((select count(*)::int from public.goal), 0, '바로 이용 중지(아무것도 안 보임)');
reset role;
select is((select status::text from public.app_user where nickname = '찬우'), 'deletion_requested', '삭제 요청');
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is((select couple_state::text from public.couple_space), 'solo', '예빈은 혼자 쓰기');
select results_eq($$ select name, amount from public.asset $$, $$ values ('공동 적금', 24000000::bigint) $$, '공동 항목은 예빈에게, 찬우 명의는 찬우 새 공간으로');
select is((select title from public.notification where kind = 'partner_deleted'), '찬우님이 계정을 삭제했어요', '상대 알림');
reset role;

-- 찬우가 다시 로그인해 취소
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select lives_ok($$ select public.cancel_account_deletion() $$, '삭제 취소');
select is((select couple_state::text from public.couple_space), 'solo', '찬우는 혼자 쓰기로');
select throws_ok($$ select public.cancel_account_deletion() $$, 'P0001', 'not_requested', '한 번만');
reset role;
select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select is((select title from public.notification where kind = 'partner_restored'), '찬우님이 계정 삭제를 취소했어요', '계정 복구 알림');
select lives_ok($$ select public.request_reconnect() $$, '30일 안 다시 연결 요청 가능');
reset role;
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select lives_ok($$ select public.answer_reconnect(true) $$, '찬우가 받아들임');
reset role;
select results_eq(
  $$ select (select couple_state::text from public.couple_space where id = current_setting('test.s')::uuid),
            (select count(*)::int from public.asset where space_id = current_setting('test.s')::uuid),
            (select count(*)::int from public.app_user where space_id = current_setting('test.s')::uuid) $$,
  $$ values ('connected', 2, 2) $$, '다시 연결: 원래 공간에 두 사람, 찬우 통장도 돌아옴');

-- 혼자 쓰는 K: 삭제 → 30일 뒤 공간과 계정까지 지움
select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select public.complete_signup('google', null, false, 'v1');
select public.ensure_my_space();
select public.create_invite();
select public.request_account_deletion();
reset role;
select is((select count(*)::int from public.invite where created_by = '33333333-3333-3333-3333-333333333333' and expires_at > now()), 0, '쓰지 않은 초대 코드 만료');
update public.app_user set deletion_requested_at = now() - interval '31 days' where id = '33333333-3333-3333-3333-333333333333';
select set_config('test.k', (select space_id::text from public.app_user where id = '33333333-3333-3333-3333-333333333333'), true);
select public.purge_deleted_accounts();
select is((select count(*)::int from auth.users where id = '33333333-3333-3333-3333-333333333333'), 0, '계정 지움');
select is((select count(*)::int from public.couple_space where id = current_setting('test.k')::uuid), 0, '공간도 지움');

select * from finish();
rollback;
