-- G-01 예외(22): 배우자가 방금 고친 목표는 카드 아래 회색 “예빈님이 기한을 바꿨어요”. 다음에 열면 사라짐(본 시각은 기기에 기억).
-- 나에게 온 목표 변경(partner_change, 30일 안) 중 목표마다 마지막 하나. partner_change는 직접 못 읽어 함수로만.
create or replace function public.recent_goal_changes()
returns table (goal_id uuid, field text, actor_id uuid, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (c.ref_id) c.ref_id, c.field, c.actor_id, c.created_at
  from public.partner_change c
  where c.receiver_id = auth.uid()
    and c.topic in ('goal', 'goal_meta')
    and c.ref_id is not null
    and c.created_at > now() - interval '30 days'
  order by c.ref_id, c.created_at desc;
$$;
revoke execute on function public.recent_goal_changes() from public, anon;
grant execute on function public.recent_goal_changes() to authenticated;
