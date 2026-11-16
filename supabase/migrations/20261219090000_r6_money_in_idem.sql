-- 6차 검토 novice(2026-11-16): 받은 돈 적기에서 ‘다음’을 누른 뒤(기록은 이때 만들어짐) 나갔다가 다시 하면 ‘받은 돈’이 두 줄.
-- log_money_in을 멱등으로: 같은 사람이 같은 금액·받은 날·종류로 1시간 안에 이미 적었고 아직 저금에 나눠 넣지 않은 기록이 있으면
-- 새로 만들지 않고 그 id를 돌려준다(앱은 그 기록의 W-20a로 이어짐). 시그니처 그대로, 스키마 변경 없음.
create or replace function public.log_money_in(p_amount bigint, p_received_on date default null, p_kind public.money_in_kind default 'etc')
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  sid uuid := (select space_id from public.app_user where id = auth.uid());
  rid uuid;
  on_ date := coalesce(p_received_on, public.kst_today());
  k public.money_in_kind := coalesce(p_kind, 'etc');
begin
  if sid is null then
    raise exception 'no_space' using errcode = '42501';
  end if;
  if p_amount is null or p_amount < 1 or p_amount > 99999999999 then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  if on_ > public.kst_today() then
    raise exception 'future_date' using errcode = '22023';
  end if;
  select m.id into rid from public.money_in m
    where m.owner_user_id = uid and m.deleted_at is null
      and m.amount = p_amount and m.received_on = on_ and m.kind = k
      and m.created_at > now() - interval '1 hour'
      and not exists (select 1 from public.goal_move g where g.money_in_id = m.id and g.deleted_at is null)
    order by m.created_at desc limit 1;
  if rid is not null then
    return rid;
  end if;
  insert into public.money_in (space_id, owner_user_id, amount, received_on, kind)
    values (sid, uid, p_amount, on_, k)
    returning id into rid;
  return rid;
end;
$$;
grant execute on function public.log_money_in(bigint, date, public.money_in_kind) to authenticated;
