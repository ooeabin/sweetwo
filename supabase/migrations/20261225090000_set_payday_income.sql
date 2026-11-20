-- 2026-11-20 사용자 결정: W-02 수입 카드가 아직 수입을 안 적었으면 프로필 월급을 기본값으로 보여 주고, 그 자리에서 금액을 고쳐 저장한다.
-- set_payday_income(p_checklist, p_amount): pay_auto_income(20261224090000)과 같은 기록(source = payday_auto, 종류 salary,
-- 날짜 = 그 사이클 월급날(오늘보다 뒤면 오늘), 저축·투자 배정 없음, 알림 없음)을 내 금액으로 넣고 auto_income_at을 찍음. 스키마는 추가만(함수 하나).
--  - 내 사이클만: 같은 공간, 각자 목록이면 그 주인만(합쳐서 공동 목록은 둘 다). 해제 대기 공동 목록, 닫힌 사이클은 못 씀.
--  - 멱등: auto_income_at이 이미 찍혀 있으면(확인했거나, 한 번 저장했거나, 0원으로 닫았거나) 아무것도 안 하고 null.
--  - 0원: 기록 없이 auto_income_at만 찍어 다시 안 물음(나중에 확인해도 자동 기록 안 넣음).
--  - 합쳐서: 내 줄은 p_amount, 상대 줄은 상대 프로필 월급(월급이 0보다 클 때) 그대로. 한 번 찍으면 상대 기본값도 같이 닫힘.
--  - 돌려주는 값: 내 기록 id(0원이면 null).
create function public.set_payday_income(p_checklist uuid, p_amount bigint)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  sid uuid := (select space_id from public.app_user where id = auth.uid());
  c public.pay_checklist;
  u record;
  on_ date;
  amt bigint;
  mine uuid;
  rid uuid;
begin
  if uid is null or sid is null then
    raise exception 'no_space' using errcode = '42501';
  end if;
  if p_amount is null or p_amount < 0 or p_amount > 99999999999 then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  select * into c from public.pay_checklist where id = p_checklist for update;
  if c.id is null or c.space_id is distinct from sid then
    raise exception 'no_checklist' using errcode = '42501';
  end if;
  if c.owner_user_id is not null and c.owner_user_id <> uid then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if c.owner_user_id is null
     and (select couple_state from public.couple_space where id = sid) = 'unlink_pending' then
    raise exception 'unlink_pending' using errcode = '42501';
  end if;
  if c.state = 'closed' then
    raise exception 'closed' using errcode = '22023';
  end if;
  if c.auto_income_at is not null then
    return null;
  end if;
  on_ := least(c.cycle_start, public.kst_today());
  for u in
    select a.id, a.monthly_income from public.app_user a
    where a.space_id = c.space_id and a.status = 'active'
      and (c.owner_user_id is null or a.id = c.owner_user_id)
  loop
    amt := case when u.id = uid then p_amount else coalesce(u.monthly_income, 0) end;
    if amt > 0 and not exists (select 1 from public.money_in m
        where m.owner_user_id = u.id and m.source = 'payday_auto' and m.received_on = on_) then
      insert into public.money_in (space_id, owner_user_id, amount, received_on, kind, source)
        values (c.space_id, u.id, amt, on_, 'salary', 'payday_auto')
        returning id into rid;
      if u.id = uid then
        mine := rid;
      end if;
    end if;
  end loop;
  update public.pay_checklist set auto_income_at = now() where id = c.id;
  return mine;
end;
$$;
revoke all on function public.set_payday_income(uuid, bigint) from public, anon;
grant execute on function public.set_payday_income(uuid, bigint) to authenticated;
