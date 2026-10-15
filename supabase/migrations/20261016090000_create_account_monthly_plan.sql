-- 온보딩 결과 O-63 통장 구조, O-66 첫 월급 플랜(docs/spec/17-onboarding-2.md, 06-calc-allocation.md 2장, 07-month-cycle.md)
-- 계산 규칙: packages/core/src/onboarding/cycle.ts

create type public.account_mode as enum ('single', 'roles'); -- 통장 하나로 / 역할별로 나눔
create type public.account_role as enum ('living', 'goal_fund', 'emergency', 'personal', 'wedding');
create type public.plan_status as enum ('created', 'splitting', 'closing', 'closed', 'skipped');
create type public.plan_line_target as enum ('account', 'goal');
create type public.plan_line_kind as enum ('split', 'emergency_to_living', 'goal_to_living');
create type public.plan_line_state as enum ('pending', 'done');

-- 통장 방식과 기준일(O-63, O-66, 설정 S-11d)
alter table public.couple_space
  add column account_mode public.account_mode, -- null = 아직 안 고름
  add column base_day smallint check (base_day between 1 and 31), -- 기준일. 말일은 base_day_last
  add column base_day_last boolean not null default false;
grant update (account_mode, base_day, base_day_last) on public.couple_space to authenticated;

-- 통장 = 실제 계좌가 아닌 ‘역할’. 역할별로 나눌 때만 공동 통장 3개(예비 각자 관리는 결혼 준비 1개)
create table public.account (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.couple_space (id) on delete cascade,
  role public.account_role not null,
  name text not null check (char_length(name) between 1 and 15),
  is_existing boolean not null default false, -- 쓰던 통장 / 새로 만들 통장
  start_balance bigint check (start_balance between 0 and 99999999999), -- 첫 월말 정리 기준선. 새 통장은 0
  owner_user_id uuid references auth.users (id) on delete set null, -- 개인 통장만
  sort integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null
);
-- 공동 역할은 공간마다 하나
create unique index account_role_once on public.account (space_id, role)
  where deleted_at is null and role <> 'personal';
create trigger account_actor before insert or update on public.account
  for each row execute function public.stamp_actor();
create trigger account_touch before update on public.account
  for each row execute function public.touch_row();

alter table public.account enable row level security;
create policy account_select on public.account for select to authenticated using (public.is_space_member(space_id));
create policy account_insert on public.account for insert to authenticated with check (public.is_space_member(space_id));
create policy account_update on public.account for update to authenticated
  using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));
create policy account_delete on public.account for delete to authenticated using (false);
revoke delete on public.account from authenticated, anon;

-- 월 플랜(‘{기준일의 월}월 월급 플랜’)과 플랜 줄. 만들기는 함수만(첫 플랜 start_first_plan, 이후 기준일 작업)
create table public.monthly_plan (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.couple_space (id) on delete cascade,
  label_month date not null check (extract(day from label_month) = 1), -- 기준일의 월(그 달 1일)
  cycle_start date not null,
  cycle_end date not null check (cycle_end >= cycle_start),
  status public.plan_status not null default 'created',
  is_partial boolean not null default false, -- 첫 사이클 남은 기간 플랜
  first_adjust bigint check (first_adjust between 0 and 99999999999), -- O-66에서 고친 이번 달 옮길 돈(1회)
  merged_close boolean not null default false, -- 남은 기간 15일 미만이면 다음 사이클과 합쳐 정리
  is_temp boolean not null default false, -- 임시 플랜(미합류 또는 추정값)
  snapshot jsonb not null default '{}'::jsonb, -- 만들 때 기준값
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null
);
create unique index monthly_plan_cycle_once on public.monthly_plan (space_id, cycle_start) where deleted_at is null;
create trigger monthly_plan_actor before insert or update on public.monthly_plan
  for each row execute function public.stamp_actor();
create trigger monthly_plan_touch before update on public.monthly_plan
  for each row execute function public.touch_row();

