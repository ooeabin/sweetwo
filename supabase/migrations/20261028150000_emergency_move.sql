-- 비상금 넣기, 꺼내기(06 8장, 23 비상금 카드). 비상금은 목표 목록에서 빠지고 언제든 넣고 빼는 돈.
-- 잔액 = 비상금 목표 보유액(기타 보유액 + 연결 자산 + 월말 정리 납입 − 사용) + 넣기 − 꺼내기.
-- 비상금 역할 통장이 있으면(통장 역할을 나눈 부부) 그 통장 자산 금액도 같이 바꿈(순자산과 맞춤). 바로 반영, 제안 아님.
create table public.emergency_move (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.couple_space (id) on delete cascade,
  kind text not null check (kind in ('in', 'out')),
  amount bigint not null check (amount between 1 and 99999999999),
  reason text check (reason in ('hospital', 'repair', 'family_event', 'living_short', 'etc')),
  moved_on date not null default public.kst_today(),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (kind = 'out' or reason is null)
);
create index emergency_move_space_idx on public.emergency_move (space_id) where deleted_at is null;

alter table public.emergency_move enable row level security;
create policy emergency_move_select on public.emergency_move for select to authenticated using (public.is_space_member(space_id));
create policy emergency_move_insert on public.emergency_move for insert to authenticated with check (false);
create policy emergency_move_update on public.emergency_move for update to authenticated using (false);
create policy emergency_move_delete on public.emergency_move for delete to authenticated using (false);
revoke insert, update, delete on public.emergency_move from authenticated, anon;

-- 비상금 역할 통장 자산 금액을 d만큼(0 아래로는 안 내려감)
create or replace function public.emergency_asset_add(p_space uuid, d bigint)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.asset s
  set amount = greatest(s.amount + d, 0)
  from public.account a
  where a.space_id = p_space and a.role = 'emergency' and a.deleted_at is null
    and a.asset_id = s.id and s.deleted_at is null;
$$;
revoke execute on function public.emergency_asset_add(uuid, bigint) from public, anon, authenticated;

create or replace function public.move_emergency(p_kind text, p_amount bigint, p_reason text default null)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  sid uuid;
  mid uuid;
begin
  select space_id into sid from public.app_user where id = auth.uid() and status = 'active';
  if sid is null then
    raise exception 'no_space' using errcode = '42501';
  end if;
  insert into public.emergency_move (space_id, kind, amount, reason, created_by)
  values (sid, p_kind, p_amount, case when p_kind = 'out' then p_reason end, auth.uid())
  returning id into mid;
  perform public.emergency_asset_add(sid, case when p_kind = 'in' then p_amount else -p_amount end);
  return mid;
end;
$$;
revoke execute on function public.move_emergency(text, bigint, text) from public, anon;
grant execute on function public.move_emergency(text, bigint, text) to authenticated;

-- 되돌리기(토스트): 기록을 지우고 통장 금액도 되돌림. 내가 한 기록만
create or replace function public.undo_emergency_move(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  m public.emergency_move;
begin
  update public.emergency_move set deleted_at = now()
  where id = p_id and created_by = auth.uid() and deleted_at is null
  returning * into m;
  if m.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  perform public.emergency_asset_add(m.space_id, case when m.kind = 'in' then -m.amount else m.amount end);
end;
$$;
revoke execute on function public.undo_emergency_move(uuid) from public, anon;
grant execute on function public.undo_emergency_move(uuid) to authenticated;

-- 배우자 활동(H-08)에 비상금 넣기, 꺼내기
create or replace function public.partner_activity(p_limit int default 5)
returns table (at timestamptz, kind text, name text, ref text, target text)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select u.id, u.space_id
    from public.app_user u
    join public.couple_space s on s.id = u.space_id
    where u.id = auth.uid() and s.couple_state in ('connected', 'unlink_pending')
  ),
  p as (
    select u.id from public.app_user u, me where u.space_id = me.space_id and u.id <> me.id
  ),
  x as (
    -- 상대가 일으킨 알림(제목이 곧 문구)
    select n.created_at as at, 'notice'::text as kind, n.title as name, n.id::text as ref, n.target
    from public.notification n, me, p
    where n.user_id = me.id and n.actor_id = p.id
    union all
    -- 월급 나누기 줄 끝냄(알림 없이 활동에만)
    select l.groom_done_at, 'split_done', coalesce(l.account_role::text, l.kind::text), l.id::text, '/plan/split'
    from public.plan_line l, me, p
    where l.space_id = me.space_id and l.groom_done_by = p.id and l.groom_done_at is not null
      and l.deleted_at is null
    union all
    select l.bride_done_at, 'split_done', coalesce(l.account_role::text, l.kind::text), l.id::text, '/plan/split'
    from public.plan_line l, me, p
    where l.space_id = me.space_id and l.bride_done_by = p.id and l.bride_done_at is not null
      and l.deleted_at is null
    union all
    -- 자산·부채 추가, 금액 바꿈
    select a.updated_at,
      case when a.version <= 1 then 'asset_added' else 'asset_changed' end,
      case when a.owner = 'person' and a.owner_user_id = p.id and a.visibility = 'sum' then null else a.name end,
      a.id::text,
      case when a.owner = 'person' and a.owner_user_id = p.id and a.visibility = 'sum'
        then '/assets' else '/assets/' || a.id::text end
    from public.asset a, me, p
    where a.space_id = me.space_id and a.updated_by = p.id and a.deleted_at is null
      and a.visibility <> 'private'
    union all
    -- 비상금 넣기, 꺼내기(F-09). 이름 자리에 금액
    select m.created_at, 'emergency_' || m.kind, m.amount::text, m.id::text, '/assets'
    from public.emergency_move m, me, p
    where m.space_id = me.space_id and m.created_by = p.id and m.deleted_at is null
  )
  select x.at, x.kind, x.name, x.ref, x.target
  from x
  where x.at > now() - interval '90 days'
  order by x.at desc
  limit least(greatest(coalesce(p_limit, 5), 1), 20);
$$;
revoke all on function public.partner_activity(int) from public, anon;
grant execute on function public.partner_activity(int) to authenticated;
