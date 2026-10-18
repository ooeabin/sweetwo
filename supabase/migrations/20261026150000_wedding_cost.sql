-- G-07 결혼 비용 상세, 항목 추가(G-07a~d), 결제 기록(22 G-07). 예비부부.
-- wedding_item: 항목(기본 8개 중 고른 것 또는 직접 입력), 예산, 계약금·잔금 금액과 날짜, 누가 내는지(계획으로만 씀).
-- wedding_payment: 계약금·잔금 실제 결제(항목·부분마다 한 번, 다시 기록하면 고침). 결혼 준비 통장에서 냈으면
--   결혼 비용 목표 보유액에서만 뺌(goal_use source 'wedding'). 각자 돈·양가 지원은 기록만.
-- 예산 바꾸기 change_wedding_budget: 총예산(couple_space.wedding_budget) 또는 항목 예산.
--   배우자 미합류·혼자 쓰기 → 바로. 연결된 부부 → 제안(item wedding_budget / wedding_item_budget).
--   예식 30일 이내면 바로 적용 + 상대에게 알림(08 예외).
-- 항목의 나머지 칸(이름, 날짜, 누가, 숨김)은 바로 고침. 예산 칸은 이 함수로만.

create type public.wedding_payer as enum ('us', 'groom', 'bride', 'family');

create table public.wedding_item (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.couple_space (id) on delete cascade,
  key text not null check (key ~ '^[a-z_]{2,40}$'), -- 기본 항목 키 또는 'custom'
  name text not null check (char_length(name) between 1 and 20),
  budget bigint not null default 0 check (budget between 0 and 99999999999),
  deposit_amount bigint check (deposit_amount between 0 and 99999999999),
  deposit_on date,
  balance_amount bigint check (balance_amount between 0 and 99999999999),
  balance_on date,
  payer public.wedding_payer not null default 'us',
  sort integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null
);
create index wedding_item_space_idx on public.wedding_item (space_id) where deleted_at is null;
create unique index wedding_item_key_once on public.wedding_item (space_id, key)
  where deleted_at is null and key <> 'custom';
create trigger wedding_item_actor before insert or update on public.wedding_item
  for each row execute function public.stamp_actor();
create trigger wedding_item_touch before update on public.wedding_item
  for each row execute function public.touch_row();

create table public.wedding_payment (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.couple_space (id) on delete cascade,
  item_id uuid not null references public.wedding_item (id) on delete cascade,
  part text not null check (part in ('deposit', 'balance')),
  amount bigint not null check (amount between 0 and 99999999999),
  paid_on date not null,
  paid_from public.paid_from not null check (paid_from in ('wedding_account', 'personal_support')),
  goal_use_id uuid references public.goal_use (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null
);
create unique index wedding_payment_once on public.wedding_payment (item_id, part) where deleted_at is null;
create index wedding_payment_space_idx on public.wedding_payment (space_id) where deleted_at is null;
create trigger wedding_payment_actor before insert or update on public.wedding_payment
  for each row execute function public.stamp_actor();
create trigger wedding_payment_touch before update on public.wedding_payment
  for each row execute function public.touch_row();

alter table public.wedding_item enable row level security;
create policy wedding_item_select on public.wedding_item for select to authenticated using (public.is_space_member(space_id));
create policy wedding_item_insert on public.wedding_item for insert to authenticated with check (public.is_space_member(space_id));
create policy wedding_item_update on public.wedding_item for update to authenticated
  using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));
create policy wedding_item_delete on public.wedding_item for delete to authenticated using (false);
revoke delete on public.wedding_item from authenticated, anon;
-- 예산 칸은 change_wedding_budget으로만
revoke update on public.wedding_item from authenticated, anon;
grant update (name, deposit_amount, deposit_on, balance_amount, balance_on, payer, sort, deleted_at)
  on public.wedding_item to authenticated;

alter table public.wedding_payment enable row level security;
create policy wedding_payment_select on public.wedding_payment for select to authenticated using (public.is_space_member(space_id));
create policy wedding_payment_insert on public.wedding_payment for insert to authenticated with check (false);
create policy wedding_payment_update on public.wedding_payment for update to authenticated using (false);
create policy wedding_payment_delete on public.wedding_payment for delete to authenticated using (false);
revoke insert, update, delete on public.wedding_payment from authenticated, anon;

