-- 재기획(docs/adr/0003-replan-goal-checklist.md): 월급 관리 방식, 목표 주인, 월급 분배표(W-01·O-50), 이번 달 월급 체크리스트(W-02).
-- 기획: docs/spec/20-salary-plan.md, 07-month-cycle.md, 17-onboarding-2.md, 22-goals.md ‘목표 종류’. 스키마는 추가만(옛 컬럼은 2단계로 지움).

-- 월급 관리 방식(O-30, S-11f). 각자 = 사람마다 분배표, 합쳐서 = 부부 공간에 하나
create type public.salary_mode as enum ('separate', 'joint');
alter table public.couple_space
  add column salary_mode public.salary_mode not null default 'separate',
  add column joint_cycle_day smallint check (joint_cycle_day between 1 and 31); -- 합쳐서 기준일(S-11d), null이면 두 사람 월급날 중 늦은 날
grant update (salary_mode, joint_cycle_day) on public.couple_space to authenticated;

-- 목표 주인(우리 목표 / 내 목표). null = 우리 목표, 사용자 id = 그 사람의 내 목표
alter table public.goal
  add column owner_user_id uuid references auth.users (id) on delete cascade,
  add column visibility text not null default 'all' check (visibility in ('all', 'amount')); -- 내 목표만: 모두 보여 주기 / 금액만 보여 주기

-- ── 월급 분배표 ───────────────────────────────────────────────────────────────
create type public.split_line_kind as enum ('saving', 'fixed', 'living', 'allowance', 'custom');

