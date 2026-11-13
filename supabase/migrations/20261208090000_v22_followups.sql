-- v2.2 후속 고침(2026-11-13 사용자 결정 P1 = A, P2 = A + 남은 일). 스키마는 추가만.
--
-- ■ 계약(core·앱이 같은 결과)
--  1. 공개 ‘했어요만’(P1 = A, 08 6장): 각자 계열에서 plan_share = done_only인 사람의 개인 저금은 상대가 받을 수 있는
--     모든 길에서 이름·목표 금액·모은 금액을 주지 않음. 상대가 받는 것은 저금이 있다는 것(“개인 저금”)과
--     이번 달 확인 여부(partner_plan_view 줄 state)뿐. 해제 대기 중 상대 개인 저금도 같은 도우미로 가림.
--     도우미 saving_owner_hidden(space, owner): 주인이 나 아님 + (해제 대기 또는 (각자 엔진 + 주인 done_only)).
--     - goal 읽기(goal_select, Realtime도 이 정책): 가린 저금 행은 상대에게 안 옴
--     - space_goals(): 가린 저금은 이름 “개인 저금”, 목표 금액·기한·시작 금액·세부 없이(해제 대기면 행 없음)
--     - goal_saved_sums(), goal_move 읽기(goal_move_public 포함), goal_story(), saving_note(goal_visible): 가린 저금 빠짐
--     - partner_plan_view: done_only 저금 줄은 이름도 null(금액은 이미 null), state만
--     - 달성 알림(goal_mark_achieved): 상대에게는 “개인 저금 목표 금액을 다 모았어요!” + W-01 파트너 탭
--     - 묶음(같이 모으기): 합계·목표 금액·%·이름은 묶음 규칙 그대로 둘 다 봄. 두 사람 중 한 사람이라도 done_only면
--       각자 금액은 둘 다 켰어도 꺼진 것처럼(둘 다에게 상대 금액 없음, bundle_each_open), 상대 묶인 저금 이름도 null
--     - ‘저금만’(saving_only)·‘모두’는 그대로(저금 이름·매달 금액·모은 금액·목표 금액이 보임)
--  2. 월급 변경 ‘이번 달부터’(P2 = A, 07 5장): schedule_salary_change의 시작 달이 이번 달이면 그 달 사이클 시작일
--     (월급날) 전이어도 바로 적용(지금 사이클부터). 적용 = app_user.monthly_income 변경 → 기존 트리거가
--     한 사람 관리형 ‘보내기’ 줄을 다시 계산하고 이번 사이클 확인 목록의 체크 안 한 줄(state wait)만 맞춤
--     (sync_checklist, 체크·못 함 줄은 그대로). 여유 자금은 저장 값이 아니라 화면 계산. 미래 달은 그대로 예약.
--     되돌림은 그대로 until 다음 달 사이클 시작일. 한 줄 적용은 내부 apply_salary_change_row(id)
--  3. 빠르게 적기 표시 asset.quick(F-03q, 기본 false). 앱이 insert에 넣음
--  4. 자산 공개 첫 선택(G2): 첫 내 명의 자산으로 기본값을 정하는 트리거는 연결된 공간(connected)에서만.
--     혼자·미합류일 때 적은 자산은 기본값을 정하지 않아 연결한 뒤 처음 적을 때 F-03e가 한 번 물음.
--     이미 트리거로 정해진 혼자·미합류 사람 기본값은 비움(출시 전, 명시 선택과 가를 수 없어 한 번 정리)
--  5. 순자산 networth_summary(): 앱 netWorthOf(23 F-01)와 같게. 내가 볼 수 있는 행 중 ‘숨기기’를 빼고
--     파트너 ‘총액만’ 행 합계를 더함(partner_asset_sums와 같은 행). 평가금액 기준 + principal_net
--  6. 각자 계열 ‘보내요’(18 P-04, p04_send): 요청을 보낸 사람(app_user.send_intent_space = 그 공간)의 각자 월급 계획에
--     서버가 ‘보내기’ 줄(= 1만 원 내림(월급 − 그 계획 용돈 줄 합), 자동, 체크리스트에 넣기, 나가는 날 = 월급날)을 둠.
--     요청이 열려 있을 때·‘지금처럼 할게요’·7일 만료 뒤에도 그대로(18 ‘보내기 + 용돈 그대로 남음’). 요청을 취소하거나
--     관리 형태가 실제로 바뀌면(apply_manage_style) 기억을 지우고 각자 계획의 보내기 줄도 지움(수락 = 공동 월급 계획의
--     보내기 줄은 recalc_send_line 한 사람 관리형 규칙). 연결이 아니면(혼자·미합류) 보내기 줄 없음. 직접 저장은 여전히
--     거절(send_locked), save_split이 줄을 다시 쓰면 트리거가 다시 둠. 공간이 바뀌면(해제 확정·탈퇴) 기억을 지우고 다시 셈
--  8. join_context().member는 늘 boolean(아직 공간에 들어오지 않은 합류자 = false, 예전 null, B1)
--  7. S-12h ‘시작하기’(25 v2.2, 08 7장): start_after_unlink는 온보딩 O-30부터(이름·두 사람 사이는 그대로, 예전 O-11).
--     내 월급 계획이 남았으면(각자 계열) 앱이 홈으로(이 함수를 부르지 않음)
--
-- 지금 안 쓰게 된 것(2단계 정리 대상, 그대로): goal.visibility, app_user.default_visibility, couple_unlink.reconnect_*,
--   reconnect_ok(). 못 한 것: revert_partner_change(별도 PR).

