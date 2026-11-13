-- v2.2 PR 2: 확인 루프(ADR 0009 결정 2·3·3-1, plan v2.2 2-2·2-3·6-3·9-2 PR 2). 스키마는 추가만.
--
-- ■ 계약(core packages/core/src/rules/pay-confirm.ts가 같은 결과를 내야 함)
--   1. 줄 설정(split_line)
--      - in_checklist: 이 줄을 월급날 확인 목록에 넣는지. 새 줄 기본값 = kind가 living·allowance가 아니면 true(D2).
--      - auto_pay: 은행에서 자동으로 나가는 줄. 새 줄 기본값 = kind가 send·shared_account면 true, 아니면 false(Q9, P-05c).
--      - auto_day: 자동 줄이 나가는 날(1~31, 31 = 말일). null = 월급날(확인 목록의 cycle_start).
--        날짜 없는 사람(payday_none)은 null = 매달 1일.
--      - 기존 줄(스테이징): saving·fixed·custom = in_checklist true, living·allowance = false, 모두 auto_pay false.
--      - save_split은 줄을 통째로 바꾸지만 설정은 같은 줄(kind, goal_id, user_id, name)에서 이어받음.
--        p_lines 원소에 in_checklist / auto_pay / auto_day 키가 있으면 그 값이 이김.
--   2. 첫 사이클 소급 없음(D1): salary_split.checklist_from(새 월급 계획 = 만든 날 KST, 옛 계획 = null)보다
--      먼저 시작한 사이클의 확인 목록은 만들지 않는다. 첫 목록 = checklist_from 이후 처음 오는 월급날.
--   3. 날짜 없음(F2): app_user.payday_none = true인 사람은 기준일 계산(cycle_day)에서 빠진다.
--      각자 = 그 사람 확인 목록 없음. 합쳐서 = 날짜 있는 사람 월급날로, 둘 다 없으면 목록 없음.
--   4. 자동 줄 나가는 날 auto_due_date(s, e, day): day null → s.
--      아니면 s가 있는 달의 min(day, 그 달 말일)이 s 이상이면 그 날, 아니면 다음 달의 min(day, 말일), e보다 뒤면 e.
--   5. 자동 확인: auto = true이고 wait인 줄은 auto_due <= 오늘이면 checked(checked_by null, actual null).
--      매일 00:05 KST `auto_confirm_due_lines()` + 목록을 만들거나 다시 맞출 때 바로.
--      저금 줄이면 모은 금액에 그대로 더해짐(체크한 저금 줄 합), 목표 금액에 닿으면 서버가 달성(achieved_seen 빈 배열,
--      두 사람 모두 앱의 achieve_goal에서 축하를 봄).
--      날짜 없는 사람의 자동 저금 줄: 확인 목록이 없으니 매달 나가는 날(auto_day, 기본 1일, 말일 넘으면 말일)에
--      goal_move(kind in, reason_code auto)로 더함. (auto_line_id, auto_on)으로 한 번만.
--   6. 모은 금액 goal_saved = start_saved + 체크한 저금 줄 합(actual 없으면 planned)
--      + v2.2 돈 움직임(goal_move 중 reason_code가 있는 것, in = +, out = −, 지운 것 빼고).
--      옛 goal_move(reason_code null, ADR 0007 전 넣기·빼기)는 지금처럼 셈하지 않음.
--   7. 손 줄 = auto = false인 확인 줄. 월급날 알림(09:00)·월급 전 확인 알림(cycle_end − 2일 20:00)은 손 줄이
--      1개 이상(월급 전 확인은 남은 손 줄 1개 이상)일 때만. 손 줄 0이면 월급날에 진행 소식(progress_news) 1회.
--   8. 한 번 확인 confirm_payday(checklist): 남은 손 줄을 계획 금액으로 체크 + confirmed_at/by.
--      권한: 각자 목록 = 주인만, 합쳐서 목록 = 누구나. 단 합쳐서 용돈 줄은 그 주인만(남의 용돈 줄은 건너뜀, B7).
--   9. 늦은 확인(D3): 지난 사이클 목록은 그다음 사이클이 끝날 때까지 check_pay_line·confirm_payday 가능(late = true).
--      다음 사이클 끝 = late_check_until(목록). 닫힌 목록에서 체크를 풀면 wait가 아니라 skipped(‘건너뜀’).
--  10. 알림 종류 켜기(push_kinds, P-11·S-14): 키 care, payday, achieved, shared_change, my_allowance, progress_news.
--      없는 키 = 켬. push_kind_key(kind)로 알림 kind를 키로 바꾸고 claim_push가 끈 종류는 푸시하지 않음.
--
-- 지금 안 쓰게 된 것(2단계 정리 대상): 없음.

-- ─────────────────────────────── 열 ───────────────────────────────
alter table public.split_line
  add column in_checklist boolean,
  add column auto_pay boolean,
  add column auto_day smallint check (auto_day between 1 and 31);
update public.split_line set
  in_checklist = kind not in ('living', 'allowance'),
  auto_pay = kind in ('send', 'shared_account');
alter table public.split_line
  alter column in_checklist set not null,
  alter column auto_pay set not null;
comment on column public.split_line.in_checklist is '월급날 확인 목록에 넣기(D2). 기본 living·allowance만 false';
comment on column public.split_line.auto_pay is '은행에서 자동으로 나가는 줄(F7). 나가는 날 자동 확인';
comment on column public.split_line.auto_day is '자동 줄 나가는 날 1~31(31 = 말일), null = 월급날(날짜 없음은 1일)';

-- 새 줄 기본값(서버 함수만 줄을 넣음). NOT NULL 검사는 BEFORE 트리거 뒤라 null이면 여기서 채움
create function public.split_line_defaults() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.in_checklist := coalesce(new.in_checklist, new.kind not in ('living', 'allowance'));
  new.auto_pay := coalesce(new.auto_pay, new.kind in ('send', 'shared_account'));
  return new;
end;
$$;
create trigger split_line_defaults before insert on public.split_line
  for each row execute function public.split_line_defaults();

alter table public.pay_check_line
  add column auto boolean not null default false,
  add column auto_due date,
  add column late boolean not null default false;
comment on column public.pay_check_line.auto is '자동 줄(만들 때 split_line.auto_pay). 나가는 날 자동 확인';
comment on column public.pay_check_line.auto_due is '이 사이클에서 자동 줄이 나가는 날';
comment on column public.pay_check_line.late is '사이클이 끝난 뒤 늦게 확인함(D3)';

