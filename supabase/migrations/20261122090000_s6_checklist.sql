-- QA 6구간(월급 체크리스트 W-02·W-05·월 사이클) 서버 쪽(2026-11-12). 스키마는 추가만(새 표 하나, 함수 새 버전).
--
-- 1. 서버 분석 이벤트(S6-02, 32 4-1 ‘서버가 확정하는 상태 변화는 서버 이벤트’): 표 server_event(앱은 읽지도 쓰지도 못함)
--    + 남기는 함수 server_track(‘분석 수집’을 끈 사람 것은 남기지 않음, 합쳐서면 한 사람이라도 끄면 안 남김).
--    checklist_generated: 체크리스트가 생긴 트랜잭션이 끝날 때(줄까지 들어간 뒤, 미룬 제약 트리거)
--    checklist_closed: 체크리스트가 끝남(state → closed)으로 바뀔 때.
--    PostHog로 보내는 일은 분석 단계에서(이 표를 읽어 보내고 sent_at을 채움, DEV_GUIDE ‘로그와 분석’)
-- 2. check_pay_line 새 버전(S6-12 D4, S6-18): 쓰이지 않던 대신 체크 알림 부분을 지움(대신 체크는 2026-11-03 없앰, not_owner로 막힘).
--    각자 모드 파트너 알림: 줄이 모두 체크면 “{이름}님이 10월 월급 체크를 다 했어요”, ‘못 함’이 섞이면 “… 체크를 마쳤어요”.
--    호칭이 없으면 “파트너가 …”(14 알림, 2026-11-11 S3-29와 같음)
-- 3. send_evening_notifications 새 버전(S6-05 D3): 월급 전 확인 알림 링크에 그 체크리스트 id(/salary/review?checklist=…).
--    예전 알림의 /salary/review는 앱이 지금 해당하는 체크리스트로 풂
-- 4. achieve_goal 새 버전(S6-18): 달성 알림 링크를 14 표대로 고칠 수 있는 사람은 W-12(/salary/items/{id}/achieved),
--    파트너(각자, 보기만)는 W-10(/salary/items/{id})

-- 1. 서버 분석 이벤트 ─────────────────────────────────────────────────────────
create table public.server_event (
  id bigint generated always as identity primary key,
  name text not null check (name ~ '^[a-z_]{1,64}$'),
  -- 가명 내부 ID(32 4-2). 계정을 지워도 이벤트는 가명으로 남음(외래 키 없음)
  user_id uuid,
  space_id uuid,
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  -- 분석 도구로 보낸 때(분석 단계에서 채움)
  sent_at timestamptz
);
create index server_event_unsent on public.server_event (created_at) where sent_at is null;
alter table public.server_event enable row level security;
revoke all on table public.server_event from public, anon, authenticated;

/** 분석 금액 구간(32 5장, core amountBand와 같은 이름) */
create or replace function public.amount_band(v bigint)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when v < 100000 then '<10만'
    when v < 500000 then '10-50만'
    when v < 1000000 then '50-100만'
    when v < 3000000 then '100-300만'
    when v < 10000000 then '300-1000만'
    else '1000만+' end;
$$;

