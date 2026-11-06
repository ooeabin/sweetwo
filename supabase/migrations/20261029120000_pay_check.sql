-- 월급 체크(W-02, W-02a, W-05)와 목표 모은 돈(docs/spec/20-salary-plan.md, 06 4장).
-- 분배표를 고치면 이번 사이클 체크 안 한 줄만 새 금액으로(체크한 줄은 그대로). 새 사이클을 만들면 지난 사이클은 끝남.

-- 그 분배표의 지금 사이클 체크리스트를 분배표에 맞춤: 대기 줄을 지우고, 아직 체크·못 함 기록이 없는 줄을 새 금액으로
create or replace function public.sync_checklist(p_split uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  cl uuid;
  today date := public.kst_today();
begin
  select c.id into cl from public.pay_checklist c
    join public.salary_split s on s.id = p_split
    where c.space_id = s.space_id and c.owner_user_id is not distinct from s.owner_user_id
      and c.cycle_start <= today and c.cycle_end >= today;
  if cl is null then
    return;
  end if;
  delete from public.pay_check_line where checklist_id = cl and state = 'wait';
  insert into public.pay_check_line (checklist_id, space_id, split_line_id, kind, goal_id, user_id, name, planned, sort)
    select cl, l.space_id, l.id, l.kind, l.goal_id, l.user_id, l.name, l.amount, l.sort
    from public.split_line l
    where l.split_id = p_split and l.amount > 0
      and not exists (
        select 1 from public.pay_check_line x
        where x.checklist_id = cl and x.kind = l.kind
          and x.goal_id is not distinct from l.goal_id
          and x.user_id is not distinct from l.user_id
          and x.name is not distinct from l.name);
  update public.pay_checklist set split_id = p_split,
    state = case when exists (select 1 from public.pay_check_line where checklist_id = cl and state = 'wait') then 'open' else 'done' end
    where id = cl;
end;
$$;
revoke all on function public.sync_checklist(uuid) from public, anon, authenticated;

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

create or replace function public.start_checklist(p_owner uuid default null)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  sid uuid := (select space_id from public.app_user where id = auth.uid());
  split uuid;
  dday smallint;
  today date := public.kst_today();
  s date;
  e date;
  nxt date;
  cl uuid;
begin
  if sid is null then
    raise exception 'no_space' using errcode = '42501';
  end if;
  select id into split from public.salary_split where space_id = sid and owner_user_id is not distinct from p_owner;
  if split is null then
    raise exception 'no_split' using errcode = '22023';
  end if;
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
  -- 지난 사이클은 끝남: 체크 안 한 줄은 ‘못 함’(07 4장)
  update public.pay_check_line set state = 'skipped'
    where state = 'wait' and checklist_id in (
      select id from public.pay_checklist
      where space_id = sid and owner_user_id is not distinct from p_owner and cycle_start < s);
  update public.pay_checklist set state = 'closed'
    where space_id = sid and owner_user_id is not distinct from p_owner and cycle_start < s and state <> 'closed';
  insert into public.pay_checklist (space_id, split_id, owner_user_id, cycle_start, cycle_end, label)
    values (sid, split, p_owner, s, e, extract(month from s)::int || '월 월급')
    returning id into cl;
  insert into public.pay_check_line (checklist_id, space_id, split_line_id, kind, goal_id, user_id, name, planned, sort)
    select cl, sid, l.id, l.kind, l.goal_id, l.user_id, l.name, l.amount, l.sort
    from public.split_line l
    where l.split_id = split and l.amount > 0;
  return cl;
end;
$$;

-- 줄 체크(W-02), 풀기, ‘이번 달은 못 했어요’(W-05), 다른 금액(W-02a, 0원이면 못 함).
-- 지난 사이클은 읽기 전용. 같은 줄을 거의 동시에 체크하면 먼저 저장된 체크 유지(already_checked)
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
begin
  select * into l from public.pay_check_line where id = p_line for update;
  if l.id is null or l.space_id is distinct from sid then
    raise exception 'no_line' using errcode = '42501';
  end if;
  select * into c from public.pay_checklist where id = l.checklist_id;
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
  update public.pay_check_line set
    state = case when p_state = 'checked' and p_actual = 0 then 'skipped' else p_state end,
    actual = case when p_state = 'checked' and p_actual is not null and p_actual > 0 then p_actual end,
    checked_by = case when p_state = 'wait' then null else uid end,
    checked_at = case when p_state = 'wait' then null else now() end,
    on_behalf = p_state <> 'wait' and c.owner_user_id is not null and c.owner_user_id <> uid
  where id = p_line;
  update public.pay_checklist set
    state = case when exists (select 1 from public.pay_check_line where checklist_id = c.id and state = 'wait') then 'open' else 'done' end
  where id = c.id;
end;
$$;
revoke all on function public.check_pay_line(uuid, text, bigint) from public, anon;
grant execute on function public.check_pay_line(uuid, text, bigint) to authenticated;

-- 목표별 체크한 저금 합(모은 돈 = 이미 모은 돈 + 이 합 + …, 06 4장). 다른 금액이면 실제 금액. 보는 사람 권한(RLS)대로
create or replace function public.goal_checked_sums()
returns table (goal_id uuid, amount bigint)
language sql
stable
set search_path = ''
as $$
  select l.goal_id, sum(coalesce(l.actual, l.planned))::bigint
  from public.pay_check_line l
  where l.kind = 'saving' and l.state = 'checked' and l.goal_id is not null
  group by l.goal_id;
$$;
revoke all on function public.goal_checked_sums() from public, anon;
grant execute on function public.goal_checked_sums() to authenticated;
