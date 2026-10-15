-- 월말 정리 기본 3단계(docs/spec/21-month-close.md W-04a, W-04j, W-04k, W-04g, W-04 끝)
-- 정산 계산: packages/core/src/rules/month-summary.ts

create type public.big_expense_how as enum ('from_goal', 'exception'); -- 모아 둔 돈에서 냈어요 / 이번 달만 예외예요

alter table public.month_close
  add column income bigint check (income between 0 and 99999999999), -- 그달 실제 받은 금액(W-04j 소득 확인)
  add column big_none boolean not null default false, -- 큰 지출 ‘없어요’
  add column started_by uuid references auth.users (id) on delete set null, -- W-04a ‘시작’을 누른 사람(정리자)
  add column started_at timestamptz;

-- 이번 달 큰 지출(W-04j 맨 아래). 칩마다 하나. 변동 합계와 생활비 평균에서 뺀다
create table public.big_expense (
  id uuid primary key default gen_random_uuid(),
  month_close_id uuid not null references public.month_close (id) on delete cascade,
  space_id uuid not null references public.couple_space (id) on delete cascade,
  kind text not null check (kind ~ '^[a-z_]{2,30}$'),
  name text not null check (char_length(name) between 1 and 20),
  amount bigint not null check (amount between 0 and 99999999999),
  how public.big_expense_how not null default 'exception',
  goal_id uuid references public.goal (id) on delete set null, -- 모아 둔 돈에서 꺼낸 매년 목표
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null
);
-- 칩마다 한 줄(뺀 칩은 deleted_at, 다시 고르면 같은 줄을 되살림. upsert 대상이라 부분 인덱스가 아닌 제약)
alter table public.big_expense add constraint big_expense_kind_once unique (month_close_id, kind);
create trigger big_expense_actor before insert or update on public.big_expense
  for each row execute function public.stamp_actor();
create trigger big_expense_touch before update on public.big_expense
  for each row execute function public.touch_row();

-- 이번 달 넣은 돈(W-04k). 목표(또는 저축 상품)마다 하나, 연결 자산이 없으면 목표나 ‘기타 저축’
create table public.saving_deposit (
  id uuid primary key default gen_random_uuid(),
  month_close_id uuid not null references public.month_close (id) on delete cascade,
  space_id uuid not null references public.couple_space (id) on delete cascade,
  goal_id uuid references public.goal (id) on delete set null,
  asset_id uuid, -- 연결 자산(자산 표를 만들 때 외래 키). 없으면 null
  name text not null check (char_length(name) between 1 and 20),
  amount bigint not null check (amount between 0 and 99999999999),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null
);
alter table public.saving_deposit add constraint saving_deposit_name_once unique (month_close_id, name);
create trigger saving_deposit_actor before insert or update on public.saving_deposit
  for each row execute function public.stamp_actor();
create trigger saving_deposit_touch before update on public.saving_deposit
  for each row execute function public.touch_row();

-- 권한: 같은 공간, 정리도 같은 공간이어야. 영구 삭제 없음
alter table public.big_expense enable row level security;
create policy big_expense_select on public.big_expense for select to authenticated using (public.is_space_member(space_id));
create policy big_expense_insert on public.big_expense for insert to authenticated with check (
  public.is_space_member(space_id)
  and exists (select 1 from public.month_close c where c.id = month_close_id and c.space_id = big_expense.space_id)
);
create policy big_expense_update on public.big_expense for update to authenticated
  using (public.is_space_member(space_id)) with check (
    public.is_space_member(space_id)
    and exists (select 1 from public.month_close c where c.id = month_close_id and c.space_id = big_expense.space_id)
  );
create policy big_expense_delete on public.big_expense for delete to authenticated using (false);
revoke delete on public.big_expense from authenticated, anon;

alter table public.saving_deposit enable row level security;
create policy saving_deposit_select on public.saving_deposit for select to authenticated using (public.is_space_member(space_id));
create policy saving_deposit_insert on public.saving_deposit for insert to authenticated with check (
  public.is_space_member(space_id)
  and exists (select 1 from public.month_close c where c.id = month_close_id and c.space_id = saving_deposit.space_id)
);
create policy saving_deposit_update on public.saving_deposit for update to authenticated
  using (public.is_space_member(space_id)) with check (
    public.is_space_member(space_id)
    and exists (select 1 from public.month_close c where c.id = month_close_id and c.space_id = saving_deposit.space_id)
  );
create policy saving_deposit_delete on public.saving_deposit for delete to authenticated using (false);
revoke delete on public.saving_deposit from authenticated, anon;
