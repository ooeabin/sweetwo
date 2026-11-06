-- 목표 행 권한 좁히기(22 ‘목표 종류’, 08 부부·권한 표, 31 공개 범위).
-- - 읽기: 우리 목표·내 목표·배우자의 ‘모두 보여 주기’ 내 목표만. ‘금액만 보여 주기’ 배우자 목표는 표에서 직접 읽지 못하고
--   space_goals()(이름 가림)로만 봄 — 전에는 표를 직접 읽으면 이름·내용이 보였음
-- - 추가·고치기: 우리 목표는 둘 다, 내 목표는 주인만. 주인을 배우자로 바꿀 수 없음(우리 ↔ 내 목표만)
-- - 앱이 바로 고칠 수 있는 열만 허락(이름, 형태, 질문 답, 금액, 기한, 이미 모은 돈, 순서, 상태, 주인, 공개 범위, 휴지통).
--   공간·템플릿·사진·달성 기록은 함수로만. 상태는 진행·보류만(달성·사용 완료는 achieve_goal 등 함수)
drop policy goal_select on public.goal;
create policy goal_select on public.goal for select to authenticated using (
  public.is_space_member(space_id)
  and (owner_user_id is null or owner_user_id = auth.uid() or visibility = 'all')
);
drop policy goal_insert on public.goal;
create policy goal_insert on public.goal for insert to authenticated with check (
  public.is_space_member(space_id) and (owner_user_id is null or owner_user_id = auth.uid())
);
drop policy goal_update on public.goal;
create policy goal_update on public.goal for update to authenticated
  using (public.is_space_member(space_id) and (owner_user_id is null or owner_user_id = auth.uid()))
  with check (public.is_space_member(space_id) and (owner_user_id is null or owner_user_id = auth.uid()));

revoke update on public.goal from authenticated, anon;
grant update (name, kind, details, target_amount, amount_estimated, deadline, deadline_estimated, other_held,
  priority, status, owner_user_id, visibility, deleted_at) on public.goal to authenticated;

-- 앱이 직접 바꾸는 상태는 진행 중·지연·보류 사이만(함수 안에서는 current_user가 함수 주인이라 걸리지 않음)
create or replace function public.goal_client_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') and new.status is distinct from old.status
     and (new.status not in ('active', 'delayed', 'paused') or old.status not in ('active', 'delayed', 'paused')) then
    raise exception 'status_by_function' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger goal_client_guard before update of status on public.goal
  for each row execute function public.goal_client_guard();