-- 제안 항목에 결혼 비용 예산 추가
alter table public.proposal drop constraint proposal_item_check;
alter table public.proposal add constraint proposal_item_check
  check (item in ('allowance', 'split', 'living_budget', 'family_budget', 'base_day', 'goal_amount', 'goal_deadline',
                  'goal_pause', 'goal_delete', 'goal_add', 'goal_order', 'goal_restore',
                  'wedding_budget', 'wedding_item_budget'));
-- 항목 예산 제안의 대상(target_id는 목표만 가리킴)
alter table public.proposal add column wedding_item_id uuid references public.wedding_item (id) on delete cascade;
alter table public.proposal add constraint proposal_wedding_target
  check ((item = 'wedding_item_budget') = (wedding_item_id is not null));
drop index public.proposal_open_once;
create unique index proposal_open_once on public.proposal (
  space_id, item,
  (case
    when item = 'allowance' then proposer
    when item = 'goal_add' then id
    when target_id is not null then target_id
    when wedding_item_id is not null then wedding_item_id
    else '00000000-0000-0000-0000-000000000000'::uuid
  end)
) where status = 'open';

-- 제안 적용(20261022120000과 같고 결혼 비용 예산 두 가지를 더함)
create or replace function public.apply_proposal_values(p public.proposal)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  gid uuid;
begin
  if p.item = 'allowance' then
    update public.app_user set allowance = (p.after->>'allowance')::bigint where id = p.proposer;
  elsif p.item = 'split' then
    update public.couple_space set
      split_mode = (p.after->>'mode')::public.split_mode,
      split_ratio = (p.after->>'starter_ratio')::smallint,
      split_deferred = false
    where id = p.space_id;
  elsif p.item = 'goal_amount' then
    update public.goal set target_amount = (p.after->>'target_amount')::bigint, amount_estimated = false
    where id = p.target_id and deleted_at is null;
  elsif p.item = 'goal_deadline' then
    update public.goal set deadline = (p.after->>'deadline')::date, deadline_estimated = false
    where id = p.target_id and deleted_at is null;
  elsif p.item = 'goal_pause' then
    if (p.after->>'paused')::boolean then
      update public.goal set status = 'paused' where id = p.target_id and deleted_at is null;
    else
      -- 다시 모으면 우선순위 맨 아래(22 달성·보류 상태 2번)
      update public.goal g set status = 'active',
        priority = (select coalesce(max(x.priority), 0) + 1 from public.goal x where x.space_id = g.space_id and x.deleted_at is null)
      where g.id = p.target_id and g.deleted_at is null;
    end if;
  elsif p.item = 'goal_add' then
    -- 맨 아래 우선순위. 만든 사람 = 제안한 사람(담당 ‘나’, ‘배우자’는 그 사람 기준)
    insert into public.goal (space_id, template, name, kind, priority, target_amount, deadline, other_held,
      owner, details, amount_estimated, deadline_estimated, created_by)
    values (
      p.space_id, p.after->>'template', btrim(p.after->>'name'), (p.after->>'kind')::public.goal_kind,
      (select coalesce(max(x.priority), 0) + 1 from public.goal x where x.space_id = p.space_id and x.deleted_at is null),
      nullif(p.after->>'target_amount', '')::bigint, nullif(p.after->>'deadline', '')::date,
      coalesce((p.after->>'other_held')::bigint, 0), (p.after->>'owner')::public.goal_owner,
      coalesce(p.after->'details', '{}'::jsonb),
      coalesce((p.after->>'amount_estimated')::boolean, false), coalesce((p.after->>'deadline_estimated')::boolean, false),
      p.proposer
    ) returning id into gid;
    -- 가진 자산에서 고른 것 연결(이 공간, 제안한 사람이 고칠 수 있는 자산만)
    update public.asset a set goal_id = gid
    where a.space_id = p.space_id and a.deleted_at is null and a.side = 'asset'
      and (a.owner = 'joint' or a.owner_user_id = p.proposer or (a.owner_user_id is null and a.created_by = p.proposer))
      and a.id::text in (select jsonb_array_elements_text(coalesce(p.after->'asset_ids', '[]'::jsonb)));
  elsif p.item = 'goal_order' then
    -- 받은 순서대로 우선순위 1, 2, 3 …(비상금은 0 그대로)
    update public.goal g set priority = o.n
    from jsonb_array_elements_text(p.after->'order') with ordinality as o(id, n)
    where g.id = o.id::uuid and g.space_id = p.space_id and g.deleted_at is null and g.template <> 'emergency';
  elsif p.item = 'living_budget' then
    update public.couple_space set living_budget = (p.after->>'living_budget')::bigint, living_budget_estimated = false
    where id = p.space_id;
  elsif p.item = 'base_day' then
    perform public.apply_base_day(p.space_id, p.after);
  elsif p.item = 'family_budget' then
    perform public.apply_family_budget(p.space_id, p.after);
  elsif p.item = 'goal_restore' then
    -- 휴지통 목표 되살리기(S-21): 맨 아래 우선순위, 같이 지워진 쓴 기록도
    update public.goal_use w set deleted_at = null
      from public.goal g
      where g.id = p.target_id and w.goal_id = g.id and w.deleted_at is not null and g.deleted_at is not null
        and abs(extract(epoch from w.deleted_at - g.deleted_at)) <= 10;
    update public.goal g set deleted_at = null,
      priority = (select coalesce(max(x.priority), 0) + 1 from public.goal x where x.space_id = g.space_id and x.deleted_at is null)
      where g.id = p.target_id and g.deleted_at is not null;
  elsif p.item = 'wedding_budget' then
    update public.couple_space set wedding_budget = (p.after->>'budget')::bigint, wedding_budget_estimated = false
    where id = p.space_id;
  elsif p.item = 'wedding_item_budget' then
    update public.wedding_item set budget = (p.after->>'budget')::bigint
    where id = p.wedding_item_id and space_id = p.space_id and deleted_at is null;
  elsif p.item = 'goal_delete' then
    update public.goal set deleted_at = now() where id = p.target_id and deleted_at is null;
    -- 지운 목표의 다른 열린 제안은 거둠
    update public.proposal set status = 'withdrawn'
    where target_id = p.target_id and status = 'open' and id <> p.id;
  end if;
