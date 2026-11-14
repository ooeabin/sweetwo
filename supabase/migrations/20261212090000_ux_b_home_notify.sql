-- 2026-11-13 실구동 사용성 B(홈·월급날 확인·알림·관리 형태). 함수 본문은 각 최신 정의(pg_get_functiondef)에서 아래만 바꿈.
--  1. pay_line_mine(새): 이 사람이 확인을 맡은 손 줄(core lineIsMine과 같음). 각자 목록 = 주인, 합쳐서 = 누구나(남의 용돈 줄 빼고),
--     한 사람 관리형(manager_user_id) = 관리하는 사람은 모든 줄, 관리하지 않는 쪽은 자기 줄(user_id = 나)만 (H2)
--  2. send_morning_notifications(월급날), send_evening_notifications(월급 전 확인), send_progress_news: pay_line_mine으로 셈.
--     관리하지 않는 쪽은 관리하는 사람 줄로 월급날·월급 전 확인 알림을 받지 않고 진행 소식만 (H2)
--  3. confirm_payday, check_pay_line: pay_line_mine 줄만 확인. 파트너 확인 끝 알림 문구 “{이름}님이 10월 25일 월급 확인을 마쳤어요”(14 v2.2)
--  4. noti_inapp_only + partner_activity: 주간 요약에만 가는 변경(경조사 추가·메모 등)은 푸시하지 않음(14 ‘주간 요약에만’)
--  5. apply_shared_account: 통장 몫이 늘어난 만큼 생활비 → 고정지출 줄을 줄임(M9). 줄 이름(M7)은 split_line.name이 직접 추가 줄만이라
--     앱이 shared_account_id로 분담 이름을 찾아 보여 줌
--  6. notify_joined: 합류 알림 본문을 공개 단계대로(M4)
-- 지금 안 쓰게 된 것(2단계 정리 대상): 없음.

