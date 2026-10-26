-- 연결 해제 재기획(25 S-12, 08 7·8장, 2026-10-26 결정): 같이 쓰던 데이터는 나누지 않고 모두 지움.
-- 요청(S-12c ‘연결 해제’ 입력) → 상대 ‘확인했어요’(S-12d) 또는 요청 + 14일이면 확정.
-- 확정 = 두 사람이 각자 빈 새 공간(혼자 쓰기)으로, 처음부터 다시(S-12h → 온보딩 O-11). 원래 공간은 30일 보관(다시 연결용)
-- 뒤 지움(purge_unlinked_spaces), 원래 공간의 알림 기록은 지움. 다시 연결(S-12g) = 원래 공간으로 돌아가고 해제 뒤 새로 만든 데이터는 버림.
-- 대기 중에는 분배표·관리 방식·체크리스트 만드는 날 고치기 멈춤.

-- S-12c 요청(공동 자산 몫 없음). 옛 요청(자산 정리 안)은 지움
drop function public.request_unlink(jsonb, text);
create or replace function public.request_unlink(p_confirm text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  me public.app_user;
  other public.app_user;
  sp public.couple_space;
  new_id uuid;
  dl date := public.kst_today() + 14;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_confirm is distinct from '연결 해제' then
    raise exception 'confirm_mismatch' using errcode = 'P0001';
  end if;
  select * into me from public.app_user where id = uid and status = 'active';
  select * into sp from public.couple_space where id = me.space_id for update;
  if sp.id is null or sp.couple_state <> 'connected' then
    raise exception 'not_connected' using errcode = '42501';
  end if;
  select * into other from public.app_user where space_id = sp.id and status = 'active' and id <> uid limit 1;
  if other.id is null then
    raise exception 'not_connected' using errcode = '42501';
  end if;
  insert into public.couple_unlink (space_id, requested_by, partner_id, deadline, ratio, plan)
    values (sp.id, uid, other.id, dl, 50, '[]'::jsonb)
    returning id into new_id;
  update public.couple_space set couple_state = 'unlink_pending' where id = sp.id;
  perform public.notify(
    other.id, sp.id, 'unlink_requested',
    coalesce(me.nickname, '') || '님이 연결 해제를 요청했어요',
    public.md_label(dl) || '에 해제돼요. 먼저 내보낼 데이터가 있는지 확인해 주세요',
    '/settings/couple/unlink/review', null, uid, 'unlink:' || new_id || ':requested');
  return new_id;
end;
$$;
revoke all on function public.request_unlink(text) from public, anon;
grant execute on function public.request_unlink(text) to authenticated;

-- 확정(내부): 두 사람을 빈 새 공간으로, 원래 공간은 30일 보관, 알림 기록 지움
create or replace function public.finish_unlink(p_id uuid, p_how text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  u public.couple_unlink;
  x uuid;
  n uuid;
begin
  select * into u from public.couple_unlink where id = p_id and status = 'pending' for update;
  if u.id is null then
    raise exception 'no_request' using errcode = 'P0001';
  end if;
  update public.couple_unlink
    set status = 'confirmed', confirmed_at = now(), how = p_how, reconnect_until = now() + interval '30 days'
    where id = u.id;
  delete from public.notification where space_id = u.space_id;
  foreach x in array array[u.requested_by, u.partner_id] loop
    if x is null or not exists (select 1 from public.app_user where id = x and space_id = u.space_id) then
      continue;
    end if;
    insert into public.couple_space (couple_state, created_by, unlinked_from)
      values ('solo', x, u.space_id) returning id into n;
    -- 이름·로그인은 남김. 해제 안내(S-12h)를 먼저 보고 ‘시작하기’로 온보딩 O-11부터
    update public.app_user set space_id = n, onboarding_step = 'S-12H' where id = x;
    perform public.notify(x, n, 'unlink_confirmed', '연결이 해제됐어요',
      '30일 안에 다시 연결하면 되돌릴 수 있어요', '/settings/couple/unlinked', null, null,
      'unlink:' || u.id || ':confirmed:' || x);
  end loop;
  update public.couple_space set couple_state = 'solo', deleted_at = now() where id = u.space_id;
end;
$$;
revoke all on function public.finish_unlink(uuid, text) from public, anon, authenticated;

-- S-12d ‘확인했어요’(받은 사람) → 바로 확정
create or replace function public.agree_unlink()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  me public.app_user;
  u public.couple_unlink;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into me from public.app_user where id = uid and status = 'active';
  select * into u from public.couple_unlink where space_id = me.space_id and status = 'pending';
  if u.id is null then
    raise exception 'no_request' using errcode = 'P0001';
  end if;
  if u.requested_by = uid then
    raise exception 'not_partner' using errcode = '42501';
  end if;
  perform public.finish_unlink(u.id, 'agreed');
end;
$$;

-- 매일 오전 9시(한국): 요청 + 14일이 된 대기 요청은 확정(기한 2일 전 알림은 없앰)
create or replace function public.run_unlink_deadlines()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  u public.couple_unlink;
begin
  for u in select * from public.couple_unlink where status = 'pending' and deadline <= public.kst_today() loop
    perform public.finish_unlink(u.id, 'deadline');
  end loop;
end;
$$;

-- S-12h ‘시작하기’: 혼자 쓰기 온보딩 O-11부터(이름 O-03, 초대 O-06은 건너뜀)
create or replace function public.start_after_unlink()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.app_user set onboarding_step = 'O-11', onboarding_done_at = null
    where id = auth.uid() and onboarding_step = 'S-12H';
end;
$$;
revoke all on function public.start_after_unlink() from public, anon;
grant execute on function public.start_after_unlink() to authenticated;

-- S-12g 답: 받아들이면 원래 공간으로 돌아가고 해제 뒤 각자 새로 만든 공간(데이터)은 지움
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
    update public.app_user
      set space_id = s, onboarding_step = 'O-60', onboarding_done_at = coalesce(onboarding_done_at, now())
      where id = x;
    delete from public.couple_space where id = n and unlinked_from = s;
  end loop;
  update public.couple_space set couple_state = 'connected', deleted_at = null where id = s;
  update public.couple_unlink
    set reconnect_answer = 'accepted', status = 'reconnected', reconnected_at = now()
    where id = u.id;
  select coalesce(nickname, '') into who from public.app_user where id = uid;
  perform public.notify(
    u.reconnect_by, s, 'reconnected', who || '님과 다시 연결됐어요', '해제 전 같이 쓰던 목표와 분배표가 돌아왔어요',
    '/', null, uid, 'reconnect:' || u.id || ':accepted');
end;
$$;

-- 분배표 저장: 해제 대기 중 막음
create or replace function public.save_split(p_lines jsonb, p_owner uuid default null)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid uuid := (select space_id from public.app_user where id = auth.uid());
  mode public.salary_mode;
  split uuid;
  l jsonb;
  i integer := 0;
  customs integer := 0;
  k public.split_line_kind;
begin
  if sid is null then
    raise exception 'no_space' using errcode = '42501';
  end if;
  select salary_mode into mode from public.couple_space where id = sid;
  -- 연결 해제 대기 중에는 분배표를 고칠 수 없음(25 ‘연결 해제, 대기와 혼자 쓰기’ 2번)
  if (select couple_state from public.couple_space where id = sid) = 'unlink_pending' then
    raise exception 'unlink_pending' using errcode = '42501';
  end if;
  if mode = 'joint' and p_owner is not null then
    raise exception 'joint_split_has_no_owner' using errcode = '22023';
  end if;
  if mode = 'separate' and (p_owner is null
      or not exists (select 1 from public.app_user where id = p_owner and space_id = sid)) then
    raise exception 'bad_owner' using errcode = '22023';
  end if;
  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) > 60 then
    raise exception 'bad_lines' using errcode = '22023';
  end if;

  select id into split from public.salary_split
    where space_id = sid and owner_user_id is not distinct from p_owner;
  if split is null then
    insert into public.salary_split (space_id, owner_user_id, updated_by)
      values (sid, p_owner, uid) returning id into split;
  else
    update public.salary_split set updated_by = uid, updated_at = now(), version = version + 1
      where id = split;
    delete from public.split_line where split_id = split;
  end if;

  for l in select * from jsonb_array_elements(p_lines) loop
    k := (l->>'kind')::public.split_line_kind;
    if k = 'saving' and not exists (
        select 1 from public.goal g
        where g.id = (l->>'goal_id')::uuid and g.space_id = sid and g.deleted_at is null) then
      raise exception 'bad_goal' using errcode = '22023';
    end if;
    if k = 'allowance' and (l->>'user_id') is not null and not exists (
        select 1 from public.app_user where id = (l->>'user_id')::uuid and space_id = sid) then
      raise exception 'bad_user' using errcode = '22023';
    end if;
    if k = 'custom' then
      customs := customs + 1;
      if customs > 10 then
        raise exception 'too_many_custom' using errcode = '22023';
      end if;
    end if;
    insert into public.split_line (split_id, space_id, kind, goal_id, user_id, name, amount, sort)
    values (
      split, sid, k,
      case when k = 'saving' then (l->>'goal_id')::uuid end,
      case when k = 'allowance' then coalesce((l->>'user_id')::uuid, p_owner, uid) end,
      case when k = 'custom' then btrim(l->>'name') end,
      (l->>'amount')::bigint,
      i
    );
    i := i + 1;
  end loop;
  perform public.sync_checklist(split);
  return split;
end;
$$;

