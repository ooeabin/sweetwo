-- 월급 플랜 날짜(기준일) 바꾸기(25 S-11d, 07 1장)와 신랑·신부 바꾸기(S-11b).
-- 기준일은 배분 결정이라 연결된 부부는 제안(item base_day), 배우자 미합류·혼자 쓰기는 save_base_day로 바로.
-- 고를 수 있는 값 = 두 사람 월급날(말일 포함). 적용: 기준일을 바꾸고, 지금 사이클(정리 전 플랜)의 끝 = 새 기준일 전날.
-- 줄어든 사이클이 15일 미만이면 다음 사이클과 합침(끝을 그다음 새 기준일 전날로, merged_close).
-- 안 나눈 돈을 새 기간에 맞춰 다시 나누는 계산은 월 계획 만들기 작업과 함께(지금은 금액 그대로).
-- 신랑·신부(양가 구분)는 set_my_side 하나로: 나와 배우자 쪽을 같이 바꾸고, 쪽으로 저장한 값(가족, 챙길 날 쪽·챙길 사람,
-- 플랜 줄의 사람별 몫·체크)도 서로 바꿔 사람과 값이 그대로 짝지어지게 함.

alter table public.proposal drop constraint proposal_item_check;
alter table public.proposal add constraint proposal_item_check
  check (item in ('allowance', 'split', 'living_budget', 'family_budget', 'base_day', 'goal_amount', 'goal_deadline',
                  'goal_pause', 'goal_delete', 'goal_add', 'goal_order'));

-- 값 확인: {base_day: 1~31, base_day_last: false} 또는 {base_day: null, base_day_last: true}, 두 사람 월급날 중 하나
create or replace function public.base_day_ok(sid uuid, p jsonb)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_typeof(p) = 'object' and jsonb_typeof(p->'base_day_last') = 'boolean'
    and case when (p->>'base_day_last')::boolean
      then jsonb_typeof(p->'base_day') = 'null' or not (p ? 'base_day')
      else jsonb_typeof(p->'base_day') = 'number' and (p->>'base_day')::int between 1 and 31 end
    and exists (
      select 1 from public.app_user u
      where u.space_id = sid and u.status = 'active'
        and case when (p->>'base_day_last')::boolean then u.payday_last
                 else not u.payday_last and u.payday = (p->>'base_day')::int end);
$$;
revoke execute on function public.base_day_ok(uuid, jsonb) from public, anon, authenticated;

-- d 다음(d 제외) 처음 오는 기준일
create or replace function public.next_base_after(d date, day integer, last boolean)
returns date
language sql
immutable
set search_path = ''
as $$
  select min(x) from (
    select case when last then (date_trunc('month', m) + interval '1 month - 1 day')::date
           else make_date(extract(year from m)::int, extract(month from m)::int,
                          least(day, extract(day from (date_trunc('month', m) + interval '1 month - 1 day'))::int)) end as x
    from generate_series(date_trunc('month', d), date_trunc('month', d) + interval '2 months', interval '1 month') m
  ) z where x > d;
$$;

