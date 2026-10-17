-- 다음 사이클 월급 플랜 만들기(07 월 사이클 1·2·3장)와 통장 방식 바꾸기(25 S-10a, 06 2장 ‘다음 사이클부터 적용’).
--
-- 플랜 금액 계산은 core 규칙(앱과 같은 코드)이라, 기준일이 지나 처음 앱을 연 사람의 앱이 계산해 이 함수로 만듦.
-- 같은 사이클은 한 번만(먼저 만든 사람 것). 미래 사이클·지난 플랜과 겹치는 사이클은 거절.
-- 해제 대기 중이면 새 플랜 대신 지난 플랜을 이 사이클 끝까지 연장(08 1장 ‘기준일이 오면 지난 플랜 연장’).
-- 통장 방식은 account_mode_next에 두고, 다음 플랜을 만들 때 바꿈.

alter table public.couple_space add column account_mode_next public.account_mode;
grant update (account_mode_next) on public.couple_space to authenticated;

create or replace function public.create_cycle_plan(
  p_label_month date,
  p_cycle_start date,
  p_cycle_end date,
  p_is_temp boolean,
  p_snapshot jsonb,
  p_lines jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sp public.couple_space;
  pid uuid;
  last public.monthly_plan;
  l jsonb;
  i integer := 0;
begin
  select s.* into sp from public.couple_space s
    join public.app_user u on u.space_id = s.id
    where u.id = uid and u.status = 'active'
    for update of s;
  if sp.id is null then
    raise exception 'no_space' using errcode = '42501';
  end if;
  select id into pid from public.monthly_plan
    where space_id = sp.id and cycle_start = p_cycle_start and deleted_at is null;
  if pid is not null then
    return pid;
  end if;
  if p_cycle_start > public.kst_today() or p_cycle_end < p_cycle_start
     or extract(day from p_label_month) <> 1 or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'bad_cycle' using errcode = '22023';
  end if;
  select * into last from public.monthly_plan
    where space_id = sp.id and deleted_at is null order by cycle_end desc limit 1;
  if last.id is null then
    raise exception 'no_first_plan' using errcode = 'P0001'; -- 첫 플랜은 O-66 start_first_plan
  end if;
  if last.cycle_end >= p_cycle_start then
    -- 지난 플랜이 이 사이클과 겹치면(합친 사이클 등) 그대로
    return last.id;
  end if;

  if sp.couple_state = 'unlink_pending' then
    update public.monthly_plan set cycle_end = p_cycle_end where id = last.id;
    return last.id;
  end if;

  if sp.account_mode_next is not null then
    update public.couple_space set account_mode = sp.account_mode_next, account_mode_next = null where id = sp.id;
  end if;

  insert into public.monthly_plan (space_id, label_month, cycle_start, cycle_end, is_partial, is_temp, snapshot)
    values (sp.id, p_label_month, p_cycle_start, p_cycle_end, false, p_is_temp, coalesce(p_snapshot, '{}'::jsonb))
    returning id into pid;
  for l in select * from jsonb_array_elements(p_lines) loop
    if l->>'goal_id' is not null and not exists (
      select 1 from public.goal g where g.id = (l->>'goal_id')::uuid and g.space_id = sp.id and g.deleted_at is null
    ) then
      raise exception 'bad_goal' using errcode = '42501';
    end if;
    insert into public.plan_line (
      plan_id, space_id, target, account_role, goal_id, amount, amount_groom, amount_bride, sort
    ) values (
      pid, sp.id, (l->>'target')::public.plan_line_target, (l->>'account_role')::public.account_role,
      (l->>'goal_id')::uuid, (l->>'amount')::bigint, (l->>'amount_groom')::bigint, (l->>'amount_bride')::bigint, i
    );
    i := i + 1;
  end loop;
  return pid;
end;
$$;
revoke execute on function public.create_cycle_plan(date, date, date, boolean, jsonb, jsonb) from public, anon;
grant execute on function public.create_cycle_plan(date, date, date, boolean, jsonb, jsonb) to authenticated;
