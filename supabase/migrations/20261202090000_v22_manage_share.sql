-- v2.2 PR 3: 관리 형태·공개·월급 변경(ADR 0009 결정 6·7·8·8-1, 10, plan v2.2 2-5·6-1·6-2·6-3·9-2 PR 3). 스키마는 추가만.
--
-- ■ 계약(core가 같은 결과: manage-style.ts resolveManageStyle, share-view.ts, salary-change.ts, salary-split.ts 보내기)
--  1. 관리 형태(2-5 표) resolve_manage_style(shared_living, shared_saving, manager) → (salary_mode, manager, style)
--     manager 입력: 'me' | 'partner' | 'together' | 'each' | null(생활비 ‘아니요’면 묻지 않음, 무시)
--     | 생활비 | 저금   | 누가          | salary_mode | manager   | style          | 이름(앱)                    |
--     | true   | 상관없음 | me/partner  | joint       | 그대로     | one_manager    | 한 사람이 관리해요           |
--     | true   | 상관없음 | together    | joint       | null      | together       | 합쳐서 관리해요              |
--     | true   | true   | each        | separate    | null      | living_saving  | 생활비와 저금을 같이 해요     |
--     | true   | false  | each        | separate    | null      | living_only    | 생활비만 같이 해요           |
--     | false  | true   | (무시)       | separate    | null      | saving_only    | 저금만 같이 해요             |
--     | false  | false  | (무시)       | separate    | null      | separate       | 각자 따로 해요               |
--     생활비 true인데 manager가 없으면 'need_manager' 오류. 화면 규칙은 salary_mode와 manager_user_id만 본다.
--     저장: couple_space.shared_living, shared_saving(null = 아직 안 고름), manager_user_id.
--     옮기기(스테이징): 각자 → 생활비 false·저금 false, 합쳐서 → 생활비 true·저금 null·관리하는 사람 없음(둘이 같이).
--  2. 바꾸기 request_mode_change(...) → 'applied' | 'requested'(D7):
--     상대 수락이 필요한 것 = 연결된 공간에서 (가) 각자 → 합쳐서, (나) 관리하는 사람을 ‘상대’로(상대에게 일을 넘김).
--     그 밖(합쳐서 → 각자, 각자 안 이름만, 합쳐서 안에서 관리하는 사람을 나로·없음으로)은 바로 적용 + 상대 알림.
--     연결 전(혼자)은 늘 바로. 요청은 7일, 공간마다 열린 요청 1개(새 요청이 옛 요청을 대신함). 거절·만료·취소면 그대로.
--  3. 공개 단계(app_user.plan_share, 기본 saving_only, 각자 계열에서만 뜻이 있음. 같이 계열 = 모두 보임):
--     all = 수입·월급날·모든 줄 금액 / saving_only = 저금·같이 쓰는 통장 줄 금액만(수입·지출 줄 없음)
--     / done_only = 저금 줄 이름 + 이번 달 확인 여부만(금액 없음). 연결 해제 대기면 상대 것은 모두 가림.
--     서버 필터 하나 = partner_plan_view(p_viewer)(S-13p 미리 보기는 주인이 p_viewer = 상대로 부름).
--     같은 규칙을 RLS로도: split_line, pay_check_line 읽기(plan_row_visible), partner_profile 수입 열.
--     저금 항목(goal)마다의 공개 열(goal.visibility)은 새 코드에서 읽지 않음(2단계 정리 대상).
--  4. 한 사람 관리형(합쳐서 + manager_user_id) 보내기(G9): 관리하지 않는 사람마다 공동 월급 계획에 kind send 줄 하나,
--     금액 = 1만 원 단위 내림(max(0, 그 사람 monthly_income − 그 사람 용돈 줄 금액)). 서버만 계산(recalc_send_line),
--     앱 직접 저장 거절('send_locked'). 새 보내기 줄은 자동 줄(auto_pay), 나가는 날 = 그 사람 월급날(말일 = 31).
--     용돈 줄은 주인만 고침(B7), 한 사람 관리형이면 관리하는 사람도 관리하지 않는 쪽 용돈을 고치고 주인에게
--     my_allowance 알림 “{이름}님이 내 용돈을 바꿨어요”(금액 없음).
--  5. 날짜를 정한 월급 변경(G12) salary_change: effective_from·until_month는 그 달 1일.
--     적용일 = 그 달의 그 사람 사이클 시작일(cycle_date(월급날, 그 달), 날짜 없음은 1일). 적용일이 오늘 이전이면 바로.
--     적용하면 revert_amount = 바꾸기 전 monthly_income, monthly_income = amount.
--     until_month가 있으면 그다음 달 사이클 시작일에 revert_amount로 되돌림(reverted_at).
--     같은 사람의 아직 적용 안 한 변경은 새 변경의 시작 달 이후 것이 취소됨. 적용한 변경은 취소 못 함.
--     순서: run_cycle_checklists(00:00 KST)가 먼저 apply_salary_changes(오늘)를 부른 뒤 목록을 만든다
--     (pg_cron apply-salary-changes 00:01은 놓친 것 다시 돌리기).
--  6. 알림 프라이버시(B8): 각자 계열 월급 계획·월급 금액 변경은 상대에게 알리지 않음, 같이 계열 월급 변경은 금액 없이.
--     푸시(잠금 화면) 본문에 금액이 있을 수 있는 종류는 본문을 빼고 보냄(noti_push_body_hidden).
--     인앱만(푸시 없음) 종류: salary_changed, mode_result(noti_inapp_only).
--  7. 홈 띠 닫기 dismiss_home_task(key, state): home_task_state(user_id, task_key) 하나, 본인만 읽음.
--
-- 지금 안 쓰게 된 것(2단계 정리 대상): goal.visibility(저금마다 공개), app_user.default_visibility(자산 공개 기본,
--   새 열 asset_share_default로 대신, PR 5).

-- ─────────────────────────────── 열 ───────────────────────────────
alter table public.couple_space
  add column shared_living boolean,
  add column shared_saving boolean,
  add column manager_user_id uuid references auth.users (id) on delete set null;
update public.couple_space set
  shared_living = salary_mode = 'joint',
  shared_saving = case when salary_mode = 'joint' then null else false end;
