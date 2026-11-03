-- 2026-11-03 배우자 체크 다 함 알림 문구: ‘{월급}을 다 나눴어요’ → ‘{월급} 체크를 다 했어요’(‘나누기’ 말 정리). 함수 본문은 20261031090000과 같고 문구만 바꿈.
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
end;
$$;
