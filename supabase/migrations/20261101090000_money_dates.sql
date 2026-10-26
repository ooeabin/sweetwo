-- 돈 날짜(23 F-04a, 14 만기된 돈 정리·연말정산 준비).
--   만기일 당일 오전 9시: 명의자에게 “○○이 만기됐어요” → F-04a(다른 통장으로 옮겼어요 / 다시 가입했어요)
--   다른 통장으로 = 고른 통장 금액 + 만기 금액, 만기된 항목은 ‘만기 완료’(matured)로 보관(목록에서 빠짐, 지난 순자산 기록 유지)
--   다시 가입했어요 = 새 만기일만 바꿈
--   1월 둘째 주 월요일 오전 9시: 결혼한 부부 두 사람에게 연말정산 준비 → 가이드 체크리스트 ‘연말정산’
--   만기 D-60 알림은 자산만(부채 만기 빼고)

alter type public.asset_status add value if not exists 'matured';

-- F-04a 정리. p_to = 옮긴 통장(자산, 보유 중, 내가 고칠 수 있는 것), p_new_date = 다시 가입한 새 만기일(오늘 뒤). 둘 중 하나만
create or replace function public.settle_matured(p_asset uuid, p_to uuid default null, p_new_date date default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.asset;
  t public.asset;
begin
  select * into a from public.asset where id = p_asset and deleted_at is null and status = 'held' for update;
  if a.id is null or not public.asset_editable(a) or a.side <> 'asset' or a.maturity_date is null then
    raise exception 'not_found' using errcode = '42501';
  end if;
  if (p_to is null) = (p_new_date is null) then
    raise exception 'bad_choice' using errcode = '22023';
  end if;
  if p_new_date is not null then
    if p_new_date <= public.kst_today() then
      raise exception 'bad_date' using errcode = '22023';
    end if;
    update public.asset set maturity_date = p_new_date where id = a.id;
    return;
  end if;
  select * into t from public.asset
    where id = p_to and space_id = a.space_id and deleted_at is null and status = 'held' and side = 'asset' for update;
  if t.id is null or t.id = a.id or not public.asset_editable(t) then
    raise exception 'bad_target' using errcode = '22023';
  end if;
  if t.amount + a.amount > 99999999999 then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  update public.asset set amount = t.amount + a.amount, estimated = false where id = t.id;
  update public.asset set status = 'matured' where id = a.id;
end;
$$;
revoke all on function public.settle_matured(uuid, uuid, date) from public, anon;
grant execute on function public.settle_matured(uuid, uuid, date) to authenticated;

-- ── 오전 9시(20261031090000 + 만기일 당일, 연말정산) ─────────────────────────────
create or replace function public.send_morning_notifications(p_today date default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  today date := coalesce(p_today, public.kst_today());
  c public.care_day;
  cl public.pay_checklist;
  a public.asset;
  iv public.invite;
  sp public.couple_space;
  u public.app_user;
  d date;
  n integer;
  title text;
  cnt integer := 0;
begin
  -- 챙길 날: 두 사람 모두(미합류면 있는 사람). 서프라이즈는 재기획으로 새로 안 만들지만 남은 것은 만든 사람만, OS 알림 숨김
  for c in
    select x.* from public.care_day x
    join public.couple_space s on s.id = x.space_id and s.deleted_at is null
    where x.deleted_at is null and coalesce(array_length(x.alerts, 1), 0) > 0
  loop
    d := public.care_next_date(c, today);
    continue when d is null;
    n := d - today;
    continue when not (n = any (c.alerts));
    title := case n
      when 0 then '오늘은 ' || public.ko_is(c.name)
      when 7 then public.ko_subj(c.name) || ' 일주일 남았어요'
      when 14 then public.ko_subj(c.name) || ' 2주 남았어요'
      when 30 then public.ko_subj(c.name) || ' 한 달 남았어요'
      else public.ko_subj(c.name) || ' ' || n || '일 남았어요' end;
    for u in
      select x.* from public.app_user x
      where x.space_id = c.space_id and x.status = 'active' and (not c.secret or x.id = c.created_by)
    loop
      perform public.notify(
        u.id, c.space_id, 'care_day', title, case when n = 7 then '준비는 어떻게 되고 있나요?' end,
        '/calendar/day/' || c.id, 'gift', null,
        'care:' || c.id || ':' || d || ':' || n || ':' || u.id,
        case when c.secret then '챙길 날 알림이 있어요' end, c.secret);
      cnt := cnt + 1;
    end loop;
  end loop;

  -- 월급날: 오늘 시작한 체크리스트의 주인(합쳐서 = 둘 다)
  for cl in
    select x.* from public.pay_checklist x
    join public.couple_space s on s.id = x.space_id and s.deleted_at is null
    where x.cycle_start = today and x.state <> 'closed'
  loop
    for u in
      select x.* from public.app_user x
      where x.space_id = cl.space_id and x.status = 'active' and (cl.owner_user_id is null or x.id = cl.owner_user_id)
    loop
      perform public.notify(u.id, cl.space_id, 'payday', '오늘은 월급날이에요', '분배표대로 보내고 체크해 주세요',
        '/salary', 'calendar-check', null, 'payday:' || cl.id || ':' || u.id);
      cnt := cnt + 1;
    end loop;
  end loop;

  -- 만기 D-60(명의자, 공동 명의면 둘 다) / 전세 계약 만기 6개월 전(둘 다)
  for a in
    select x.* from public.asset x
    join public.couple_space s on s.id = x.space_id and s.deleted_at is null
    where x.deleted_at is null and x.status = 'held' and x.side = 'asset' and x.maturity_date is not null
      and ((x.kind = 'deposit_money' and x.maturity_date = (today + interval '6 months')::date)
        or (x.kind <> 'deposit_money' and x.maturity_date = today + 60))
  loop
    for u in
      select x.* from public.app_user x
      where x.space_id = a.space_id and x.status = 'active'
        and (a.kind = 'deposit_money' or a.owner <> 'person' or x.id = a.owner_user_id)
    loop
      if a.kind = 'deposit_money' then
        perform public.notify(u.id, a.space_id, 'jeonse_end', '전세 계약이 6개월 뒤 끝나요',
          '연장할지, 이사나 매수할지 정해 볼까요?', '/assets/' || a.id, 'house', null,
          'jeonse:' || a.id || ':' || a.maturity_date || ':' || u.id);
      else
        perform public.notify(u.id, a.space_id, 'maturity', public.ko_subj(a.name) || ' 두 달 뒤 만기예요', null,
          '/assets/' || a.id, 'piggy-bank', null, 'maturity:' || a.id || ':' || a.maturity_date || ':' || u.id);
      end if;
      cnt := cnt + 1;
    end loop;
  end loop;

  -- 만기일 당일: 만기된 돈 정리(F-04a) → 명의자(공동 명의면 둘 다). 전세 보증금은 빼고
  for a in
    select x.* from public.asset x
    join public.couple_space s on s.id = x.space_id and s.deleted_at is null
    where x.deleted_at is null and x.status = 'held' and x.side = 'asset'
      and x.kind <> 'deposit_money' and x.maturity_date = today
  loop
    for u in
      select x.* from public.app_user x
      where x.space_id = a.space_id and x.status = 'active' and (a.owner <> 'person' or x.id = a.owner_user_id)
    loop
      perform public.notify(u.id, a.space_id, 'matured', public.ko_subj(a.name) || ' 만기됐어요',
        '어디로 옮겼는지 알려 주세요', '/assets/' || a.id || '/matured', 'piggy-bank', null,
        'matured:' || a.id || ':' || a.maturity_date || ':' || u.id);
      cnt := cnt + 1;
    end loop;
  end loop;

  -- 연말정산 준비: 1월 둘째 주 월요일(8~14일 월요일), 결혼한 부부 두 사람 → 체크리스트 ‘연말정산’ 항목
  if extract(month from today) = 1 and extract(isodow from today) = 1 and extract(day from today) between 8 and 14 then
    for u in
      select x.* from public.app_user x
      join public.couple_space s on s.id = x.space_id and s.deleted_at is null and s.marriage_status = 'married'
      where x.status = 'active'
    loop
      perform public.notify(u.id, u.space_id, 'year_end_tax', '연말정산을 준비할 때예요',
        '공제를 누구에게 모을지 정해 볼까요?', '/settings/guides/check/year-end-tax', 'receipt', null,
        'tax:' || u.space_id || ':' || extract(year from today)::int || ':' || u.id);
      cnt := cnt + 1;
    end loop;
  end if;

  -- 초대 코드: 만료 3일·1일 전 리마인드, 만료 다음 날(아직 합류 전일 때만, 가장 최근 코드만)
  for iv in
    select distinct on (x.space_id) x.* from public.invite x
    join public.couple_space s on s.id = x.space_id and s.deleted_at is null and s.couple_state = 'not_joined'
    where x.used_at is null and x.created_by is not null
    order by x.space_id, x.created_at desc
  loop
    select * into sp from public.couple_space where id = iv.space_id;
    n := (iv.expires_at at time zone 'Asia/Seoul')::date - today;
    if n in (3, 1) then
      perform public.notify(iv.created_by, iv.space_id, 'invite_remind', '초대 코드가 ' || n || '일 뒤 만료돼요',
        case when sp.partner_nickname is not null then sp.partner_nickname || '님에게 다시 보내 볼까요?' end,
        '/settings/couple', 'user-plus', null, 'invite:' || iv.id || ':remind:' || n);
      cnt := cnt + 1;
    elsif n = -1 then
      perform public.notify(iv.created_by, iv.space_id, 'invite_expired', '초대 코드가 만료됐어요',
        '새 코드를 만들어 다시 보낼까요?', '/settings/couple', 'user-plus', null, 'invite:' || iv.id || ':expired');
      cnt := cnt + 1;
    end if;
  end loop;
  return cnt;
end;
$$;
revoke execute on function public.send_morning_notifications(date) from public, anon, authenticated;

-- 알림 묶음: 만기된 돈 정리, 연말정산 = 돈 날짜
alter table public.notification drop column topic;
alter table public.notification add column topic text generated always as (
  case
    when kind in ('payday', 'review_due', 'first_goal', 'plan_ready', 'close_start', 'close_remind') then 'plan'
    when kind in ('behalf_checked', 'partner_change', 'salary_mode', 'cycle_day', 'weekly_summary') then 'partner_change'
    when kind in ('partner_done', 'partner_activity') then 'silent'
    when kind in ('maturity', 'jeonse_end', 'matured', 'year_end_tax') then 'money'
    when kind = 'goal_achieved' then 'goal'
    when kind in ('partner_joined', 'invite_remind', 'invite_expired') then 'invite'
    when kind = 'care_day' then 'care_' || split_part(dedupe, ':', 4)
    when kind like 'proposal\_%' then 'proposal'
    else 'other'
  end
) stored;
