-- 월말 정리 ‘더 꼼꼼히 정리하기’(21 W-04b~f·i, 06 6장·7장). 기본 흐름(W-04j·k·g)은 그대로, 꼼꼼 모드에서만 씀.
--
-- close_balance(W-04b): 정리마다 공동 통장 잔액. 예상 잔액(expected)은 앱 core rules/close-detail.ts가 계산해 같이 남김
--   (지난 정리 잔액, 첫 정리는 O-63 start_balance + 이번 나누기, 아직 안 옮긴 ‘목표자금 → 공동 생활비’ 줄 제외)
-- month_close 열
--   detailed_at: 꼼꼼 모드를 연 때
--   emergency_used / emergency_reason(W-04d): 비상금이 줄었을 때 답
--   goal_gap_amount / goal_gap_goal_id / goal_gap_not_goal(W-04c): 목표자금 통장이 기록보다 더 줄었을 때 1질문 답
-- goal_use.month_close_id: W-04c에서 고른 목표의 사용 기록(source = 'close'). 다시 답하면 바꿈

create table public.close_balance (
  id uuid primary key default gen_random_uuid(),
  month_close_id uuid not null references public.month_close (id) on delete cascade,
  space_id uuid not null references public.couple_space (id) on delete cascade,
  account_id uuid not null references public.account (id) on delete cascade,
  amount bigint not null check (amount between 0 and 99999999999),
  expected bigint check (expected between -99999999999 and 99999999999),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null,
  unique (month_close_id, account_id)
);
create trigger close_balance_actor before insert or update on public.close_balance
  for each row execute function public.stamp_actor();
create trigger close_balance_touch before update on public.close_balance
  for each row execute function public.touch_row();

alter table public.close_balance enable row level security;
create policy close_balance_select on public.close_balance for select to authenticated using (public.is_space_member(space_id));
create policy close_balance_insert on public.close_balance for insert to authenticated with check (
  public.is_space_member(space_id)
  and exists (select 1 from public.month_close c where c.id = month_close_id and c.space_id = close_balance.space_id)
  and exists (select 1 from public.account a where a.id = account_id and a.space_id = close_balance.space_id)
);
create policy close_balance_update on public.close_balance for update to authenticated
  using (public.is_space_member(space_id)) with check (
    public.is_space_member(space_id)
    and exists (select 1 from public.month_close c where c.id = month_close_id and c.space_id = close_balance.space_id)
    and exists (select 1 from public.account a where a.id = account_id and a.space_id = close_balance.space_id)
  );
create policy close_balance_delete on public.close_balance for delete to authenticated using (false);
revoke delete on public.close_balance from authenticated, anon;

alter table public.month_close
  add column detailed_at timestamptz,
  add column emergency_used boolean,
  add column emergency_reason text check (emergency_reason in ('hospital', 'repair', 'family_event', 'living_short', 'etc')),
  add column goal_gap_amount bigint check (goal_gap_amount between 0 and 99999999999),
  add column goal_gap_goal_id uuid references public.goal (id) on delete set null,
  add column goal_gap_not_goal boolean,
  add constraint month_close_emergency_reason check (emergency_reason is null or emergency_used);

alter table public.goal_use add column month_close_id uuid references public.month_close (id) on delete cascade;
create unique index goal_use_close_once on public.goal_use (month_close_id) where month_close_id is not null and deleted_at is null;

-- W-04c 차액 답: 고른 목표에서 차감(사용 기록 하나, 다시 답하면 바꿈) / 목표에서 쓴 돈이 아니에요(기록 지움)
create or replace function public.answer_goal_gap(p_close uuid, p_amount bigint, p_goal uuid default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c public.month_close;
  p public.monthly_plan;
begin
  select * into c from public.month_close where id = p_close and deleted_at is null for update;
  if c.id is null or not public.is_space_member(c.space_id) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if p_amount < 1 or p_amount > 99999999999 then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  if p_goal is not null and not exists (
      select 1 from public.goal g where g.id = p_goal and g.space_id = c.space_id and g.deleted_at is null) then
    raise exception 'bad_goal' using errcode = '22023';
  end if;
  select * into p from public.monthly_plan where id = c.plan_id;
  delete from public.goal_use where month_close_id = c.id;
  if p_goal is not null then
    insert into public.goal_use (space_id, goal_id, amount, used_on, paid_from, source, month_close_id)
      values (c.space_id, p_goal, p_amount, p.cycle_end, 'goal_fund', 'close', c.id);
  end if;
  update public.month_close set
    goal_gap_amount = p_amount,
    goal_gap_goal_id = p_goal,
    goal_gap_not_goal = p_goal is null
  where id = c.id;
end;
$$;
revoke execute on function public.answer_goal_gap(uuid, bigint, uuid) from public, anon;
grant execute on function public.answer_goal_gap(uuid, bigint, uuid) to authenticated;
