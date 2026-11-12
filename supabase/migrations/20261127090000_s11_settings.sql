-- QA 11구간 설정·계정·보안(2026-11-12)
-- 1) S11-03 D2: 공간이 바뀌면(연결 해제 확정, 상대 계정 삭제, 합류, 다시 연결, 계정 삭제 취소 등 app_user.space_id가 바뀌는 모든 때)
--    프로필 사진을 새 공간 폴더로 옮김. SQL로는 저장소 파일을 옮길 수 없어서(storage.objects 이름만 바꾸면 실제 파일과 어긋남)
--    옮길 일을 storage_move에 쌓고, Edge Function purge-storage(kick_purge가 10분마다)가 Storage API로 복사한 뒤
--    done_storage_move가 avatar_path를 새 경로로 바꾸고 옛 파일을 storage_purge에 넣음. 옮기기 전에도 사진이 보이게
--    avatars 읽기 정책은 ‘같은 공간 사람의 지금 avatar_path’도 읽게 넓힘(상대가 다른 공간이 되면 못 읽음).
--    set_avatar로 사진을 바꾸거나 지우면 옛 파일도 지울 목록에. 지금 누군가의 사진이거나 옮길 곳인 파일은 지우지 않음.
-- 2) S11-05: 계정 삭제(request_account_deletion, 어드민 대리 접수)는 그 사람의 모든 로그인 세션·갱신 토큰을 지움(다른 기기도 로그아웃).
-- 3) S11-10: restore_trash가 연결 대상이 없어 따로 되살렸으면 'unlinked'(저금 항목인데 공간의 월급 계획 중 넣을 것이 없을 때).
-- 4) S11-11: my_login_email() 로그인한 소셜 계정 이메일(S-11 ‘로그인’ 줄).

