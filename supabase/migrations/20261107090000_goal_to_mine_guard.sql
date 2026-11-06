-- 우리 목표 → 내 목표 바꾸기를 서버도 막음(22 ‘목표 종류’ 표: 상대가 체크한 저금 줄과 상대가 직접 넣은 돈이 하나도 없을 때만,
-- 비상금 제외). 전에는 화면만 막았음. 합쳐서 모드도 줄 주인이 아니라 ‘체크한 사람’ 기준.
create or replace function public.goal_to_mine_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.owner_user_id is null and new.owner_user_id is not null then
    if old.template = 'emergency' then
      raise exception 'emergency_is_ours' using errcode = '42501';
    end if;
    if exists (
      select 1 from public.pay_check_line l
      where l.goal_id = old.id and l.state = 'checked' and l.checked_by is not null
        and l.checked_by <> new.owner_user_id
    ) or exists (
      select 1 from public.goal_move m
      where m.goal_id = old.id and m.kind = 'in' and m.deleted_at is null
        and m.created_by is not null and m.created_by <> new.owner_user_id
    ) then
      raise exception 'partner_saved' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger goal_to_mine_guard before update of owner_user_id on public.goal
  for each row execute function public.goal_to_mine_guard();
