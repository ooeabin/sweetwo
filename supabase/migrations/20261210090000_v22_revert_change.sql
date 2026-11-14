-- v2.2 ‘이전 값으로 돌리기’(14 N-01·N-02, 08 4장, plan R-08, 2026-11-13 PR 14 후속). 스키마는 추가만.
--
-- ■ 계약
--  1. partner_change에 원래 값 열(추가): before_raw·after_raw(jsonb, 값이 없으면 JSON null, 열이 SQL null이면 이 마이그레이션 전
--     기록이라 돌릴 수 없음), reverted_at·reverted_by. 새 log_partner_change(…, p_before_raw, p_after_raw) 오버로드
--     (예전 9인자 함수는 원래 값 없이 그대로).
--  2. 원래 값을 남기는 것(= 돌릴 수 있는 것, 같이 쓰는 항목만):
--     - 저금(goal_partner_change 새 버전): 목표 금액(goal amount), 기한(goal deadline), 이름(goal_meta name)
--     - 공동 월급 계획 줄 금액(log_split_changes 새 버전, topic split): 줄 하나로 묶이는 것만(같은 열쇠 줄이 하나)
--     - 경조사 메모(care_partner_change 새 버전, care memo)
--     자산 금액은 시세·기록 표(asset_history)를 같이 써야 해서 돌리지 않음(문구만 남김) [확인 필요]
--  3. 알림 하나 = 같은 때 보낸 변경 묶음(flush_partner_changes: dedupe ‘pc:{첫 id}:now’ = 바로 알림의 급한 것,
--     ‘pc:{첫 id}:week’ = 주간 활동의 나머지). 같은 (topic, ref, field)는 첫 줄의 before와 마지막 줄의 after로 합침.
--  4. revertible_notifications(): 지금 돌릴 수 있는 내 알림 id. 조건(묶음 안에 하나라도):
--     받은 사람 = 나, 아직 같은 공간 + 연결(해제 대기 아님), 돌린 적 없음, 원래 값이 있음, 그 뒤 같은 (topic, ref, field)
--     변경 기록이 없음(누가 바꿨든, ‘그 뒤 안 바뀌었을 때만’), 지금 값 = 마지막 after(다시 확인), 항목이 남아 있고 같이 씀
--     (저금: 지우지 않음 + 공동이거나 합쳐서 엔진, 월급 계획: 공동 월급 계획 + 남의 용돈 줄은 allowance_editable,
--      경조사: 지우지 않음·서프라이즈 아님)
--  5. revert_partner_change(p_notification) → 돌린 항목 수. 위 조건을 만족하는 것만 원래 값으로(내가 고친 것으로 기록),
--     묶음 행에 reverted_at·reverted_by, 이 트랜잭션에서 내가 남긴 변경 기록은 보낸 것으로(같은 알림 두 번 막음) 하고
--     바꾼 사람에게 바로 알림 1건 “{이름}님이 이전 값으로 돌렸어요”(kind partner_change, 푸시·인앱) [확인 필요].
--     하나도 없으면 'not_revertible'(22023). 남의 알림이면 'no_notification'(42501).

-- ─────────────────────────── 1. 원래 값 열 ───────────────────────────
alter table public.partner_change
  add column before_raw jsonb,
  add column after_raw jsonb,
  add column reverted_at timestamptz,
  add column reverted_by uuid references auth.users (id) on delete set null;
comment on column public.partner_change.before_raw is
  '돌리기용 원래 값(jsonb, 값 없음 = JSON null). SQL null = 원래 값을 남기지 않은 기록(돌릴 수 없음)';

create function public.log_partner_change(
  p_space uuid, p_topic text, p_ref uuid, p_field text, p_noun text,
  p_before text, p_after text, p_urgent boolean, p_target text, p_before_raw jsonb, p_after_raw jsonb
)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  other uuid;
begin
  if uid is null or p_before is not distinct from p_after then
    return;
  end if;
  if not exists (select 1 from public.couple_space where id = p_space and couple_state in ('connected', 'unlink_pending')) then
    return;
  end if;
  select id into other from public.app_user where space_id = p_space and status = 'active' and id <> uid limit 1;
  if other is null then
    return;
  end if;
  insert into public.partner_change (space_id, actor_id, receiver_id, topic, ref_id, field, noun, before_v, after_v, urgent, target,
                                     before_raw, after_raw)
    values (p_space, uid, other, p_topic, p_ref, p_field, coalesce(p_noun, ''), p_before, p_after, p_urgent, p_target,
            p_before_raw, p_after_raw);
