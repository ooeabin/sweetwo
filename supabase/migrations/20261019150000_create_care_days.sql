-- 캘린더 챙길 날(24 Y-01~Y-05, 09 데이터 항목 ‘가족’ ‘챙길 날’). 날짜 규칙: 매년 양력 / 매년 음력 / 한 번.
-- 음력 → 양력은 core rules/lunar(korean-lunar-calendar)에서 화면이 계산(원본 월·일·윤달 저장).
-- 서프라이즈(비공개 일정)는 다음 단계라 아직 모두 둘이 같이 봄.

create type public.family_relation as enum ('parent', 'grandparent', 'sibling', 'sibling_spouse', 'nephew', 'other');
create type public.care_category as enum ('family', 'couple', 'wedding');
create type public.care_date_rule as enum ('solar_yearly', 'lunar_yearly', 'once');
create type public.care_carer as enum ('groom', 'bride', 'together');
create type public.care_status as enum ('todo', 'preparing', 'done');

create table public.family_member (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.couple_space (id) on delete cascade,
  side public.couple_side not null,
  relation public.family_relation not null,
  title text not null check (char_length(btrim(title)) between 1 and 15),
  birth_month smallint check (birth_month between 1 and 12),
  birth_day smallint check (birth_day between 1 and 31),
  birth_lunar boolean not null default false,
  birth_leap boolean not null default false,
  birth_year smallint check (birth_year between 1900 and 2100),
  korean_age boolean not null default true, -- 칠순·팔순 세는 나이(기본) / 만 나이
  memo text check (char_length(memo) <= 200),
  sort integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null
);
create index family_member_space_idx on public.family_member (space_id) where deleted_at is null;
create trigger family_member_actor before insert or update on public.family_member
  for each row execute function public.stamp_actor();
create trigger family_member_touch before update on public.family_member
  for each row execute function public.touch_row();

create table public.care_day (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.couple_space (id) on delete cascade,
  category public.care_category not null,
  kind text not null check (kind ~ '^[a-z_]{2,30}$'), -- birthday, seollal, chuseok, parents_day, anniversary, event …
  name text not null check (char_length(btrim(name)) between 1 and 30),
  member_id uuid references public.family_member (id) on delete set null,
  side public.couple_side, -- 양가: 찬우 쪽 / 예빈 쪽, 양가 공통(명절·어버이날)은 null
  date_rule public.care_date_rule not null,
  month smallint check (month between 1 and 12), -- 매년: 월·일, null = 날짜 아직(나중에 할게요)
  day smallint check (day between 1 and 31),
  leap boolean not null default false,
  once_on date, -- 한 번
  budget bigint not null default 0 check (budget between 0 and 99999999999), -- 쓸 돈(이번 회차 한 번)
  carer public.care_carer not null default 'together',
  alerts smallint[] not null default '{30,7}',
  status public.care_status not null default 'todo',
  status_on date, -- 상태를 정한 회차의 날짜(다음 회차가 오면 다시 ‘아직’)
  memo text check (char_length(memo) <= 200),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null,
  check ((date_rule = 'once') = (once_on is not null))
);
create index care_day_space_idx on public.care_day (space_id) where deleted_at is null;
create trigger care_day_actor before insert or update on public.care_day
  for each row execute function public.stamp_actor();
create trigger care_day_touch before update on public.care_day
  for each row execute function public.touch_row();

alter table public.family_member enable row level security;
create policy family_member_select on public.family_member for select to authenticated using (public.is_space_member(space_id));
create policy family_member_insert on public.family_member for insert to authenticated with check (public.is_space_member(space_id));
create policy family_member_update on public.family_member for update to authenticated
  using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));
create policy family_member_delete on public.family_member for delete to authenticated using (false);
revoke delete on public.family_member from authenticated, anon;

alter table public.care_day enable row level security;
create policy care_day_select on public.care_day for select to authenticated using (public.is_space_member(space_id));
create policy care_day_insert on public.care_day for insert to authenticated with check (public.is_space_member(space_id));
create policy care_day_update on public.care_day for update to authenticated
  using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));
create policy care_day_delete on public.care_day for delete to authenticated using (false);
revoke delete on public.care_day from authenticated, anon;