comment on column public.couple_space.shared_living is 'O-30 같이 쓰는 생활비(null = 아직 안 고름). 권유·이름에만';
comment on column public.couple_space.shared_saving is 'O-30b 같이 모으는 저금(null = 안 고름). 권유·이름에만';
comment on column public.couple_space.manager_user_id is 'O-30c 한 사람 관리형의 관리하는 사람(합쳐서일 때만)';

alter table public.app_user
  add column plan_share public.plan_share not null default 'saving_only',
  add column asset_share_default public.asset_visibility,
  add column rank_consent boolean not null default false,
  add column rank_badge_home boolean not null default false,
  add column last_reconciled_at timestamptz;
comment on column public.app_user.plan_share is '각자 계열 내 월급 계획 공개(S-13): all, saving_only(기본), done_only';
comment on column public.app_user.asset_share_default is '자산 공개 첫 선택(G2), null = 아직 안 고름(PR 5)';
comment on column public.app_user.rank_consent is '자산 순위 같이 보기 동의(G3, PR 5)';
comment on column public.app_user.last_reconciled_at is '마지막 잔액 맞추기(G7, PR 4)';
grant update (plan_share, asset_share_default, rank_badge_home) on public.app_user to authenticated;

-- ─────────────────────────── 관리 형태 ───────────────────────────
-- 계약 1
create function public.resolve_manage_style(p_shared_living boolean, p_shared_saving boolean, p_manager text)
returns table(salary_mode public.salary_mode, manager text, style text)
language plpgsql immutable set search_path = '' as $$
begin
  if p_shared_living is null then
    raise exception 'need_living' using errcode = '22023';
  end if;
  if p_shared_living then
    if p_manager in ('me', 'partner') then
      return query select 'joint'::public.salary_mode, p_manager, 'one_manager'::text;
    elsif p_manager = 'together' then
      return query select 'joint'::public.salary_mode, null::text, 'together'::text;
    elsif p_manager = 'each' then
      return query select 'separate'::public.salary_mode, null::text,
        case when coalesce(p_shared_saving, false) then 'living_saving' else 'living_only' end;
    else
      raise exception 'need_manager' using errcode = '22023';
    end if;
  else
    return query select 'separate'::public.salary_mode, null::text,
      case when coalesce(p_shared_saving, false) then 'saving_only' else 'separate' end;
  end if;
end;
$$;

-- 지금 공간의 형태 이름(manager는 ‘나’ 기준)
create function public.my_manage_style()
returns table(salary_mode public.salary_mode, manager_user_id uuid, shared_living boolean, shared_saving boolean, style text)
language sql stable security definer set search_path = '' as $$
  select s.salary_mode, s.manager_user_id, s.shared_living, s.shared_saving,
    case
      when s.salary_mode = 'joint' and s.manager_user_id is not null then 'one_manager'
      when s.salary_mode = 'joint' then 'together'
      when coalesce(s.shared_living, false) and coalesce(s.shared_saving, false) then 'living_saving'
      when coalesce(s.shared_living, false) then 'living_only'
      when coalesce(s.shared_saving, false) then 'saving_only'
      else 'separate' end
  from public.couple_space s
  join public.app_user u on u.space_id = s.id and u.id = auth.uid();
$$;
grant execute on function public.my_manage_style() to authenticated;

