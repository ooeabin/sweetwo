-- 공개 범위 새 항목 기본값(25 S-13 1번)과 휴지통(S-21).
--
-- 공개 범위: app_user.default_visibility(내 자산·부채 새 항목 기본값, 기본 ‘합계만’). 항목별 공개 범위는 asset.visibility 그대로.
-- 휴지통: 자산·부채, 목표, 가족, 챙길 날. 지운 지 30일 안. 내 명의·공동 항목만(배우자 명의는 배우자 휴지통에만).
--   되살리기: 같이 지워진 것도 함께(가족 → 그 챙길 날, 챙길 날 → 드린 기록, 목표 → 쓴 기록. 부모와 10초 안에 지운 것).
--             연결된 부부의 목표는 제안(goal_restore)으로.
--   영구 삭제·비우기: 함수로만. 30일 지나면 매일 자동 영구 삭제(알림 없음).

alter table public.app_user
  add column default_visibility public.asset_visibility not null default 'sum';
grant update (default_visibility) on public.app_user to authenticated;

-- 휴지통에 보이는 항목인지(내 공간, 지운 지 30일 안, 배우자 명의·남의 서프라이즈 빼고)
create or replace function public.trash_rows()
returns table (kind text, id uuid, name text, sub text, deleted_at timestamptz, deleted_by uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select u.id, u.space_id from public.app_user u where u.id = auth.uid() and u.status = 'active')
  select 'asset', a.id, a.name, a.side::text, a.deleted_at, a.deleted_by
    from public.asset a, me
    where a.space_id = me.space_id and a.deleted_at is not null and a.deleted_at > now() - interval '30 days'
      and (a.owner = 'joint' or a.owner_user_id = me.id or (a.owner_user_id is null and a.created_by = me.id))
  union all
  select 'goal', g.id, g.name, null, g.deleted_at, g.deleted_by
    from public.goal g, me
    where g.space_id = me.space_id and g.deleted_at is not null and g.deleted_at > now() - interval '30 days'
  union all
  select 'family', f.id, f.title, null, f.deleted_at, f.deleted_by
    from public.family_member f, me
    where f.space_id = me.space_id and f.deleted_at is not null and f.deleted_at > now() - interval '30 days'
  union all
  select 'care_day', c.id, c.name, null, c.deleted_at, c.deleted_by
    from public.care_day c, me
    where c.space_id = me.space_id and c.deleted_at is not null and c.deleted_at > now() - interval '30 days'
      and (not c.secret or c.created_by = me.id)
      -- 같이 지워진 챙길 날은 가족 줄로만
      and not exists (select 1 from public.family_member f
        where f.id = c.member_id and f.deleted_at is not null
          and abs(extract(epoch from f.deleted_at - c.deleted_at)) <= 10)
  order by 5 desc;
$$;
revoke execute on function public.trash_rows() from public, anon;
grant execute on function public.trash_rows() to authenticated;

