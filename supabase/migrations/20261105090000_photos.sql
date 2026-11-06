-- 사진: 목표 사진(22 G-02 ‘목표 사진’, 직접 만든 목표만)과 챙길 날 기록 사진(24 Y-08c, Y-09), 지우기(31 보안·개인정보).
-- - 저장소 photos 버킷(비공개, JPEG만, 3MB): g/{uuid}.jpg(목표, 정사각 512px), r/{uuid}.jpg(기록, 긴 변 1600px).
--   앱이 줄이고 다시 그려서 올림(EXIF 위치 정보 없음). 파일 이름은 무작위라 경로로 공간을 알 수 없음.
-- - photo 표가 기준: 이 표의 행을 볼 수 있는 사람만 파일을 읽음(목표 공개 범위, 비밀 챙길 날 그대로). 쓰기는 함수로만.
-- - 지우기: photo 행이 지워지면(목표·기록·부부 공간이 지워질 때 함께) storage_purge에 쌓고, Edge Function purge-storage가
--   Storage API로 파일을 지움(DB에서 storage.objects를 바로 지울 수 없음). 하루 넘게 붙지 않은 파일도 지움.
-- - 프로필 사진: 계정 삭제를 요청하면 바로 지움(31 ‘프로필 사진은 삭제 요청 즉시’).
-- - kick_purge(): 지울 것이 있을 때만 10분마다 함수 호출(Vault purge_function_url·purge_cron_secret, kick_push와 같은 방식).

alter table public.goal
  add column photo_path text check (photo_path ~ '^g/[0-9a-f-]{36}\.jpg$');

create table public.photo (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.couple_space (id) on delete cascade,
  goal_id uuid references public.goal (id) on delete cascade,
  care_record_id uuid references public.care_record (id) on delete cascade,
  path text not null unique check (path ~ '^[gr]/[0-9a-f-]{36}\.jpg$'),
  size_bytes integer not null check (size_bytes between 1 and 3145728),
  sort smallint not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (num_nonnulls(goal_id, care_record_id) = 1),
  check ((goal_id is not null) = (path like 'g/%'))
);
create unique index photo_goal_one on public.photo (goal_id) where goal_id is not null;
create index photo_record_idx on public.photo (care_record_id, sort) where care_record_id is not null;
create index photo_space_idx on public.photo (space_id);

alter table public.photo enable row level security;
-- 볼 수 있는 목표·기록의 사진만(목표 ‘금액만 보여 주기’면 사진도 안 보임, 비밀 챙길 날은 만든 사람만)
create policy photo_select on public.photo for select to authenticated using (
  public.is_space_member(space_id)
  and (goal_id is null or exists (
    select 1 from public.goal g where g.id = photo.goal_id
      and (g.owner_user_id is null or g.owner_user_id = auth.uid() or g.visibility = 'all')))
  and (care_record_id is null or exists (select 1 from public.care_record r where r.id = photo.care_record_id))
);
revoke insert, update, delete on public.photo from anon, authenticated;

