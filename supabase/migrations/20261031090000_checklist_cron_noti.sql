-- 월급 체크리스트 예약 작업과 알림(07 월 사이클, 14 알림, 20 W-02·W-05). 재기획(ADR 0003)으로 옛 월급 플랜·월말 정리 알림을 바꿈.
--   기준일 0시(pg_cron 0 15 * * * UTC): 분배표마다 이번 사이클 체크리스트를 만듦(앱을 안 열어도 생김). 지난 사이클은 닫힘
--   오전 9시(0 0 * * * UTC, send_morning_notifications): 챙길 날(두 사람), 월급날(그날 시작한 체크리스트 주인),
--     만기 D-60, 전세 계약 만기 6개월 전, 초대 코드 만료 3일·1일 전, 만료 다음 날
--   오후 8시(0 11 * * * UTC, send_evening_notifications): 월말 확인(다음 기준일 3일 전, 체크 안 한 줄이 있을 때만 1회)
--   즉시(check_pay_line): 배우자 대신 체크 → 주인, 각자 체크리스트를 다 하면 → 상대(인앱만)
-- 생활비 체크 알림 작업은 재기획으로 없앰(함수는 남기고 예약만 지움).
-- 배우자 변경 10분 묶기·주간 요약은 다음 단계.

-- ── 체크리스트 만들기: 공간·주인을 받는 내부 함수 + 앱이 부르는 start_checklist ─────────────
create or replace function public.make_checklist(p_space uuid, p_owner uuid, p_today date default null)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  sid uuid := p_space;
  split uuid;
  dday smallint;
  today date := coalesce(p_today, public.kst_today());
  s date;
  e date;
  nxt date;
  cl uuid;
begin
  select id into split from public.salary_split where space_id = sid and owner_user_id is not distinct from p_owner;
  if split is null then
    raise exception 'no_split' using errcode = '22023';
  end if;
  dday := public.cycle_day(sid, p_owner);
  if dday is null then
    return null;
  end if;
  s := public.cycle_date(dday, extract(year from today)::int, extract(month from today)::int);
  if s > today then
    s := public.cycle_date(dday, extract(year from today - interval '1 month')::int, extract(month from today - interval '1 month')::int);
  end if;
  nxt := public.cycle_date(dday, extract(year from s + interval '1 month')::int, extract(month from s + interval '1 month')::int);
  e := nxt - 1;

  select id into cl from public.pay_checklist
    where space_id = sid and owner_user_id is not distinct from p_owner and cycle_start = s;
  if cl is not null then
    return cl;
  end if;
  -- 관리 방식을 바꾼 달: 옛 방식 체크리스트가 아직 이번 사이클이면 그대로 두고 새 방식은 다음 월급날부터(20 ‘다시 계산되는 때’)
  if exists (
    select 1 from public.pay_checklist
    where space_id = sid and state <> 'closed' and cycle_end >= today
      and (owner_user_id is null) <> (p_owner is null)
  ) then
    return null;
  end if;
  -- 끝난 옛 방식 체크리스트도 닫음
  update public.pay_check_line set state = 'skipped'
    where state = 'wait' and checklist_id in (
      select id from public.pay_checklist
      where space_id = sid and (owner_user_id is null) <> (p_owner is null) and cycle_end < today);
  update public.pay_checklist set state = 'closed'
    where space_id = sid and (owner_user_id is null) <> (p_owner is null) and cycle_end < today and state <> 'closed';
  -- 지난 사이클은 끝남: 체크 안 한 줄은 ‘못 함’(07 4장)
  update public.pay_check_line set state = 'skipped'
    where state = 'wait' and checklist_id in (
      select id from public.pay_checklist
      where space_id = sid and owner_user_id is not distinct from p_owner and cycle_start < s);
  update public.pay_checklist set state = 'closed'
    where space_id = sid and owner_user_id is not distinct from p_owner and cycle_start < s and state <> 'closed';
  insert into public.pay_checklist (space_id, split_id, owner_user_id, cycle_start, cycle_end, label)
    values (sid, split, p_owner, s, e, extract(month from s)::int || '월 월급')
    returning id into cl;
  insert into public.pay_check_line (checklist_id, space_id, split_line_id, kind, goal_id, user_id, name, planned, sort)
    select cl, sid, l.id, l.kind, l.goal_id, l.user_id, l.name, l.amount, l.sort
    from public.split_line l
    where l.split_id = split and l.amount > 0;
  return cl;
end;
$$;
revoke all on function public.make_checklist(uuid, uuid, date) from public, anon, authenticated;

create or replace function public.start_checklist(p_owner uuid default null)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  sid uuid := (select space_id from public.app_user where id = auth.uid());
begin
  if sid is null then
    raise exception 'no_space' using errcode = '42501';
  end if;
  return public.make_checklist(sid, p_owner);
end;
$$;

-- 매일 0시(한국): 지금 관리 방식의 분배표마다(각자 = 주인 것, 합쳐서 = 공동 것) 이번 사이클 체크리스트.
-- 이미 있으면 그대로(멱등). 한 공간이 실패해도 다른 공간은 계속
create or replace function public.run_cycle_checklists(p_today date default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r record;
  cnt integer := 0;
begin
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
revoke all on function public.run_cycle_checklists(date) from public, anon, authenticated;

-- 체크리스트 줄 이름(알림 문구): 저금 = 목표 이름, 직접 추가 = 줄 이름.
-- 행 타입 하나만 받으면 PostgREST가 계산 열로 보므로 값으로 받음
create or replace function public.pay_line_noun(p_kind public.split_line_kind, p_goal uuid, p_name text)
returns text
language sql
stable
set search_path = ''
as $$
  select case p_kind
    when 'saving' then coalesce((select g.name from public.goal g where g.id = p_goal), p_name, '저금')
    when 'fixed' then '고정지출'
    when 'living' then '생활비'
    when 'allowance' then '용돈'
    else coalesce(p_name, '')
  end;
$$;
revoke all on function public.pay_line_noun(public.split_line_kind, uuid, text) from public, anon, authenticated;

-- ── 즉시: 체크(대신 체크 알림, 다 했어요 알림) ───────────────────────────────────
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
        who || '님이 ' || public.ko_obj(c.label) || ' 다 나눴어요', null,
        '/salary?who=' || uid, null, uid, 'done:' || c.id);
    end if;
  end if;
