-- S-22 위젯 설정(25 S-22, 26 위젯): “위젯에 보일 저축·투자”는 계정마다 고른 저금 항목 하나(기본 = 비움, 대표 저금).
-- 스키마는 추가만. 지금 값이 없거나(비움) 고른 항목이 휴지통·그만 모음·목표 금액 없음이면 앱이 대표 저금으로 돌아간다.
-- “위젯에 금액 보이기”는 기기마다라 서버에 두지 않는다(브리지 window.sweetwo.widget, 이 기기 저장소).
alter table public.app_user add column widget_goal_id uuid references public.goal (id) on delete set null;

-- 내 공간의 저금 항목만 고름(남의 공간 항목 id를 넣지 못하게)
create or replace function public.app_user_widget_goal_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.widget_goal_id is not null
     and not exists (select 1 from public.goal g where g.id = new.widget_goal_id and g.space_id = new.space_id) then
    raise exception 'widget_goal_not_in_space' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger app_user_widget_goal_check before insert or update of widget_goal_id on public.app_user
  for each row execute function public.app_user_widget_goal_check();

grant update (widget_goal_id) on public.app_user to authenticated;
