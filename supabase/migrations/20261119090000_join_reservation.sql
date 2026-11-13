-- 2026-11-11 QA 3구간 D1(S3-01, S3-06): 합류는 끝날 때 공간에 넣는다.
-- ‘합류하기’는 그 코드를 그 사람 몫으로 24시간 잡아 두기만 한다(invite.reserved_by, reserved_until).
-- 잡아 둔 사람은 공간 구성원이 아니라서 RLS로 공간 데이터를 못 읽는다. 합류 흐름에 꼭 필요한 것만 join_context()로 받는다.
-- 합류를 마치는 순간(complete_join, finish_join) 공간에 넣고(_accept_join), 공간은 언제나 2명까지(검사 + 트리거).
-- 시작한 사람은 S-12 ‘합류하는 중’에서 ‘초대 취소’(cancel_invite)로 풀 수 있고, 새 코드 받기(renew_invite)도 잡아 둔 것을 푼다.
-- 스키마는 추가만(열 3개, 트리거 1개, 함수). 기존 함수는 같은 이름·인자로 본문만 바꿈.

alter table public.invite
  add column if not exists reserved_by uuid references auth.users(id) on delete set null,
  add column if not exists reserved_until timestamptz,
  add column if not exists reserved_vis jsonb;
comment on column public.invite.reserved_by is '합류 중인 사람(‘합류하기’를 누름, 아직 구성원 아님). 18 P-01, 25 S-12 ‘합류하는 중’';
comment on column public.invite.reserved_until is '잡아 둔 기한(누른 때 + 24시간). 지나면 다른 사람이 쓸 수 있음';
comment on column public.invite.reserved_vis is 'P-02a에서 고른 옮길 자산 공개 범위(자산 id → all/sum/private). 합류를 마칠 때 씀';
create index if not exists invite_reserved_by_idx on public.invite (reserved_by) where reserved_by is not null;

-- 공간은 2명까지(D1). 누가 어떤 길로 space_id를 바꾸든 세 번째 사람은 막는다
create or replace function public.app_user_space_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.space_id is not null and (tg_op = 'INSERT' or new.space_id is distinct from old.space_id) then
    perform 1 from public.couple_space where id = new.space_id for update;
    if (select count(*) from public.app_user u where u.space_id = new.space_id and u.id <> new.id) >= 2 then
      raise exception 'space_full' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.app_user_space_cap() from public, anon, authenticated;
drop trigger if exists app_user_space_cap on public.app_user;
create trigger app_user_space_cap
  before insert or update of space_id on public.app_user
  for each row execute function public.app_user_space_cap();

