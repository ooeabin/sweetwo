-- 목표 순서(G-06)와 생활비 예산(G-04 안 3 지출 줄이기) 제안(08 6-1). 둘 다 공간에 열린 제안 하나.

alter table public.proposal drop constraint proposal_item_check;
alter table public.proposal add constraint proposal_item_check
  check (item in ('allowance', 'split', 'living_budget', 'goal_amount', 'goal_deadline', 'goal_pause', 'goal_delete', 'goal_add', 'goal_order'));
alter table public.proposal drop constraint proposal_goal_target;
alter table public.proposal add constraint proposal_goal_target
  check ((item like 'goal\_%' and item not in ('goal_add', 'goal_order')) = (target_id is not null));

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
  elsif p.item = 'goal_add' then
    -- 맨 아래 우선순위. 만든 사람 = 제안한 사람(담당 ‘나’, ‘배우자’는 그 사람 기준)
    insert into public.goal (space_id, template, name, kind, priority, target_amount, deadline, other_held,
      owner, details, amount_estimated, deadline_estimated, created_by)
    values (
      p.space_id, p.after->>'template', btrim(p.after->>'name'), (p.after->>'kind')::public.goal_kind,
      (select coalesce(max(x.priority), 0) + 1 from public.goal x where x.space_id = p.space_id and x.deleted_at is null),
      nullif(p.after->>'target_amount', '')::bigint, nullif(p.after->>'deadline', '')::date,
      coalesce((p.after->>'other_held')::bigint, 0), (p.after->>'owner')::public.goal_owner,
      coalesce(p.after->'details', '{}'::jsonb),
      coalesce((p.after->>'amount_estimated')::boolean, false), coalesce((p.after->>'deadline_estimated')::boolean, false),
      p.proposer
    );
  elsif p.item = 'goal_order' then
    -- 받은 순서대로 우선순위 1, 2, 3 …(비상금은 0 그대로)
    update public.goal g set priority = o.n
    from jsonb_array_elements_text(p.after->'order') with ordinality as o(id, n)
    where g.id = o.id::uuid and g.space_id = p.space_id and g.deleted_at is null and g.template <> 'emergency';
  elsif p.item = 'living_budget' then
    update public.couple_space set living_budget = (p.after->>'living_budget')::bigint, living_budget_estimated = false
    where id = p.space_id;
  elsif p.item = 'goal_delete' then
    update public.goal set deleted_at = now() where id = p.target_id and deleted_at is null;
    -- 지운 목표의 다른 열린 제안은 거둠
    update public.proposal set status = 'withdrawn'
    where target_id = p.target_id and status = 'open' and id <> p.id;
  end if;
end;
$$;
revoke execute on function public.apply_proposal_values(public.proposal) from public, anon, authenticated;

create or replace function public.propose(p_item text, p_after jsonb, p_apply_on date, p_target uuid default null)
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
  if p_item like 'goal\_%' and p_item not in ('goal_add', 'goal_order') then
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
  elsif p_item = 'goal_order' then
    -- 이 공간 목표(비상금 빼고)만, 한 번씩
    if jsonb_typeof(p_after->'order') <> 'array' or jsonb_array_length(p_after->'order') = 0
      or exists (
        select 1 from jsonb_array_elements_text(p_after->'order') x(id)
        where not exists (
          select 1 from public.goal gg
          where gg.id::text = x.id and gg.space_id = sid and gg.deleted_at is null and gg.template <> 'emergency'))
      or (select count(distinct x) from jsonb_array_elements_text(p_after->'order') x) <> jsonb_array_length(p_after->'order') then
      raise exception 'bad_value' using errcode = '22023';
    end if;
    select jsonb_build_object('order', coalesce(jsonb_agg(gg.id order by gg.priority), '[]'::jsonb)) into bef
      from public.goal gg
      where gg.space_id = sid and gg.deleted_at is null and gg.template <> 'emergency'
        and gg.id::text in (select jsonb_array_elements_text(p_after->'order'));
  elsif p_item = 'living_budget' then
    if jsonb_typeof(p_after->'living_budget') <> 'number' or (p_after->>'living_budget')::bigint not between 0 and 99999999999 then
      raise exception 'bad_value' using errcode = '22023';
    end if;
    select jsonb_build_object('living_budget', s.living_budget) into bef from public.couple_space s where s.id = sid;
  elsif p_item = 'goal_add' then
    -- 새 목표: 이름 1~20자, 형태, 금액·기한·보유액·담당 확인. 자동 목표(비상금, 결혼 비용, 양가 비용)는 추가 없음
    if coalesce(char_length(btrim(p_after->>'name')), 0) not between 1 and 20
      or (p_after->>'template') is null or (p_after->>'template') in ('emergency', 'wedding', 'family_cost')
      or (p_after->>'kind') not in ('once', 'yearly', 'monthly')
      or (p_after->>'owner') not in ('together', 'me', 'partner')
      or (p_after ? 'target_amount' and jsonb_typeof(p_after->'target_amount') <> 'null'
          and (p_after->>'target_amount')::bigint not between 1 and 99999999999)
      or coalesce((p_after->>'other_held')::bigint, 0) not between 0 and 99999999999
      or (jsonb_typeof(p_after->'deadline') = 'string' and (
          (p_after->>'deadline') !~ '^\d{4}-\d{2}-01$'
          or (p_after->>'deadline')::date < date_trunc('month', now() at time zone 'Asia/Seoul')::date)) then
      raise exception 'bad_value' using errcode = '22023';
    end if;
    bef := '{}'::jsonb;
  else
    raise exception 'bad_item' using errcode = '22023';
  end if;

  select * into cur from public.proposal
    where space_id = sid and item = p_item and status = 'open' and p_item <> 'goal_add'
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
      where space_id = sid and item = p_item and status = 'held' and p_item <> 'goal_add'
        and (p_item <> 'allowance' or proposer = uid)
        and target_id is not distinct from p_target;
  end if;

  insert into public.proposal (space_id, item, target_id, proposer, before, after, apply_on, round_trips, oppose_count, together, replaces)
  values (sid, p_item, p_target, uid, bef, p_after, p_apply_on, trips, opp, trips >= 2 or opp >= 2, cur.id)
  returning id into pid;
  return pid;
end;
$$;
