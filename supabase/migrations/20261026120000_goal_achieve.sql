-- G-05 달성 축하, 보낼 곳, 사용 기록(22 G-05, 달성·보류 상태).
-- 달성: 앱이 보유액 ≥ 목표 금액을 보면 achieve_goal → status 'achieved', 두 사람에게 알림(14 목표 달성).
--   축하 화면은 사람마다 한 번(goal.achieved_seen). 먼저 본 사람이 부르면 true, 나중에 연 사람도 처음이면 true.
-- 사용 기록 use_goal: 썼어요(낸 곳: 목표자금 통장 → 차감, 생활비 통장·카드 → 차감 + 이번 달 ‘목표자금 → 공동 생활비’ 줄,
--   각자 돈 → 기록만) / 다른 자산으로 옮겼어요. 사용 완료(status 'used'). 남은 보유액은 비상금(또는 고른 목표)으로 옮김.
-- goal_use.source: 'achieved'(G-05 사용), 'move'(남은 돈 옮김). moved_goal_id/moved_asset_id = 옮긴 곳.

alter type public.goal_use_source add value if not exists 'achieved';
alter type public.goal_use_source add value if not exists 'move';

alter table public.goal
  add column achieved_at timestamptz,
  add column achieved_seen uuid[] not null default '{}';

alter table public.goal_use
  add column moved_goal_id uuid references public.goal (id) on delete set null,
  add column moved_asset_id uuid references public.asset (id) on delete set null;

