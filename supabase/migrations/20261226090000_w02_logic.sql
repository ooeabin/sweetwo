-- 2026-11-23 W-02 로직 수정(사용자 결정 “모두 고치고 다시 보여줘”). 스키마는 추가만.
--  1. make_checklist: 사이클이 넘어가도 지난 달 손 줄을 바로 ‘건너뜀’으로 바꾸지 않음. 다음 사이클 끝(late_check_until)까지
--     대기로 두고, 그 기간이 끝난 목록만 닫으면서 남은 대기 줄을 건너뜀으로(CLAUDE.md “지난 달 손 줄은 다음 사이클 끝까지 늦게 확인”).
--     check_pay_line·confirm_payday는 이미 늦은 확인(late_)에서 대기 줄도 받음
--  2. money_in_select: 합쳐서(joint) 공간이 연결 중이면 월급날 확인으로 자동 기록된 월급(payday_auto)은 두 사람 것이 서로 보임
--     (수입 = 두 사람 합, W-02 수입 카드 자동 월급 두 줄). 직접 적은 기록·각자 엔진은 공개 단계 그대로

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
  -- 원래 날로 끝을 잡아 둔 지난 목록은 앞당긴 날 전날에 끝(두 목록이 겹치지 않게)
  update public.pay_checklist set cycle_end = least(cycle_end, s - 1)
    where space_id = sid and owner_user_id is not distinct from p_owner and cycle_start < s and cycle_end >= s;
  -- 2026-11-23 사용자 결정(W-02 135): 사이클이 넘어가도 지난 달 손 줄은 바로 ‘건너뜀’이 되지 않고 대기로 남아
  -- 다음 사이클 끝(late_check_until)까지 늦게 확인할 수 있음(07 4장). 늦은 확인 기간이 끝난 목록만 닫고, 남은 줄을 건너뜀으로
  update public.pay_check_line set state = 'skipped'
    where state = 'wait' and checklist_id in (
      select id from public.pay_checklist
      where space_id = sid and owner_user_id is not distinct from p_owner and cycle_start < s
        and today > public.late_check_until(id));
  update public.pay_checklist set state = 'closed'
    where space_id = sid and owner_user_id is not distinct from p_owner and cycle_start < s and state <> 'closed'
      and today > public.late_check_until(id);
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

-- 합쳐서 엔진은 수입이 두 사람 합이라 월급날 확인으로 자동 기록된 월급(source = payday_auto)은 서로 보임.
-- 직접 적은 기록과 각자 엔진은 공개 단계대로(money_in_visible 그대로)
create function public.money_in_joint_auto(p_space uuid, p_source text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_source = 'payday_auto' and exists (
    select 1 from public.couple_space s
    where s.id = p_space and s.salary_mode = 'joint' and s.couple_state = 'connected');
$$;
revoke all on function public.money_in_joint_auto(uuid, text) from public, anon;
grant execute on function public.money_in_joint_auto(uuid, text) to authenticated;
alter policy money_in_select on public.money_in
  using (public.is_space_member(space_id)
    and (public.money_in_visible(owner_user_id) or public.money_in_joint_auto(space_id, source)));
