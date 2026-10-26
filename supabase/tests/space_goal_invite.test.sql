-- pgTAP: 부부 공간, 목표, 초대 코드, 만 18세 미만 삭제(온보딩 파트 0~2)
-- 찬우(공간 있음), 다른 부부 K, 예빈(미성년 삭제 시험)
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'k@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao'),
  ('google-k', '33333333-3333-3333-3333-333333333333', '{}', 'google');

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- 익명
set local role anon;
select throws_ok($$ select public.ensure_my_space() $$, '42501', null, '익명은 공간을 못 만든다');
select is((select count(*)::int from public.couple_space), 0, '익명은 공간을 못 본다');
reset role;

-- 찬우: 가입 전에는 공간 없음 → 가입 → 공간
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select throws_ok($$ select public.ensure_my_space() $$, 'P0001', 'not_signed_up', '가입 전에는 공간을 못 만든다');
select lives_ok($$ select public.complete_signup('kakao', null, false, 'v1') $$, '찬우 가입');
select isnt(public.ensure_my_space(), null, '공간이 생긴다');
select is(public.ensure_my_space(), (select space_id from public.app_user), '두 번 불러도 같은 공간');
update public.couple_space set partner_nickname = '예빈', marriage_status = 'married', housing = 'jeonse';
select is((select version from public.couple_space), 2, '공간 답 저장, version 증가');
select throws_ok($$ update public.couple_space set couple_state = 'connected' $$, '42501', null, '부부 상태는 직접 못 바꾼다');
insert into public.goal (space_id, template, name, kind, target_amount, priority)
  select space_id, 'home', '내 집 마련', 'once', 150000000, 1 from public.app_user;
select is((select created_by from public.goal), '11111111-1111-1111-1111-111111111111'::uuid, '목표 만든 사람 기록');
select throws_ok($$ delete from public.goal $$, '42501', null, '목표는 영구 삭제 못 한다(휴지통만)');
select ok((select code ~ '^[A-HJ-NP-Z2-9]{6}$' from public.create_invite()), '초대 코드 6자리');
select is((select count(*)::int from public.create_invite()), 1, '쓸 수 있는 코드가 있으면 다시 만들지 않는다');
select is((select count(*)::int from public.invite), 1, '초대 코드는 하나');
select throws_ok(
  $$ insert into public.invite (space_id, code, expires_at) select space_id, 'ABCDEF', now() from public.app_user $$,
  '42501', null, '초대 코드는 직접 못 넣는다');
reset role;

-- 다른 부부 K. 찬우 공간 id는 관리자 권한으로 미리 읽어 둔다(K는 찬우 행을 못 봄)
select set_config('test.chanwoo_space', (select space_id::text from public.app_user where id = '11111111-1111-1111-1111-111111111111'), true);
select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select lives_ok($$ select public.complete_signup('google', null, false, 'v1') $$, 'K 가입');
select is((select count(*)::int from public.goal), 0, '다른 부부의 목표는 안 보인다');
select is((select count(*)::int from public.invite), 0, '다른 부부의 초대 코드는 안 보인다');
select throws_ok(
  $$ insert into public.goal (space_id, template, name, kind, priority)
     values (current_setting('test.chanwoo_space')::uuid, 'travel', '여행', 'once', 1) $$,
  '42501', null, '다른 부부 공간에 목표를 못 넣는다');
reset role;

select * from finish();
rollback;
