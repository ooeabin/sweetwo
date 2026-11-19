-- 2026-11-20 사용자 결정: 월급날 확인을 하면 그 사이클의 월급을 수입(money_in)으로 자동 기록한다.
-- (수입 기록이 0원인데 W-02가 “이번 달도 계획대로!”라고 하는 모순 없앰.) 스키마는 추가만.
--  1. money_in.source ('manual' 기본 | 'payday_auto'): 자동 기록 표시(W-02 수입 카드·W-20b “자동”).
--  2. pay_checklist.auto_income_at: 이 사이클에 자동 수입을 한 번 넣었음(지운 뒤 다시 확인해도 다시 안 넣음, 체크를 풀어도 그대로).
--  3. pay_auto_income(checklist) 내부 함수: 각자 = 그 목록 주인 한 줄, 합쳐서 = 월급이 0보다 큰 활동 중인 두 사람 각자 한 줄.
--     날짜 = 그 사이클 월급날(cycle_start, 오늘보다 뒤면 오늘), 금액 = 그 시점 app_user.monthly_income, 종류 salary,
--     저축·투자 배정(goal_move) 없음 = 모은 금액에 안 들어감. 알림·활동 기록 없음.
--  4. check_pay_line(확인·건너뜀·다른 금액), confirm_payday가 부름. 자동 줄의 자동 확인(auto_confirm_due_lines)은 부르지 않음.
--  5. log_money_in 멱등 검사는 직접 적은 기록(source = manual)만 봄. admin_metrics 수입 적기 사용률도 직접 적은 기록만.
alter table public.money_in
  add column source text not null default 'manual' check (source in ('manual', 'payday_auto'));
comment on column public.money_in.source is 'manual = 직접 적음, payday_auto = 월급날 확인으로 자동 기록(2026-11-20)';
alter table public.pay_checklist add column auto_income_at timestamptz;
comment on column public.pay_checklist.auto_income_at is '월급날 확인 때 자동 수입 기록을 넣은 때(사이클에 한 번, 지워도 다시 안 넣음)';

