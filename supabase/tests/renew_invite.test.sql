-- pgTAP: S-12 새 코드 받기(renew_invite). 찬우(미합류)
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao');

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role anon;
select throws_ok($$ select * from public.renew_invite() $$, '42501', null, '익명은 새 코드를 못 받는다');
reset role;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select lives_ok($$ select public.complete_signup('kakao', null, false, 'v1') $$, '찬우 가입');
select lives_ok($$ select public.ensure_my_space() $$, '공간');
select set_config('test.old', (select code from public.create_invite()), true);
select set_config('test.new', (select code from public.renew_invite()), true);
select isnt(current_setting('test.new'), current_setting('test.old'), '새 코드는 이전 코드와 다르다');
select is(
  (select count(*)::int from public.invite where used_at is null and expires_at > now()),
  1, '쓸 수 있는 코드는 새 코드 하나');
select is(
  (select code from public.create_invite()),
  current_setting('test.new'), '다시 불러도 새 코드');
select ok(
  (select expires_at <= now() from public.invite where code = current_setting('test.old')),
  '이전 코드는 바로 만료');
reset role;

-- 합류가 끝난 부부는 새 코드를 못 받는다
update public.couple_space set couple_state = 'connected';
select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select throws_ok($$ select * from public.renew_invite() $$, 'P0001', 'already_joined', '연결된 부부는 못 받는다');
reset role;

select * from finish();
rollback;
