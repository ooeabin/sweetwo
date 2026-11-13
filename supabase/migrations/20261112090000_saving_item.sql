-- ADR 0007(2026-11-08): 목표를 월급 체크리스트의 저금 항목으로(docs/spec/20-salary-plan.md ‘저금 항목’, W-10~W-12).
-- 스키마는 추가만: goal 테이블을 저금 항목 행으로 그대로 쓰고(이름, 목표 금액, 기한, 주인, 공개 범위, 달성 기록),
-- 템플릿·형태·우선순위·이미 모은 돈·사진·freed_lines 쓰임새와 goal_move(넣기·빼기·꺼내 쓰기)는 새 코드에서 쓰지 않는다.
-- 지우는 것은 2단계(쓰는 곳 0 확인 뒤 다음 마이그레이션).
--
-- 1. goal.closed_at: ‘그만할게요’(W-12a)로 그만 모은 때. 그만 모은 항목은 월급 계획에 줄이 없고 기록만 남음
-- 2. 모은 돈 = 그 저금 항목 저금 줄을 체크한 금액 합(goal_saved). 이미 모은 돈·넣기·빼기·꺼내 쓰기는 세지 않음
-- 3. 저금 줄 맞추기(goal_lines_sync): 각자 = 주인 월급 계획에만(주인이 없으면 만든 사람), 합쳐서 = 공동 월급 계획.
--    달성해도 줄은 그대로(고를 때까지), 그만 모음·휴지통이면 뺌. 빼는 줄 금액은 freed_lines에 두었다가 되살릴 때 그 금액으로
-- 4. add_saving_item(W-11): 저금 항목 + 내(합쳐서면 공동) 월급 계획 저금 묶음 맨 아래 줄을 한 번에
-- 5. 달성(W-12): achieve_goal은 목표 금액이 있는 항목이면 모두. 알림 문구·링크를 저금 항목으로
--    W-12a: saving_item_keep(목표 금액·기한 지우고 계속) / saving_item_stop(그만 모음), 되돌리기 saving_item_unkeep / saving_item_reopen
-- 6. 관리 방식 합쳐서 → 각자: 주인 없는 저금 항목은 만든 사람(없으면 기준일 사람) 월급 계획으로 통째로 옮기고 그 사람이 주인
-- 7. 문구: ‘개인 목표’ → ‘개인 저금’, 첫 목표 알림 → 월급 계획, 파트너 변경 링크·문구
-- 8. 스테이징 데이터 옮기기(ADR 0007 5장)

alter table public.goal add column closed_at timestamptz;

-- 2. 모은 돈(권한 확인 없이, 함수 안에서만)
create or replace function public.goal_saved(p_goal uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(coalesce(l.actual, l.planned)), 0)::bigint
  from public.pay_check_line l
  where l.goal_id = p_goal and l.kind = 'saving' and l.state = 'checked';
$$;
revoke all on function public.goal_saved(uuid) from public, anon, authenticated;

