-- pgTAP: 프로필 사진(S-11e). 내 경로만 저장, 지우기, 같은 공간 두 사람 사진 경로. 찬우, 예빈
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
select set_config('test.code', (select code from public.create_invite()), true);
select set_config('test.sid', (select space_id::text from public.app_user), true);
select public.set_avatar(current_setting('test.sid') || '/11111111-1111-1111-1111-111111111111.jpg');
select is((select avatar_path from public.app_user), current_setting('test.sid') || '/11111111-1111-1111-1111-111111111111.jpg', '내 사진 경로');
select throws_ok(format($$ select public.set_avatar(%L) $$, current_setting('test.sid') || '/22222222-2222-2222-2222-222222222222.jpg'),
  '22023', 'bad_path', '다른 사람 경로는 안 됨');
reset role;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
select is((select count(*) from public.space_avatars() where path is not null), 1::bigint, '배우자 사진 경로를 봄');
select public.set_avatar(null);
select is((select count(*) from public.space_avatars()), 2::bigint, '두 사람');
reset role;
select is((select avatar_path from public.app_user where id = '22222222-2222-2222-2222-222222222222'), null, '지우면 첫 글자');

select * from finish();
rollback;
