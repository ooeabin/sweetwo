-- QA 5구간(월급 계획 W-01) 서버 쪽(2026-11-12). 스키마는 추가만(함수 새 버전만, 열·테이블 없음).
--
-- 1. 저금 줄 맞추기(goal_lines_sync) 새 버전
--    S5-04: 저금 줄이 생기거나 빠지거나(저금 추가 add_saving_item, 그만 모음, 되돌리기 saving_item_reopen),
--           W-12a 고름(계속 모을게요, 목표 금액 새로 정하기, 되돌리기: 모두 상태가 바뀌어 줄 맞추기 트리거가 돎)으로
--           저금 항목이 바뀌면 그 저금 줄이 있는
--           월급 계획의 version을 올림(Realtime salary_split 신호 → 합쳐서 모드 상대 화면이 바로 바뀜).
--           줄이 생기거나 빠졌으면 updated_by(auth.uid(), 없으면 그대로)·updated_at도(W-02 상대 변경 안내)
--    S5-09: 그만 모음을 되돌리면(saving_item_reopen) 줄이 저금 묶음 맨 아래가 아니라 원래 자리로.
--           뺄 때 freed_lines에 금액(키 = 월급 계획 id, 예전과 같음)과 함께 자리(키 = 'sort:' || 월급 계획 id)를 둠.
--           원래 자리가 저금 묶음 밖이면 저금 묶음 맨 아래(새 항목은 그대로 맨 아래)
-- 2. 월급 관리 방식 바꾸기(set_salary_mode) 새 버전
--    S5-05(D2): 각자 → 합쳐서에서 직접 추가한 지출 줄(custom)은 같은 이름끼리 금액을 더해 한 줄(06 3-4, 25 S-11f).
--               합친 뒤 10줄이 넘어도 모두 둠(지우지 않음). 더 추가하는 것만 막힘(split_line_add too_many_custom, 앱은 ‘+ 지출 추가’ 숨김)
--    S5-18: 알림 링크 /salary/split(옛 주소) → /salary?view=plan

