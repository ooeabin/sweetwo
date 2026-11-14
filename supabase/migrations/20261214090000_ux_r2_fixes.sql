-- 실구동 재테스트 2차 고침(R1, R3, 2026-11-14). 스키마는 추가만(표·열 없음, 함수만 고침·더함).
--
-- ■ 계약(앱이 같은 결과)
--  1. R1 합류 완료 비교 기준: complete_join은 p_version을 합류한 사람이 본 공동 월급 계획 version, 곧 공간에 넣기(_accept_join)
--     전의 version과 비교한다. 공간에 넣으면 한 사람 관리형(‘제가 주로 해요’)은 합류한 사람 보내기 줄이 생겨 version이 오르는데,
--     예전에는 오른 뒤 값과 비교해 늘 split_changed였다(합류가 P-05c에서 멈춤).
--  2. 다시 하라는 오류(split_changed, already_checked, goal_used)의 SQLSTATE를 40001(serialization_failure) 대신 P0001로.
--     PostgREST는 40001이 나면 같은 요청을 끝없이 다시 돌려(트랜잭션 재시도) 앱은 응답을 못 받고 멈추고 DB 연결을 붙잡는다.
--     앱은 메시지로만 가르므로(packages/api) 바뀌는 것 없음.
--  3. R3 월급날 앞당기기: 앞당기기(couple_space.holiday_shift)가 켜져 있으면 확인 목록은 앞당긴 날(주말·공휴일이면 직전 영업일)에
--     생기고 cycle_start = 앞당긴 날, cycle_end = 다음 앞당긴 날 − 1일. 그래서 월급날 아침 알림·진행 소식(cycle_start = 오늘),
--     월급 전 확인(cycle_end − 2 = 오늘), 자동 줄 기본 나가는 날(= cycle_start), 제목(md_label(cycle_start))이 모두 앱
--     useShownPayday와 같은 날. 첫 사이클 소급 없음(checklist_from)도 앞당긴 날로 비교. 늦은 확인 마지막 날도 앞당긴 날 − 1일.
--     core firstChecklistStart·lateCheckUntil(shift)와 같은 결과. 바꾸기 전에 원래 날로 만든 이번 사이클 목록이 있으면 그대로 씀.

-- ─────────────────────────── 1. 합류 완료 version ───────────────────────────
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
  -- 합류한 사람이 본 version(join_context)은 공간에 들어가기 전 값(계약 1)
  select version into v from public.salary_split where space_id = sid and owner_user_id is null;
  perform public._accept_join(sid);
  perform public.claim_pending_manager(sid, uid);
  select salary_mode into mode from public.couple_space where id = sid;
  if p_lines is not null then
    if mode = 'joint' then
      if p_version is not null and v is distinct from p_version then
        raise exception 'split_changed' using errcode = 'P0001';
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

-- ─────────────────────────── 2. 40001 대신 P0001 ───────────────────────────
-- 함수 본문은 그대로 두고 SQLSTATE만 바꿈(권한·주인은 create or replace가 그대로 둠)
do $$
declare
  f record;
  d text;
begin
  for f in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('check_pay_line', 'finish_goal_use')
  loop
    d := pg_get_functiondef(f.oid);
    if position('errcode = ''40001''' in d) > 0 then
      execute replace(d, 'errcode = ''40001''', 'errcode = ''P0001''');
    end if;
  end loop;
end;
$$;

-- ─────────────────────────── 3. 월급날 앞당기기 ───────────────────────────
-- 그 공간의 그 달 사이클 시작일: 원래 날(cycle_date), 앞당기기가 켜져 있으면 주말·공휴일이면 직전 영업일
create function public.shifted_cycle_date(p_space uuid, p_day smallint, y integer, m integer)
returns date language sql stable set search_path = '' as $$
  select case when coalesce((select s.holiday_shift from public.couple_space s where s.id = p_space), true)
    then public.business_day_on_or_before(public.cycle_date(p_day, y, m))
    else public.cycle_date(p_day, y, m) end;
$$;
revoke all on function public.shifted_cycle_date(uuid, smallint, integer, integer) from public, anon, authenticated;

