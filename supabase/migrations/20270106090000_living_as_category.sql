-- 2026-11-28 사용자 결정 “원래 있던 생활비 줄을 없애고, 지출 내부에서 다른 대분류랑 똑같이 취급”.
-- 스키마는 추가만(2단계 원칙): enum 값 'living'·열은 남기고, 데이터와 함수만 바꿈.
-- 1) 생활비 기본 줄(kind living) → 직접 추가 줄 ‘생활비’(묶음 living). 금액·순서·확인 목록 설정·자동 설정·확인 기록 그대로(같은 행)
-- 2) 새로 kind living 줄이 생기지 않게: 넣거나 바꾸면 트리거가 직접 추가 줄 ‘생활비’(묶음 living)로 바꿔 넣음(옛 앱 호환)
-- 3) 분담(06 3-7)·apply_shared_account: 생활비 자동 줄이기 없앰, 고정지출 규칙은 그대로. 결과 문구 ‘생활비를 줄였어요’ 없앰
-- 4) 직접 추가 줄 한도 20: 이 변환으로 넘긴 계획은 그 수까지 저장 가능(더 추가만 막힘)
-- 같은 이름 직접 추가 줄이 이미 있어도 그대로 둠(이름 중복은 줄을 더하거나 이름을 바꿀 때만 막음)

update public.split_line
  set kind = 'custom', name = '생활비', category = 'living'
  where kind = 'living';
update public.pay_check_line
  set kind = 'custom', name = coalesce(nullif(btrim(name), ''), '생활비')
  where kind = 'living';

-- 확인 목록 기본값(split_line_defaults)은 그대로: 옛 앱이 보낸 kind living은 지금처럼 목록에서 빠진 채(기본 끔) 직접 추가 줄 ‘생활비’가 됨

-- 트리거 이름은 그대로(split_line_living_category, split_line_defaults 다음에 돎)
create or replace function public.split_line_living_category() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.kind = 'living' then
    new.kind := 'custom';
    new.name := coalesce(nullif(btrim(new.name), ''), '생활비');
    new.category := 'living';
  elsif new.kind <> 'custom' then
    new.category := null;
  end if;
  return new;
end;
$$;

-- 확인 목록 줄도 kind living이 새로 생기지 않게(sync_checklist는 split_line 값을 복사하므로 위 트리거로 충분, 옛 기록 보호용)
create or replace function public.pay_check_line_no_living() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.kind = 'living' then
    new.kind := 'custom';
    new.name := coalesce(nullif(btrim(new.name), ''), '생활비');
  end if;
  return new;
end;
$$;
create trigger pay_check_line_no_living
  before insert or update of kind on public.pay_check_line
  for each row execute function public.pay_check_line_no_living();

-- 줄 추가: 생활비 기본 줄 1줄 제한 없앰
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
  if p_kind in ('saving', 'send') then
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
  elsif p_kind = 'fixed' then -- 2026-11-28 생활비 기본 줄 1줄 제한 없앰(living은 트리거가 직접 추가 줄로)
    if exists (select 1 from public.split_line where split_id = sp.id and kind = p_kind) then
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

