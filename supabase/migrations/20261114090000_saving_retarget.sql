-- W-12a ‘목표 금액을 새로 정할게요’(2026-11-09 round 3, docs/spec/20-salary-plan.md W-12a, ‘달성과 그만 모음’).
-- 달성했고 아직 고르지 않은 저금 항목의 목표 금액을 지금 모은 돈보다 큰 새 금액으로 바꾸고 ‘모으는 중’으로 되돌린다.
-- 기한은 지운다(앱이 이어서 W-10a 기한 화면을 엶). 줄·모은 돈은 그대로.
-- 지난 달성 알림은 남기되 dedupe 키를 바꿔, 새 목표 금액에 닿으면 축하와 알림이 한 번 더 간다.
-- 되돌리기는 기존 saving_item_unkeep(예전 목표 금액·기한, 달성 상태). 추가만(기존 함수는 그대로).
create or replace function public.saving_item_retarget(p_goal uuid, p_target bigint)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  g public.goal;
begin
  perform public.saving_item_editable(p_goal);
  select * into g from public.goal where id = p_goal for update;
  if g.status <> 'achieved' or g.closed_at is not null or g.target_amount is null then
    raise exception 'not_achieved' using errcode = '22023';
  end if;
  if p_target is null or p_target < 1 or p_target > 99999999999 then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  if p_target <= public.goal_saved(g.id) then
    raise exception 'not_above' using errcode = '22023';
  end if;
  update public.goal set target_amount = p_target, deadline = null, status = 'active',
    achieved_at = null, achieved_seen = '{}'
  where id = g.id;
  update public.notification set dedupe = 'goal_achieved_prev:' || g.id::text || ':' || user_id::text || ':' || id::text
  where dedupe like 'goal_achieved:' || g.id::text || ':%';
end;
$$;
revoke all on function public.saving_item_retarget(uuid, bigint) from public, anon;
grant execute on function public.saving_item_retarget(uuid, bigint) to authenticated;