-- 20261201090000과 같고 사이클 경계만 앞당긴 날(계약 3)
create or replace function public.make_checklist(p_space uuid, p_owner uuid, p_today date default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  sid uuid := p_space;
  split uuid;
  from_ date;
  dday smallint;
  today date := coalesce(p_today, public.kst_today());
  base date := date_trunc('month', coalesce(p_today, public.kst_today()))::date;
  k integer;
  mon date;
  s date;
  e date;
  nom date;
  cl uuid;
begin
  select id, checklist_from into split, from_ from public.salary_split
    where space_id = sid and owner_user_id is not distinct from p_owner;
  if split is null then
    raise exception 'no_split' using errcode = '22023';
  end if;
  -- 날짜 없는 사람은 cycle_day가 null(계약 3)
  dday := public.cycle_day(sid, p_owner);
  if dday is null then
    return null;
  end if;
  -- 오늘 이전(오늘 포함) 가장 늦은 앞당긴 기준일. 다음 달 1일이 앞당겨져 이번 달 말일 근처가 될 수 있어 다음 달까지 봄
  for k in reverse 1..-1 loop
    mon := (base + make_interval(months => k))::date;
    s := public.shifted_cycle_date(sid, dday, extract(year from mon)::int, extract(month from mon)::int);
    exit when s <= today;
  end loop;
  nom := public.cycle_date(dday, extract(year from mon)::int, extract(month from mon)::int);
  e := public.shifted_cycle_date(sid, dday, extract(year from mon + interval '1 month')::int,
                                 extract(month from mon + interval '1 month')::int) - 1;

  -- 이미 있으면 그것(앞당기기 전 원래 날로 만든 이번 사이클 목록 포함)
  select id into cl from public.pay_checklist
    where space_id = sid and owner_user_id is not distinct from p_owner and cycle_start between s and nom
    order by cycle_start limit 1;
  if cl is not null then
    return cl;
  end if;
  -- 첫 사이클 소급 없음(계약 2, D1): 월급 계획을 만들기 전에 시작한 사이클은 만들지 않음
  if from_ is not null and s < from_ then
    return null;
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
  -- 지난 사이클은 끝남: 확인 안 한 줄은 ‘건너뜀’(skipped). 다음 사이클 끝까지 늦게 확인할 수 있음(계약 9)
  update public.pay_check_line set state = 'skipped'
    where state = 'wait' and checklist_id in (
      select id from public.pay_checklist
      where space_id = sid and owner_user_id is not distinct from p_owner and cycle_start < s);
  -- 원래 날로 끝을 잡아 둔 지난 목록은 앞당긴 날 전날에 끝(두 목록이 겹치지 않게)
  update public.pay_checklist set state = 'closed', cycle_end = least(cycle_end, s - 1)
    where space_id = sid and owner_user_id is not distinct from p_owner and cycle_start < s
      and (state <> 'closed' or cycle_end >= s);
  insert into public.pay_checklist (space_id, split_id, owner_user_id, cycle_start, cycle_end, label)
    values (sid, split, p_owner, s, e, extract(month from s)::int || '월 월급')
    returning id into cl;
  -- ‘체크리스트에 넣기’를 끈 줄은 빼고(D2), 자동 줄은 나가는 날을 기다림(F7)
  insert into public.pay_check_line (checklist_id, space_id, split_line_id, kind, goal_id, user_id, name, planned, sort,
                                     auto, auto_due)
    select cl, sid, l.id, l.kind, l.goal_id, l.user_id, l.name, l.amount, l.sort,
      l.auto_pay, case when l.auto_pay then public.auto_due_date(s, e, l.auto_day) end
    from public.split_line l
    where l.split_id = split and l.amount > 0 and l.in_checklist;
  -- 예약 작업보다 늦게 만들어졌어도 이미 나간 자동 줄은 바로 확인
  perform public.confirm_auto_lines(cl, today);
  return cl;
end;
$$;

-- 늦은 확인 마지막 날 = 그다음 사이클의 끝(앞당긴 날 − 1일, 계약 3). core lateCheckUntil(shift)와 같음
create or replace function public.late_check_until(p_checklist uuid)
returns date language plpgsql stable security definer set search_path = '' as $$
declare
  c public.pay_checklist;
  d smallint;
  nxt date;
  mon date;
begin
  select * into c from public.pay_checklist where id = p_checklist;
  if c.id is null then
    return null;
  end if;
  nxt := c.cycle_end + 1;
  d := public.cycle_day(c.space_id, c.owner_user_id);
  if d is null then
    return (nxt + interval '1 month')::date - 1;
  end if;
  -- 다음 사이클 시작(nxt)은 앞당겨 그 전 달 말일일 수 있음: 그다음 사이클은 nxt + 1달에서 가장 가까운 달
  mon := date_trunc('month', nxt + interval '1 month')::date;
  if public.shifted_cycle_date(c.space_id, d, extract(year from mon)::int, extract(month from mon)::int) <= nxt then
    mon := (mon + interval '1 month')::date;
  end if;
  return public.shifted_cycle_date(c.space_id, d, extract(year from mon)::int, extract(month from mon)::int) - 1;
end;
$$;
