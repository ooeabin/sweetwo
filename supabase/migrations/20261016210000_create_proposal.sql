-- 제안(docs/spec/08-couple-proposal-permission.md 6장, 22-goals.md G-08). 배분 결정은 연결된 부부에서 제안 하나로 바뀐다.
-- 지금 다루는 항목: allowance(내 용돈), split(분담 방식). 목표, 기준일, 생활비 예산, 월말 정리 묶음은 그 화면과 함께 추가.
-- 적용일(72시간이 지난 첫 기준일)은 앱이 계산해 넘기고(packages/core/src/rules/proposal.ts) 서버는 72시간이 지났는지만 확인.

create type public.proposal_status as enum ('open', 'applied', 'held', 'withdrawn', 'expired', 'reverted', 'superseded');
create type public.proposal_response as enum ('like', 'oppose', 'differently');

create table public.proposal (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.couple_space (id) on delete cascade,
  item text not null check (item in ('allowance', 'split')),
  proposer uuid not null references auth.users (id) on delete cascade,
  before jsonb not null,
  after jsonb not null,
  status public.proposal_status not null default 'open',
  apply_on date not null, -- 반대 없으면 이날 적용
  seen_at timestamptz, -- 받은 사람이 연 때(전 = ‘보내기 취소’, 뒤 = ‘철회’)
  response public.proposal_response,
  responded_at timestamptz,
  oppose_count integer not null default 0, -- 같은 항목 반대 횟수(묶음이 적용·철회·만료되면 0)
  round_trips integer not null default 0, -- ‘다르게 해볼래요’ 왕복
  together boolean not null default false, -- 함께 정하기 표시(반대 2회 또는 왕복 2회)
  replaces uuid references public.proposal (id) on delete set null,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);
-- 항목당 열린 제안 하나. 용돈은 사람마다 따로(내 용돈만 제안 대상)
create unique index proposal_open_once on public.proposal (
  space_id, item, (case when item = 'allowance' then proposer else '00000000-0000-0000-0000-000000000000'::uuid end)
) where status = 'open';
create index proposal_space_idx on public.proposal (space_id, created_at desc);
create trigger proposal_touch before update on public.proposal
  for each row execute function public.touch_row();

alter table public.proposal enable row level security;
create policy proposal_select on public.proposal for select to authenticated using (public.is_space_member(space_id));
revoke insert, update, delete on public.proposal from authenticated, anon; -- 함수만

-- 제안할 수 있는 내 공간(두 사람이 있을 때만, 아니면 거절)
create or replace function public.proposal_space()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  sid uuid;
begin
  -- 두 사람이 공간에 있어야(합류 중 P-07, P-08도 포함). 해제 대기·혼자 쓰기면 거절
  select u.space_id into sid from public.app_user u
    join public.couple_space s on s.id = u.space_id
    where u.id = auth.uid() and u.status = 'active' and s.couple_state in ('not_joined', 'connected')
      and (select count(*) from public.app_user m where m.space_id = u.space_id and m.status = 'active') = 2;
  if sid is null then
    raise exception 'not_connected' using errcode = '42501';
  end if;
  return sid;
end;
$$;
revoke execute on function public.proposal_space() from public, anon;

-- 제안 값 적용(내부)
create or replace function public.apply_proposal_values(p public.proposal)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p.item = 'allowance' then
    update public.app_user set allowance = (p.after->>'allowance')::bigint where id = p.proposer;
  elsif p.item = 'split' then
    update public.couple_space set
      split_mode = (p.after->>'mode')::public.split_mode,
      split_ratio = (p.after->>'starter_ratio')::smallint,
      split_deferred = false
    where id = p.space_id;
  end if;
end;
$$;
revoke execute on function public.apply_proposal_values(public.proposal) from public, anon, authenticated;

-- 보내기(같은 항목에 열린 제안이 있으면 대체: 내 것이면 고쳐 보내기, 상대 것이면 ‘다르게 해볼래요’)
create or replace function public.propose(p_item text, p_after jsonb, p_apply_on date)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid uuid := public.proposal_space();
  cur public.proposal;
  bef jsonb;
  trips integer := 0;
  opp integer := 0;
  pid uuid;