-- 1. 저금 줄 맞추기
create or replace function public.goal_lines_sync(p_goal uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  g public.goal;
  mode public.salary_mode;
  s record;
  last smallint;
  pos smallint;
  want boolean;
  has boolean;
  amt bigint;
  was smallint;
  freed jsonb;
begin
  select * into g from public.goal where id = p_goal;
  if g.id is null then
    return;
  end if;
  freed := coalesce(g.freed_lines, '{}'::jsonb);
  select salary_mode into mode from public.couple_space where id = g.space_id;
  for s in select * from public.salary_split where space_id = g.space_id loop
    want := g.deleted_at is null and g.closed_at is null and g.status in ('active', 'delayed', 'achieved') and (
      (mode = 'joint' and s.owner_user_id is null)
      or (mode = 'separate' and s.owner_user_id is not null
          and s.owner_user_id = coalesce(g.owner_user_id, g.created_by)));
    has := exists (select 1 from public.split_line where split_id = s.id and goal_id = g.id);
    if want and not has then
      select coalesce(max(sort), -1) into last from public.split_line where split_id = s.id and kind = 'saving';
      -- 원래 자리(그만 모으기 전)가 있으면 그 자리, 없거나 저금 묶음 밖이면 저금 묶음 맨 아래
      pos := least(coalesce((freed ->> ('sort:' || s.id::text))::smallint, last + 1), last + 1);
      update public.split_line set sort = sort + 1 where split_id = s.id and sort >= pos;
      insert into public.split_line (split_id, space_id, kind, goal_id, amount, sort)
        values (s.id, g.space_id, 'saving', g.id, coalesce((freed ->> s.id::text)::bigint, 0), pos);
      freed := freed - s.id::text - ('sort:' || s.id::text);
      perform public.sync_checklist(s.id);
    elsif not want and has then
      select coalesce(sum(amount), 0), min(sort) into amt, was from public.split_line where split_id = s.id and goal_id = g.id;
      if amt > 0 then
        freed := freed || jsonb_build_object(s.id::text, amt);
      end if;
      freed := freed || jsonb_build_object('sort:' || s.id::text, was);
      delete from public.split_line where split_id = s.id and goal_id = g.id;
      perform public.sync_checklist(s.id);
    end if;
    -- 저금 줄이 있는(또는 방금 빠진) 월급 계획에 변경 신호(S5-04). 줄이 생기거나 빠졌으면 고친 사람·때도
    -- (W-02 ‘상대가 월급 계획을 바꿨어요’ 안내), 저금 항목만 바뀌었으면(목표 금액 등) 버전만
    if want <> has then
      update public.salary_split set updated_by = coalesce(auth.uid(), updated_by), updated_at = now(),
        version = version + 1 where id = s.id;
    elsif want then
      update public.salary_split set version = version + 1 where id = s.id;
    end if;
  end loop;
  if freed is distinct from coalesce(g.freed_lines, '{}'::jsonb) then
    update public.goal set freed_lines = freed where id = g.id;
  end if;
end;
$$;
revoke all on function public.goal_lines_sync(uuid) from public, anon, authenticated;

-- 2. 월급 관리 방식 바꾸기. 최신 정의 20261112090000_saving_item.sql에서 각자 → 합쳐서 직접 추가 줄만 바꿈 + 알림 링크
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
  who uuid;
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
    -- 저금: 같은 항목은 합침, 만든 순서
    for l in
      select x.goal_id, sum(x.amount)::bigint as amount
      from public.split_line x join public.salary_split s on s.id = x.split_id
      join public.goal g on g.id = x.goal_id
      where s.space_id = sid and s.owner_user_id is not null and x.kind = 'saving'
      group by x.goal_id, g.priority, g.created_at
      order by g.priority, g.created_at
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
    -- 용돈: 사람마다 1줄(그대로)
    for l in
      select x.user_id, x.amount from public.split_line x join public.salary_split s on s.id = x.split_id
      where s.space_id = sid and s.owner_user_id is not null and x.kind = 'allowance'
      order by s.owner_user_id, x.sort
    loop
      insert into public.split_line (split_id, space_id, kind, user_id, amount, sort)
        values (joint_id, sid, 'allowance', l.user_id, l.amount, n);
      n := n + 1;
    end loop;
    -- 직접 추가 줄: 같은 이름은 금액을 더해 한 줄(S5-05, D2). 순서는 처음 나온 자리(바꾼 사람 것 먼저).
    -- 10줄이 넘어도 모두 둠(더 추가하는 것만 막힘)
    for l in
      select x.name, sum(x.amount)::bigint as amount,
        min((case when s.owner_user_id = uid then 0 else 1 end) * 100000 + x.sort) as first_at
      from public.split_line x join public.salary_split s on s.id = x.split_id
      where s.space_id = sid and s.owner_user_id is not null and x.kind = 'custom'
      group by x.name
      order by first_at, x.name
    loop
      insert into public.split_line (split_id, space_id, kind, name, amount, sort)
        values (joint_id, sid, 'custom', l.name, l.amount, n);
      n := n + 1;
    end loop;
    delete from public.salary_split where space_id = sid and owner_user_id is not null;
  else
    select id into joint_id from public.salary_split where space_id = sid and owner_user_id is null;
    if other.id is null then
      update public.salary_split set owner_user_id = uid where id = joint_id;
      update public.goal set owner_user_id = uid where space_id = sid and owner_user_id is null;
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
        select x.*, g.owner_user_id as goal_owner, g.created_by as goal_maker
        from public.split_line x left join public.goal g on g.id = x.goal_id
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
        elsif l.kind = 'saving' then
          who := coalesce(l.goal_owner,
            case when l.goal_maker in (uid, other.id) then l.goal_maker end, cd);
          if who = cd then
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
  -- 각자로: 주인 없는 저금 항목은 만든 사람(없으면 기준일 사람) 것. 줄은 위에서 옮겼고, 방식을 바꾼 뒤라 줄 맞추기가 그대로 둠
  if p_mode = 'separate' and other.id is not null and cd is not null then
    update public.goal set owner_user_id = case when created_by in (uid, other.id) then created_by else cd end
      where space_id = sid and owner_user_id is null;
  end if;
  if other.id is not null and sp.couple_state = 'connected' then
    perform public.notify(
      other.id, sid, 'salary_mode',
      coalesce(me.nickname || '님이', '파트너가') || ' 월급 관리 방식을 바꿨어요',
      case when p_mode = 'joint' then '합쳐서 같이 관리해요' else '각자 월급을 따로 관리해요' end,
      '/salary?view=plan', null, uid, 'mode:' || sid || ':' || now()::text);
  end if;
end;
$$;
revoke all on function public.set_salary_mode(public.salary_mode) from public, anon;
grant execute on function public.set_salary_mode(public.salary_mode) to authenticated;