-- 지울 파일
create table public.storage_purge (
  id bigint generated always as identity primary key,
  bucket text not null check (bucket in ('photos', 'avatars')),
  path text not null,
  attempts smallint not null default 0,
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index storage_purge_pending_idx on public.storage_purge (created_at) where done_at is null;
alter table public.storage_purge enable row level security;
revoke all on public.storage_purge from anon, authenticated;

create or replace function public.photo_purge()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.storage_purge (bucket, path) values ('photos', old.path);
  return null;
end;
$$;
create trigger photo_purge after delete on public.photo for each row execute function public.photo_purge();

-- 목표·기록이 다른 공간으로 옮겨지면(합류, 연결 해제) 사진도 따라감
create or replace function public.photo_follow_space()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'goal' then
    update public.photo set space_id = new.space_id where goal_id = new.id;
  else
    update public.photo set space_id = new.space_id where care_record_id = new.id;
  end if;
  return null;
end;
$$;
create trigger goal_photo_space after update of space_id on public.goal
  for each row when (new.space_id is distinct from old.space_id) execute function public.photo_follow_space();
create trigger care_record_photo_space after update of space_id on public.care_record
  for each row when (new.space_id is distinct from old.space_id) execute function public.photo_follow_space();

-- 프로필 사진: 계정 삭제 요청 즉시 지움
create or replace function public.avatar_purge()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.avatar_path is not null then
    insert into public.storage_purge (bucket, path) values ('avatars', old.avatar_path);
  end if;
  if tg_op = 'UPDATE' then
    new.avatar_path := null;
    new.avatar_updated_at := now();
    return new;
  end if;
  return old;
end;
$$;
create trigger app_user_avatar_purge before update of status on public.app_user
  for each row when (new.status = 'deletion_requested' and old.status is distinct from new.status)
  execute function public.avatar_purge();
create trigger app_user_avatar_purge_delete before delete on public.app_user
  for each row execute function public.avatar_purge();

-- 내가 올린 파일인지(저장소가 없는 곳은 확인 생략)
create or replace function public.my_uploaded_photo(p_path text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  ok boolean;
begin
  if to_regclass('storage.objects') is null then
    return true;
  end if;
  execute 'select exists (select 1 from storage.objects where bucket_id = $1 and name = $2 and owner_id = $3)'
    into ok using 'photos', p_path, auth.uid()::text;
  return ok;
end;
$$;
revoke all on function public.my_uploaded_photo(text) from public, anon, authenticated;

-- 목표 사진 바꾸기·지우기(직접 만든 목표만, 고칠 수 있는 사람만: 우리 목표는 둘 다, 내 목표는 주인만).
-- 우리 목표면 배우자 활동 “목표 사진을 바꿨어요”(주간 요약에만, 알림 없음)
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
  if g.template <> 'custom' or (g.owner_user_id is not null and g.owner_user_id <> auth.uid()) then
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
revoke all on function public.set_goal_photo(uuid, text, integer) from public, anon;
grant execute on function public.set_goal_photo(uuid, text, integer) to authenticated;

-- 기록 사진 붙이기(Y-08c, 한 기록에 10장까지). 볼 수 있는 기록에만
create or replace function public.add_care_photo(p_record uuid, p_path text, p_size integer)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r public.care_record;
  n integer;
  out_id uuid;
begin
  select * into r from public.care_record where id = p_record and deleted_at is null;
  if r.id is null or not public.is_space_member(r.space_id)
     or exists (select 1 from public.care_day d where d.id = r.care_day_id and d.secret and d.created_by <> auth.uid()) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_path !~ '^r/[0-9a-f-]{36}\.jpg$' or not public.my_uploaded_photo(p_path) then
    raise exception 'bad_path' using errcode = '22023';
  end if;
  select count(*) into n from public.photo where care_record_id = r.id;
  if n >= 10 then
    raise exception 'too_many' using errcode = '23514';
  end if;
  insert into public.photo (space_id, care_record_id, path, size_bytes, sort, created_by)
    values (r.space_id, r.id, p_path, p_size, n, auth.uid())
    returning id into out_id;
  return out_id;
end;
$$;
revoke all on function public.add_care_photo(uuid, text, integer) from public, anon;
grant execute on function public.add_care_photo(uuid, text, integer) to authenticated;

-- 목표 ‘금액만 보여 주기’면 사진 경로도 숨김(20261101233000과 같고 photo_path만 더함)
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
        'photo_path', null))
    else g
  end
  from public.goal g
  where public.is_space_member(g.space_id);
$$;
revoke execute on function public.space_goals() from public, anon;
grant execute on function public.space_goals() to authenticated;

