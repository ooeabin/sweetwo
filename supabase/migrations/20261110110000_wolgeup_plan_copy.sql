-- 2026-11-03 사용자에게 보이는 ‘분배표’를 ‘월급 계획’으로(알림 문구만). 함수 본문은 각 최신 정의와 같고 문구만 바꿈.

create or replace function public.notify_first_goal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  waiting public.app_user;
begin
  if old.onboarding_done_at is null and new.onboarding_done_at is not null and new.space_id is not null then
    select * into waiting from public.app_user
      where space_id = new.space_id and id <> new.id and status = 'active' and onboarding_step = 'P-WAIT' limit 1;
    if waiting.id is not null then
      perform public.notify(
        waiting.id, new.space_id, 'first_goal',
        coalesce(new.nickname, '배우자') || '님이 첫 목표를 정했어요',
        '이어서 내 월급 계획을 만들어요', '/join/p-04', null, new.id, 'first_goal:' || new.space_id);
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.answer_reconnect(p_accept boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  u public.couple_unlink;
  s uuid;
  x uuid;
  n uuid;
  who text;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into u from public.couple_unlink where id = (select m.id from public.my_unlink() m) for update;
  if u.id is null or u.reconnect_by is null or u.reconnect_answer is not null then
    raise exception 'no_request' using errcode = 'P0001';
  end if;
  if u.reconnect_by = uid then
    raise exception 'not_partner' using errcode = '42501';
  end if;
  if not p_accept then
    update public.couple_unlink set reconnect_answer = 'declined' where id = u.id;
    return;
  end if;
  if not coalesce(public.reconnect_ok(u.id), false) then
    raise exception 'reconnect_closed' using errcode = 'P0001';
  end if;
  s := u.space_id;
  foreach x in array array[u.requested_by, u.partner_id] loop
    select space_id into n from public.app_user where id = x;
    update public.app_user
      set space_id = s, onboarding_step = 'O-60', onboarding_done_at = coalesce(onboarding_done_at, now())
      where id = x;
    delete from public.couple_space where id = n and unlinked_from = s;
  end loop;
  update public.couple_space set couple_state = 'connected', deleted_at = null where id = s;
  update public.couple_unlink
    set reconnect_answer = 'accepted', status = 'reconnected', reconnected_at = now()
    where id = u.id;
  select coalesce(nickname, '') into who from public.app_user where id = uid;
  perform public.notify(
    u.reconnect_by, s, 'reconnected', who || '님과 다시 연결됐어요', '해제 전 같이 쓰던 목표와 월급 계획이 돌아왔어요',
    '/', null, uid, 'reconnect:' || u.id || ':accepted');
end;
$$;

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
      perform public.notify(u.id, cl.space_id, 'payday', '오늘은 월급날이에요', '월급 계획대로 보내고 체크해 주세요',
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

create or replace function public.partner_change_title(p_topic text, p_noun text, who text)
returns text
language sql
immutable
set search_path = ''
as $$
  select who || '님이 ' || case
    when p_topic = 'split' then '월급 계획을 바꿨어요'
    when p_topic = 'income' then '월급을 바꿨어요' -- [확인 필요]
    when p_topic in ('goal', 'goal_meta', 'goal_move') then p_noun || ' 목표를 바꿨어요'
    when p_topic = 'asset' then '우리 자산을 바꿨어요'
    when p_topic = 'care' then '챙길 날을 바꿨어요' -- [확인 필요]
    when p_topic = 'cycle_day' then '체크리스트 만드는 날을 바꿨어요'
    when p_topic = 'couple' then '결혼 정보를 바꿨어요' -- [확인 필요]
    else '바꿨어요' end;
$$;