-- 월급 계획 통째 저장: 한도는 기존 데이터 수까지 허용
create or replace function public.save_split(p_lines jsonb, p_owner uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  sid uuid := (select space_id from public.app_user where id = auth.uid());
  mode public.salary_mode;
  split uuid;
  l jsonb;
  i integer := 0;
  customs integer := 0;
  old_customs integer := 0;
  k public.split_line_kind;
  old_lines jsonb;
  old_set jsonb := '[]'::jsonb;
  g uuid;
  u uuid;
  nm text;
  prev jsonb;
  a record;
  touched uuid[] := '{}';
  t uuid;
begin
  if sid is null then
    raise exception 'no_space' using errcode = '42501';
  end if;
  select salary_mode into mode from public.couple_space where id = sid;
  -- 연결 해제 대기 중에는 분배표를 고칠 수 없음(25 ‘연결 해제, 대기와 혼자 쓰기’ 2번)
  if (select couple_state from public.couple_space where id = sid) = 'unlink_pending' then
    raise exception 'unlink_pending' using errcode = '42501';
  end if;
  if mode = 'joint' and p_owner is not null then
    raise exception 'joint_split_has_no_owner' using errcode = '22023';
  end if;
  if mode = 'separate' and (p_owner is null
      or not exists (select 1 from public.app_user where id = p_owner and space_id = sid)) then
    raise exception 'bad_owner' using errcode = '22023';
  end if;
  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) > 60 then
    raise exception 'bad_lines' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_lines) x where x->>'kind' = 'send') then
    raise exception 'send_locked' using errcode = '42501';
  end if;

  select id into split from public.salary_split
    where space_id = sid and owner_user_id is not distinct from p_owner;
  -- 2026-11-09: 각자 모드 파트너 월급 계획은 보기만(쓰는 돈 줄도 못 고침). 예전 ‘파트너 저금 줄만 잠금’ 대신
  if mode = 'separate' and p_owner <> uid then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  -- 합쳐서 남의 용돈 줄(B7, G9): 금액이 바뀌거나 빠지면 주인(또는 한 사람 관리형의 관리하는 사람)만
  if mode = 'joint' and split is not null then
    for a in
      select o.user_id, o.amount as before_amount,
        (select sum((x->>'amount')::bigint) from jsonb_array_elements(p_lines) x
          where x->>'kind' = 'allowance' and (x->>'user_id')::uuid = o.user_id) as after_amount
      from public.split_line o
      where o.split_id = split and o.kind = 'allowance' and o.user_id is not null and o.user_id <> uid
    loop
      if a.after_amount is distinct from a.before_amount then
        if not public.allowance_editable(sid, a.user_id) then
          raise exception 'not_owner' using errcode = '42501';
        end if;
        touched := touched || a.user_id;
      end if;
    end loop;
  end if;
  if split is null then
    insert into public.salary_split (space_id, owner_user_id, updated_by)
      values (sid, p_owner, uid) returning id into split;
  else
    select jsonb_agg(jsonb_build_object('kind', kind, 'goal_id', goal_id, 'user_id', user_id, 'name', name, 'amount', amount))
             filter (where kind <> 'send'),
           coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'goal_id', goal_id, 'user_id', user_id, 'name', name,
             'in_checklist', in_checklist, 'auto_pay', auto_pay, 'auto_day', auto_day, 'category', category)), '[]'::jsonb)
      into old_lines, old_set from public.split_line where split_id = split;
    update public.salary_split set updated_by = uid, updated_at = now(), version = version + 1
      where id = split;
    -- 2026-11-28: 생활비 기본 줄을 직접 추가 줄로 바꿔 한도를 넘긴 계획(기존 데이터)은 그 수까지 그대로 저장
    select count(*) into old_customs from public.split_line where split_id = split and kind = 'custom';
    delete from public.split_line where split_id = split;
  end if;

  for l in select * from jsonb_array_elements(p_lines) loop
    k := (l->>'kind')::public.split_line_kind;
    if k = 'saving' and not exists (
        select 1 from public.goal g0
        where g0.id = (l->>'goal_id')::uuid and g0.space_id = sid and g0.deleted_at is null) then
      raise exception 'bad_goal' using errcode = '22023';
    end if;
    if k = 'allowance' and (l->>'user_id') is not null and not exists (
        select 1 from public.app_user where id = (l->>'user_id')::uuid and space_id = sid) then
      raise exception 'bad_user' using errcode = '22023';
    end if;
    if k = 'custom' then
      customs := customs + 1;
      if customs > greatest(20, old_customs) then
        raise exception 'too_many_custom' using errcode = '22023';
      end if;
    end if;
    g := case when k = 'saving' then (l->>'goal_id')::uuid end;
    u := case when k = 'allowance' then coalesce((l->>'user_id')::uuid, p_owner, uid) end;
    nm := case when k = 'custom' then btrim(l->>'name') end;
    select x into prev from jsonb_array_elements(old_set) x
      where x->>'kind' = k::text and (x->>'goal_id')::uuid is not distinct from g
        and (x->>'user_id')::uuid is not distinct from u and (x->>'name') is not distinct from nm
      limit 1;
    if (l->>'category') is not null and k not in ('custom', 'living') then
      raise exception 'bad_category' using errcode = '22023';
    end if;
    insert into public.split_line (split_id, space_id, kind, goal_id, user_id, name, amount, sort,
                                   in_checklist, auto_pay, auto_day, category)
    values (
      split, sid, k, g, u, nm,
      (l->>'amount')::bigint,
      i,
      coalesce((l->>'in_checklist')::boolean, (prev->>'in_checklist')::boolean),
      coalesce((l->>'auto_pay')::boolean, (prev->>'auto_pay')::boolean),
      case when l ? 'auto_day' then (l->>'auto_day')::smallint else (prev->>'auto_day')::smallint end,
      -- 2026-11-27 지출 묶음: 넘긴 값(키가 있으면 null 포함), 없으면 같은 줄(kind, goal, user, name)의 옛 값
      case when l ? 'category' then l->>'category' else prev->>'category' end
    );
    prev := null;
    i := i + 1;
  end loop;
  -- 보내기 줄은 서버가 다시(각자 계열은 줄을 지울 때 트리거가 이미 다시 넣음). 2026-11-13 PR 14: 어느 계열이든
  -- 보내기 줄은 맨 뒤(다른 줄 다음, 사람 순서), 옛 설정(체크리스트에 넣기, 자동, 나가는 날) 이어받기
  perform public.recalc_send_line(sid);
  update public.split_line l0 set sort = i + z.rn
    from (select id, (row_number() over (order by sort, user_id) - 1)::int as rn
            from public.split_line where split_id = split and kind = 'send') z
    where l0.id = z.id;
  update public.split_line l0 set in_checklist = (x->>'in_checklist')::boolean, auto_pay = (x->>'auto_pay')::boolean,
      auto_day = (x->>'auto_day')::smallint
    from jsonb_array_elements(old_set) x
    where l0.split_id = split and l0.kind = 'send' and x->>'kind' = 'send' and (x->>'user_id')::uuid = l0.user_id;
  if old_lines is not null then
    perform public.log_split_changes(split, old_lines);
  end if;
  foreach t in array touched loop
    perform public.notify_my_allowance(sid, t);
  end loop;
  perform public.sync_checklist(split);
  return split;