-- ─────────────────────────── 1. 했어요만 ───────────────────────────
create function public.saving_owner_hidden(p_space uuid, p_owner uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_owner is not null and p_owner is distinct from auth.uid() and exists (
    select 1 from public.couple_space s join public.app_user o on o.id = p_owner
    where s.id = p_space
      and (s.couple_state = 'unlink_pending' or (s.salary_mode <> 'joint' and o.plan_share = 'done_only')));
$$;
revoke all on function public.saving_owner_hidden(uuid, uuid) from public, anon;
grant execute on function public.saving_owner_hidden(uuid, uuid) to authenticated;

-- 묶음의 각자 금액이 열려 있나: 둘 다 켬 + 퍼센트만 아님 + 두 사람 모두 ‘했어요만’이 아님
create function public.bundle_each_open(p_bundle uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.saving_bundle b join public.couple_space s on s.id = b.space_id
    where b.id = p_bundle and b.show_each_a and b.show_each_b and not (b.percent_only_a or b.percent_only_b)
      and not (s.salary_mode <> 'joint' and exists (
        select 1 from public.app_user u where u.id in (b.member_a, b.member_b) and u.plan_share = 'done_only')));
$$;
revoke all on function public.bundle_each_open(uuid) from public, anon;
grant execute on function public.bundle_each_open(uuid) to authenticated;

-- 이 저금의 금액(모은 금액·돈 움직임)이 나에게 보이나
create function public.goal_amount_visible(p_goal uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.goal g
    where g.id = p_goal and public.is_space_member(g.space_id)
      and (g.owner_user_id is null or g.owner_user_id = auth.uid()
        or (not public.saving_owner_hidden(g.space_id, g.owner_user_id)
            and (g.bundle_id is null or public.bundle_each_open(g.bundle_id)))));
$$;
revoke all on function public.goal_amount_visible(uuid) from public, anon;
grant execute on function public.goal_amount_visible(uuid) to authenticated;

drop policy goal_select on public.goal;
create policy goal_select on public.goal for select to authenticated
  using (public.is_space_member(space_id) and (owner_user_id is null or owner_user_id = auth.uid()
    or (visibility = 'all' and not public.saving_owner_hidden(space_id, owner_user_id))));

create or replace function public.goal_visible(p_goal uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.goal g where g.id = p_goal and public.is_space_member(g.space_id)
      and (g.owner_user_id is null or g.owner_user_id = auth.uid()
        or ((g.visibility = 'all' or g.bundle_id is not null)
            and not public.saving_owner_hidden(g.space_id, g.owner_user_id))));
$$;

-- 돈 움직임(goal_move_public 뷰도 security invoker라 이 정책): 금액이 보이는 저금만
drop policy goal_move_select on public.goal_move;
create policy goal_move_select on public.goal_move for select to authenticated
  using (public.is_space_member(space_id) and public.goal_amount_visible(goal_id));

create or replace function public.goal_saved_sums()
returns table(goal_id uuid, saved bigint)
language sql stable security definer set search_path = '' as $$
  select g.id, public.goal_saved(g.id)
  from public.goal g
  where g.space_id = (select space_id from public.app_user where id = auth.uid()) and g.deleted_at is null
    and (g.owner_user_id is null or g.owner_user_id = auth.uid()
      or (not public.saving_owner_hidden(g.space_id, g.owner_user_id)
          and (g.bundle_id is null or public.bundle_each_open(g.bundle_id))));
$$;

-- 저금 행(앱은 이걸로 읽음): ‘금액만’(옛)·‘했어요만’ 상대 저금은 이름 “개인 저금”, 했어요만은 금액·기한도 없이.
-- 해제 대기 중 상대 개인 저금은 행 없음(goal 읽기 정책과 같음)
create or replace function public.space_goals()
returns setof public.goal
language sql stable security definer set search_path = '' as $$
  select case
    when x.partner and (g.visibility = 'amount' or x.hidden)
      then jsonb_populate_record(g, jsonb_build_object('name', '개인 저금', 'template', 'custom', 'details', '{}'::jsonb,
        'photo_path', null, 'photo_preset', null) -- [확인 필요]
        || case when x.hidden then jsonb_build_object('target_amount', null, 'deadline', null, 'start_saved', 0,
             'other_held', 0, 'freed_lines', '[]'::jsonb, 'amount_estimated', false, 'deadline_estimated', false)
           else '{}'::jsonb end)
    else g
  end
  from public.goal g
  join public.couple_space s on s.id = g.space_id
  cross join lateral (select g.owner_user_id is not null and g.owner_user_id <> auth.uid() as partner,
                             public.saving_owner_hidden(g.space_id, g.owner_user_id) as hidden) x
  where public.is_space_member(g.space_id)
    and not (x.partner and s.couple_state = 'unlink_pending');
$$;

create or replace function public.goal_story(p_goal uuid)
returns table (months integer, together integer)
language sql stable security definer set search_path = '' as $$
  with g as (
    select x.* from public.goal x where x.id = p_goal and public.is_space_member(x.space_id)
      and not public.saving_owner_hidden(x.space_id, x.owner_user_id)
  ),
  c as (
    select k.label, k.owner_user_id
    from g
    join public.pay_check_line l on l.goal_id = g.id and l.kind = 'saving' and l.state = 'checked'
    join public.pay_checklist k on k.id = l.checklist_id
    group by k.label, k.owner_user_id
  ),
  m as (
    select c.label, count(distinct c.owner_user_id) filter (where c.owner_user_id is not null) as people
    from c group by c.label
  )
  select count(*)::int,
    (case when (select owner_user_id from g) is null then count(*) filter (where m.people >= 2) else 0 end)::int
  from m;
$$;

-- 묶음 응답: 한 사람이라도 했어요만이면 각자 금액 없음, 가린 상대 저금 이름 없음
create or replace function public.bundle_view(p_bundle uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  sid uuid := (select space_id from public.app_user where id = auth.uid());
  hidden boolean := (select couple_state = 'unlink_pending' from public.couple_space where id = sid);
  r jsonb := '[]'::jsonb;
  b public.saving_bundle;
  total bigint;
  mine bigint;
  theirs bigint;
  pct int;
  pctonly boolean;
  each_ boolean;
begin
  for b in select x.* from public.saving_bundle x
    where x.space_id = sid and x.deleted_at is null and x.status <> 'closed' and (p_bundle is null or x.id = p_bundle)
    order by x.created_at
  loop
    mine := coalesce((select sum(public.goal_saved(g.id)) from public.goal g
      where g.bundle_id = b.id and g.owner_user_id = uid and g.deleted_at is null), 0);
    theirs := case when coalesce(hidden, false) then 0 else coalesce((select sum(public.goal_saved(g.id)) from public.goal g
      where g.bundle_id = b.id and g.owner_user_id is distinct from uid and g.deleted_at is null), 0) end;
    total := mine + theirs;
    pctonly := b.percent_only_a or b.percent_only_b;
    each_ := b.show_each_a and b.show_each_b and not exists (
      select 1 from public.app_user u join public.couple_space s on s.id = b.space_id
      where u.id in (b.member_a, b.member_b) and s.salary_mode <> 'joint' and u.plan_share = 'done_only');
    pct := case when b.target_amount > 0 then least(100, floor(total::numeric * 100 / b.target_amount))::int end;
    r := r || jsonb_build_object(
      'id', b.id, 'name', b.name, 'status', b.status, 'deadline', b.deadline, 'paused', coalesce(hidden, false),
      'percent_only', pctonly, 'show_each', each_,
      'my_show_each', case when uid = b.member_a then b.show_each_a else b.show_each_b end,
      'my_percent_only', case when uid = b.member_a then b.percent_only_a else b.percent_only_b end,
      'pct', pct,
      'total', case when pctonly then null else total end,
      'target', case when pctonly then null else b.target_amount end,
      'mine', case when pctonly then null else mine end,
      'partner', case when pctonly or not each_ then null else theirs end,
      'goals', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'mine', g.owner_user_id = uid,
                  'name', case when public.saving_owner_hidden(g.space_id, g.owner_user_id) then null else g.name end)
                  order by g.created_at)
                from public.goal g where g.bundle_id = b.id and g.deleted_at is null), '[]'::jsonb));
  end loop;
  return r;
