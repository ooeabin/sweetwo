-- 우리 자산(docs/spec/23-assets.md F-01~F-04, 09 데이터 항목 자산·부채 6-5·6-6, 08 2·4장 명의·공개 범위)
-- 자산과 부채를 한 표에(side). 명의: 공동(joint) / 사람(person, owner_user_id). 배우자 합류 전 대신 입력은 person + owner_user_id null.
-- 공개 범위는 서버에서 거름: 배우자 ‘합계만’ 항목은 행을 주지 않고 partner_asset_sums()로 묶음 합계만, ‘비공개’는 아무것도 안 줌.

create type public.asset_side as enum ('asset', 'debt');
create type public.asset_owner as enum ('joint', 'person');
create type public.asset_visibility as enum ('all', 'sum', 'private');
create type public.asset_status as enum ('held', 'sold');

create table public.asset (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.couple_space (id) on delete cascade,
  side public.asset_side not null,
  grp text not null check (grp ~ '^[a-z_]{2,20}$'), -- 묶음(현금성, 예금·적금 …), packages/core/src/rules/asset.ts
  kind text not null check (kind ~ '^[a-z_]{2,30}$'), -- 세부 항목. 기타(직접 입력)는 other
  name text not null check (char_length(btrim(name)) between 1 and 20),
  amount bigint not null check (amount between 0 and 99999999999), -- 자산 = 평가금액(현재 금액), 부채 = 남은 금액
  principal bigint check (principal between 0 and 99999999999), -- 넣은 원금(투자·부동산, 선택)
  estimated boolean not null default false, -- ‘잘 모르겠어요’ 구간 값
  owner public.asset_owner not null,
  owner_user_id uuid references auth.users (id) on delete set null, -- person만. null = 배우자 합류 전 대신 입력
  visibility public.asset_visibility not null default 'all',
  maturity_date date,
  monthly_payment bigint check (monthly_payment between 0 and 99999999999),
  interest_rate numeric(5, 2) check (interest_rate between 0 and 100),
  goal_id uuid references public.goal (id) on delete set null,
  status public.asset_status not null default 'held',
  sold_at timestamptz,
  realized_gain bigint,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null,
  -- 공동은 사람 없음, 공동·대신 입력은 전체 공개
  check (owner = 'person' or owner_user_id is null),
  check (visibility = 'all' or (owner = 'person' and owner_user_id is not null))
);
create index asset_space_idx on public.asset (space_id) where deleted_at is null;
create trigger asset_actor before insert or update on public.asset
  for each row execute function public.stamp_actor();
create trigger asset_touch before update on public.asset
  for each row execute function public.touch_row();

-- 금액 이력(F-04 월별 기록, 순자산 그래프). 금액·원금이 바뀔 때마다 한 줄. 월말 정리가 바꾸면 source = 'close'
create table public.asset_history (
  id bigint generated always as identity primary key,
  asset_id uuid not null references public.asset (id) on delete cascade,
  space_id uuid not null references public.couple_space (id) on delete cascade,
  amount bigint not null,
  principal bigint,
  source text not null default 'manual' check (source in ('manual', 'close')),
  recorded_at timestamptz not null default now()
);
create index asset_history_asset_idx on public.asset_history (asset_id, recorded_at);

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
      coalesce(nullif(current_setting('sweetwo.asset_source', true), ''), 'manual'));
  end if;
  return new;
end;
$$;
revoke execute on function public.record_asset_history() from public, anon, authenticated;
create trigger asset_history_record after insert or update on public.asset
  for each row execute function public.record_asset_history();

-- 내가 볼 수 있는 행: 공동, 전체 공개, 내 명의, 내가 대신 입력한 것
create or replace function public.asset_visible(a public.asset)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_space_member(a.space_id) and (
    a.owner = 'joint' or a.visibility = 'all' or a.owner_user_id = auth.uid()
    or (a.owner_user_id is null and a.created_by = auth.uid())
  );
$$;
revoke execute on function public.asset_visible(public.asset) from public, anon;
grant execute on function public.asset_visible(public.asset) to authenticated;

