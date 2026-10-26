-- F-04 빠진 것(23): 고친 기록에 고친 사람(asset_history.recorded_by), 팔았어요(F-04b~d).
alter table public.asset_history
  add column if not exists recorded_by uuid references auth.users (id) on delete set null default auth.uid();

-- F-04b~d 팔았어요: 받은 금액을 고른 통장에 더함(자산끼리 옮긴 돈, 수입 아님). 일부만 팔았으면 남은 평가금액으로 유지,
-- 다 팔았으면 ‘매도 완료’(sold)로 보관. 실현 손익 = 받은 금액 − 원금(원금 없으면 null)
create or replace function public.sell_asset(p_asset uuid, p_received bigint, p_to uuid, p_remain bigint default null)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.asset;
  t public.asset;
  sold_principal bigint;
begin
  select * into a from public.asset where id = p_asset and deleted_at is null and status = 'held' for update;
  if a.id is null or not public.asset_editable(a) or a.side <> 'asset' or a.grp not in ('invest', 'real_estate') then
    raise exception 'not_found' using errcode = '42501';
  end if;
  if p_received is null or p_received < 0 or p_received > 99999999999
     or (p_remain is not null and (p_remain < 0 or p_remain > 99999999999)) then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  select * into t from public.asset
    where id = p_to and space_id = a.space_id and deleted_at is null and status = 'held' and side = 'asset'
      and grp in ('cash', 'deposit') for update;
  if t.id is null or not public.asset_editable(t) then
    raise exception 'bad_target' using errcode = '22023';
  end if;
  if t.amount + p_received > 99999999999 then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  update public.asset set amount = t.amount + p_received, estimated = false where id = t.id;
  -- 일부만: 판 만큼의 원금 = 원금 × (판 비율)
  if p_remain is null then
    sold_principal := a.principal;
    update public.asset set status = 'sold' where id = a.id;
  else
    sold_principal := case when a.principal is null or a.amount = 0 then null
      else round(a.principal::numeric * (a.amount - p_remain) / a.amount)::bigint end;
    update public.asset set amount = p_remain,
      principal = case when a.principal is null then null else greatest(a.principal - sold_principal, 0) end
      where id = a.id;
  end if;
  return case when sold_principal is null then null else p_received - sold_principal end;
end;
$$;
revoke all on function public.sell_asset(uuid, bigint, uuid, bigint) from public, anon;
grant execute on function public.sell_asset(uuid, bigint, uuid, bigint) to authenticated;
