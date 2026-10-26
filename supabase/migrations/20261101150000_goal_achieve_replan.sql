-- G-05 달성 흐름 재기획(22 G-05 축하·매달 넣던 돈·사용 기록, 달성·보류 상태).
--   달성하면 분배표에서 그 목표 저금 줄이 빠짐(goal_lines_sync). 빠지기 전 줄 금액을 분배표마다 goal.freed_lines에 남겨
--   축하 다음 “매달 넣던 25만 원은 어디로 보낼까요?”에 씀(내 분배표, 합쳐서면 공동 분배표 금액).
--   축하 문장 재료 goal_story: 모은 달 = 그 목표 저금 줄을 체크한 체크리스트 달(‘9월 월급’) 수,
--     함께 모은 달 = 각자 모드 우리 목표에서 두 사람 체크리스트 모두 체크한 달 수(합쳐서·혼자·내 목표는 0 → 앱이 “n개월 만에”).
--   사용 기록 finish_goal_use(목표, 쓴 돈): 모은 돈에서 꺼내 쓰기(goal_move 'use', 모은 돈까지) + 사용 완료. 남은 돈을 돌려줌
--   남은 돈 넣기 move_goal_saved(목표, 받는 목표): 남은 모은 돈 전부를 빼고 받는 목표에 넣음(넣기·빼기 기록 두 줄)

alter table public.goal add column freed_lines jsonb not null default '{}'::jsonb; -- {split_id: 금액}

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
  want boolean;
  freed jsonb := '{}'::jsonb;
  amt bigint;
begin
  select * into g from public.goal where id = p_goal;
  if g.id is null then
    return;
  end if;
  select salary_mode into mode from public.couple_space where id = g.space_id;
  for s in select * from public.salary_split where space_id = g.space_id loop
    want := g.deleted_at is null and g.status in ('active', 'delayed') and (
      (mode = 'joint' and s.owner_user_id is null)
      or (mode = 'separate' and s.owner_user_id is not null
          and (g.owner_user_id is null or g.owner_user_id = s.owner_user_id)));
    if want and not exists (select 1 from public.split_line where split_id = s.id and goal_id = g.id) then
      select coalesce(max(sort), -1) into last from public.split_line where split_id = s.id and kind = 'saving';
      update public.split_line set sort = sort + 1 where split_id = s.id and sort > last;
      insert into public.split_line (split_id, space_id, kind, goal_id, amount, sort)
        values (s.id, g.space_id, 'saving', g.id, 0, last + 1);
      perform public.sync_checklist(s.id);
    elsif not want and exists (select 1 from public.split_line where split_id = s.id and goal_id = g.id) then
      -- 달성으로 빠지는 줄 금액은 남겨 둠(G-05 매달 넣던 돈)
      if g.status = 'achieved' then
        select coalesce(sum(amount), 0) into amt from public.split_line where split_id = s.id and goal_id = g.id;
        if amt > 0 then
          freed := freed || jsonb_build_object(s.id::text, amt);
        end if;
      end if;
      delete from public.split_line where split_id = s.id and goal_id = g.id;
      perform public.sync_checklist(s.id);
    end if;
  end loop;
  if freed <> '{}'::jsonb then
    update public.goal set freed_lines = freed_lines || freed where id = g.id;
  end if;
end;
$$;

-- 축하 문장 재료(옛 월 플랜 기준을 체크리스트 기준으로)
create or replace function public.goal_story(p_goal uuid)
returns table (months integer, together integer)
language sql
stable
security definer
set search_path = ''
as $$
  with g as (
    select x.* from public.goal x where x.id = p_goal and public.is_space_member(x.space_id)
  ),
  c as (
    select k.label, k.owner_user_id
    from g
    join public.pay_check_line l on l.goal_id = g.id and l.kind = 'saving' and l.state = 'checked'
    join public.pay_checklist k on k.id = l.checklist_id
    group by k.label, k.owner_user_id
  ),
  m as (
    select c.label, count(distinct c.owner_user_id) filter (where c.owner_user_id is not null) as people
    from c group by c.label
  )
  select count(*)::int,
    (case when (select owner_user_id from g) is null then count(*) filter (where m.people >= 2) else 0 end)::int
  from m;
$$;

-- 사용 기록: 쓴 돈만큼 꺼내 쓰기(모은 돈까지) + 사용 완료. 남은 돈(모은 돈 − 쓴 돈)을 돌려줌. 내 목표는 주인만
create or replace function public.finish_goal_use(p_goal uuid, p_spent bigint)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  g public.goal;
  saved bigint;
  use_amt bigint;
begin
  select * into g from public.goal where id = p_goal and deleted_at is null for update;
  if g.id is null or not public.is_space_member(g.space_id) then
    raise exception 'no_goal' using errcode = '42501';
  end if;
  if g.owner_user_id is not null and g.owner_user_id <> uid then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if g.status = 'used' then
    raise exception 'goal_used' using errcode = '40001';
  end if;
  if p_spent is null or p_spent < 1 or p_spent > 99999999999 then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  saved := public.goal_saved(g.id);
  use_amt := least(p_spent, saved);
  if use_amt > 0 then
    insert into public.goal_move (space_id, goal_id, kind, amount, created_by)
      values (g.space_id, g.id, 'use', use_amt, uid);
  end if;
  update public.goal set status = 'used' where id = g.id;
  return saved - use_amt;
end;
$$;
revoke all on function public.finish_goal_use(uuid, bigint) from public, anon;
grant execute on function public.finish_goal_use(uuid, bigint) to authenticated;

-- 남은 돈을 다른 목표(비상금 포함)로: 이 목표에서 빼고 받는 목표에 넣음. 옮긴 금액을 돌려줌
create or replace function public.move_goal_saved(p_goal uuid, p_to uuid)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  g public.goal;
  t public.goal;
  amt bigint;
begin
  select * into g from public.goal where id = p_goal and deleted_at is null for update;
  select * into t from public.goal where id = p_to and deleted_at is null;
  if g.id is null or t.id is null or g.space_id <> t.space_id or g.id = t.id
     or not public.is_space_member(g.space_id) then
    raise exception 'no_goal' using errcode = '42501';
  end if;
  if (g.owner_user_id is not null and g.owner_user_id <> uid) or (t.owner_user_id is not null and t.owner_user_id <> uid) then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  amt := public.goal_saved(g.id);
  if amt > 0 then
    insert into public.goal_move (space_id, goal_id, kind, amount, created_by)
      values (g.space_id, g.id, 'out', amt, uid), (t.space_id, t.id, 'in', amt, uid);
  end if;
  return amt;
end;
$$;
revoke all on function public.move_goal_saved(uuid, uuid) from public, anon;
grant execute on function public.move_goal_saved(uuid, uuid) to authenticated;
