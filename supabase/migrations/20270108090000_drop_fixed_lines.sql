-- 2026-11-28 사용자 결정(출시 전, 실사용자 데이터 없음): 옛 기본 ‘고정지출’ 줄(kind fixed)도 생활비처럼 없앰.
-- 지출은 모두 직접 추가 줄(묶음: 주거 관리비 등). enum 값·열은 그대로(2단계 원칙).
-- 1) kind fixed 줄과 그 확인 목록 줄(확인 기록 포함)을 지우고 확인 목록 상태를 다시 셈.
--    저축·투자 모은 금액은 저금 줄(kind saving) 확인 기록만 셈하므로 영향 없음
-- 2) kind fixed·living 입력은 무시(BEFORE 트리거 null, 옛 앱이 보내도 오류 없이 그 줄만 빠짐). split_line_add는 bad_kind
-- 3) 분담(06 3-7) apply_shared_account: 다른 줄 자동 줄이기 없앰, 넘치면 W-01 넘김 표시. answer_split 결과 문구 ‘…를 줄였어요’ 없앰
-- 4) set_salary_mode: 고정지출·생활비 합치기 없앰

create temporary table fixed_lists on commit drop as
  select distinct checklist_id from public.pay_check_line
  where kind = 'fixed' or split_line_id in (select id from public.split_line where kind = 'fixed');

delete from public.pay_check_line
  where kind = 'fixed' or split_line_id in (select id from public.split_line where kind = 'fixed');
delete from public.split_line where kind = 'fixed';

do $$
declare c uuid;
begin
  for c in select checklist_id from fixed_lists loop
    perform public.checklist_restate(c);
  end loop;
end;
$$;

create or replace function public.split_line_living_category() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.kind in ('living', 'fixed') then
    return null;
  elsif new.kind <> 'custom' then
    new.category := null;
  end if;
  return new;
end;
$$;

create or replace function public.pay_check_line_no_living() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.kind in ('living', 'fixed') then
    return null;
  end if;
  return new;
end;
$$;

-- 줄 추가: 고정지출·생활비 종류는 받지 않음
create or replace function public.split_line_add(p_split uuid, p_kind public.split_line_kind, p_amount bigint,
  p_name text default null, p_user uuid default null, p_sort integer default null, p_category text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  sp public.salary_split;
  nm text := nullif(btrim(p_name), '');
  who uuid;
  last integer;
  pos integer;
  old jsonb;
  nid uuid;
begin
  sp := public.split_editable(p_split);
  -- 2026-11-28: 생활비·고정지출 기본 줄은 없음(지출은 직접 추가 줄)
  if p_kind in ('saving', 'send', 'fixed', 'living') then
    raise exception 'bad_kind' using errcode = '22023';
  end if;
  if not public.split_amount_ok(p_amount) then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  if p_kind = 'custom' then
    if nm is null or char_length(nm) > 20 then
      raise exception 'bad_name' using errcode = '22023';
    end if;
    if (select count(*) from public.split_line where split_id = sp.id and kind = 'custom') >= 20 then
      raise exception 'too_many_custom' using errcode = '22023';
    end if;
    if exists (select 1 from public.split_line where split_id = sp.id and kind = 'custom' and name = nm) then
      raise exception 'duplicate_line' using errcode = '22023';
    end if;
  elsif p_kind = 'allowance' then
    who := coalesce(p_user, sp.owner_user_id, auth.uid());
    if not exists (select 1 from public.app_user where id = who and space_id = sp.space_id) then
      raise exception 'bad_user' using errcode = '22023';
    end if;
    if sp.owner_user_id is null and not public.allowance_editable(sp.space_id, who) then
      raise exception 'not_owner' using errcode = '42501';
    end if;
    if exists (select 1 from public.split_line where split_id = sp.id and kind = 'allowance' and user_id = who) then
      raise exception 'duplicate_line' using errcode = '22023';
    end if;
  end if;
  -- 2026-11-27 지출 묶음: 직접 추가 줄만 받음(생활비 기본 줄은 트리거가 living)
  if p_category is not null and p_kind <> 'custom' then
    raise exception 'bad_category' using errcode = '22023';
  end if;
  old := public.split_lines_json(sp.id);
  select coalesce(max(sort), -1) into last from public.split_line where split_id = sp.id;
  pos := case when p_sort is null then last + 1 else greatest(0, least(p_sort, last + 1)) end;
  update public.split_line set sort = sort + 1 where split_id = sp.id and sort >= pos;
  insert into public.split_line (split_id, space_id, kind, user_id, name, amount, sort, category)
    values (sp.id, sp.space_id, p_kind, case when p_kind = 'allowance' then who end,
      case when p_kind = 'custom' then nm end, p_amount, pos, p_category)
    returning id into nid;
  perform public.split_touch(sp.id);
  perform public.log_split_changes(sp.id, old);
  perform public.sync_checklist(sp.id);
  return nid;
end;
$$;

-- 관리 형태 바꾸기: 고정지출·생활비 합치기 없앰
CREATE OR REPLACE FUNCTION public.set_salary_mode(p_mode salary_mode)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    -- 2026-11-28: 고정지출·생활비 기본 줄 합치기 없앰(기본 줄이 없음, 지출은 모두 직접 추가 줄로 같은 이름끼리)
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
        -- 2026-11-27 지출 묶음 보존: 같은 이름 중 바꾼 사람 것 먼저
        (array_agg(x.category order by (s.owner_user_id = uid) desc, x.sort) filter (where x.category is not null))[1] as category,
        min((case when s.owner_user_id = uid then 0 else 1 end) * 100000 + x.sort) as first_at
      from public.split_line x join public.salary_split s on s.id = x.split_id
      where s.space_id = sid and s.owner_user_id is not null and x.kind = 'custom'
      group by x.name
      order by first_at, x.name
    loop
      insert into public.split_line (split_id, space_id, kind, name, amount, sort, category)
        values (joint_id, sid, 'custom', l.name, l.amount, n, l.category);
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
          insert into public.split_line (split_id, space_id, kind, goal_id, name, amount, sort, category)
            values (a_id, sid, l.kind, l.goal_id, l.name, l.amount - part, na, l.category);
          insert into public.split_line (split_id, space_id, kind, goal_id, name, amount, sort, category)
            values (b_id, sid, l.kind, l.goal_id, l.name, part, nb, l.category);
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
      case when p_mode = 'joint' then '다음 월급날부터 월급을 합쳐서 써요' else '다음 월급날부터 월급은 각자 써요' end, -- [확인 필요] D3
      '/salary?view=plan', null, uid, 'mode:' || sid || ':' || now()::text);
  end if;