-- Edge Function purge-storage가 부름(서비스 키만): 하루 넘게 붙지 않은 파일을 쌓고, 지울 것을 꺼냄
create or replace function public.claim_storage_purge(p_limit integer default 200)
returns table (id bigint, bucket text, path text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if to_regclass('storage.objects') is not null then
    execute $q$
      insert into public.storage_purge (bucket, path)
      select 'photos', o.name from storage.objects o
      where o.bucket_id = 'photos' and o.created_at < now() - interval '1 day'
        and not exists (select 1 from public.photo p where p.path = o.name)
        and not exists (select 1 from public.storage_purge s where s.path = o.name and s.done_at is null)
      limit 1000
    $q$;
  end if;
  delete from public.storage_purge s where s.done_at < now() - interval '30 days';
  return query
    update public.storage_purge s set attempts = s.attempts + 1
    where s.id in (
      select x.id from public.storage_purge x
      where x.done_at is null and x.attempts < 5
      order by x.created_at limit p_limit
      for update skip locked)
    returning s.id, s.bucket, s.path;
end;
$$;
revoke all on function public.claim_storage_purge(integer) from public, anon, authenticated;
grant execute on function public.claim_storage_purge(integer) to service_role;

create or replace function public.done_storage_purge(p_ids bigint[])
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.storage_purge set done_at = now() where id = any(p_ids);
$$;
revoke all on function public.done_storage_purge(bigint[]) from public, anon, authenticated;
grant execute on function public.done_storage_purge(bigint[]) to service_role;

create or replace function public.kick_purge()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  fn_url text;
  secret text;
  orphan boolean := false;
begin
  if to_regclass('storage.objects') is not null then
    execute $q$
      select exists (select 1 from storage.objects o
        where o.bucket_id = 'photos' and o.created_at < now() - interval '1 day'
          and not exists (select 1 from public.photo p where p.path = o.name))
    $q$ into orphan;
  end if;
  if not orphan and not exists (select 1 from public.storage_purge where done_at is null and attempts < 5) then
    return false;
  end if;
  if to_regclass('vault.decrypted_secrets') is null or to_regnamespace('net') is null then
    return false;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into fn_url using 'purge_function_url';
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into secret using 'purge_cron_secret';
  if fn_url is null or secret is null then
    return false;
  end if;
  execute 'select net.http_post(url := $1, headers := $2, body := $3)'
    using fn_url, jsonb_build_object('Content-Type', 'application/json', 'x-purge-secret', secret), '{}'::jsonb;
  return true;
end;
$$;
revoke all on function public.kick_purge() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('kick-purge', '*/10 * * * *', 'select public.kick_purge()');
  end if;
end;
$$;

-- 배우자 활동 줄 ‘목표 사진을 바꿨어요’(20261102120000과 같고 한 줄만 더함)
create or replace function public.partner_change_line(p_topic text, p_field text, p_noun text, p_before text, p_after text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_topic = 'split' then p_noun || ' ' || coalesce(p_before, '0원') || ' → ' || coalesce(p_after, '0원')
    when p_topic = 'income' then coalesce(p_before, '0원') || ' → ' || coalesce(p_after, '0원')
    when p_topic in ('goal', 'goal_meta') and p_field = 'deleted' then '목표를 지웠어요' -- [확인 필요]
    when p_topic in ('goal', 'goal_meta') and p_field = 'restored' then '목표를 되살렸어요' -- [확인 필요]
    when p_topic = 'goal_meta' and p_field = 'added' then '목표를 추가했어요' -- [확인 필요]
    when p_topic = 'goal_meta' and p_field = 'order' then '목표 순서를 바꿨어요' -- [확인 필요]
    when p_topic = 'goal_meta' and p_field = 'photo' then '목표 사진을 바꿨어요'
    when p_topic in ('goal', 'goal_meta') then
      case p_field when 'amount' then '목표 금액' when 'deadline' then '기한' when 'name' then '이름'
        when 'status' then '상태' when 'kind' then '형태' when 'owner' then '종류' else p_field end
      || ' ' || coalesce(p_before, '없음') || ' → ' || coalesce(p_after, '없음')
    when p_topic = 'goal_move' then coalesce(p_after, '') -- “50만 원 넣었어요” [확인 필요]
    when p_topic = 'asset' and p_field = 'amount_hidden' then '개인 자산 금액이 바뀌었어요'
    when p_topic = 'asset' and p_field = 'amount' then p_noun || ' ' || p_before || ' → ' || p_after
    when p_topic = 'asset' and p_field = 'added' then p_noun || ' 추가' -- [확인 필요]
    when p_topic = 'asset' and p_field = 'deleted' then p_noun || ' 삭제' -- [확인 필요]
    when p_topic = 'asset' and p_field = 'restored' then p_noun || ' 되살림' -- [확인 필요]
    when p_topic = 'care' and p_field = 'added' then p_noun || ' 추가' -- [확인 필요]
    when p_topic = 'care' then p_noun || ' 메모' -- [확인 필요]
    when p_topic = 'cycle_day' then '체크리스트 만드는 날 ' || p_before || ' → ' || p_after -- [확인 필요]
    when p_topic = 'couple' then
      case p_field when 'marriage' then '결혼 상태' else '결혼한 날' end
      || ' ' || coalesce(p_before, '없음') || ' → ' || coalesce(p_after, '없음') -- [확인 필요]
    else p_noun
  end;
$$;

-- 저장소(로컬·배포 Supabase에만 있음). 올리기는 공간이 있는 사람만, 읽기는 photo 행을 볼 수 있을 때만, 바꾸기·지우기 없음
create or replace function public.can_read_photo(p_name text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (select 1 from public.photo p where p.path = p_name);
$$;
revoke all on function public.can_read_photo(text) from public, anon;
grant execute on function public.can_read_photo(text) to authenticated;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage')
     and exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'storage' and c.relname = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('photos', 'photos', false, 3145728, array['image/jpeg'])
    on conflict (id) do nothing;
    execute $p$
      create policy photos_read on storage.objects for select to authenticated
      using (bucket_id = 'photos' and public.can_read_photo(name))
    $p$;
    execute $p$
      create policy photos_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'photos' and name ~ '^[gr]/[0-9a-f-]{36}\.jpg$'
        and exists (select 1 from public.app_user u where u.id = auth.uid() and u.space_id is not null))
    $p$;
  end if;
end;
$$;
