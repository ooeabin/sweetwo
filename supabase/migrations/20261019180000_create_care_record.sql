-- 다녀온 뒤 기록(24 Y-08)과 목표 사용(06 6장, 09 ‘목표 사용’ ‘챙길 날 회차’).
-- 낸 곳은 기록할 때 한 번만: 목표자금 통장 = 그 목표 보유액에서만 차감 / 생활비 통장·카드 = 목표 사용 + 이번 사이클
-- ‘목표자금 → 공동 생활비’ 나누기 줄(담당 = 기록한 사람, 보유액만큼만, 통장 역할 모드만) / 각자 돈 = 기록만.
-- 예비부부: 결혼 준비 통장 = 결혼 비용 사용 / 각자 돈·양가 지원 = 기록만.
-- 사진(Y-08c)과 드린 기록 화면(Y-09)은 다음 단계. 기존 이번 달만 바꾸기·몫 다시 계산은 월급에서 나누는 줄(split)만 건드리게 고침.

create type public.paid_from as enum ('goal_fund', 'living', 'personal', 'wedding_account', 'personal_support');
create type public.goal_use_source as enum ('care', 'wedding', 'yearly', 'close');

create table public.care_record (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.couple_space (id) on delete cascade,
  care_day_id uuid not null references public.care_day (id) on delete cascade,
  member_id uuid references public.family_member (id) on delete set null,
  occurs_on date not null, -- 그 회차 양력 날짜
  amount bigint not null check (amount between 0 and 99999999999),
  paid_from public.paid_from not null,
  gifts text[] not null default '{}' check (gifts <@ array['cash', 'gift', 'meal']::text[]),
  gift_name text check (char_length(gift_name) <= 30),
  memo text check (char_length(memo) <= 200),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null
);
create unique index care_record_once on public.care_record (care_day_id, occurs_on) where deleted_at is null;
create index care_record_space_idx on public.care_record (space_id) where deleted_at is null;
create trigger care_record_actor before insert or update on public.care_record
  for each row execute function public.stamp_actor();
create trigger care_record_touch before update on public.care_record
  for each row execute function public.touch_row();

