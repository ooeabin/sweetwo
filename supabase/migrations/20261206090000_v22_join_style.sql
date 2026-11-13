-- v2.2 PR 8(온보딩·합류)에 필요한 서버 보완(ADR 0009 결정 6·8-1, docs/spec/18 v2.2). 스키마는 추가만.
--
-- ■ 계약
--  1. 합류 전 O-30c ‘파트너가 주로 해요’: 관리하는 사람은 아직 없으니 couple_space.manager_pending_partner = true로 기억하고
--     엔진은 합쳐서(관리하는 사람 없음)로 둔다. 이름(my_manage_style.style)은 ‘한 사람이 관리해요’(one_manager).
--     합류를 마치는 순간(complete_join, finish_join) 합류한 사람이 관리하는 사람이 되고 기억은 지운다.
--     다른 답으로 바꾸면(request_mode_change가 바로 적용될 때마다) 다시 계산해 지운다.
--  2. join_context에 관리 형태를 더한다(합류를 마치기 전에는 공간을 못 읽음, P-04 형태 이름 확인):
--     shared_living, shared_saving, style(my_manage_style과 같은 이름 코드),
--     has_plan은 줄이 있는 월급 계획만(관리 형태를 고르며 생긴 빈 공동 월급 계획은 없는 것으로),
--     manager = 'starter'(시작한 사람이 관리) | 'joiner'(합류한 사람이 관리, 위 1번) | null.
--  4. 온보딩 중 답(O-30·O-30b·O-30c, 시작한 사람이 아직 온보딩을 마치지 않음)은 파트너가 먼저 합류했어도 수락 없이 바로
--     적용(대기 중인 상대에게 요청을 보내지 않음). 온보딩을 마친 뒤 S-11f·P-04 요청은 그대로(08 4-1 가).
--  3. 대기 화면 ‘알려 주기’ nudge_starter(): 같이 계열 공간에 합류를 마쳤는데 시작한 사람 월급 계획이 아직 없을 때만
--     시작한 사람에게 알림 “{이름}님이 기다리고 있어요. 월급 계획을 마쳐 주세요” [확인 필요] 1건, 24시간에 1번.
--     'sent' | 'too_soon' | 'not_waiting'.
--
-- 지금 안 쓰게 된 것(2단계 정리 대상): set_join_salary_mode(옛 P-04 관리 방식 바꾸기, v2.2 P-04는 확인과 요청만).

alter table public.couple_space
  add column manager_pending_partner boolean not null default false;
comment on column public.couple_space.manager_pending_partner is
  'O-30c 합류 전 ‘파트너가 주로 해요’: 합류를 마치면 합류한 사람이 관리하는 사람(계약 1)';

-- 계약 1: 지금 공간의 형태 이름(합류 전 ‘파트너가 주로’도 한 사람 관리형)
create or replace function public.my_manage_style()
returns table(salary_mode public.salary_mode, manager_user_id uuid, shared_living boolean, shared_saving boolean, style text)
language sql stable security definer set search_path = '' as $$
  select s.salary_mode, s.manager_user_id, s.shared_living, s.shared_saving,
    case
      when s.salary_mode = 'joint' and (s.manager_user_id is not null or s.manager_pending_partner) then 'one_manager'
      when s.salary_mode = 'joint' then 'together'
      when coalesce(s.shared_living, false) and coalesce(s.shared_saving, false) then 'living_saving'
      when coalesce(s.shared_living, false) then 'living_only'
      when coalesce(s.shared_saving, false) then 'saving_only'
      else 'separate' end
  from public.couple_space s
  join public.app_user u on u.space_id = s.id and u.id = auth.uid();
$$;

-- 계약 1: 20261202090000과 같고, 바로 적용할 때 ‘파트너가 주로’ 기억만 더함
create or replace function public.request_mode_change(p_shared_living boolean, p_shared_saving boolean, p_manager text,
  p_phrase text default 's11f_combine')
returns text language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  me public.app_user;
  sp public.couple_space;
  other uuid;
  r record;
  mgr uuid;
  needs boolean;
  rid uuid;
  who text;
