-- 변동 수입 실제(21 W-04a2, 06 7장 ‘변동 수입 차이’, 07 4장).
--
-- 변동 수입자(app_user.income_variable) 본인에게만 “이번 달 실제 들어온 돈은 얼마예요?”. 기준 수입 = monthly_income.
-- 기준보다 적으면(0원 포함) 차액을 다음 사이클 ‘비상금 → 공동 생활비’ 줄로 보충: 즉시 적용 + 상대 알림.
--   다음 플랜이 이미 있으면 바로 줄을 넣고, 없으면 month_close에 남겨 두었다가 다음 플랜이 생길 때 넣음(트리거).
-- 기준보다 많으면 앱이 추가 소득 나누기(W-07)로 안내.

alter table public.month_close
  add column income_actual_groom bigint check (income_actual_groom between 0 and 99999999999),
  add column income_actual_bride bigint check (income_actual_bride between 0 and 99999999999),
  add column income_short bigint check (income_short between 0 and 99999999999),
  add column income_short_side public.couple_side,
  add column supplement_line_id uuid references public.plan_line (id) on delete set null;

-- 보충 줄 넣기(내부). 그 정리의 다음 플랜에, 수입 당사자 몫으로
create or replace function public.add_income_supplement(p_close uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c public.month_close;
  cur public.monthly_plan;
  nxt public.monthly_plan;
  lid uuid;
begin
  select * into c from public.month_close where id = p_close for update;
  if c.id is null or coalesce(c.income_short, 0) = 0 or c.supplement_line_id is not null then
    return null;
  end if;
  select * into cur from public.monthly_plan where id = c.plan_id;
  select * into nxt from public.monthly_plan
    where space_id = c.space_id and deleted_at is null and cycle_start > cur.cycle_end
    order by cycle_start limit 1;
  if nxt.id is null then
    return null;
  end if;
  insert into public.plan_line (plan_id, space_id, target, account_role, kind, amount, amount_groom, amount_bride, sort)
    values (nxt.id, c.space_id, 'account', 'living', 'emergency_to_living', c.income_short,
      case when c.income_short_side = 'bride' then 0 else c.income_short end,
      case when c.income_short_side = 'bride' then c.income_short else 0 end, 900)
    returning id into lid;
  update public.month_close set supplement_line_id = lid where id = c.id;
  return lid;
end;
$$;
revoke execute on function public.add_income_supplement(uuid) from public, anon, authenticated;

-- W-04a2 답(수입 당사자만). 돌려주는 값 = 기준과의 차이(실제 − 기준)
create or replace function public.answer_actual_income(p_close uuid, p_amount bigint)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c public.month_close;
  me public.app_user;
  base bigint;
  short bigint;
  other uuid;
begin
  select * into me from public.app_user where id = auth.uid();
  select * into c from public.month_close where id = p_close and deleted_at is null for update;
  if c.id is null or me.id is null or c.space_id is distinct from me.space_id then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if not me.income_variable then
    raise exception 'not_variable' using errcode = '22023';
  end if;
  if p_amount < 0 or p_amount > 99999999999 then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  base := coalesce(me.monthly_income, 0);
  short := greatest(base - p_amount, 0);
  -- 이미 넣은 보충 줄은 아직 옮기지 않았으면 다시 계산
  if c.supplement_line_id is not null then
    delete from public.plan_line l where l.id = c.supplement_line_id and l.state = 'pending'
      and l.groom_done_at is null and l.bride_done_at is null;
    if found then
      c.supplement_line_id := null;
    end if;
  end if;
  update public.month_close set
    income_actual_groom = case when me.side = 'bride' then income_actual_groom else p_amount end,
    income_actual_bride = case when me.side = 'bride' then p_amount else income_actual_bride end,
    income_short = case when short > 0 then short end,
    income_short_side = case when short > 0 then coalesce(me.side, 'groom') end,
    supplement_line_id = c.supplement_line_id
  where id = c.id;
  if short > 0 then
    perform public.add_income_supplement(c.id);
    select id into other from public.app_user
      where space_id = c.space_id and status = 'active' and id <> me.id limit 1;
    if other is not null then
      perform public.notify(other, c.space_id, 'income_short',
        coalesce(me.nickname, '') || '님 이번 달 수입이 기준보다 ' || public.read_won(short) || ' 적어요',
        '다음 달에 비상금에서 생활비로 채워요', '/plan', 'wallet', me.id, 'income_short:' || c.id);
    end if;
  end if;
  return p_amount - base;
end;
$$;
revoke execute on function public.answer_actual_income(uuid, bigint) from public, anon;
grant execute on function public.answer_actual_income(uuid, bigint) to authenticated;

-- 다음 플랜이 생기면 지난 정리의 보충을 넣음
create or replace function public.plan_add_supplement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.month_close;
begin
  for c in
    select m.* from public.month_close m
    join public.monthly_plan p on p.id = m.plan_id
    where m.space_id = new.space_id and m.deleted_at is null and coalesce(m.income_short, 0) > 0
      and m.supplement_line_id is null and p.cycle_end < new.cycle_start
  loop
    perform public.add_income_supplement(c.id);
  end loop;
  return new;
end;
$$;
create trigger monthly_plan_supplement after insert on public.monthly_plan
  for each row execute function public.plan_add_supplement();
