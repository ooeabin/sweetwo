-- pgTAP: 목표 사진(직접 만든 목표만, 바꾸면 옛 파일 지울 목록에), 기록 사진 10장까지, 다른 부부는 못 봄, 계정 삭제 요청 시 프로필 사진
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'chanwoo@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'other@example.com');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('kakao-c', '11111111-1111-1111-1111-111111111111', '{}', 'kakao'),
  ('kakao-o', '33333333-3333-3333-3333-333333333333', '{}', 'kakao');
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- 찬우가 올린 파일(저장소가 있는 곳에서만)
do $$
begin
  if to_regclass('storage.objects') is not null then
    insert into storage.objects (bucket_id, name, owner_id)
      select 'photos', (k || '/' || lpad(n::text, 8, '0') || '-0000-4000-8000-000000000000.jpg'), '11111111-1111-1111-1111-111111111111'
      from (values ('g'), ('r')) v(k), generate_series(1, 11) n;
  end if;
end;
$$;

select pg_temp.login_as('11111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
insert into public.goal (space_id, template, name, kind, priority, target_amount)
  select space_id, 'custom', '캠핑카', 'once', 1, 30000000 from public.app_user;
insert into public.goal (space_id, template, name, kind, priority)
  select space_id, 'emergency', '비상금', 'once', 2 from public.app_user;
select set_config('test.g', (select id::text from public.goal where template = 'custom'), true);
select set_config('test.e', (select id::text from public.goal where template = 'emergency'), true);
insert into public.care_day (space_id, category, kind, name, side, date_rule, month, day, budget, carer)
  select space_id, 'family', 'birthday', '어머니 생신', 'groom', 'solar_yearly', 10, 14, 300000, 'groom' from public.app_user;
select set_config('test.r', (public.record_care((select id from public.care_day), '2026-10-14', 300000, 'personal',
  '{gift}', '안마기', null, 0))->>'record', true);

select public.set_goal_photo(current_setting('test.g')::uuid, ('g' || '/' || lpad(1::text, 8, '0') || '-0000-4000-8000-000000000000.jpg'), 1000);
select public.set_goal_photo(current_setting('test.g')::uuid, ('g' || '/' || lpad(2::text, 8, '0') || '-0000-4000-8000-000000000000.jpg'), 1000);
select is((select photo_path from public.goal where id = current_setting('test.g')::uuid), ('g' || '/' || lpad(2::text, 8, '0') || '-0000-4000-8000-000000000000.jpg'),
  '목표 사진 바꿈');
select is((select count(*)::int from public.photo where goal_id = current_setting('test.g')::uuid), 1, '목표 사진은 하나');
select throws_ok(format($$ select public.set_goal_photo(%L, %L, 1) $$, current_setting('test.e'), ('g' || '/' || lpad(3::text, 8, '0') || '-0000-4000-8000-000000000000.jpg')),
  '42501', null, '기본 목표는 사진을 바꿀 수 없음');
select throws_ok(format($$ select public.set_goal_photo(%L, 'g/../x.jpg', 1) $$, current_setting('test.g')),
  '22023', null, '경로 모양이 다르면 안 됨');
select throws_ok($$ insert into public.photo (space_id, goal_id, path, size_bytes)
  select space_id, id, 'g/00000009-0000-4000-8000-000000000000.jpg', 1 from public.goal limit 1 $$,
  '42501', null, '직접 넣을 수 없음');

select public.add_care_photo(current_setting('test.r')::uuid, ('r' || '/' || lpad(n::text, 8, '0') || '-0000-4000-8000-000000000000.jpg'), 2000) from generate_series(1, 10) n;
select throws_ok(format($$ select public.add_care_photo(%L, %L, 1) $$, current_setting('test.r'), ('r' || '/' || lpad(11::text, 8, '0') || '-0000-4000-8000-000000000000.jpg')),
  '23514', null, '기록 사진은 10장까지');
reset role;

select is((select array_agg(path) from public.storage_purge where bucket = 'photos'), array[('g' || '/' || lpad(1::text, 8, '0') || '-0000-4000-8000-000000000000.jpg')],
  '바꾼 옛 사진은 지울 목록에');

-- 다른 부부는 사진 행을 못 봄
select pg_temp.login_as('33333333-3333-3333-3333-333333333333');
set local role authenticated;
select public.complete_signup('kakao', null, false, 'v1');
select public.ensure_my_space();
select is((select count(*)::int from public.photo), 0, '다른 부부는 못 봄');
reset role;

-- 기록을 지우면(휴지통 비우기·공간 삭제와 같음) 사진 10장도 지울 목록에
delete from public.care_record where id = current_setting('test.r')::uuid;
select is((select count(*)::int from public.storage_purge where path like 'r/%'), 10, '기록과 함께 사진도 지움');

-- 계정 삭제 요청: 프로필 사진 바로 지움
update public.app_user set avatar_path = space_id::text || '/' || id::text || '.jpg'
  where id = '11111111-1111-1111-1111-111111111111';
update public.app_user set status = 'deletion_requested' where id = '11111111-1111-1111-1111-111111111111';
select results_eq($$ select (select avatar_path from public.app_user where id = '11111111-1111-1111-1111-111111111111'),
  (select count(*)::int from public.storage_purge where bucket = 'avatars') $$,
  $$ values (null::text, 1) $$, '계정 삭제 요청 시 프로필 사진 지움');

select * from finish();
rollback;
