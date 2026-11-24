-- pgTAP: 경조사 그림 키(art_key). 칸이 있고, 형식이 맞아야 하고, 같은 공간은 고칠 수 있고, 다른 커플은 못 봄
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'other@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-o', '33333333-3333-3333-3333-333333333333', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select has_column('public', 'care_day', 'art_key', 'art_key 칸이 있음');

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
select lives_ok($$
  insert into public.care_day (space_id, category, kind, name, date_rule, month, day, art_key)
  select space_id, 'couple', 'birthday', '예빈 생일', 'solar_yearly', 3, 9, 'cake' from public.app_user $$,
  '그림 키를 넣어 추가');
select lives_ok($$
  insert into public.care_day (space_id, category, kind, name, date_rule, month, day)
  select space_id, 'couple', 'event', '집들이', 'solar_yearly', 4, 1 from public.app_user $$,
  '그림 키 없이도 추가(null, 앱이 기본값)');
select throws_ok($$
  insert into public.care_day (space_id, category, kind, name, date_rule, month, day, art_key)
  select space_id, 'couple', 'event', '이상한 키', 'solar_yearly', 4, 2, 'Bad Key!' from public.app_user $$,
  '23514', null, '키 형식이 아니면 거절');
select lives_ok($$ update public.care_day set art_key = 'house' where name = '집들이' $$, '같은 공간은 그림 키를 고침');
reset role;

select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select is((select count(*)::int from public.care_day where art_key is not null), 0, '다른 커플은 못 봄');
reset role;

select * from finish();
rollback;