create table public.mode_change_request (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.couple_space (id) on delete cascade,
  from_user uuid not null references auth.users (id) on delete cascade,
  to_mode public.salary_mode not null,
  to_manager uuid references auth.users (id) on delete cascade,
  to_shared_living boolean not null,
  to_shared_saving boolean,
  phrase text not null check (phrase in ('p04_send', 's11f_combine', 's11f_manager')),
  status text not null default 'open' check (status in ('open', 'accepted', 'declined', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  answered_at timestamptz
);
create index mode_change_request_space_idx on public.mode_change_request (space_id);
create unique index mode_change_request_open on public.mode_change_request (space_id) where status = 'open';
alter table public.mode_change_request enable row level security;
create policy mode_change_request_select on public.mode_change_request for select to authenticated
  using (public.is_space_member(space_id));
create policy mode_change_request_insert on public.mode_change_request for insert to authenticated with check (false);
create policy mode_change_request_update on public.mode_change_request for update to authenticated using (false);
create policy mode_change_request_delete on public.mode_change_request for delete to authenticated using (false);
alter publication supabase_realtime add table public.mode_change_request;

-- 바로 적용(내부): 공간 열 + 엔진(set_salary_mode, 부르는 사람 = auth.uid())
create function public.apply_manage_style(p_space uuid, p_living boolean, p_saving boolean,
  p_mode public.salary_mode, p_manager uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  cur public.salary_mode := (select salary_mode from public.couple_space where id = p_space);
begin
  -- 한 사람 관리형을 떠나면 보내기 줄을 먼저 지움(set_salary_mode가 줄을 나눌 때 섞이지 않게)
  if p_manager is null or p_mode <> 'joint' then
    delete from public.split_line l using public.salary_split s
      where s.id = l.split_id and s.space_id = p_space and l.kind = 'send';
  end if;
  update public.couple_space set shared_living = p_living, shared_saving = p_saving,
    manager_user_id = case when p_mode = 'joint' then p_manager end
    where id = p_space;
  if cur is distinct from p_mode then
    perform public.set_salary_mode(p_mode);
  end if;
  perform public.recalc_send_line(p_space);
end;
$$;
revoke all on function public.apply_manage_style(uuid, boolean, boolean, public.salary_mode, uuid) from public, anon, authenticated;

-- 계약 2
create function public.request_mode_change(p_shared_living boolean, p_shared_saving boolean, p_manager text,
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
    -- 합류 전 ‘파트너가 주로 해요’: 관리하는 사람은 합류할 때 정해짐(지금은 관리하는 사람 없음으로 둠)
    mgr := null;
  else
    mgr := case r.manager when 'me' then uid when 'partner' then other end;
  end if;
  needs := coalesce(sp.couple_state = 'connected' and other is not null and (
    (sp.salary_mode = 'separate' and r.salary_mode = 'joint')
    or (r.salary_mode = 'joint' and mgr is not distinct from other and sp.manager_user_id is distinct from other)), false);
  if not needs then
    update public.mode_change_request set status = 'cancelled', answered_at = now()
      where space_id = sp.id and status = 'open';
    perform public.apply_manage_style(sp.id, p_shared_living, p_shared_saving, r.salary_mode, mgr);
    -- 연결된 상대에게 알림(salary_mode가 바뀌면 set_salary_mode가 이미 알림)
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
grant execute on function public.request_mode_change(boolean, boolean, text, text) to authenticated;

-- 답: 'accepted' | 'declined' | 'expired'(만료면 그대로, 상태만 expired)
create function public.answer_mode_change(p_request uuid, p_accept boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  q public.mode_change_request;
  who text := (select nickname from public.app_user where id = auth.uid());
begin
  select * into q from public.mode_change_request where id = p_request for update;
  if q.id is null or not public.is_space_member(q.space_id) or q.from_user = uid then
    raise exception 'not_found' using errcode = '42501';
  end if;
  if q.status <> 'open' then
    raise exception 'not_open' using errcode = '22023';
  end if;
  if q.expires_at < now() then
    update public.mode_change_request set status = 'expired' where id = q.id;
    return 'expired';
  end if;
  if (select couple_state from public.couple_space where id = q.space_id) <> 'connected' then
    raise exception 'unlink_pending' using errcode = '42501';
  end if;
  update public.mode_change_request set status = case when p_accept then 'accepted' else 'declined' end, answered_at = now()
    where id = q.id;
  if p_accept then
    perform public.apply_manage_style(q.space_id, q.to_shared_living, q.to_shared_saving, q.to_mode, q.to_manager);
  end if;
  perform public.notify(q.from_user, q.space_id, 'mode_result',
    case when p_accept then coalesce(who || '님이', '파트너가') || ' 좋다고 했어요' -- [확인 필요]
         else '지금처럼 각자 관리해요' end, -- [확인 필요] 7-2
    null, '/settings/couple/style', 'arrows-clockwise', uid, 'mode_result:' || q.id);
  return case when p_accept then 'accepted' else 'declined' end;
end;
$$;
grant execute on function public.answer_mode_change(uuid, boolean) to authenticated;

create function public.cancel_mode_change(p_request uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.mode_change_request set status = 'cancelled', answered_at = now()
    where id = p_request and from_user = auth.uid() and status = 'open';
  if not found then
    raise exception 'not_found' using errcode = '42501';
  end if;
  delete from public.notification where dedupe = 'mode_request:' || p_request::text;
end;
$$;
grant execute on function public.cancel_mode_change(uuid) to authenticated;

-- ─────────────────────────── 공개 단계 ───────────────────────────
-- 계약 3: 이 사람(p_owner)의 월급 계획 줄(kind)을 지금 사용자가 볼 수 있나
create function public.plan_row_visible(p_space uuid, p_owner uuid, p_kind public.split_line_kind)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_owner is null or p_owner = auth.uid() or exists (
    select 1 from public.couple_space s join public.app_user o on o.id = p_owner
    where s.id = p_space and s.couple_state <> 'unlink_pending'
      and (s.salary_mode = 'joint' or o.plan_share = 'all'
        or (o.plan_share = 'saving_only' and p_kind in ('saving', 'shared_account'))));
$$;

create function public.split_line_visible(p_split uuid, p_space uuid, p_kind public.split_line_kind)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.plan_row_visible(p_space, (select owner_user_id from public.salary_split where id = p_split), p_kind);
$$;

create function public.check_line_visible(p_checklist uuid, p_space uuid, p_kind public.split_line_kind)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.plan_row_visible(p_space, (select owner_user_id from public.pay_checklist where id = p_checklist), p_kind);
$$;

drop policy split_line_select on public.split_line;
create policy split_line_select on public.split_line for select to authenticated
  using (public.is_space_member(space_id) and public.split_line_visible(split_id, space_id, kind));
drop policy pay_check_line_select on public.pay_check_line;
create policy pay_check_line_select on public.pay_check_line for select to authenticated
  using (public.is_space_member(space_id) and public.check_line_visible(checklist_id, space_id, kind));

-- 파트너 기본 정보: 수입·용돈·다른 수입은 같이 계열이거나 상대가 ‘모두 보여 주기’일 때만
create or replace function public.partner_profile()
returns table(id uuid, nickname text, side public.couple_side, employment public.employment, monthly_income bigint,
  income_variable boolean, payday smallint, payday_last boolean, allowance bigint, other_income bigint)
language sql stable security definer set search_path = '' as $$
  select p.id, p.nickname, p.side, p.employment,
    case when v.open then p.monthly_income end, p.income_variable, p.payday, p.payday_last,
    case when v.open then p.allowance end, case when v.open then p.other_income end
  from public.app_user me
  join public.app_user p on p.space_id = me.space_id and p.id <> me.id and p.status = 'active'
  join public.couple_space s on s.id = me.space_id
  cross join lateral (select s.couple_state <> 'unlink_pending' and (s.salary_mode = 'joint' or p.plan_share = 'all') as open) v
  where me.id = auth.uid() and me.space_id is not null
  limit 1;
$$;

-- 계약 3: 서버 필터 하나. p_viewer = 보는 사람(기본 나). 주인(상대)이 p_viewer = 상대로 부르면 S-13p 미리 보기
create function public.partner_plan_view(p_viewer uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  viewer public.app_user;
  owner public.app_user;
  sp public.couple_space;
  share public.plan_share;
  joint boolean;
  split uuid;
  cl uuid;
  lines jsonb;
begin
  select * into viewer from public.app_user where id = coalesce(p_viewer, uid);
  if viewer.id is null or viewer.space_id is null
     or (viewer.id <> uid and not exists (select 1 from public.app_user where id = uid and space_id = viewer.space_id)) then
    raise exception 'not_found' using errcode = '42501';
  end if;
  select * into owner from public.app_user
    where space_id = viewer.space_id and id <> viewer.id and status = 'active' limit 1;
  if owner.id is null then
    return null;
  end if;
  select * into sp from public.couple_space where id = viewer.space_id;
  joint := sp.salary_mode = 'joint';
  share := owner.plan_share;
  if sp.couple_state = 'unlink_pending' then
    return jsonb_build_object('owner', owner.id, 'nickname', owner.nickname, 'share', share, 'mode', sp.salary_mode,
      'hidden', true, 'income', null, 'payday', null, 'lines', '[]'::jsonb);
  end if;
  select id into split from public.salary_split
    where space_id = sp.id and owner_user_id is not distinct from case when joint then null else owner.id end;
  select id into cl from public.pay_checklist
    where space_id = sp.id and owner_user_id is not distinct from case when joint then null else owner.id end
      and cycle_start <= public.kst_today() and cycle_end >= public.kst_today();
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', l.id, 'kind', l.kind, 'goal_id', l.goal_id,
      'name', case when l.kind = 'saving' then g.name else l.name end,
      'user_id', l.user_id,
      'amount', case when joint or share <> 'done_only' then l.amount end,
      'in_checklist', l.in_checklist, 'auto_pay', l.auto_pay,
      'state', (select x.state from public.pay_check_line x where x.checklist_id = cl and x.split_line_id = l.id limit 1))
      order by l.sort), '[]'::jsonb)
    into lines
    from public.split_line l left join public.goal g on g.id = l.goal_id
    where l.split_id = split
      and (joint or share = 'all'
        or (share = 'saving_only' and l.kind in ('saving', 'shared_account'))
        or (share = 'done_only' and l.kind = 'saving'));
  return jsonb_build_object('owner', owner.id, 'nickname', owner.nickname, 'share', share, 'mode', sp.salary_mode,
    'hidden', false,
    'income', case when joint or share = 'all' then owner.monthly_income end,
    'payday', case when joint or share = 'all' then case when owner.payday_last then 31 else owner.payday end end,
    'lines', lines);
end;
$$;
grant execute on function public.partner_plan_view(uuid) to authenticated;

-- ─────────────────────────── 보내기·용돈(G9) ───────────────────────────
-- 계약 4
create function public.recalc_send_line(p_space uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  sp public.couple_space;
  js uuid;
  u public.app_user;
  a bigint;
  v bigint;
  cur public.split_line;
  changed boolean := false;
begin
  select * into sp from public.couple_space where id = p_space;
  select id into js from public.salary_split where space_id = p_space and owner_user_id is null;
  if js is null then
    return;
  end if;
  if sp.salary_mode <> 'joint' or sp.manager_user_id is null then
    delete from public.split_line where split_id = js and kind = 'send';
    if found then
      perform public.sync_checklist(js);
    end if;
    return;
  end if;
  -- 관리하는 사람 몫이나 떠난 사람의 보내기 줄은 지움
  delete from public.split_line where split_id = js and kind = 'send'
    and (user_id = sp.manager_user_id or not exists (
      select 1 from public.app_user x where x.id = split_line.user_id and x.space_id = p_space and x.status = 'active'));
  changed := found;
  for u in select x.* from public.app_user x
    where x.space_id = p_space and x.status = 'active' and x.id <> sp.manager_user_id
  loop
    select coalesce(sum(amount), 0) into a from public.split_line where split_id = js and kind = 'allowance' and user_id = u.id;
    v := greatest(0, coalesce(u.monthly_income, 0) - a) / 10000 * 10000;
    select * into cur from public.split_line where split_id = js and kind = 'send' and user_id = u.id;
    if cur.id is null then
      insert into public.split_line (split_id, space_id, kind, user_id, amount, sort, in_checklist, auto_pay, auto_day)
        values (js, p_space, 'send', u.id, v,
          (select coalesce(max(sort), -1) + 1 from public.split_line where split_id = js), true, true,
          case when u.payday_none then null when u.payday_last then 31 else u.payday end);
      changed := true;
    elsif cur.amount <> v then
      update public.split_line set amount = v where id = cur.id;
      changed := true;
    end if;
    cur := null;
  end loop;
  if changed then
    update public.salary_split set version = version + 1, updated_at = now() where id = js;
    perform public.sync_checklist(js);
  end if;
end;
$$;
revoke all on function public.recalc_send_line(uuid) from public, anon, authenticated;

-- 트리거: 월급(즉시 변경, 월급 변경 적용 포함)·월급날이 바뀌거나, 용돈 줄이 바뀌거나, 관리하는 사람이 바뀌면
create function public.recalc_send_line_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.space_id is not null and (new.monthly_income is distinct from old.monthly_income
      or new.payday is distinct from old.payday or new.status is distinct from old.status) then
    perform public.recalc_send_line(new.space_id);
  end if;
  return null;
end;
$$;
create trigger recalc_send_line after update of monthly_income, payday, status on public.app_user
  for each row execute function public.recalc_send_line_user();

create function public.recalc_send_line_allowance() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  sid uuid := coalesce(new.space_id, old.space_id);
begin
  if coalesce(new.kind, old.kind) = 'allowance' and exists (
      select 1 from public.couple_space where id = sid and salary_mode = 'joint' and manager_user_id is not null) then
    perform public.recalc_send_line(sid);
  end if;
  return null;
end;
$$;
create trigger recalc_send_line after insert or update of amount or delete on public.split_line
  for each row execute function public.recalc_send_line_allowance();

-- 용돈 줄을 고칠 수 있나(계약 4, B7): 주인, 또는 한 사람 관리형의 관리하는 사람
create function public.allowance_editable(p_space uuid, p_owner uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_owner is null or p_owner = auth.uid() or exists (
    select 1 from public.couple_space where id = p_space and salary_mode = 'joint' and manager_user_id = auth.uid());
$$;

create function public.notify_my_allowance(p_space uuid, p_owner uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_owner is null or p_owner = auth.uid() then
    return;
  end if;
  perform public.notify(p_owner, p_space, 'my_allowance',
    coalesce((select nickname from public.app_user where id = auth.uid()) || '님이', '파트너가') || ' 내 용돈을 바꿨어요', -- [확인 필요] 7-2
    null, '/salary?view=plan', 'wallet', auth.uid(),
    'my_allowance:' || p_owner::text || ':' || extract(epoch from clock_timestamp())::bigint);
end;
$$;
revoke all on function public.notify_my_allowance(uuid, uuid) from public, anon, authenticated;

create or replace function public.split_line_set(p_line uuid, p_amount bigint default null, p_name text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  l public.split_line;
  sp public.salary_split;
  nm text := nullif(btrim(p_name), '');
  old jsonb;
begin
  select * into l from public.split_line where id = p_line;
  if l.id is null then
    raise exception 'no_split' using errcode = '42501';
  end if;
  sp := public.split_editable(l.split_id);
  if l.kind = 'send' then
    raise exception 'send_locked' using errcode = '42501';
  end if;
  if l.kind = 'allowance' and sp.owner_user_id is null and not public.allowance_editable(sp.space_id, l.user_id) then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if p_amount is not null and not public.split_amount_ok(p_amount) then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  if p_name is not null and (l.kind <> 'custom' or nm is null or char_length(nm) > 20) then
    raise exception 'bad_name' using errcode = '22023';
  end if;
  if nm is not null and nm is distinct from l.name and exists (
      select 1 from public.split_line where split_id = sp.id and kind = 'custom' and name = nm and id <> l.id) then
    raise exception 'duplicate_line' using errcode = '22023';
  end if;
  if coalesce(p_amount, l.amount) = l.amount and coalesce(nm, l.name) is not distinct from l.name then
    return;
  end if;
  update public.split_line set amount = coalesce(p_amount, amount), name = coalesce(nm, name) where id = l.id;
  perform public.split_touch(sp.id);
  if l.kind = 'allowance' and sp.owner_user_id is null and l.user_id <> auth.uid() then
    -- 관리하는 사람이 상대 용돈을 고침: 주인에게 ‘내 용돈이 바뀌었을 때’(파트너 변경 기록 대신)
    perform public.notify_my_allowance(sp.space_id, l.user_id);
  else
    -- 금액 비교는 새 이름 기준(이름만 바꾸면 금액 알림 없음), 이름은 따로 한 줄
    old := public.split_lines_json(sp.id, l.id, l.amount);
    perform public.log_split_changes(sp.id, old);
    if nm is not null and nm is distinct from l.name then
      perform public.log_partner_change(sp.space_id, 'split', sp.id, 'name:' || l.id, l.name, l.name, nm, true, '/salary?view=plan');
    end if;
  end if;
  perform public.sync_checklist(sp.id);
end;
$$;

create or replace function public.split_line_add(p_split uuid, p_kind public.split_line_kind, p_amount bigint,
  p_name text default null, p_user uuid default null, p_sort integer default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  sp public.salary_split;
  nm text := nullif(btrim(p_name), '');
  who uuid;
  last integer;
  pos integer;
  old jsonb;
  nid uuid;
begin
  sp := public.split_editable(p_split);
  if p_kind in ('saving', 'send') then
    raise exception 'bad_kind' using errcode = '22023';
  end if;
  if not public.split_amount_ok(p_amount) then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  if p_kind = 'custom' then
    if nm is null or char_length(nm) > 20 then
      raise exception 'bad_name' using errcode = '22023';
    end if;
    if (select count(*) from public.split_line where split_id = sp.id and kind = 'custom') >= 10 then
      raise exception 'too_many_custom' using errcode = '22023';
    end if;
    if exists (select 1 from public.split_line where split_id = sp.id and kind = 'custom' and name = nm) then
      raise exception 'duplicate_line' using errcode = '22023';
    end if;
  elsif p_kind in ('fixed', 'living') then
    if exists (select 1 from public.split_line where split_id = sp.id and kind = p_kind) then
      raise exception 'duplicate_line' using errcode = '22023';
    end if;
  elsif p_kind = 'allowance' then
    who := coalesce(p_user, sp.owner_user_id, auth.uid());
    if not exists (select 1 from public.app_user where id = who and space_id = sp.space_id) then
      raise exception 'bad_user' using errcode = '22023';
    end if;
    if sp.owner_user_id is null and not public.allowance_editable(sp.space_id, who) then
      raise exception 'not_owner' using errcode = '42501';
    end if;
    if exists (select 1 from public.split_line where split_id = sp.id and kind = 'allowance' and user_id = who) then
      raise exception 'duplicate_line' using errcode = '22023';
    end if;
  end if;
  old := public.split_lines_json(sp.id);
  select coalesce(max(sort), -1) into last from public.split_line where split_id = sp.id;
  pos := case when p_sort is null then last + 1 else greatest(0, least(p_sort, last + 1)) end;
  update public.split_line set sort = sort + 1 where split_id = sp.id and sort >= pos;
  insert into public.split_line (split_id, space_id, kind, user_id, name, amount, sort)
    values (sp.id, sp.space_id, p_kind, case when p_kind = 'allowance' then who end,
      case when p_kind = 'custom' then nm end, p_amount, pos)
    returning id into nid;
  perform public.split_touch(sp.id);
  perform public.log_split_changes(sp.id, old);
  perform public.sync_checklist(sp.id);
  return nid;
end;
$$;

create or replace function public.split_line_delete(p_line uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  l public.split_line;
  sp public.salary_split;
  old jsonb;
begin
  select * into l from public.split_line where id = p_line;
  if l.id is null then
    raise exception 'no_split' using errcode = '42501';
  end if;
  sp := public.split_editable(l.split_id);
  if l.kind = 'send' then
    raise exception 'send_locked' using errcode = '42501';
  end if;
  if l.kind = 'saving' then
    perform public.saving_item_stop(l.goal_id);
    perform public.split_touch(sp.id);
    return;
  end if;
  if l.kind = 'allowance' and sp.owner_user_id is null then
    raise exception 'keep_allowance' using errcode = '22023';
  end if;
  old := public.split_lines_json(sp.id);
  delete from public.split_line where id = l.id;
  perform public.split_touch(sp.id);
  perform public.log_split_changes(sp.id, old);
  perform public.sync_checklist(sp.id);
end;
$$;

-- save_split: 보내기 줄은 직접 저장 거절(서버가 다시 만듦), 합쳐서 남의 용돈 줄은 주인만(한 사람 관리형은 관리하는 사람도 + 알림)
create or replace function public.save_split(p_lines jsonb, p_owner uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  sid uuid := (select space_id from public.app_user where id = auth.uid());
  mode public.salary_mode;
  split uuid;
  l jsonb;
  i integer := 0;
  customs integer := 0;
  k public.split_line_kind;
  old_lines jsonb;
  old_set jsonb := '[]'::jsonb;
  g uuid;
  u uuid;
  nm text;
  prev jsonb;
  a record;
  touched uuid[] := '{}';
  t uuid;
begin
  if sid is null then
    raise exception 'no_space' using errcode = '42501';
  end if;
  select salary_mode into mode from public.couple_space where id = sid;
  -- 연결 해제 대기 중에는 분배표를 고칠 수 없음(25 ‘연결 해제, 대기와 혼자 쓰기’ 2번)
  if (select couple_state from public.couple_space where id = sid) = 'unlink_pending' then
    raise exception 'unlink_pending' using errcode = '42501';
  end if;
  if mode = 'joint' and p_owner is not null then
    raise exception 'joint_split_has_no_owner' using errcode = '22023';
  end if;
  if mode = 'separate' and (p_owner is null
      or not exists (select 1 from public.app_user where id = p_owner and space_id = sid)) then
    raise exception 'bad_owner' using errcode = '22023';
  end if;
  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) > 60 then
    raise exception 'bad_lines' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_lines) x where x->>'kind' = 'send') then
    raise exception 'send_locked' using errcode = '42501';
  end if;

  select id into split from public.salary_split
    where space_id = sid and owner_user_id is not distinct from p_owner;
  -- 2026-11-09: 각자 모드 파트너 월급 계획은 보기만(쓰는 돈 줄도 못 고침). 예전 ‘파트너 저금 줄만 잠금’ 대신
  if mode = 'separate' and p_owner <> uid then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  -- 합쳐서 남의 용돈 줄(B7, G9): 금액이 바뀌거나 빠지면 주인(또는 한 사람 관리형의 관리하는 사람)만
  if mode = 'joint' and split is not null then
    for a in
      select o.user_id, o.amount as before_amount,
        (select sum((x->>'amount')::bigint) from jsonb_array_elements(p_lines) x
          where x->>'kind' = 'allowance' and (x->>'user_id')::uuid = o.user_id) as after_amount
      from public.split_line o
      where o.split_id = split and o.kind = 'allowance' and o.user_id is not null and o.user_id <> uid
    loop
      if a.after_amount is distinct from a.before_amount then
        if not public.allowance_editable(sid, a.user_id) then
          raise exception 'not_owner' using errcode = '42501';
        end if;
        touched := touched || a.user_id;
      end if;
    end loop;
  end if;
  if split is null then
    insert into public.salary_split (space_id, owner_user_id, updated_by)
      values (sid, p_owner, uid) returning id into split;
  else
    select jsonb_agg(jsonb_build_object('kind', kind, 'goal_id', goal_id, 'user_id', user_id, 'name', name, 'amount', amount))
             filter (where kind <> 'send'),
           coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'goal_id', goal_id, 'user_id', user_id, 'name', name,
             'in_checklist', in_checklist, 'auto_pay', auto_pay, 'auto_day', auto_day)), '[]'::jsonb)
      into old_lines, old_set from public.split_line where split_id = split;
    update public.salary_split set updated_by = uid, updated_at = now(), version = version + 1
      where id = split;
    delete from public.split_line where split_id = split;
  end if;

  for l in select * from jsonb_array_elements(p_lines) loop
    k := (l->>'kind')::public.split_line_kind;
    if k = 'saving' and not exists (
        select 1 from public.goal g0
        where g0.id = (l->>'goal_id')::uuid and g0.space_id = sid and g0.deleted_at is null) then
      raise exception 'bad_goal' using errcode = '22023';
    end if;
    if k = 'allowance' and (l->>'user_id') is not null and not exists (
        select 1 from public.app_user where id = (l->>'user_id')::uuid and space_id = sid) then
      raise exception 'bad_user' using errcode = '22023';
    end if;
    if k = 'custom' then
      customs := customs + 1;
      if customs > 10 then
        raise exception 'too_many_custom' using errcode = '22023';
      end if;
    end if;
    g := case when k = 'saving' then (l->>'goal_id')::uuid end;
    u := case when k = 'allowance' then coalesce((l->>'user_id')::uuid, p_owner, uid) end;
    nm := case when k = 'custom' then btrim(l->>'name') end;
    select x into prev from jsonb_array_elements(old_set) x
      where x->>'kind' = k::text and (x->>'goal_id')::uuid is not distinct from g
        and (x->>'user_id')::uuid is not distinct from u and (x->>'name') is not distinct from nm
      limit 1;
    insert into public.split_line (split_id, space_id, kind, goal_id, user_id, name, amount, sort,
                                   in_checklist, auto_pay, auto_day)
    values (
      split, sid, k, g, u, nm,
      (l->>'amount')::bigint,
      i,
      coalesce((l->>'in_checklist')::boolean, (prev->>'in_checklist')::boolean),
      coalesce((l->>'auto_pay')::boolean, (prev->>'auto_pay')::boolean),
      case when l ? 'auto_day' then (l->>'auto_day')::smallint else (prev->>'auto_day')::smallint end
    );
    prev := null;
    i := i + 1;
  end loop;
  -- 보내기 줄은 서버가 다시(옛 설정 이어받기)
  if mode = 'joint' then
    perform public.recalc_send_line(sid);
    update public.split_line l0 set in_checklist = (x->>'in_checklist')::boolean, auto_pay = (x->>'auto_pay')::boolean,
        auto_day = (x->>'auto_day')::smallint
      from jsonb_array_elements(old_set) x
      where l0.split_id = split and l0.kind = 'send' and x->>'kind' = 'send' and (x->>'user_id')::uuid = l0.user_id;
  end if;
  if old_lines is not null then
    perform public.log_split_changes(split, old_lines);
  end if;
  foreach t in array touched loop
    perform public.notify_my_allowance(sid, t);
  end loop;
  perform public.sync_checklist(split);
  return split;
end;
$$;

-- ─────────────────────────── 월급 변경(G12) ───────────────────────────
create table public.salary_change (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  space_id uuid not null references public.couple_space (id) on delete cascade,
  amount bigint not null check (amount between 0 and 99999999999),
  effective_from date not null check (extract(day from effective_from) = 1),
  until_month date check (until_month is null or (extract(day from until_month) = 1 and until_month >= effective_from)),
  revert_amount bigint check (revert_amount between 0 and 99999999999),
  applied_at timestamptz,
  reverted_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);
create index salary_change_user_idx on public.salary_change (user_id, effective_from);
create index salary_change_space_idx on public.salary_change (space_id);
alter table public.salary_change enable row level security;
-- 읽기: 본인 + 같이 계열 상대(금액 포함은 같이 계열에서만이라 공개 필터와 같음)
create policy salary_change_select on public.salary_change for select to authenticated
  using (user_id = auth.uid() or (public.is_space_member(space_id)
    and exists (select 1 from public.couple_space s where s.id = space_id and s.salary_mode = 'joint'
                  and s.couple_state = 'connected')));
create policy salary_change_insert on public.salary_change for insert to authenticated with check (false);
create policy salary_change_update on public.salary_change for update to authenticated using (false);
create policy salary_change_delete on public.salary_change for delete to authenticated using (false);
alter publication supabase_realtime add table public.salary_change;

-- 계약 5: 그 사람의 그 달 사이클 시작일
create function public.salary_change_day(p_user uuid, p_month date)
returns date language sql stable security definer set search_path = '' as $$
  select case
    when u.payday_none or (u.payday is null and not u.payday_last) then p_month
    else public.cycle_date((case when u.payday_last then 31 else u.payday end)::smallint,
           extract(year from p_month)::int, extract(month from p_month)::int) end
  from public.app_user u where u.id = p_user;
$$;

create function public.apply_salary_changes(p_today date default null, p_user uuid default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  today date := coalesce(p_today, public.kst_today());
  c public.salary_change;
  u public.app_user;
  cnt integer := 0;
begin
  for c in
    select x.* from public.salary_change x
    where x.applied_at is null and x.cancelled_at is null and (p_user is null or x.user_id = p_user)
      and public.salary_change_day(x.user_id, x.effective_from) <= today
    order by x.effective_from, x.created_at
  loop
    select * into u from public.app_user where id = c.user_id and status = 'active';
    continue when u.id is null or u.space_id is distinct from c.space_id;
    update public.salary_change set applied_at = now(), revert_amount = coalesce(u.monthly_income, 0) where id = c.id;
    update public.app_user set monthly_income = c.amount where id = c.user_id;
    perform public.notify(c.user_id, c.space_id, 'salary_changed', '월급이 바뀌었어요. 월급 계획을 다시 맞춰 볼까요?', -- [확인 필요] 4-3 6번
      null, '/salary?view=plan', 'wallet', null, 'salary_changed:' || c.id || ':' || c.user_id);
    -- 같이 계열 상대에게도(금액 없이)
    if exists (select 1 from public.couple_space s where s.id = c.space_id and s.salary_mode = 'joint'
                 and s.couple_state = 'connected') then
      perform public.notify(x.id, c.space_id, 'salary_changed',
          coalesce(u.nickname || '님', '파트너') || ' 월급이 바뀌었어요. 월급 계획을 다시 맞춰 볼까요?', -- [확인 필요]
          null, '/salary?view=plan', 'wallet', c.user_id, 'salary_changed:' || c.id || ':' || x.id)
        from public.app_user x where x.space_id = c.space_id and x.id <> c.user_id and x.status = 'active';
    end if;
    cnt := cnt + 1;
  end loop;
  -- until_month가 지난 변경: 그다음 달 사이클 시작일에 되돌림
  for c in
    select x.* from public.salary_change x
    where x.applied_at is not null and x.reverted_at is null and x.cancelled_at is null and x.until_month is not null
      and (p_user is null or x.user_id = p_user)
      and public.salary_change_day(x.user_id, (x.until_month + interval '1 month')::date) <= today
  loop
    update public.salary_change set reverted_at = now() where id = c.id;
    -- 그사이 다른 변경이 적용됐으면 되돌리지 않음(마지막 적용이 이 변경일 때만)
    if not exists (select 1 from public.salary_change y where y.user_id = c.user_id and y.applied_at > c.applied_at
                     and y.cancelled_at is null) then
      update public.app_user set monthly_income = c.revert_amount where id = c.user_id and status = 'active';
      perform public.notify(c.user_id, c.space_id, 'salary_changed', '월급이 바뀌었어요. 월급 계획을 다시 맞춰 볼까요?', -- [확인 필요]
        null, '/salary?view=plan', 'wallet', null, 'salary_changed:' || c.id || ':revert');
    end if;
    cnt := cnt + 1;
  end loop;
  return cnt;
end;
$$;
revoke all on function public.apply_salary_changes(date, uuid) from public, anon, authenticated;

create function public.schedule_salary_change(p_amount bigint, p_from date, p_until date default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  me public.app_user;
  f date := date_trunc('month', p_from)::date;
  t date := date_trunc('month', p_until)::date;
  rid uuid;
begin
  select * into me from public.app_user where id = uid;
  if me.space_id is null then
    raise exception 'no_space' using errcode = '42501';
  end if;
  if p_amount is null or p_amount < 0 or p_amount > 99999999999 then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  if f is null or f < date_trunc('month', public.kst_today())::date or (t is not null and t < f) then
    raise exception 'bad_month' using errcode = '22023';
  end if;
  update public.salary_change set cancelled_at = now()
    where user_id = uid and applied_at is null and cancelled_at is null and effective_from >= f;
  insert into public.salary_change (user_id, space_id, amount, effective_from, until_month)
    values (uid, me.space_id, p_amount, f, t) returning id into rid;
  perform public.apply_salary_changes(null, uid);
  return rid;
end;
$$;
grant execute on function public.schedule_salary_change(bigint, date, date) to authenticated;

create function public.cancel_salary_change(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.salary_change where id = p_id and user_id = auth.uid() and applied_at is not null) then
    raise exception 'already_applied' using errcode = '22023';
  end if;
  update public.salary_change set cancelled_at = now()
    where id = p_id and user_id = auth.uid() and cancelled_at is null;
  if not found then
    raise exception 'not_found' using errcode = '42501';
  end if;
end;
$$;
grant execute on function public.cancel_salary_change(uuid) to authenticated;

-- 00:00 KST 목록 만들기 전에 월급 변경부터(계약 5)
create or replace function public.run_cycle_checklists(p_today date default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  r record;
  cnt integer := 0;
begin
  begin
    perform public.apply_salary_changes(p_today);
  exception when others then
    raise warning 'run_cycle_checklists apply_salary_changes: %', sqlerrm;
  end;
  for r in
    select s.space_id, s.owner_user_id
    from public.salary_split s
    join public.couple_space sp on sp.id = s.space_id and sp.deleted_at is null
    where (sp.salary_mode = 'joint' and s.owner_user_id is null)
       or (sp.salary_mode = 'separate' and s.owner_user_id is not null
           and exists (select 1 from public.app_user u
                       where u.id = s.owner_user_id and u.space_id = s.space_id and u.status = 'active'))
  loop
    begin
      if public.make_checklist(r.space_id, r.owner_user_id, p_today) is not null then
        cnt := cnt + 1;
      end if;
    exception when others then
      raise warning 'run_cycle_checklists % %: %', r.space_id, r.owner_user_id, sqlerrm;
    end;
  end loop;
  return cnt;
end;
$$;

-- ─────────────────────────── 홈 띠 닫기 ───────────────────────────
create table public.home_task_state (
  user_id uuid not null references auth.users (id) on delete cascade,
  task_key text not null check (task_key ~ '^[a-z0-9_:.-]{2,60}$'),
  state text not null check (state in ('dismissed', 'done')),
  at timestamptz not null default now(),
  primary key (user_id, task_key)
);
alter table public.home_task_state enable row level security;
create policy home_task_state_select on public.home_task_state for select to authenticated using (user_id = auth.uid());
create policy home_task_state_insert on public.home_task_state for insert to authenticated with check (false);
create policy home_task_state_update on public.home_task_state for update to authenticated using (false);
create policy home_task_state_delete on public.home_task_state for delete to authenticated using (false);

create function public.dismiss_home_task(p_key text, p_state text default 'dismissed')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'no_user' using errcode = '42501';
  end if;
  if p_key is null or p_key !~ '^[a-z0-9_:.-]{2,60}$' or p_state not in ('dismissed', 'done') then
    raise exception 'bad_key' using errcode = '22023';
  end if;
  insert into public.home_task_state (user_id, task_key, state) values (auth.uid(), p_key, p_state)
    on conflict (user_id, task_key) do update set state = excluded.state, at = now();
end;
$$;
grant execute on function public.dismiss_home_task(text, text) to authenticated;

-- ─────────────────────────── 알림 프라이버시(계약 6) ───────────────────────────
-- 각자 계열 월급 계획 변경은 상대에게 알리지 않음
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
    perform public.log_partner_change(sp.space_id, 'split', p_split,
      r.kind || ':' || coalesce(r.goal_id::text, '') || ':' || coalesce(r.user_id::text, '') || ':' || coalesce(r.name, ''),
      public.pay_line_noun(r.kind, r.goal_id, r.name)
        || case when r.kind = 'allowance' and r.user_id is not null and sp.owner_user_id is null
             then '(' || coalesce((select nickname from public.app_user where id = r.user_id), '') || ')' else '' end,
      public.read_won(coalesce(r.before_amount, 0)), public.read_won(coalesce(r.after_amount, 0)), true, '/salary?view=plan');
  end loop;
end;
$$;

-- 각자 계열 월급 계획(주인 있는 월급 계획)의 모든 변경(금액, 이름, 순서)은 기록하지 않음(B8)
create or replace function public.log_partner_change(p_space uuid, p_topic text, p_ref uuid, p_field text, p_noun text,
  p_before text, p_after text, p_urgent boolean, p_target text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  other uuid;
begin
  if uid is null or p_before is not distinct from p_after then
    return;
  end if;
  if p_topic = 'split' and exists (select 1 from public.salary_split where id = p_ref and owner_user_id is not null) then
    return;
  end if;
  if not exists (select 1 from public.couple_space where id = p_space and couple_state in ('connected', 'unlink_pending')) then
    return;
  end if;
  select id into other from public.app_user where space_id = p_space and status = 'active' and id <> uid limit 1;
  if other is null then
    return;
  end if;
  insert into public.partner_change (space_id, actor_id, receiver_id, topic, ref_id, field, noun, before_v, after_v, urgent, target)
    values (p_space, uid, other, p_topic, p_ref, p_field, coalesce(p_noun, ''), p_before, p_after, p_urgent, p_target);
end;
$$;

-- 월급 금액 변경: 각자 계열은 알리지 않음, 같이 계열은 금액 없이
create or replace function public.income_partner_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.monthly_income is distinct from old.monthly_income and new.id = auth.uid()
     and exists (select 1 from public.couple_space where id = new.space_id and salary_mode = 'joint') then
    perform public.log_partner_change(new.space_id, 'income', new.id, 'income', coalesce(new.nickname, ''),
      '바꾸기 전', '바꾼 뒤', true, '/settings/me/salary'); -- 금액 없이(B8)
  end if;
  return null;
end;
$$;

-- 인앱만(푸시 없음) 종류
create function public.noti_inapp_only(p_kind text)
returns boolean language sql immutable set search_path = '' as $$
  select p_kind in ('salary_changed', 'mode_result');
$$;

-- 잠금 화면 본문에 금액이 있을 수 있는 종류(본문 빼고 푸시)
create function public.noti_push_body_hidden(p_kind text)
returns boolean language sql immutable set search_path = '' as $$
  select p_kind in ('partner_change', 'partner_activity', 'weekly_summary', 'salary_mode', 'my_allowance');
$$;

create or replace function public.claim_push(p_limit integer default 100, p_now timestamptz default now())
returns table(notification_id uuid, title text, body text, target text, platform text, token text)
language plpgsql security definer set search_path = '' as $$
declare
  hour integer := extract(hour from p_now at time zone 'Asia/Seoul')::int;
  ids uuid[];
begin
  select array_agg(x.id) into ids from (
    select n.id
    from public.notification n
    join public.app_user u on u.id = n.user_id and u.status = 'active'
    where n.pushed_at is null and n.read_at is null
      and n.created_at > p_now - public.noti_send_window(u.quiet_start, u.quiet_end)
      and public.push_wanted(u.noti_prefs, n.topic)
      -- v2.2 알림 종류 골라 켜기(P-11·S-14), 인앱만 종류
      and public.push_kind_on(u.push_kinds, n.kind)
      and not public.noti_inapp_only(n.kind)
      and exists (select 1 from public.push_device d where d.user_id = n.user_id)
      -- 방해 금지(보안·계정 알림은 바로): 끝나면 보냄
      and (public.noti_always_mail(n.kind) or not (
        u.quiet_start <> u.quiet_end and case when u.quiet_start < u.quiet_end
          then hour >= u.quiet_start and hour < u.quiet_end
          else hour >= u.quiet_start or hour < u.quiet_end end))
    order by n.created_at
    limit least(greatest(coalesce(p_limit, 100), 1), 500)
    for update of n skip locked
  ) x;
  if ids is null then
    return;
  end if;
  update public.notification set pushed_at = p_now where id = any(ids);
  -- 분석: 알림마다 한 번(기기 수와 상관없이)
  perform public.track_noti_sent(n.user_id, n.space_id, n.kind, 'os')
    from public.notification n where n.id = any(ids);
  return query
    select n.id, coalesce(n.push_title, n.title),
      case when n.push_hidden or public.noti_push_body_hidden(n.kind) then null else n.body end, n.target,
      d.platform, d.token
    from public.notification n
    join public.push_device d on d.user_id = n.user_id
    where n.id = any(ids);
end;
$$;

-- ─────────────────────────── 예약 작업 ───────────────────────────
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('apply-salary-changes', '1 15 * * *', 'select public.apply_salary_changes()');
  end if;
end;
$$;