-- 적용(내부): 기준일 + 지금 사이클 끝 맞추기
create or replace function public.apply_base_day(sid uuid, p jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  last boolean := (p->>'base_day_last')::boolean;
  day integer := case when last then null else (p->>'base_day')::int end;
  today date := (now() at time zone 'Asia/Seoul')::date;
  pl public.monthly_plan;
  e date;
begin
  update public.couple_space set base_day = day, base_day_last = last where id = sid;
  select * into pl from public.monthly_plan
    where space_id = sid and deleted_at is null and status <> 'closed' and cycle_start <= today and cycle_end >= today
    order by cycle_start desc limit 1;
  if pl.id is null then return; end if;
  e := public.next_base_after(pl.cycle_start, coalesce(day, 31), last) - 1;
  -- 이미 지난 날이 끝이 되면 다음 기준일까지
  if e < today then e := public.next_base_after(today, coalesce(day, 31), last) - 1; end if;
  if e - pl.cycle_start + 1 < 15 then
    update public.monthly_plan set cycle_end = public.next_base_after(e, coalesce(day, 31), last) - 1, merged_close = true
      where id = pl.id;
  else
    update public.monthly_plan set cycle_end = e where id = pl.id;
  end if;
end;
$$;
revoke execute on function public.apply_base_day(uuid, jsonb) from public, anon, authenticated;

-- 배우자 미합류·혼자 쓰기: 바로 저장(두 사람이면 제안으로만)
create or replace function public.save_base_day(p_after jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  sid uuid;
begin
  select u.space_id into sid from public.app_user u where u.id = auth.uid() and u.status = 'active';
  if sid is null then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if (select count(*) from public.app_user m where m.space_id = sid and m.status = 'active') > 1 then
    raise exception 'use_proposal' using errcode = '22023';
  end if;
  if not public.base_day_ok(sid, p_after) then
    raise exception 'bad_value' using errcode = '22023';
  end if;
  perform public.apply_base_day(sid, p_after);
end;
$$;
revoke execute on function public.save_base_day(jsonb) from public, anon;
grant execute on function public.save_base_day(jsonb) to authenticated;

-- S-11b 신랑·신부: 나와 배우자 쪽, 쪽으로 저장한 값을 함께 바꿈. 이미 그 쪽이면 아무것도 안 함
create or replace function public.set_my_side(p_side public.couple_side)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me public.app_user;
  other public.couple_side := case p_side when 'groom' then 'bride'::public.couple_side else 'groom'::public.couple_side end;
begin
  select * into me from public.app_user where id = auth.uid() and status = 'active';
  if me.id is null then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if me.side = p_side then return; end if;
  update public.app_user set side = p_side where id = me.id;
  if me.space_id is null then return; end if;
  update public.app_user set side = other where space_id = me.space_id and status = 'active' and id <> me.id;
  -- 처음 정하는 것(쪽이 없었음)이면 저장된 값은 그대로
  if me.side is null then return; end if;
  update public.family_member set side = case side when 'groom' then 'bride'::public.couple_side else 'groom'::public.couple_side end
    where space_id = me.space_id;
  update public.care_day set
    side = case side when 'groom' then 'bride'::public.couple_side when 'bride' then 'groom'::public.couple_side end,
    carer = case carer when 'groom' then 'bride'::public.care_carer when 'bride' then 'groom'::public.care_carer else carer end
    where space_id = me.space_id;
  update public.plan_line set
    amount_groom = amount_bride, amount_bride = amount_groom,
    groom_done_at = bride_done_at, bride_done_at = groom_done_at,
    groom_done_by = bride_done_by, bride_done_by = groom_done_by,
    groom_done_amount = bride_done_amount, bride_done_amount = groom_done_amount
    where space_id = me.space_id;
end;
$$;
revoke execute on function public.set_my_side(public.couple_side) from public, anon;
grant execute on function public.set_my_side(public.couple_side) to authenticated;

create or replace function public.apply_proposal_values(p public.proposal)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  gid uuid;
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
    ) returning id into gid;
    -- 가진 자산에서 고른 것 연결(이 공간, 제안한 사람이 고칠 수 있는 자산만)
    update public.asset a set goal_id = gid
    where a.space_id = p.space_id and a.deleted_at is null and a.side = 'asset'
      and (a.owner = 'joint' or a.owner_user_id = p.proposer or (a.owner_user_id is null and a.created_by = p.proposer))
      and a.id::text in (select jsonb_array_elements_text(coalesce(p.after->'asset_ids', '[]'::jsonb)));
  elsif p.item = 'goal_order' then
    -- 받은 순서대로 우선순위 1, 2, 3 …(비상금은 0 그대로)
    update public.goal g set priority = o.n
    from jsonb_array_elements_text(p.after->'order') with ordinality as o(id, n)
    where g.id = o.id::uuid and g.space_id = p.space_id and g.deleted_at is null and g.template <> 'emergency';
  elsif p.item = 'living_budget' then
    update public.couple_space set living_budget = (p.after->>'living_budget')::bigint, living_budget_estimated = false
    where id = p.space_id;
  elsif p.item = 'base_day' then
    perform public.apply_base_day(p.space_id, p.after);
  elsif p.item = 'family_budget' then
    perform public.apply_family_budget(p.space_id, p.after);
  elsif p.item = 'goal_delete' then
    update public.goal set deleted_at = now() where id = p.target_id and deleted_at is null;
    -- 지운 목표의 다른 열린 제안은 거둠
    update public.proposal set status = 'withdrawn'
    where target_id = p.target_id and status = 'open' and id <> p.id;
  end if;
end;
$$;

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
  elsif p_item = 'base_day' then
    if not public.base_day_ok(sid, p_after) then
      raise exception 'bad_value' using errcode = '22023';
    end if;
    select jsonb_build_object('base_day', s.base_day, 'base_day_last', s.base_day_last) into bef
      from public.couple_space s where s.id = sid;
  elsif p_item = 'family_budget' then
    if not public.family_budget_ok(p_after) then
      raise exception 'bad_value' using errcode = '22023';
    end if;
    bef := public.family_budget_now(sid);
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

create or replace function public.proposal_item_noun(p public.proposal)
returns text
language sql
stable
set search_path = ''
as $$
  select case p.item
    when 'allowance' then '용돈'
    when 'split' then '분담 방식'
    when 'living_budget' then '생활비 예산'
    when 'family_budget' then '양가 비용 예산'
    when 'base_day' then '월급 플랜 날짜'
    when 'goal_order' then '목표 순서'
    when 'goal_add' then coalesce(btrim(p.after->>'name'), '새') || ' 목표'
    else coalesce((select g.name from public.goal g where g.id = p.target_id), '') || ' 목표'
  end;
$$;
