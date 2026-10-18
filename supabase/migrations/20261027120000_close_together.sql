-- 함께 모드(21 W-04a 4~8번, W-04 끝 6~8번, 함께 정하기 3번, 07 월 사이클, 08 부부·제안·권한).
-- 정리자(started_by)가 시작한 정리에 배우자가 ‘같이 하기’를 누르면 함께 모드: 이 정리에서 바꾼 값은 제안 없이 바로 확정.
-- 한 사람이 나가면(앱이 접속 표시로 알아채 leave) 그때까지 확정은 유지, 이후 바꾼 값은 다시 묶음 제안. 5분 안에 다시 들어오면 재개.
-- 함께 정하기(together) 제안은 함께 모드에서 ‘이 값으로 정하기’로 확정(confirm_together).

alter table public.month_close
  add column together_by uuid references auth.users (id) on delete set null,
  add column together_at timestamptz,
  add column together_left_at timestamptz;

create or replace function public.close_together_active(c public.month_close)
returns boolean
language sql
stable
set search_path = ''
as $$
  select c.together_at is not null and c.together_left_at is null and c.status <> 'done';
$$;

-- 같이 하기(정리자가 아닌 사람). 나갔다가 5분 안이면 재개, 지나면 새로 시작
create or replace function public.join_close_together(p_close uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c public.month_close;
  sp public.couple_space;
begin
  select * into c from public.month_close where id = p_close and deleted_at is null for update;
  if c.id is null or not public.is_space_member(c.space_id) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  select * into sp from public.couple_space where id = c.space_id;
  if sp.couple_state <> 'connected' then
    raise exception 'not_connected' using errcode = '22023';
  end if;
  if c.started_at is null or c.status = 'done' then
    raise exception 'not_started' using errcode = '22023';
  end if;
  if c.started_by = auth.uid() then
    raise exception 'is_closer' using errcode = '22023';
  end if;
  update public.month_close set
    together_by = auth.uid(),
    together_at = case when together_at is not null and together_left_at is not null
                        and together_left_at > now() - interval '5 minutes' then together_at else now() end,
    together_left_at = null
  where id = c.id;
end;
$$;
revoke all on function public.join_close_together(uuid) from public, anon;
grant execute on function public.join_close_together(uuid) to authenticated;

-- 한 사람이 나감(둘 중 누구든 부름)
create or replace function public.leave_close_together(p_close uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c public.month_close;
begin
  select * into c from public.month_close where id = p_close and deleted_at is null for update;
  if c.id is null or not public.is_space_member(c.space_id) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if c.together_at is not null and c.together_left_at is null then
    update public.month_close set together_left_at = now() where id = c.id;
  end if;
end;
$$;
revoke all on function public.leave_close_together(uuid) from public, anon;
grant execute on function public.leave_close_together(uuid) to authenticated;

-- 묶음에 제안 넣기(20261024150000과 같음). 함께 모드면 바로 확정(좋아요와 같은 적용)
create or replace function public.propose_in_close(
  p_close uuid, p_item text, p_after jsonb, p_apply_on date, p_target uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c public.month_close;
  pid uuid;
  p public.proposal;
begin
  select * into c from public.month_close where id = p_close and deleted_at is null;
  if c.id is null or not public.is_space_member(c.space_id) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  perform set_config('sweetwo.close_bundle', c.id::text, true);
  pid := public.propose(p_item, p_after, p_apply_on, p_target);
  perform set_config('sweetwo.close_bundle', '', true);
  update public.proposal set month_close_id = c.id where id = pid;
  if public.close_together_active(c) then
    select * into p from public.proposal where id = pid;
    perform public.apply_proposal_values(p);
    update public.proposal set status = 'applied', response = 'like', responded_at = now(), applied_at = now(),
      seen_at = now(), together = false
    where id = pid;
  end if;
  return pid;
end;
$$;
revoke execute on function public.propose_in_close(uuid, text, jsonb, date, uuid) from public, anon;
grant execute on function public.propose_in_close(uuid, text, jsonb, date, uuid) to authenticated;

-- 함께 정하기 항목을 함께 모드에서 확정(‘이 값으로 정하기’)
create or replace function public.confirm_together(p_close uuid, p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c public.month_close;
  p public.proposal;
begin
  select * into c from public.month_close where id = p_close and deleted_at is null;
  if c.id is null or not public.is_space_member(c.space_id) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if not public.close_together_active(c) then
    raise exception 'not_together' using errcode = '22023';
  end if;
  select * into p from public.proposal where id = p_id and space_id = c.space_id for update;
  if p.id is null or p.status not in ('open', 'held') then
    raise exception 'not_open' using errcode = '22023';
  end if;
  perform public.apply_proposal_values(p);
  update public.proposal set status = 'applied', response = 'like', responded_at = now(), applied_at = now(),
    seen_at = coalesce(seen_at, now()), together = false, month_close_id = coalesce(month_close_id, c.id)
  where id = p.id;
end;
$$;
revoke all on function public.confirm_together(uuid, uuid) from public, anon;
grant execute on function public.confirm_together(uuid, uuid) to authenticated;