-- 내가 고칠 수 있는 행: 공동, 내 명의, 합류 전 내가 대신 입력한 것(08 2·5장)
create or replace function public.asset_editable(a public.asset)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_space_member(a.space_id) and (
    a.owner = 'joint' or a.owner_user_id = auth.uid()
    or (a.owner = 'person' and a.owner_user_id is null and a.created_by = auth.uid())
  );
$$;
revoke execute on function public.asset_editable(public.asset) from public, anon;
grant execute on function public.asset_editable(public.asset) to authenticated;

-- 새로 만들기: 대신 입력(배우자 명의)은 배우자 합류 전에만
create or replace function public.asset_insertable(a public.asset)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_space_member(a.space_id) and (
    a.owner = 'joint' or a.owner_user_id = auth.uid()
    or (a.owner = 'person' and a.owner_user_id is null and exists (
      select 1 from public.couple_space s where s.id = a.space_id and s.couple_state = 'not_joined'
    ))
  );
$$;
revoke execute on function public.asset_insertable(public.asset) from public, anon;
grant execute on function public.asset_insertable(public.asset) to authenticated;

alter table public.asset enable row level security;
create policy asset_select on public.asset for select to authenticated using (public.asset_visible(asset));
create policy asset_insert on public.asset for insert to authenticated with check (public.asset_insertable(asset));
create policy asset_update on public.asset for update to authenticated
  using (public.asset_editable(asset)) with check (public.asset_editable(asset));
create policy asset_delete on public.asset for delete to authenticated using (false);
revoke delete on public.asset from authenticated, anon;

alter table public.asset_history enable row level security;
create policy asset_history_select on public.asset_history for select to authenticated using (
  exists (select 1 from public.asset a where a.id = asset_id and public.asset_visible(a))
);
revoke insert, update, delete on public.asset_history from authenticated, anon; -- 트리거만

-- 배우자 ‘합계만’ 항목: 묶음별 개수와 합계만(F-02 11번). 배우자 ‘비공개’는 없음
create or replace function public.partner_asset_sums()
returns table (side public.asset_side, grp text, n integer, total bigint, principal_total bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select a.side, a.grp, count(*)::int, sum(a.amount)::bigint, sum(coalesce(a.principal, a.amount))::bigint
  from public.app_user me
  join public.asset a on a.space_id = me.space_id
  where me.id = auth.uid() and me.status = 'active'
    and a.deleted_at is null and a.status = 'held'
    and a.owner = 'person' and a.owner_user_id is not null and a.owner_user_id <> me.id
    and a.visibility = 'sum'
  group by a.side, a.grp;
$$;
revoke execute on function public.partner_asset_sums() from public, anon;
grant execute on function public.partner_asset_sums() to authenticated;

-- 월말 순자산(F-01 2·6번). 원금 기준(net)과 평가금액 기준(expected). 비공개(누구 것이든) 제외, 배우자 ‘합계만’ 포함.
-- 그달 마지막 날까지의 마지막 금액. 판 자산은 판 뒤, 지운 항목은 지운 뒤 0(과거 기록은 유지)
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
    where a.space_id = me.space_id and a.visibility <> 'private'
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
revoke execute on function public.net_worth_history(integer) from public, anon;
grant execute on function public.net_worth_history(integer) to authenticated;

-- 합류 완료: 대신 입력한 배우자 명의 항목은 합류한 사람에게 넘어감(08 2장)
create or replace function public.finish_join()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid uuid;
begin
  select space_id into sid from public.app_user where id = uid and status = 'active';
  if sid is null or not exists (
    select 1 from public.invite i where i.space_id = sid and i.used_by = uid
  ) then
    raise exception 'not_joining' using errcode = '42501';
  end if;
  update public.couple_space set couple_state = 'connected' where id = sid and couple_state = 'not_joined';
  update public.invite set used_at = coalesce(used_at, now()) where space_id = sid and used_by = uid;
  update public.app_user set onboarding_step = 'P-11', onboarding_done_at = coalesce(onboarding_done_at, now())
    where id = uid;
  update public.asset set owner_user_id = uid
    where space_id = sid and owner = 'person' and owner_user_id is null and created_by <> uid;
end;
$$;