begin
  if p_apply_on < ((now() at time zone 'Asia/Seoul') + interval '72 hours')::date then
    raise exception 'apply_too_soon' using errcode = '22023';
  end if;
  if p_item = 'allowance' then
    if jsonb_typeof(p_after->'allowance') <> 'number' or (p_after->>'allowance')::bigint not between 0 and 99999999999 then
      raise exception 'bad_value' using errcode = '22023';
    end if;
    select jsonb_build_object('allowance', u.allowance) into bef from public.app_user u where u.id = uid;
  elsif p_item = 'split' then
    if (p_after->>'mode') not in ('half', 'income', 'custom')
      or (p_after->>'mode' = 'custom' and ((p_after->>'starter_ratio')::int not between 0 and 100 or (p_after->>'starter_ratio')::int % 5 <> 0)) then
      raise exception 'bad_value' using errcode = '22023';
    end if;
    select jsonb_build_object('mode', s.split_mode, 'starter_ratio', s.split_ratio) into bef
      from public.couple_space s where s.id = sid;
  else
    raise exception 'bad_item' using errcode = '22023';
  end if;

  select * into cur from public.proposal
    where space_id = sid and item = p_item and status = 'open' and (p_item <> 'allowance' or proposer = uid)
    for update;
  if found then
    update public.proposal set status = 'superseded' where id = cur.id;
    opp := cur.oppose_count;
    trips := cur.round_trips + case when cur.proposer <> uid then 1 else 0 end;
  else
    -- 보류된 같은 항목(반대) 횟수는 이어서 셈
    select coalesce(max(oppose_count), 0) into opp from public.proposal
      where space_id = sid and item = p_item and status = 'held' and (p_item <> 'allowance' or proposer = uid);
  end if;

  insert into public.proposal (space_id, item, proposer, before, after, apply_on, round_trips, oppose_count, together, replaces)
  values (sid, p_item, uid, bef, p_after, p_apply_on, trips, opp, trips >= 2 or opp >= 2, cur.id)
  returning id into pid;
  return pid;
end;
$$;
revoke execute on function public.propose(text, jsonb, date) from public, anon;
grant execute on function public.propose(text, jsonb, date) to authenticated;

-- 받은 사람이 열었음(이후 제안자는 ‘보내기 취소’ 대신 ‘철회’)
create or replace function public.mark_proposal_seen(p_id uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.proposal set seen_at = coalesce(seen_at, now())
  where id = p_id and proposer <> auth.uid() and public.is_space_member(space_id);
$$;
revoke execute on function public.mark_proposal_seen(uuid) from public, anon;
grant execute on function public.mark_proposal_seen(uuid) to authenticated;

-- 응답: like = 즉시 적용, oppose = 보류(반대 횟수 +1, 2회면 함께 정하기). 돌려주는 값 = 새 상태
create or replace function public.respond_proposal(p_id uuid, p_response public.proposal_response)
returns public.proposal_status
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid uuid := public.proposal_space();
  p public.proposal;
begin
  select * into p from public.proposal where id = p_id and space_id = sid for update;
  if not found or p.proposer = uid then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p.status <> 'open' then
    return p.status; -- 이미 철회·적용됨(앱이 안내)
  end if;
  if p_response = 'like' then
    perform public.apply_proposal_values(p);
    update public.proposal set status = 'applied', response = 'like', responded_at = now(), applied_at = now(),
      seen_at = coalesce(seen_at, now()), together = false
    where id = p.id;
    return 'applied';
  elsif p_response = 'oppose' then
    update public.proposal set status = 'held', response = 'oppose', responded_at = now(),
      seen_at = coalesce(seen_at, now()), oppose_count = p.oppose_count + 1, together = p.together or p.oppose_count + 1 >= 2
    where id = p.id;
    return 'held';
  end if;
  raise exception 'use_propose' using errcode = '22023'; -- 다르게 해볼래요는 propose()로
end;
$$;
revoke execute on function public.respond_proposal(uuid, public.proposal_response) from public, anon;
grant execute on function public.respond_proposal(uuid, public.proposal_response) to authenticated;

-- 제안자 취소(열기 전 = 보내기 취소, 연 뒤 = 철회). 이미 답했으면 거절
create or replace function public.withdraw_proposal(p_id uuid)
returns public.proposal_status
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  p public.proposal;
begin
  select * into p from public.proposal where id = p_id and proposer = auth.uid() and public.is_space_member(space_id) for update;
  if not found then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p.status <> 'open' then
    return p.status;
  end if;
  update public.proposal set status = 'withdrawn' where id = p.id;
  return 'withdrawn';
end;
$$;
revoke execute on function public.withdraw_proposal(uuid) from public, anon;
grant execute on function public.withdraw_proposal(uuid) to authenticated;

-- 적용일이 지난 열린 제안 적용(함께 정하기는 적용 안 함). 앱을 열 때 부름, 기준일 작업에서도 부름. 돌려주는 값 = 적용한 개수
create or replace function public.apply_due_proposals()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  sid uuid;
  p public.proposal;
  n integer := 0;
begin
  select space_id into sid from public.app_user where id = auth.uid() and status = 'active';
  if sid is null then
    return 0;
  end if;
  for p in
    select * from public.proposal
    where space_id = sid and status = 'open' and not together
      and apply_on <= (now() at time zone 'Asia/Seoul')::date
    for update
  loop
    perform public.apply_proposal_values(p);
    update public.proposal set status = 'applied', applied_at = now() where id = p.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke execute on function public.apply_due_proposals() from public, anon;
grant execute on function public.apply_due_proposals() to authenticated;
