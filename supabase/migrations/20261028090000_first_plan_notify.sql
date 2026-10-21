-- 첫 월급 플랜 알림(18 P-11 대기, 14 알림). 시작한 사람이 온보딩 중에 배우자가 먼저 합류했으면,
-- 시작한 사람이 첫 플랜을 만든 순간(O-66) 합류한 사람에게 “{찬우}님이 첫 플랜을 만들었어요”.
-- 합류 전에 만든 첫 플랜은 받을 사람이 없어 알림 없음. 알림 묶음은 월급 플랜(plan_ready, 설정 S-14 ‘월급 플랜’).
create or replace function public.notify_first_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  maker public.app_user;
  u public.app_user;
begin
  if exists (select 1 from public.monthly_plan p
             where p.space_id = new.space_id and p.id <> new.id and p.deleted_at is null) then
    return new;
  end if;
  select * into maker from public.app_user where id = new.created_by;
  for u in select * from public.app_user
           where space_id = new.space_id and status = 'active' and id is distinct from new.created_by loop
    perform public.notify(
      u.id, new.space_id, 'plan_ready',
      coalesce(maker.nickname, '배우자') || '님이 첫 플랜을 만들었어요',
      '이번 달 월급 플랜을 같이 볼 수 있어요', '/', null, maker.id,
      'first_plan:' || new.space_id || ':' || u.id);
  end loop;
  return new;
end;
$$;
revoke execute on function public.notify_first_plan() from public, anon, authenticated;
create trigger monthly_plan_first_notify after insert on public.monthly_plan
  for each row execute function public.notify_first_plan();