create table public.salary_split (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.couple_space (id) on delete cascade,
  owner_user_id uuid references auth.users (id) on delete cascade, -- 각자 = 그 사람, 합쳐서 = null
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);
create unique index salary_split_owner_idx
  on public.salary_split (space_id, coalesce(owner_user_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table public.split_line (
  id uuid primary key default gen_random_uuid(),
  split_id uuid not null references public.salary_split (id) on delete cascade,
  space_id uuid not null references public.couple_space (id) on delete cascade,
  kind public.split_line_kind not null,
  goal_id uuid references public.goal (id) on delete cascade, -- 저금 줄만
  user_id uuid references auth.users (id) on delete cascade, -- 용돈 줄만(합쳐서면 사람마다 1줄)
  name text check (char_length(name) between 1 and 20), -- 직접 추가 줄만
  amount bigint not null check (amount between 0 and 99999999999 and amount % 10000 = 0), -- 1만 원 단위
  sort smallint not null,
  check ((kind = 'saving') = (goal_id is not null)),
  check ((kind = 'custom') = (name is not null))
);
create index split_line_split_idx on public.split_line (split_id, sort);

alter table public.salary_split enable row level security;
create policy salary_split_select on public.salary_split for select to authenticated using (public.is_space_member(space_id));
create policy salary_split_insert on public.salary_split for insert to authenticated with check (false);
create policy salary_split_update on public.salary_split for update to authenticated using (false);
create policy salary_split_delete on public.salary_split for delete to authenticated using (false);
revoke insert, update, delete on public.salary_split from authenticated, anon;

alter table public.split_line enable row level security;
create policy split_line_select on public.split_line for select to authenticated using (public.is_space_member(space_id));
create policy split_line_insert on public.split_line for insert to authenticated with check (false);
create policy split_line_update on public.split_line for update to authenticated using (false);
create policy split_line_delete on public.split_line for delete to authenticated using (false);
revoke insert, update, delete on public.split_line from authenticated, anon;

-- 분배표 저장(O-50, W-01): 그 주인의 분배표 줄을 통째로 바꿈. 줄 순서 = 배열 순서.
-- p_owner: 각자면 사람 id(나 또는 같은 공간 배우자), 합쳐서면 null.
-- p_lines: [{kind, amount, goal_id?, user_id?, name?}]
create or replace function public.save_split(p_owner uuid, p_lines jsonb)
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
  return split;
end;
$$;
revoke all on function public.save_split(uuid, jsonb) from public, anon;
grant execute on function public.save_split(uuid, jsonb) to authenticated;

-- ── 이번 달 월급 체크리스트 ────────────────────────────────────────────────────
create table public.pay_checklist (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.couple_space (id) on delete cascade,
  split_id uuid references public.salary_split (id) on delete set null,
  owner_user_id uuid references auth.users (id) on delete cascade, -- null = 합쳐서 공동
  cycle_start date not null, -- 기준일
  cycle_end date not null, -- 다음 기준일 전날
  label text not null, -- ‘10월 월급’
  state text not null default 'open' check (state in ('open', 'done', 'closed')), -- 진행 중 / 다 했어요 / 끝남
  created_at timestamptz not null default now(),
  check (cycle_end >= cycle_start)
);
create unique index pay_checklist_cycle_idx
  on public.pay_checklist (space_id, coalesce(owner_user_id, '00000000-0000-0000-0000-000000000000'::uuid), cycle_start);

create table public.pay_check_line (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.pay_checklist (id) on delete cascade,
  space_id uuid not null references public.couple_space (id) on delete cascade,
  split_line_id uuid references public.split_line (id) on delete set null, -- 줄을 지워도 기록은 남음
  kind public.split_line_kind not null,
  goal_id uuid references public.goal (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  name text,
  planned bigint not null check (planned between 0 and 99999999999),
  actual bigint check (actual between 0 and 99999999999), -- W-02a 다른 금액
  state text not null default 'wait' check (state in ('wait', 'checked', 'skipped')), -- 대기 / 체크 / 못 함
  checked_by uuid references auth.users (id) on delete set null,
  checked_at timestamptz,
  on_behalf boolean not null default false, -- 대신 체크
  sort smallint not null
);
create index pay_check_line_list_idx on public.pay_check_line (checklist_id, sort);
create index pay_check_line_goal_idx on public.pay_check_line (goal_id) where state = 'checked';

alter table public.pay_checklist enable row level security;
create policy pay_checklist_select on public.pay_checklist for select to authenticated using (public.is_space_member(space_id));
create policy pay_checklist_insert on public.pay_checklist for insert to authenticated with check (false);
create policy pay_checklist_update on public.pay_checklist for update to authenticated using (false);
create policy pay_checklist_delete on public.pay_checklist for delete to authenticated using (false);
revoke insert, update, delete on public.pay_checklist from authenticated, anon;

alter table public.pay_check_line enable row level security;
create policy pay_check_line_select on public.pay_check_line for select to authenticated using (public.is_space_member(space_id));
create policy pay_check_line_insert on public.pay_check_line for insert to authenticated with check (false);
create policy pay_check_line_update on public.pay_check_line for update to authenticated using (false);
create policy pay_check_line_delete on public.pay_check_line for delete to authenticated using (false);
revoke insert, update, delete on public.pay_check_line from authenticated, anon;

-- 그 분배표의 기준일(일). 각자 = 주인 월급날, 합쳐서 = joint_cycle_day 또는 두 사람 월급날 중 늦은 날(07 1장).
-- 말일은 31로 셈(그 달에 없는 날은 말일). 월급이 없으면 null
create or replace function public.cycle_day(p_space uuid, p_owner uuid)
returns smallint
language sql
stable
set search_path = ''
as $$
  select case
    when p_owner is not null then
      (select case when u.payday_last then 31 else u.payday end from public.app_user u where u.id = p_owner)
    else coalesce(
      (select s.joint_cycle_day from public.couple_space s where s.id = p_space),
      (select max(case when u.payday_last then 31 else u.payday end) from public.app_user u where u.space_id = p_space))
  end::smallint;
$$;

-- 그 달의 기준일 날짜(없는 날은 말일)
create or replace function public.cycle_date(p_day smallint, y integer, m integer)
returns date
language sql
immutable
set search_path = ''
as $$
  select make_date(y, m, least(p_day, extract(day from (make_date(y, m, 1) + interval '1 month - 1 day'))::int));
$$;

-- 그 분배표로 지금 사이클 체크리스트를 만듦(이미 있으면 그것). 첫 사이클은 O-60 직후(17 O-60):
-- 오늘 이전 가장 가까운 기준일 ~ 다음 기준일 전날. 0원 줄과 남는 돈은 넣지 않음. 월급이 없으면 null
create or replace function public.start_checklist(p_owner uuid)
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
revoke all on function public.start_checklist(uuid) from public, anon;
grant execute on function public.start_checklist(uuid) to authenticated;
