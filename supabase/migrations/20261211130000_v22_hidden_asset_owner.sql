-- 자산 ‘숨기기’는 파트너에게만 안 보인다(2026-11-13 실구동 사용성 H3).
-- 예전에는 내 숨기기 항목이 내 화면(F-01 순자산, F-02 합계, 홈 H-04, F-08 순위)에서도 0원으로 빠졌다.
-- 앱 frame `netWorthOf`, core `netWorth`·`investSummary`·`financialPct`·`rankPairNet(items, viewer)`와 같게:
--  1. networth_summary(): 내가 볼 수 있는 행 모두(asset_visible = 공동, 모두 보여 주기, 내 명의, 내가 대신 입력한 것)
--     + 파트너 ‘총액만’. 파트너 숨기기는 그대로 뺌.
--  2. net_worth_history(): 월말 기록도 같은 기준(내 숨기기 포함, 파트너 숨기기 제외).
--  3. networth_rank_pair(): 둘의 합 중 상대 숨기기만 뺌. 보는 사람마다 값이 다를 수 있다(각자 rank_view·app_user.rank_net).

create or replace function public.networth_summary()
returns jsonb language sql stable security definer set search_path = '' as $$
  with me as (
    select u.id, u.space_id from public.app_user u where u.id = auth.uid() and u.status = 'active'
  ),
  items as (
    select a.side, a.amount, a.principal from public.asset a join me on a.space_id = me.space_id
    where a.deleted_at is null and a.status = 'held'
      and (public.asset_visible(a)
        or (a.owner = 'person' and a.owner_user_id is not null and a.owner_user_id <> me.id and a.visibility = 'sum'))
  )
  select jsonb_build_object(
    'assets', coalesce(sum(amount) filter (where side = 'asset'), 0),
    'debts', coalesce(sum(amount) filter (where side = 'debt'), 0),
    'net', coalesce(sum(case when side = 'asset' then amount else -amount end), 0),
    'principal_net', coalesce(sum(case when side = 'asset' then coalesce(principal, amount) else -amount end), 0))
  from items;
$$;

create or replace function public.net_worth_history(p_months integer default 12)
returns table (month date, net bigint, expected bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select u.id, u.space_id from public.app_user u where u.id = auth.uid() and u.status = 'active'
  ),
  months as (
    select (date_trunc('month', now() at time zone 'Asia/Seoul') - make_interval(months => g))::date as m
    from generate_series(0, greatest(least(p_months, 120), 1) - 1) g
  ),
  items as (
    select a.* from public.asset a, me
    where a.space_id = me.space_id
      and (a.visibility <> 'private' or a.owner_user_id = me.id or (a.owner_user_id is null and a.created_by = me.id))
  )
  select mo.m,
    coalesce(sum(case when v.side = 'asset' then 1 else -1 end * coalesce(v.principal, v.amount)), 0)::bigint,
    coalesce(sum(case when v.side = 'asset' then 1 else -1 end * v.amount), 0)::bigint
  from months mo
  left join lateral (
    select i.side, x.amount, x.principal
    from items i
    join lateral (
      select h.amount, h.principal from public.asset_history h
      where h.asset_id = i.id
        and h.recorded_at < ((mo.m + interval '1 month')::timestamp at time zone 'Asia/Seoul')
      order by h.recorded_at desc, h.id desc limit 1
    ) x on true
    where (i.deleted_at is null or i.deleted_at >= ((mo.m + interval '1 month')::timestamp at time zone 'Asia/Seoul'))
      and (i.sold_at is null or i.sold_at >= ((mo.m + interval '1 month')::timestamp at time zone 'Asia/Seoul'))
  ) v on true
  group by mo.m
  order by mo.m;
$$;

create or replace function public.networth_rank_pair()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  me public.app_user;
  net bigint;
  by_ smallint;
begin
  select * into me from public.app_user where id = auth.uid();
  if me.id is null then
    raise exception 'not_found' using errcode = '42501';
  end if;
  if not public.rank_pair_consented(me.space_id) then
    return jsonb_build_object('mode', 'peer') || public.peer_median(me.birth_year);
  end if;
  select coalesce(sum(case when side = 'asset' then amount else -amount end), 0) into net
    from public.asset where space_id = me.space_id and deleted_at is null and status = 'held'
      and (visibility <> 'private' or owner_user_id = me.id or (owner_user_id is null and created_by = me.id));
  select min(birth_year) into by_ from public.app_user where space_id = me.space_id and status = 'active';
  return jsonb_build_object('mode', 'pair', 'net', net, 'top_pct', public.rank_top_pct(net),
    'top_open', net >= 1100200000, 'band', public.rank_age_band(by_, extract(year from public.kst_today())::int),
    'basis', 'all');
end;
$$;
