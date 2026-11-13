-- QA 7구간(저금 W-10~W-13, 2026-11-12) 서버 쪽.
-- 1. goal을 Realtime 발행에 더함(S7-02): 상대가 저금을 고치면 W-10·W-13·월급 탭이 바로 다시 읽음. 읽기 권한은 goal_select 그대로
-- 2. 사용자 결정 D1 = A(S7-01): 합쳐서 모드에서는 주인이 있는 저금(각자일 때 만든 것)도 두 사람 모두 고치고(이름, 목표 금액,
--    기한, 지우기, 달성 뒤 선택) 체크함. 주인 이름은 줄 이름 앞 표시만. 각자 모드 파트너 것은 그대로 보기만.
--    주인이 ‘금액만 보여 주기’로 둔 것은 파트너가 표에서 읽지 못하니(이름 가림) 합쳐서여도 보기만.
--    - saving_item_editable 새 버전(W-12a keep·stop·reopen·unkeep·retarget, W-01 저금 줄 지우기 = 그만 모음)
--    - goal_update 정책: 합쳐서 공간이면 ‘모두 보여 주기’ 주인 있는 항목도
--    - goal_owner_guard: 앱이 바로 바꿀 때 주인은 나 또는 없음 사이만(남의 항목을 내 것으로, 내 항목을 남의 것으로 못 바꿈)
--    - achieve_goal 새 버전: 달성 알림 링크는 합쳐서면 두 사람 모두 W-12 축하
--    - goal_partner_change 새 버전: 합쳐서 모드 주인 있는 항목(모두 보여 주기) 변경도 상대 알림·활동 기록(같이 쓰는 것)
-- 3. 연결 해제 대기 중 앱이 goal을 바로 고치거나 지우는 것을 막음(S7-05, goal_unlink_guard). 공개 범위만 바꾸는 것은 그대로.
--    함수 안(security definer, 해제 확정·휴지통 정리 등)은 current_user가 함수 주인이라 걸리지 않음(goal_client_guard와 같은 방식)
-- 스키마는 추가만(함수 새 버전, 정책 다시 만듦, 트리거 둘, 발행에 표 더함)

-- 1. Realtime 발행 ─────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'goal') then
    alter publication supabase_realtime add table public.goal;
  end if;
end;
$$;

