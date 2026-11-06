-- pgTAP: 소셜 프로필 사진 가져오기 표시(2026-11-05, 25 S-11e). 처음엔 비어 있음, 한 번 남기면 시각이 바뀌지 않음,
-- 내 줄만 바뀜, 로그인 안 한 사람은 부를 수 없음. 찬우, 예빈
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('google-y', '22222222-2222-2222-2222-222222222222', '{}', 'google');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('google', null, false, 'v1');
reset role;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select is((select avatar_social_checked_at from public.app_user where id = auth.uid()), null, '가입하면 아직 시도 안 함');
select public.mark_social_avatar_checked();
select isnt((select avatar_social_checked_at from public.app_user where id = auth.uid()), null, '시도하면 시각이 남음');
select set_config('test.at', (select avatar_social_checked_at::text from public.app_user where id = auth.uid()), true);
select public.mark_social_avatar_checked();
select is((select avatar_social_checked_at::text from public.app_user where id = auth.uid()), current_setting('test.at'),
  '다시 불러도 처음 시각 그대로');
reset role;
select is((select avatar_social_checked_at from public.app_user where id = '22222222-2222-2222-2222-222222222222'), null,
  '파트너 줄은 안 바뀜');

set local role anon;
select throws_ok($$ select public.mark_social_avatar_checked() $$, '42501', null, '로그인 안 하면 부를 수 없음');
reset role;

select * from finish();
rollback;
