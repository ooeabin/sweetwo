-- 월급 관리 방식 바꾸기(25 S-11f, 20 ‘다시 계산되는 때’)와 체크리스트 만드는 날(S-11d).
-- 바꾸면 분배표를 바로 합치거나 나누고, 체크리스트는 다음 월급날부터 새 방식(이번 사이클 체크리스트는 그대로). 상대 알림.
-- 연결 해제 대기 중에는 못 바꿈.

-- 각자 ↔ 합쳐서. 각자 → 합쳐서: 같은 우리 목표 줄은 더해 1줄, 고정지출·생활비는 더해 1줄씩, 용돈은 사람마다, 내 목표·직접 추가 줄은 그대로.
-- 합쳐서 → 각자: 우리 목표·고정지출·생활비·직접 추가 줄을 두 사람 수입 비율로(1만 원 단위, 남는 차이는 기준일 사람 쪽),
-- 용돈은 그 사람 분배표로, 내 목표 줄은 주인 분배표로. 배우자 미합류면 내 분배표 주인만 바꿈.
create or replace function public.set_salary_mode(p_mode public.salary_mode)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid uuid := (select space_id from public.app_user where id = auth.uid());
  sp public.couple_space;
  me public.app_user;
  other public.app_user;
  joint_id uuid;
  a_id uuid;
  b_id uuid;
  cd uuid; -- 기준일 사람(남는 차이를 받는 쪽)
  share numeric; -- 기준일이 아닌 사람 몫 비율
  l record;
  n integer := 0;
  na integer := 0;
  nb integer := 0;
  part bigint;
begin
  if sid is null then
    raise exception 'no_space' using errcode = '42501';
  end if;
  select * into sp from public.couple_space where id = sid for update;
  if sp.couple_state = 'unlink_pending' then
    raise exception 'unlink_pending' using errcode = '42501';
  end if;
  if sp.salary_mode = p_mode then
    return;
  end if;
  select * into me from public.app_user where id = uid;
  select * into other from public.app_user where space_id = sid and id <> uid and status = 'active' limit 1;

  if p_mode = 'joint' then
    insert into public.salary_split (space_id, owner_user_id, updated_by) values (sid, null, uid) returning id into joint_id;
    -- 저금: 비상금 → 우리 목표 → 내 목표(우선순위), 같은 목표는 합침
    for l in
      select x.goal_id, sum(x.amount)::bigint as amount
      from public.split_line x join public.salary_split s on s.id = x.split_id
      join public.goal g on g.id = x.goal_id
      where s.space_id = sid and s.owner_user_id is not null and x.kind = 'saving'
      group by x.goal_id, g.template, g.owner_user_id, g.priority
      order by (g.template = 'emergency') desc, (g.owner_user_id is null) desc, g.priority
    loop
      insert into public.split_line (split_id, space_id, kind, goal_id, amount, sort) values (joint_id, sid, 'saving', l.goal_id, l.amount, n);
      n := n + 1;
    end loop;
    for l in
      select x.kind, sum(x.amount)::bigint as amount from public.split_line x join public.salary_split s on s.id = x.split_id
      where s.space_id = sid and s.owner_user_id is not null and x.kind in ('fixed', 'living')
      group by x.kind order by x.kind
    loop
      insert into public.split_line (split_id, space_id, kind, amount, sort) values (joint_id, sid, l.kind, l.amount, n);
      n := n + 1;
    end loop;
    for l in
      select x.kind, x.user_id, x.name, x.amount from public.split_line x join public.salary_split s on s.id = x.split_id
      where s.space_id = sid and s.owner_user_id is not null and x.kind in ('allowance', 'custom')
      order by x.kind, s.owner_user_id, x.sort
    loop
      insert into public.split_line (split_id, space_id, kind, user_id, name, amount, sort)
        values (joint_id, sid, l.kind, l.user_id, l.name, l.amount, n);
      n := n + 1;
    end loop;
    delete from public.salary_split where space_id = sid and owner_user_id is not null;
  else
    select id into joint_id from public.salary_split where space_id = sid and owner_user_id is null;
    if other.id is null then
      update public.salary_split set owner_user_id = uid where id = joint_id;
    elsif joint_id is not null then
      -- 기준일 사람 = 공동 기준일과 월급날이 같은 사람(없으면 시작한 사람)
      cd := coalesce(
        (select u.id from public.app_user u where u.space_id = sid and u.status = 'active'
           and (case when u.payday_last then 31 else u.payday end) = public.cycle_day(sid, null)
         order by (u.id = sp.created_by) desc limit 1),
        sp.created_by);
      share := case when coalesce(me.monthly_income, 0) + coalesce(other.monthly_income, 0) = 0 then 0.5
        else (case when cd = uid then coalesce(other.monthly_income, 0) else coalesce(me.monthly_income, 0) end)::numeric
             / (coalesce(me.monthly_income, 0) + coalesce(other.monthly_income, 0)) end;
      insert into public.salary_split (space_id, owner_user_id, updated_by) values (sid, cd, uid) returning id into a_id;
      insert into public.salary_split (space_id, owner_user_id, updated_by)
        values (sid, case when cd = uid then other.id else uid end, uid) returning id into b_id;
      for l in
        select x.*, g.owner_user_id as goal_owner from public.split_line x left join public.goal g on g.id = x.goal_id
        where x.split_id = joint_id order by x.sort
      loop
        if l.kind = 'allowance' and l.user_id is not null then
          if l.user_id = cd then
            insert into public.split_line (split_id, space_id, kind, user_id, amount, sort) values (a_id, sid, 'allowance', l.user_id, l.amount, na);
            na := na + 1;
          else
            insert into public.split_line (split_id, space_id, kind, user_id, amount, sort) values (b_id, sid, 'allowance', l.user_id, l.amount, nb);
            nb := nb + 1;
          end if;
        elsif l.kind = 'saving' and l.goal_owner is not null then
          if l.goal_owner = cd then
            insert into public.split_line (split_id, space_id, kind, goal_id, amount, sort) values (a_id, sid, 'saving', l.goal_id, l.amount, na);
            na := na + 1;
          else
            insert into public.split_line (split_id, space_id, kind, goal_id, amount, sort) values (b_id, sid, 'saving', l.goal_id, l.amount, nb);
            nb := nb + 1;
          end if;
        else
          part := (round(l.amount * share / 10000) * 10000)::bigint;
          insert into public.split_line (split_id, space_id, kind, goal_id, name, amount, sort)
            values (a_id, sid, l.kind, l.goal_id, l.name, l.amount - part, na);
          insert into public.split_line (split_id, space_id, kind, goal_id, name, amount, sort)
            values (b_id, sid, l.kind, l.goal_id, l.name, part, nb);
          na := na + 1;
          nb := nb + 1;
        end if;
      end loop;
      delete from public.salary_split where id = joint_id;
    end if;
  end if;
  update public.couple_space set salary_mode = p_mode where id = sid;
  if other.id is not null and sp.couple_state = 'connected' then
    perform public.notify(
      other.id, sid, 'salary_mode',
      coalesce(me.nickname, '배우자') || '님이 월급 관리 방식을 바꿨어요',
      case when p_mode = 'joint' then '합쳐서 같이 관리해요' else '각자 월급을 따로 관리해요' end,
      '/salary/split', null, uid, 'mode:' || sid || ':' || now()::text);
  end if;