create function public.pay_auto_income(p_checklist uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  c public.pay_checklist;
  u record;
  on_ date;
  n integer := 0;
begin
  select * into c from public.pay_checklist where id = p_checklist for update;
  if c.id is null or c.auto_income_at is not null then
    return 0;
  end if;
  on_ := least(c.cycle_start, public.kst_today());
  for u in
    select a.id, a.monthly_income from public.app_user a
    where a.space_id = c.space_id and a.status = 'active'
      and (c.owner_user_id is null or a.id = c.owner_user_id)
      and coalesce(a.monthly_income, 0) > 0
  loop
    if not exists (select 1 from public.money_in m
        where m.owner_user_id = u.id and m.source = 'payday_auto' and m.received_on = on_) then
      insert into public.money_in (space_id, owner_user_id, amount, received_on, kind, source)
        values (c.space_id, u.id, u.monthly_income, on_, 'salary', 'payday_auto');
      n := n + 1;
    end if;
  end loop;
  if n > 0 then
    update public.pay_checklist set auto_income_at = now() where id = c.id;
  end if;
  return n;
end;
$$;
revoke all on function public.pay_auto_income(uuid) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.confirm_payday(p_checklist uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := auth.uid();
  sid uuid := (select space_id from public.app_user where id = auth.uid());
  today date := public.kst_today();
  c public.pay_checklist;
  late_ boolean;
  n integer;
  manual_before integer;
  manual_after integer;
  who text := (select nickname from public.app_user where id = auth.uid());
  other uuid;
  mixed boolean;
begin
  select * into c from public.pay_checklist where id = p_checklist for update;
  if c.id is null or c.space_id is distinct from sid then
    raise exception 'no_checklist' using errcode = '42501';
  end if;
  if c.owner_user_id is not null and c.owner_user_id <> uid then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if (select couple_state from public.couple_space where id = sid) = 'unlink_pending' and c.owner_user_id is null then
    raise exception 'unlink_pending' using errcode = '42501';
  end if;
  late_ := c.cycle_end < today;
  if (late_ and today > public.late_check_until(c.id)) or (not late_ and c.state = 'closed') then
    raise exception 'closed' using errcode = '22023';
  end if;
  select count(*) filter (where state = 'wait' and not auto) into manual_before
    from public.pay_check_line where checklist_id = c.id;
  -- 남은 손 줄: 지금 사이클은 wait, 지난 사이클은 닫을 때 서버가 건너뜀으로 바꾼 줄(checked_by 없음)도
  update public.pay_check_line set state = 'checked', actual = null, checked_by = uid, checked_at = now(),
      on_behalf = false, late = late_
    where checklist_id = c.id and not auto
      and (state = 'wait' or (late_ and state = 'skipped' and checked_by is null))
      and public.pay_line_mine(kind::text, user_id, c.owner_user_id, c.space_id, uid);
  get diagnostics n = row_count;
  update public.pay_checklist set confirmed_at = now(), confirmed_by = uid where id = c.id;
  perform public.checklist_restate(c.id);
  -- 2026-11-20: 사람이 확인한 순간 그 사이클 월급을 수입 기록으로 한 번 넣음(자동 확인은 이 함수를 안 지남)
  perform public.pay_auto_income(c.id);
  select count(*) filter (where state = 'wait' and not auto) into manual_after
    from public.pay_check_line where checklist_id = c.id;
  if not late_ and manual_before > 0 and manual_after = 0 and c.owner_user_id = uid then
    select id into other from public.app_user
      where space_id = c.space_id and status = 'active' and id <> uid limit 1;
    if other is not null then
      mixed := exists (select 1 from public.pay_check_line where checklist_id = c.id and state = 'skipped');
      perform public.notify(other, c.space_id, 'partner_done',
        coalesce(who || '님이', '파트너가') || ' ' || public.md_label(c.cycle_start) || ' 월급 확인을 마쳤어요', -- [확인 필요] 14 v2.2 표(2026-11-13 UX B ‘체크’ 말 없앰)
        null, '/salary?who=' || uid, null, uid, 'done:' || c.id);
    end if;
  end if;
  return n;
end;
$function$;

CREATE OR REPLACE FUNCTION public.check_pay_line(p_line uuid, p_state text, p_actual bigint DEFAULT NULL::bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := auth.uid();
  sid uuid := (select space_id from public.app_user where id = auth.uid());
  today date := public.kst_today();
  l public.pay_check_line;
  c public.pay_checklist;
  late_ boolean;
  manual_before integer;
  manual_after integer;
  who text := (select nickname from public.app_user where id = auth.uid());
  other uuid;
  mixed boolean;
  to_state text;
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
  -- 합쳐서 용돈 줄은 그 주인만(B7, 한 사람 관리형은 관리하는 사람도). 한 사람 관리형 관리하지 않는 쪽은 자기 줄만(2026-11-13 UX B H2)
  if c.owner_user_id is null and not public.pay_line_mine(l.kind::text, l.user_id, null, c.space_id, uid) then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  late_ := c.cycle_end < today;
  if (late_ and today > public.late_check_until(c.id)) or (not late_ and c.state = 'closed') then
    raise exception 'closed' using errcode = '22023';
  end if;
  if p_state not in ('checked', 'wait', 'skipped') then
    raise exception 'bad_state' using errcode = '22023';
  end if;
  -- 남이 체크한 줄(자동 확인 줄은 checked_by가 없어 고칠 수 있음)
  if p_state = 'checked' and l.state = 'checked' and l.checked_by is not null and l.checked_by <> uid then
    raise exception 'already_checked' using errcode = 'P0001';
  end if;
  if p_actual is not null and (p_actual < 0 or p_actual > 99999999999) then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  select count(*) filter (where state = 'wait' and not auto) into manual_before
    from public.pay_check_line where checklist_id = c.id;
  to_state := case when p_state = 'checked' and p_actual = 0 then 'skipped'
                   when p_state = 'wait' and (late_ or c.state = 'closed') then 'skipped'
                   else p_state end;
  update public.pay_check_line set
    state = to_state,
    actual = case when p_state = 'checked' and p_actual is not null and p_actual > 0 then p_actual end,
    checked_by = case when to_state = 'wait' or (p_state = 'wait' and late_) then null else uid end,
    checked_at = case when to_state = 'wait' or (p_state = 'wait' and late_) then null else now() end,
    on_behalf = false,
    late = late_ and p_state <> 'wait'
  where id = p_line
  returning * into l;
  perform public.checklist_restate(c.id);
  -- 2026-11-20: 확인·건너뜀·다른 금액이면(체크를 푸는 것은 아님) 그 사이클 월급을 수입 기록으로 한 번 넣음
  if p_state <> 'wait' then
    perform public.pay_auto_income(c.id);
  end if;
  select count(*) filter (where state = 'wait' and not auto) into manual_after
    from public.pay_check_line where checklist_id = c.id;

  -- 파트너 체크 다 함(14, 인앱만, B2): 각자 모드에서 주인이 마지막 손 줄을 끝냈을 때 상대에게, 사이클마다 한 번.
  -- 자동 확인으로는 없음. ‘건너뜀’이 섞이면 “마쳤어요”, 모두 체크면 “다 했어요”(2026-11-12 D4)
  if not late_ and manual_before > 0 and manual_after = 0 and c.owner_user_id = uid then
    select id into other from public.app_user
      where space_id = c.space_id and status = 'active' and id <> uid limit 1;
    if other is not null then
      mixed := exists (select 1 from public.pay_check_line where checklist_id = c.id and state = 'skipped');
      perform public.notify(other, c.space_id, 'partner_done',
        coalesce(who || '님이', '파트너가') || ' ' || public.md_label(c.cycle_start) || ' 월급 확인을 마쳤어요', -- [확인 필요] 14 v2.2 표(2026-11-13 UX B)
        null, '/salary?who=' || uid, null, uid, 'done:' || c.id);
    end if;
  end if;
  -- 2026-11-09: 체크를 풀거나 못 함으로 바꿔 모은 금액이 목표 금액 아래로 내려가면 달성을 되돌림
  if l.kind = 'saving' and l.goal_id is not null then
    perform public.saving_unachieve(l.goal_id);
  end if;
end;
$function$;


-- log_money_in: 멱등 검사는 직접 적은 기록만(자동 월급 기록과 같은 값이어도 새로 적을 수 있음)
create or replace function public.log_money_in(p_amount bigint, p_received_on date default null, p_kind public.money_in_kind default 'etc')
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  sid uuid := (select space_id from public.app_user where id = auth.uid());
  rid uuid;
  on_ date := coalesce(p_received_on, public.kst_today());
  k public.money_in_kind := coalesce(p_kind, 'etc');
begin
  if sid is null then
    raise exception 'no_space' using errcode = '42501';
  end if;
  if p_amount is null or p_amount < 1 or p_amount > 99999999999 then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  if on_ > public.kst_today() then
    raise exception 'future_date' using errcode = '22023';
  end if;
  select m.id into rid from public.money_in m
    where m.owner_user_id = uid and m.deleted_at is null and m.source = 'manual'
      and m.amount = p_amount and m.received_on = on_ and m.kind = k
      and m.created_at > now() - interval '1 hour'
      and not exists (select 1 from public.goal_move g where g.money_in_id = m.id and g.deleted_at is null)
    order by m.created_at desc limit 1;
  if rid is not null then
    return rid;
  end if;
  insert into public.money_in (space_id, owner_user_id, amount, received_on, kind)
    values (sid, uid, p_amount, on_, k)
    returning id into rid;
  return rid;
end;
$$;
grant execute on function public.log_money_in(bigint, date, public.money_in_kind) to authenticated;

-- admin_metrics: ‘수입 적기 사용’은 직접 적은 기록만(자동 월급 기록은 사용이 아님)
do $$
declare
  d text;
  d2 text;
begin
  d := pg_get_functiondef('public.admin_metrics(integer)'::regprocedure);
  d2 := replace(d, 'where mi.owner_user_id = u.id and mi.deleted_at is null' || chr(10) || '          and mi.received_on >= m0) as used',
                   'where mi.owner_user_id = u.id and mi.deleted_at is null and mi.source = ''manual''' || chr(10) || '          and mi.received_on >= m0) as used');
  if d2 = d then
    raise exception 'admin_metrics money_in 조각을 못 찾음';
  end if;
  execute d2;
end;
$$;