create table public.goal_use (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.couple_space (id) on delete cascade,
  goal_id uuid not null references public.goal (id) on delete cascade,
  amount bigint not null check (amount between 0 and 99999999999),
  used_on date not null,
  paid_from public.paid_from not null,
  source public.goal_use_source not null,
  care_record_id uuid references public.care_record (id) on delete set null,
  plan_line_id uuid references public.plan_line (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null
);
create index goal_use_space_idx on public.goal_use (space_id) where deleted_at is null;
create trigger goal_use_actor before insert or update on public.goal_use
  for each row execute function public.stamp_actor();
create trigger goal_use_touch before update on public.goal_use
  for each row execute function public.touch_row();

-- 둘 다 보기만, 쓰기는 record_care로만
alter table public.care_record enable row level security;
create policy care_record_select on public.care_record for select to authenticated using (public.is_space_member(space_id));
create policy care_record_insert on public.care_record for insert to authenticated with check (false);
create policy care_record_update on public.care_record for update to authenticated using (false);
create policy care_record_delete on public.care_record for delete to authenticated using (false);
revoke insert, update, delete on public.care_record from authenticated, anon;

alter table public.goal_use enable row level security;
create policy goal_use_select on public.goal_use for select to authenticated using (public.is_space_member(space_id));
create policy goal_use_insert on public.goal_use for insert to authenticated with check (false);
create policy goal_use_update on public.goal_use for update to authenticated using (false);
create policy goal_use_delete on public.goal_use for delete to authenticated using (false);
revoke insert, update, delete on public.goal_use from authenticated, anon;

-- Y-08 저장: 회차 기록 + 다녀왔어요 + 목표 사용 + (생활비로 냈으면) 나누기 줄. p_move = 줄 금액(화면이 보유액만큼으로 자름).
-- 돌려줌 {record, line}: line = 넣은 줄 금액(없으면 0)
create or replace function public.record_care(
  p_care uuid,
  p_on date,
  p_amount bigint,
  p_paid_from public.paid_from,
  p_gifts text[],
  p_gift_name text,
  p_memo text,
  p_move bigint
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  me public.app_user;
  c public.care_day;
  sp public.couple_space;
  gid uuid;
  rid uuid;
  uid_line uuid;
  plan public.monthly_plan;
  today date := (now() at time zone 'Asia/Seoul')::date;
  mv bigint := 0;
begin
  select * into me from public.app_user where id = uid and status = 'active';
  select * into c from public.care_day where id = p_care and deleted_at is null;
  if c.id is null or me.space_id is distinct from c.space_id then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if p_amount < 0 or p_amount > 99999999999 then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  select * into sp from public.couple_space where id = c.space_id;

  insert into public.care_record (space_id, care_day_id, member_id, occurs_on, amount, paid_from, gifts, gift_name, memo)
  values (c.space_id, c.id, c.member_id, p_on, p_amount, p_paid_from, coalesce(p_gifts, '{}'),
          nullif(btrim(p_gift_name), ''), nullif(btrim(p_memo), ''))
  returning id into rid;
  update public.care_day set status = 'done', status_on = p_on where id = c.id;

  -- 어느 목표에서: 양가 = ‘양가 비용’, 결혼 준비 통장 = 결혼 비용
  if p_paid_from in ('goal_fund', 'living') and c.category = 'family' then
    select id into gid from public.goal
      where space_id = c.space_id and template = 'family_cost' and deleted_at is null
      order by created_at limit 1;
  elsif p_paid_from = 'wedding_account' then
    select id into gid from public.goal
      where space_id = c.space_id and template = 'wedding' and deleted_at is null
      order by created_at limit 1;
  end if;
  if gid is null or p_amount = 0 then
    return jsonb_build_object('record', rid, 'line', 0);
  end if;

  -- 생활비로 냈으면 이번 사이클(정리를 마쳤으면 다음 사이클) 플랜에 줄. 통장 역할 모드만
  if p_paid_from = 'living' and sp.account_mode = 'roles' then
    mv := greatest(least(coalesce(p_move, 0), p_amount), 0);
    select * into plan from public.monthly_plan
      where space_id = c.space_id and deleted_at is null and cycle_start <= today and cycle_end >= today;
    if plan.id is not null and plan.status = 'closed' then
      select * into plan from public.monthly_plan
        where space_id = c.space_id and deleted_at is null and cycle_start > plan.cycle_end
        order by cycle_start limit 1;
    end if;
    if plan.id is not null and plan.status <> 'closed' and mv > 0 then
      insert into public.plan_line (plan_id, space_id, target, account_role, goal_id, kind, amount,
                                    amount_groom, amount_bride, sort)
      values (plan.id, c.space_id, 'account', 'living', gid, 'goal_to_living', mv,
              case when me.side = 'bride' then 0 else mv end,
              case when me.side = 'bride' then mv else 0 end,
              coalesce((select max(sort) + 1 from public.plan_line where plan_id = plan.id), 0))
      returning id into uid_line;
    else
      mv := 0;
    end if;
  end if;

  insert into public.goal_use (space_id, goal_id, amount, used_on, paid_from, source, care_record_id, plan_line_id)
  values (c.space_id, gid, p_amount, p_on, p_paid_from, 'care', rid, uid_line);
  return jsonb_build_object('record', rid, 'line', mv);
end;
$$;
revoke execute on function public.record_care(uuid, date, bigint, public.paid_from, text[], text, text, bigint) from public, anon;
grant execute on function public.record_care(uuid, date, bigint, public.paid_from, text[], text, text, bigint) to authenticated;

-- 몫 다시 계산과 이번 달만 바꾸기는 월급에서 나누는 줄(split)만
create or replace function public.update_pending_shares(p_plan_id uuid, p_shares jsonb, p_is_temp boolean)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  sid uuid;
  n integer := 0;
  x jsonb;
begin
  select space_id into sid from public.app_user where id = auth.uid() and status = 'active';
  if sid is null or not exists (select 1 from public.monthly_plan p where p.id = p_plan_id and p.space_id = sid) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  for x in select * from jsonb_array_elements(p_shares) loop
    update public.plan_line l set
      amount_groom = case when l.groom_done_at is null then (x->>'amount_groom')::bigint else l.amount_groom end,
      amount_bride = case when l.bride_done_at is null then (x->>'amount_bride')::bigint else l.amount_bride end
    where l.plan_id = p_plan_id and l.target = 'account' and l.kind = 'split' and l.state = 'pending'
      and l.deleted_at is null and l.account_role = (x->>'account_role')::public.account_role;
    n := n + 1;
  end loop;
  update public.monthly_plan set is_temp = p_is_temp where id = p_plan_id;
  return n;
end;
$$;

create or replace function public.adjust_plan(
  p_plan uuid,
  p_role public.account_role,
  p_amount bigint,
  p_counter public.account_role
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  p public.monthly_plan;
  a public.plan_line;
  b public.plan_line;
  diff bigint;
  key_a text;
  key_b text;
begin
  select * into p from public.monthly_plan where id = p_plan and deleted_at is null;
  if p.id is null or not public.is_space_member(p.space_id) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if p_role = p_counter or p_amount < 0 or p_amount > 99999999999 then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  select * into a from public.plan_line
    where plan_id = p_plan and target = 'account' and kind = 'split' and account_role = p_role
      and deleted_at is null for update;
  select * into b from public.plan_line
    where plan_id = p_plan and target = 'account' and kind = 'split' and account_role = p_counter
      and deleted_at is null for update;
  if a.id is null or b.id is null then
    raise exception 'no_line' using errcode = '22023';
  end if;
  if a.groom_done_at is not null or a.bride_done_at is not null
     or b.groom_done_at is not null or b.bride_done_at is not null then
    raise exception 'already_split' using errcode = '22023';
  end if;
  diff := p_amount - a.amount;
  if b.amount - diff < 0 then
    raise exception 'not_enough' using errcode = '22023';
  end if;
  update public.plan_line set
    amount = p_amount,
    amount_groom = case when a.amount > 0 then round(p_amount * coalesce(a.amount_groom, 0)::numeric / a.amount)::bigint
                        else round(p_amount / 2.0)::bigint end,
    amount_bride = p_amount - case when a.amount > 0 then round(p_amount * coalesce(a.amount_groom, 0)::numeric / a.amount)::bigint
                                   else round(p_amount / 2.0)::bigint end
  where id = a.id;
  update public.plan_line set
    amount = b.amount - diff,
    amount_groom = case when b.amount > 0 then round((b.amount - diff) * coalesce(b.amount_groom, 0)::numeric / b.amount)::bigint
                        else round((b.amount - diff) / 2.0)::bigint end,
    amount_bride = (b.amount - diff) - case when b.amount > 0 then round((b.amount - diff) * coalesce(b.amount_groom, 0)::numeric / b.amount)::bigint
                                            else round((b.amount - diff) / 2.0)::bigint end
  where id = b.id;
  key_a := case p_role when 'living' then 'living' when 'goal_fund' then 'goalFund' when 'emergency' then 'emergency' end;
  key_b := case p_counter when 'living' then 'living' when 'goal_fund' then 'goalFund' when 'emergency' then 'emergency' end;
  if key_a is not null and key_b is not null and p.snapshot ? 'parts' then
    update public.monthly_plan set snapshot = jsonb_set(
      jsonb_set(snapshot, array['parts', key_a], to_jsonb(p_amount)),
      array['parts', key_b], to_jsonb(b.amount - diff))
    where id = p_plan;
  end if;
end;
$$;
