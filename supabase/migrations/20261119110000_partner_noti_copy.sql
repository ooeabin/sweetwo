-- 2026-11-11 QA 3구간 S3-10, S3-29: 서버 알림 문구를 기획 14 표와 맞춤(‘목표’ 없앰), 호칭이 없으면 ‘파트너가’(“님이 …” 대신).
-- 초대 리마인드·만료 알림은 누군가 합류하는 중(코드를 잡아 둠, D1)이면 보내지 않음.
-- 함수 본문은 각 최신 정의(pg_get_functiondef)와 같고 문구와 리마인드 건너뛰기만 바꿈. 권한은 그대로.


CREATE OR REPLACE FUNCTION public.notify_joined()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  joiner public.app_user;
begin
  if old.couple_state = 'not_joined' and new.couple_state = 'connected' then
    select * into joiner from public.app_user
      where space_id = new.id and status = 'active' and id <> new.created_by limit 1;
    if joiner.id is null or new.created_by is null then return new; end if;
    perform public.notify(
      new.created_by, new.id, 'partner_joined',
      coalesce(coalesce(joiner.nickname, new.partner_nickname) || '님이', '파트너가') || ' 합류했어요',
      '이제 월급과 저금을 같이 봐요', '/', null, joiner.id, 'joined:' || new.id || ':' || joiner.id);
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_first_goal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  waiting public.app_user;
begin
  if old.onboarding_done_at is null and new.onboarding_done_at is not null and new.space_id is not null then
    select * into waiting from public.app_user
      where space_id = new.space_id and id <> new.id and status = 'active' and onboarding_step = 'P-WAIT' limit 1;
    if waiting.id is not null then
      perform public.notify(
        waiting.id, new.space_id, 'first_goal',
        coalesce(new.nickname || '님이', '파트너가') || ' 월급 계획을 만들었어요', -- [확인 필요] 2026-11-08
        '이제 월급 계획을 같이 볼 수 있어요', '/join/p-04', null, new.id, 'first_goal:' || new.space_id);
    end if;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.send_morning_notifications(p_today date DEFAULT NULL::date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  -- 경조사: 두 사람 모두(미합류면 있는 사람). 서프라이즈는 재기획으로 새로 안 만들지만 남은 것은 만든 사람만, OS 알림 숨김
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
        case when c.secret then '경조사 알림이 있어요' end, c.secret);
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
    -- 누군가 합류하는 중(코드를 잡아 둠)이면 보내지 않음(D1)
    continue when iv.used_by is not null or (iv.reserved_by is not null and iv.reserved_until > now());
    select * into sp from public.couple_space where id = iv.space_id;
    n := (iv.expires_at at time zone 'Asia/Seoul')::date - today;
    if n in (3, 1) then
      perform public.notify(iv.created_by, iv.space_id, 'invite_remind', '초대 코드가 ' || n || '일 뒤 만료돼요',
        coalesce(sp.partner_nickname || '님에게', '파트너에게') || ' 다시 보내 볼까요?',
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
$function$
;

CREATE OR REPLACE FUNCTION public.cancel_unlink()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := auth.uid();
  me public.app_user;
  u public.couple_unlink;
  other uuid;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into me from public.app_user where id = uid and status = 'active';
  select * into u from public.couple_unlink
    where space_id = me.space_id and status = 'pending' for update;
  if u.id is null then
    raise exception 'no_request' using errcode = 'P0001';
  end if;
  if u.requested_by <> uid then
    raise exception 'not_requester' using errcode = '42501';
  end if;
  if u.counter is not null then
    raise exception 'already_answered' using errcode = 'P0001';
  end if;
  update public.couple_unlink set status = 'cancelled', cancelled_at = now() where id = u.id;
  update public.couple_space set couple_state = 'connected'
    where id = u.space_id and couple_state = 'unlink_pending';
  select id into other from public.app_user
    where space_id = u.space_id and status = 'active' and id <> uid limit 1;
  if other is not null then
    perform public.notify(
      other, u.space_id, 'unlink_cancelled',
      coalesce(me.nickname || '님이', '파트너가') || ' 연결 해제 요청을 취소했어요', null,
      '/settings/couple', null, uid, 'unlink:' || u.id || ':cancelled');
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.request_reconnect()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := auth.uid();
  u public.couple_unlink;
  other uuid;
  who text;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into u from public.couple_unlink where id = (select m.id from public.my_unlink() m) for update;
  if u.id is null or not coalesce(public.reconnect_ok(u.id), false) then
    raise exception 'reconnect_closed' using errcode = 'P0001';
  end if;
  if u.reconnect_by is not null and u.reconnect_answer is null then
    raise exception 'already_requested' using errcode = 'P0001';
  end if;
  update public.couple_unlink
    set reconnect_by = uid, reconnect_at = now(), reconnect_answer = null
    where id = u.id;
  other := case when u.requested_by = uid then u.partner_id else u.requested_by end;
  select nickname into who from public.app_user where id = uid;
  perform public.notify(
    other, (select space_id from public.app_user where id = other), 'reconnect_requested',
    coalesce(who || '님이', '파트너가') || ' 다시 연결하자고 해요', '연결하면 해제 전 같이 쓰던 데이터가 돌아와요',
    '/settings/couple/reconnect', null, uid,
    'reconnect:' || u.id || ':' || extract(epoch from now())::bigint);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.cancel_account_deletion()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := auth.uid();
  me public.app_user;
  u public.couple_unlink;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into me from public.app_user where id = uid and status = 'deletion_requested' for update;
  if me.id is null or me.deletion_requested_at < now() - interval '30 days' then
    raise exception 'not_requested' using errcode = 'P0001';
  end if;
  update public.app_user set status = 'active', deletion_requested_at = null where id = uid;
  select * into u from public.couple_unlink
    where requested_by = uid and how = 'deleted' and status = 'confirmed'
      and confirmed_at >= me.deletion_requested_at - interval '1 minute'
    order by confirmed_at desc limit 1;
  if u.id is not null and u.partner_id is not null then
    -- 복구한 때부터 30일 안 다시 연결 가능(08 8장)
    update public.couple_unlink set reconnect_until = now() + interval '30 days' where id = u.id;
    perform public.notify(u.partner_id, (select space_id from public.app_user where id = u.partner_id),
      'partner_restored', coalesce(me.nickname || '님이', '파트너가') || ' 계정 삭제를 취소했어요',
      '30일 안에 다시 연결할 수 있어요', '/settings/couple', null, uid,
      'unlink:' || u.id || ':restored:' || extract(epoch from now())::bigint);
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.request_unlink(p_confirm text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := auth.uid();
  me public.app_user;
  other public.app_user;
  sp public.couple_space;
  new_id uuid;
  dl date := public.kst_today() + 14;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_confirm is distinct from '연결 해제' then
    raise exception 'confirm_mismatch' using errcode = 'P0001';
  end if;
  select * into me from public.app_user where id = uid and status = 'active';
  select * into sp from public.couple_space where id = me.space_id for update;
  if sp.id is null or sp.couple_state <> 'connected' then
    raise exception 'not_connected' using errcode = '42501';
  end if;
  select * into other from public.app_user where space_id = sp.id and status = 'active' and id <> uid limit 1;
  if other.id is null then
    raise exception 'not_connected' using errcode = '42501';
  end if;
  insert into public.couple_unlink (space_id, requested_by, partner_id, deadline, ratio, plan)
    values (sp.id, uid, other.id, dl, 50, '[]'::jsonb)
    returning id into new_id;
  update public.couple_space set couple_state = 'unlink_pending' where id = sp.id;
  perform public.notify(
    other.id, sp.id, 'unlink_requested',
    coalesce(me.nickname || '님이', '파트너가') || ' 연결 해제를 요청했어요',
    public.md_label(dl) || '에 해제돼요. 먼저 내보낼 데이터가 있는지 확인해 주세요',
    '/settings/couple/unlink/review', null, uid, 'unlink:' || new_id || ':requested');
  return new_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.finish_unlink(p_id uuid, p_how text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  u public.couple_unlink;
  x uuid;
  n uuid;
begin
  select * into u from public.couple_unlink where id = p_id and status = 'pending' for update;
  if u.id is null then
    raise exception 'no_request' using errcode = 'P0001';
  end if;
  update public.couple_unlink
    set status = 'confirmed', confirmed_at = now(), how = p_how, reconnect_until = now() + interval '30 days'
    where id = u.id;
  delete from public.notification where space_id = u.space_id;
  foreach x in array array[u.requested_by, u.partner_id] loop
    if x is null or not exists (select 1 from public.app_user where id = x and space_id = u.space_id) then
      continue;
    end if;
    insert into public.couple_space (couple_state, created_by, unlinked_from)
      values ('solo', x, u.space_id) returning id into n;
    -- 이름·로그인은 남김. 해제 안내(S-12h)를 먼저 보고 ‘시작하기’로 온보딩 O-11부터
    update public.app_user set space_id = n, onboarding_step = 'S-12H' where id = x;
    perform public.notify(x, n, 'unlink_confirmed', '연결이 해제됐어요',
      '30일 안에 다시 연결할 수 있어요', '/settings/couple/unlinked', null, null,
      'unlink:' || u.id || ':confirmed:' || x);
  end loop;
  update public.couple_space set couple_state = 'solo', deleted_at = now() where id = u.space_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.answer_reconnect(p_accept boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  select nickname into who from public.app_user where id = uid;
  perform public.notify(
    u.reconnect_by, s, 'reconnected', coalesce(who || '님과', '파트너와') || ' 다시 연결됐어요', '해제 전 공동 데이터를 되살렸어요',
    '/', null, uid, 'reconnect:' || u.id || ':accepted');
end;
$function$
;

CREATE OR REPLACE FUNCTION public.account_deletion_for(uid uuid)
 RETURNS date
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me public.app_user;
  sp public.couple_space;
  other uuid;
  ns uuid;
  x uuid;
begin
  select * into me from public.app_user where id = uid and status = 'active' for update;
  if me.id is null then
    raise exception 'not_active' using errcode = 'P0001';
  end if;
  select * into sp from public.couple_space where id = me.space_id for update;
  select id into other from public.app_user
    where space_id = sp.id and status = 'active' and id <> uid limit 1;

  if sp.id is not null and other is not null and sp.couple_state in ('connected', 'unlink_pending') then
    -- 연결 해제 확정과 같음: 두 사람 모두 빈 새 공간으로, 원래 공간(같이 쓰던 데이터 전부)은 30일 보관 뒤 지움
    update public.couple_unlink set status = 'cancelled', cancelled_at = now()
      where space_id = sp.id and status = 'pending';
    insert into public.couple_unlink (space_id, requested_by, partner_id, deadline, ratio, plan, status, how, confirmed_at,
                                      reconnect_until)
      values (sp.id, uid, other, public.kst_today(), 50, '[]'::jsonb, 'confirmed', 'deleted', now(),
              now() + interval '30 days');
    delete from public.notification where space_id = sp.id;
    delete from public.partner_change where space_id = sp.id;
    foreach x in array array[uid, other] loop
      insert into public.couple_space (couple_state, created_by, unlinked_from)
        values ('solo', x, sp.id) returning id into ns;
      update public.app_user set space_id = ns, onboarding_step = 'S-12H' where id = x;
    end loop;
    update public.couple_space set couple_state = 'solo', deleted_at = now() where id = sp.id;
    perform public.notify(other, (select space_id from public.app_user where id = other), 'partner_deleted',
      coalesce(me.nickname || '님이', '파트너가') || ' 계정을 삭제했어요', '같이 쓰던 데이터는 지웠어요', '/settings/couple/unlinked',
      'user-minus', null, 'deleted:' || uid || ':' || extract(epoch from now())::bigint);
  elsif sp.id is not null then
    update public.invite set expires_at = now() where space_id = sp.id and used_at is null and expires_at > now();
  end if;

  update public.app_user set status = 'deletion_requested', deletion_requested_at = now() where id = uid;
  return (now() at time zone 'Asia/Seoul')::date + 30;
end;
$function$
;
