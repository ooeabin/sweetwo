-- 달성 되돌리기(2026-11-09, docs/spec/20-salary-plan.md ‘달성과 그만 모음’, 06 5-4).
-- 체크로 목표 금액에 닿아 ‘달성’이 된 뒤, 아직 W-12a에서 고르지 않은 채(목표 금액 그대로, 그만 모음 아님)
-- 그 체크를 풀거나(되돌리기 Toast, W-02, 홈, W-10 어디서든) ‘못 함’으로 바꿔 모은 돈이 목표 금액 아래로 내려가면
-- ‘모으는 중’으로 되돌린다. 달성 알림도 지워서 다시 닿으면 축하와 알림이 한 번 더 간다.

create or replace function public.saving_unachieve(p_goal uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  g public.goal;
begin
  select * into g from public.goal where id = p_goal for update;
  if g.id is null or g.status <> 'achieved' or g.closed_at is not null or g.target_amount is null then
    return;
  end if;
  if public.goal_saved(g.id) >= g.target_amount then
    return;
  end if;
  update public.goal set status = 'active', achieved_at = null, achieved_seen = '{}' where id = g.id;
  delete from public.notification where dedupe like 'goal_achieved:' || g.id::text || ':%';
end;
$$;
revoke all on function public.saving_unachieve(uuid) from public, anon, authenticated;

create or replace function public.check_pay_line(p_line uuid, p_state text, p_actual bigint default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid uuid := (select space_id from public.app_user where id = auth.uid());
  l public.pay_check_line;
  c public.pay_checklist;
  was text;
  now_state text;
  who text := coalesce((select nickname from public.app_user where id = auth.uid()), '');
  other uuid;
begin
  select * into l from public.pay_check_line where id = p_line for update;
  if l.id is null or l.space_id is distinct from sid then
    raise exception 'no_line' using errcode = '42501';
  end if;
  select * into c from public.pay_checklist where id = l.checklist_id;
  -- 2026-11-03 대신 체크 없앰: 각자 모드 체크리스트는 주인만 체크(합쳐서 모드 공동 체크리스트는 둘 다)
  if c.owner_user_id is not null and c.owner_user_id <> uid then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if c.cycle_end < public.kst_today() or c.state = 'closed' then
    raise exception 'closed' using errcode = '22023';
  end if;
  if p_state not in ('checked', 'wait', 'skipped') then
    raise exception 'bad_state' using errcode = '22023';
  end if;
  if p_state = 'checked' and l.state = 'checked' and l.checked_by is distinct from uid then
    raise exception 'already_checked' using errcode = '40001';
  end if;
  if p_actual is not null and (p_actual < 0 or p_actual > 99999999999) then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  was := c.state;
  update public.pay_check_line set
    state = case when p_state = 'checked' and p_actual = 0 then 'skipped' else p_state end,
    actual = case when p_state = 'checked' and p_actual is not null and p_actual > 0 then p_actual end,
    checked_by = case when p_state = 'wait' then null else uid end,
    checked_at = case when p_state = 'wait' then null else now() end,
    on_behalf = p_state <> 'wait' and c.owner_user_id is not null and c.owner_user_id <> uid
  where id = p_line
  returning * into l;
  update public.pay_checklist set
    state = case when exists (select 1 from public.pay_check_line where checklist_id = c.id and state = 'wait') then 'open' else 'done' end
  where id = c.id
  returning state into now_state;

  -- 배우자 대신 체크(14): 주인에게, 줄마다 한 번
  if l.state = 'checked' and l.on_behalf then
    perform public.notify(c.owner_user_id, c.space_id, 'behalf_checked',
      who || '님이 대신 체크했어요',
      public.pay_line_noun(l.kind, l.goal_id, l.name) || '에 ' || public.read_won(coalesce(l.actual, l.planned)),
      '/salary', null, uid, 'behalf:' || l.id);
  end if;
  -- 배우자 체크 다 함(14, 인앱만): 각자 모드에서 주인이 마지막 줄을 끝냈을 때 상대에게, 사이클마다 한 번
  if was = 'open' and now_state = 'done' and c.owner_user_id = uid then
    select id into other from public.app_user
      where space_id = c.space_id and status = 'active' and id <> uid limit 1;
    if other is not null then
      perform public.notify(other, c.space_id, 'partner_done',
        who || '님이 ' || c.label || ' 체크를 다 했어요', null,
        '/salary?who=' || uid, null, uid, 'done:' || c.id);
    end if;
  end if;
  -- 2026-11-09: 체크를 풀거나 못 함으로 바꿔 모은 돈이 목표 금액 아래로 내려가면 달성을 되돌림
  if l.kind = 'saving' and l.goal_id is not null then
    perform public.saving_unachieve(l.goal_id);
  end if;
end;
$$;

