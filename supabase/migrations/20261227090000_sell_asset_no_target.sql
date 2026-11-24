-- F-04b 팔았어요 한 화면(2026-11-24): ‘어느 통장에 들어왔어요?’에서 ‘안 적을게요’를 고르면 받은 통장 없이 판 것만 기록한다.
-- sell_asset의 받은 통장(p_to)이 null이면 통장 금액은 건드리지 않고, 팔린 만큼만 줄이거나 ‘매도 완료’로 보관한다. 시그니처·반환값은 그대로(추가만).
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
  if a.id is null or not public.asset_editable(a) or a.side <> 'asset' or a.grp not in ('invest', 'real_estate')
     or a.kind = 'deposit_money' then
    raise exception 'not_found' using errcode = '42501';
  end if;
  if p_received is null or p_received < 0 or p_received > 99999999999
     or (p_remain is not null and (p_remain < 0 or p_remain > 99999999999)) then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  if p_to is not null then
    select * into t from public.asset
      where id = p_to and space_id = a.space_id and deleted_at is null and status = 'held' and side = 'asset'
        and grp in ('cash', 'deposit') for update;
    if t.id is null or not public.asset_editable(t) then
      raise exception 'bad_target' using errcode = '22023';
    end if;
    if t.amount + p_received > 99999999999 then
      raise exception 'bad_amount' using errcode = '22023';
    end if;
    perform set_config('sweetwo.asset_source', 'sell', true);
    update public.asset set amount = t.amount + p_received, estimated = false where id = t.id;
  end if;
  perform set_config('sweetwo.asset_source', 'sell', true);
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
  perform set_config('sweetwo.asset_source', '', true);
  return case when sold_principal is null then null else p_received - sold_principal end;
end;
$$;
revoke all on function public.sell_asset(uuid, bigint, uuid, bigint) from public, anon;
grant execute on function public.sell_asset(uuid, bigint, uuid, bigint) to authenticated;
