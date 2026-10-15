-- 온보딩 파트 0~2(docs/spec/16-onboarding-1.md): 부부 공간, 내 프로필, 목표, 배우자 초대 코드
-- 공통 규칙: docs/DEV_GUIDE.md ‘마이그레이션과 RLS 규칙’. 정책은 is_space_member()만 쓴다.
-- change_log 기록 트리거는 기록 테이블을 만드는 단계에서 붙인다.

create type public.couple_state as enum ('not_joined', 'connected', 'unlink_pending', 'solo');
create type public.marriage_status as enum ('married', 'engaged');
create type public.housing as enum ('jeonse', 'monthly_rent', 'own', 'parents', 'none');
create type public.child_plan as enum ('within_1y', 'in_1_3y', 'after_3y', 'none', 'unsure');
create type public.employment as enum ('regular', 'contract', 'freelance', 'resting');
create type public.couple_side as enum ('groom', 'bride');
create type public.prep_money_mode as enum ('separate', 'together');
create type public.newlywed_home as enum ('have', 'before', 'after', 'parents');
create type public.goal_kind as enum ('once', 'yearly', 'monthly');
create type public.goal_status as enum ('active', 'delayed', 'achieved', 'used', 'paused', 'wrapping_up');
create type public.goal_owner as enum ('together', 'me', 'partner');

-- 행을 만들고 고친 사람, 휴지통에 넣은 사람 기록(앱 역할로 쓸 때만 auth.uid()).
-- created_by, updated_by, deleted_at, deleted_by 열이 있는 테이블에만 붙인다.
create or replace function public.stamp_actor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  if tg_op = 'UPDATE' and new.deleted_at is not null and old.deleted_at is null then
    new.deleted_by := coalesce(auth.uid(), new.deleted_by);
  end if;
  return new;
end;
$$;

-- 부부 공간: 두 사람이 함께 쓰는 단위. 온보딩 파트 1 답(결혼, 집, 아이, 예비부부 준비)을 여기에 둔다.
create table public.couple_space (
  id uuid primary key default gen_random_uuid(),
  couple_state public.couple_state not null default 'not_joined',
  partner_nickname text check (char_length(partner_nickname) between 1 and 10), -- O-05, 합류 전 {배우자}
  marriage_status public.marriage_status, -- O-11
  wedding_date date, -- O-12 결혼한 날 또는 예정일
  wedding_month date check (wedding_month = date_trunc('month', wedding_month)::date), -- 예정일 미정이면 예정 연·월(그 달 1일)
  wedding_date_estimated boolean not null default false,
  housing public.housing, -- O-15
  child_plan public.child_plan, -- O-18
  -- 예비부부(O-19a~e)
  wedding_budget bigint check (wedding_budget between 0 and 99999999999),
  wedding_budget_estimated boolean not null default false,
  family_support_answer text check (family_support_answer in ('yes', 'no', 'unknown')),
  family_support bigint check (family_support between 0 and 99999999999),
  family_support_estimated boolean not null default false,
  wedding_saved bigint check (wedding_saved between 0 and 99999999999),
  newlywed_home public.newlywed_home,
  newlywed_home_month date check (newlywed_home_month = date_trunc('month', newlywed_home_month)::date),
  prep_money_mode public.prep_money_mode,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null
);
comment on table public.couple_space is '부부 공간. 행은 ensure_my_space()만 만든다. 부부 상태(couple_state)는 합류, 해제 함수만 바꾼다.';

create trigger couple_space_actor before insert or update on public.couple_space
  for each row execute function public.stamp_actor();
create trigger couple_space_touch before update on public.couple_space
  for each row execute function public.touch_row();

-- 내 프로필(O-03, O-04, O-13, O-16)과 공간 소속
alter table public.app_user
  add column space_id uuid references public.couple_space (id) on delete set null,
  add column nickname text check (char_length(nickname) between 1 and 10),
  add column side public.couple_side,
  add column birth_year smallint check (birth_year >= 1950),
  add column employment public.employment;
create index app_user_space_idx on public.app_user (space_id);
grant update (nickname, side, birth_year, employment) on public.app_user to authenticated;

-- 같은 공간 구성원인지. 모든 공간 정책은 이것만 쓴다.
create or replace function public.is_space_member(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.app_user u
    where u.id = auth.uid() and u.space_id = p_space_id and u.status = 'active'
  );
$$;
revoke execute on function public.is_space_member(uuid) from public;
grant execute on function public.is_space_member(uuid) to authenticated;

alter table public.couple_space enable row level security;
create policy couple_space_select on public.couple_space
  for select to authenticated using (public.is_space_member(id));
-- 추가는 ensure_my_space()만, 삭제는 계정 삭제 작업만
create policy couple_space_update on public.couple_space
  for update to authenticated using (public.is_space_member(id)) with check (public.is_space_member(id));
revoke update on public.couple_space from authenticated, anon;
grant update (
  partner_nickname, marriage_status, wedding_date, wedding_month, wedding_date_estimated, housing, child_plan,
  wedding_budget, wedding_budget_estimated, family_support_answer, family_support, family_support_estimated,
  wedding_saved, newlywed_home, newlywed_home_month, prep_money_mode
) on public.couple_space to authenticated;

