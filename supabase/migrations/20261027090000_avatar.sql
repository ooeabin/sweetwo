-- S-11e 프로필 사진(25 S-11e, 31 보안·개인정보). 정사각 512px JPEG(앱이 줄이고 다시 그려서 EXIF 위치 정보가 빠짐).
-- 저장소 avatars 버킷(비공개): {space_id}/{user_id}.jpg. 같은 공간 두 사람만 읽고, 쓰기·지우기는 내 파일만.
-- app_user.avatar_path: 지금 사진 경로(없으면 null = 이름 첫 글자). space_avatars()로 두 사람 사진 경로를 읽음.

alter table public.app_user
  add column avatar_path text check (avatar_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'),
  add column avatar_updated_at timestamptz;

create or replace function public.space_avatars()
returns table (user_id uuid, path text, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.avatar_path, u.avatar_updated_at
  from public.app_user u
  where u.space_id = (select m.space_id from public.app_user m where m.id = auth.uid())
    and u.space_id is not null;
$$;
revoke all on function public.space_avatars() from public, anon;
grant execute on function public.space_avatars() to authenticated;

-- 사진 저장(경로) / 지우기(null). 경로는 내 공간·내 id만
create or replace function public.set_avatar(p_path text default null)
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
  if me.id is null or me.space_id is null then
    raise exception 'no_space' using errcode = '42501';
  end if;
  if p_path is not null and p_path <> me.space_id::text || '/' || me.id::text || '.jpg' then
    raise exception 'bad_path' using errcode = '22023';
  end if;
  update public.app_user set avatar_path = p_path, avatar_updated_at = now() where id = me.id;
end;
$$;
revoke all on function public.set_avatar(text) from public, anon;
grant execute on function public.set_avatar(text) to authenticated;

-- 저장소(로컬·배포 Supabase에만 있음)
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage')
     and exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'storage' and c.relname = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('avatars', 'avatars', false, 2097152, array['image/jpeg'])
    on conflict (id) do nothing;
    execute $p$
      create policy avatars_read on storage.objects for select to authenticated
      using (bucket_id = 'avatars'
        and (storage.foldername(name))[1] = (select u.space_id::text from public.app_user u where u.id = auth.uid()))
    $p$;
    execute $p$
      create policy avatars_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'avatars'
        and name = (select u.space_id::text || '/' || u.id::text || '.jpg' from public.app_user u where u.id = auth.uid()))
    $p$;
    execute $p$
      create policy avatars_update on storage.objects for update to authenticated
      using (bucket_id = 'avatars'
        and name = (select u.space_id::text || '/' || u.id::text || '.jpg' from public.app_user u where u.id = auth.uid()))
    $p$;
    execute $p$
      create policy avatars_delete on storage.objects for delete to authenticated
      using (bucket_id = 'avatars'
        and name = (select u.space_id::text || '/' || u.id::text || '.jpg' from public.app_user u where u.id = auth.uid()))
    $p$;
  end if;
end;
$$;