begin
  select * into me from public.app_user where id = uid;
  if me.space_id is null then
    raise exception 'no_space' using errcode = '42501';
  end if;
  select * into sp from public.couple_space where id = me.space_id for update;
  if sp.couple_state = 'unlink_pending' then
    raise exception 'unlink_pending' using errcode = '42501';
  end if;
  if p_phrase not in ('p04_send', 's11f_combine', 's11f_manager') then
    raise exception 'bad_phrase' using errcode = '22023';
  end if;
  select * into r from public.resolve_manage_style(p_shared_living, p_shared_saving, p_manager);
  select id into other from public.app_user where space_id = sp.id and status = 'active' and id <> uid limit 1;
  if r.manager = 'partner' and other is null then
    -- 합류 전 ‘파트너가 주로 해요’: 관리하는 사람은 합류할 때 정해짐(계약 1)
    mgr := null;
  else
    mgr := case r.manager when 'me' then uid when 'partner' then other end;
  end if;
  -- 계약 4: 온보딩을 마치기 전(시작한 사람이 O-30을 답하는 중 파트너가 먼저 합류)은 수락 없이 바로
  needs := coalesce(me.onboarding_done_at is not null and sp.couple_state = 'connected' and other is not null and (
    (sp.salary_mode = 'separate' and r.salary_mode = 'joint')
    or (r.salary_mode = 'joint' and mgr is not distinct from other and sp.manager_user_id is distinct from other)), false);
  if not needs then
    update public.mode_change_request set status = 'cancelled', answered_at = now()
      where space_id = sp.id and status = 'open';
    perform public.apply_manage_style(sp.id, p_shared_living, p_shared_saving, r.salary_mode, mgr);
    update public.couple_space set manager_pending_partner = coalesce(r.manager = 'partner' and other is null, false)
      where id = sp.id;
    if other is not null and sp.couple_state = 'connected' and sp.salary_mode = r.salary_mode then
      perform public.notify(other, sp.id, 'salary_mode',
        coalesce(me.nickname || '님이', '파트너가') || ' 관리 방식을 바꿨어요', null, -- [확인 필요]
        '/settings/couple/style', 'arrows-clockwise', uid, 'style:' || sp.id || ':' || extract(epoch from now())::bigint);
    end if;
    return 'applied';
  end if;
  update public.mode_change_request set status = 'cancelled', answered_at = now()
    where space_id = sp.id and status = 'open';
  insert into public.mode_change_request (space_id, from_user, to_mode, to_manager, to_shared_living, to_shared_saving, phrase)
    values (sp.id, uid, r.salary_mode, mgr, p_shared_living, p_shared_saving, p_phrase)
    returning id into rid;
  who := coalesce(me.nickname || '님이', '파트너가');
  perform public.notify(other, sp.id, 'mode_request',
    case p_phrase
      when 'p04_send' then who || ' 월급은 대부분 ' || coalesce((select nickname from public.app_user where id = other) || '님에게', '나에게')
        || ' 보낸다고 했어요' -- [확인 필요] 4-3 3번
      when 's11f_manager' then who || ' 관리를 맡아 달라고 해요' -- [확인 필요]
      else who || ' 월급을 합쳐서 관리하자고 해요' end, -- [확인 필요] 4-3 3번
    null, '/settings/couple/style/request/' || rid, 'arrows-clockwise', uid, 'mode_request:' || rid);
  return 'requested';
end;
$$;

