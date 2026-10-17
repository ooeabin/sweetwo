-- 연결 해제 요청과 자산 정리 안(docs/spec/25-settings.md S-12a~c, 해제 대기. 08 부부·제안·권한 3장, 09 데이터 항목 ‘연결 해제’).
-- 이 마이그레이션: 요청(S-12c 보내기) → 해제 대기, 요청 취소. 상대 응답·기본안 적용·해제 확정·다시 연결은 다음 단계.
-- 자산 정리 안 = 공동 명의 자산(owner = 'joint')마다 요청한 사람 몫. 상대 몫 = 금액 − 요청자 몫.
-- 기본안 = 분담 비율(요청자 기준 %), 1만 원 단위 반올림(06 계산·배분 ‘분담액’), 0 ~ 금액. core rules/unlink.ts와 같은 결과.
-- 제안은 proposal_space()가 이미 해제 대기면 거절(보내기·응답·적용 멈춤).

create table public.couple_unlink (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.couple_space (id) on delete cascade,
  requested_by uuid not null references public.app_user (id),
  requested_at timestamptz not null default now(),
  deadline date not null, -- 요청일(한국) + 14일. 지나면 기본안
  ratio smallint not null check (ratio between 0 and 100), -- 요청자 몫 %
  plan jsonb not null check (jsonb_typeof(plan) = 'array'), -- [{ asset_id, name, amount, mine }]
  status text not null default 'pending' check (status in ('pending', 'cancelled', 'confirmed')),
  cancelled_at timestamptz,
  confirmed_at timestamptz
);
create unique index couple_unlink_pending_idx on public.couple_unlink (space_id) where status = 'pending';
create index couple_unlink_space_idx on public.couple_unlink (space_id, requested_at desc);

alter table public.couple_unlink enable row level security;
create policy couple_unlink_select on public.couple_unlink for select to authenticated
  using (public.is_space_member(space_id));
-- 쓰기는 함수로만
revoke insert, update, delete on public.couple_unlink from authenticated, anon;

-- 요청자 몫 %(분담 방식): 반반 50 / 버는 만큼 월 실수령 비율(반올림, 둘 중 하나가 없으면 50) / 직접 split_ratio(시작한 사람 몫)
create or replace function public.unlink_ratio(sid uuid, uid uuid)
returns smallint
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  sp public.couple_space;
  mine bigint;
  theirs bigint;
begin
  select * into sp from public.couple_space where id = sid;
  if sp.split_mode = 'income' then
    select monthly_income into mine from public.app_user where id = uid;
    select monthly_income into theirs from public.app_user
      where space_id = sid and status = 'active' and id <> uid limit 1;
    if coalesce(mine, 0) > 0 and coalesce(theirs, 0) > 0 then
      return round(mine * 100.0 / (mine + theirs))::smallint;
    end if;
    return 50;
  elsif sp.split_mode = 'custom' then
    if sp.created_by is null or sp.created_by = uid then
      return coalesce(sp.split_ratio, 50);
    end if;
    return 100 - coalesce(sp.split_ratio, 50);
  end if;
  return 50;
end;
$$;
revoke execute on function public.unlink_ratio(uuid, uuid) from public, anon, authenticated;

-- 기본 몫: 금액 × % ÷ 100, 1만 원 단위 반올림, 0 ~ 금액
create or replace function public.unlink_share(amount bigint, pct integer)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select least(greatest(round(amount * pct / 1000000.0) * 10000, 0), amount)::bigint;
$$;

-- S-12c 보내기. p_shares = { "<asset_id>": 요청자 몫 } (없는 항목은 기본 몫). p_confirm은 “연결 해제”
create or replace function public.request_unlink(p_shares jsonb, p_confirm text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  me public.app_user;
  other public.app_user;
  sp public.couple_space;
  pct smallint;
  items jsonb := '[]'::jsonb;
  a record;
  v jsonb;
  mine bigint;
  new_id uuid;
  dl date := public.kst_today() + 14;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_confirm is distinct from '연결 해제' then
    raise exception 'confirm_mismatch' using errcode = 'P0001';
  end if;
  if p_shares is null or jsonb_typeof(p_shares) <> 'object' then
    raise exception 'invalid_shares' using errcode = '22023';
  end if;
  select * into me from public.app_user where id = uid and status = 'active';
  select * into sp from public.couple_space where id = me.space_id for update;
  if sp.id is null or sp.couple_state <> 'connected' then
    raise exception 'not_connected' using errcode = '42501';
  end if;
  select * into other from public.app_user
    where space_id = sp.id and status = 'active' and id <> uid limit 1;
  if other.id is null then
    raise exception 'not_connected' using errcode = '42501';
  end if;
  pct := public.unlink_ratio(sp.id, uid);
  for a in
    select x.id, x.name, x.amount from public.asset x
    where x.space_id = sp.id and x.owner = 'joint' and x.side = 'asset' and x.status = 'held'
      and x.deleted_at is null and x.amount > 0
    order by x.created_at, x.id
  loop
    v := p_shares -> a.id::text;
    if v is null or jsonb_typeof(v) = 'null' then
      mine := public.unlink_share(a.amount, pct);
    elsif jsonb_typeof(v) <> 'number' or (v #>> '{}') !~ '^\d+$' then
      raise exception 'invalid_shares' using errcode = '22023';
    else
      mine := (v #>> '{}')::bigint;
      if mine > a.amount then
        raise exception 'invalid_shares' using errcode = '22023';
      end if;
    end if;
    items := items || jsonb_build_array(jsonb_build_object(
      'asset_id', a.id, 'name', a.name, 'amount', a.amount, 'mine', mine));
  end loop;

  insert into public.couple_unlink (space_id, requested_by, deadline, ratio, plan)
    values (sp.id, uid, dl, pct, items)
    returning id into new_id;
  update public.couple_space set couple_state = 'unlink_pending' where id = sp.id;

  perform public.notify(
    other.id, sp.id, 'unlink_requested',
    coalesce(me.nickname, '') || '님이 연결 해제를 요청했어요',
    '자산 정리 안을 확인해 주세요',
    '/settings/couple', null, uid, 'unlink:' || new_id || ':requested');
  return new_id;
end;
$$;
revoke execute on function public.request_unlink(jsonb, text) from public, anon;
grant execute on function public.request_unlink(jsonb, text) to authenticated;

-- 요청 취소(요청자만, 상대 응답 전) → 연결로 복귀 + 상대 알림
create or replace function public.cancel_unlink()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  me public.app_user;
  u public.couple_unlink;
  other uuid;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into me from public.app_user where id = uid and status = 'active';
  select * into u from public.couple_unlink
    where space_id = me.space_id and status = 'pending' for update;
  if u.id is null then
    raise exception 'no_request' using errcode = 'P0001';
  end if;
  if u.requested_by <> uid then
    raise exception 'not_requester' using errcode = '42501';
  end if;
  update public.couple_unlink set status = 'cancelled', cancelled_at = now() where id = u.id;
  update public.couple_space set couple_state = 'connected'
    where id = u.space_id and couple_state = 'unlink_pending';
  select id into other from public.app_user
    where space_id = u.space_id and status = 'active' and id <> uid limit 1;
  if other is not null then
    perform public.notify(
      other, u.space_id, 'unlink_cancelled',
      coalesce(me.nickname, '') || '님이 연결 해제 요청을 취소했어요', null,
      '/settings/couple', null, uid, 'unlink:' || u.id || ':cancelled');
  end if;
end;
$$;
revoke execute on function public.cancel_unlink() from public, anon;
grant execute on function public.cancel_unlink() to authenticated;