create or replace function public.server_track(p_name text, p_user uuid, p_space uuid, p_props jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  -- ‘분석 수집’을 끄면 남기지 않음(DEV_GUIDE ‘로그와 분석’ analytics_off). 공동 것은 공간의 한 사람이라도 끄면 안 남김
  if p_user is not null then
    if exists (select 1 from public.app_user where id = p_user and analytics_off) then
      return;
    end if;
  elsif exists (select 1 from public.app_user where space_id = p_space and status = 'active' and analytics_off) then
    return;
  end if;
  insert into public.server_event (name, user_id, space_id, props)
    values (p_name, p_user, p_space, coalesce(p_props, '{}'::jsonb));
end;
$$;
revoke all on function public.server_track(text, uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.amount_band(bigint) from public, anon, authenticated;

-- checklist_generated(32 4-4): cycle_type first / regular / extended(연결 해제 대기 중), owner self / joint, 줄 수, 저금 줄 수
create or replace function public.pay_checklist_generated_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ctype text;
begin
  if exists (select 1 from public.couple_space where id = new.space_id and couple_state = 'unlink_pending') then
    ctype := 'extended';
  elsif exists (
    select 1 from public.pay_checklist
    where space_id = new.space_id and owner_user_id is not distinct from new.owner_user_id
      and id <> new.id and cycle_start < new.cycle_start
  ) then
    ctype := 'regular';
  else
    ctype := 'first';
  end if;
  perform public.server_track('checklist_generated', new.owner_user_id, new.space_id, jsonb_build_object(
    'source', 'server',
    'cycle_type', ctype,
    'owner', case when new.owner_user_id is null then 'joint' else 'self' end,
    'lines_count', (select count(*) from public.pay_check_line where checklist_id = new.id),
    'saving_lines_count', (select count(*) from public.pay_check_line where checklist_id = new.id and kind = 'saving')));
  return null;
end;
$$;
revoke all on function public.pay_checklist_generated_event() from public, anon, authenticated;

-- 줄은 체크리스트 다음에 들어가므로 트랜잭션이 끝날 때 셈
create constraint trigger pay_checklist_generated
  after insert on public.pay_checklist
  deferrable initially deferred
  for each row execute function public.pay_checklist_generated_event();

-- checklist_closed(32 4-4): done(끝나기 전에 모든 줄이 체크 또는 ‘못 함’이었는지, D4), 체크한 줄 비율 구간,
-- 못 한 저금 줄 수(‘못 함’ + 끝날 때 닫힌 줄), 그 계획 금액 구간
create or replace function public.pay_checklist_closed_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  total int;
  checked int;
  missed int;
  missed_sum bigint;
  pct int;
begin
  select count(*), count(*) filter (where state = 'checked'),
         count(*) filter (where kind = 'saving' and state <> 'checked'),
         coalesce(sum(planned) filter (where kind = 'saving' and state <> 'checked'), 0)
    into total, checked, missed, missed_sum
    from public.pay_check_line where checklist_id = new.id;
  pct := case when total = 0 then 100 else (checked * 100) / total end;
  perform public.server_track('checklist_closed', new.owner_user_id, new.space_id, jsonb_build_object(
    'source', 'server',
    'done', old.state = 'done',
    'checked_ratio_band', case when pct >= 100 then '100' when pct >= 50 then '50-99' else '<50' end,
    'missed_saving_lines', missed,
    'missed_saving_band', case when missed > 0 then public.amount_band(missed_sum) end));
  return null;
end;
$$;
revoke all on function public.pay_checklist_closed_event() from public, anon, authenticated;

create trigger pay_checklist_closed
  after update of state on public.pay_checklist
  for each row when (new.state = 'closed' and old.state is distinct from 'closed')
  execute function public.pay_checklist_closed_event();

-- 2. 줄 체크 ─────────────────────────────────────────────────────────────────
create or replace function public.check_pay_line(p_line uuid, p_state text, p_actual bigint default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid uuid := (select space_id from public.app_user where id = auth.uid());
  l public.pay_check_line;
  c public.pay_checklist;
  was text;
  now_state text;
  who text := (select nickname from public.app_user where id = auth.uid());
  other uuid;
  mixed boolean;
begin
  select * into l from public.pay_check_line where id = p_line for update;
  if l.id is null or l.space_id is distinct from sid then
    raise exception 'no_line' using errcode = '42501';
  end if;
  select * into c from public.pay_checklist where id = l.checklist_id;
  -- 2026-11-03 대신 체크 없앰: 각자 모드 체크리스트는 주인만 체크(합쳐서 모드 공동 체크리스트는 둘 다)
  if c.owner_user_id is not null and c.owner_user_id <> uid then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if c.cycle_end < public.kst_today() or c.state = 'closed' then
    raise exception 'closed' using errcode = '22023';
  end if;
  if p_state not in ('checked', 'wait', 'skipped') then
    raise exception 'bad_state' using errcode = '22023';
  end if;
  if p_state = 'checked' and l.state = 'checked' and l.checked_by is distinct from uid then
    raise exception 'already_checked' using errcode = '40001';
  end if;
  if p_actual is not null and (p_actual < 0 or p_actual > 99999999999) then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  was := c.state;
  update public.pay_check_line set
    state = case when p_state = 'checked' and p_actual = 0 then 'skipped' else p_state end,
    actual = case when p_state = 'checked' and p_actual is not null and p_actual > 0 then p_actual end,
    checked_by = case when p_state = 'wait' then null else uid end,
    checked_at = case when p_state = 'wait' then null else now() end,
    on_behalf = false
  where id = p_line
  returning * into l;
  -- 사이클 상태(07 5장, 2026-11-12 D4): 체크 안 한 줄이 없으면(체크 또는 ‘못 함’) 다 끝남
  update public.pay_checklist set
    state = case when exists (select 1 from public.pay_check_line where checklist_id = c.id and state = 'wait') then 'open' else 'done' end
  where id = c.id
  returning state into now_state;

  -- 파트너 체크 다 함(14, 인앱만): 각자 모드에서 주인이 마지막 줄을 끝냈을 때 상대에게, 사이클마다 한 번.
  -- ‘못 함’이 섞이면 “마쳤어요”, 모두 체크면 “다 했어요”(2026-11-12 D4)
  if was = 'open' and now_state = 'done' and c.owner_user_id = uid then
    select id into other from public.app_user
      where space_id = c.space_id and status = 'active' and id <> uid limit 1;
    if other is not null then
      mixed := exists (select 1 from public.pay_check_line where checklist_id = c.id and state = 'skipped');
      perform public.notify(other, c.space_id, 'partner_done',
        coalesce(who || '님이', '파트너가') || ' ' || c.label || ' 체크를 '
          || case when mixed then '마쳤어요' else '다 했어요' end, -- [확인 필요] ‘마쳤어요’ 2026-11-12
        null, '/salary?who=' || uid, null, uid, 'done:' || c.id);
    end if;
  end if;
  -- 2026-11-09: 체크를 풀거나 못 함으로 바꿔 모은 금액이 목표 금액 아래로 내려가면 달성을 되돌림
  if l.kind = 'saving' and l.goal_id is not null then
    perform public.saving_unachieve(l.goal_id);
  end if;
end;
$$;

-- 3. 오후 8시 월급 전 확인(다음 기준일 3일 전 = 사이클 끝 2일 전, 체크 안 한 줄이 있을 때만) ───────────
create or replace function public.send_evening_notifications(p_today date default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  today date := coalesce(p_today, public.kst_today());
  cl public.pay_checklist;
  u public.app_user;
  left_n integer;
  cnt integer := 0;
begin
  for cl in
    select x.* from public.pay_checklist x
    join public.couple_space s on s.id = x.space_id and s.deleted_at is null
    where x.cycle_end - 2 = today and x.state = 'open'
  loop
    select count(*) into left_n from public.pay_check_line where checklist_id = cl.id and state = 'wait';
    continue when left_n = 0;
    for u in
      select x.* from public.app_user x
      where x.space_id = cl.space_id and x.status = 'active' and (cl.owner_user_id is null or x.id = cl.owner_user_id)
    loop
      -- 2026-11-12 D3: 알림이 가리킨 체크리스트만 W-05에(기간이 지났거나 끝난 사이클이면 앱이 W-02로)
      perform public.notify(u.id, cl.space_id, 'review_due',
        cl.label || '에서 체크 안 한 게 ' || left_n || '개 있어요', null,
        '/salary/review?checklist=' || cl.id, 'clipboard-text', null, 'review:' || cl.id || ':' || u.id);
      cnt := cnt + 1;
    end loop;
  end loop;
  return cnt;
end;
$$;
revoke execute on function public.send_evening_notifications(date) from public, anon, authenticated;

-- 4. 달성 표시 + 축하 화면을 볼지(이 사람이 처음이면 true). 목표 금액이 있고 모은 금액이 닿은 항목만 ───────
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
    -- 링크(14 표, 2026-11-12 S6-18): 고칠 수 있는 사람(우리 둘 항목은 둘 다, 각자 항목은 주인) = W-12 축하, 파트너 = W-10
    for u in select a.id from public.app_user a where a.space_id = g.space_id and a.status = 'active' loop
      perform public.notify(u.id, g.space_id, 'goal_achieved', g.name || ' 목표 금액을 다 모았어요!', null, -- [확인 필요]
        '/salary/items/' || g.id::text
          || case when g.owner_user_id is null or g.owner_user_id = u.id then '/achieved' else '' end,
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
