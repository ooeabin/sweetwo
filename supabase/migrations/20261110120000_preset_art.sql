-- 지정 그림(2026-11-03): 프로필 지정 아바타(25 S-11e), 목표 지정 사진(22 G-02 ‘목표 사진’).
-- - 프로필: 가입할 때 지정 아바타 a01~a07 중 하나를 무작위로 정함. S-11e에서 다른 지정 아바타를 고르거나 직접 올림.
--   보이는 순서: 올린 사진 → 지정 아바타 그림(파일이 생기기 전까지는 이름 첫 글자).
-- - 목표: 모든 목표(기본 목표 포함)가 사진을 가짐. photo_preset이 비어 있으면 그 종류의 1번 지정 사진({template}-01).
--   G-02p에서 지정 사진을 고르거나 직접 올림. 직접 올린 사진(photo_path)이 있으면 그것이 먼저.
-- - 지정 그림 이름은 앱(packages/core art.ts)이 기준. DB는 모양만 검사.

-- 기존 사람도 무작위로 채움(volatile 기본값이라 줄마다 따로 정해짐)
alter table public.app_user
  add column avatar_preset text not null
    default ('a' || lpad((1 + floor(random() * 7))::int::text, 2, '0'))
    check (avatar_preset ~ '^a[0-9]{2}$');

alter table public.goal
  add column photo_preset text check (photo_preset ~ '^[a-z_]{2,40}-[0-9]{2}$');

-- 같은 공간 두 사람의 그림(올린 사진 경로 + 지정 아바타). space_avatars는 반환 모양이 달라 새 함수로 둠
create or replace function public.space_people_art()
returns table (user_id uuid, path text, updated_at timestamptz, preset text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.avatar_path, u.avatar_updated_at, u.avatar_preset
  from public.app_user u
  where u.space_id = (select m.space_id from public.app_user m where m.id = auth.uid())
    and u.space_id is not null;
$$;
revoke all on function public.space_people_art() from public, anon;
grant execute on function public.space_people_art() to authenticated;

-- 지정 아바타 고르기. 올린 사진이 있었으면 경로를 비움(파일은 앱이 지움, set_avatar(null)과 같음)
create or replace function public.set_avatar_preset(p_preset text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me public.app_user;
begin
  select * into me from public.app_user where id = auth.uid();
  if me.id is null then
    raise exception 'no_user' using errcode = '42501';
  end if;
  if p_preset is null or p_preset !~ '^a[0-9]{2}$' then
    raise exception 'bad_preset' using errcode = '22023';
  end if;
  update public.app_user
    set avatar_preset = p_preset, avatar_path = null, avatar_updated_at = now()
    where id = me.id;
end;
$$;
revoke all on function public.set_avatar_preset(text) from public, anon;
grant execute on function public.set_avatar_preset(text) to authenticated;

-- 목표 사진 바꾸기·지우기: 20261105090000_photos.sql 정의를 복사하고 ‘직접 만든 목표만’ 조건을 뺌(모든 목표가 사진을 가짐)
create or replace function public.set_goal_photo(p_goal uuid, p_path text default null, p_size integer default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  g public.goal;
begin
  select * into g from public.goal where id = p_goal and deleted_at is null;
  if g.id is null or not public.is_space_member(g.space_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if g.owner_user_id is not null and g.owner_user_id <> auth.uid() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_path is not null and (p_path !~ '^g/[0-9a-f-]{36}\.jpg$' or not public.my_uploaded_photo(p_path)) then
    raise exception 'bad_path' using errcode = '22023';
  end if;
  delete from public.photo where goal_id = g.id;
  if p_path is not null then
    insert into public.photo (space_id, goal_id, path, size_bytes, created_by)
      values (g.space_id, g.id, p_path, coalesce(p_size, 1), auth.uid());
  end if;
  update public.goal set photo_path = p_path where id = g.id;
  if g.owner_user_id is null then
    perform public.log_partner_change(g.space_id, 'goal_meta', g.id, 'photo', g.name, null, '1', false,
      '/goals/' || g.id);
  end if;
end;
$$;

-- 목표 지정 사진 고르기. 올린 사진이 있었으면 지움(photo 행이 지워지면 파일도 지울 목록에).
-- 고칠 수 있는 사람만(우리 목표 둘 다, 내 목표 주인만). 우리 목표면 배우자 활동 “목표 사진을 바꿨어요”(주간 요약에만)
create or replace function public.set_goal_preset(p_goal uuid, p_preset text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  g public.goal;
begin
  select * into g from public.goal where id = p_goal and deleted_at is null;
  if g.id is null or not public.is_space_member(g.space_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if g.owner_user_id is not null and g.owner_user_id <> auth.uid() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_preset is null or p_preset !~ '^[a-z_]{2,40}-[0-9]{2}$' then
    raise exception 'bad_preset' using errcode = '22023';
  end if;
  delete from public.photo where goal_id = g.id;
  update public.goal set photo_preset = p_preset, photo_path = null where id = g.id;
  if g.owner_user_id is null then
    perform public.log_partner_change(g.space_id, 'goal_meta', g.id, 'photo', g.name, null, '1', false,
      '/goals/' || g.id);
  end if;
end;
$$;
revoke all on function public.set_goal_preset(uuid, text) from public, anon;
grant execute on function public.set_goal_preset(uuid, text) to authenticated;

-- 배우자 ‘금액만 보여 주기’ 내 목표: 지정 사진 이름도 숨김(종류가 드러나지 않게, 직접 만든 목표 기본 사진).
-- 20261105090000_photos.sql 정의를 복사하고 photo_preset만 더함
create or replace function public.space_goals()
returns setof public.goal
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when g.owner_user_id is not null and g.owner_user_id <> auth.uid() and g.visibility = 'amount'
      then jsonb_populate_record(g, jsonb_build_object('name', '개인 목표', 'template', 'custom', 'details', '{}'::jsonb,
        'photo_path', null, 'photo_preset', null))
    else g
  end
  from public.goal g
  where public.is_space_member(g.space_id);
$$;
revoke execute on function public.space_goals() from public, anon;
grant execute on function public.space_goals() to authenticated;