create function public.pay_line_mine(p_kind text, p_user uuid, p_owner uuid, p_space uuid, p_uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when p_owner is not null then coalesce(p_owner = p_uid, false)
    when s.manager_user_id is not null then s.manager_user_id = p_uid or coalesce(p_user = p_uid, false)
    else not (p_kind = 'allowance' and p_user is not null and p_user <> p_uid)
  end
  from public.couple_space s where s.id = p_space;
$$;
revoke all on function public.pay_line_mine(text, uuid, uuid, uuid, uuid) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.send_morning_notifications(p_today date DEFAULT NULL::date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  today date := coalesce(p_today, public.kst_today());
  c public.care_day;
  cl public.pay_checklist;
  a public.asset;
  iv public.invite;
  sp public.couple_space;
  u public.app_user;
  d date;
  n integer;
  title text;
  cnt integer := 0;
begin
  -- 경조사: 두 사람 모두(미합류면 있는 사람). 서프라이즈는 재기획으로 새로 안 만들지만 남은 것은 만든 사람만, OS 알림 숨김
  for c in
    select x.* from public.care_day x
    join public.couple_space s on s.id = x.space_id and s.deleted_at is null
    where x.deleted_at is null and coalesce(array_length(x.alerts, 1), 0) > 0
  loop
    d := public.care_next_date(c, today);
    continue when d is null;
    n := d - today;
    continue when not (n = any (c.alerts));
    title := case n
      when 0 then '오늘은 ' || public.ko_is(c.name)
      when 7 then public.ko_subj(c.name) || ' 일주일 남았어요'
      when 14 then public.ko_subj(c.name) || ' 2주 남았어요'
      when 30 then public.ko_subj(c.name) || ' 한 달 남았어요'
      else public.ko_subj(c.name) || ' ' || n || '일 남았어요' end;
    for u in
      select x.* from public.app_user x
      where x.space_id = c.space_id and x.status = 'active' and (not c.secret or x.id = c.created_by)
    loop
      perform public.notify(
        u.id, c.space_id, 'care_day', title, case when n = 7 then '준비는 어떻게 되고 있나요?' end,
        '/calendar/day/' || c.id, 'gift', null,
        'care:' || c.id || ':' || d || ':' || n || ':' || u.id,
        case when c.secret then '경조사 알림이 있어요' end, c.secret);
      cnt := cnt + 1;
    end loop;
  end loop;

  -- 월급날: 오늘 시작한 체크리스트의 주인(합쳐서 = 둘 다). v2.2: 그 사람이 확인을 맡은 손 줄(pay_line_mine)이 1개 이상일 때만(F8).
  -- 한 사람 관리형 관리하지 않는 쪽은 관리하는 사람 줄로는 받지 않음(2026-11-13 UX B H2). 없으면 진행 소식(send_progress_news)
  for cl in
    select x.* from public.pay_checklist x
    join public.couple_space s on s.id = x.space_id and s.deleted_at is null
    where x.cycle_start = today and x.state <> 'closed'
      and exists (select 1 from public.pay_check_line l where l.checklist_id = x.id and not l.auto)
  loop
    for u in
      select x.* from public.app_user x
      where x.space_id = cl.space_id and x.status = 'active' and (cl.owner_user_id is null or x.id = cl.owner_user_id)
    loop
      continue when not exists (select 1 from public.pay_check_line l
        where l.checklist_id = cl.id and not l.auto and public.pay_line_mine(l.kind::text, l.user_id, cl.owner_user_id, cl.space_id, u.id));
      perform public.notify(u.id, cl.space_id, 'payday', '오늘은 월급날이에요',
        '계획대로 됐는지 한 번만 확인해 주세요', -- [확인 필요] v2.2 7-2
        '/salary', 'calendar-check', null, 'payday:' || cl.id || ':' || u.id);
      cnt := cnt + 1;
    end loop;
  end loop;

  -- 만기 D-60(명의자, 공동 명의면 둘 다) / 전세 계약 만기 6개월 전(둘 다)
  for a in
    select x.* from public.asset x
    join public.couple_space s on s.id = x.space_id and s.deleted_at is null
    where x.deleted_at is null and x.status = 'held' and x.side = 'asset' and x.maturity_date is not null
      and ((x.kind = 'deposit_money' and x.maturity_date = (today + interval '6 months')::date)
        or (x.kind <> 'deposit_money' and x.maturity_date = today + 60))
  loop
    for u in
      select x.* from public.app_user x
      where x.space_id = a.space_id and x.status = 'active'
        and (a.kind = 'deposit_money' or a.owner <> 'person' or x.id = a.owner_user_id)
    loop
      if a.kind = 'deposit_money' then
        perform public.notify(u.id, a.space_id, 'jeonse_end', '전세 계약이 6개월 뒤 끝나요',
          '연장할지, 이사나 매수할지 정해 볼까요?', '/assets/' || a.id, 'house', null,
          'jeonse:' || a.id || ':' || a.maturity_date || ':' || u.id);
      else
        perform public.notify(u.id, a.space_id, 'maturity', public.ko_subj(a.name) || ' 두 달 뒤 만기예요', null,
          '/assets/' || a.id, 'piggy-bank', null, 'maturity:' || a.id || ':' || a.maturity_date || ':' || u.id);
      end if;
      cnt := cnt + 1;
    end loop;
  end loop;

  -- 만기일 당일: 만기된 돈 정리(F-04a) → 명의자(공동 명의면 둘 다). 전세 보증금은 빼고
  for a in
    select x.* from public.asset x
    join public.couple_space s on s.id = x.space_id and s.deleted_at is null
    where x.deleted_at is null and x.status = 'held' and x.side = 'asset'
      and x.kind <> 'deposit_money' and x.maturity_date = today
  loop
    for u in
      select x.* from public.app_user x
      where x.space_id = a.space_id and x.status = 'active' and (a.owner <> 'person' or x.id = a.owner_user_id)
    loop
      perform public.notify(u.id, a.space_id, 'matured', public.ko_subj(a.name) || ' 만기됐어요',
        '어디로 옮겼는지 알려 주세요', '/assets/' || a.id || '/matured', 'piggy-bank', null,
        'matured:' || a.id || ':' || a.maturity_date || ':' || u.id);
      cnt := cnt + 1;
    end loop;
  end loop;

  -- 연말정산 준비: 1월 둘째 주 월요일(8~14일 월요일), 결혼한 부부 두 사람 → 체크리스트 ‘연말정산’ 항목
  if extract(month from today) = 1 and extract(isodow from today) = 1 and extract(day from today) between 8 and 14 then
    for u in
      select x.* from public.app_user x
      join public.couple_space s on s.id = x.space_id and s.deleted_at is null and s.marriage_status = 'married'
      where x.status = 'active'
    loop
      perform public.notify(u.id, u.space_id, 'year_end_tax', '연말정산을 준비할 때예요',
        '공제를 누구에게 모을지 정해 볼까요?', '/settings/guides/check/year-end-tax', 'receipt', null,
        'tax:' || u.space_id || ':' || extract(year from today)::int || ':' || u.id);
      cnt := cnt + 1;
    end loop;
  end if;

  -- 초대 코드: 만료 3일·1일 전 리마인드, 만료 다음 날(아직 합류 전일 때만, 가장 최근 코드만)
  for iv in
    select distinct on (x.space_id) x.* from public.invite x
    join public.couple_space s on s.id = x.space_id and s.deleted_at is null and s.couple_state = 'not_joined'
    where x.used_at is null and x.created_by is not null
    order by x.space_id, x.created_at desc
  loop
    -- 누군가 합류하는 중(코드를 잡아 둠)이면 보내지 않음(D1)
    continue when iv.used_by is not null or (iv.reserved_by is not null and iv.reserved_until > now());
    select * into sp from public.couple_space where id = iv.space_id;
    n := (iv.expires_at at time zone 'Asia/Seoul')::date - today;
    if n in (3, 1) then
      perform public.notify(iv.created_by, iv.space_id, 'invite_remind', '초대 코드가 ' || n || '일 뒤 만료돼요',
        coalesce(sp.partner_nickname || '님에게', '파트너에게') || ' 다시 보내 볼까요?',
        '/settings/couple', 'user-plus', null, 'invite:' || iv.id || ':remind:' || n);
      cnt := cnt + 1;
    elsif n = -1 then
      perform public.notify(iv.created_by, iv.space_id, 'invite_expired', '초대 코드가 만료됐어요',
        '새 코드를 만들어 다시 보낼까요?', '/settings/couple', 'user-plus', null, 'invite:' || iv.id || ':expired');
      cnt := cnt + 1;
    end if;
  end loop;
  return cnt;
end;
$function$;

CREATE OR REPLACE FUNCTION public.send_evening_notifications(p_today date DEFAULT NULL::date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  today date := coalesce(p_today, public.kst_today());
  cl public.pay_checklist;
  u public.app_user;
  left_n integer;
  cnt integer := 0;
begin
  for cl in
    select x.* from public.pay_checklist x
    join public.couple_space s on s.id = x.space_id and s.deleted_at is null
    where x.cycle_end - 2 = today and x.state = 'open'
  loop
    for u in
      select x.* from public.app_user x
      where x.space_id = cl.space_id and x.status = 'active' and (cl.owner_user_id is null or x.id = cl.owner_user_id)
    loop
      -- 그 사람이 확인을 맡은 손 줄만(pay_line_mine: 합쳐서 남의 용돈 줄 빼고, 한 사람 관리형 관리하지 않는 쪽은 자기 줄만)
      select count(*) into left_n from public.pay_check_line l
        where l.checklist_id = cl.id and l.state = 'wait' and not l.auto
          and public.pay_line_mine(l.kind::text, l.user_id, cl.owner_user_id, cl.space_id, u.id);
      continue when left_n = 0;
      -- 2026-11-12 D3: 알림이 가리킨 체크리스트만 W-05에(기간이 지났거나 끝난 사이클이면 앱이 W-02로)
      perform public.notify(u.id, cl.space_id, 'review_due',
        public.md_label(cl.cycle_start) || ' 월급에서 확인할 게 ' || left_n || '개 남았어요', null, -- [확인 필요] v2.2 7-2
        '/salary/review?checklist=' || cl.id, 'clipboard-text', null, 'review:' || cl.id || ':' || u.id);
      cnt := cnt + 1;
    end loop;
  end loop;
  return cnt;
end;
$function$;

CREATE OR REPLACE FUNCTION public.send_progress_news(p_today date DEFAULT NULL::date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  today date := coalesce(p_today, public.kst_today());
  cl public.pay_checklist;
  u public.app_user;
  h record;
  cnt integer := 0;
begin
  for cl in
    select x.* from public.pay_checklist x
    join public.couple_space s on s.id = x.space_id and s.deleted_at is null
    where x.cycle_start = today and x.state <> 'closed'
  loop
    for u in
      select x.* from public.app_user x
      where x.space_id = cl.space_id and x.status = 'active' and (cl.owner_user_id is null or x.id = cl.owner_user_id)
        and public.push_kind_on(x.push_kinds, 'progress_news')
    loop
      -- 그 사람이 확인을 맡은 손 줄이 없을 때만(월급날 알림 대신, 2026-11-13 UX B H2: 관리하지 않는 쪽 포함)
      continue when exists (select 1 from public.pay_check_line l
        where l.checklist_id = cl.id and not l.auto and public.pay_line_mine(l.kind::text, l.user_id, cl.owner_user_id, cl.space_id, u.id));
      select * into h from public.progress_hero(u.id);
      continue when h.goal_id is null;
      perform public.notify(u.id, cl.space_id, 'progress_news', '월급날이에요', -- [확인 필요] v2.2 7-2
        h.name || ' ' || h.pct || '%까지 왔어요', '/', 'piggy-bank', null,
        'progress:' || cl.id || ':' || u.id);
      cnt := cnt + 1;
      h := null;
    end loop;
  end loop;
  -- 날짜 없는 사람(확인 목록 없음): 매달 1일
  if extract(day from today) = 1 then
    for u in
      select x.* from public.app_user x
      join public.couple_space s on s.id = x.space_id and s.deleted_at is null
      where x.status = 'active' and x.payday_none and public.push_kind_on(x.push_kinds, 'progress_news')
        and public.cycle_day(x.space_id, case when s.salary_mode = 'joint' then null else x.id end) is null
    loop
      select * into h from public.progress_hero(u.id);
      continue when h.goal_id is null;
      perform public.notify(u.id, u.space_id, 'progress_news', '이번 달 진행 소식이에요', -- [확인 필요]
        h.name || ' ' || h.pct || '%까지 왔어요', '/', 'piggy-bank', null,
        'progress:none:' || u.id || ':' || to_char(today, 'YYYY-MM'));
      cnt := cnt + 1;
      h := null;
    end loop;
  end if;
  return cnt;
end;
$function$;

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
    raise exception 'already_checked' using errcode = '40001';
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

create or replace function public.noti_inapp_only(p_kind text)
returns boolean language sql immutable set search_path = '' as $$
  select p_kind in ('salary_changed', 'mode_result', 'saving_adjusted', 'bundle_created', 'bundle_changed', 'split_result',
                    'weekly_saving', 'partner_activity');
$$;

CREATE OR REPLACE FUNCTION public.apply_shared_account(p_account uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  a public.shared_account;
  joint boolean;
  sp public.salary_split;
  amt bigint;
  lid uuid;
  prev bigint;
  cut bigint;
  ln public.split_line;
begin
  select * into a from public.shared_account where id = p_account;
  select salary_mode = 'joint' into joint from public.couple_space where id = a.space_id;
  for sp in select x.* from public.salary_split x
    where x.space_id = a.space_id and ((joint and x.owner_user_id is null)
      or (not joint and x.owner_user_id in (a.member_a, a.member_b)))
  loop
    amt := case when joint then a.monthly_total when sp.owner_user_id = a.member_a then a.share_a else a.share_b end;
    select id into lid from public.split_line where split_id = sp.id and kind = 'shared_account'
      and (shared_account_id = a.id or shared_account_id is null) order by shared_account_id nulls last limit 1;
    prev := coalesce((select amount from public.split_line where id = lid), 0);
    if lid is null then
      insert into public.split_line (split_id, space_id, kind, amount, sort, shared_account_id)
        values (sp.id, a.space_id, 'shared_account', amt,
          (select coalesce(max(sort), -1) + 1 from public.split_line where split_id = sp.id), a.id);
    else
      update public.split_line set amount = amt, shared_account_id = a.id where id = lid;
    end if;
    -- 같이 쓰는 통장 몫이 늘어난 만큼 그 월급 계획의 생활비 → 고정지출 줄을 줄임(0원 아래로는 안 감, 06 3-7, 2026-11-13 UX B M9)
    -- [확인 필요] 같은 돈을 생활비와 통장 몫으로 두 번 잡지 않게
    cut := greatest(amt - prev, 0);
    for ln in select x.* from public.split_line x
      where x.split_id = sp.id and x.kind in ('living', 'fixed') and x.amount > 0
      order by case when x.kind = 'living' then 0 else 1 end, x.sort
    loop
      exit when cut <= 0;
      update public.split_line set amount = amount - least(amount, cut) where id = ln.id;
      cut := cut - least(ln.amount, cut);
    end loop;
    lid := null;
    update public.salary_split set version = version + 1, updated_at = now() where id = sp.id;
    perform public.sync_checklist(sp.id);
  end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_joined()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  joiner public.app_user;
begin
  if old.couple_state = 'not_joined' and new.couple_state = 'connected' then
    select * into joiner from public.app_user
      where space_id = new.id and status = 'active' and id <> new.created_by limit 1;
    if joiner.id is null or new.created_by is null then return new; end if;
    perform public.notify(
      new.created_by, new.id, 'partner_joined',
      coalesce(coalesce(joiner.nickname, new.partner_nickname) || '님이', '파트너가') || ' 합류했어요',
      -- 2026-11-13 UX B M4: 합류한 사람이 실제로 보여 주는 만큼만(같이 계열·모두 = 월급 계획과 저금, 저금만, 했어요만) [확인 필요]
      case
        when new.salary_mode = 'joint' or joiner.plan_share = 'all' then '이제 월급 계획과 저금을 같이 봐요'
        when joiner.plan_share = 'saving_only' then '이제 저금을 같이 봐요'
        else '이제 같이 모은 걸 같이 봐요'
      end, '/', null, joiner.id, 'joined:' || new.id || ':' || joiner.id);
  end if;
  return new;
end;
$function$;