-- 3. 저금 줄 맞추기
create or replace function public.goal_lines_sync(p_goal uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  g public.goal;
  mode public.salary_mode;
  s record;
  last smallint;
  want boolean;
  amt bigint;
  freed jsonb;
begin
  select * into g from public.goal where id = p_goal;
  if g.id is null then
    return;
  end if;
  freed := coalesce(g.freed_lines, '{}'::jsonb);
  select salary_mode into mode from public.couple_space where id = g.space_id;
  for s in select * from public.salary_split where space_id = g.space_id loop
    want := g.deleted_at is null and g.closed_at is null and g.status in ('active', 'delayed', 'achieved') and (
      (mode = 'joint' and s.owner_user_id is null)
      or (mode = 'separate' and s.owner_user_id is not null
          and s.owner_user_id = coalesce(g.owner_user_id, g.created_by)));
    if want and not exists (select 1 from public.split_line where split_id = s.id and goal_id = g.id) then
      select coalesce(max(sort), -1) into last from public.split_line where split_id = s.id and kind = 'saving';
      update public.split_line set sort = sort + 1 where split_id = s.id and sort > last;
      insert into public.split_line (split_id, space_id, kind, goal_id, amount, sort)
        values (s.id, g.space_id, 'saving', g.id, coalesce((freed ->> s.id::text)::bigint, 0), last + 1);
      freed := freed - s.id::text;
      perform public.sync_checklist(s.id);
    elsif not want and exists (select 1 from public.split_line where split_id = s.id and goal_id = g.id) then
      select coalesce(sum(amount), 0) into amt from public.split_line where split_id = s.id and goal_id = g.id;
      if amt > 0 then
        freed := freed || jsonb_build_object(s.id::text, amt);
      end if;
      delete from public.split_line where split_id = s.id and goal_id = g.id;
      perform public.sync_checklist(s.id);
    end if;
  end loop;
  if freed is distinct from coalesce(g.freed_lines, '{}'::jsonb) then
    update public.goal set freed_lines = freed where id = g.id;
  end if;
end;
$$;
revoke all on function public.goal_lines_sync(uuid) from public, anon, authenticated;

create or replace function public.goal_lines_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT'
     or new.status is distinct from old.status
     or new.deleted_at is distinct from old.deleted_at
     or new.closed_at is distinct from old.closed_at
     or new.owner_user_id is distinct from old.owner_user_id then
    perform public.goal_lines_sync(new.id);
  end if;
  return null;
end;
$$;

-- 우리 → 내 바꾸기 막기는 앱이 직접 바꿀 때만(security invoker라 관리 방식 바꾸기·데이터 옮기기 같은 함수 안에서는
-- current_user가 함수 주인이라 그대로 지나감, goal_client_guard와 같은 방식)
create or replace function public.goal_to_mine_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon')
     and old.owner_user_id is null and new.owner_user_id is not null and exists (
      select 1 from public.pay_check_line l
      where l.goal_id = old.id and l.state = 'checked' and l.checked_by is not null
        and l.checked_by <> new.owner_user_id
    ) then
    raise exception 'partner_saved' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- 4. 저금 항목 추가(W-11). 각자면 내 것(내 월급 계획), 합쳐서면 우리 둘 것(공동 월급 계획). id를 돌려줌
create or replace function public.add_saving_item(
  p_name text, p_monthly bigint, p_target bigint default null, p_deadline date default null)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sp public.couple_space;
  owner uuid;
  split uuid;
  gid uuid;
  nm text := btrim(coalesce(p_name, ''));
begin
  select c.* into sp from public.couple_space c
    join public.app_user u on u.space_id = c.id where u.id = uid;
  if sp.id is null then
    raise exception 'no_space' using errcode = '42501';
  end if;
  if sp.couple_state = 'unlink_pending' then
    raise exception 'unlink_pending' using errcode = '42501';
  end if;
  if char_length(nm) < 1 or char_length(nm) > 20 then
    raise exception 'bad_name' using errcode = '22023';
  end if;
  if p_monthly is null or p_monthly < 0 or p_monthly > 99999999999 or p_monthly % 10000 <> 0 then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  if p_target is not null and (p_target < 1 or p_target > 99999999999) then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  if p_deadline is not null and (p_target is null
      or p_deadline < date_trunc('month', public.kst_today())::date) then
    raise exception 'bad_deadline' using errcode = '22023';
  end if;
  owner := case when sp.salary_mode = 'joint' then null else uid end;
  select id into split from public.salary_split
    where space_id = sp.id and owner_user_id is not distinct from owner;
  if split is null then
    raise exception 'no_split' using errcode = '22023';
  end if;
  insert into public.goal (space_id, template, name, kind, priority, target_amount, deadline, owner_user_id, created_by)
    values (sp.id, 'custom', nm, 'once',
      coalesce((select max(priority) + 1 from public.goal where space_id = sp.id), 1),
      p_target, case when p_deadline is null then null else date_trunc('month', p_deadline)::date end, owner, uid)
    returning id into gid;
  if p_monthly > 0 then
    update public.split_line set amount = p_monthly where split_id = split and goal_id = gid;
    perform public.sync_checklist(split);
  end if;
  return gid;
end;
$$;
revoke all on function public.add_saving_item(text, bigint, bigint, date) from public, anon;
grant execute on function public.add_saving_item(text, bigint, bigint, date) to authenticated;

-- 5. 달성 표시 + 축하 화면을 볼지(이 사람이 처음이면 true). 목표 금액이 있고 모은 돈이 닿은 항목만
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
    for u in select a.id from public.app_user a where a.space_id = g.space_id and a.status = 'active' loop
      perform public.notify(u.id, g.space_id, 'goal_achieved', g.name || ' 목표 금액을 다 모았어요!', null, -- [확인 필요]
        '/salary/items/' || g.id::text, 'trophy', uid, 'goal_achieved:' || g.id::text || ':' || u.id::text);
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

-- 고칠 수 있는 저금 항목만(각자 = 주인, 합쳐서 = 둘 다). 해제 대기 중이면 안 됨
create or replace function public.saving_item_editable(p_goal uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  g public.goal;
begin
  select * into g from public.goal where id = p_goal and deleted_at is null;
  if g.id is null or not public.is_space_member(g.space_id)
     or (g.owner_user_id is not null and g.owner_user_id <> auth.uid()) then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if exists (select 1 from public.couple_space where id = g.space_id and couple_state = 'unlink_pending') then
    raise exception 'unlink_pending' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.saving_item_editable(uuid) from public, anon, authenticated;

-- W-12a ‘계속 모을게요’: 목표 금액·기한만 지우고 줄은 그대로(모은 돈도 그대로)
create or replace function public.saving_item_keep(p_goal uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  g public.goal;
begin
  perform public.saving_item_editable(p_goal);
  select * into g from public.goal where id = p_goal;
  if g.status <> 'achieved' then
    raise exception 'not_achieved' using errcode = '22023';
  end if;
  update public.goal set target_amount = null, deadline = null, status = 'active',
    achieved_at = null, achieved_seen = '{}'
  where id = g.id;
end;
$$;
revoke all on function public.saving_item_keep(uuid) from public, anon;
grant execute on function public.saving_item_keep(uuid) to authenticated;

-- ‘계속 모을게요’ 되돌리기(Toast): 지운 목표 금액·기한을 돌려놓고 달성 상태로
create or replace function public.saving_item_unkeep(p_goal uuid, p_target bigint, p_deadline date default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  g public.goal;
begin
  perform public.saving_item_editable(p_goal);
  select * into g from public.goal where id = p_goal;
  if p_target is null or p_target < 1 or p_target > 99999999999 then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  update public.goal set target_amount = p_target, deadline = p_deadline, status = 'achieved',
    achieved_at = now(), achieved_seen = array[auth.uid()]
  where id = g.id;
end;
$$;
revoke all on function public.saving_item_unkeep(uuid, bigint, date) from public, anon;
grant execute on function public.saving_item_unkeep(uuid, bigint, date) to authenticated;

-- W-12a ‘그만할게요’: 월급 계획에서 줄을 빼고(다음 체크리스트부터 없음) 기록은 남김
create or replace function public.saving_item_stop(p_goal uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  g public.goal;
begin
  perform public.saving_item_editable(p_goal);
  select * into g from public.goal where id = p_goal;
  if g.closed_at is null then
    update public.goal set closed_at = now() where id = g.id;
  end if;
end;
$$;
revoke all on function public.saving_item_stop(uuid) from public, anon;
grant execute on function public.saving_item_stop(uuid) to authenticated;

-- ‘그만할게요’ 되돌리기(Toast): 다시 모으는 중으로, 줄은 그만두기 전 금액으로 돌아옴
create or replace function public.saving_item_reopen(p_goal uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  g public.goal;
begin
  perform public.saving_item_editable(p_goal);
  select * into g from public.goal where id = p_goal;
  update public.goal set closed_at = null where id = g.id;
end;
$$;
revoke all on function public.saving_item_reopen(uuid) from public, anon;
grant execute on function public.saving_item_reopen(uuid) to authenticated;

-- 7. 파트너 ‘금액만 보여 주기’ 저금 항목은 이름 대신 “개인 저금”
create or replace function public.space_goals()
returns setof public.goal
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when g.owner_user_id is not null and g.owner_user_id <> auth.uid() and g.visibility = 'amount'
      then jsonb_populate_record(g, jsonb_build_object('name', '개인 저금', 'template', 'custom', 'details', '{}'::jsonb,
        'photo_path', null, 'photo_preset', null)) -- [확인 필요]
    else g
  end
  from public.goal g
  where public.is_space_member(g.space_id);
$$;
revoke execute on function public.space_goals() from public, anon;
grant execute on function public.space_goals() to authenticated;

-- 시작한 사람이 온보딩을 마치면(월급 계획을 만들면) 기다리던 합류자에게
create or replace function public.notify_first_goal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  waiting public.app_user;
begin
  if old.onboarding_done_at is null and new.onboarding_done_at is not null and new.space_id is not null then
    select * into waiting from public.app_user
      where space_id = new.space_id and id <> new.id and status = 'active' and onboarding_step = 'P-WAIT' limit 1;
    if waiting.id is not null then
      perform public.notify(
        waiting.id, new.space_id, 'first_goal',
        coalesce(new.nickname || '님이', '파트너가') || ' 월급 계획을 만들었어요', -- [확인 필요] 2026-11-08
        '이어서 내 월급 계획을 만들어요', '/join/p-04', null, new.id, 'first_goal:' || new.space_id);
    end if;
  end if;
  return new;
end;
$$;

-- 우리 둘 저금 항목(주인 없음, 합쳐서) 변경만 상대 알림·활동 기록. 주인이 있는 항목은 달성만 알림(14)
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
  if coalesce(new.owner_user_id, old.owner_user_id) is not null then
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

create or replace function public.partner_change_title(p_topic text, p_noun text, who text)
returns text
language sql
immutable
set search_path = ''
as $$
  select who || '님이 ' || case
    when p_topic = 'split' then '월급 계획을 바꿨어요'
    when p_topic = 'income' then '월급을 바꿨어요' -- [확인 필요]
    when p_topic in ('goal', 'goal_meta', 'goal_move') then p_noun || ' 저금 항목을 바꿨어요' -- [확인 필요] 2026-11-08
    when p_topic = 'asset' then '우리 자산을 바꿨어요'
    when p_topic = 'care' then '챙길 날을 바꿨어요' -- [확인 필요]
    when p_topic = 'cycle_day' then '체크리스트 만드는 날을 바꿨어요'
    when p_topic = 'couple' then '결혼 정보를 바꿨어요' -- [확인 필요]
    else '바꿨어요' end;
$$;

create or replace function public.partner_change_line(p_topic text, p_field text, p_noun text, p_before text, p_after text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_topic = 'split' then p_noun || ' ' || coalesce(p_before, '0원') || ' → ' || coalesce(p_after, '0원')
    when p_topic = 'income' then coalesce(p_before, '0원') || ' → ' || coalesce(p_after, '0원')
    when p_topic in ('goal', 'goal_meta') and p_field = 'deleted' then '저금 항목을 지웠어요' -- [확인 필요]
    when p_topic in ('goal', 'goal_meta') and p_field = 'restored' then '저금 항목을 되살렸어요' -- [확인 필요]
    when p_topic = 'goal_meta' and p_field = 'added' then '저금 항목을 추가했어요' -- [확인 필요]
    when p_topic = 'goal_meta' and p_field = 'closed' then
      case when p_after = '0' then '다시 모으기로 했어요' else '그만 모으기로 했어요' end -- [확인 필요]
    when p_topic = 'goal_meta' and p_field = 'order' then '목표 순서를 바꿨어요' -- (예전 기록)
    when p_topic = 'goal_meta' and p_field = 'photo' then '목표 사진을 바꿨어요' -- (예전 기록)
    when p_topic in ('goal', 'goal_meta') then
      case p_field when 'amount' then '목표 금액' when 'deadline' then '기한' when 'name' then '이름'
        when 'status' then '상태' when 'kind' then '형태' when 'owner' then '종류' else p_field end
      || ' ' || coalesce(p_before, '없음') || ' → ' || coalesce(p_after, '없음')
    when p_topic = 'goal_move' then coalesce(p_after, '') -- (예전 기록)
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

-- 6. 월급 관리 방식 바꾸기(25 S-11f). 최신 정의 20261111210000_partner_terms.sql에서 저금 줄만 바꿈:
--    각자 → 합쳐서 = 저금 줄은 모두 공동으로(같은 항목은 한 줄), 합쳐서 → 각자 = 저금 항목은 주인(없으면 만든 사람,
--    그도 없으면 기준일 사람) 월급 계획으로 통째로 + 그 사람이 주인. 고정지출·생활비는 수입 비율로 나눔(그대로)
create or replace function public.set_salary_mode(p_mode public.salary_mode)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid uuid := (select space_id from public.app_user where id = auth.uid());
  sp public.couple_space;
  me public.app_user;
  other public.app_user;
  joint_id uuid;
  a_id uuid;
  b_id uuid;
  cd uuid; -- 기준일 사람(남는 차이를 받는 쪽)
  share numeric; -- 기준일이 아닌 사람 몫 비율
  l record;
  n integer := 0;
  na integer := 0;
  nb integer := 0;
  part bigint;
  who uuid;
begin
  if sid is null then
    raise exception 'no_space' using errcode = '42501';
  end if;
  select * into sp from public.couple_space where id = sid for update;
  if sp.couple_state = 'unlink_pending' then
    raise exception 'unlink_pending' using errcode = '42501';
  end if;
  if sp.salary_mode = p_mode then
    return;
  end if;
  select * into me from public.app_user where id = uid;
  select * into other from public.app_user where space_id = sid and id <> uid and status = 'active' limit 1;

  if p_mode = 'joint' then
    insert into public.salary_split (space_id, owner_user_id, updated_by) values (sid, null, uid) returning id into joint_id;
    -- 저금: 같은 항목은 합침, 만든 순서
    for l in
      select x.goal_id, sum(x.amount)::bigint as amount
      from public.split_line x join public.salary_split s on s.id = x.split_id
      join public.goal g on g.id = x.goal_id
      where s.space_id = sid and s.owner_user_id is not null and x.kind = 'saving'
      group by x.goal_id, g.priority, g.created_at
      order by g.priority, g.created_at
    loop
      insert into public.split_line (split_id, space_id, kind, goal_id, amount, sort) values (joint_id, sid, 'saving', l.goal_id, l.amount, n);
      n := n + 1;
    end loop;
    for l in
      select x.kind, sum(x.amount)::bigint as amount from public.split_line x join public.salary_split s on s.id = x.split_id
      where s.space_id = sid and s.owner_user_id is not null and x.kind in ('fixed', 'living')
      group by x.kind order by x.kind
    loop
      insert into public.split_line (split_id, space_id, kind, amount, sort) values (joint_id, sid, l.kind, l.amount, n);
      n := n + 1;
    end loop;
    for l in
      select x.kind, x.user_id, x.name, x.amount from public.split_line x join public.salary_split s on s.id = x.split_id
      where s.space_id = sid and s.owner_user_id is not null and x.kind in ('allowance', 'custom')
      order by x.kind, s.owner_user_id, x.sort
    loop
      insert into public.split_line (split_id, space_id, kind, user_id, name, amount, sort)
        values (joint_id, sid, l.kind, l.user_id, l.name, l.amount, n);
      n := n + 1;
    end loop;
    delete from public.salary_split where space_id = sid and owner_user_id is not null;
  else
    select id into joint_id from public.salary_split where space_id = sid and owner_user_id is null;
    if other.id is null then
      update public.salary_split set owner_user_id = uid where id = joint_id;
      update public.goal set owner_user_id = uid where space_id = sid and owner_user_id is null;
    elsif joint_id is not null then
      -- 기준일 사람 = 공동 기준일과 월급날이 같은 사람(없으면 시작한 사람)
      cd := coalesce(
        (select u.id from public.app_user u where u.space_id = sid and u.status = 'active'
           and (case when u.payday_last then 31 else u.payday end) = public.cycle_day(sid, null)
         order by (u.id = sp.created_by) desc limit 1),
        sp.created_by);
      share := case when coalesce(me.monthly_income, 0) + coalesce(other.monthly_income, 0) = 0 then 0.5
        else (case when cd = uid then coalesce(other.monthly_income, 0) else coalesce(me.monthly_income, 0) end)::numeric
             / (coalesce(me.monthly_income, 0) + coalesce(other.monthly_income, 0)) end;
      insert into public.salary_split (space_id, owner_user_id, updated_by) values (sid, cd, uid) returning id into a_id;
      insert into public.salary_split (space_id, owner_user_id, updated_by)
        values (sid, case when cd = uid then other.id else uid end, uid) returning id into b_id;
      for l in
        select x.*, g.owner_user_id as goal_owner, g.created_by as goal_maker
        from public.split_line x left join public.goal g on g.id = x.goal_id
        where x.split_id = joint_id order by x.sort
      loop
        if l.kind = 'allowance' and l.user_id is not null then
          if l.user_id = cd then
            insert into public.split_line (split_id, space_id, kind, user_id, amount, sort) values (a_id, sid, 'allowance', l.user_id, l.amount, na);
            na := na + 1;
          else
            insert into public.split_line (split_id, space_id, kind, user_id, amount, sort) values (b_id, sid, 'allowance', l.user_id, l.amount, nb);
            nb := nb + 1;
          end if;
        elsif l.kind = 'saving' then
          who := coalesce(l.goal_owner,
            case when l.goal_maker in (uid, other.id) then l.goal_maker end, cd);
          if who = cd then
            insert into public.split_line (split_id, space_id, kind, goal_id, amount, sort) values (a_id, sid, 'saving', l.goal_id, l.amount, na);
            na := na + 1;
          else
            insert into public.split_line (split_id, space_id, kind, goal_id, amount, sort) values (b_id, sid, 'saving', l.goal_id, l.amount, nb);
            nb := nb + 1;
          end if;
        else
          part := (round(l.amount * share / 10000) * 10000)::bigint;
          insert into public.split_line (split_id, space_id, kind, goal_id, name, amount, sort)
            values (a_id, sid, l.kind, l.goal_id, l.name, l.amount - part, na);
          insert into public.split_line (split_id, space_id, kind, goal_id, name, amount, sort)
            values (b_id, sid, l.kind, l.goal_id, l.name, part, nb);
          na := na + 1;
          nb := nb + 1;
        end if;
      end loop;
      delete from public.salary_split where id = joint_id;
    end if;
  end if;
  update public.couple_space set salary_mode = p_mode where id = sid;
  -- 각자로: 주인 없는 저금 항목은 만든 사람(없으면 기준일 사람) 것. 줄은 위에서 옮겼고, 방식을 바꾼 뒤라 줄 맞추기가 그대로 둠
  if p_mode = 'separate' and other.id is not null and cd is not null then
    update public.goal set owner_user_id = case when created_by in (uid, other.id) then created_by else cd end
      where space_id = sid and owner_user_id is null;
  end if;
  if other.id is not null and sp.couple_state = 'connected' then
    perform public.notify(
      other.id, sid, 'salary_mode',
      coalesce(me.nickname || '님이', '파트너가') || ' 월급 관리 방식을 바꿨어요',
      case when p_mode = 'joint' then '합쳐서 같이 관리해요' else '각자 월급을 따로 관리해요' end,
      '/salary/split', null, uid, 'mode:' || sid || ':' || now()::text);
  end if;
end;
$$;
revoke all on function public.set_salary_mode(public.salary_mode) from public, anon;
grant execute on function public.set_salary_mode(public.salary_mode) to authenticated;

-- 8. 스테이징 데이터 옮기기(ADR 0007 5장). 출시 전이라 스테이징 데이터뿐. 옮기는 동안 줄 맞추기·알림 트리거는 끔
alter table public.goal disable trigger goal_lines;
alter table public.goal disable trigger goal_partner_change;
alter table public.goal disable trigger goal_to_mine_guard;

-- 8-1. 비상금: 체크한 기록이 있으면 목표 금액 없는 저금 항목으로 남기고, 없으면 지움
update public.goal g set target_amount = null, deadline = null
  where g.template = 'emergency'
    and exists (select 1 from public.pay_check_line l where l.goal_id = g.id and l.state = 'checked');
delete from public.pay_check_line l using public.goal g
  where l.goal_id = g.id and g.template = 'emergency' and l.state <> 'checked'
    and not exists (select 1 from public.pay_check_line x where x.goal_id = g.id and x.state = 'checked');
delete from public.split_line s using public.goal g
  where s.goal_id = g.id and g.template = 'emergency'
    and not exists (select 1 from public.pay_check_line x where x.goal_id = g.id and x.state = 'checked');
delete from public.goal g
  where g.template = 'emergency'
    and not exists (select 1 from public.pay_check_line x where x.goal_id = g.id and x.state = 'checked');

-- 8-2. 형태·상태: 매달 목표의 금액은 월 납입액이라 목표 금액에서 지움, 모두 ‘한 번’. 지연 → 모으는 중,
--      보류·사용 완료·마무리 중·(줄이 이미 빠진) 달성 → 그만 모음(기록만 남김)
update public.goal set target_amount = null, deadline = null where kind = 'monthly';
update public.goal set kind = 'once' where kind <> 'once';
update public.goal set status = 'active' where status = 'delayed';
update public.goal set closed_at = coalesce(achieved_at, updated_at, now())
  where status in ('paused', 'used', 'wrapping_up', 'achieved') and closed_at is null;

-- 8-3. 각자 모드의 우리 목표(주인 없음): 만든 사람(줄이 있으면) 것으로, 다른 사람 월급 계획의 줄은 그 사람 새 저금 항목으로
--      (같은 이름, 목표 금액 없음). 그 사람 체크리스트의 지난 체크 줄도 새 항목으로 옮겨 모은 돈이 사람마다 맞게
do $$
declare
  g record;
  keeper uuid;
  s record;
  ng uuid;
begin
  for g in
    select x.* from public.goal x join public.couple_space c on c.id = x.space_id
    where c.salary_mode = 'separate' and x.owner_user_id is null
  loop
    keeper := coalesce(
      (select sp.owner_user_id from public.split_line l join public.salary_split sp on sp.id = l.split_id
        where l.goal_id = g.id and sp.owner_user_id = g.created_by limit 1),
      (select sp.owner_user_id from public.split_line l join public.salary_split sp on sp.id = l.split_id
        where l.goal_id = g.id and sp.owner_user_id is not null order by sp.created_at limit 1),
      (select u.id from public.app_user u where u.id = g.created_by and u.space_id = g.space_id),
      (select c.created_by from public.couple_space c where c.id = g.space_id));
    update public.goal set owner_user_id = keeper where id = g.id;
    for s in
      select sp.* from public.salary_split sp
      where sp.space_id = g.space_id and sp.owner_user_id is not null and sp.owner_user_id <> keeper
        and exists (select 1 from public.split_line l where l.split_id = sp.id and l.goal_id = g.id)
    loop
      insert into public.goal (space_id, template, name, kind, priority, owner_user_id, created_by, created_at, closed_at)
        values (g.space_id, 'custom', g.name, 'once', g.priority, s.owner_user_id, s.owner_user_id, g.created_at, g.closed_at)
        returning id into ng;
      update public.split_line set goal_id = ng where split_id = s.id and goal_id = g.id;
      update public.pay_check_line l set goal_id = ng
        from public.pay_checklist c
        where l.checklist_id = c.id and l.goal_id = g.id and c.owner_user_id = s.owner_user_id;
    end loop;
  end loop;
end;
$$;

-- 8-4. 모든 저금 항목의 월급 계획 줄을 새 규칙으로 맞춤(그만 모은 항목은 줄을 빼고, 이번 사이클 체크한 줄은 기록으로 남음)
do $$
declare
  g record;
begin
  for g in select id from public.goal loop
    perform public.goal_lines_sync(g.id);
  end loop;
end;
$$;

alter table public.goal enable trigger goal_lines;
alter table public.goal enable trigger goal_partner_change;
alter table public.goal enable trigger goal_to_mine_guard;