end;
$$;
revoke all on function public.set_salary_mode(public.salary_mode) from public, anon;
grant execute on function public.set_salary_mode(public.salary_mode) to authenticated;

-- S-11d 체크리스트 만드는 날(합쳐서 + 배우자 합류): 둘 중 한 사람의 월급날. 이번 사이클 끝 = 새 기준일 전날, 상대 알림
create or replace function public.set_joint_cycle_day(p_day smallint)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid uuid := (select space_id from public.app_user where id = auth.uid());
  sp public.couple_space;
  me public.app_user;
  other public.app_user;
  today date := public.kst_today();
  nxt date;
begin
  select * into sp from public.couple_space where id = sid for update;
  if sp.id is null or sp.salary_mode <> 'joint' then
    raise exception 'not_joint' using errcode = '22023';
  end if;
  if sp.couple_state = 'unlink_pending' then
    raise exception 'unlink_pending' using errcode = '42501';
  end if;
  if p_day is null or p_day not in (
    select case when u.payday_last then 31 else u.payday end from public.app_user u where u.space_id = sid and u.status = 'active'
  ) then
    raise exception 'bad_day' using errcode = '22023';
  end if;
  update public.couple_space set joint_cycle_day = p_day where id = sid;
  -- 이번 사이클 끝 = 새 기준일 전날(오늘 뒤 처음 오는 새 기준일)
  nxt := public.cycle_date(p_day, extract(year from today)::int, extract(month from today)::int);
  if nxt <= today then
    nxt := public.cycle_date(p_day, extract(year from today + interval '1 month')::int, extract(month from today + interval '1 month')::int);
  end if;
  update public.pay_checklist set cycle_end = greatest(nxt - 1, cycle_start)
    where space_id = sid and owner_user_id is null and state <> 'closed' and cycle_end >= today;
  select * into me from public.app_user where id = uid;
  select * into other from public.app_user where space_id = sid and id <> uid and status = 'active' limit 1;
  if other.id is not null then
    perform public.notify(
      other.id, sid, 'cycle_day',
      coalesce(me.nickname, '배우자') || '님이 체크리스트 만드는 날을 바꿨어요',
      case when p_day = 31 then '말일' else p_day || '일' end || '에 만들어요',
      '/settings/me', null, uid, 'cycle_day:' || sid || ':' || now()::text);
  end if;
end;
$$;
revoke all on function public.set_joint_cycle_day(smallint) from public, anon;
grant execute on function public.set_joint_cycle_day(smallint) to authenticated;

-- 체크리스트 만들기: 관리 방식을 바꾼 달은 옛 방식 체크리스트를 그대로 두고 다음 월급날부터 새 방식
create or replace function public.start_checklist(p_owner uuid default null)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  sid uuid := (select space_id from public.app_user where id = auth.uid());
  split uuid;
  dday smallint;
  today date := public.kst_today();
  s date;
  e date;
  nxt date;
  cl uuid;
begin
  if sid is null then
    raise exception 'no_space' using errcode = '42501';
  end if;
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