create table public.plan_line (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.monthly_plan (id) on delete cascade,
  space_id uuid not null references public.couple_space (id) on delete cascade,
  target public.plan_line_target not null,
  account_role public.account_role,
  goal_id uuid references public.goal (id) on delete set null,
  kind public.plan_line_kind not null default 'split',
  amount bigint not null check (amount between 0 and 99999999999), -- 계획액
  amount_groom bigint check (amount_groom between 0 and 99999999999), -- 분담액(신랑, 신부 쪽)
  amount_bride bigint check (amount_bride between 0 and 99999999999),
  state public.plan_line_state not null default 'pending',
  done_amount bigint check (done_amount between 0 and 99999999999), -- 실제 나눈 금액
  sort integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null,
  check ((target = 'account' and account_role is not null) or (target = 'goal' and goal_id is not null))
);
create index plan_line_plan_idx on public.plan_line (plan_id) where deleted_at is null;
create trigger plan_line_actor before insert or update on public.plan_line
  for each row execute function public.stamp_actor();
create trigger plan_line_touch before update on public.plan_line
  for each row execute function public.touch_row();

alter table public.monthly_plan enable row level security;
create policy monthly_plan_select on public.monthly_plan for select to authenticated using (public.is_space_member(space_id));
create policy monthly_plan_insert on public.monthly_plan for insert to authenticated with check (false);
create policy monthly_plan_update on public.monthly_plan for update to authenticated using (false);
create policy monthly_plan_delete on public.monthly_plan for delete to authenticated using (false);
revoke insert, update, delete on public.monthly_plan from authenticated, anon;

alter table public.plan_line enable row level security;
create policy plan_line_select on public.plan_line for select to authenticated using (public.is_space_member(space_id));
create policy plan_line_insert on public.plan_line for insert to authenticated with check (false);
create policy plan_line_update on public.plan_line for update to authenticated using (false);
create policy plan_line_delete on public.plan_line for delete to authenticated using (false);
revoke insert, update, delete on public.plan_line from authenticated, anon;

-- O-66 ‘시작하기’: 첫 월급 플랜(남은 기간)과 줄을 한 번에. 같은 사이클 플랜이 이미 있으면 그 id(다시 눌러도 하나)
create or replace function public.start_first_plan(
  p_label_month date,
  p_cycle_start date,
  p_cycle_end date,
  p_first_adjust bigint,
  p_merged_close boolean,
  p_is_temp boolean,
  p_snapshot jsonb,
  p_lines jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid uuid;
  pid uuid;
  l jsonb;
  i integer := 0;
begin
  select space_id into sid from public.app_user where id = uid and status = 'active';
  if sid is null then
    raise exception 'no_space' using errcode = '42501';
  end if;
  select id into pid from public.monthly_plan
    where space_id = sid and cycle_start = p_cycle_start and deleted_at is null;
  if pid is not null then
    return pid;
  end if;
  if jsonb_typeof(p_lines) <> 'array' then
    raise exception 'bad_lines' using errcode = '22023';
  end if;

  insert into public.monthly_plan (
    space_id, label_month, cycle_start, cycle_end, is_partial, first_adjust, merged_close, is_temp, snapshot
  ) values (
    sid, p_label_month, p_cycle_start, p_cycle_end, true, p_first_adjust, p_merged_close, p_is_temp,
    coalesce(p_snapshot, '{}'::jsonb)
  ) returning id into pid;

  for l in select * from jsonb_array_elements(p_lines) loop
    -- 목표 줄은 내 공간 목표만
    if l->>'goal_id' is not null and not exists (
      select 1 from public.goal g where g.id = (l->>'goal_id')::uuid and g.space_id = sid
    ) then
      raise exception 'bad_goal' using errcode = '42501';
    end if;
    insert into public.plan_line (
      plan_id, space_id, target, account_role, goal_id, amount, amount_groom, amount_bride, sort
    ) values (
      pid, sid, (l->>'target')::public.plan_line_target, (l->>'account_role')::public.account_role,
      (l->>'goal_id')::uuid, (l->>'amount')::bigint, (l->>'amount_groom')::bigint, (l->>'amount_bride')::bigint, i
    );
    i := i + 1;
  end loop;
  return pid;
end;
$$;
revoke execute on function public.start_first_plan(date, date, date, bigint, boolean, boolean, jsonb, jsonb) from public;
grant execute on function public.start_first_plan(date, date, date, bigint, boolean, boolean, jsonb, jsonb) to authenticated;
