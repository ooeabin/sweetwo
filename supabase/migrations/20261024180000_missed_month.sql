-- 놓친 달(21 ‘놓친 달’, 07 5장). 기준일이 지나도 정리하지 않은 플랜: 지금 정리하기 / 쉬어가기.
--
-- month_close.late: 다음 기준일이 지난 뒤 정리(지금 정리하기, 쉬어가기). 생활비 실제·보정 평균(3개월)에서 뺌
-- month_close.rested: 쉬어가기(그달 합계만, 미달·지연 계산에서 뺌)
-- rest_missed_months: 고른 지난 플랜(정리 안 한 것)을 ‘쉬어감’(skipped)으로. 2개월 이상 밀리면 한꺼번에

alter table public.month_close
  add column late boolean not null default false,
  add column rested boolean not null default false;

create or replace function public.rest_missed_months(p_plans uuid[])
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  sid uuid;
  n integer;
begin
  select space_id into sid from public.app_user where id = auth.uid();
  if sid is null then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if exists (
      select 1 from unnest(p_plans) x(id)
      where not exists (
        select 1 from public.monthly_plan p
        where p.id = x.id and p.space_id = sid and p.deleted_at is null
          and p.cycle_end < public.kst_today() and p.status <> 'closed')) then
    raise exception 'bad_plan' using errcode = '22023';
  end if;
  update public.monthly_plan set status = 'skipped' where id = any (p_plans) and status <> 'skipped';
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.rest_missed_months(uuid[]) from public, anon;
grant execute on function public.rest_missed_months(uuid[]) to authenticated;