end;
$$;

create or replace function public.proposal_item_noun(p public.proposal)
returns text
language sql
stable
set search_path = ''
as $$
  select case p.item
    when 'allowance' then '용돈'
    when 'split' then '분담 방식'
    when 'living_budget' then '생활비 예산'
    when 'family_budget' then '양가 비용 예산'
    when 'base_day' then '월급 플랜 날짜'
    when 'goal_order' then '목표 순서'
    when 'wedding_budget' then '결혼 비용 예산'
    when 'wedding_item_budget' then coalesce((select w.name from public.wedding_item w where w.id = p.wedding_item_id), '') || ' 예산'
    when 'goal_add' then coalesce(btrim(p.after->>'name'), '새') || ' 목표'
    else coalesce((select g.name from public.goal g where g.id = p.target_id), '') || ' 목표'
  end;
$$;

-- 예산 바꾸기. p_item null = 총예산. 돌려줌 'applied' | 'proposed'
create or replace function public.change_wedding_budget(p_budget bigint, p_apply_on date, p_item uuid default null)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  me public.app_user;
  sp public.couple_space;
  w public.wedding_item;
  other public.app_user;
  it text := case when p_item is null then 'wedding_budget' else 'wedding_item_budget' end;
  bef jsonb;
  cur public.proposal;
  opp integer := 0;
  trips integer := 0;
  soon boolean;
