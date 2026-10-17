-- 다시 연결(S-12 “다시 연결하기” → 상대 S-12g), 혼자 쓰기에서 새로 초대하기, 30일 뒤 원래 공간 지우기.
-- 08 부부·제안·권한 3장 ‘30일 재연결’, 25 S-12g, 31 보안·개인정보 4장.
--
-- 다시 연결 = 원래 공간(해제 전 공동 데이터 그대로 보관)으로 두 사람이 돌아감.
--   해제 뒤 각자 바뀐 내 명의 항목(자산·부채와 그 기록, 개인 통장, 수입 항목·이벤트)과 내 알림은 그대로 원래 공간으로 옮김.
--   새 공간에서 만든 사본(공동 자산 몫 사본, 목표·플랜 사본 등)은 버림(새 공간을 지운 표시).
--   내 명의 자산이 사본 목표에 이어져 있으면 원래 목표로, 새로 만든 목표면 연결을 끊음.
-- 조건: 확정 뒤 30일 안, 두 사람 모두 해제로 만든 새 공간에 혼자 있음(새로 초대했어도 아직 아무도 합류하지 않음).
-- 요청은 한 번에 하나, ‘괜찮아요’면 닫히고 30일 안이면 다시 요청 가능. 30일이 지나면 열린 요청도 만료.
-- 30일이 지나면 원래 공간을 지움(분리 확정, 복구 불가). 해제 요청 기록도 같이 지워짐.

alter table public.couple_unlink drop constraint if exists couple_unlink_status_check;
alter table public.couple_unlink add constraint couple_unlink_status_check
  check (status in ('pending', 'cancelled', 'confirmed', 'reconnected'));
alter table public.couple_unlink
  add column reconnect_by uuid references public.app_user (id),
  add column reconnect_at timestamptz,
  add column reconnect_answer text check (reconnect_answer in ('accepted', 'declined')),
  add column reconnected_at timestamptz;

-- 내 해제(지금 공간이 그 해제로 만든 공간일 때). 다시 연결된 뒤에는 원래 공간에서 보지 않음
create or replace function public.my_unlink()
returns setof public.couple_unlink
language sql
stable
security definer
set search_path = ''
as $$
  select u.* from public.couple_unlink u
  join public.couple_space s on s.unlinked_from = u.space_id
  join public.app_user me on me.space_id = s.id and me.id = auth.uid()
  where u.status = 'confirmed' and (u.requested_by = me.id or u.partner_id = me.id)
  order by u.confirmed_at desc limit 1;
$$;