end;
$$;

-- 상대 월급 계획: done_only 저금 줄은 이름도 없이(확인 여부 state만)
create or replace function public.partner_plan_view(p_viewer uuid default null)
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
      'name', case when not joint and share = 'done_only' then null when l.kind = 'saving' then g.name else l.name end,
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

-- 달성 알림: 상대에게는 ‘금액만’(옛)·‘했어요만’이면 이름 없이 “개인 저금 …” + W-01 파트너 탭
create or replace function public.goal_mark_achieved(p_goal uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  g public.goal;
  u record;
  joint boolean;
  done_only boolean;
begin
  select * into g from public.goal where id = p_goal;
  update public.goal set status = 'achieved', achieved_at = now(),
      achieved_seen = case when p_actor is null then '{}'::uuid[] else array[p_actor] end
    where id = g.id;
  select c.salary_mode = 'joint' into joint from public.couple_space c where c.id = g.space_id;
  done_only := not coalesce(joint, false) and exists (
    select 1 from public.app_user o where o.id = g.owner_user_id and o.plan_share = 'done_only');
  for u in select a.id from public.app_user a where a.space_id = g.space_id and a.status = 'active' loop
    if g.owner_user_id is not null and g.owner_user_id <> u.id and (g.visibility = 'amount' or done_only) then
      perform public.notify(u.id, g.space_id, 'goal_achieved', '개인 저금 목표 금액을 다 모았어요!', null, -- [확인 필요]
        '/salary' || case when coalesce(joint, false) then '' else '?who=' || g.owner_user_id::text end,
        'trophy', p_actor, 'goal_achieved:' || g.id::text || ':' || u.id::text);
      continue;
    end if;
    perform public.notify(u.id, g.space_id, 'goal_achieved', g.name || ' 목표 금액을 다 모았어요!', null, -- [확인 필요]
      '/salary/items/' || g.id::text
        || case when g.owner_user_id is null or g.owner_user_id = u.id
                  or (coalesce(joint, false) and g.visibility = 'all') then '/achieved' else '' end,
      'trophy', p_actor, 'goal_achieved:' || g.id::text || ':' || u.id::text);
  end loop;
end;
$$;
revoke all on function public.goal_mark_achieved(uuid, uuid) from public, anon, authenticated;

-- ─────────────────────────── 2. 월급 변경 ‘이번 달부터’ 바로 ───────────────────────────
create function public.apply_salary_change_row(p_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  c public.salary_change;
  u public.app_user;
begin
  select * into c from public.salary_change where id = p_id and applied_at is null and cancelled_at is null for update;
  if c.id is null then
    return false;
  end if;
  select * into u from public.app_user where id = c.user_id and status = 'active';
  if u.id is null or u.space_id is distinct from c.space_id then
    return false;
  end if;
  update public.salary_change set applied_at = now(), revert_amount = coalesce(u.monthly_income, 0) where id = c.id;
  update public.app_user set monthly_income = c.amount where id = c.user_id;
  perform public.notify(c.user_id, c.space_id, 'salary_changed', '월급이 바뀌었어요. 월급 계획을 다시 맞춰 볼까요?', -- [확인 필요] 4-3 6번
    null, '/salary?view=plan', 'wallet', null, 'salary_changed:' || c.id || ':' || c.user_id);
  if exists (select 1 from public.couple_space s where s.id = c.space_id and s.salary_mode = 'joint'
               and s.couple_state = 'connected') then
    perform public.notify(x.id, c.space_id, 'salary_changed',
        coalesce(u.nickname || '님', '파트너') || ' 월급이 바뀌었어요. 월급 계획을 다시 맞춰 볼까요?', -- [확인 필요]
        null, '/salary?view=plan', 'wallet', c.user_id, 'salary_changed:' || c.id || ':' || x.id)
      from public.app_user x where x.space_id = c.space_id and x.id <> c.user_id and x.status = 'active';
  end if;
  return true;
end;
$$;
revoke all on function public.apply_salary_change_row(uuid) from public, anon, authenticated;

create or replace function public.apply_salary_changes(p_today date default null, p_user uuid default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  today date := coalesce(p_today, public.kst_today());
  c public.salary_change;
  cnt integer := 0;
begin
  for c in
    select x.* from public.salary_change x
    where x.applied_at is null and x.cancelled_at is null and (p_user is null or x.user_id = p_user)
      and public.salary_change_day(x.user_id, x.effective_from) <= today
    order by x.effective_from, x.created_at
  loop
    if public.apply_salary_change_row(c.id) then
      cnt := cnt + 1;
    end if;
  end loop;
  for c in
    select x.* from public.salary_change x
    where x.applied_at is not null and x.reverted_at is null and x.cancelled_at is null and x.until_month is not null
      and (p_user is null or x.user_id = p_user)
      and public.salary_change_day(x.user_id, (x.until_month + interval '1 month')::date) <= today
  loop
    update public.salary_change set reverted_at = now() where id = c.id;
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

create or replace function public.schedule_salary_change(p_amount bigint, p_from date, p_until date default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  me public.app_user;
  this_month date := date_trunc('month', public.kst_today())::date;
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
  if f is null or f < this_month or (t is not null and t < f) then
    raise exception 'bad_month' using errcode = '22023';
  end if;
  update public.salary_change set cancelled_at = now()
    where user_id = uid and applied_at is null and cancelled_at is null and effective_from >= f;
  insert into public.salary_change (user_id, space_id, amount, effective_from, until_month)
    values (uid, me.space_id, p_amount, f, t) returning id into rid;
  -- 계약 2: ‘이번 달부터’는 그 달 월급날 전이어도 바로(지금 사이클부터)
  if f = this_month then
    perform public.apply_salary_change_row(rid);
  end if;
  perform public.apply_salary_changes(null, uid);
  return rid;
end;
$$;

-- ─────────────────────────── 3. 빠르게 적기 표시 ───────────────────────────
alter table public.asset add column quick boolean not null default false;

-- ─────────────────────────── 4. 자산 공개 첫 선택: 연결된 뒤에만 ───────────────────────────
create or replace function public.asset_first_share() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.owner = 'person' and new.owner_user_id is not null and new.owner_user_id = auth.uid()
     and exists (select 1 from public.couple_space s where s.id = new.space_id and s.couple_state = 'connected') then
    update public.app_user set asset_share_default = new.visibility
      where id = new.owner_user_id and asset_share_default is null;
  end if;
  return null;
end;
$$;
update public.app_user u set asset_share_default = null
  where u.asset_share_default is not null
    and not exists (select 1 from public.couple_space s where s.id = u.space_id and s.couple_state = 'connected');

-- ─────────────────────────── 5. 순자산 = 앱 netWorthOf ───────────────────────────
create or replace function public.networth_summary()
returns jsonb language sql stable security definer set search_path = '' as $$
  with me as (
    select u.id, u.space_id from public.app_user u where u.id = auth.uid() and u.status = 'active'
  ),
  items as (
    select a.side, a.amount, a.principal from public.asset a join me on a.space_id = me.space_id
    where a.deleted_at is null and a.status = 'held' and a.visibility <> 'private'
      and (public.asset_visible(a)
        or (a.owner = 'person' and a.owner_user_id is not null and a.owner_user_id <> me.id and a.visibility = 'sum'))
  )
  select jsonb_build_object(
    'assets', coalesce(sum(amount) filter (where side = 'asset'), 0),
    'debts', coalesce(sum(amount) filter (where side = 'debt'), 0),
    'net', coalesce(sum(case when side = 'asset' then amount else -amount end), 0),
    'principal_net', coalesce(sum(case when side = 'asset' then coalesce(principal, amount) else -amount end), 0))
  from items;
$$;

-- ─────────────────────────── 6. 각자 계열 ‘보내요’ 보내기 줄 ───────────────────────────
alter table public.app_user add column send_intent_space uuid references public.couple_space (id) on delete set null;
comment on column public.app_user.send_intent_space is
  '18 P-04 ‘보내요’(p04_send)를 보낸 공간. 각자 계열이어도 내 월급 계획에 보내기 줄(20261208090000 계약 6)';

create or replace function public.recalc_send_line(p_space uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  sp public.couple_space;
  js uuid;
  ms uuid;
  u public.app_user;
  a bigint;
  v bigint;
  cur public.split_line;
  changed boolean := false;
begin
  select * into sp from public.couple_space where id = p_space;
  select id into js from public.salary_split where space_id = p_space and owner_user_id is null;
  -- 계약 6: 각자 계열은 ‘보내요’를 보낸 사람 계획에만
  if sp.salary_mode = 'separate' then
    for u in select x.* from public.app_user x where x.space_id = p_space and x.status = 'active' loop
      select id into ms from public.salary_split where space_id = p_space and owner_user_id = u.id;
      continue when ms is null;
      changed := false;
      if u.send_intent_space = p_space and sp.couple_state in ('connected', 'unlink_pending') then
        select coalesce(sum(amount), 0) into a from public.split_line where split_id = ms and kind = 'allowance';
        v := greatest(0, coalesce(u.monthly_income, 0) - a) / 10000 * 10000;
        select * into cur from public.split_line where split_id = ms and kind = 'send' order by sort limit 1;
        if cur.id is null then
          insert into public.split_line (split_id, space_id, kind, user_id, amount, sort, in_checklist, auto_pay, auto_day)
            values (ms, p_space, 'send', u.id, v,
              (select coalesce(max(sort), -1) + 1 from public.split_line where split_id = ms), true, true,
              case when u.payday_none then null when u.payday_last then 31 else u.payday end);
          changed := true;
        elsif cur.amount <> v then
          update public.split_line set amount = v where id = cur.id;
          changed := true;
        end if;
        cur := null;
      else
        delete from public.split_line where split_id = ms and kind = 'send';
        changed := found;
      end if;
      if changed then
        update public.salary_split set version = version + 1, updated_at = now() where id = ms;
        perform public.sync_checklist(ms);
      end if;
    end loop;
    if js is not null then
      delete from public.split_line where split_id = js and kind = 'send';
      if found then
        perform public.sync_checklist(js);
      end if;
    end if;
    return;
  end if;
  if js is null then
    return;
  end if;
  if sp.manager_user_id is null then
    delete from public.split_line where split_id = js and kind = 'send';
    if found then
      perform public.sync_checklist(js);
    end if;
    return;
  end if;
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

-- 용돈 줄이 바뀌면(한 사람 관리형, 또는 각자 계열 ‘보내요’), save_split이 각자 보내기 줄을 지우면 다시
create or replace function public.recalc_send_line_allowance() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  sid uuid := coalesce(new.space_id, old.space_id);
  k public.split_line_kind := coalesce(new.kind, old.kind);
  sending boolean := exists (select 1 from public.app_user x where x.space_id = sid and x.send_intent_space = sid
                               and x.status = 'active');
begin
  if (k = 'allowance' and (sending or exists (
        select 1 from public.couple_space where id = sid and salary_mode = 'joint' and manager_user_id is not null)))
     or (tg_op = 'DELETE' and k = 'send' and sending
         and exists (select 1 from public.couple_space where id = sid and salary_mode = 'separate')) then
    perform public.recalc_send_line(sid);
  end if;
  return null;
end;
$$;

-- 관리 형태가 실제로 바뀌면 ‘보내요’ 기억을 지우고 보내기 줄을 모두 지운 뒤 새 형태로 다시(계약 6)
create or replace function public.apply_manage_style(p_space uuid, p_living boolean, p_saving boolean,
  p_mode public.salary_mode, p_manager uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  cur public.salary_mode := (select salary_mode from public.couple_space where id = p_space);
begin
  update public.app_user set send_intent_space = null where send_intent_space = p_space;
  delete from public.split_line l using public.salary_split s
    where s.id = l.split_id and s.space_id = p_space and l.kind = 'send';
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

-- ‘보내요’ 요청을 보내면 기억 + 보내기 줄, 보낸 사람이 취소하면(또는 새 요청으로 바뀌면) 지움
create function public.mode_request_send_intent() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.phrase <> 'p04_send' then
    return null;
  end if;
  if tg_op = 'INSERT' and new.status = 'open' then
    update public.app_user set send_intent_space = new.space_id where id = new.from_user;
    perform public.recalc_send_line(new.space_id);
  elsif tg_op = 'UPDATE' and old.status = 'open' and new.status = 'cancelled' then
    update public.app_user set send_intent_space = null where id = new.from_user and send_intent_space = new.space_id;
    perform public.recalc_send_line(new.space_id);
  end if;
  return null;
end;
$$;
create trigger mode_request_send_intent after insert or update of status on public.mode_change_request
  for each row execute function public.mode_request_send_intent();

-- 해제 확정·탈퇴로 공간이 바뀌면(move_owned_rows가 보내기 줄까지 옮김) 기억을 지우고 새 공간에서 다시 셈
create function public.app_user_space_send() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.space_id is distinct from old.space_id then
    update public.app_user set send_intent_space = null
      where id = new.id and send_intent_space is not null and send_intent_space is distinct from new.space_id;
    if new.space_id is not null then
      perform public.recalc_send_line(new.space_id);
    end if;
  end if;
  return null;
end;
$$;
create trigger app_user_space_send after update of space_id on public.app_user
  for each row execute function public.app_user_space_send();

-- ─────────────────────────── 7. S-12h 다시 시작은 O-30부터 ───────────────────────────
create or replace function public.start_after_unlink()
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  update public.app_user set onboarding_step = 'O-30', onboarding_done_at = null
    where id = auth.uid() and onboarding_step = 'S-12H';
end;
$$;

-- ─────────────────────────── 8. join_context member는 늘 boolean(B1) ───────────────────────────
-- 아직 공간에 들어오지 않은(space_id 없음) 합류자는 my = sid가 null이라 앱 Zod(boolean)가 거절해 P-03이 비고 다시 부름
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
    'member', coalesce(my = sid, false),
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