-- 달성 표시 + 축하 화면을 볼지(이 사람이 처음이면 true)
create or replace function public.achieve_goal(p_goal uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  g public.goal;
  u record;
begin
  select * into g from public.goal where id = p_goal and deleted_at is null for update;
  if g.id is null or not public.is_space_member(g.space_id) then
    raise exception 'not_found' using errcode = '42501';
  end if;
  if g.kind <> 'once' or g.template = 'wedding' then
    return false;
  end if;
  if g.status in ('active', 'delayed') then
    update public.goal set status = 'achieved', achieved_at = now(), achieved_seen = array[uid]
      where id = g.id;
    for u in select a.id from public.app_user a where a.space_id = g.space_id loop
      perform public.notify(u.id, g.space_id, 'goal_achieved', g.name || ' 목표를 달성했어요!', null,
        '/goals/' || g.id::text, 'trophy', uid, 'goal_achieved:' || g.id::text || ':' || u.id::text);
    end loop;
    return true;
  end if;
  if g.status = 'achieved' and not (uid = any (g.achieved_seen)) then
    update public.goal set achieved_seen = array_append(achieved_seen, uid) where id = g.id;
    return true;
  end if;
  return false;
end;
$$;
revoke all on function public.achieve_goal(uuid) from public, anon;
grant execute on function public.achieve_goal(uuid) to authenticated;

-- 축하 문장 재료(22 G-05 축하): 모은 달 수(이 목표 줄이 있던 플랜 달), 둘이 함께 넣은 달 수
-- (정리를 마친 달 중 이 목표 납입이 있고 두 사람 몫이 모두 1원 이상인 달)
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
  m as (
    select p.id as plan_id, p.label_month,
      sum(coalesce(l.amount_groom, 0)) as groom, sum(coalesce(l.amount_bride, 0)) as bride
    from g
    join public.plan_line l on l.goal_id = g.id and l.target = 'goal' and l.deleted_at is null
    join public.monthly_plan p on p.id = l.plan_id and p.deleted_at is null
    group by p.id, p.label_month
  ),
  d as (
    select c.plan_id, sum(s.amount) as amount
    from g
    join public.saving_deposit s on s.goal_id = g.id and s.deleted_at is null
    join public.month_close c on c.id = s.month_close_id and c.status = 'done'
    group by c.plan_id
  )
  select
    (select count(distinct label_month) from m)::integer,
    (select count(*) from m join d on d.plan_id = m.plan_id where d.amount > 0 and m.groom > 0 and m.bride > 0)::integer;
$$;
revoke all on function public.goal_story(uuid) from public, anon;
grant execute on function public.goal_story(uuid) to authenticated;

-- 사용 기록. p_kind 'spent' | 'moved'. p_held = 화면이 본 보유액(남은 돈 계산), p_rest_goal = 남은 돈 보낼 목표(없으면 비상금).
-- 돌려줌 {line: 넣은 나누기 줄 금액, rest: 옮긴 남은 돈, rest_goal: 옮긴 목표, use: 남은 돈 옮김 기록 id}
create or replace function public.use_goal(
  p_goal uuid,
  p_kind text,
  p_amount bigint,
  p_paid_from public.paid_from,
  p_held bigint,
  p_asset uuid default null,
  p_rest_goal uuid default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  g public.goal;
  me public.app_user;
  sp public.couple_space;
  plan public.monthly_plan;
  today date := public.kst_today();
  held bigint := greatest(coalesce(p_held, 0), 0);
  spent bigint := greatest(coalesce(p_amount, 0), 0);
  cut bigint := 0;
  mv bigint := 0;
  line_id uuid;
  rest bigint;
  target uuid;
  rest_use uuid;
begin
  select * into g from public.goal where id = p_goal and deleted_at is null for update;
  if g.id is null or not public.is_space_member(g.space_id) then
    raise exception 'not_found' using errcode = '42501';
  end if;
  if g.status = 'used' then
    raise exception 'already_used' using errcode = '22023';
  end if;
  if p_kind not in ('spent', 'moved') then
    raise exception 'bad_kind' using errcode = '22023';
  end if;
  select * into me from public.app_user where id = uid;
  select * into sp from public.couple_space where id = g.space_id;

  if p_kind = 'spent' then
    if p_paid_from not in ('goal_fund', 'living', 'personal') then
      raise exception 'bad_paid_from' using errcode = '22023';
    end if;
    -- 각자 돈은 기록만(보유액 그대로). 쓴 돈 > 보유액이면 보유액만큼(넘친 돈은 월말 정리 W-04c)
    cut := case when p_paid_from = 'personal' then 0 else least(spent, held) end;
    if p_paid_from = 'living' and sp.account_mode = 'roles' and cut > 0 then
      select * into plan from public.monthly_plan
        where space_id = g.space_id and deleted_at is null and cycle_start <= today and cycle_end >= today;
      if plan.id is not null and plan.status = 'closed' then
        select * into plan from public.monthly_plan
          where space_id = g.space_id and deleted_at is null and cycle_start > plan.cycle_end
          order by cycle_start limit 1;
      end if;
      if plan.id is not null and plan.status <> 'closed' then
        mv := cut;
        insert into public.plan_line (plan_id, space_id, target, account_role, goal_id, kind, amount,
                                      amount_groom, amount_bride, sort)
        values (plan.id, g.space_id, 'account', 'living', g.id, 'goal_to_living', mv,
                case when me.side = 'bride' then 0 else mv end,
                case when me.side = 'bride' then mv else 0 end,
                coalesce((select max(sort) + 1 from public.plan_line where plan_id = plan.id), 0))
        returning id into line_id;
      end if;
    end if;
    insert into public.goal_use (space_id, goal_id, amount, used_on, paid_from, source, plan_line_id)
    values (g.space_id, g.id, case when p_paid_from = 'personal' then spent else cut end, today, p_paid_from,
            'achieved', line_id);
  else
    -- 다른 자산으로 옮김: 보유액 전부가 그 자산으로
    if p_asset is null or not exists (
      select 1 from public.asset a where a.id = p_asset and a.space_id = g.space_id and a.deleted_at is null
    ) then
      raise exception 'bad_asset' using errcode = '22023';
    end if;
    cut := held;
    insert into public.goal_use (space_id, goal_id, amount, used_on, paid_from, source, moved_asset_id)
    values (g.space_id, g.id, held, today, 'goal_fund', 'move', p_asset);
  end if;

  update public.goal set status = 'used' where id = g.id;

  -- 남은 보유액 → 비상금(또는 고른 목표). 자산 간 이동이라 저축액에 안 셈
  rest := greatest(held - cut, 0);
  if rest > 0 then
    if p_rest_goal is not null then
      select id into target from public.goal
        where id = p_rest_goal and space_id = g.space_id and deleted_at is null and id <> g.id;
    else
      select id into target from public.goal
        where space_id = g.space_id and template = 'emergency' and deleted_at is null and id <> g.id
        order by created_at limit 1;
    end if;
    if target is not null then
      insert into public.goal_use (space_id, goal_id, amount, used_on, paid_from, source, moved_goal_id)
      values (g.space_id, g.id, rest, today, 'goal_fund', 'move', target)
      returning id into rest_use;
      update public.goal set other_held = least(other_held + rest, 99999999999) where id = target;
    else
      rest := 0;
    end if;
  end if;
  return jsonb_build_object('line', mv, 'rest', rest, 'rest_goal', target, 'use', rest_use);
end;
$$;
revoke all on function public.use_goal(uuid, text, bigint, public.paid_from, bigint, uuid, uuid) from public, anon;
grant execute on function public.use_goal(uuid, text, bigint, public.paid_from, bigint, uuid, uuid) to authenticated;

-- 남은 돈을 다른 목표로(10번 ‘다른 목표로’): 옮김 기록의 목표를 바꾸고 보유액도 옮김
create or replace function public.move_goal_rest(p_use uuid, p_goal uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  w public.goal_use;
begin
  select * into w from public.goal_use where id = p_use and source = 'move' and moved_goal_id is not null
    and deleted_at is null for update;
  if w.id is null or not public.is_space_member(w.space_id) then
    raise exception 'not_found' using errcode = '42501';
  end if;
  if not exists (select 1 from public.goal where id = p_goal and space_id = w.space_id and deleted_at is null
                 and id <> w.goal_id) then
    raise exception 'bad_goal' using errcode = '22023';
  end if;
  update public.goal set other_held = greatest(other_held - w.amount, 0) where id = w.moved_goal_id;
  update public.goal set other_held = least(other_held + w.amount, 99999999999) where id = p_goal;
  update public.goal_use set moved_goal_id = p_goal where id = w.id;
end;
$$;
revoke all on function public.move_goal_rest(uuid, uuid) from public, anon;
grant execute on function public.move_goal_rest(uuid, uuid) to authenticated;