-- 내 공간이 없으면 만들고 id를 돌려준다(O-03 첫 저장 때). 가입 전이면 거부.
create or replace function public.ensure_my_space()
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid uuid;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select space_id into sid from public.app_user where id = uid and status = 'active' for update;
  if not found then
    raise exception 'not_signed_up' using errcode = 'P0001';
  end if;
  if sid is null then
    insert into public.couple_space (created_by) values (uid) returning id into sid;
    update public.app_user set space_id = sid where id = uid;
  end if;
  return sid;
end;
$$;

-- 목표(docs/spec/09-data-items.md 2장). 목표 금액은 매달형이면 월 납입액.
create table public.goal (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.couple_space (id) on delete cascade,
  template text not null check (template ~ '^[a-z_]{2,40}$'),
  name text not null check (char_length(name) between 1 and 20),
  kind public.goal_kind not null,
  target_amount bigint check (target_amount between 0 and 99999999999),
  amount_estimated boolean not null default false,
  deadline date check (deadline = date_trunc('month', deadline)::date), -- 기한 월(그 달 1일). 매년형은 사용 월
  deadline_estimated boolean not null default false,
  priority integer not null check (priority >= 0),
  owner public.goal_owner not null default 'together',
  status public.goal_status not null default 'active',
  after_marriage boolean not null default false, -- 예비부부 각자 관리: 저장만, 배분 없음
  other_held bigint not null default 0 check (other_held between 0 and 99999999999),
  details jsonb not null default '{}'::jsonb, -- 템플릿 질문 답(집값, 비율, 여행 국내/해외 등)
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null
);
create index goal_space_idx on public.goal (space_id) where deleted_at is null;

create trigger goal_actor before insert or update on public.goal
  for each row execute function public.stamp_actor();
create trigger goal_touch before update on public.goal
  for each row execute function public.touch_row();

alter table public.goal enable row level security;
create policy goal_select on public.goal for select to authenticated using (public.is_space_member(space_id));
create policy goal_insert on public.goal for insert to authenticated with check (public.is_space_member(space_id));
create policy goal_update on public.goal for update to authenticated
  using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));
-- 지우기는 휴지통(deleted_at)으로만. 영구 삭제는 30일 뒤 예약 작업.
create policy goal_delete on public.goal for delete to authenticated using (false);
revoke delete on public.goal from authenticated, anon;

-- 배우자 초대 코드(O-07, A-07). 7일 동안 쓸 수 있고 다시 만들 수 있다. 합류(코드 사용)는 합류 단계에서.
create table public.invite (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.couple_space (id) on delete cascade,
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references auth.users (id) on delete set null
);
create index invite_space_idx on public.invite (space_id);

alter table public.invite enable row level security;
create policy invite_select on public.invite for select to authenticated using (public.is_space_member(space_id));
-- 추가는 create_invite()만, 수정과 삭제 없음
revoke insert, update, delete on public.invite from authenticated, anon;

-- 쓸 수 있는 코드가 있으면 그것을, 없으면 새로 만든다. 헷갈리는 글자(0, O, 1, I, L)는 쓰지 않는다.
create or replace function public.create_invite()
returns table (code text, expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid uuid;
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  c text;
  tries integer := 0;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select u.space_id into sid from public.app_user u where u.id = uid and u.status = 'active';
  if sid is null then
    raise exception 'no_space' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.couple_space s where s.id = sid and s.couple_state <> 'not_joined') then
    raise exception 'already_joined' using errcode = 'P0001';
  end if;
  return query
    select i.code, i.expires_at from public.invite i
    where i.space_id = sid and i.used_at is null and i.expires_at > now()
    order by i.created_at desc limit 1;
  if found then
    return;
  end if;
  loop
    c := '';
    for k in 1..6 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      insert into public.invite (space_id, code, created_by, expires_at)
      values (sid, c, uid, now() + interval '7 days');
      exit;
    exception when unique_violation then
      tries := tries + 1;
      if tries > 5 then
        raise;
      end if;
    end;
  end loop;
  return query select c, now() + interval '7 days';
end;
$$;

-- O-13 만 18세 미만: 계정 즉시 삭제(입력값 남기지 않음, 유예 없음).
-- 공간에 나 말고 아무도 없으면 공간(목표, 초대 포함)도 지운다.
create or replace function public.delete_minor_account(p_birth_year smallint)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid uuid;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  -- 서버에서도 나이를 다시 확인한다(KST 올해 기준)
  if p_birth_year <= extract(year from (now() at time zone 'Asia/Seoul'))::int - 18 then
    raise exception 'not_minor' using errcode = 'P0001';
  end if;
  select space_id into sid from public.app_user where id = uid;
  if sid is not null and not exists (
    select 1 from public.app_user where space_id = sid and id <> uid
  ) then
    delete from public.couple_space where id = sid;
  end if;
  delete from auth.users where id = uid; -- app_user, consent는 연쇄 삭제
end;
$$;

revoke execute on function public.ensure_my_space() from public, anon;
revoke execute on function public.create_invite() from public, anon;
revoke execute on function public.delete_minor_account(smallint) from public, anon;
grant execute on function public.ensure_my_space() to authenticated;
grant execute on function public.create_invite() to authenticated;
grant execute on function public.delete_minor_account(smallint) to authenticated;