end;
$function$;

-- 분담 반영: 다른 줄을 자동으로 줄이지 않음
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
    -- 2026-11-28: 생활비·고정지출 기본 줄이 없어져 다른 줄을 자동으로 줄이지 않음(06 3-7).
    -- 통장 몫이 늘어 계획이 월급을 넘으면 W-01 “계획이 월급보다 n 많아요”(06 3-3)로 보여 줌
    lid := null;
    update public.salary_split set version = version + 1, updated_at = now() where id = sp.id;
    perform public.sync_checklist(sp.id);
  end loop;
end;
$function$;

-- 분담 답: 결과 알림 ‘…를 줄였어요’ 없음
create or replace function public.answer_split(p_id uuid, p_accept boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  a public.shared_account;
  joint boolean;
  plan uuid;
  living0 bigint;
  fixed0 bigint;
  living1 bigint;
  fixed1 bigint;
  cut text;
begin
  select * into a from public.shared_account where id = p_id for update;
  if a.id is null or not public.is_space_member(a.space_id) or a.proposed_by = uid then
    raise exception 'not_found' using errcode = '42501';
  end if;
  if a.status <> 'proposed' then
    raise exception 'not_open' using errcode = '22023';
  end if;
  if a.expires_at < now() then
    update public.shared_account set status = 'expired' where id = a.id;
    return 'expired';
  end if;
  update public.shared_account set status = case when p_accept then 'accepted' else 'declined' end, answered_at = now()
    where id = a.id;
  if p_accept then
    select salary_mode = 'joint' into joint from public.couple_space where id = a.space_id;
    select id into plan from public.salary_split
      where space_id = a.space_id and owner_user_id is not distinct from (case when joint then null else a.proposed_by end);
    -- 2026-11-28: 분담은 다른 줄을 줄이지 않음(06 3-7), 결과 알림에 ‘…를 줄였어요’ 한 줄 없음
    perform public.apply_shared_account(a.id);
  end if;
  perform public.notify(a.proposed_by, a.space_id, 'split_result',
    case when p_accept then '‘' || a.name || '’ 나누기를 정했어요' else '‘' || a.name || '’ 나누기는 지금처럼 둘게요' end, -- [확인 필요]
    null,
    '/salary?view=plan', 'users', uid, 'split_result:' || a.id);
  return case when p_accept then 'accepted' else 'declined' end;
end;
$$;