alter table public.pay_checklist
  add column confirmed_at timestamptz,
  add column confirmed_by uuid references auth.users (id) on delete set null;

alter table public.app_user
  add column payday_none boolean not null default false,
  add column push_kinds jsonb not null default '{}'::jsonb
    check (jsonb_typeof(push_kinds) = 'object' and pg_column_size(push_kinds) < 1000);
comment on column public.app_user.payday_none is 'O-32 ‘날짜가 정해져 있지 않아요’(F2): 확인 목록·월급날 알림 없음';
comment on column public.app_user.push_kinds is
  '알림 종류 켜기(P-11·S-14) {care,payday,achieved,shared_change,my_allowance,progress_news: bool}, 없는 키 = 켬';
grant update (payday_none, push_kinds) on public.app_user to authenticated;

alter table public.salary_split add column checklist_from date;
alter table public.salary_split alter column checklist_from set default public.kst_today();
comment on column public.salary_split.checklist_from is
  '이 날 이후 시작한 사이클부터 확인 목록(D1 소급 없음). 옛 계획은 null(제한 없음)';

alter table public.goal_move
  add column reason_code public.goal_move_reason,
  add column auto_line_id uuid references public.split_line (id) on delete set null,
  add column auto_on date;
create unique index goal_move_auto_once on public.goal_move (auto_line_id, auto_on) where auto_line_id is not null;
comment on column public.goal_move.reason_code is 'v2.2 돈 움직임 사유(있으면 모은 금액에 셈). null = 옛 넣기·빼기(셈하지 않음)';

-- ─────────────────────────── 날짜 계산 ───────────────────────────
-- 계약 4. core autoDue(cycleStart, cycleEnd, autoDay)와 같음
create function public.auto_due_date(p_start date, p_end date, p_day smallint)
returns date language plpgsql immutable set search_path = '' as $$
declare
  d date;
begin
  if p_day is null then
    return p_start;
  end if;
  d := public.cycle_date(p_day, extract(year from p_start)::int, extract(month from p_start)::int);
  if d < p_start then
    d := public.cycle_date(p_day, extract(year from p_start + interval '1 month')::int,
                           extract(month from p_start + interval '1 month')::int);
  end if;
  return least(d, p_end);
end;
$$;

-- 기준일: 날짜 없는 사람(payday_none)은 빠짐(계약 3)
create or replace function public.cycle_day(p_space uuid, p_owner uuid)
returns smallint language sql stable set search_path = '' as $$
  select case
    when p_owner is not null then
      (select case when u.payday_none then null when u.payday_last then 31 else u.payday end
       from public.app_user u where u.id = p_owner)
    else coalesce(
      (select s.joint_cycle_day from public.couple_space s where s.id = p_space
         and exists (select 1 from public.app_user u where u.space_id = p_space and not u.payday_none
                       and (u.payday is not null or u.payday_last))),
      (select max(case when u.payday_last then 31 else u.payday end) from public.app_user u
       where u.space_id = p_space and not u.payday_none))
  end::smallint;
$$;

-- 계약 9: 지난 사이클 목록을 늦게 확인할 수 있는 마지막 날 = 그다음 사이클의 끝
create function public.late_check_until(p_checklist uuid)
returns date language plpgsql stable security definer set search_path = '' as $$
declare
  c public.pay_checklist;
  d smallint;
  nxt date;
begin
  select * into c from public.pay_checklist where id = p_checklist;
  if c.id is null then
    return null;
  end if;
  nxt := c.cycle_end + 1;
  d := public.cycle_day(c.space_id, c.owner_user_id);
  if d is null then
    return (nxt + interval '1 month')::date - 1;
  end if;
  return public.cycle_date(d, extract(year from nxt + interval '1 month')::int,
                           extract(month from nxt + interval '1 month')::int) - 1;
end;
$$;

-- ─────────────────────────── 모은 금액 ───────────────────────────
-- 계약 6
create or replace function public.goal_saved(p_goal uuid)
returns bigint language sql stable security definer set search_path = '' as $$
  select (coalesce((select g.start_saved from public.goal g where g.id = p_goal), 0)
    + coalesce((select sum(coalesce(l.actual, l.planned)) from public.pay_check_line l
                where l.goal_id = p_goal and l.kind = 'saving' and l.state = 'checked'), 0)
    + coalesce((select sum(case m.kind when 'in' then m.amount when 'out' then -m.amount else 0 end)
                from public.goal_move m
                where m.goal_id = p_goal and m.deleted_at is null and m.reason_code is not null), 0))::bigint;
$$;

-- 옛 넣기·빼기 알림 트리거: v2.2 돈 움직임(reason_code 있음)은 각 함수가 알림을 정함(자동은 알림 없음)
create or replace function public.goal_move_partner_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  g public.goal;
  v text;
begin
  if new.reason_code is not null then
    return null;
  end if;
  select * into g from public.goal where id = new.goal_id;
  if g.owner_user_id is not null then
    return null;
  end if;
  v := public.read_won(new.amount) || ' ' || case new.kind when 'in' then '넣었어요' when 'out' then '뺐어요' else '꺼내 썼어요' end;
  if tg_op = 'INSERT' and new.deleted_at is null then
    perform public.log_partner_change(new.space_id, 'goal_move', new.id, 'move', g.name, '', v, true, '/goals/' || g.id);
  elsif tg_op = 'UPDATE' and old.deleted_at is null and new.deleted_at is not null then
    perform public.log_partner_change(new.space_id, 'goal_move', new.id, 'move', g.name, v, '', true, '/goals/' || g.id);
  end if;
  return null;
end;
$$;

