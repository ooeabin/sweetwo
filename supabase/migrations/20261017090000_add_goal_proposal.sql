-- 목표 제안(docs/spec/22-goals.md 목표 수정, G-02 ⋯, 08 6-1). 연결된 부부의 목표 금액, 기한, 보류·다시 모으기, 삭제는 제안.
-- 항목은 목표마다 따로(target_id = 목표). 이름 바꾸기와 목표 사진은 제안이 아니라 바로 저장(목표 테이블 직접).

alter table public.proposal add column target_id uuid references public.goal (id) on delete cascade;

alter table public.proposal drop constraint proposal_item_check;
alter table public.proposal add constraint proposal_item_check
  check (item in ('allowance', 'split', 'goal_amount', 'goal_deadline', 'goal_pause', 'goal_delete'));
alter table public.proposal add constraint proposal_goal_target
  check ((item like 'goal\_%') = (target_id is not null));

-- 열린 제안은 항목마다 하나: 용돈은 사람마다, 목표 항목은 목표마다
drop index public.proposal_open_once;
create unique index proposal_open_once on public.proposal (
  space_id, item,
  (case
    when item = 'allowance' then proposer
    when target_id is not null then target_id
    else '00000000-0000-0000-0000-000000000000'::uuid
  end)
) where status = 'open';

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
  elsif p.item = 'goal_amount' then
    update public.goal set target_amount = (p.after->>'target_amount')::bigint, amount_estimated = false
    where id = p.target_id and deleted_at is null;
  elsif p.item = 'goal_deadline' then
    update public.goal set deadline = (p.after->>'deadline')::date, deadline_estimated = false
    where id = p.target_id and deleted_at is null;
  elsif p.item = 'goal_pause' then
    if (p.after->>'paused')::boolean then
      update public.goal set status = 'paused' where id = p.target_id and deleted_at is null;
    else
      -- 다시 모으면 우선순위 맨 아래(22 달성·보류 상태 2번)
      update public.goal g set status = 'active',
        priority = (select coalesce(max(x.priority), 0) + 1 from public.goal x where x.space_id = g.space_id and x.deleted_at is null)
      where g.id = p.target_id and g.deleted_at is null;
    end if;
  elsif p.item = 'goal_delete' then
    update public.goal set deleted_at = now() where id = p.target_id and deleted_at is null;
    -- 지운 목표의 다른 열린 제안은 거둠
    update public.proposal set status = 'withdrawn'
    where target_id = p.target_id and status = 'open' and id <> p.id;
  end if;
end;
$$;
revoke execute on function public.apply_proposal_values(public.proposal) from public, anon, authenticated;

-- 보내기: 목표 항목은 p_target(목표 id). 앞 버전(인자 3개) 호출도 그대로 됨(p_target 기본 null)
drop function public.propose(text, jsonb, date);
create function public.propose(p_item text, p_after jsonb, p_apply_on date, p_target uuid default null)
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
  g public.goal;
  bef jsonb;
  trips integer := 0;
  opp integer := 0;
  pid uuid;
begin
  if p_apply_on < ((now() at time zone 'Asia/Seoul') + interval '72 hours')::date then
    raise exception 'apply_too_soon' using errcode = '22023';
  end if;
  if p_item like 'goal\_%' then
    select * into g from public.goal where id = p_target and space_id = sid and deleted_at is null;
    if not found then
      raise exception 'bad_target' using errcode = '22023';
    end if;
  elsif p_target is not null then
    raise exception 'bad_target' using errcode = '22023';
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
  elsif p_item = 'goal_amount' then
    if jsonb_typeof(p_after->'target_amount') <> 'number' or (p_after->>'target_amount')::bigint not between 1 and 99999999999 then
      raise exception 'bad_value' using errcode = '22023';
    end if;
    bef := jsonb_build_object('target_amount', g.target_amount);
  elsif p_item = 'goal_deadline' then
    if jsonb_typeof(p_after->'deadline') <> 'string'
      or (p_after->>'deadline') !~ '^\d{4}-\d{2}-01$'
      or (p_after->>'deadline')::date < date_trunc('month', now() at time zone 'Asia/Seoul')::date then
      raise exception 'bad_value' using errcode = '22023';
    end if;
    bef := jsonb_build_object('deadline', g.deadline);
  elsif p_item = 'goal_pause' then
    if jsonb_typeof(p_after->'paused') <> 'boolean' then
      raise exception 'bad_value' using errcode = '22023';
    end if;
    bef := jsonb_build_object('paused', g.status = 'paused');
  elsif p_item = 'goal_delete' then
    if g.template = 'emergency' then
      raise exception 'bad_value' using errcode = '22023'; -- 비상금은 지우기 없음
    end if;
    bef := jsonb_build_object('deleted', false);
    p_after := jsonb_build_object('deleted', true);
  else
    raise exception 'bad_item' using errcode = '22023';
  end if;

  select * into cur from public.proposal
    where space_id = sid and item = p_item and status = 'open'
      and (p_item <> 'allowance' or proposer = uid)
      and target_id is not distinct from p_target
    for update;
  if found then
    update public.proposal set status = 'superseded' where id = cur.id;
    opp := cur.oppose_count;
    trips := cur.round_trips + case when cur.proposer <> uid then 1 else 0 end;
  else
    -- 보류된 같은 항목(반대) 횟수는 이어서 셈
    select coalesce(max(oppose_count), 0) into opp from public.proposal
      where space_id = sid and item = p_item and status = 'held'
        and (p_item <> 'allowance' or proposer = uid)
        and target_id is not distinct from p_target;
  end if;

  insert into public.proposal (space_id, item, target_id, proposer, before, after, apply_on, round_trips, oppose_count, together, replaces)
  values (sid, p_item, p_target, uid, bef, p_after, p_apply_on, trips, opp, trips >= 2 or opp >= 2, cur.id)
  returning id into pid;
  return pid;
end;
$$;
revoke execute on function public.propose(text, jsonb, date, uuid) from public, anon;
grant execute on function public.propose(text, jsonb, date, uuid) to authenticated;
