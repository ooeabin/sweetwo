-- 온보딩 ② 파트 3·5(docs/spec/17-onboarding-2.md): 수입, 월급날, 용돈, 공동 고정지출, 생활비, 대출 상환, 분담
-- 계산 규칙: docs/spec/06-calc-allocation.md 3·4장(packages/core/src/onboarding/plan.ts)

create type public.split_mode as enum ('half', 'income', 'custom');
create type public.expense_burden as enum ('shared', 'personal');

-- 내 수입과 용돈(O-31, O-32, O-51)
alter table public.app_user
  add column monthly_income bigint check (monthly_income between 0 and 99999999999), -- 월 실수령(변동 수입자는 기준 수입)
  add column income_variable boolean not null default false, -- 프리랜서·사업자: 가장 적게 번 달이 기준 수입
  add column payday smallint check (payday between 1 and 31), -- 월급날. 말일은 payday_last
  add column payday_last boolean not null default false,
  add column allowance bigint check (allowance between 0 and 99999999999); -- 내 용돈. null = 아직(계산은 50만 원 가정)
grant update (monthly_income, income_variable, payday, payday_last, allowance) on public.app_user to authenticated;

-- 공간 답(O-33, O-36, O-38, O-39, O-52). 배우자 몫은 합류 전 추정값, 합류 뒤 배우자 본인 값으로 덮어씀.
alter table public.couple_space
  add column partner_income bigint check (partner_income between 0 and 99999999999),
  add column partner_income_estimated boolean not null default false,
  add column partner_income_unknown boolean not null default false, -- ‘잘 모르겠어요’: ‘{나}님 몫’ 기준
  add column fixed_total bigint check (fixed_total between 0 and 99999999999), -- 같이 내는 고정지출 합계(대출 상환 제외)
  add column fixed_total_estimated boolean not null default false,
  add column living_budget bigint check (living_budget between 0 and 99999999999), -- 생활비 예산 초깃값
  add column living_budget_estimated boolean not null default false,
  add column loan_repayment bigint check (loan_repayment between 0 and 99999999999), -- 대출 월 상환 합계(고정지출에 포함)
  add column split_mode public.split_mode,
  add column split_ratio smallint check (split_ratio between 0 and 100 and split_ratio % 5 = 0), -- 직접 정할 때 내 몫 %
  add column split_deferred boolean not null default false; -- 파트 5 ‘나중에 할게요’: 기본값으로 계산, 할 일
grant update (
  partner_income, partner_income_estimated, partner_income_unknown, fixed_total, fixed_total_estimated,
  living_budget, living_budget_estimated, loan_repayment, split_mode, split_ratio, split_deferred
) on public.couple_space to authenticated;

-- 고정지출 항목(O-36 그룹과 세부 항목, O-37 금액은 첫 주 할 일). 그룹만 고르면 name = 그룹 이름.
create table public.fixed_expense (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.couple_space (id) on delete cascade,
  group_key text not null check (group_key ~ '^[a-z_]{2,30}$'),
  name text not null check (char_length(name) between 1 and 20),
  monthly_amount bigint check (monthly_amount between 0 and 99999999999),
  burden public.expense_burden not null default 'shared',
  sort integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null
);
create index fixed_expense_space_idx on public.fixed_expense (space_id) where deleted_at is null;

create trigger fixed_expense_actor before insert or update on public.fixed_expense
  for each row execute function public.stamp_actor();
create trigger fixed_expense_touch before update on public.fixed_expense
  for each row execute function public.touch_row();

alter table public.fixed_expense enable row level security;
create policy fixed_expense_select on public.fixed_expense for select to authenticated using (public.is_space_member(space_id));
create policy fixed_expense_insert on public.fixed_expense for insert to authenticated with check (public.is_space_member(space_id));
create policy fixed_expense_update on public.fixed_expense for update to authenticated
  using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));
create policy fixed_expense_delete on public.fixed_expense for delete to authenticated using (false);
revoke delete on public.fixed_expense from authenticated, anon;