-- 되살리기. 연결된 부부의 목표는 여기서 안 함(goal_restore 제안). 돌려주는 값: 'restored'
create or replace function public.restore_trash(p_kind text, p_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  t timestamptz;
begin
  if not exists (select 1 from public.trash_rows() r where r.kind = p_kind and r.id = p_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if p_kind = 'asset' then
    update public.asset set deleted_at = null where id = p_id;
  elsif p_kind = 'goal' then
    if exists (select 1 from public.goal g join public.couple_space s on s.id = g.space_id
               where g.id = p_id and s.couple_state = 'connected') then
      raise exception 'needs_proposal' using errcode = 'P0001';
    end if;
    select deleted_at into t from public.goal where id = p_id;
    update public.goal g set deleted_at = null,
      priority = (select coalesce(max(x.priority), 0) + 1 from public.goal x where x.space_id = g.space_id and x.deleted_at is null)
      where g.id = p_id;
    update public.goal_use set deleted_at = null
      where goal_id = p_id and deleted_at is not null and abs(extract(epoch from deleted_at - t)) <= 10;
  elsif p_kind = 'family' then
    select deleted_at into t from public.family_member where id = p_id;
    update public.family_member set deleted_at = null where id = p_id;
    update public.care_record r set deleted_at = null
      from public.care_day c
      where r.care_day_id = c.id and c.member_id = p_id and r.deleted_at is not null
        and abs(extract(epoch from r.deleted_at - t)) <= 10;
    update public.care_day set deleted_at = null
      where member_id = p_id and deleted_at is not null and abs(extract(epoch from deleted_at - t)) <= 10;
  elsif p_kind = 'care_day' then
    select deleted_at into t from public.care_day where id = p_id;
    update public.care_day set deleted_at = null where id = p_id;
    update public.care_record set deleted_at = null
      where care_day_id = p_id and deleted_at is not null and abs(extract(epoch from deleted_at - t)) <= 10;
  end if;
  return 'restored';
end;
$$;
revoke execute on function public.restore_trash(text, uuid) from public, anon;
grant execute on function public.restore_trash(text, uuid) to authenticated;

-- 영구 삭제(휴지통에 보이는 것만). p_id가 null이면 휴지통 비우기
create or replace function public.purge_trash(p_kind text default null, p_id uuid default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r record;
  n integer := 0;
begin
  for r in select * from public.trash_rows() x
           where (p_id is null or (x.kind = p_kind and x.id = p_id)) loop
    if r.kind = 'asset' then delete from public.asset where id = r.id;
    elsif r.kind = 'goal' then delete from public.goal where id = r.id;
    elsif r.kind = 'family' then
      delete from public.care_day where member_id = r.id and deleted_at is not null;
      delete from public.family_member where id = r.id;
    elsif r.kind = 'care_day' then delete from public.care_day where id = r.id;
    end if;
    n := n + 1;
  end loop;
  if p_id is not null and n = 0 then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  return n;
end;
$$;
revoke execute on function public.purge_trash(text, uuid) from public, anon;
grant execute on function public.purge_trash(text, uuid) to authenticated;

-- 매일: 지운 지 30일 지난 항목 영구 삭제(알림 없음)
create or replace function public.purge_old_trash()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  delete from public.care_record where deleted_at < now() - interval '30 days';
  delete from public.care_day where deleted_at < now() - interval '30 days';
  delete from public.family_member where deleted_at < now() - interval '30 days';
  delete from public.goal_use where deleted_at < now() - interval '30 days';
  delete from public.goal where deleted_at < now() - interval '30 days';
  delete from public.asset where deleted_at < now() - interval '30 days';
end;
$$;
revoke execute on function public.purge_old_trash() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('purge-old-trash', '45 19 * * *', 'select public.purge_old_trash()');
  end if;
end;
$$;

-- ── 목표 되살리기 제안(연결된 부부, S-21 3번) ───────────────────────────────────
alter table public.proposal drop constraint proposal_item_check;
alter table public.proposal add constraint proposal_item_check
  check (item in ('allowance', 'split', 'living_budget', 'family_budget', 'base_day', 'goal_amount', 'goal_deadline',
                  'goal_pause', 'goal_delete', 'goal_add', 'goal_order', 'goal_restore'));

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
  elsif p.item = 'goal_restore' then
    -- 휴지통 목표 되살리기(S-21): 맨 아래 우선순위, 같이 지워진 쓴 기록도
    update public.goal_use w set deleted_at = null
      from public.goal g
      where g.id = p.target_id and w.goal_id = g.id and w.deleted_at is not null and g.deleted_at is not null
        and abs(extract(epoch from w.deleted_at - g.deleted_at)) <= 10;
    update public.goal g set deleted_at = null,
      priority = (select coalesce(max(x.priority), 0) + 1 from public.goal x where x.space_id = g.space_id and x.deleted_at is null)
      where g.id = p.target_id and g.deleted_at is not null;
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
  if p_item = 'goal_restore' then
    -- 휴지통(30일 안)에 있는 이 공간 목표
    select * into g from public.goal
      where id = p_target and space_id = sid and deleted_at is not null and deleted_at > now() - interval '30 days';
    if not found then
      raise exception 'bad_target' using errcode = '22023';
    end if;
  elsif p_item like 'goal\_%' and p_item not in ('goal_add', 'goal_order') then
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
  elsif p_item = 'goal_restore' then
    -- 지운 목표는 앱 목록에 없어서 이름을 같이 남김
    bef := jsonb_build_object('deleted', true, 'name', g.name);
    p_after := jsonb_build_object('deleted', false, 'name', g.name);
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


-- 목표 되살리기 제안 도착 문구
create or replace function public.notify_proposal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  other public.app_user;
  who text;
  noun text := public.proposal_item_noun(new);
begin
  if tg_op = 'INSERT' and new.status = 'open' then
    select * into other from public.app_user
      where space_id = new.space_id and status = 'active' and id <> new.proposer limit 1;
    if other.id is null then return new; end if;
    select coalesce(nickname, '') into who from public.app_user where id = new.proposer;
    perform public.notify(
      other.id, new.space_id, 'proposal_arrived',
      case when new.item = 'goal_add'
        then who || '님이 ' || public.ko_obj(noun) || ' 추가하자고 제안했어요'
        when new.item = 'goal_restore'
        then who || '님이 ' || public.ko_obj(noun) || ' 되살리자고 제안했어요'
        else who || '님이 ' || public.ko_obj(noun) || ' 바꾸자고 제안했어요' end,
      '좋아요면 바로, 반대 없으면 ' || public.md_label(new.apply_on) || '부터 적용돼요',
      '/proposals/' || new.id, null, new.proposer, 'proposal:' || new.id || ':arrived');
  elsif tg_op = 'UPDATE' and old.response is null and new.response in ('like', 'oppose') then
    select * into other from public.app_user
      where space_id = new.space_id and status = 'active' and id <> new.proposer limit 1;
    who := coalesce(other.nickname, '');
    perform public.notify(
      new.proposer, new.space_id, 'proposal_answered',
      case when new.response = 'like'
        then who || '님이 ' || noun || ' 제안에 좋아요를 눌렀어요'
        else who || '님이 ' || noun || ' 제안에 반대했어요' end,
      case when new.response = 'like' then '바로 적용했어요' else '월말 정리에서 함께 정해요' end,
      '/proposals/' || new.id, null, other.id, 'proposal:' || new.id || ':answered');
  end if;
  return new;
end;
$$;
