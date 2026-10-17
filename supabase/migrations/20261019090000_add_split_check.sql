-- 월급 나누기 체크(20 W-02): 사람마다(신랑·신부 쪽 분담) ‘옮겼어요’. 앱은 돈을 옮기지 않고 기록만.
-- 체크한 사람(대신 체크 포함)과 실제 옮긴 금액(W-02a ‘다른 금액’)을 남김. 두 사람 몫이 다 끝나면 줄 state = done.
-- 같은 몫을 거의 동시에 체크하면 먼저 저장된 체크가 남고 나중 사람에게 ‘already’.

alter table public.plan_line
  add column groom_done_at timestamptz,
  add column groom_done_by uuid references auth.users (id) on delete set null,
  add column groom_done_amount bigint check (groom_done_amount between 0 and 99999999999),
  add column bride_done_at timestamptz,
  add column bride_done_by uuid references auth.users (id) on delete set null,
  add column bride_done_amount bigint check (bride_done_amount between 0 and 99999999999);

-- 몫이 있는 쪽이 모두 끝났는지(몫이 0·없음이면 끝난 것으로 봄)
create or replace function public.split_line_done(l public.plan_line)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (coalesce(l.amount_groom, 0) = 0 or l.groom_done_at is not null)
     and (coalesce(l.amount_bride, 0) = 0 or l.bride_done_at is not null);
$$;

create or replace function public.check_split(p_line uuid, p_side public.couple_side, p_amount bigint default null)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  l public.plan_line;
  share bigint;
begin
  select * into l from public.plan_line where id = p_line and deleted_at is null for update;
  if l.id is null or not public.is_space_member(l.space_id) or l.target <> 'account' then
    raise exception 'not_member' using errcode = '42501';
  end if;
  share := case when p_side = 'groom' then l.amount_groom else l.amount_bride end;
  if coalesce(share, 0) = 0 then
    raise exception 'no_share' using errcode = '22023';
  end if;
  if p_amount is not null and (p_amount < 0 or p_amount > 99999999999) then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  if (p_side = 'groom' and l.groom_done_at is not null) or (p_side = 'bride' and l.bride_done_at is not null) then
    -- 금액만 고치는 건 체크한 뒤에도 됨(W-02a). 새 체크는 먼저 한 사람이 이김
    if p_amount is null then
      return 'already';
    end if;
  end if;
  if p_side = 'groom' then
    update public.plan_line set
      groom_done_at = coalesce(groom_done_at, now()),
      groom_done_by = coalesce(groom_done_by, uid),
      groom_done_amount = coalesce(p_amount, share)
    where id = p_line returning * into l;
  else
    update public.plan_line set
      bride_done_at = coalesce(bride_done_at, now()),
      bride_done_by = coalesce(bride_done_by, uid),
      bride_done_amount = coalesce(p_amount, share)
    where id = p_line returning * into l;
  end if;
  update public.plan_line set
    state = case when public.split_line_done(l) then 'done' else 'pending' end::public.plan_line_state,
    done_amount = case when public.split_line_done(l)
      then coalesce(l.groom_done_amount, 0) + coalesce(l.bride_done_amount, 0) end
  where id = p_line;
  return 'ok';
end;
$$;
revoke execute on function public.check_split(uuid, public.couple_side, bigint) from public, anon;
grant execute on function public.check_split(uuid, public.couple_side, bigint) to authenticated;

create or replace function public.uncheck_split(p_line uuid, p_side public.couple_side)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  l public.plan_line;
begin
  select * into l from public.plan_line where id = p_line and deleted_at is null;
  if l.id is null or not public.is_space_member(l.space_id) or l.target <> 'account' then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if p_side = 'groom' then
    update public.plan_line set groom_done_at = null, groom_done_by = null, groom_done_amount = null,
      state = 'pending', done_amount = null where id = p_line;
  else
    update public.plan_line set bride_done_at = null, bride_done_by = null, bride_done_amount = null,
      state = 'pending', done_amount = null where id = p_line;
  end if;
end;
$$;
revoke execute on function public.uncheck_split(uuid, public.couple_side) from public, anon;
grant execute on function public.uncheck_split(uuid, public.couple_side) to authenticated;

-- 안 나눈 몫만 다시 계산(20 ‘사실값 바뀐 직후’: 이미 옮긴 몫은 그대로)
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
    where l.plan_id = p_plan_id and l.target = 'account' and l.state = 'pending' and l.deleted_at is null
      and l.account_role = (x->>'account_role')::public.account_role;
    n := n + 1;
  end loop;
  update public.monthly_plan set is_temp = p_is_temp where id = p_plan_id;
  return n;
end;
$$;