end;
$$;

-- 관리 형태 바꾸기: 생활비 합치기는 직접 추가 줄 규칙(같은 이름끼리)으로
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
    for l in
      select x.kind, sum(x.amount)::bigint as amount from public.split_line x join public.salary_split s on s.id = x.split_id
      where s.space_id = sid and s.owner_user_id is not null and x.kind = 'fixed' /* 2026-11-28 생활비는 직접 추가 줄로 같은 이름끼리 합침 */
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

-- 분담 반영: 고정지출 줄만 줄임
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
      -- 2026-11-28: 생활비 기본 줄이 없어져 고정지출 줄만 줄임. 넘치면 W-01 “계획이 월급보다 n 많아요”(06 3-3)
      where x.split_id = sp.id and x.kind = 'fixed' and x.amount > 0
      order by x.sort
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

-- 분담 답: 결과 문구에서 ‘생활비를’ 없앰
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
    select coalesce(sum(amount) filter (where kind = 'living'), 0), coalesce(sum(amount) filter (where kind = 'fixed'), 0)
      into living0, fixed0 from public.split_line where split_id = plan;
    perform public.apply_shared_account(a.id);
    select coalesce(sum(amount) filter (where kind = 'living'), 0), coalesce(sum(amount) filter (where kind = 'fixed'), 0)
      into living1, fixed1 from public.split_line where split_id = plan;
    -- 2026-11-28: 생활비 기본 줄이 없어져 고정지출만 줄임(06 3-7), “생활비를 줄였어요”는 없앰
    cut := case when fixed1 < fixed0 then '고정지출을' end;
  end if;
  perform public.notify(a.proposed_by, a.space_id, 'split_result',
    case when p_accept then '‘' || a.name || '’ 나누기를 정했어요' else '‘' || a.name || '’ 나누기는 지금처럼 둘게요' end, -- [확인 필요]
    case when cut is not null then '통장에 넣는 만큼 ' || cut || ' 줄였어요' end, -- [확인 필요] 06 3-7 M9
    '/salary?view=plan', 'users', uid, 'split_result:' || a.id);
  return case when p_accept then 'accepted' else 'declined' end;
end;
$$;
