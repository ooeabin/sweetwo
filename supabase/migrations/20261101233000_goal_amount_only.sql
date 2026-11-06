-- 내 목표 ‘금액만 보여 주기’(22 공개, 25 S-13 3번, 08 6장): 배우자에게는 이름 대신 “개인 목표”, 종류·답 없이 금액과 진행만.
-- 앱은 목표를 이 함수로 읽는다(서버가 가림). 행 범위는 goal_select(같은 공간 구성원)와 같음.
create or replace function public.space_goals()
returns setof public.goal
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when g.owner_user_id is not null and g.owner_user_id <> auth.uid() and g.visibility = 'amount'
      then jsonb_populate_record(g, jsonb_build_object('name', '개인 목표', 'template', 'custom', 'details', '{}'::jsonb))
    else g
  end
  from public.goal g
  where public.is_space_member(g.space_id);
$$;
revoke execute on function public.space_goals() from public, anon;
grant execute on function public.space_goals() to authenticated;
