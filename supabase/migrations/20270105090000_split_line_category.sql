-- 2026-11-27 사용자 결정 ‘지출 묶음(대분류 안 소분류)’: 지출 줄에 묶음(category) + 직접 추가 줄 한도 10 → 20.
-- 스키마는 추가만(nullable 열). 묶음 code는 앱 지출 칩 표(docs/spec/20 ‘W-01e 지출 칩 표’)와 같음.
-- 분담(06 3-7: living → fixed 순 줄이기)·관리 형태 바꾸기(08 2장: living·fixed 종류별 합치기·나누기) 규칙은 그대로, category만 보존.

alter table public.split_line add column category text
  check (category is null or category in ('living', 'housing', 'telecom', 'subscription', 'transport', 'car', 'insurance', 'loan', 'family', 'relation'));

comment on column public.split_line.category is
  '지출 묶음(생활비 living, 주거 housing …). 직접 추가 줄은 W-01e 이름 칩으로 만들면 그 묶음, 아니면 null. 생활비 기본 줄(kind living)은 늘 living';

-- 생활비 기본 줄은 생활비 묶음 안 ‘기타 생활비’
update public.split_line set category = 'living' where kind = 'living' and category is null;

create or replace function public.split_line_living_category() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.kind = 'living' then
    new.category := 'living';
  elsif new.kind not in ('custom', 'living') then
    new.category := null;
  end if;
  return new;
end;
$$;

create trigger split_line_living_category
  before insert or update of kind, category on public.split_line
  for each row execute function public.split_line_living_category();

-- 줄 추가·고치기: p_category 하나 더(옛 시그니처는 지우고 새로 만듦)
drop function public.split_line_add(uuid, public.split_line_kind, bigint, text, uuid, integer);
drop function public.split_line_set(uuid, bigint, text);

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
  elsif p_kind in ('fixed', 'living') then
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

revoke all on function public.split_line_add(uuid, public.split_line_kind, bigint, text, uuid, integer, text) from public, anon;
grant execute on function public.split_line_add(uuid, public.split_line_kind, bigint, text, uuid, integer, text) to authenticated;

create or replace function public.split_line_set(p_line uuid, p_amount bigint default null, p_name text default null,
  p_category text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  l public.split_line;
  sp public.salary_split;
  nm text := nullif(btrim(p_name), '');
  old jsonb;
begin
  select * into l from public.split_line where id = p_line;
  if l.id is null then
    raise exception 'no_split' using errcode = '42501';
  end if;
  sp := public.split_editable(l.split_id);
  if l.kind = 'send' then
    raise exception 'send_locked' using errcode = '42501';
  end if;
  if l.kind = 'allowance' and sp.owner_user_id is null and not public.allowance_editable(sp.space_id, l.user_id) then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if p_amount is not null and not public.split_amount_ok(p_amount) then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  if p_name is not null and (l.kind <> 'custom' or nm is null or char_length(nm) > 20) then
    raise exception 'bad_name' using errcode = '22023';
  end if;
  if nm is not null and nm is distinct from l.name and exists (
      select 1 from public.split_line where split_id = sp.id and kind = 'custom' and name = nm and id <> l.id) then
    raise exception 'duplicate_line' using errcode = '22023';
  end if;
  -- 2026-11-27 지출 묶음: null = 그대로(지우지 않음), 직접 추가 줄만 바꿈
  if p_category is not null and l.kind <> 'custom' then
    raise exception 'bad_category' using errcode = '22023';
  end if;
  if p_category is not null and p_category is distinct from l.category then
    update public.split_line set category = p_category where id = l.id;
    perform public.split_touch(sp.id);
  end if;
  if coalesce(p_amount, l.amount) = l.amount and coalesce(nm, l.name) is not distinct from l.name then
    return;
  end if;
  update public.split_line set amount = coalesce(p_amount, amount), name = coalesce(nm, name) where id = l.id;
  perform public.split_touch(sp.id);
  if l.kind = 'allowance' and sp.owner_user_id is null and l.user_id <> auth.uid() then
    -- 관리하는 사람이 상대 용돈을 고침: 주인에게 ‘내 용돈이 바뀌었을 때’(파트너 변경 기록 대신)
    perform public.notify_my_allowance(sp.space_id, l.user_id);
  else
    -- 금액 비교는 새 이름 기준(이름만 바꾸면 금액 알림 없음), 이름은 따로 한 줄
    old := public.split_lines_json(sp.id, l.id, l.amount);
    perform public.log_split_changes(sp.id, old);
    if nm is not null and nm is distinct from l.name then
      perform public.log_partner_change(sp.space_id, 'split', sp.id, 'name:' || l.id, l.name, l.name, nm, true, '/salary?view=plan');
    end if;
  end if;
  perform public.sync_checklist(sp.id);
end;
$$;

revoke all on function public.split_line_set(uuid, bigint, text, text) from public, anon;
grant execute on function public.split_line_set(uuid, bigint, text, text) to authenticated;

-- 월급 계획 통째 저장: 지우고 다시 넣을 때 category 보존, 직접 추가 줄 20줄
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
      if customs > 20 then
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

-- 관리 형태 바꾸기: 규칙 그대로, 직접 추가 줄의 category만 이어받음
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
