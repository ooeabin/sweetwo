-- F-05f·F-07c 기간 수입 변경(23 F-05f·F-07c, 06 9장). 휴직처럼 기간을 정한 내 수입 변경.
-- income_period: 기간(시작·끝 달), 그 기간 월 수입, 바꾸기 전 수입, 월 보충액(비상금 → 공동 생활비).
--   그 기간 플랜을 만들 때 앱이 이 수입으로 계산하고(core periodIncome), 플랜이 생기면 보충 줄을 넣음(트리거).
--   이미 있는 그 기간 플랜(정리 전)에는 저장할 때 바로 넣음. 보충 줄은 사실값처럼 바로 반영 + 배우자에게 바로 알림.
-- 분담: 그 기간만 ‘버는 만큼’ 제안(split 제안, 적용일 = 시작 달 플랜). 바꾸기 전 분담을 남겨 두고,
--   기간이 끝나면(매일 end_income_periods) 그 제안이 적용돼 있으면 원래 분담으로 되돌림.

create table public.income_period (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.couple_space (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  start_month date not null check (start_month = date_trunc('month', start_month)::date),
  end_month date not null check (end_month = date_trunc('month', end_month)::date),
  amount bigint not null check (amount between 0 and 99999999999),
  base_income bigint not null check (base_income between 0 and 99999999999),
  supplement bigint not null default 0 check (supplement between 0 and 99999999999),
  split_before jsonb,
  split_proposal_id uuid references public.proposal (id) on delete set null,
  ended_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null,
  check (end_month >= start_month)
);
create index income_period_space_idx on public.income_period (space_id) where deleted_at is null;
create trigger income_period_actor before insert or update on public.income_period
  for each row execute function public.stamp_actor();
create trigger income_period_touch before update on public.income_period
  for each row execute function public.touch_row();

alter table public.income_period enable row level security;
create policy income_period_select on public.income_period for select to authenticated using (public.is_space_member(space_id));
create policy income_period_insert on public.income_period for insert to authenticated with check (false);
create policy income_period_update on public.income_period for update to authenticated using (false);
create policy income_period_delete on public.income_period for delete to authenticated using (false);
revoke insert, update, delete on public.income_period from authenticated, anon;

alter table public.plan_line add column income_period_id uuid references public.income_period (id) on delete set null;

-- 그 기간 플랜 하나에 보충 줄(내부). 이미 있거나 정리했거나 통장 역할을 안 나눴으면 안 넣음
create or replace function public.add_period_supplement(p_period uuid, p_plan uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  ip public.income_period;
  pl public.monthly_plan;
  u public.app_user;
  sp public.couple_space;
begin
  select * into ip from public.income_period where id = p_period and deleted_at is null;
  select * into pl from public.monthly_plan where id = p_plan and deleted_at is null;
  if ip.id is null or pl.id is null or ip.supplement <= 0 or pl.status = 'closed'
     or pl.label_month < ip.start_month or pl.label_month > ip.end_month then
    return;
  end if;
  select * into sp from public.couple_space where id = pl.space_id;
  if sp.account_mode <> 'roles' then
    return;
  end if;
  if exists (select 1 from public.plan_line where plan_id = pl.id and income_period_id = ip.id and deleted_at is null) then
    return;
  end if;
  select * into u from public.app_user where id = ip.user_id;
  insert into public.plan_line (plan_id, space_id, target, account_role, kind, amount, amount_groom, amount_bride,
                                sort, income_period_id)
  values (pl.id, pl.space_id, 'account', 'living', 'emergency_to_living', ip.supplement,
          case when u.side = 'bride' then 0 else ip.supplement end,
          case when u.side = 'bride' then ip.supplement else 0 end, 901, ip.id);
end;
$$;
revoke execute on function public.add_period_supplement(uuid, uuid) from public, anon, authenticated;

create or replace function public.plan_add_period_supplement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ip public.income_period;
begin
  for ip in
    select * from public.income_period
    where space_id = new.space_id and deleted_at is null and ended_at is null
      and start_month <= new.label_month and end_month >= new.label_month and supplement > 0
  loop
    perform public.add_period_supplement(ip.id, new.id);
  end loop;
  return new;
end;
$$;
create trigger monthly_plan_period_supplement after insert on public.monthly_plan
  for each row execute function public.plan_add_period_supplement();

-- 저장(F-07c 적용하기). 돌려줌 = 기간 id. p_split_apply_on이 있으면 그 기간 ‘버는 만큼’ 분담 제안도 보냄(연결된 부부만)
create or replace function public.set_income_period(
  p_start date,
  p_end date,
  p_amount bigint,
  p_supplement bigint,
  p_split_apply_on date default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  me public.app_user;
  sp public.couple_space;
  other public.app_user;
  pid uuid;
  prop uuid;
  pl public.monthly_plan;
  mk text;
begin
  select * into me from public.app_user where id = uid;
  select * into sp from public.couple_space where id = me.space_id;
  if sp.id is null then
    raise exception 'no_space' using errcode = '42501';
  end if;
  if p_start is null or p_end is null or p_end < p_start
     or p_start <> date_trunc('month', p_start)::date or p_end <> date_trunc('month', p_end)::date
     or p_start < date_trunc('month', public.kst_today())::date
     or p_amount is null or p_amount not between 0 and 99999999999
     or coalesce(p_supplement, 0) not between 0 and 99999999999 then
    raise exception 'bad_value' using errcode = '22023';
  end if;
  if exists (select 1 from public.income_period where user_id = uid and deleted_at is null and ended_at is null
             and start_month <= p_end and end_month >= p_start) then
    raise exception 'overlap' using errcode = '22023';
  end if;
  insert into public.income_period (space_id, user_id, start_month, end_month, amount, base_income, supplement, split_before)
  values (sp.id, uid, p_start, p_end, p_amount, coalesce(me.monthly_income, 0), coalesce(p_supplement, 0),
          jsonb_build_object('mode', sp.split_mode, 'starter_ratio', sp.split_ratio))
  returning id into pid;

  -- 이미 있는 그 기간 플랜(정리 전)
  for pl in
    select * from public.monthly_plan
    where space_id = sp.id and deleted_at is null and status <> 'closed'
      and label_month between p_start and p_end
  loop
    perform public.add_period_supplement(pid, pl.id);
  end loop;

  if sp.couple_state = 'connected' then
    select * into other from public.app_user where space_id = sp.id and id <> uid and status = 'active' limit 1;
    if other.id is not null then
      mk := to_char(p_start, 'FMMM') || '~' || to_char(p_end, 'FMMM') || '월';
      perform public.notify(other.id, sp.id, 'income_period',
        coalesce(me.nickname, '') || '님이 ' || mk || ' 수입을 바꿨어요',
        case when coalesce(p_supplement, 0) > 0 then '그 기간 비상금에서 생활비를 보충해요' else null end,
        '/assets/money', null, uid, 'income_period:' || pid::text);
    end if;
    if p_split_apply_on is not null and sp.split_mode is distinct from 'income' then
      prop := public.propose('split', jsonb_build_object('mode', 'income'), p_split_apply_on);
      update public.income_period set split_proposal_id = prop where id = pid;
    end if;
  end if;
  return pid;
end;
$$;
revoke all on function public.set_income_period(date, date, bigint, bigint, date) from public, anon;
grant execute on function public.set_income_period(date, date, bigint, bigint, date) to authenticated;

-- 기간이 끝나면(끝 달 다음 달 1일부터) 표시하고, 그 기간 분담 제안이 적용돼 있으면 원래 분담으로
create or replace function public.end_income_periods()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  ip public.income_period;
  p public.proposal;
  cnt integer := 0;
begin
  for ip in
    select * from public.income_period
    where deleted_at is null and ended_at is null and end_month < date_trunc('month', public.kst_today())::date
    for update
  loop
    if ip.split_proposal_id is not null then
      select * into p from public.proposal where id = ip.split_proposal_id;
      if p.status = 'applied' and ip.split_before is not null then
        update public.couple_space set
          split_mode = (ip.split_before->>'mode')::public.split_mode,
          split_ratio = (ip.split_before->>'starter_ratio')::smallint
        where id = ip.space_id;
      end if;
      if p.status = 'open' then
        update public.proposal set status = 'withdrawn' where id = p.id;
      end if;
    end if;
    update public.income_period set ended_at = now() where id = ip.id;
    cnt := cnt + 1;
  end loop;
  return cnt;
end;
$$;
revoke execute on function public.end_income_periods() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('end-income-periods', '10 15 * * *', 'select public.end_income_periods()');
  end if;
end;
$$;