-- ── 1. 프로필 사진 따라가기 ────────────────────────────────────────────
create table public.storage_move (
  id bigint generated always as identity primary key,
  bucket text not null default 'avatars' check (bucket = 'avatars'),
  user_id uuid not null references public.app_user (id) on delete cascade,
  from_path text not null,
  to_path text not null,
  attempts smallint not null default 0,
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index storage_move_pending_idx on public.storage_move (created_at) where done_at is null;
create index storage_move_user_idx on public.storage_move (user_id);
alter table public.storage_move enable row level security;
revoke all on public.storage_move from anon, authenticated;

create or replace function public.avatar_follow_space()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  dest text := new.space_id::text || '/' || new.id::text || '.jpg';
  stale record;
begin
  -- 아직 안 끝난 옮기기는 이번 것으로 바꿈(그사이 복사된 파일이 있으면 지울 목록에)
  for stale in
    update public.storage_move set done_at = now()
      where user_id = new.id and done_at is null
      returning to_path
  loop
    if stale.to_path <> dest then
      insert into public.storage_purge (bucket, path) values ('avatars', stale.to_path);
    end if;
  end loop;
  if new.avatar_path is null or new.avatar_path = dest then
    return null;
  end if;
  -- 옮길 곳에 남은 ‘지울 파일’ 표시는 거둠(다시 연결로 예전 공간에 돌아올 때 등)
  update public.storage_purge set done_at = now()
    where bucket = 'avatars' and path = dest and done_at is null;
  insert into public.storage_move (user_id, from_path, to_path) values (new.id, new.avatar_path, dest);
  return null;
end;
$$;
create trigger app_user_avatar_follow after update of space_id on public.app_user
  for each row when (new.space_id is distinct from old.space_id and new.space_id is not null)
  execute function public.avatar_follow_space();

-- Edge Function purge-storage가 부름(서비스 키만): 옮길 사진. 그사이 사진이 바뀌었거나 지워졌으면 건너뜀
create or replace function public.claim_storage_move(p_limit integer default 100)
returns table (id bigint, bucket text, from_path text, to_path text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.storage_move m set done_at = now()
    where m.done_at is null
      and not exists (select 1 from public.app_user u where u.id = m.user_id and u.avatar_path = m.from_path);
  delete from public.storage_move s where s.done_at < now() - interval '30 days';
  return query
    update public.storage_move s set attempts = s.attempts + 1
    where s.id in (
      select x.id from public.storage_move x
      where x.done_at is null and x.attempts < 5
      order by x.created_at limit p_limit
      for update skip locked)
    returning s.id, s.bucket, s.from_path, s.to_path;
end;
$$;
revoke all on function public.claim_storage_move(integer) from public, anon, authenticated;
grant execute on function public.claim_storage_move(integer) to service_role;

-- 복사가 끝난 것: avatar_path를 새 경로로, 옛 파일은 지울 목록에. 그사이 사진이 바뀌었으면 복사본만 지울 목록에
create or replace function public.done_storage_move(p_ids bigint[])
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r public.storage_move;
begin
  for r in select * from public.storage_move where id = any(p_ids) and done_at is null for update loop
    update public.app_user set avatar_path = r.to_path, avatar_updated_at = now()
      where id = r.user_id and avatar_path = r.from_path;
    if found then
      insert into public.storage_purge (bucket, path) values ('avatars', r.from_path);
    elsif not exists (select 1 from public.app_user where avatar_path = r.to_path) then
      insert into public.storage_purge (bucket, path) values ('avatars', r.to_path);
    end if;
    update public.storage_move set done_at = now() where id = r.id;
  end loop;
end;
$$;
revoke all on function public.done_storage_move(bigint[]) from public, anon, authenticated;
grant execute on function public.done_storage_move(bigint[]) to service_role;

-- 지울 파일 꺼내기(20261105090000과 같고, 지금 누군가의 사진이거나 옮길 곳인 avatars 파일은 지우지 않고 끝냄)
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
  update public.storage_purge s set done_at = now()
    where s.done_at is null and s.bucket = 'avatars'
      and (exists (select 1 from public.app_user u where u.avatar_path = s.path)
        or exists (select 1 from public.storage_move m where m.done_at is null and m.to_path = s.path));
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

-- 지울 것이나 옮길 것이 있을 때만 함수 호출(20261105090000에 옮길 것을 더함)
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
  if not orphan and not exists (select 1 from public.storage_purge where done_at is null and attempts < 5)
     and not exists (select 1 from public.storage_move where done_at is null and attempts < 5) then
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

-- 사진 저장·지우기(20261027090000과 같고, 경로가 바뀌거나 지우면 옛 파일을 지울 목록에)
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
  if me.avatar_path is not null and me.avatar_path is distinct from p_path then
    insert into public.storage_purge (bucket, path) values ('avatars', me.avatar_path);
  end if;
  update public.app_user set avatar_path = p_path, avatar_updated_at = now() where id = me.id;
end;
$$;
revoke all on function public.set_avatar(text) from public, anon;
grant execute on function public.set_avatar(text) to authenticated;

-- 이미 옛 공간 경로에 남은 사진(이 마이그레이션 전에 공간이 바뀐 사람)도 옮길 목록에
insert into public.storage_move (user_id, from_path, to_path)
select u.id, u.avatar_path, u.space_id::text || '/' || u.id::text || '.jpg'
from public.app_user u
where u.avatar_path is not null and u.space_id is not null and u.status = 'active'
  and u.avatar_path <> u.space_id::text || '/' || u.id::text || '.jpg';

-- 읽기 정책: 내 공간 폴더 + 같은 공간 사람의 지금 사진 경로(옮기기 전 옛 공간 경로)
do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatars_read') then
    execute 'drop policy avatars_read on storage.objects';
    execute $p$
      create policy avatars_read on storage.objects for select to authenticated
      using (bucket_id = 'avatars'
        and ((storage.foldername(name))[1] = (select u.space_id::text from public.app_user u where u.id = auth.uid())
          or name in (select u.avatar_path from public.app_user u
                      where u.avatar_path is not null
                        and u.space_id = (select m.space_id from public.app_user m where m.id = auth.uid()))))
    $p$;
  end if;
end;
$$;

-- ── 2. 계정 삭제: 모든 기기 로그아웃 ──────────────────────────────────────
-- 20261119110000과 같고, 끝에 그 사람의 로그인 세션(갱신 토큰은 세션과 함께 지워짐)을 지움
CREATE OR REPLACE FUNCTION public.account_deletion_for(uid uuid)
 RETURNS date
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me public.app_user;
  sp public.couple_space;
  other uuid;
  ns uuid;
  x uuid;
begin
  select * into me from public.app_user where id = uid and status = 'active' for update;
  if me.id is null then
    raise exception 'not_active' using errcode = 'P0001';
  end if;
  select * into sp from public.couple_space where id = me.space_id for update;
  select id into other from public.app_user
    where space_id = sp.id and status = 'active' and id <> uid limit 1;

  if sp.id is not null and other is not null and sp.couple_state in ('connected', 'unlink_pending') then
    -- 연결 해제 확정과 같음: 두 사람 모두 빈 새 공간으로, 원래 공간(같이 쓰던 데이터 전부)은 30일 보관 뒤 지움
    update public.couple_unlink set status = 'cancelled', cancelled_at = now()
      where space_id = sp.id and status = 'pending';
    insert into public.couple_unlink (space_id, requested_by, partner_id, deadline, ratio, plan, status, how, confirmed_at,
                                      reconnect_until)
      values (sp.id, uid, other, public.kst_today(), 50, '[]'::jsonb, 'confirmed', 'deleted', now(),
              now() + interval '30 days');
    delete from public.notification where space_id = sp.id;
    delete from public.partner_change where space_id = sp.id;
    foreach x in array array[uid, other] loop
      insert into public.couple_space (couple_state, created_by, unlinked_from)
        values ('solo', x, sp.id) returning id into ns;
      update public.app_user set space_id = ns, onboarding_step = 'S-12H' where id = x;
    end loop;
    update public.couple_space set couple_state = 'solo', deleted_at = now() where id = sp.id;
    perform public.notify(other, (select space_id from public.app_user where id = other), 'partner_deleted',
      coalesce(me.nickname || '님이', '파트너가') || ' 계정을 삭제했어요', '같이 쓰던 데이터는 지웠어요', '/settings/couple/unlinked',
      'user-minus', null, 'deleted:' || uid || ':' || extract(epoch from now())::bigint);
  elsif sp.id is not null then
    update public.invite set expires_at = now() where space_id = sp.id and used_at is null and expires_at > now();
  end if;

  update public.app_user set status = 'deletion_requested', deletion_requested_at = now() where id = uid;
  -- S11-05: 다른 기기도 바로 로그아웃(31 3-2 ‘삭제 요청 즉시 로그아웃’). 세션을 지우면 갱신 토큰도 함께 지워짐(외래 키),
  -- 세션 없이 남은 옛 갱신 토큰도 지움
  delete from auth.sessions where user_id = uid;
  begin
    delete from auth.refresh_tokens where user_id = uid::text;
  exception when insufficient_privilege or undefined_table then
    null;
  end;
  return (now() at time zone 'Asia/Seoul')::date + 30;
end;
$function$
;
revoke execute on function public.account_deletion_for(uuid) from public, anon, authenticated;

-- ── 3. 휴지통 되살리기: 연결 대상이 없으면 'unlinked' ───────────────────
create or replace function public.restore_trash(p_kind text, p_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  t timestamptz;
begin
  if not exists (select 1 from public.trash_rows() r where r.kind = p_kind and r.id = p_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if p_kind = 'asset' then
    update public.asset set deleted_at = null where id = p_id;
  elsif p_kind = 'goal' then
    update public.goal g set deleted_at = null,
      priority = (select coalesce(max(x.priority), 0) + 1 from public.goal x where x.space_id = g.space_id and x.deleted_at is null)
      where g.id = p_id;
    -- 모으는 중인 저금 항목인데 공간에 월급 계획은 있고 넣을 월급 계획(각자면 주인 것)이 없어 저금 줄이 안 생겼으면
    -- 따로 되살린 것(25 S-21 3번). 월급 계획을 아직 안 만든 공간은 원래대로 'restored'
    if exists (select 1 from public.goal g where g.id = p_id and g.closed_at is null
                 and g.status in ('active', 'delayed', 'achieved'))
       and exists (select 1 from public.salary_split s join public.goal g on g.space_id = s.space_id where g.id = p_id)
       and not exists (select 1 from public.split_line l where l.goal_id = p_id) then
      return 'unlinked';
    end if;
  elsif p_kind = 'care_day' then
    select deleted_at into t from public.care_day where id = p_id;
    update public.care_day set deleted_at = null where id = p_id;
    update public.care_record set deleted_at = null
      where care_day_id = p_id and deleted_at is not null and abs(extract(epoch from deleted_at - t)) <= 10;
  end if;
  return 'restored';
end;
$$;

-- ── 4. S-11 로그인 줄: 가입한 소셜 계정 이메일(없으면 null, 애플 ‘이메일 가리기’면 그 주소) ──
create or replace function public.my_login_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select nullif(i.identity_data ->> 'email', '') from auth.identities i
       where i.user_id = u.id and i.provider = u.provider::text
       order by i.created_at limit 1),
    (select nullif(a.email, '') from auth.users a where a.id = u.id))
  from public.app_user u
  where u.id = auth.uid();
$$;
revoke all on function public.my_login_email() from public, anon;
grant execute on function public.my_login_email() to authenticated;