-- 예전 방식으로 공간에 들어왔지만 합류를 마치지 않은 사람(코드 used_by만 있음)을 공간에서 빼서 혼자 공간으로.
-- 그 사람 명의 자산·부채와 금액 이력은 함께 옮김(지우지 않음). 처음부터 다시(온보딩)
create or replace function public._detach_pending_member(p_user uuid, p_space uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n uuid;
begin
  if not exists (
    select 1 from public.app_user u join public.couple_space s on s.id = u.space_id
    where u.id = p_user and u.space_id = p_space and s.couple_state = 'not_joined' and s.created_by is distinct from p_user
  ) then
    return;
  end if;
  insert into public.couple_space (created_by) values (p_user) returning id into n;
  update public.asset_history h set space_id = n
    from public.asset a
    where a.id = h.asset_id and a.space_id = p_space and a.owner = 'person' and a.owner_user_id = p_user;
  update public.asset set space_id = n, goal_id = null
    where space_id = p_space and owner = 'person' and owner_user_id = p_user;
  delete from public.notification where user_id = p_user and space_id = p_space;
  update public.app_user set space_id = n, onboarding_step = null, onboarding_done_at = null where id = p_user;
end;
$$;
revoke all on function public._detach_pending_member(uuid, uuid) from public, anon, authenticated;

-- 코드 하나에 잡아 둔 합류를 풂(취소, 새 코드, 기한 지남). 예전 방식 미완료 구성원이면 공간에서 뺌
create or replace function public._release_invite(p_invite uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  i public.invite;
begin
  select * into i from public.invite where id = p_invite for update;
  if i.id is null or i.used_at is not null then
    return;
  end if;
  if i.used_by is not null then
    perform public._detach_pending_member(i.used_by, i.space_id);
  end if;
  update public.invite set reserved_by = null, reserved_until = null, reserved_vis = null, used_by = null
    where id = i.id;
end;
$$;
revoke all on function public._release_invite(uuid) from public, anon, authenticated;

-- 이 공간에서 기한이 지난 합류 잡기를 풂
create or replace function public._release_expired(p_space uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  x uuid;
begin
  for x in
    select i.id from public.invite i
    where i.space_id = p_space and i.used_at is null and i.reserved_until is not null and i.reserved_until <= now()
  loop
    perform public._release_invite(x);
  end loop;
end;
$$;
revoke all on function public._release_expired(uuid) from public, anon, authenticated;

-- 예전 방식 미완료 합류(used_by만 있고 used_at 없음, 그 사람이 구성원): 지금부터 24시간 잡아 둔 것으로 봄.
-- 그 안에 마치면 그대로 합류, 아니면 시작한 사람이 ‘초대 취소’나 새 코드를 받을 때 혼자 공간으로 뺌
update public.invite i
  set reserved_by = i.used_by, reserved_until = now() + interval '24 hours'
  from public.app_user u, public.couple_space s
  where u.id = i.used_by and u.space_id = i.space_id and s.id = i.space_id
    and i.used_at is null and i.used_by is not null and i.reserved_by is null
    and s.couple_state = 'not_joined';

-- 합류 잡기(join_space, join_moving_records 공통). 접속 주소 기준 시도 제한 함수는 20261119100000_invite_guard.sql
create or replace function public._join_reserve(p_code text, p_moving boolean, p_vis jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  me public.app_user;
  i public.invite;
  s public.couple_space;
  starter public.app_user;
  prev uuid;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into me from public.app_user where id = uid and status = 'active' for update;
  if not found then
    raise exception 'not_signed_up' using errcode = 'P0001';
  end if;
  if (select count(*) from public.invite_attempt a where a.user_id = uid and a.created_at > now() - interval '10 minutes') >= 10 then
    return 'locked';
  end if;
  -- 맞는 코드든 아니든 모든 시도를 셈(D2): 사람마다 10분에 10번, 같은 접속 주소 10분에 30번
  insert into public.invite_attempt (user_id) values (uid);
  if public.invite_guard_hit('join_ip', public.client_ip_key(), 30) then
    return 'locked';
  end if;
  select * into i from public.invite where code = upper(btrim(p_code)) for update;
  if not found then
    return 'invalid';
  end if;
  perform public._release_expired(i.space_id);
  select * into i from public.invite where id = i.id;
  select * into s from public.couple_space where id = i.space_id for update;
  select * into starter from public.app_user where id = i.created_by and status = 'active' and space_id = i.space_id;
  if s.id is null or s.deleted_at is not null or starter.id is null then
    return 'unavailable';
  end if;
  if i.used_at is not null then
    return case when i.used_by = uid then 'already_connected' else 'used' end;
  end if;
  if i.used_by = uid and me.space_id = i.space_id then
    return 'resume'; -- 예전 방식으로 공간에 들어온 뒤 멈춘 사람
  end if;
  if (i.used_by is not null and i.used_by <> uid)
     or (i.reserved_by is not null and i.reserved_by <> uid and i.reserved_until > now()) then
    return 'used'; -- 다른 사람이 합류하는 중
  end if;
  if i.expires_at <= now() and not coalesce(i.reserved_by = uid and i.reserved_until > now(), false) then
    return 'expired';
  end if;
  if me.space_id = i.space_id then
    return 'own_code';
  end if;
  if s.couple_state <> 'not_joined'
     or (select count(*) from public.app_user u where u.space_id = i.space_id and u.id <> uid) >= 2 then
    return 'used';
  end if;
  if me.space_id is not null then
    -- 연결 해제를 기다리는 중도 아직 연결된 것(S3-06)
    if exists (select 1 from public.couple_space x where x.id = me.space_id and x.couple_state in ('connected', 'unlink_pending')) then
      return 'already_connected';
    end if;
    -- 혼자 시작한 기록이 있으면 옮기기(P-02a)를 거쳐야 한다
    if not p_moving and (me.onboarding_done_at is not null or exists (
      select 1 from public.goal g where g.space_id = me.space_id and g.deleted_at is null
    )) then
      return 'has_records';
    end if;
  end if;

  prev := case when i.reserved_by = uid then uid end;
  -- 다른 코드에 잡아 둔 것은 풂(한 사람은 코드 하나만)
  update public.invite set reserved_by = null, reserved_until = null, reserved_vis = null
    where reserved_by = uid and id <> i.id and used_at is null;
  update public.invite set
    reserved_by = uid,
    reserved_until = now() + interval '24 hours',
    reserved_vis = case when p_moving then coalesce(p_vis, '{}'::jsonb) else reserved_vis end
  where id = i.id;
  if prev is not null then
    return 'resume';
  end if;
  -- 내 줄만 미리 채움(반대쪽, 시작한 사람이 적어 둔 호칭·월급은 비어 있을 때만). 공간은 합류를 마칠 때 바꿈
  update public.app_user set
    side = case starter.side when 'groom' then 'bride'::public.couple_side when 'bride' then 'groom'::public.couple_side else me.side end,
    nickname = coalesce(me.nickname, s.partner_nickname),
    monthly_income = coalesce(me.monthly_income, s.partner_income),
    onboarding_step = case when exists (
        select 1 from public.asset a where a.space_id = i.space_id and a.owner = 'person'
          and a.owner_user_id is null and a.deleted_at is null and a.created_by <> uid
      ) then 'P-02B' else 'P-03' end
  where id = uid;
  return 'joined';
end;
$$;
revoke all on function public._join_reserve(text, boolean, jsonb) from public, anon, authenticated;

create or replace function public.join_space(p_code text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return public._join_reserve(p_code, false, null);
end;
$$;
revoke all on function public.join_space(text) from public, anon;
grant execute on function public.join_space(text) to authenticated;

-- P-02a 혼자 쓰던 기록 옮기기 + 합류: 지금은 잡아 두고 고른 공개 범위만 기억. 옮기기는 합류를 마칠 때(_accept_join)
create or replace function public.join_moving_records(p_code text, p_vis jsonb default '{}'::jsonb)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  old_space uuid;
  r text;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select space_id into old_space from public.app_user where id = uid and status = 'active';
  if old_space is null or exists (
    select 1 from public.couple_space x where x.id = old_space and x.couple_state in ('connected', 'unlink_pending')
  ) then
    raise exception 'nothing_to_move' using errcode = 'P0001';
  end if;
  if jsonb_typeof(coalesce(p_vis, '{}'::jsonb)) <> 'object' then
    raise exception 'bad_vis' using errcode = '22023';
  end if;
  r := public._join_reserve(p_code, true, coalesce(p_vis, '{}'::jsonb));
  if r not in ('joined', 'resume') then
    raise exception 'join_failed:%', r using errcode = 'P0001';
  end if;
  return r;
end;
$$;
revoke all on function public.join_moving_records(text, jsonb) from public, anon;
grant execute on function public.join_moving_records(text, jsonb) to authenticated;

-- 합류 중인 공간: 이미 구성원(예전 방식, 대기 뒤 이어서)이거나 잡아 둔 코드의 공간
create or replace function public.joining_space()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid uuid;
begin
  select space_id into sid from public.app_user where id = uid and status = 'active';
  if sid is not null and exists (select 1 from public.invite i where i.space_id = sid and i.used_by = uid) then
    return sid;
  end if;
  select i.space_id into sid from public.invite i
    join public.couple_space s on s.id = i.space_id and s.deleted_at is null
    where i.reserved_by = uid and i.reserved_until > now() and i.used_at is null
    order by i.reserved_until desc limit 1;
  if sid is null then
    raise exception 'not_joining' using errcode = '42501';
  end if;
  return sid;
end;
$$;
revoke all on function public.joining_space() from public, anon;
grant execute on function public.joining_space() to authenticated;

-- 합류를 마칠 때 공간에 넣음(잡아 둔 사람만, 2명 검사). 혼자 쓰던 공간: 내 명의 자산·부채를 옮기고
-- 기록이 있으면 30일 보관 뒤 지움(P-02a), 비어 있으면 바로 지움. 이미 구성원이면 아무것도 안 함
create or replace function public._accept_join(p_space uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  me public.app_user;
  s public.couple_space;
  i public.invite;
  starter public.app_user;
  old_space uuid;
  had_records boolean;
begin
  select * into me from public.app_user where id = uid and status = 'active' for update;
  if me.space_id = p_space then
    return;
  end if;
  select * into s from public.couple_space where id = p_space for update;
  select * into i from public.invite
    where space_id = p_space and reserved_by = uid and reserved_until > now() and used_at is null
    order by reserved_until desc limit 1 for update;
  if i.id is null or s.id is null or s.deleted_at is not null then
    raise exception 'not_joining' using errcode = '42501';
  end if;
  if s.couple_state <> 'not_joined'
     or (select count(*) from public.app_user u where u.space_id = p_space and u.id <> uid) >= 2 then
    raise exception 'space_full' using errcode = 'P0001';
  end if;
  old_space := me.space_id;
  if old_space is not null and exists (
    select 1 from public.couple_space x where x.id = old_space and x.couple_state in ('connected', 'unlink_pending')
  ) then
    raise exception 'already_connected' using errcode = 'P0001';
  end if;
  select * into starter from public.app_user where id = s.created_by;
  if old_space is not null then
    had_records := me.onboarding_done_at is not null
      or exists (select 1 from public.goal g where g.space_id = old_space and g.deleted_at is null);
    -- 내 명의 자산·부채와 금액 이력(P-02a에서 고른 공개 범위, 기본 금액만)
    update public.asset_history h set space_id = p_space
      from public.asset a
      where a.id = h.asset_id and a.space_id = old_space and a.owner = 'person'
        and coalesce(a.owner_user_id, a.created_by) = uid;
    update public.asset a set
      space_id = p_space,
      owner_user_id = uid,
      goal_id = null,
      visibility = (case coalesce(i.reserved_vis->>a.id::text, 'sum') when 'all' then 'all' when 'private' then 'private' else 'sum' end)::public.asset_visibility
      where a.space_id = old_space and a.owner = 'person' and coalesce(a.owner_user_id, a.created_by) = uid;
  end if;
  update public.app_user set
    space_id = p_space,
    side = case starter.side when 'groom' then 'bride'::public.couple_side when 'bride' then 'groom'::public.couple_side else me.side end,
    nickname = coalesce(me.nickname, s.partner_nickname),
    monthly_income = coalesce(me.monthly_income, s.partner_income),
    onboarding_done_at = null
  where id = uid;
  update public.invite set used_by = uid where id = i.id;
  -- 원래 공간(다른 사람이 없을 때만): 기록이 있으면 30일 보관 뒤 지움, 없으면 바로 지움
  if old_space is not null and not exists (select 1 from public.app_user u where u.space_id = old_space) then
    if had_records then
      update public.couple_space set deleted_at = now() where id = old_space;
      delete from public.notification where user_id = uid and space_id = old_space;
    else
      delete from public.couple_space where id = old_space;
    end if;
  end if;
end;
$$;
revoke all on function public._accept_join(uuid) from public, anon, authenticated;

-- 합류 완료(18 P-05b 저장): 공간에 넣고 월급 계획 + 첫 체크리스트 + 연결 + 코드 사용됨. 본문은 20261030090000_join_replan.sql과 같음
create or replace function public.complete_join(p_lines jsonb default null, p_version integer default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid uuid := public.joining_space();
  mode public.salary_mode;
  v integer;
begin
  perform public._accept_join(sid);
  select salary_mode into mode from public.couple_space where id = sid;
  if p_lines is not null then
    if mode = 'joint' then
      select version into v from public.salary_split where space_id = sid and owner_user_id is null;
      if p_version is not null and v is distinct from p_version then
        raise exception 'split_changed' using errcode = '40001';
      end if;
      perform public.save_split(p_lines, null);
      perform public.start_checklist(null);
    else
      perform public.save_split(p_lines, uid);
      perform public.start_checklist(uid);
    end if;
  end if;
  update public.couple_space set couple_state = 'connected' where id = sid and couple_state = 'not_joined';
  update public.invite set used_at = coalesce(used_at, now()) where space_id = sid and used_by = uid;
  update public.app_user
    set onboarding_step = case when p_lines is null then 'P-WAIT' else 'P-06' end,
        onboarding_done_at = coalesce(onboarding_done_at, now())
    where id = uid;
  -- 시작한 사람이 대신 입력한 내 명의 자산·부채는 내 것으로(P-02b 동의 뒤)
  update public.asset set owner_user_id = uid
    where space_id = sid and owner = 'person' and owner_user_id is null and created_by <> uid;
end;
$$;
revoke all on function public.complete_join(jsonb, integer) from public, anon;
grant execute on function public.complete_join(jsonb, integer) to authenticated;

-- 월급 계획 없이 합류만 마침(테스트·예전 흐름). 본문은 같고 공간에 넣기만 더함
create or replace function public.finish_join()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid uuid := public.joining_space();
begin
  perform public._accept_join(sid);
  update public.couple_space set couple_state = 'connected' where id = sid and couple_state = 'not_joined';
  update public.invite set used_at = coalesce(used_at, now()) where space_id = sid and used_by = uid;
  update public.app_user set onboarding_step = 'P-11', onboarding_done_at = coalesce(onboarding_done_at, now())
    where id = uid;
  update public.asset set owner_user_id = uid
    where space_id = sid and owner = 'person' and owner_user_id is null and created_by <> uid;
end;
$$;
revoke all on function public.finish_join() from public, anon;
grant execute on function public.finish_join() to authenticated;

-- 합류 흐름에 필요한 것만(공간 구성원이 아니어도). 합류 중이 아니면 null.
-- 시작한 사람 호칭, 관리 방식, 시작한 사람 월급 계획이 있는지(P-04 / 대기), 대신 입력한 내 명의 항목(P-02b),
-- 합쳐서면 다시 채울 공동 월급 계획 줄과 저금 항목(18 P-06 추천값)
create or replace function public.join_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid uuid;
  my uuid;
  s public.couple_space;
  starter public.app_user;
  until timestamptz;
  joint jsonb;
  sp public.salary_split;
begin
  if uid is null then
    return null;
  end if;
  select space_id into my from public.app_user where id = uid and status = 'active';
  if my is not null and exists (select 1 from public.invite i where i.space_id = my and i.used_by = uid) then
    sid := my;
  else
    select i.space_id, i.reserved_until into sid, until from public.invite i
      join public.couple_space x on x.id = i.space_id and x.deleted_at is null
      where i.reserved_by = uid and i.reserved_until > now() and i.used_at is null
      order by i.reserved_until desc limit 1;
  end if;
  if sid is null then
    return null;
  end if;
  select * into s from public.couple_space where id = sid;
  select * into starter from public.app_user where id = s.created_by;
  if s.salary_mode = 'joint' then
    select * into sp from public.salary_split where space_id = sid and owner_user_id is null;
    if sp.id is not null then
      joint := jsonb_build_object(
        'version', sp.version,
        'lines', coalesce((
          select jsonb_agg(jsonb_build_object('kind', l.kind, 'amount', l.amount, 'goal_id', l.goal_id,
                   'user_id', l.user_id, 'name', l.name) order by l.sort)
          from public.split_line l where l.split_id = sp.id), '[]'::jsonb),
        'items', coalesce((
          select jsonb_agg(jsonb_build_object('id', g.id, 'target', g.target_amount, 'deadline', g.deadline,
                   'saved', public.goal_saved(g.id)) order by g.priority, g.created_at)
          from public.goal g where g.space_id = sid and g.deleted_at is null and g.closed_at is null), '[]'::jsonb));
    end if;
  end if;
  return jsonb_build_object(
    'space_id', sid,
    'member', my = sid,
    'reserved_until', until,
    'starter_id', starter.id,
    'starter_nickname', starter.nickname,
    'salary_mode', s.salary_mode,
    'has_plan', exists (select 1 from public.salary_split x where x.space_id = sid and x.owner_user_id is distinct from uid),
    'prefill', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'amount', a.amount, 'estimated', a.estimated)
             order by a.created_at)
      from public.asset a
      where a.space_id = sid and a.owner = 'person' and a.owner_user_id is null and a.created_by <> uid
        and a.deleted_at is null), '[]'::jsonb),
    'joint', joint);
end;
$$;
revoke all on function public.join_context() from public, anon;
grant execute on function public.join_context() to authenticated;

-- 새 코드 받기(25 S-12): 합류하는 중인 사람이 있으면 먼저 풂. 본문은 20261021090000_add_renew_invite.sql과 같음
create or replace function public.renew_invite()
returns table (code text, expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid uuid;
  x uuid;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select u.space_id into sid from public.app_user u where u.id = uid and u.status = 'active';
  if sid is null then
    raise exception 'no_space' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.couple_space s where s.id = sid and s.couple_state <> 'not_joined') then
    raise exception 'already_joined' using errcode = 'P0001';
  end if;
  for x in
    select i.id from public.invite i
    where i.space_id = sid and i.used_at is null and (i.reserved_by is not null or i.used_by is not null)
  loop
    perform public._release_invite(x);
  end loop;
  update public.invite i set expires_at = now()
  where i.space_id = sid and i.used_at is null and i.expires_at > now();
  return query select c.code, c.expires_at from public.create_invite() c;
end;
$$;
revoke all on function public.renew_invite() from public, anon;
grant execute on function public.renew_invite() to authenticated;

-- 초대 취소(25 S-12 ‘합류하는 중’): 합류하는 중인 사람을 풀고 지금 코드도 못 쓰게. 다시 ‘초대하기’로 새 코드
create or replace function public.cancel_invite()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid uuid;
  x uuid;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select u.space_id into sid from public.app_user u where u.id = uid and u.status = 'active';
  if sid is null or not exists (select 1 from public.couple_space s where s.id = sid and s.couple_state = 'not_joined') then
    raise exception 'already_joined' using errcode = 'P0001';
  end if;
  for x in
    select i.id from public.invite i
    where i.space_id = sid and i.used_at is null and (i.reserved_by is not null or i.used_by is not null)
  loop
    perform public._release_invite(x);
  end loop;
  update public.invite i set expires_at = now()
  where i.space_id = sid and i.used_at is null and i.expires_at > now();
end;
$$;
revoke all on function public.cancel_invite() from public, anon;
grant execute on function public.cancel_invite() to authenticated;

-- 다시 연결할 수 있는지(S3-20): S-12 혼자 화면이 ‘다시 연결하기’를 서버와 같은 기준으로 보이게
create or replace function public.my_reconnect_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.reconnect_ok((select m.id from public.my_unlink() m)), false);
$$;
revoke all on function public.my_reconnect_ok() from public, anon;
grant execute on function public.my_reconnect_ok() to authenticated;