-- 2. 합쳐서 모드 주인 있는 저금도 둘 다 ───────────────────────────────────
create or replace function public.saving_item_editable(p_goal uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  g public.goal;
  sp public.couple_space;
begin
  select * into g from public.goal where id = p_goal and deleted_at is null;
  if g.id is null or not public.is_space_member(g.space_id) then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  select * into sp from public.couple_space where id = g.space_id;
  -- 주인이 있는 항목: 주인, 또는 합쳐서 모드에서 ‘모두 보여 주기’면 파트너도(D1, 2026-11-12)
  if g.owner_user_id is not null and g.owner_user_id <> auth.uid()
     and not (sp.salary_mode = 'joint' and g.visibility = 'all') then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if sp.couple_state = 'unlink_pending' then
    raise exception 'unlink_pending' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.saving_item_editable(uuid) from public, anon, authenticated;

drop policy goal_update on public.goal;
create policy goal_update on public.goal for update to authenticated
  using (public.is_space_member(space_id) and (
    owner_user_id is null or owner_user_id = auth.uid()
    or (visibility = 'all' and exists (
      select 1 from public.couple_space c where c.id = space_id and c.salary_mode = 'joint'))))
  with check (public.is_space_member(space_id) and (
    owner_user_id is null or owner_user_id = auth.uid()
    or (visibility = 'all' and exists (
      select 1 from public.couple_space c where c.id = space_id and c.salary_mode = 'joint'))));

-- 앱이 바로 바꿀 때 주인은 나 ↔ 없음만(우리 → 내 것은 goal_to_mine_guard가 더 봄). 함수 안은 그대로
create or replace function public.goal_owner_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon')
     and new.owner_user_id is distinct from old.owner_user_id
     and ((old.owner_user_id is not null and old.owner_user_id <> auth.uid())
          or (new.owner_user_id is not null and new.owner_user_id <> auth.uid())) then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger goal_owner_guard before update of owner_user_id on public.goal
  for each row execute function public.goal_owner_guard();

create or replace function public.achieve_goal(p_goal uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  g public.goal;
  u record;
  joint boolean;
begin
  select * into g from public.goal where id = p_goal and deleted_at is null for update;
  if g.id is null or not public.is_space_member(g.space_id) then
    raise exception 'not_found' using errcode = '42501';
  end if;
  if g.target_amount is null or g.closed_at is not null then
    return false;
  end if;
  if g.status in ('active', 'delayed') then
    if public.goal_saved(g.id) < g.target_amount then
      return false;
    end if;
    update public.goal set status = 'achieved', achieved_at = now(), achieved_seen = array[uid]
      where id = g.id;
    select c.salary_mode = 'joint' into joint from public.couple_space c where c.id = g.space_id;
    -- 링크(14 표): 고칠 수 있는 사람 = W-12 축하(우리 둘 항목, 주인, 합쳐서 모드의 ‘모두 보여 주기’ 항목은 두 사람 모두,
    -- 2026-11-12 D1), 파트너(각자) = W-10
    for u in select a.id from public.app_user a where a.space_id = g.space_id and a.status = 'active' loop
      perform public.notify(u.id, g.space_id, 'goal_achieved', g.name || ' 목표 금액을 다 모았어요!', null, -- [확인 필요]
        '/salary/items/' || g.id::text
          || case when g.owner_user_id is null or g.owner_user_id = u.id
                    or (coalesce(joint, false) and g.visibility = 'all') then '/achieved' else '' end,
        'trophy', uid, 'goal_achieved:' || g.id::text || ':' || u.id::text);
    end loop;
    return true;
  end if;
  if g.status = 'achieved' and not (uid = any (g.achieved_seen)) then
    update public.goal set achieved_seen = array_append(achieved_seen, uid) where id = g.id;
    return true;
  end if;
  return false;
end;
$$;
revoke all on function public.achieve_goal(uuid) from public, anon;
grant execute on function public.achieve_goal(uuid) to authenticated;

-- 같이 쓰는 저금(우리 둘 항목, 합쳐서 모드의 ‘모두 보여 주기’ 주인 있는 항목) 변경만 상대 알림·활동 기록.
-- 각자 모드 주인 있는 항목은 달성만 알림(14)
create or replace function public.goal_partner_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t text;
begin
  t := '/salary/items/' || new.id;
  -- 주인이 바뀌는 것은 관리 방식 바꾸기(set_salary_mode)뿐이라 그 알림으로 충분
  if tg_op = 'UPDATE' and new.owner_user_id is distinct from old.owner_user_id then
    return null;
  end if;
  if coalesce(new.owner_user_id, old.owner_user_id) is not null and not (
       new.visibility = 'all'
       and exists (select 1 from public.couple_space c where c.id = new.space_id and c.salary_mode = 'joint')) then
    return null;
  end if;
  if tg_op = 'INSERT' then
    perform public.log_partner_change(new.space_id, 'goal_meta', new.id, 'added', new.name, null, '1', false, t);
    return null;
  end if;
  if old.deleted_at is null and new.deleted_at is not null then
    perform public.log_partner_change(new.space_id, 'goal', new.id, 'deleted', new.name, null, '1', true, '/salary');
    return null;
  end if;
  if old.deleted_at is not null and new.deleted_at is null then
    perform public.log_partner_change(new.space_id, 'goal_meta', new.id, 'restored', new.name, null, '1', false, t);
    return null;
  end if;
  if new.closed_at is distinct from old.closed_at then
    perform public.log_partner_change(new.space_id, 'goal_meta', new.id, 'closed', new.name, null,
      case when new.closed_at is null then '0' else '1' end, false, t);
    return null;
  end if;
  -- 달성 상태로 바뀌는 것은 achieve_goal 알림으로
  if new.status is distinct from old.status and new.status = 'achieved' then
    return null;
  end if;
  if new.target_amount is distinct from old.target_amount then
    perform public.log_partner_change(new.space_id, 'goal', new.id, 'amount', new.name,
      case when old.target_amount is not null then public.read_won(old.target_amount) end,
      case when new.target_amount is not null then public.read_won(new.target_amount) end, true, t);
  end if;
  if new.deadline is distinct from old.deadline then
    perform public.log_partner_change(new.space_id, 'goal', new.id, 'deadline', new.name,
      public.ym_label(old.deadline), public.ym_label(new.deadline), true, t);
  end if;
  if new.name is distinct from old.name then
    perform public.log_partner_change(new.space_id, 'goal_meta', new.id, 'name', new.name, old.name, new.name, false, t);
  end if;
  return null;
end;
$$;

-- 3. 연결 해제 대기 중 앱이 바로 고치기·지우기 막기(S7-05) ──────────────────────
-- 화면은 이미 막지만(W-10 고치기 비활성) 표를 바로 고치는 요청도 서버가 거절. 공개 범위(S-13)만 바꾸는 것은 그대로
create or replace function public.goal_unlink_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon')
     and exists (select 1 from public.couple_space c where c.couple_state = 'unlink_pending'
                 and c.id = case when tg_op = 'DELETE' then old.space_id else new.space_id end)
     and (tg_op = 'DELETE'
          or (to_jsonb(new) - array['visibility', 'updated_at', 'updated_by', 'version'])
             is distinct from (to_jsonb(old) - array['visibility', 'updated_at', 'updated_by', 'version'])) then
    raise exception 'unlink_pending' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger goal_unlink_guard before update or delete on public.goal
  for each row execute function public.goal_unlink_guard();