-- 달성 표시 + 알림(achieve_goal에서 나눔). p_actor null = 서버 자동(자동 확인, 자동 넣기): 두 사람 모두 아직 안 봄
create function public.goal_mark_achieved(p_goal uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  g public.goal;
  u record;
  joint boolean;
begin
  select * into g from public.goal where id = p_goal;
  update public.goal set status = 'achieved', achieved_at = now(),
      achieved_seen = case when p_actor is null then '{}'::uuid[] else array[p_actor] end
    where id = g.id;
  select c.salary_mode = 'joint' into joint from public.couple_space c where c.id = g.space_id;
  -- 링크(14 표): 고칠 수 있는 사람 = W-12 축하(우리 둘 항목, 주인, 합쳐서 모드의 ‘모두 보여 주기’ 항목은 두 사람 모두,
  -- 2026-11-12 D1), 파트너(각자) = W-10
  for u in select a.id from public.app_user a where a.space_id = g.space_id and a.status = 'active' loop
    -- 주인이 ‘금액만 보여 주기’로 둔 저금은 파트너에게 이름 없이 “개인 저금 …” + W-02(2026-11-12 QA 10구간 D1)
    if g.owner_user_id is not null and g.owner_user_id <> u.id and g.visibility = 'amount' then
      perform public.notify(u.id, g.space_id, 'goal_achieved', '개인 저금 목표 금액을 다 모았어요!', null, -- [확인 필요]
        '/salary' || case when coalesce(joint, false) then '' else '?who=' || g.owner_user_id::text end,
        'trophy', p_actor, 'goal_achieved:' || g.id::text || ':' || u.id::text);
      continue;
    end if;
    perform public.notify(u.id, g.space_id, 'goal_achieved', g.name || ' 목표 금액을 다 모았어요!', null, -- [확인 필요]
      '/salary/items/' || g.id::text
        || case when g.owner_user_id is null or g.owner_user_id = u.id
                  or (coalesce(joint, false) and g.visibility = 'all') then '/achieved' else '' end,
      'trophy', p_actor, 'goal_achieved:' || g.id::text || ':' || u.id::text);
  end loop;
end;
$$;
revoke all on function public.goal_mark_achieved(uuid, uuid) from public, anon, authenticated;

create or replace function public.achieve_goal(p_goal uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  g public.goal;
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
    perform public.goal_mark_achieved(g.id, uid);
    return true;
  end if;
  if g.status = 'achieved' and not (uid = any (g.achieved_seen)) then
    update public.goal set achieved_seen = array_append(achieved_seen, uid) where id = g.id;
    return true;
  end if;
  return false;
end;
$$;

-- 서버가 더한 뒤(자동 확인·자동 넣기) 목표 금액에 닿았으면 달성(계약 5)
create function public.goal_auto_achieve(p_goal uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  g public.goal;
begin
  select * into g from public.goal where id = p_goal and deleted_at is null for update;
  if g.id is null or g.target_amount is null or g.closed_at is not null or g.status not in ('active', 'delayed') then
    return false;
  end if;
  if public.goal_saved(g.id) < g.target_amount then
    return false;
  end if;
  perform public.goal_mark_achieved(g.id, null);
  return true;
end;
$$;
revoke all on function public.goal_auto_achieve(uuid) from public, anon, authenticated;

-- ─────────────────────────── 확인 목록 ───────────────────────────
-- 목록 상태 다시 계산(닫힌 목록은 그대로)
create function public.checklist_restate(p_checklist uuid)
returns text language sql security definer set search_path = '' as $$
  update public.pay_checklist set
    state = case when state = 'closed' then 'closed'
                 when exists (select 1 from public.pay_check_line where checklist_id = p_checklist and state = 'wait')
                   then 'open' else 'done' end
  where id = p_checklist
  returning state;
$$;
revoke all on function public.checklist_restate(uuid) from public, anon, authenticated;

-- 계약 5: 나가는 날이 된 자동 줄을 확인. 확인한 줄 수
create function public.confirm_auto_lines(p_checklist uuid, p_today date)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  n integer;
  gid uuid;
begin
  with x as (
    update public.pay_check_line set state = 'checked', actual = null, checked_by = null, checked_at = now(),
        on_behalf = false
      where checklist_id = p_checklist and auto and state = 'wait' and auto_due <= p_today
      returning goal_id, kind)
  select count(*)::int, null into n, gid from x;
  if n > 0 then
    perform public.checklist_restate(p_checklist);
    for gid in
      select distinct l.goal_id from public.pay_check_line l
      where l.checklist_id = p_checklist and l.auto and l.kind = 'saving' and l.state = 'checked'
        and l.goal_id is not null and l.checked_by is null
    loop
      perform public.goal_auto_achieve(gid);
    end loop;
  end if;
  return n;
end;
$$;
revoke all on function public.confirm_auto_lines(uuid, date) from public, anon, authenticated;

create or replace function public.make_checklist(p_space uuid, p_owner uuid, p_today date default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  sid uuid := p_space;
  split uuid;
  from_ date;
  dday smallint;
  today date := coalesce(p_today, public.kst_today());
  s date;
  e date;
  nxt date;
  cl uuid;
begin
  select id, checklist_from into split, from_ from public.salary_split
    where space_id = sid and owner_user_id is not distinct from p_owner;
  if split is null then
    raise exception 'no_split' using errcode = '22023';
  end if;
  -- 날짜 없는 사람은 cycle_day가 null(계약 3)
  dday := public.cycle_day(sid, p_owner);
  if dday is null then
    return null;
  end if;
  s := public.cycle_date(dday, extract(year from today)::int, extract(month from today)::int);
  if s > today then
    s := public.cycle_date(dday, extract(year from today - interval '1 month')::int, extract(month from today - interval '1 month')::int);
  end if;
  nxt := public.cycle_date(dday, extract(year from s + interval '1 month')::int, extract(month from s + interval '1 month')::int);
  e := nxt - 1;

  select id into cl from public.pay_checklist
    where space_id = sid and owner_user_id is not distinct from p_owner and cycle_start = s;
  if cl is not null then
    return cl;
  end if;
  -- 첫 사이클 소급 없음(계약 2, D1): 월급 계획을 만들기 전에 시작한 사이클은 만들지 않음
  if from_ is not null and s < from_ then
    return null;
  end if;
  -- 관리 방식을 바꾼 달: 옛 방식 체크리스트가 아직 이번 사이클이면 그대로 두고 새 방식은 다음 월급날부터(20 ‘다시 계산되는 때’)
  if exists (
    select 1 from public.pay_checklist
    where space_id = sid and state <> 'closed' and cycle_end >= today
      and (owner_user_id is null) <> (p_owner is null)
  ) then
    return null;
  end if;
  -- 끝난 옛 방식 체크리스트도 닫음
  update public.pay_check_line set state = 'skipped'
    where state = 'wait' and checklist_id in (
      select id from public.pay_checklist
      where space_id = sid and (owner_user_id is null) <> (p_owner is null) and cycle_end < today);
  update public.pay_checklist set state = 'closed'
    where space_id = sid and (owner_user_id is null) <> (p_owner is null) and cycle_end < today and state <> 'closed';
  -- 지난 사이클은 끝남: 확인 안 한 줄은 ‘건너뜀’(skipped). 다음 사이클 끝까지 늦게 확인할 수 있음(계약 9)
  update public.pay_check_line set state = 'skipped'
    where state = 'wait' and checklist_id in (
      select id from public.pay_checklist
      where space_id = sid and owner_user_id is not distinct from p_owner and cycle_start < s);
  update public.pay_checklist set state = 'closed'
    where space_id = sid and owner_user_id is not distinct from p_owner and cycle_start < s and state <> 'closed';
  insert into public.pay_checklist (space_id, split_id, owner_user_id, cycle_start, cycle_end, label)
    values (sid, split, p_owner, s, e, extract(month from s)::int || '월 월급')
    returning id into cl;
  -- ‘체크리스트에 넣기’를 끈 줄은 빼고(D2), 자동 줄은 나가는 날을 기다림(F7)
  insert into public.pay_check_line (checklist_id, space_id, split_line_id, kind, goal_id, user_id, name, planned, sort,
                                     auto, auto_due)
    select cl, sid, l.id, l.kind, l.goal_id, l.user_id, l.name, l.amount, l.sort,
      l.auto_pay, case when l.auto_pay then public.auto_due_date(s, e, l.auto_day) end
    from public.split_line l
    where l.split_id = split and l.amount > 0 and l.in_checklist;
  -- 예약 작업보다 늦게 만들어졌어도 이미 나간 자동 줄은 바로 확인
  perform public.confirm_auto_lines(cl, today);
  return cl;
end;
$$;

create or replace function public.sync_checklist(p_split uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  c public.pay_checklist;
  today date := public.kst_today();
begin
  select c0.* into c from public.pay_checklist c0
    join public.salary_split s on s.id = p_split
    where c0.space_id = s.space_id and c0.owner_user_id is not distinct from s.owner_user_id
      and c0.cycle_start <= today and c0.cycle_end >= today;
  if c.id is null then
    return;
  end if;
  delete from public.pay_check_line where checklist_id = c.id and state = 'wait';
  insert into public.pay_check_line (checklist_id, space_id, split_line_id, kind, goal_id, user_id, name, planned, sort,
                                     auto, auto_due)
    select c.id, l.space_id, l.id, l.kind, l.goal_id, l.user_id, l.name, l.amount, l.sort,
      l.auto_pay, case when l.auto_pay then public.auto_due_date(c.cycle_start, c.cycle_end, l.auto_day) end
    from public.split_line l
    where l.split_id = p_split and l.amount > 0 and l.in_checklist
      and not exists (
        select 1 from public.pay_check_line x
        where x.checklist_id = c.id
          and (x.split_line_id = l.id or (x.kind = l.kind
            and x.goal_id is not distinct from l.goal_id
            and x.user_id is not distinct from l.user_id
            and x.name is not distinct from l.name)));
  -- 체크·못 함 줄도 월급 계획 순서로(2026-11-09 W-01 순서 바꾸기)
  update public.pay_check_line x set sort = l.sort
    from public.split_line l
    where x.checklist_id = c.id and x.split_line_id = l.id and l.split_id = p_split and x.sort <> l.sort;
  update public.pay_checklist set split_id = p_split where id = c.id;
  perform public.checklist_restate(c.id);
  perform public.confirm_auto_lines(c.id, today);
end;
$$;

-- 매일 00:05 KST(계약 5). 확인한 줄 수 + 자동 넣기 수
create function public.auto_confirm_due_lines(p_today date default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  today date := coalesce(p_today, public.kst_today());
  cl uuid;
  r record;
  cnt integer := 0;
  mid uuid;
begin
  for cl in
    select distinct l.checklist_id from public.pay_check_line l
    join public.pay_checklist c on c.id = l.checklist_id and c.state <> 'closed'
    join public.couple_space s on s.id = c.space_id and s.deleted_at is null
    where l.auto and l.state = 'wait' and l.auto_due <= today
  loop
    begin
      cnt := cnt + public.confirm_auto_lines(cl, today);
    exception when others then
      raise warning 'auto_confirm_due_lines %: %', cl, sqlerrm;
    end;
  end loop;

  -- 날짜 없는 사람의 자동 저금 줄: 나가는 날에 goal_move(in, auto)
  for r in
    select l.id, l.space_id, l.goal_id, l.amount
    from public.split_line l
    join public.salary_split sp on sp.id = l.split_id
    join public.couple_space s on s.id = sp.space_id and s.deleted_at is null
    join public.goal g on g.id = l.goal_id and g.deleted_at is null and g.closed_at is null
    where l.kind = 'saving' and l.auto_pay and l.amount > 0
      and public.cycle_day(sp.space_id, sp.owner_user_id) is null
      and ((sp.owner_user_id is not null and exists (
              select 1 from public.app_user u where u.id = sp.owner_user_id and u.space_id = sp.space_id
                and u.status = 'active' and u.payday_none))
        or (sp.owner_user_id is null and s.salary_mode = 'joint' and exists (
              select 1 from public.app_user u where u.space_id = sp.space_id and u.status = 'active' and u.payday_none)))
      and public.cycle_date(coalesce(l.auto_day, 1::smallint), extract(year from today)::int,
                            extract(month from today)::int) = today
  loop
    insert into public.goal_move (space_id, goal_id, kind, amount, created_by, reason_code, auto_line_id, auto_on)
      values (r.space_id, r.goal_id, 'in', r.amount, null, 'auto', r.id, today)
      on conflict (auto_line_id, auto_on) where auto_line_id is not null do nothing
      returning id into mid;
    if mid is not null then
      cnt := cnt + 1;
      perform public.goal_auto_achieve(r.goal_id);
    end if;
    mid := null;
  end loop;
  return cnt;
end;
$$;
revoke all on function public.auto_confirm_due_lines(date) from public, anon, authenticated;

-- 계약 8·9: 줄 하나 확인(지금 사이클 + 지난 사이클 늦은 확인)
create or replace function public.check_pay_line(p_line uuid, p_state text, p_actual bigint default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  sid uuid := (select space_id from public.app_user where id = auth.uid());
  today date := public.kst_today();
  l public.pay_check_line;
  c public.pay_checklist;
  late_ boolean;
  manual_before integer;
  manual_after integer;
  who text := (select nickname from public.app_user where id = auth.uid());
  other uuid;
  mixed boolean;
  to_state text;
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
  -- 합쳐서 용돈 줄은 그 주인만(B7)
  if c.owner_user_id is null and l.kind = 'allowance' and l.user_id is not null and l.user_id <> uid then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  late_ := c.cycle_end < today;
  if (late_ and today > public.late_check_until(c.id)) or (not late_ and c.state = 'closed') then
    raise exception 'closed' using errcode = '22023';
  end if;
  if p_state not in ('checked', 'wait', 'skipped') then
    raise exception 'bad_state' using errcode = '22023';
  end if;
  -- 남이 체크한 줄(자동 확인 줄은 checked_by가 없어 고칠 수 있음)
  if p_state = 'checked' and l.state = 'checked' and l.checked_by is not null and l.checked_by <> uid then
    raise exception 'already_checked' using errcode = '40001';
  end if;
  if p_actual is not null and (p_actual < 0 or p_actual > 99999999999) then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  select count(*) filter (where state = 'wait' and not auto) into manual_before
    from public.pay_check_line where checklist_id = c.id;
  to_state := case when p_state = 'checked' and p_actual = 0 then 'skipped'
                   when p_state = 'wait' and (late_ or c.state = 'closed') then 'skipped'
                   else p_state end;
  update public.pay_check_line set
    state = to_state,
    actual = case when p_state = 'checked' and p_actual is not null and p_actual > 0 then p_actual end,
    checked_by = case when to_state = 'wait' or (p_state = 'wait' and late_) then null else uid end,
    checked_at = case when to_state = 'wait' or (p_state = 'wait' and late_) then null else now() end,
    on_behalf = false,
    late = late_ and p_state <> 'wait'
  where id = p_line
  returning * into l;
  perform public.checklist_restate(c.id);
  select count(*) filter (where state = 'wait' and not auto) into manual_after
    from public.pay_check_line where checklist_id = c.id;

  -- 파트너 체크 다 함(14, 인앱만, B2): 각자 모드에서 주인이 마지막 손 줄을 끝냈을 때 상대에게, 사이클마다 한 번.
  -- 자동 확인으로는 없음. ‘건너뜀’이 섞이면 “마쳤어요”, 모두 체크면 “다 했어요”(2026-11-12 D4)
  if not late_ and manual_before > 0 and manual_after = 0 and c.owner_user_id = uid then
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

-- 계약 8: “모두 계획대로 됐어요” 한 번. 체크한 손 줄 수
create function public.confirm_payday(p_checklist uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  sid uuid := (select space_id from public.app_user where id = auth.uid());
  today date := public.kst_today();
  c public.pay_checklist;
  late_ boolean;
  n integer;
  manual_before integer;
  manual_after integer;
  who text := (select nickname from public.app_user where id = auth.uid());
  other uuid;
  mixed boolean;
begin
  select * into c from public.pay_checklist where id = p_checklist for update;
  if c.id is null or c.space_id is distinct from sid then
    raise exception 'no_checklist' using errcode = '42501';
  end if;
  if c.owner_user_id is not null and c.owner_user_id <> uid then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if (select couple_state from public.couple_space where id = sid) = 'unlink_pending' and c.owner_user_id is null then
    raise exception 'unlink_pending' using errcode = '42501';
  end if;
  late_ := c.cycle_end < today;
  if (late_ and today > public.late_check_until(c.id)) or (not late_ and c.state = 'closed') then
    raise exception 'closed' using errcode = '22023';
  end if;
  select count(*) filter (where state = 'wait' and not auto) into manual_before
    from public.pay_check_line where checklist_id = c.id;
  -- 남은 손 줄: 지금 사이클은 wait, 지난 사이클은 닫을 때 서버가 건너뜀으로 바꾼 줄(checked_by 없음)도
  update public.pay_check_line set state = 'checked', actual = null, checked_by = uid, checked_at = now(),
      on_behalf = false, late = late_
    where checklist_id = c.id and not auto
      and (state = 'wait' or (late_ and state = 'skipped' and checked_by is null))
      and not (c.owner_user_id is null and kind = 'allowance' and user_id is not null and user_id <> uid);
  get diagnostics n = row_count;
  update public.pay_checklist set confirmed_at = now(), confirmed_by = uid where id = c.id;
  perform public.checklist_restate(c.id);
  select count(*) filter (where state = 'wait' and not auto) into manual_after
    from public.pay_check_line where checklist_id = c.id;
  if not late_ and manual_before > 0 and manual_after = 0 and c.owner_user_id = uid then
    select id into other from public.app_user
      where space_id = c.space_id and status = 'active' and id <> uid limit 1;
    if other is not null then
      mixed := exists (select 1 from public.pay_check_line where checklist_id = c.id and state = 'skipped');
      perform public.notify(other, c.space_id, 'partner_done',
        coalesce(who || '님이', '파트너가') || ' ' || c.label || ' 체크를 '
          || case when mixed then '마쳤어요' else '다 했어요' end, -- [확인 필요]
        null, '/salary?who=' || uid, null, uid, 'done:' || c.id);
    end if;
  end if;
  return n;
end;
$$;
grant execute on function public.confirm_payday(uuid) to authenticated;

-- ─────────────────────────── 줄 설정 저장 ───────────────────────────
-- W-01 줄 설정, W-01d 자동 줄 여러 개 한 번에, W-11e. p_items = [{id, in_checklist?, auto_pay?, auto_day?}]
-- 키가 없으면 그대로, auto_day: null = 월급날. 권한은 split_editable(각자 = 주인, 합쳐서 = 둘 다)
create function public.split_lines_configure(p_items jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  it jsonb;
  l public.split_line;
  sp public.salary_split;
  splits uuid[] := '{}';
  d integer;
  s uuid;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 60 then
    raise exception 'bad_items' using errcode = '22023';
  end if;
  for it in select * from jsonb_array_elements(p_items) loop
    select * into l from public.split_line where id = (it->>'id')::uuid for update;
    if l.id is null then
      raise exception 'no_split' using errcode = '42501';
    end if;
    sp := public.split_editable(l.split_id);
    if it ? 'auto_day' and jsonb_typeof(it->'auto_day') <> 'null' then
      d := (it->>'auto_day')::int;
      if d < 1 or d > 31 then
        raise exception 'bad_day' using errcode = '22023';
      end if;
    end if;
    update public.split_line set
      in_checklist = case when it ? 'in_checklist' then (it->>'in_checklist')::boolean else in_checklist end,
      auto_pay = case when it ? 'auto_pay' then (it->>'auto_pay')::boolean else auto_pay end,
      auto_day = case when it ? 'auto_day' then (it->>'auto_day')::smallint else auto_day end
      where id = l.id;
    if not (sp.id = any (splits)) then
      splits := splits || sp.id;
    end if;
  end loop;
  foreach s in array splits loop
    perform public.split_touch(s);
    perform public.sync_checklist(s);
  end loop;
end;
$$;
grant execute on function public.split_lines_configure(jsonb) to authenticated;

-- save_split: 줄을 통째로 바꿔도 줄 설정은 같은 줄에서 이어받음(계약 1)
create or replace function public.save_split(p_lines jsonb, p_owner uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  sid uuid := (select space_id from public.app_user where id = auth.uid());
  mode public.salary_mode;
  split uuid;
  l jsonb;
  i integer := 0;
  customs integer := 0;
  k public.split_line_kind;
  old_lines jsonb;
  old_set jsonb := '[]'::jsonb;
  g uuid;
  u uuid;
  nm text;
  prev jsonb;
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
  -- 2026-11-09: 각자 모드 파트너 월급 계획은 보기만(쓰는 돈 줄도 못 고침). 예전 ‘파트너 저금 줄만 잠금’ 대신
  if mode = 'separate' and p_owner <> uid then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if split is null then
    insert into public.salary_split (space_id, owner_user_id, updated_by)
      values (sid, p_owner, uid) returning id into split;
  else
    select jsonb_agg(jsonb_build_object('kind', kind, 'goal_id', goal_id, 'user_id', user_id, 'name', name, 'amount', amount)),
           coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'goal_id', goal_id, 'user_id', user_id, 'name', name,
             'in_checklist', in_checklist, 'auto_pay', auto_pay, 'auto_day', auto_day)), '[]'::jsonb)
      into old_lines, old_set from public.split_line where split_id = split;
    update public.salary_split set updated_by = uid, updated_at = now(), version = version + 1
      where id = split;
    delete from public.split_line where split_id = split;
  end if;

  for l in select * from jsonb_array_elements(p_lines) loop
    k := (l->>'kind')::public.split_line_kind;
    if k = 'saving' and not exists (
        select 1 from public.goal g0
        where g0.id = (l->>'goal_id')::uuid and g0.space_id = sid and g0.deleted_at is null) then
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
    g := case when k = 'saving' then (l->>'goal_id')::uuid end;
    u := case when k = 'allowance' then coalesce((l->>'user_id')::uuid, p_owner, uid) end;
    nm := case when k = 'custom' then btrim(l->>'name') end;
    select x into prev from jsonb_array_elements(old_set) x
      where x->>'kind' = k::text and (x->>'goal_id')::uuid is not distinct from g
        and (x->>'user_id')::uuid is not distinct from u and (x->>'name') is not distinct from nm
      limit 1;
    insert into public.split_line (split_id, space_id, kind, goal_id, user_id, name, amount, sort,
                                   in_checklist, auto_pay, auto_day)
    values (
      split, sid, k, g, u, nm,
      (l->>'amount')::bigint,
      i,
      coalesce((l->>'in_checklist')::boolean, (prev->>'in_checklist')::boolean),
      coalesce((l->>'auto_pay')::boolean, (prev->>'auto_pay')::boolean),
      case when l ? 'auto_day' then (l->>'auto_day')::smallint else (prev->>'auto_day')::smallint end
    );
    prev := null;
    i := i + 1;
  end loop;
  if old_lines is not null then
    perform public.log_split_changes(split, old_lines);
  end if;
  perform public.sync_checklist(split);
  return split;
end;
$$;

-- ─────────────────────────── 알림 ───────────────────────────
-- 계약 10: 알림 kind → push_kinds 키(null = 고를 수 없는 종류, 늘 보냄)
create function public.push_kind_key(p_kind text)
returns text language sql immutable set search_path = '' as $$
  select case
    when p_kind = 'care_day' then 'care'
    when p_kind in ('payday', 'review_due') then 'payday'
    when p_kind in ('goal_achieved', 'bundle_achieved') then 'achieved'
    when p_kind in ('partner_change', 'salary_mode', 'cycle_day', 'weekly_summary', 'behalf_checked') then 'shared_change'
    when p_kind = 'my_allowance' then 'my_allowance'
    when p_kind = 'progress_news' then 'progress_news'
  end;
$$;

create function public.push_kind_on(p_kinds jsonb, p_kind text)
returns boolean language sql immutable set search_path = '' as $$
  select public.push_kind_key(p_kind) is null
    or coalesce(p_kinds ->> public.push_kind_key(p_kind), 'true') <> 'false';
$$;

create or replace function public.claim_push(p_limit integer default 100, p_now timestamptz default now())
returns table(notification_id uuid, title text, body text, target text, platform text, token text)
language plpgsql security definer set search_path = '' as $$
declare
  hour integer := extract(hour from p_now at time zone 'Asia/Seoul')::int;
  ids uuid[];
begin
  select array_agg(x.id) into ids from (
    select n.id
    from public.notification n
    join public.app_user u on u.id = n.user_id and u.status = 'active'
    where n.pushed_at is null and n.read_at is null
      and n.created_at > p_now - public.noti_send_window(u.quiet_start, u.quiet_end)
      and public.push_wanted(u.noti_prefs, n.topic)
      -- v2.2 알림 종류 골라 켜기(P-11·S-14)
      and public.push_kind_on(u.push_kinds, n.kind)
      and exists (select 1 from public.push_device d where d.user_id = n.user_id)
      -- 방해 금지(보안·계정 알림은 바로): 끝나면 보냄
      and (public.noti_always_mail(n.kind) or not (
        u.quiet_start <> u.quiet_end and case when u.quiet_start < u.quiet_end
          then hour >= u.quiet_start and hour < u.quiet_end
          else hour >= u.quiet_start or hour < u.quiet_end end))
    order by n.created_at
    limit least(greatest(coalesce(p_limit, 100), 1), 500)
    for update of n skip locked
  ) x;
  if ids is null then
    return;
  end if;
  update public.notification set pushed_at = p_now where id = any(ids);
  -- 분석: 알림마다 한 번(기기 수와 상관없이)
  perform public.track_noti_sent(n.user_id, n.space_id, n.kind, 'os')
    from public.notification n where n.id = any(ids);
  return query
    select n.id, coalesce(n.push_title, n.title), case when n.push_hidden then null else n.body end, n.target,
      d.platform, d.token
    from public.notification n
    join public.push_device d on d.user_id = n.user_id
    where n.id = any(ids);
end;
$$;

-- 진행 소식의 대표 저금(계약, core pickHero 첫 단계와 같게): 볼 수 있는 저금 중 모으는 중(active, delayed)이고
-- 목표 금액이 있는 것. 공동(owner 없음) 먼저 → priority → 만든 순. pct = 내림(모은 금액 × 100 / 목표 금액), 최대 100.
-- 같이 모으기 묶음(PR 4)이 생기면 묶음이 맨 앞
create function public.progress_hero(p_user uuid)
returns table(goal_id uuid, name text, pct integer)
language sql stable security definer set search_path = '' as $$
  select g.id, g.name,
    least(100, floor(public.goal_saved(g.id)::numeric * 100 / g.target_amount))::int
  from public.goal g
  join public.app_user u on u.id = p_user and u.space_id = g.space_id
  where g.deleted_at is null and g.closed_at is null and g.status in ('active', 'delayed')
    and g.target_amount > 0 and (g.owner_user_id is null or g.owner_user_id = p_user)
  order by (g.owner_user_id is null) desc, g.priority, g.created_at
  limit 1;
$$;
revoke all on function public.progress_hero(uuid) from public, anon, authenticated;

-- 월급날 09:00(계약 7): 손 줄이 1개 이상인 목록만 월급날 알림
create or replace function public.send_morning_notifications(p_today date default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  today date := coalesce(p_today, public.kst_today());
  c public.care_day;
  cl public.pay_checklist;
  a public.asset;
  iv public.invite;
  sp public.couple_space;
  u public.app_user;
  d date;
  n integer;
  title text;
  cnt integer := 0;
begin
  -- 경조사: 두 사람 모두(미합류면 있는 사람). 서프라이즈는 재기획으로 새로 안 만들지만 남은 것은 만든 사람만, OS 알림 숨김
  for c in
    select x.* from public.care_day x
    join public.couple_space s on s.id = x.space_id and s.deleted_at is null
    where x.deleted_at is null and coalesce(array_length(x.alerts, 1), 0) > 0
  loop
    d := public.care_next_date(c, today);
    continue when d is null;
    n := d - today;
    continue when not (n = any (c.alerts));
    title := case n
      when 0 then '오늘은 ' || public.ko_is(c.name)
      when 7 then public.ko_subj(c.name) || ' 일주일 남았어요'
      when 14 then public.ko_subj(c.name) || ' 2주 남았어요'
      when 30 then public.ko_subj(c.name) || ' 한 달 남았어요'
      else public.ko_subj(c.name) || ' ' || n || '일 남았어요' end;
    for u in
      select x.* from public.app_user x
      where x.space_id = c.space_id and x.status = 'active' and (not c.secret or x.id = c.created_by)
    loop
      perform public.notify(
        u.id, c.space_id, 'care_day', title, case when n = 7 then '준비는 어떻게 되고 있나요?' end,
        '/calendar/day/' || c.id, 'gift', null,
        'care:' || c.id || ':' || d || ':' || n || ':' || u.id,
        case when c.secret then '경조사 알림이 있어요' end, c.secret);
      cnt := cnt + 1;
    end loop;
  end loop;

  -- 월급날: 오늘 시작한 체크리스트의 주인(합쳐서 = 둘 다). v2.2: 손 줄이 1개 이상일 때만(F8). 없으면 진행 소식(send_progress_news)
  for cl in
    select x.* from public.pay_checklist x
    join public.couple_space s on s.id = x.space_id and s.deleted_at is null
    where x.cycle_start = today and x.state <> 'closed'
      and exists (select 1 from public.pay_check_line l where l.checklist_id = x.id and not l.auto)
  loop
    for u in
      select x.* from public.app_user x
      where x.space_id = cl.space_id and x.status = 'active' and (cl.owner_user_id is null or x.id = cl.owner_user_id)
    loop
      perform public.notify(u.id, cl.space_id, 'payday', '오늘은 월급날이에요',
        '계획대로 됐는지 한 번만 확인해 주세요', -- [확인 필요] v2.2 7-2
        '/salary', 'calendar-check', null, 'payday:' || cl.id || ':' || u.id);
      cnt := cnt + 1;
    end loop;
  end loop;

  -- 만기 D-60(명의자, 공동 명의면 둘 다) / 전세 계약 만기 6개월 전(둘 다)
  for a in
    select x.* from public.asset x
    join public.couple_space s on s.id = x.space_id and s.deleted_at is null
    where x.deleted_at is null and x.status = 'held' and x.side = 'asset' and x.maturity_date is not null
      and ((x.kind = 'deposit_money' and x.maturity_date = (today + interval '6 months')::date)
        or (x.kind <> 'deposit_money' and x.maturity_date = today + 60))
  loop
    for u in
      select x.* from public.app_user x
      where x.space_id = a.space_id and x.status = 'active'
        and (a.kind = 'deposit_money' or a.owner <> 'person' or x.id = a.owner_user_id)
    loop
      if a.kind = 'deposit_money' then
        perform public.notify(u.id, a.space_id, 'jeonse_end', '전세 계약이 6개월 뒤 끝나요',
          '연장할지, 이사나 매수할지 정해 볼까요?', '/assets/' || a.id, 'house', null,
          'jeonse:' || a.id || ':' || a.maturity_date || ':' || u.id);
      else
        perform public.notify(u.id, a.space_id, 'maturity', public.ko_subj(a.name) || ' 두 달 뒤 만기예요', null,
          '/assets/' || a.id, 'piggy-bank', null, 'maturity:' || a.id || ':' || a.maturity_date || ':' || u.id);
      end if;
      cnt := cnt + 1;
    end loop;
  end loop;

  -- 만기일 당일: 만기된 돈 정리(F-04a) → 명의자(공동 명의면 둘 다). 전세 보증금은 빼고
  for a in
    select x.* from public.asset x
    join public.couple_space s on s.id = x.space_id and s.deleted_at is null
    where x.deleted_at is null and x.status = 'held' and x.side = 'asset'
      and x.kind <> 'deposit_money' and x.maturity_date = today
  loop
    for u in
      select x.* from public.app_user x
      where x.space_id = a.space_id and x.status = 'active' and (a.owner <> 'person' or x.id = a.owner_user_id)
    loop
      perform public.notify(u.id, a.space_id, 'matured', public.ko_subj(a.name) || ' 만기됐어요',
        '어디로 옮겼는지 알려 주세요', '/assets/' || a.id || '/matured', 'piggy-bank', null,
        'matured:' || a.id || ':' || a.maturity_date || ':' || u.id);
      cnt := cnt + 1;
    end loop;
  end loop;

  -- 연말정산 준비: 1월 둘째 주 월요일(8~14일 월요일), 결혼한 부부 두 사람 → 체크리스트 ‘연말정산’ 항목
  if extract(month from today) = 1 and extract(isodow from today) = 1 and extract(day from today) between 8 and 14 then
    for u in
      select x.* from public.app_user x
      join public.couple_space s on s.id = x.space_id and s.deleted_at is null and s.marriage_status = 'married'
      where x.status = 'active'
    loop
      perform public.notify(u.id, u.space_id, 'year_end_tax', '연말정산을 준비할 때예요',
        '공제를 누구에게 모을지 정해 볼까요?', '/settings/guides/check/year-end-tax', 'receipt', null,
        'tax:' || u.space_id || ':' || extract(year from today)::int || ':' || u.id);
      cnt := cnt + 1;
    end loop;
  end if;

  -- 초대 코드: 만료 3일·1일 전 리마인드, 만료 다음 날(아직 합류 전일 때만, 가장 최근 코드만)
  for iv in
    select distinct on (x.space_id) x.* from public.invite x
    join public.couple_space s on s.id = x.space_id and s.deleted_at is null and s.couple_state = 'not_joined'
    where x.used_at is null and x.created_by is not null
    order by x.space_id, x.created_at desc
  loop
    -- 누군가 합류하는 중(코드를 잡아 둠)이면 보내지 않음(D1)
    continue when iv.used_by is not null or (iv.reserved_by is not null and iv.reserved_until > now());
    select * into sp from public.couple_space where id = iv.space_id;
    n := (iv.expires_at at time zone 'Asia/Seoul')::date - today;
    if n in (3, 1) then
      perform public.notify(iv.created_by, iv.space_id, 'invite_remind', '초대 코드가 ' || n || '일 뒤 만료돼요',
        coalesce(sp.partner_nickname || '님에게', '파트너에게') || ' 다시 보내 볼까요?',
        '/settings/couple', 'user-plus', null, 'invite:' || iv.id || ':remind:' || n);
      cnt := cnt + 1;
    elsif n = -1 then
      perform public.notify(iv.created_by, iv.space_id, 'invite_expired', '초대 코드가 만료됐어요',
        '새 코드를 만들어 다시 보낼까요?', '/settings/couple', 'user-plus', null, 'invite:' || iv.id || ':expired');
      cnt := cnt + 1;
    end if;
  end loop;
  return cnt;
end;
$$;

-- 월급 전 확인 20:00(계약 7): 남은 손 줄이 있을 때만. 문구 v2.2 7-2
create or replace function public.send_evening_notifications(p_today date default null)
returns integer language plpgsql security definer set search_path = '' as $$
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
    for u in
      select x.* from public.app_user x
      where x.space_id = cl.space_id and x.status = 'active' and (cl.owner_user_id is null or x.id = cl.owner_user_id)
    loop
      -- 그 사람이 확인할 수 있는 손 줄만(합쳐서 남의 용돈 줄 빼고)
      select count(*) into left_n from public.pay_check_line l
        where l.checklist_id = cl.id and l.state = 'wait' and not l.auto
          and not (cl.owner_user_id is null and l.kind = 'allowance' and l.user_id is not null and l.user_id <> u.id);
      continue when left_n = 0;
      -- 2026-11-12 D3: 알림이 가리킨 체크리스트만 W-05에(기간이 지났거나 끝난 사이클이면 앱이 W-02로)
      perform public.notify(u.id, cl.space_id, 'review_due',
        public.md_label(cl.cycle_start) || ' 월급에서 확인할 게 ' || left_n || '개 남았어요', null, -- [확인 필요] v2.2 7-2
        '/salary/review?checklist=' || cl.id, 'clipboard-text', null, 'review:' || cl.id || ':' || u.id);
      cnt := cnt + 1;
    end loop;
  end loop;
  return cnt;
end;
$$;

-- 진행 소식(G13, 계약 7): 월급날 09:00 손 줄 0인 목록의 주인(합쳐서 둘 다), 날짜 없는 사람은 매달 1일.
-- push_kinds.progress_news를 끈 사람, 대표 저금이 없는 사람은 없음. 본문에 금액 없음
create function public.send_progress_news(p_today date default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  today date := coalesce(p_today, public.kst_today());
  cl public.pay_checklist;
  u public.app_user;
  h record;
  cnt integer := 0;
begin
  for cl in
    select x.* from public.pay_checklist x
    join public.couple_space s on s.id = x.space_id and s.deleted_at is null
    where x.cycle_start = today and x.state <> 'closed'
      and not exists (select 1 from public.pay_check_line l where l.checklist_id = x.id and not l.auto)
  loop
    for u in
      select x.* from public.app_user x
      where x.space_id = cl.space_id and x.status = 'active' and (cl.owner_user_id is null or x.id = cl.owner_user_id)
        and public.push_kind_on(x.push_kinds, 'progress_news')
    loop
      select * into h from public.progress_hero(u.id);
      continue when h.goal_id is null;
      perform public.notify(u.id, cl.space_id, 'progress_news', '월급날이에요', -- [확인 필요] v2.2 7-2
        h.name || ' ' || h.pct || '%까지 왔어요', '/salary/items/' || h.goal_id, 'piggy-bank', null,
        'progress:' || cl.id || ':' || u.id);
      cnt := cnt + 1;
      h := null;
    end loop;
  end loop;
  -- 날짜 없는 사람(확인 목록 없음): 매달 1일
  if extract(day from today) = 1 then
    for u in
      select x.* from public.app_user x
      join public.couple_space s on s.id = x.space_id and s.deleted_at is null
      where x.status = 'active' and x.payday_none and public.push_kind_on(x.push_kinds, 'progress_news')
        and public.cycle_day(x.space_id, case when s.salary_mode = 'joint' then null else x.id end) is null
    loop
      select * into h from public.progress_hero(u.id);
      continue when h.goal_id is null;
      perform public.notify(u.id, u.space_id, 'progress_news', '이번 달 진행 소식이에요', -- [확인 필요]
        h.name || ' ' || h.pct || '%까지 왔어요', '/salary/items/' || h.goal_id, 'piggy-bank', null,
        'progress:none:' || u.id || ':' || to_char(today, 'YYYY-MM'));
      cnt := cnt + 1;
      h := null;
    end loop;
  end if;
  return cnt;
end;
$$;
revoke all on function public.send_progress_news(date) from public, anon, authenticated;

-- ─────────────────────────── 예약 작업 ───────────────────────────
-- 00:00 KST cycle-checklists(목록 만들기, 그 자리에서 이미 나간 자동 줄 확인) → 00:05 auto-confirm-lines →
-- 09:00 send-morning-notifications(월급날) + send-progress-news
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('auto-confirm-lines', '5 15 * * *', 'select public.auto_confirm_due_lines()');
    perform cron.schedule('send-progress-news', '0 0 * * *', 'select public.send_progress_news()');
  end if;
end;
$$;
