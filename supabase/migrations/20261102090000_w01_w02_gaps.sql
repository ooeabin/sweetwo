-- W-01·W-02 빠진 것(20 W-01, 07 3장).
-- 1) 배우자 분배표에서 배우자 내 목표 줄 금액 잠금을 서버에서도 확인(save_split, 'locked_line').
-- 2) 월급날을 바꾸면 이번 사이클 끝 = 새 기준일 전날(07 3장 34줄). 각자 = 내 체크리스트,
--    합쳐서 + 체크리스트 만드는 날 ‘자동’(두 월급날 중 늦은 날) = 공동 체크리스트.

create or replace function public.save_split(p_lines jsonb, p_owner uuid default null)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
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

  select id into split from public.salary_split
    where space_id = sid and owner_user_id is not distinct from p_owner;
  -- 배우자 분배표를 고칠 때 배우자 내 목표 줄 금액은 잠금(20 W-01 1번): 금액이 그대로여야 함
  if p_owner is not null and p_owner <> uid and exists (
    select 1 from public.goal g
    where g.space_id = sid and g.owner_user_id = p_owner and g.deleted_at is null
      and coalesce((select sum((x->>'amount')::bigint) from jsonb_array_elements(p_lines) x
                    where x->>'kind' = 'saving' and (x->>'goal_id')::uuid = g.id), 0)
          <> coalesce((select sum(sl.amount) from public.split_line sl
                       where sl.split_id = split and sl.kind = 'saving' and sl.goal_id = g.id), 0)
  ) then
    raise exception 'locked_line' using errcode = '42501';
  end if;
  if split is null then
    insert into public.salary_split (space_id, owner_user_id, updated_by)
      values (sid, p_owner, uid) returning id into split;
  else
    select jsonb_agg(jsonb_build_object('kind', kind, 'goal_id', goal_id, 'user_id', user_id, 'name', name, 'amount', amount))
      into old_lines from public.split_line where split_id = split;
    update public.salary_split set updated_by = uid, updated_at = now(), version = version + 1
      where id = split;
    delete from public.split_line where split_id = split;
  end if;

  for l in select * from jsonb_array_elements(p_lines) loop
    k := (l->>'kind')::public.split_line_kind;
    if k = 'saving' and not exists (
        select 1 from public.goal g
        where g.id = (l->>'goal_id')::uuid and g.space_id = sid and g.deleted_at is null) then
      raise exception 'bad_goal' using errcode = '22023';
    end if;
    if k = 'allowance' and (l->>'user_id') is not null and not exists (
        select 1 from public.app_user where id = (l->>'user_id')::uuid and space_id = sid) then
      raise exception 'bad_user' using errcode = '22023';
    end if;
    if k = 'custom' then
      customs := customs + 1;
      if customs > 10 then
        raise exception 'too_many_custom' using errcode = '22023';
      end if;
    end if;
    insert into public.split_line (split_id, space_id, kind, goal_id, user_id, name, amount, sort)
    values (
      split, sid, k,
      case when k = 'saving' then (l->>'goal_id')::uuid end,
      case when k = 'allowance' then coalesce((l->>'user_id')::uuid, p_owner, uid) end,
      case when k = 'custom' then btrim(l->>'name') end,
      (l->>'amount')::bigint,
      i
    );
    i := i + 1;
  end loop;
  if old_lines is not null then
    perform public.log_split_changes(split, old_lines);
  end if;
  perform public.sync_checklist(split);
  return split;
end;
$$;


-- 이번 사이클 끝을 새 기준일(p_day, 31 = 말일) 전날로 당김. 오늘 뒤 처음 오는 새 기준일 기준
create or replace function public.cut_cycle(p_space uuid, p_owner uuid, p_day smallint)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  today date := public.kst_today();
  nxt date;
begin
  if p_day is null then
    return;
  end if;
  nxt := public.cycle_date(p_day, extract(year from today)::int, extract(month from today)::int);
  if nxt <= today then
    nxt := public.cycle_date(p_day, extract(year from today + interval '1 month')::int,
                             extract(month from today + interval '1 month')::int);
  end if;
  update public.pay_checklist set cycle_end = greatest(nxt - 1, cycle_start)
    where space_id = p_space and owner_user_id is not distinct from p_owner
      and state <> 'closed' and cycle_end >= today;
end;
$$;
revoke all on function public.cut_cycle(uuid, uuid, smallint) from public, anon, authenticated;

create or replace function public.payday_cut_cycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sp public.couple_space;
  auto smallint;
begin
  if new.space_id is null or (new.payday is not distinct from old.payday and new.payday_last = old.payday_last) then
    return new;
  end if;
  select * into sp from public.couple_space where id = new.space_id;
  if sp.salary_mode = 'joint' then
    if sp.joint_cycle_day is null then
      select max(case when u.payday_last then 31 else u.payday end)::smallint into auto
        from public.app_user u where u.space_id = new.space_id and u.status = 'active';
      perform public.cut_cycle(new.space_id, null, auto);
    end if;
  else
    perform public.cut_cycle(new.space_id, new.id,
      (case when new.payday_last then 31 else new.payday end)::smallint);
  end if;
  return new;
end;
$$;
drop trigger if exists payday_cut_cycle on public.app_user;
create trigger payday_cut_cycle after update of payday, payday_last on public.app_user
  for each row execute function public.payday_cut_cycle();