end;
$$;
revoke all on function public.log_partner_change(uuid, text, uuid, text, text, text, text, boolean, text, jsonb, jsonb)
  from public, anon, authenticated;

-- 열을 더해 flush_partner_changes의 묶은 행(m::partner_change)도 새 열까지(함수 몸통은 20261126090000 그대로)
CREATE OR REPLACE FUNCTION public.flush_partner_changes(p_now timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  at_now timestamptz := coalesce(p_now, now());
  g record;
  urgent public.partner_change[];
  quiet public.partner_change[];
  who text;
  cnt integer := 0;
begin
  for g in
    select actor_id, receiver_id, min(space_id::text)::uuid as space_id, min(id) as first_id
    from public.partner_change
    where sent_at is null
    group by actor_id, receiver_id
    having min(created_at) <= at_now - interval '10 minutes'
  loop
    with rows as (
      select c.* from public.partner_change c
      where c.actor_id = g.actor_id and c.receiver_id = g.receiver_id and c.sent_at is null
    ),
    merged as (
      select distinct on (r.topic, r.ref_id, r.field)
        r.id, r.space_id, r.actor_id, r.receiver_id, r.topic, r.ref_id, r.field,
        (select x.noun from rows x where x.topic = r.topic and x.ref_id is not distinct from r.ref_id and x.field = r.field
          order by x.id desc limit 1) as noun,
        (select x.before_v from rows x where x.topic = r.topic and x.ref_id is not distinct from r.ref_id and x.field = r.field
          order by x.id limit 1) as before_v,
        (select x.after_v from rows x where x.topic = r.topic and x.ref_id is not distinct from r.ref_id and x.field = r.field
          order by x.id desc limit 1) as after_v,
        r.urgent, r.target, r.created_at, r.sent_at,
        -- 20261210090000: 원래 값 열을 더해 행 모양을 표와 같게(돌리기는 partner_change_group이 행에서 직접 읽음)
        r.before_raw, r.after_raw, r.reverted_at, r.reverted_by
      from rows r
      order by r.topic, r.ref_id, r.field, r.id
    )
    select
      array_agg(m::public.partner_change order by m.id) filter (where m.urgent and m.before_v is distinct from m.after_v),
      array_agg(m::public.partner_change order by m.id) filter (where not m.urgent and m.before_v is distinct from m.after_v)
    into urgent, quiet
    from merged m;

    update public.partner_change set sent_at = at_now
      where actor_id = g.actor_id and receiver_id = g.receiver_id and sent_at is null;
    -- 받는 사람이 아직 같은 공간일 때만
    continue when not exists (select 1 from public.app_user u
      where u.id = g.receiver_id and u.space_id = g.space_id and u.status = 'active');
    select coalesce(nickname, '') into who from public.app_user where id = g.actor_id;

    if coalesce(array_length(urgent, 1), 0) = 1 then
      perform public.notify(g.receiver_id, g.space_id, 'partner_change',
        public.partner_change_title(urgent[1].topic, urgent[1].noun, who),
        public.partner_change_line(urgent[1].topic, urgent[1].field, urgent[1].noun, urgent[1].before_v, urgent[1].after_v),
        urgent[1].target, null, g.actor_id, 'pc:' || g.first_id || ':now');
      cnt := cnt + 1;
    elsif coalesce(array_length(urgent, 1), 0) > 1 then
      perform public.notify(g.receiver_id, g.space_id, 'partner_change',
        coalesce(nullif(who, '') || '님이', '파트너가') || ' ' || array_length(urgent, 1) || '가지를 바꿨어요', -- [확인 필요]
        left(public.partner_change_line(urgent[1].topic, urgent[1].field, urgent[1].noun, urgent[1].before_v, urgent[1].after_v) || ' 외 ' || (array_length(urgent, 1) - 1) || '개', 200),
        urgent[1].target, null, g.actor_id, 'pc:' || g.first_id || ':now');
      cnt := cnt + 1;
    end if;
    if coalesce(array_length(quiet, 1), 0) = 1 then
      perform public.notify(g.receiver_id, g.space_id, 'partner_activity',
        public.partner_change_title(quiet[1].topic, quiet[1].noun, who),
        public.partner_change_line(quiet[1].topic, quiet[1].field, quiet[1].noun, quiet[1].before_v, quiet[1].after_v),
        quiet[1].target, null, g.actor_id, 'pc:' || g.first_id || ':week');
      cnt := cnt + 1;
    elsif coalesce(array_length(quiet, 1), 0) > 1 then
      perform public.notify(g.receiver_id, g.space_id, 'partner_activity',
        coalesce(nullif(who, '') || '님이', '파트너가') || ' ' || array_length(quiet, 1) || '가지를 바꿨어요',
        left(public.partner_change_line(quiet[1].topic, quiet[1].field, quiet[1].noun, quiet[1].before_v, quiet[1].after_v) || ' 외 ' || (array_length(quiet, 1) - 1) || '개', 200),
        quiet[1].target, null, g.actor_id, 'pc:' || g.first_id || ':week');
      cnt := cnt + 1;
    end if;
  end loop;
  return cnt;
end;
$function$
;

-- 값 → 원래 값 jsonb(없으면 JSON null)
create function public.raw_of(v anyelement) returns jsonb language sql immutable set search_path = '' as $$
  select coalesce(to_jsonb(v), 'null'::jsonb);
$$;
revoke all on function public.raw_of(anyelement) from public, anon, authenticated;

-- ─────────────────────────── 2. 원래 값을 남기는 기록 ───────────────────────────
create or replace function public.goal_partner_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t text;
begin
  t := '/salary/items/' || new.id;
  -- 주인이 바뀌는 것은 관리 방식 바꾸기(set_salary_mode)뿐이라 그 알림으로 충분
  if tg_op = 'UPDATE' and new.owner_user_id is distinct from old.owner_user_id then
    return null;
  end if;
  if coalesce(new.owner_user_id, old.owner_user_id) is not null and not (
       new.visibility = 'all'
       and exists (select 1 from public.couple_space c where c.id = new.space_id and c.salary_mode = 'joint')) then
    return null;
  end if;
  if tg_op = 'INSERT' then
    perform public.log_partner_change(new.space_id, 'goal_meta', new.id, 'added', new.name, null, '1', false, t);
    return null;
  end if;
  if old.deleted_at is null and new.deleted_at is not null then
    perform public.log_partner_change(new.space_id, 'goal', new.id, 'deleted', new.name, null, '1', true, '/salary');
    return null;
  end if;
  if old.deleted_at is not null and new.deleted_at is null then
    perform public.log_partner_change(new.space_id, 'goal_meta', new.id, 'restored', new.name, null, '1', false, t);
    return null;
  end if;
  if new.closed_at is distinct from old.closed_at then
    perform public.log_partner_change(new.space_id, 'goal_meta', new.id, 'closed', new.name, null,
      case when new.closed_at is null then '0' else '1' end, false, t);
    return null;
  end if;
  -- 달성 상태로 바뀌는 것은 achieve_goal 알림으로
  if new.status is distinct from old.status and new.status = 'achieved' then
    return null;
  end if;
  -- 2026-11-13 PR 14 후속: 목표 금액·기한·이름은 돌리기용 원래 값도
  if new.target_amount is distinct from old.target_amount then
    perform public.log_partner_change(new.space_id, 'goal', new.id, 'amount', new.name,
      case when old.target_amount is not null then public.read_won(old.target_amount) end,
      case when new.target_amount is not null then public.read_won(new.target_amount) end, true, t,
      public.raw_of(old.target_amount), public.raw_of(new.target_amount));
  end if;
  if new.deadline is distinct from old.deadline then
    perform public.log_partner_change(new.space_id, 'goal', new.id, 'deadline', new.name,
      public.ym_label(old.deadline), public.ym_label(new.deadline), true, t,
      public.raw_of(old.deadline), public.raw_of(new.deadline));
  end if;
  if new.name is distinct from old.name then
    perform public.log_partner_change(new.space_id, 'goal_meta', new.id, 'name', new.name, old.name, new.name, false, t,
      public.raw_of(old.name), public.raw_of(new.name));
  end if;
  return null;
end;
$$;

create or replace function public.care_partner_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.secret or new.auto is not null then
    return null;
  end if;
  if tg_op = 'INSERT' then
    perform public.log_partner_change(new.space_id, 'care', new.id, 'added', new.name, null, '1', false, '/calendar/day/' || new.id);
  elsif new.memo is distinct from old.memo and new.deleted_at is null then
    perform public.log_partner_change(new.space_id, 'care', new.id, 'memo', new.name, old.memo, new.memo, false,
      '/calendar/day/' || new.id, public.raw_of(old.memo), public.raw_of(new.memo));
  end if;
  return null;
end;
$$;

create or replace function public.log_split_changes(p_split uuid, p_old jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  sp public.salary_split;
  r record;
begin
  select * into sp from public.salary_split where id = p_split;
  if sp.owner_user_id is not null then
    return;
  end if;
  for r in
    with o as (
      select (x->>'kind')::public.split_line_kind as kind, (x->>'goal_id')::uuid as goal_id, (x->>'user_id')::uuid as user_id,
        x->>'name' as name, sum((x->>'amount')::bigint)::bigint as amount
      from jsonb_array_elements(coalesce(p_old, '[]'::jsonb)) x
      group by 1, 2, 3, 4
    ),
    n as (
      select kind, goal_id, user_id, name, sum(amount)::bigint as amount
      from public.split_line where split_id = p_split and kind <> 'send' group by 1, 2, 3, 4
    )
    select coalesce(n.kind, o.kind) as kind, coalesce(n.goal_id, o.goal_id) as goal_id,
      coalesce(n.user_id, o.user_id) as user_id, coalesce(n.name, o.name) as name,
      o.amount as before_amount, n.amount as after_amount
    from o full join n
      on n.kind = o.kind and n.goal_id is not distinct from o.goal_id
      and n.user_id is not distinct from o.user_id and n.name is not distinct from o.name
  loop
    continue when coalesce(r.before_amount, 0) = coalesce(r.after_amount, 0);
    -- 2026-11-13 PR 14 후속: 줄이 있다가 금액만 바뀐 것은 돌리기용 원래 금액도(줄 추가·삭제는 돌리지 않음)
    perform public.log_partner_change(sp.space_id, 'split', p_split,
      r.kind || ':' || coalesce(r.goal_id::text, '') || ':' || coalesce(r.user_id::text, '') || ':' || coalesce(r.name, ''),
      public.pay_line_noun(r.kind, r.goal_id, r.name)
        || case when r.kind = 'allowance' and r.user_id is not null and sp.owner_user_id is null
             then '(' || coalesce((select nickname from public.app_user where id = r.user_id), '') || ')' else '' end,
      public.read_won(coalesce(r.before_amount, 0)), public.read_won(coalesce(r.after_amount, 0)), true, '/salary?view=plan',
      case when r.before_amount is not null and r.after_amount is not null then to_jsonb(r.before_amount) end,
      case when r.before_amount is not null and r.after_amount is not null then to_jsonb(r.after_amount) end);
  end loop;
end;
$$;

-- ─────────────────────────── 3·4. 알림 묶음과 돌릴 수 있는지 ───────────────────────────

-- 지금 값(원래 값과 같은 모양). 항목이 없거나 같이 쓰지 않으면 SQL null
create function public.partner_change_now(p_space uuid, p_topic text, p_ref uuid, p_field text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  g public.goal;
  joint boolean := exists (select 1 from public.couple_space where id = p_space and salary_mode = 'joint');
  k text[];
  n integer;
  amt bigint;
begin
  if p_topic in ('goal', 'goal_meta') then
    select * into g from public.goal where id = p_ref and space_id = p_space and deleted_at is null;
    if g.id is null or (g.owner_user_id is not null and not (joint and g.visibility = 'all')) then
      return null;
    end if;
    return case
      when p_topic = 'goal' and p_field = 'amount' then public.raw_of(g.target_amount)
      when p_topic = 'goal' and p_field = 'deadline' then public.raw_of(g.deadline)
      when p_topic = 'goal_meta' and p_field = 'name' then public.raw_of(g.name) end;
  elsif p_topic = 'split' then
    if not exists (select 1 from public.salary_split where id = p_ref and space_id = p_space and owner_user_id is null) then
      return null;
    end if;
    k := string_to_array(p_field, ':');
    select count(*), sum(amount) into n, amt from public.split_line l
      where l.split_id = p_ref and l.kind::text = k[1]
        and l.goal_id is not distinct from nullif(k[2], '')::uuid
        and l.user_id is not distinct from nullif(k[3], '')::uuid
        and l.name is not distinct from nullif(array_to_string(k[4:], ':'), '');
    if n <> 1 then
      return null;
    end if;
    -- 남의 용돈 줄은 주인(또는 한 사람 관리형 관리하는 사람)만
    if k[1] = 'allowance' and not public.allowance_editable(p_space, nullif(k[3], '')::uuid) then
      return null;
    end if;
    return to_jsonb(amt);
  elsif p_topic = 'care' and p_field = 'memo' then
    return (select public.raw_of(c.memo) from public.care_day c
            where c.id = p_ref and c.space_id = p_space and c.deleted_at is null and not c.secret and c.auto is null);
  end if;
  return null;
end;
$$;
revoke all on function public.partner_change_now(uuid, text, uuid, text) from public, anon, authenticated;

-- 알림 하나의 변경 묶음(같은 topic·ref·field는 하나로) + 지금 돌릴 수 있는지. 내 알림만
create function public.partner_change_group(p_notification uuid)
returns table (topic text, ref_id uuid, field text, noun text, target text, before_raw jsonb, after_raw jsonb,
               ids bigint[], space_id uuid, actor_id uuid, created_at timestamptz, ok boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  n public.notification;
  first_id bigint;
  urgent_ boolean;
  base public.partner_change;
  live boolean;
begin
  select * into n from public.notification x
    where x.id = p_notification and x.user_id = uid and x.kind in ('partner_change', 'partner_activity')
      and x.dedupe ~ '^pc:[0-9]+:(now|week)$';
  if n.id is null then
    return;
  end if;
  first_id := split_part(n.dedupe, ':', 2)::bigint;
  urgent_ := split_part(n.dedupe, ':', 3) = 'now';
  select * into base from public.partner_change where id = first_id and receiver_id = uid;
  if base.id is null then
    return;
  end if;
  live := exists (select 1 from public.app_user u join public.couple_space s on s.id = u.space_id
                  where u.id = uid and u.space_id = base.space_id and u.status = 'active' and s.couple_state = 'connected');
  return query
    with r as (
      select c.* from public.partner_change c
      where c.actor_id = base.actor_id and c.receiver_id = uid and c.sent_at = base.sent_at and c.urgent = urgent_
        and c.id >= first_id
    ),
    g as (
      select r.topic, r.ref_id, r.field,
        (array_agg(r.noun order by r.id desc))[1] as noun,
        (array_agg(r.target order by r.id desc))[1] as target,
        (array_agg(r.before_raw order by r.id))[1] as before_raw,
        (array_agg(r.after_raw order by r.id desc))[1] as after_raw,
        array_agg(r.id order by r.id) as ids,
        bool_and(r.before_raw is not null and r.after_raw is not null) as raw_ok,
        bool_or(r.reverted_at is not null) as reverted,
        max(r.id) as last_id, min(r.created_at) as created_at
      from r group by r.topic, r.ref_id, r.field
    )
    select g.topic, g.ref_id, g.field, g.noun, g.target, g.before_raw, g.after_raw, g.ids, base.space_id, base.actor_id,
      g.created_at,
      live and g.raw_ok and not g.reverted and g.before_raw is distinct from g.after_raw
        and not exists (select 1 from public.partner_change x
                        where x.topic = g.topic and x.ref_id is not distinct from g.ref_id and x.field = g.field and x.id > g.last_id)
        and public.partner_change_now(base.space_id, g.topic, g.ref_id, g.field) = g.after_raw
    from g;
end;
$$;
revoke all on function public.partner_change_group(uuid) from public, anon, authenticated;

create function public.revertible_notifications()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select n.id from public.notification n
  where n.user_id = auth.uid() and n.kind in ('partner_change', 'partner_activity')
    and n.dedupe ~ '^pc:[0-9]+:(now|week)$' and n.created_at > now() - interval '90 days'
    and exists (select 1 from public.partner_change_group(n.id) g where g.ok);
$$;
revoke all on function public.revertible_notifications() from public, anon;
grant execute on function public.revertible_notifications() to authenticated;

-- ─────────────────────────── 5. 돌리기 ───────────────────────────
create function public.revert_partner_change(p_notification uuid)
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  g record;
  cnt integer := 0;
  actor uuid;
  sid uuid;
  first_noun text;
  first_target text;
  old_lines jsonb;
  k text[];
  who text := (select nickname from public.app_user where id = auth.uid());
begin
  if not exists (select 1 from public.notification where id = p_notification and user_id = uid) then
    raise exception 'no_notification' using errcode = '42501';
  end if;
  for g in select * from public.partner_change_group(p_notification) x where x.ok order by x.ids[1] loop
    actor := g.actor_id;
    sid := g.space_id;
    first_noun := coalesce(first_noun, g.noun);
    first_target := coalesce(first_target, g.target);
    if g.topic = 'goal' and g.field = 'amount' then
      update public.goal set target_amount = (g.before_raw #>> '{}')::bigint, version = version + 1,
          updated_at = now(), updated_by = uid
        where id = g.ref_id;
      perform public.goal_auto_achieve(g.ref_id);
      perform public.saving_unachieve(g.ref_id);
    elsif g.topic = 'goal' and g.field = 'deadline' then
      update public.goal set deadline = (g.before_raw #>> '{}')::date, version = version + 1,
          updated_at = now(), updated_by = uid
        where id = g.ref_id;
    elsif g.topic = 'goal_meta' and g.field = 'name' then
      update public.goal set name = g.before_raw #>> '{}', version = version + 1, updated_at = now(), updated_by = uid
        where id = g.ref_id;
    elsif g.topic = 'split' then
      k := string_to_array(g.field, ':');
      select jsonb_agg(jsonb_build_object('kind', kind, 'goal_id', goal_id, 'user_id', user_id, 'name', name, 'amount', amount))
        into old_lines from public.split_line where split_id = g.ref_id and kind <> 'send';
      update public.split_line l set amount = (g.before_raw #>> '{}')::bigint
        where l.split_id = g.ref_id and l.kind::text = k[1]
          and l.goal_id is not distinct from nullif(k[2], '')::uuid
          and l.user_id is not distinct from nullif(k[3], '')::uuid
          and l.name is not distinct from nullif(array_to_string(k[4:], ':'), '');
      update public.salary_split set version = version + 1, updated_at = now(), updated_by = uid where id = g.ref_id;
      perform public.log_split_changes(g.ref_id, old_lines);
      perform public.sync_checklist(g.ref_id);
      if k[1] = 'allowance' then
        perform public.notify_my_allowance(sid, nullif(k[3], '')::uuid);
      end if;
    elsif g.topic = 'care' and g.field = 'memo' then
      update public.care_day set memo = g.before_raw #>> '{}', version = version + 1, updated_at = now(), updated_by = uid
        where id = g.ref_id;
    else
      continue;
    end if;
    update public.partner_change set reverted_at = now(), reverted_by = uid where id = any (g.ids);
    cnt := cnt + 1;
  end loop;
  if cnt = 0 then
    raise exception 'not_revertible' using errcode = '22023';
  end if;
  -- 돌리면서 내가 남긴 변경 기록은 아래 한 건으로 대신 알림(같은 알림 두 번 막음, 활동·주간 요약에는 그대로 셈)
  update public.partner_change set sent_at = now()
    where actor_id = uid and sent_at is null and created_at = now();
  perform public.notify(actor, sid, 'partner_change',
    coalesce(nullif(who, ''), '파트너') || '님이 이전 값으로 돌렸어요', -- [확인 필요] 14 v2.2 R-08
    first_noun || case when cnt > 1 then ' 외 ' || (cnt - 1) || '개' else '' end,
    coalesce(first_target, '/'), null, uid, 'pcr:' || p_notification);
  return cnt;
end;
$$;
revoke all on function public.revert_partner_change(uuid) from public, anon;
grant execute on function public.revert_partner_change(uuid) to authenticated;
