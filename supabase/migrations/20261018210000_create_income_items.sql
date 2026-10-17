-- 상여금(17 O-34·O-35, 09 연간 이벤트: 들어오는 돈 전용)과 다른 수입(O-35b, 09 6-1 부업·월세·정부 지원금).
-- 다른 수입은 사람마다 월 금액 합계를 app_user.other_income에 모아 월 수입에 더함(월급 플랜, 분담, 정산 소득).
-- 상여금은 들어오는 달 ‘추가 소득 나누기’(W-07)에서 씀.

create type public.income_kind as enum ('side_job', 'rent', 'support');

create table public.income_item (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.couple_space (id) on delete cascade,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  kind public.income_kind not null,
  monthly_amount bigint not null check (monthly_amount between 0 and 99999999999),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null
);
create unique index income_item_once on public.income_item (owner_user_id, kind) where deleted_at is null;
create trigger income_item_actor before insert or update on public.income_item
  for each row execute function public.stamp_actor();
create trigger income_item_touch before update on public.income_item
  for each row execute function public.touch_row();

create table public.income_event (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.couple_space (id) on delete cascade,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 20),
  amount bigint not null check (amount between 1 and 99999999999),
  month smallint not null check (month between 1 and 12),
  yearly boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null
);
create index income_event_space_idx on public.income_event (space_id) where deleted_at is null;
create trigger income_event_actor before insert or update on public.income_event
  for each row execute function public.stamp_actor();
create trigger income_event_touch before update on public.income_event
  for each row execute function public.touch_row();

-- 같은 공간이면 보고, 넣기·고치기는 내 것만. 영구 삭제 없음
create or replace function public.is_own_space_row(p_space_id uuid, p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_space_member(p_space_id) and p_owner = auth.uid();
$$;
revoke execute on function public.is_own_space_row(uuid, uuid) from public, anon;
grant execute on function public.is_own_space_row(uuid, uuid) to authenticated;

alter table public.income_item enable row level security;
create policy income_item_select on public.income_item for select to authenticated
  using (public.is_space_member(space_id));
create policy income_item_insert on public.income_item for insert to authenticated
  with check (public.is_own_space_row(space_id, owner_user_id));
create policy income_item_update on public.income_item for update to authenticated
  using (public.is_own_space_row(space_id, owner_user_id))
  with check (public.is_own_space_row(space_id, owner_user_id));
create policy income_item_delete on public.income_item for delete to authenticated using (false);
revoke delete on public.income_item from authenticated, anon;

alter table public.income_event enable row level security;
create policy income_event_select on public.income_event for select to authenticated
  using (public.is_space_member(space_id));
create policy income_event_insert on public.income_event for insert to authenticated
  with check (public.is_own_space_row(space_id, owner_user_id));
create policy income_event_update on public.income_event for update to authenticated
  using (public.is_own_space_row(space_id, owner_user_id))
  with check (public.is_own_space_row(space_id, owner_user_id));
create policy income_event_delete on public.income_event for delete to authenticated using (false);
revoke delete on public.income_event from authenticated, anon;

-- 다른 수입 월 합계(사람마다). 앱은 못 고치고 트리거만
alter table public.app_user add column other_income bigint not null default 0;

create or replace function public.sum_other_income()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := coalesce(new.owner_user_id, old.owner_user_id);
begin
  update public.app_user set other_income = coalesce((
    select sum(monthly_amount) from public.income_item
    where owner_user_id = uid and deleted_at is null
  ), 0)
  where id = uid;
  return null;
end;
$$;
revoke execute on function public.sum_other_income() from public, anon, authenticated;
create trigger income_item_sum after insert or update on public.income_item
  for each row execute function public.sum_other_income();

-- 배우자 프로필에 다른 수입 합계(반환 칸이 바뀌어 다시 만듦)
drop function public.partner_profile();
create function public.partner_profile()
returns table (
  id uuid,
  nickname text,
  side public.couple_side,
  employment public.employment,
  monthly_income bigint,
  income_variable boolean,
  payday smallint,
  payday_last boolean,
  allowance bigint,
  other_income bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.nickname, p.side, p.employment, p.monthly_income, p.income_variable, p.payday, p.payday_last, p.allowance, p.other_income
  from public.app_user me
  join public.app_user p on p.space_id = me.space_id and p.id <> me.id and p.status = 'active'
  where me.id = auth.uid() and me.space_id is not null
  limit 1;
$$;
revoke execute on function public.partner_profile() from public, anon;
grant execute on function public.partner_profile() to authenticated;
