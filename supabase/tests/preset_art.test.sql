-- pgTAP: 지정 그림(2026-11-03). 가입하면 지정 아바타가 정해짐, 지정 아바타 고르면 올린 사진 경로 비움, 배우자 지정 아바타를 봄,
-- 목표 지정 사진 고르기(올린 사진은 지울 목록에), 배우자 내 목표는 못 바꿈. 찬우, 예빈
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'yebin@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-y', '22222222-2222-2222-2222-222222222222', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

do $$
begin
  if to_regclass('storage.objects') is not null then
    insert into storage.objects (bucket_id, name, owner_id)
      values ('photos', 'g/00000001-0000-4000-8000-000000000000.jpg', '11111111-1111-1111-1111-111111111111');
  end if;
end;
$$;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
select set_config('test.code', (select code from public.create_invite()), true);
select set_config('test.sid', (select space_id::text from public.app_user), true);
select matches((select avatar_preset from public.app_user), '^a0[1-7]$', '가입하면 지정 아바타 하나');
select public.set_avatar(current_setting('test.sid') || '/11111111-1111-1111-1111-111111111111.jpg');
select public.set_avatar_preset('a03');
select results_eq($$ select avatar_preset, avatar_path from public.app_user $$, $$ values ('a03'::text, null::text) $$,
  '지정 아바타를 고르면 올린 사진 대신');
select throws_ok($$ select public.set_avatar_preset('x1') $$, '22023', 'bad_preset', '모양이 다르면 안 됨');

insert into public.goal (space_id, template, name, kind, priority)
  select space_id, 'travel', '여행', 'once', 1 from public.app_user;
insert into public.goal (space_id, owner_user_id, template, name, kind, priority, visibility)
  select space_id, id, 'car', '자동차', 'once', 2, 'amount' from public.app_user;
select set_config('test.g', (select id::text from public.goal where template = 'travel'), true);
select set_config('test.mine', (select id::text from public.goal where template = 'car'), true);
select public.set_goal_preset(current_setting('test.mine')::uuid, 'car-03');
select public.set_goal_photo(current_setting('test.g')::uuid, 'g/00000001-0000-4000-8000-000000000000.jpg', 1000);
select public.set_goal_preset(current_setting('test.g')::uuid, 'travel-02');
select results_eq($$ select photo_preset, photo_path from public.goal where id = current_setting('test.g')::uuid $$,
  $$ values ('travel-02'::text, null::text) $$, '목표 지정 사진 고름');
select is((select count(*)::int from public.photo), 0, '올린 사진 행은 지움');
select throws_ok(format($$ select public.set_goal_preset(%L, 'Travel') $$, current_setting('test.g')),
  '22023', 'bad_preset', '지정 사진 이름 모양');
reset role;
select is((select count(*)::int from public.storage_purge where path = 'g/00000001-0000-4000-8000-000000000000.jpg'), 1,
  '올린 사진 파일은 지울 목록에');

select pg_temp.login_as('22222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.join_space(current_setting('test.code'));
select is((select preset from public.space_people_art() where user_id = '11111111-1111-1111-1111-111111111111'), 'a03',
  '배우자 지정 아바타를 봄');
select is((select photo_preset from public.space_goals() where id = current_setting('test.mine')::uuid), null,
  '금액만 보여 주기면 지정 사진 이름도 숨김');
select throws_ok(format($$ select public.set_goal_preset(%L, 'car-02') $$, current_setting('test.mine')),
  '42501', 'not_allowed', '배우자 내 목표는 못 바꿈');
reset role;

select * from finish();
rollback;