begin
  select * into me from public.app_user where id = uid;
  select * into sp from public.couple_space where id = me.space_id;
  if sp.id is null then
    raise exception 'no_space' using errcode = '42501';
  end if;
  if p_budget is null or p_budget not between 0 and 99999999999 then
    raise exception 'bad_value' using errcode = '22023';
  end if;
  if p_item is not null then
    select * into w from public.wedding_item where id = p_item and space_id = sp.id and deleted_at is null;
    if w.id is null then
      raise exception 'bad_target' using errcode = '22023';
    end if;
    bef := jsonb_build_object('budget', w.budget);
  else
    bef := jsonb_build_object('budget', sp.wedding_budget);
  end if;
  soon := sp.wedding_date is not null and sp.wedding_date <= public.kst_today() + 30;

  if sp.couple_state <> 'connected' or soon then
    if p_item is null then
      update public.couple_space set wedding_budget = p_budget, wedding_budget_estimated = false where id = sp.id;
    else
      update public.wedding_item set budget = p_budget where id = w.id;
    end if;
    if sp.couple_state = 'connected' then
      select * into other from public.app_user where space_id = sp.id and id <> uid and status = 'active' limit 1;
      if other.id is not null then
        perform public.notify(other.id, sp.id, 'wedding_budget',
          coalesce(me.nickname, '') || '님이 ' || case when p_item is null then '결혼 비용 예산' else w.name || ' 예산' end || '을 바꿨어요',
          '예식 30일 안이라 바로 적용했어요', '/goals/wedding', null, uid,
          'wedding_budget:' || coalesce(p_item::text, 'total') || ':' || extract(epoch from now())::bigint::text);
      end if;
    end if;
    return 'applied';
  end if;

  if p_apply_on < ((now() at time zone 'Asia/Seoul') + interval '72 hours')::date then
    raise exception 'apply_too_soon' using errcode = '22023';
  end if;
  select * into cur from public.proposal
    where space_id = sp.id and item = it and status = 'open' and wedding_item_id is not distinct from p_item
    for update;
  if found then
    update public.proposal set status = 'superseded' where id = cur.id;
    opp := cur.oppose_count;
    trips := cur.round_trips + case when cur.proposer <> uid then 1 else 0 end;
  else
    select coalesce(max(oppose_count), 0) into opp from public.proposal
      where space_id = sp.id and item = it and status = 'held' and wedding_item_id is not distinct from p_item;
  end if;
  insert into public.proposal (space_id, item, wedding_item_id, proposer, before, after, apply_on, round_trips, oppose_count, together, replaces)
  values (sp.id, it, p_item, uid, bef, jsonb_build_object('budget', p_budget), p_apply_on, trips, opp,
          trips >= 2 or opp >= 2, cur.id);
  return 'proposed';
end;
$$;
revoke all on function public.change_wedding_budget(bigint, date, uuid) from public, anon;
grant execute on function public.change_wedding_budget(bigint, date, uuid) to authenticated;

-- 결제 기록. 결혼 준비 통장이면 결혼 비용 목표 보유액에서 뺌. 돌려줌 = 예산 넘은 금액(0 이상)
-- 넘은 금액 = 이 항목 (결제한 부분은 실제, 아직은 계획 금액) 합 − 항목 예산
create or replace function public.record_wedding_payment(
  p_item uuid,
  p_part text,
  p_amount bigint,
  p_paid_from public.paid_from
)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  w public.wedding_item;
  pay public.wedding_payment;
  gid uuid;
  use_id uuid;
  today date := public.kst_today();
  dep bigint;
  bal bigint;
begin
  select * into w from public.wedding_item where id = p_item and deleted_at is null for update;
  if w.id is null or not public.is_space_member(w.space_id) then
    raise exception 'not_found' using errcode = '42501';
  end if;
  if p_part not in ('deposit', 'balance') or p_paid_from not in ('wedding_account', 'personal_support')
     or p_amount is null or p_amount not between 0 and 99999999999 then
    raise exception 'bad_value' using errcode = '22023';
  end if;
  select * into pay from public.wedding_payment where item_id = w.id and part = p_part and deleted_at is null for update;
  -- 이전 기록의 목표 사용은 지우고 다시
  if pay.goal_use_id is not null then
    delete from public.goal_use where id = pay.goal_use_id;
  end if;
  if p_paid_from = 'wedding_account' and p_amount > 0 then
    select id into gid from public.goal
      where space_id = w.space_id and template = 'wedding' and deleted_at is null order by created_at limit 1;
    if gid is not null then
      insert into public.goal_use (space_id, goal_id, amount, used_on, paid_from, source)
      values (w.space_id, gid, p_amount, today, 'wedding_account', 'wedding')
      returning id into use_id;
    end if;
  end if;
  if pay.id is null then
    insert into public.wedding_payment (space_id, item_id, part, amount, paid_on, paid_from, goal_use_id)
    values (w.space_id, w.id, p_part, p_amount, today, p_paid_from, use_id);
  else
    update public.wedding_payment set amount = p_amount, paid_from = p_paid_from, goal_use_id = use_id, paid_on = today
      where id = pay.id;
  end if;
  select coalesce((select amount from public.wedding_payment where item_id = w.id and part = 'deposit' and deleted_at is null),
                  w.deposit_amount, 0),
         coalesce((select amount from public.wedding_payment where item_id = w.id and part = 'balance' and deleted_at is null),
                  w.balance_amount, 0)
    into dep, bal;
  return greatest(dep + bal - w.budget, 0);
end;
$$;
revoke all on function public.record_wedding_payment(uuid, text, bigint, public.paid_from) from public, anon;
grant execute on function public.record_wedding_payment(uuid, text, bigint, public.paid_from) to authenticated;