-- 다시 연결할 수 있는지(30일 안, 두 사람 모두 그 해제로 만든 공간에 혼자)
-- (행 타입 하나를 받으면 PostgREST가 계산 열로 보여서 id로 받음)
create or replace function public.reconnect_ok(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select u.status = 'confirmed' and u.reconnect_until > now()
    and (select count(*) from public.app_user m
         join public.couple_space s on s.id = m.space_id
         where m.id in (u.requested_by, u.partner_id) and m.status = 'active'
           and s.unlinked_from = u.space_id and s.deleted_at is null
           and s.couple_state in ('solo', 'not_joined')
           and (select count(*) from public.app_user o where o.space_id = s.id and o.status = 'active') = 1) = 2
  from public.couple_unlink u where u.id = p_id;
$$;
revoke execute on function public.reconnect_ok(uuid) from public, anon, authenticated;

-- S-12 “다시 연결하기”
create or replace function public.request_reconnect()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  u public.couple_unlink;
  other uuid;
  who text;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into u from public.couple_unlink where id = (select m.id from public.my_unlink() m) for update;
  if u.id is null or not coalesce(public.reconnect_ok(u.id), false) then
    raise exception 'reconnect_closed' using errcode = 'P0001';
  end if;
  if u.reconnect_by is not null and u.reconnect_answer is null then
    raise exception 'already_requested' using errcode = 'P0001';
  end if;
  update public.couple_unlink
    set reconnect_by = uid, reconnect_at = now(), reconnect_answer = null
    where id = u.id;
  other := case when u.requested_by = uid then u.partner_id else u.requested_by end;
  select coalesce(nickname, '') into who from public.app_user where id = uid;
  perform public.notify(
    other, (select space_id from public.app_user where id = other), 'reconnect_requested',
    who || '님이 다시 연결하자고 해요', '연결하면 해제 전 공동 데이터가 돌아와요',
    '/settings/couple/reconnect', null, uid,
    'reconnect:' || u.id || ':' || extract(epoch from now())::bigint);
end;
$$;
revoke execute on function public.request_reconnect() from public, anon;
grant execute on function public.request_reconnect() to authenticated;

-- S-12g 답(받은 사람): accept면 원래 공간으로 되돌림, 아니면 요청만 닫음(알림 없음)
create or replace function public.answer_reconnect(p_accept boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  u public.couple_unlink;
  s uuid;
  x uuid;
  n uuid;
  who text;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into u from public.couple_unlink where id = (select m.id from public.my_unlink() m) for update;
  if u.id is null or u.reconnect_by is null or u.reconnect_answer is not null then
    raise exception 'no_request' using errcode = 'P0001';
  end if;
  if u.reconnect_by = uid then
    raise exception 'not_partner' using errcode = '42501';
  end if;
  if not p_accept then
    update public.couple_unlink set reconnect_answer = 'declined' where id = u.id;
    return;
  end if;
  if not coalesce(public.reconnect_ok(u.id), false) then
    raise exception 'reconnect_closed' using errcode = 'P0001';
  end if;

  s := u.space_id;
  foreach x in array array[u.requested_by, u.partner_id] loop
    select space_id into n from public.app_user where id = x;
    -- 내 명의 항목(사본이 아닌 것)을 원래 공간으로. 사본 목표에 이어진 것은 원래 목표로, 새 목표면 끊음
    update public.asset a set space_id = s,
      goal_id = (select c.old_id from public.unlink_copy c
                 where c.unlink_id = u.id and c.user_id = x and c.tbl = 'goal' and c.new_id = a.goal_id)
      where a.space_id = n and a.owner = 'person' and a.owner_user_id = x
        and a.id not in (select c.new_id from public.unlink_copy c
                         where c.unlink_id = u.id and c.user_id = x and c.tbl = 'asset');
    update public.asset_history h set space_id = s
      where h.space_id = n and h.asset_id in (select id from public.asset where space_id = s);
    update public.account set space_id = s
      where space_id = n and role = 'personal' and owner_user_id = x;
    update public.income_item set space_id = s where space_id = n and owner_user_id = x;
    update public.income_event set space_id = s where space_id = n and owner_user_id = x;
    update public.notification set space_id = s where space_id = n and user_id = x;
    update public.couple_space set deleted_at = now() where id = n;
    update public.app_user set space_id = s where id = x;
  end loop;
  update public.couple_space set couple_state = 'connected', deleted_at = null where id = s;
  update public.couple_unlink
    set reconnect_answer = 'accepted', status = 'reconnected', reconnected_at = now()
    where id = u.id;

  select coalesce(nickname, '') into who from public.app_user where id = uid;
  perform public.notify(
    u.reconnect_by, s, 'reconnected', who || '님과 다시 연결됐어요', '해제 전 공동 데이터를 되살렸어요',
    '/', null, uid, 'reconnect:' || u.id || ':accepted');
end;
$$;
revoke execute on function public.answer_reconnect(boolean) from public, anon;
grant execute on function public.answer_reconnect(boolean) to authenticated;

-- 혼자 쓰기 → 새로 초대하기(미합류로). 이후 초대 코드는 create_invite
create or replace function public.start_new_invite()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid uuid;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select space_id into sid from public.app_user where id = uid and status = 'active';
  update public.couple_space set couple_state = 'not_joined', partner_nickname = null
    where id = sid and couple_state = 'solo';
  if not found then
    raise exception 'not_solo' using errcode = 'P0001';
  end if;
end;
$$;
revoke execute on function public.start_new_invite() from public, anon;
grant execute on function public.start_new_invite() to authenticated;

-- 매일: 30일이 지난 해제의 원래 공간 지우기(분리 확정). 열린 다시 연결 요청도 함께 사라짐
create or replace function public.purge_unlinked_spaces()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  u public.couple_unlink;
begin
  for u in select * from public.couple_unlink where status = 'confirmed' and reconnect_until <= now() loop
    -- 혹시 원래 공간에 남은 사람이 있으면 지우지 않음
    if exists (select 1 from public.app_user where space_id = u.space_id) then
      continue;
    end if;
    delete from public.couple_space where id = u.space_id and deleted_at is not null;
  end loop;
end;
$$;
revoke execute on function public.purge_unlinked_spaces() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('purge-unlinked-spaces', '30 19 * * *', 'select public.purge_unlinked_spaces()');
  end if;
end;
$$;

-- 혼자 쓰기 화면의 상대 호칭(해제 뒤에는 상대 행을 못 읽음)
create or replace function public.unlink_partner_name()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.nickname from public.my_unlink() u
  join public.app_user p on p.id = case when u.requested_by = auth.uid() then u.partner_id else u.requested_by end;
$$;
revoke execute on function public.unlink_partner_name() from public, anon;
grant execute on function public.unlink_partner_name() to authenticated;