end;
$$;

-- ── 오전 9시 ────────────────────────────────────────────────────────────────
create or replace function public.send_morning_notifications(p_today date default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
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
  -- 챙길 날: 두 사람 모두(미합류면 있는 사람). 서프라이즈는 재기획으로 새로 안 만들지만 남은 것은 만든 사람만, OS 알림 숨김
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
        case when c.secret then '챙길 날 알림이 있어요' end, c.secret);
      cnt := cnt + 1;
    end loop;
  end loop;

  -- 월급날: 오늘 시작한 체크리스트의 주인(합쳐서 = 둘 다)
  for cl in
    select x.* from public.pay_checklist x
    join public.couple_space s on s.id = x.space_id and s.deleted_at is null
    where x.cycle_start = today and x.state <> 'closed'
  loop
    for u in
      select x.* from public.app_user x
      where x.space_id = cl.space_id and x.status = 'active' and (cl.owner_user_id is null or x.id = cl.owner_user_id)
    loop
      perform public.notify(u.id, cl.space_id, 'payday', '오늘은 월급날이에요', '분배표대로 보내고 체크해 주세요',
        '/salary', 'calendar-check', null, 'payday:' || cl.id || ':' || u.id);
      cnt := cnt + 1;
    end loop;
  end loop;

  -- 만기 D-60(명의자, 공동 명의면 둘 다) / 전세 계약 만기 6개월 전(둘 다)
  for a in
    select x.* from public.asset x
    join public.couple_space s on s.id = x.space_id and s.deleted_at is null
    where x.deleted_at is null and x.status = 'held' and x.maturity_date is not null
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

  -- 초대 코드: 만료 3일·1일 전 리마인드, 만료 다음 날(아직 합류 전일 때만, 가장 최근 코드만)
  for iv in
    select distinct on (x.space_id) x.* from public.invite x
    join public.couple_space s on s.id = x.space_id and s.deleted_at is null and s.couple_state = 'not_joined'
    where x.used_at is null and x.created_by is not null
    order by x.space_id, x.created_at desc
  loop
    select * into sp from public.couple_space where id = iv.space_id;
    n := (iv.expires_at at time zone 'Asia/Seoul')::date - today;
    if n in (3, 1) then
      perform public.notify(iv.created_by, iv.space_id, 'invite_remind', '초대 코드가 ' || n || '일 뒤 만료돼요',
        case when sp.partner_nickname is not null then sp.partner_nickname || '님에게 다시 보내 볼까요?' end,
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
$$;
revoke execute on function public.send_morning_notifications(date) from public, anon, authenticated;

-- ── 오후 8시: 월말 확인(다음 기준일 3일 전 = 사이클 끝 2일 전, 체크 안 한 줄이 있을 때만) ──────
create or replace function public.send_evening_notifications(p_today date default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
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
    select count(*) into left_n from public.pay_check_line where checklist_id = cl.id and state = 'wait';
    continue when left_n = 0;
    for u in
      select x.* from public.app_user x
      where x.space_id = cl.space_id and x.status = 'active' and (cl.owner_user_id is null or x.id = cl.owner_user_id)
    loop
      perform public.notify(u.id, cl.space_id, 'review_due',
        cl.label || '에서 체크 안 한 게 ' || left_n || '개 있어요', null,
        '/salary/review', 'clipboard-text', null, 'review:' || cl.id || ':' || u.id);
      cnt := cnt + 1;
    end loop;
  end loop;
  return cnt;
end;
$$;
revoke execute on function public.send_evening_notifications(date) from public, anon, authenticated;

-- ── 알림 묶음(설정 토글과 맞추는 생성 열) 다시 정의. silent = 인앱만(OS 알림 없음) ─────────────
-- 생성 열은 식만 바꿀 수 없어 같은 이름으로 지우고 다시 만듦(같은 마이그레이션 안이라 앱은 열이 없는 때를 보지 않음)
alter table public.notification drop column topic;
alter table public.notification add column topic text generated always as (
  case
    when kind in ('payday', 'review_due', 'first_goal', 'plan_ready', 'close_start', 'close_remind') then 'plan'
    when kind in ('behalf_checked', 'split_changed', 'salary_mode', 'cycle_day', 'goal_changed') then 'partner_change'
    when kind in ('partner_done') then 'silent'
    when kind in ('maturity', 'jeonse_end') then 'money'
    when kind = 'goal_achieved' then 'goal'
    when kind in ('partner_joined', 'invite_remind', 'invite_expired') then 'invite'
    when kind = 'care_day' then 'care_' || split_part(dedupe, ':', 4)
    when kind like 'proposal\_%' then 'proposal'
    else 'other'
  end
) stored;

-- ── 예약 ────────────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('cycle-checklists', '0 15 * * *', 'select public.run_cycle_checklists()');
    if exists (select 1 from cron.job where jobname = 'living-check-notifications') then
      perform cron.unschedule('living-check-notifications');
    end if;
  end if;
end;
$$;