-- 계약 1: 합류를 마치는 순간 ‘파트너가 주로’면 합류한 사람이 관리하는 사람(보내기 줄은 recalc_send_line이 만듦)
create function public.claim_pending_manager(p_space uuid, p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.couple_space set manager_user_id = p_user, manager_pending_partner = false
    where id = p_space and manager_pending_partner and salary_mode = 'joint';
  if found then
    perform public.recalc_send_line(p_space);
  end if;
end;
$$;
revoke all on function public.claim_pending_manager(uuid, uuid) from public, anon, authenticated;

-- 합류 완료(18 P-05b 저장). 20261119090000과 같고 계약 1만 더함
create or replace function public.complete_join(p_lines jsonb default null, p_version integer default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid uuid := public.joining_space();
  mode public.salary_mode;
  v integer;
begin
  perform public._accept_join(sid);
  perform public.claim_pending_manager(sid, uid);
  select salary_mode into mode from public.couple_space where id = sid;
  if p_lines is not null then
    if mode = 'joint' then
      select version into v from public.salary_split where space_id = sid and owner_user_id is null;
      if p_version is not null and v is distinct from p_version then
        raise exception 'split_changed' using errcode = '40001';
      end if;
      perform public.save_split(p_lines, null);
      perform public.start_checklist(null);
    else
      perform public.save_split(p_lines, uid);
      perform public.start_checklist(uid);
    end if;
  end if;
  update public.couple_space set couple_state = 'connected' where id = sid and couple_state = 'not_joined';
  update public.invite set used_at = coalesce(used_at, now()) where space_id = sid and used_by = uid;
  update public.app_user
    set onboarding_step = case when p_lines is null then 'P-WAIT' else 'P-06' end,
        onboarding_done_at = coalesce(onboarding_done_at, now())
    where id = uid;
  update public.asset set owner_user_id = uid
    where space_id = sid and owner = 'person' and owner_user_id is null and created_by <> uid;
end;
$$;

-- 월급 계획 없이 합류만 마침(P-05 ‘월급 없이 합류할게요’, 테스트). 20261119090000과 같고 계약 1만 더함
create or replace function public.finish_join()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid uuid := public.joining_space();
begin
  perform public._accept_join(sid);
  perform public.claim_pending_manager(sid, uid);
  update public.couple_space set couple_state = 'connected' where id = sid and couple_state = 'not_joined';
  update public.invite set used_at = coalesce(used_at, now()) where space_id = sid and used_by = uid;
  update public.app_user set onboarding_step = 'P-11', onboarding_done_at = coalesce(onboarding_done_at, now())
    where id = uid;
  update public.asset set owner_user_id = uid
    where space_id = sid and owner = 'person' and owner_user_id is null and created_by <> uid;
end;
$$;

-- 계약 2: 20261119090000과 같고 관리 형태만 더함
create or replace function public.join_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid uuid;
  my uuid;
  s public.couple_space;
  starter public.app_user;
  until timestamptz;
  joint jsonb;
  sp public.salary_split;
begin
  if uid is null then
    return null;
  end if;
  select space_id into my from public.app_user where id = uid and status = 'active';
  if my is not null and exists (select 1 from public.invite i where i.space_id = my and i.used_by = uid) then
    sid := my;
  else
    select i.space_id, i.reserved_until into sid, until from public.invite i
      join public.couple_space x on x.id = i.space_id and x.deleted_at is null
      where i.reserved_by = uid and i.reserved_until > now() and i.used_at is null
      order by i.reserved_until desc limit 1;
  end if;
  if sid is null then
    return null;
  end if;
  select * into s from public.couple_space where id = sid;
  select * into starter from public.app_user where id = s.created_by;
  if s.salary_mode = 'joint' then
    select * into sp from public.salary_split where space_id = sid and owner_user_id is null;
    if sp.id is not null then
      joint := jsonb_build_object(
        'version', sp.version,
        'lines', coalesce((
          select jsonb_agg(jsonb_build_object('kind', l.kind, 'amount', l.amount, 'goal_id', l.goal_id,
                   'user_id', l.user_id, 'name', l.name) order by l.sort)
          from public.split_line l where l.split_id = sp.id and l.kind <> 'send'), '[]'::jsonb),
        'items', coalesce((
          select jsonb_agg(jsonb_build_object('id', g.id, 'target', g.target_amount, 'deadline', g.deadline,
                   'saved', public.goal_saved(g.id)) order by g.priority, g.created_at)
          from public.goal g where g.space_id = sid and g.deleted_at is null and g.closed_at is null), '[]'::jsonb));
    end if;
  end if;
  return jsonb_build_object(
    'space_id', sid,
    'member', my = sid,
    'reserved_until', until,
    'starter_id', starter.id,
    'starter_nickname', starter.nickname,
    'salary_mode', s.salary_mode,
    'shared_living', s.shared_living,
    'shared_saving', s.shared_saving,
    'manager', case
      when s.salary_mode <> 'joint' then null
      when s.manager_user_id = starter.id then 'starter'
      when s.manager_user_id = uid or s.manager_pending_partner then 'joiner' end,
    'style', case
      when s.salary_mode = 'joint' and (s.manager_user_id is not null or s.manager_pending_partner) then 'one_manager'
      when s.salary_mode = 'joint' then 'together'
      when coalesce(s.shared_living, false) and coalesce(s.shared_saving, false) then 'living_saving'
      when coalesce(s.shared_living, false) then 'living_only'
      when coalesce(s.shared_saving, false) then 'saving_only'
      else 'separate' end,
    -- 줄이 있는 월급 계획만(관리 형태를 고를 때 set_salary_mode가 만든 빈 공동 월급 계획은 아직 없는 것)
    'has_plan', exists (select 1 from public.salary_split x join public.split_line l on l.split_id = x.id
                        where x.space_id = sid and x.owner_user_id is distinct from uid),
    'prefill', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'amount', a.amount, 'estimated', a.estimated)
             order by a.created_at)
      from public.asset a
      where a.space_id = sid and a.owner = 'person' and a.owner_user_id is null and a.created_by <> uid
        and a.deleted_at is null), '[]'::jsonb),
    'joint', joint);
end;
$$;

-- 계약 3
create function public.nudge_starter()
returns text language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  me public.app_user;
  s public.couple_space;
begin
  select * into me from public.app_user where id = uid and status = 'active';
  select * into s from public.couple_space where id = me.space_id;
  if s.id is null or s.couple_state <> 'connected' or s.salary_mode <> 'joint' or s.created_by = uid
     or exists (select 1 from public.salary_split x join public.split_line l on l.split_id = x.id
                where x.space_id = s.id and l.kind <> 'send') then
    return 'not_waiting';
  end if;
  if exists (select 1 from public.notification n where n.user_id = s.created_by and n.kind = 'join_nudge'
             and n.created_at > now() - interval '24 hours') then
    return 'too_soon';
  end if;
  perform public.notify(s.created_by, s.id, 'join_nudge',
    coalesce(me.nickname || '님이', '파트너가') || ' 기다리고 있어요. 월급 계획을 마쳐 주세요', null, -- [확인 필요]
    '/', 'bell', uid, 'join_nudge:' || s.id || ':' || extract(epoch from now())::bigint);
  return 'sent';
end;
$$;
revoke all on function public.nudge_starter() from public, anon;
grant execute on function public.nudge_starter() to authenticated;
