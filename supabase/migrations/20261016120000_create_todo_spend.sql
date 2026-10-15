-- 이번 달 할 일(H-04, 첫 주 할 일)과 지출 적기(W-04j 앞당겨 열기)
-- docs/spec/19-this-month.md, 17-onboarding-2.md 첫 주 할 일, 21-month-close.md W-04j, 09-data-items.md 6-3
-- 할 일 규칙: packages/core/src/rules/todo.ts, 기본 지출 항목: packages/core/src/rules/spend.ts

create type public.todo_status as enum ('pending', 'snoozed', 'done');
create type public.month_close_status as enum ('draft', 'done');

-- 할 일. 종류(kind)마다 공간에 하나. 받는 사람이 없으면 둘 다
create table public.todo (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.couple_space (id) on delete cascade,
  kind text not null check (kind ~ '^[a-z_]{2,40}$'),
  for_user uuid references auth.users (id) on delete cascade,
  screen text check (screen ~ '^[A-Z]-[0-9A-Za-z-]{1,10}$'), -- 여는 화면 ID
  target_id uuid, -- 대상 항목(제안, 목표 등)
  status public.todo_status not null default 'pending',
  open_on date not null default current_date, -- 열리는 날(첫 주 할 일은 하루 하나씩)
  snoozed_until date, -- ‘내일 할게요’
  sort integer not null default 0,
  done_by uuid references auth.users (id) on delete set null,
  done_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null
);
create unique index todo_kind_once on public.todo (space_id, kind) where deleted_at is null;
create trigger todo_actor before insert or update on public.todo
  for each row execute function public.stamp_actor();
create trigger todo_touch before update on public.todo
  for each row execute function public.touch_row();

-- 지출 항목(변동, 부부 단위). 기본 항목은 default_key, 직접 추가는 null
create table public.spend_category (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.couple_space (id) on delete cascade,
  default_key text check (default_key ~ '^[a-z_]{2,30}$'),
  name text not null check (char_length(name) between 1 and 20),
  enabled boolean not null default true,
  sort integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null
);
create unique index spend_category_default_once on public.spend_category (space_id, default_key)
  where deleted_at is null and default_key is not null;
create unique index spend_category_name_once on public.spend_category (space_id, name) where deleted_at is null;
create trigger spend_category_actor before insert or update on public.spend_category
  for each row execute function public.stamp_actor();
create trigger spend_category_touch before update on public.spend_category
  for each row execute function public.touch_row();

-- 월말 정리(‘{월}월 월급 플랜 정리’). 지출 적기를 앞당겨 열면 draft로 먼저 생김
create table public.month_close (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.couple_space (id) on delete cascade,
  plan_id uuid not null references public.monthly_plan (id) on delete cascade,
  status public.month_close_status not null default 'draft',
  closed_by uuid references auth.users (id) on delete set null,
  closed_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null
);
create unique index month_close_plan_once on public.month_close (plan_id) where deleted_at is null;
create trigger month_close_actor before insert or update on public.month_close
  for each row execute function public.stamp_actor();
create trigger month_close_touch before update on public.month_close
  for each row execute function public.touch_row();

-- 변동 항목별 이번 달 합계(W-04j). 항목마다 하나, 나중 저장이 이김
create table public.month_spend (
  id uuid primary key default gen_random_uuid(),
  month_close_id uuid not null references public.month_close (id) on delete cascade,
  space_id uuid not null references public.couple_space (id) on delete cascade,
  category_id uuid not null references public.spend_category (id) on delete cascade,
  amount bigint not null check (amount between 0 and 99999999999),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null,
  unique (month_close_id, category_id)
);
create trigger month_spend_actor before insert or update on public.month_spend
  for each row execute function public.stamp_actor();
create trigger month_spend_touch before update on public.month_spend
  for each row execute function public.touch_row();

-- 권한: 같은 공간 사람만 보고 쓴다. 영구 삭제 없음(휴지통만)
alter table public.todo enable row level security;
create policy todo_select on public.todo for select to authenticated using (public.is_space_member(space_id));
create policy todo_insert on public.todo for insert to authenticated with check (public.is_space_member(space_id));
create policy todo_update on public.todo for update to authenticated
  using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));
create policy todo_delete on public.todo for delete to authenticated using (false);
revoke delete on public.todo from authenticated, anon;

alter table public.spend_category enable row level security;
create policy spend_category_select on public.spend_category for select to authenticated using (public.is_space_member(space_id));
create policy spend_category_insert on public.spend_category for insert to authenticated with check (public.is_space_member(space_id));
create policy spend_category_update on public.spend_category for update to authenticated
  using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));
create policy spend_category_delete on public.spend_category for delete to authenticated using (false);
revoke delete on public.spend_category from authenticated, anon;

alter table public.month_close enable row level security;
create policy month_close_select on public.month_close for select to authenticated using (public.is_space_member(space_id));
-- 플랜도 같은 공간이어야
create policy month_close_insert on public.month_close for insert to authenticated with check (
  public.is_space_member(space_id)
  and exists (select 1 from public.monthly_plan p where p.id = plan_id and p.space_id = month_close.space_id)
);
create policy month_close_update on public.month_close for update to authenticated
  using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));
create policy month_close_delete on public.month_close for delete to authenticated using (false);
revoke delete on public.month_close from authenticated, anon;

alter table public.month_spend enable row level security;
create policy month_spend_select on public.month_spend for select to authenticated using (public.is_space_member(space_id));
-- 정리와 항목도 같은 공간이어야
create policy month_spend_insert on public.month_spend for insert to authenticated with check (
  public.is_space_member(space_id)
  and exists (select 1 from public.month_close c where c.id = month_close_id and c.space_id = month_spend.space_id)
  and exists (select 1 from public.spend_category k where k.id = category_id and k.space_id = month_spend.space_id)
);
create policy month_spend_update on public.month_spend for update to authenticated
  using (public.is_space_member(space_id)) with check (
    public.is_space_member(space_id)
    and exists (select 1 from public.month_close c where c.id = month_close_id and c.space_id = month_spend.space_id)
    and exists (select 1 from public.spend_category k where k.id = category_id and k.space_id = month_spend.space_id)
  );
create policy month_spend_delete on public.month_spend for delete to authenticated using (false);
revoke delete on public.month_spend from authenticated, anon;
