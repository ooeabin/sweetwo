-- 통장 역할 ↔ 자산(09 통장 ‘자산 1개와 반드시 연결’, 06 1장 ‘입력한 통장은 자산 목록에 자동 포함’, 23 F-02 9번 역할 배지)
-- 통장을 만들면 같은 이름의 현금성 자산을 하나 만들어 잇는다(금액 = 시작 잔액, 없으면 0).
-- 지운(휴지통) 자산은 연결이 없는 것으로 본다(되돌리면 다시 연결). 월말 정리 잔액으로 금액 갱신은 W-04b와 함께.

alter table public.account add column asset_id uuid references public.asset (id) on delete set null;
create unique index account_asset_once on public.account (asset_id)
  where deleted_at is null and asset_id is not null;

create or replace function public.account_make_asset()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  aid uuid;
  personal boolean := new.role = 'personal';
begin
  if new.asset_id is not null or new.deleted_at is not null then
    return new;
  end if;
  insert into public.asset (space_id, side, grp, kind, name, amount, owner, owner_user_id)
  values (
    new.space_id, 'asset', 'cash',
    case when new.role in ('goal_fund', 'emergency', 'wedding') then 'role_account' else 'bank' end,
    new.name, coalesce(new.start_balance, 0),
    case when personal then 'person' else 'joint' end::public.asset_owner,
    case when personal then coalesce(new.owner_user_id, auth.uid()) end
  )
  returning id into aid;
  new.asset_id := aid;
  return new;
end;
$$;
revoke execute on function public.account_make_asset() from public, anon, authenticated;
create trigger account_asset before insert on public.account
  for each row execute function public.account_make_asset();

-- O-63에서 통장 이름·시작 잔액을 고치거나 통장을 지우면(통장 하나로 써요), 만든 그대로인 자산만 따라감.
-- 사람이 자산을 고쳤으면(이름이나 금액이 달라짐) 그대로 둠
create or replace function public.account_sync_asset()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.asset_id is null then
    return new;
  end if;
  if new.deleted_at is not null and old.deleted_at is null then
    update public.asset set deleted_at = now(), deleted_by = auth.uid()
      where id = new.asset_id and deleted_at is null
        and name = old.name and amount = coalesce(old.start_balance, 0);
  elsif new.deleted_at is null and (new.name is distinct from old.name
      or new.start_balance is distinct from old.start_balance) then
    update public.asset set name = new.name, amount = coalesce(new.start_balance, 0)
      where id = new.asset_id and deleted_at is null
        and name = old.name and amount = coalesce(old.start_balance, 0);
  end if;
  return new;
end;
$$;
revoke execute on function public.account_sync_asset() from public, anon, authenticated;
create trigger account_asset_sync after update on public.account
  for each row execute function public.account_sync_asset();

-- 이미 있는 통장
do $$
declare
  r record;
  aid uuid;
begin
  for r in select * from public.account where asset_id is null and deleted_at is null loop
    insert into public.asset (space_id, side, grp, kind, name, amount, owner, owner_user_id, created_by)
    values (
      r.space_id, 'asset', 'cash',
      case when r.role in ('goal_fund', 'emergency', 'wedding') then 'role_account' else 'bank' end,
      r.name, coalesce(r.start_balance, 0),
      case when r.role = 'personal' and r.owner_user_id is not null then 'person' else 'joint' end::public.asset_owner,
      case when r.role = 'personal' then r.owner_user_id end,
      r.created_by
    )
    returning id into aid;
    update public.account set asset_id = aid where id = r.id;
  end loop;
end;
$$;
