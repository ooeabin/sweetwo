-- QA 8구간(자산 관리 F-01~F-04d, 2026-11-12) 서버 쪽.
-- 1. asset을 Realtime 발행에 더함(S8-06): 상대가 공동·모두 보여 주기 자산을 고치면 F-01·F-02·F-04·홈이 바로 다시 읽음.
--    읽기 권한은 asset_select(asset_visible) 그대로라 상대 ‘금액만’·‘숨기기’ 행은 신호도 안 감
-- 2. 앱이 바로 고칠 때 명의(owner, owner_user_id), 만든 사람(created_by), 공간(space_id)은 못 바꿈(S8-03, asset_client_guard).
--    RLS update는 새 행만 보므로 공동 자산을 내 명의 숨기기로 가져가거나 created_by를 꾸밀 수 있었음.
--    함수 안(security definer: 합류 넘김 finish_join, 연결 해제·다시 연결 등)은 current_user가 함수 주인이라 걸리지 않음
--    (goal_owner_guard와 같은 방식)
-- 3. 사용자 결정 D3 = A(S8-14): 금액 이력의 처음 값은 source 'created'(수정 내역에 안 보임 → 고친 적 없으면 빈 상태 문구),
--    팔았어요(sell_asset)는 'sell', 만기 정리(settle_matured)는 'matured'로 따로 남김(직접 고친 것만 'manual').
--    지금 있는 처음 값 줄도 'created'로(같은 트랜잭션이라 recorded_at = created_at)
-- 4. 전·월세 보증금은 팔기 흐름이 없음(S8-15): sell_asset이 거절
-- 스키마는 추가만(발행에 표 더함, source 값 넓힘, 함수 새 버전, 트리거 하나)

-- 1. Realtime 발행 ─────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'asset') then
    alter publication supabase_realtime add table public.asset;
  end if;
end;
$$;

-- 2. 명의·만든 사람·공간 잠금 ──────────────────────────────────────────
create or replace function public.asset_client_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') and (
       new.owner is distinct from old.owner
       or new.owner_user_id is distinct from old.owner_user_id
       or new.created_by is distinct from old.created_by
       or new.space_id is distinct from old.space_id) then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger asset_client_guard before update on public.asset
  for each row execute function public.asset_client_guard();

-- 3. 금액 이력 source ───────────────────────────────────────────────────
alter table public.asset_history drop constraint if exists asset_history_source_check;
alter table public.asset_history add constraint asset_history_source_check
  check (source in ('manual', 'close', 'created', 'sell', 'matured'));

create or replace function public.record_asset_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.amount is distinct from old.amount or new.principal is distinct from old.principal then
    insert into public.asset_history (asset_id, space_id, amount, principal, source)
    values (new.id, new.space_id, new.amount, new.principal,
      coalesce(nullif(current_setting('sweetwo.asset_source', true), ''),
        case when tg_op = 'INSERT' then 'created' else 'manual' end));
  end if;
  return new;
end;
$$;
revoke execute on function public.record_asset_history() from public, anon, authenticated;

update public.asset_history h set source = 'created'
  from public.asset a
  where h.asset_id = a.id and h.source = 'manual' and h.recorded_at = a.created_at;

-- 4. 팔았어요(보증금 빼고, 이력 'sell') ─────────────────────────────────
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

-- 만기 정리(이력 'matured')
create or replace function public.settle_matured(p_asset uuid, p_to uuid default null, p_new_date date default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.asset;
  t public.asset;
begin
  select * into a from public.asset where id = p_asset and deleted_at is null and status = 'held' for update;
  if a.id is null or not public.asset_editable(a) or a.side <> 'asset' or a.maturity_date is null then
    raise exception 'not_found' using errcode = '42501';
  end if;
  if (p_to is null) = (p_new_date is null) then
    raise exception 'bad_choice' using errcode = '22023';
  end if;
  if p_new_date is not null then
    if p_new_date <= public.kst_today() then
      raise exception 'bad_date' using errcode = '22023';
    end if;
    update public.asset set maturity_date = p_new_date where id = a.id;
    return;
  end if;
  select * into t from public.asset
    where id = p_to and space_id = a.space_id and deleted_at is null and status = 'held' and side = 'asset' for update;
  if t.id is null or t.id = a.id or not public.asset_editable(t) then
    raise exception 'bad_target' using errcode = '22023';
  end if;
  if t.amount + a.amount > 99999999999 then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  perform set_config('sweetwo.asset_source', 'matured', true);
  update public.asset set amount = t.amount + a.amount, estimated = false where id = t.id;
  update public.asset set status = 'matured' where id = a.id;
  perform set_config('sweetwo.asset_source', '', true);
end;
$$;
revoke all on function public.settle_matured(uuid, uuid, date) from public, anon;
grant execute on function public.settle_matured(uuid, uuid, date) to authenticated;
