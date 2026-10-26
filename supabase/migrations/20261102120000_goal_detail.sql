-- G-02 목표 상세 빠진 것(22): 우리 ↔ 내 목표 바꾸기 상대 알림(goal_partner_change에 'owner'), 알림 줄 이름 ‘종류’.
-- S-11g·h 결혼 상태·결혼한 날을 바꾸면 상대 알림(25 S-11g·h, couple_partner_change).

create or replace function public.partner_change_line(p_topic text, p_field text, p_noun text, p_before text, p_after text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_topic = 'split' then p_noun || ' ' || coalesce(p_before, '0원') || ' → ' || coalesce(p_after, '0원')
    when p_topic = 'income' then coalesce(p_before, '0원') || ' → ' || coalesce(p_after, '0원')
    when p_topic in ('goal', 'goal_meta') and p_field = 'deleted' then '목표를 지웠어요' -- [확인 필요]
    when p_topic in ('goal', 'goal_meta') and p_field = 'restored' then '목표를 되살렸어요' -- [확인 필요]
    when p_topic = 'goal_meta' and p_field = 'added' then '목표를 추가했어요' -- [확인 필요]
    when p_topic = 'goal_meta' and p_field = 'order' then '목표 순서를 바꿨어요' -- [확인 필요]
    when p_topic in ('goal', 'goal_meta') then
      case p_field when 'amount' then '목표 금액' when 'deadline' then '기한' when 'name' then '이름'
        when 'status' then '상태' when 'kind' then '형태' when 'owner' then '종류' else p_field end
      || ' ' || coalesce(p_before, '없음') || ' → ' || coalesce(p_after, '없음')
    when p_topic = 'goal_move' then coalesce(p_after, '') -- “50만 원 넣었어요” [확인 필요]
    when p_topic = 'asset' and p_field = 'amount_hidden' then '개인 자산 금액이 바뀌었어요'
    when p_topic = 'asset' and p_field = 'amount' then p_noun || ' ' || p_before || ' → ' || p_after
    when p_topic = 'asset' and p_field = 'added' then p_noun || ' 추가' -- [확인 필요]
    when p_topic = 'asset' and p_field = 'deleted' then p_noun || ' 삭제' -- [확인 필요]
    when p_topic = 'asset' and p_field = 'restored' then p_noun || ' 되살림' -- [확인 필요]
    when p_topic = 'care' and p_field = 'added' then p_noun || ' 추가' -- [확인 필요]
    when p_topic = 'care' then p_noun || ' 메모' -- [확인 필요]
    when p_topic = 'cycle_day' then '체크리스트 만드는 날 ' || p_before || ' → ' || p_after -- [확인 필요]
    when p_topic = 'couple' then
      case p_field when 'marriage' then '결혼 상태' else '결혼한 날' end
      || ' ' || coalesce(p_before, '없음') || ' → ' || coalesce(p_after, '없음') -- [확인 필요]
    else p_noun
  end;
$$;


create or replace function public.goal_partner_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t text;
begin
  t := '/goals/' || new.id;
  -- 우리 ↔ 내 목표 바꾸기(22 G-02 ⋯): 상대 알림
  if tg_op = 'UPDATE' and new.owner_user_id is distinct from old.owner_user_id then
    perform public.log_partner_change(new.space_id, 'goal', new.id, 'owner', new.name,
      case when old.owner_user_id is null then '우리 목표' else '내 목표' end,
      case when new.owner_user_id is null then '우리 목표' else '내 목표' end, true, t); -- [확인 필요]
    return null;
  end if;
  if coalesce(new.owner_user_id, old.owner_user_id) is not null then
    return null;
  end if;
  if tg_op = 'INSERT' then
    perform public.log_partner_change(new.space_id, 'goal_meta', new.id, 'added', new.name, null, '1', false, t);
    return null;
  end if;
  if old.deleted_at is null and new.deleted_at is not null then
    perform public.log_partner_change(new.space_id, 'goal', new.id, 'deleted', new.name, null, '1', true, '/goals');
    return null;
  end if;
  if old.deleted_at is not null and new.deleted_at is null then
    perform public.log_partner_change(new.space_id, 'goal_meta', new.id, 'restored', new.name, null, '1', false, t);
    return null;
  end if;
  if new.target_amount is distinct from old.target_amount then
    perform public.log_partner_change(new.space_id, 'goal', new.id, 'amount', new.name,
      case when old.target_amount is not null then public.read_won(old.target_amount) end,
      case when new.target_amount is not null then public.read_won(new.target_amount) end, true, t);
  end if;
  if new.deadline is distinct from old.deadline then
    perform public.log_partner_change(new.space_id, 'goal', new.id, 'deadline', new.name,
      public.ym_label(old.deadline), public.ym_label(new.deadline), true, t);
  end if;
  if new.name is distinct from old.name then
    perform public.log_partner_change(new.space_id, 'goal_meta', new.id, 'name', new.name, old.name, new.name, false, t);
  end if;
  if new.priority is distinct from old.priority then
    -- 순서는 여러 목표가 한 번에 바뀌므로 공간에 하나로 묶음
    perform public.log_partner_change(new.space_id, 'goal_meta', null, 'order', '', null, '1', false, '/goals');
  end if;
  if new.kind is distinct from old.kind then
    perform public.log_partner_change(new.space_id, 'goal_meta', new.id, 'kind', new.name,
      case old.kind when 'once' then '한 번' when 'yearly' then '매년' else '매달' end,
      case new.kind when 'once' then '한 번' when 'yearly' then '매년' else '매달' end, false, t); -- [확인 필요]
  end if;
  if new.status is distinct from old.status
     and old.status in ('active', 'delayed', 'paused') and new.status in ('active', 'delayed', 'paused')
     and (old.status = 'paused') <> (new.status = 'paused') then
    perform public.log_partner_change(new.space_id, 'goal_meta', new.id, 'status', new.name,
      case when old.status = 'paused' then '보류' else '진행 중' end,
      case when new.status = 'paused' then '보류' else '진행 중' end, false, t); -- [확인 필요]
  end if;
  return null;
end;
$$;

create or replace function public.partner_change_title(p_topic text, p_noun text, who text)
returns text
language sql
immutable
set search_path = ''
as $$
  select who || '님이 ' || case
    when p_topic = 'split' then '분배표를 바꿨어요'
    when p_topic = 'income' then '월급을 바꿨어요' -- [확인 필요]
    when p_topic in ('goal', 'goal_meta', 'goal_move') then p_noun || ' 목표를 바꿨어요'
    when p_topic = 'asset' then '우리 자산을 바꿨어요'
    when p_topic = 'care' then '챙길 날을 바꿨어요' -- [확인 필요]
    when p_topic = 'cycle_day' then '체크리스트 만드는 날을 바꿨어요'
    when p_topic = 'couple' then '결혼 정보를 바꿨어요' -- [확인 필요]
    else '바꿨어요' end;
$$;

-- S-11g·h: 결혼 상태·결혼한 날 바꾸면 상대에게 바로 알림
create or replace function public.couple_partner_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.marriage_status is distinct from old.marriage_status then
    perform public.log_partner_change(new.id, 'couple', new.id, 'marriage', '',
      case old.marriage_status when 'married' then '했어요' when 'engaged' then '준비 중' end,
      case new.marriage_status when 'married' then '했어요' when 'engaged' then '준비 중' end, true, '/settings/me');
  end if;
  if new.wedding_date is distinct from old.wedding_date then
    perform public.log_partner_change(new.id, 'couple', new.id, 'wedding_date', '',
      case when old.wedding_date is not null then public.md_label(old.wedding_date) end,
      case when new.wedding_date is not null then public.md_label(new.wedding_date) end, true, '/settings/me');
  end if;
  return null;
end;
$$;
revoke all on function public.couple_partner_change() from public, anon, authenticated;
drop trigger if exists couple_partner_change on public.couple_space;
create trigger couple_partner_change after update of marriage_status, wedding_date on public.couple_space
  for each row execute function public.couple_partner_change();
