-- 서버가 만드는 알림·메일 문구를 3차 검토 용어로(2026-11-15, docs/spec/README.md ‘용어’ 3차 검토, [확인 필요]). 함수 본문은 최신 정의 그대로, 문구만 바꿈(동작·시그니처 그대로).
-- 합쳐서 관리해요 → 월급을 합쳐서 써요, 각자 관리해요 → 월급은 각자 써요, 체크리스트 → 월급날 확인 목록, 경조사(제목) → 경조사·기념일.
-- 이미 보낸 알림 행은 고치지 않음(기록). 월급 3일 전 알림(review_due) 문장은 홈 H-11 한 줄과 같아서 그대로.

-- partner_change_title (최신 정의: 20261126090000_s10_noti.sql)
CREATE OR REPLACE FUNCTION public.partner_change_title(p_topic text, p_noun text, who text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select coalesce(nullif(who, '') || '님이', '파트너가') || ' ' || case
    when p_topic = 'split' then '월급 계획을 바꿨어요'
    when p_topic = 'income' then '월급을 바꿨어요' -- [확인 필요]
    when p_topic in ('goal', 'goal_meta', 'goal_move') then p_noun || ' 저금을 바꿨어요' -- [확인 필요] 2026-11-09 사용자에게는 ‘저금’
    when p_topic = 'asset' then '자산을 바꿨어요' -- [확인 필요] 2026-11-09 ‘우리 자산’ 대신
    when p_topic = 'care' then '경조사·기념일을 바꿨어요' -- [확인 필요] 2026-11-15 3차 검토(제목 ‘경조사·기념일’)
    when p_topic = 'cycle_day' then '월급날 확인 목록 만드는 날을 바꿨어요' -- [확인 필요] 2026-11-15 3차 검토
    when p_topic = 'couple' then '결혼 정보를 바꿨어요' -- [확인 필요]
    else '바꿨어요' end;
$function$;

-- partner_change_line (최신 정의: 20261116090000_w01_receipt.sql)
create or replace function public.partner_change_line(p_topic text, p_field text, p_noun text, p_before text, p_after text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_topic = 'split' and p_field = 'order' then '월급 계획 순서를 바꿨어요' -- [확인 필요] 2026-11-09 W-01 편집
    when p_topic = 'split' and p_field like 'name:%' then '이름 ' || coalesce(p_before, '') || ' → ' || coalesce(p_after, '') -- [확인 필요]
    when p_topic = 'split' then p_noun || ' ' || coalesce(p_before, '0원') || ' → ' || coalesce(p_after, '0원')
    when p_topic = 'income' then coalesce(p_before, '0원') || ' → ' || coalesce(p_after, '0원')
    when p_topic in ('goal', 'goal_meta') and p_field = 'deleted' then '저금을 지웠어요' -- [확인 필요] 2026-11-09
    when p_topic in ('goal', 'goal_meta') and p_field = 'restored' then '저금을 되살렸어요' -- [확인 필요] 2026-11-09
    when p_topic = 'goal_meta' and p_field = 'added' then '저금을 추가했어요' -- [확인 필요] 2026-11-09
    when p_topic = 'goal_meta' and p_field = 'closed' then
      case when p_after = '0' then '다시 모으기로 했어요' else '그만 모으기로 했어요' end -- [확인 필요]
    when p_topic = 'goal_meta' and p_field = 'order' then '목표 순서를 바꿨어요' -- (예전 기록)
    when p_topic = 'goal_meta' and p_field = 'photo' then '목표 사진을 바꿨어요' -- (예전 기록)
    when p_topic in ('goal', 'goal_meta') then
      case p_field when 'amount' then '목표 금액' when 'deadline' then '기한' when 'name' then '이름'
        when 'status' then '상태' when 'kind' then '형태' when 'owner' then '종류' else p_field end
      || ' ' || coalesce(p_before, '없음') || ' → ' || coalesce(p_after, '없음')
    when p_topic = 'goal_move' then coalesce(p_after, '') -- (예전 기록)
    when p_topic = 'asset' and p_field = 'amount_hidden' then '개인 자산 금액이 바뀌었어요'
    when p_topic = 'asset' and p_field = 'amount' then p_noun || ' ' || p_before || ' → ' || p_after
    when p_topic = 'asset' and p_field = 'added' then p_noun || ' 추가' -- [확인 필요]
    when p_topic = 'asset' and p_field = 'deleted' then p_noun || ' 삭제' -- [확인 필요]
    when p_topic = 'asset' and p_field = 'restored' then p_noun || ' 되살림' -- [확인 필요]
    when p_topic = 'care' and p_field = 'added' then p_noun || ' 추가' -- [확인 필요]
    when p_topic = 'care' then p_noun || ' 메모' -- [확인 필요]
    when p_topic = 'cycle_day' then '월급날 확인 목록 만드는 날 ' || p_before || ' → ' || p_after -- [확인 필요] 2026-11-15 3차 검토
    when p_topic = 'couple' then
      case p_field when 'marriage' then '결혼 상태' else '결혼한 날' end
      || ' ' || coalesce(p_before, '없음') || ' → ' || coalesce(p_after, '없음') -- [확인 필요]
    else p_noun
  end;
$$;

-- set_salary_mode (최신 정의: 20261126090000_s10_noti.sql)
CREATE OR REPLACE FUNCTION public.set_salary_mode(p_mode salary_mode)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := auth.uid();
  sid uuid := (select space_id from public.app_user where id = auth.uid());
  sp public.couple_space;
  me public.app_user;
  other public.app_user;
  joint_id uuid;
  a_id uuid;
  b_id uuid;
  cd uuid; -- 기준일 사람(남는 차이를 받는 쪽)
  share numeric; -- 기준일이 아닌 사람 몫 비율
  l record;
  n integer := 0;
  na integer := 0;
  nb integer := 0;
  part bigint;
  who uuid;
begin
  if sid is null then
    raise exception 'no_space' using errcode = '42501';
  end if;
  select * into sp from public.couple_space where id = sid for update;
  if sp.couple_state = 'unlink_pending' then
    raise exception 'unlink_pending' using errcode = '42501';
  end if;
  if sp.salary_mode = p_mode then
    return;
  end if;
  select * into me from public.app_user where id = uid;
  select * into other from public.app_user where space_id = sid and id <> uid and status = 'active' limit 1;

  if p_mode = 'joint' then
    insert into public.salary_split (space_id, owner_user_id, updated_by) values (sid, null, uid) returning id into joint_id;
    -- 저금: 같은 항목은 합침, 만든 순서
    for l in
      select x.goal_id, sum(x.amount)::bigint as amount
      from public.split_line x join public.salary_split s on s.id = x.split_id
      join public.goal g on g.id = x.goal_id
      where s.space_id = sid and s.owner_user_id is not null and x.kind = 'saving'
      group by x.goal_id, g.priority, g.created_at
      order by g.priority, g.created_at
    loop
      insert into public.split_line (split_id, space_id, kind, goal_id, amount, sort) values (joint_id, sid, 'saving', l.goal_id, l.amount, n);
      n := n + 1;
    end loop;
    for l in
      select x.kind, sum(x.amount)::bigint as amount from public.split_line x join public.salary_split s on s.id = x.split_id
      where s.space_id = sid and s.owner_user_id is not null and x.kind in ('fixed', 'living')
      group by x.kind order by x.kind
    loop
      insert into public.split_line (split_id, space_id, kind, amount, sort) values (joint_id, sid, l.kind, l.amount, n);
      n := n + 1;
    end loop;
    -- 용돈: 사람마다 1줄(그대로)
    for l in
      select x.user_id, x.amount from public.split_line x join public.salary_split s on s.id = x.split_id
      where s.space_id = sid and s.owner_user_id is not null and x.kind = 'allowance'
      order by s.owner_user_id, x.sort
    loop
      insert into public.split_line (split_id, space_id, kind, user_id, amount, sort)
        values (joint_id, sid, 'allowance', l.user_id, l.amount, n);
      n := n + 1;
    end loop;
    -- 직접 추가 줄: 같은 이름은 금액을 더해 한 줄(S5-05, D2). 순서는 처음 나온 자리(바꾼 사람 것 먼저).
    -- 10줄이 넘어도 모두 둠(더 추가하는 것만 막힘)
    for l in
      select x.name, sum(x.amount)::bigint as amount,
        min((case when s.owner_user_id = uid then 0 else 1 end) * 100000 + x.sort) as first_at
      from public.split_line x join public.salary_split s on s.id = x.split_id
      where s.space_id = sid and s.owner_user_id is not null and x.kind = 'custom'
      group by x.name
      order by first_at, x.name
    loop
      insert into public.split_line (split_id, space_id, kind, name, amount, sort)
        values (joint_id, sid, 'custom', l.name, l.amount, n);
      n := n + 1;
    end loop;
    delete from public.salary_split where space_id = sid and owner_user_id is not null;
  else
    select id into joint_id from public.salary_split where space_id = sid and owner_user_id is null;
    if other.id is null then
      update public.salary_split set owner_user_id = uid where id = joint_id;
      update public.goal set owner_user_id = uid where space_id = sid and owner_user_id is null;
    elsif joint_id is not null then
      -- 기준일 사람 = 공동 기준일과 월급날이 같은 사람(없으면 시작한 사람)
      cd := coalesce(
        (select u.id from public.app_user u where u.space_id = sid and u.status = 'active'
           and (case when u.payday_last then 31 else u.payday end) = public.cycle_day(sid, null)
         order by (u.id = sp.created_by) desc limit 1),
        sp.created_by);
      share := case when coalesce(me.monthly_income, 0) + coalesce(other.monthly_income, 0) = 0 then 0.5
        else (case when cd = uid then coalesce(other.monthly_income, 0) else coalesce(me.monthly_income, 0) end)::numeric
             / (coalesce(me.monthly_income, 0) + coalesce(other.monthly_income, 0)) end;
      insert into public.salary_split (space_id, owner_user_id, updated_by) values (sid, cd, uid) returning id into a_id;
      insert into public.salary_split (space_id, owner_user_id, updated_by)
        values (sid, case when cd = uid then other.id else uid end, uid) returning id into b_id;
      for l in
        select x.*, g.owner_user_id as goal_owner, g.created_by as goal_maker
        from public.split_line x left join public.goal g on g.id = x.goal_id
        where x.split_id = joint_id order by x.sort
      loop
        if l.kind = 'allowance' and l.user_id is not null then
          if l.user_id = cd then
            insert into public.split_line (split_id, space_id, kind, user_id, amount, sort) values (a_id, sid, 'allowance', l.user_id, l.amount, na);
            na := na + 1;
          else
            insert into public.split_line (split_id, space_id, kind, user_id, amount, sort) values (b_id, sid, 'allowance', l.user_id, l.amount, nb);
            nb := nb + 1;
          end if;
        elsif l.kind = 'saving' then
          who := coalesce(l.goal_owner,
            case when l.goal_maker in (uid, other.id) then l.goal_maker end, cd);
          if who = cd then
            insert into public.split_line (split_id, space_id, kind, goal_id, amount, sort) values (a_id, sid, 'saving', l.goal_id, l.amount, na);
            na := na + 1;
          else
            insert into public.split_line (split_id, space_id, kind, goal_id, amount, sort) values (b_id, sid, 'saving', l.goal_id, l.amount, nb);
            nb := nb + 1;
          end if;
        else
          part := (round(l.amount * share / 10000) * 10000)::bigint;
          insert into public.split_line (split_id, space_id, kind, goal_id, name, amount, sort)
            values (a_id, sid, l.kind, l.goal_id, l.name, l.amount - part, na);
          insert into public.split_line (split_id, space_id, kind, goal_id, name, amount, sort)
            values (b_id, sid, l.kind, l.goal_id, l.name, part, nb);
          na := na + 1;
          nb := nb + 1;
        end if;
      end loop;
      delete from public.salary_split where id = joint_id;
    end if;
  end if;
  update public.couple_space set salary_mode = p_mode where id = sid;
  -- 각자로: 주인 없는 저금 항목은 만든 사람(없으면 기준일 사람) 것. 줄은 위에서 옮겼고, 방식을 바꾼 뒤라 줄 맞추기가 그대로 둠
  if p_mode = 'separate' and other.id is not null and cd is not null then
    update public.goal set owner_user_id = case when created_by in (uid, other.id) then created_by else cd end
      where space_id = sid and owner_user_id is null;
  end if;
  if other.id is not null and sp.couple_state = 'connected' then
    perform public.notify(
      other.id, sid, 'salary_mode',
      coalesce(me.nickname || '님이', '파트너가') || ' 월급 관리 방식을 바꿨어요',
      case when p_mode = 'joint' then '다음 월급날부터 월급을 합쳐서 써요' else '다음 월급날부터 월급은 각자 써요' end, -- [확인 필요] D3
      '/salary?view=plan', null, uid, 'mode:' || sid || ':' || now()::text);
  end if;
end;
$function$;

-- set_join_salary_mode (최신 정의: 20261126090000_s10_noti.sql)
CREATE OR REPLACE FUNCTION public.set_join_salary_mode(p_mode salary_mode)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := auth.uid();
  sid uuid := public.joining_space();
  sp public.couple_space;
  starter public.app_user;
  me public.app_user;
begin
  select * into sp from public.couple_space where id = sid for update;
  if sp.salary_mode = p_mode then
    return;
  end if;
  select * into starter from public.app_user where id = sp.created_by;
  select * into me from public.app_user where id = uid;
  if p_mode = 'joint' then
    update public.salary_split set owner_user_id = null where space_id = sid and owner_user_id = starter.id;
    update public.pay_checklist set owner_user_id = null where space_id = sid and owner_user_id = starter.id;
    -- 기준일은 joint_cycle_day가 비어 있으면 두 사람 월급날 중 늦은 날(cycle_day)
    update public.couple_space set salary_mode = 'joint' where id = sid;
  else
    update public.salary_split set owner_user_id = starter.id where space_id = sid and owner_user_id is null;
    update public.pay_checklist set owner_user_id = starter.id where space_id = sid and owner_user_id is null;
    update public.couple_space set salary_mode = 'separate' where id = sid;
  end if;
  if starter.id is not null then
    perform public.notify(
      starter.id, sid, 'salary_mode',
      coalesce(me.nickname || '님이', '파트너가') || ' 월급 관리 방식을 바꿨어요',
      case when p_mode = 'joint' then '다음 월급날부터 월급을 합쳐서 써요' else '다음 월급날부터 월급은 각자 써요' end, -- [확인 필요] D3
      '/salary?view=plan', null, uid, 'join_mode:' || sid || ':' || uid || ':' || p_mode);
  end if;
end;
$function$;

-- request_mode_change (최신 정의: 20261206090000_v22_join_style.sql)
create or replace function public.request_mode_change(p_shared_living boolean, p_shared_saving boolean, p_manager text,
  p_phrase text default 's11f_combine')
returns text language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  me public.app_user;
  sp public.couple_space;
  other uuid;
  r record;
  mgr uuid;
  needs boolean;
  rid uuid;
  who text;
begin
  select * into me from public.app_user where id = uid;
  if me.space_id is null then
    raise exception 'no_space' using errcode = '42501';
  end if;
  select * into sp from public.couple_space where id = me.space_id for update;
  if sp.couple_state = 'unlink_pending' then
    raise exception 'unlink_pending' using errcode = '42501';
  end if;
  if p_phrase not in ('p04_send', 's11f_combine', 's11f_manager') then
    raise exception 'bad_phrase' using errcode = '22023';
  end if;
  select * into r from public.resolve_manage_style(p_shared_living, p_shared_saving, p_manager);
  select id into other from public.app_user where space_id = sp.id and status = 'active' and id <> uid limit 1;
  if r.manager = 'partner' and other is null then
    -- 합류 전 ‘파트너가 주로 해요’: 관리하는 사람은 합류할 때 정해짐(계약 1)
    mgr := null;
  else
    mgr := case r.manager when 'me' then uid when 'partner' then other end;
  end if;
  -- 계약 4: 온보딩을 마치기 전(시작한 사람이 O-30을 답하는 중 파트너가 먼저 합류)은 수락 없이 바로
  needs := coalesce(me.onboarding_done_at is not null and sp.couple_state = 'connected' and other is not null and (
    (sp.salary_mode = 'separate' and r.salary_mode = 'joint')
    or (r.salary_mode = 'joint' and mgr is not distinct from other and sp.manager_user_id is distinct from other)), false);
  if not needs then
    update public.mode_change_request set status = 'cancelled', answered_at = now()
      where space_id = sp.id and status = 'open';
    perform public.apply_manage_style(sp.id, p_shared_living, p_shared_saving, r.salary_mode, mgr);
    update public.couple_space set manager_pending_partner = coalesce(r.manager = 'partner' and other is null, false)
      where id = sp.id;
    if other is not null and sp.couple_state = 'connected' and sp.salary_mode = r.salary_mode then
      perform public.notify(other, sp.id, 'salary_mode',
        coalesce(me.nickname || '님이', '파트너가') || ' 관리 방식을 바꿨어요', null, -- [확인 필요]
        '/settings/couple/style', 'arrows-clockwise', uid, 'style:' || sp.id || ':' || extract(epoch from now())::bigint);
    end if;
    return 'applied';
  end if;
  update public.mode_change_request set status = 'cancelled', answered_at = now()
    where space_id = sp.id and status = 'open';
  insert into public.mode_change_request (space_id, from_user, to_mode, to_manager, to_shared_living, to_shared_saving, phrase)
    values (sp.id, uid, r.salary_mode, mgr, p_shared_living, p_shared_saving, p_phrase)
    returning id into rid;
  who := coalesce(me.nickname || '님이', '파트너가');
  perform public.notify(other, sp.id, 'mode_request',
    case p_phrase
      when 'p04_send' then who || ' 월급은 대부분 ' || coalesce((select nickname from public.app_user where id = other) || '님에게', '나에게')
        || ' 보낸다고 했어요' -- [확인 필요] 4-3 3번
      when 's11f_manager' then who || ' 관리를 맡아 달라고 해요' -- [확인 필요]
      else who || ' 월급을 합쳐서 쓰자고 해요' end, -- [확인 필요] 4-3 3번, 2026-11-15 3차 검토
    null, '/settings/couple/style/request/' || rid, 'arrows-clockwise', uid, 'mode_request:' || rid);
  return 'requested';
end;
$$;

-- answer_mode_change (최신 정의: 20261202090000_v22_manage_share.sql)
create or replace function public.answer_mode_change(p_request uuid, p_accept boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  q public.mode_change_request;
  who text := (select nickname from public.app_user where id = auth.uid());
begin
  select * into q from public.mode_change_request where id = p_request for update;
  if q.id is null or not public.is_space_member(q.space_id) or q.from_user = uid then
    raise exception 'not_found' using errcode = '42501';
  end if;
  if q.status <> 'open' then
    raise exception 'not_open' using errcode = '22023';
  end if;
  if q.expires_at < now() then
    update public.mode_change_request set status = 'expired' where id = q.id;
    return 'expired';
  end if;
  if (select couple_state from public.couple_space where id = q.space_id) <> 'connected' then
    raise exception 'unlink_pending' using errcode = '42501';
  end if;
  update public.mode_change_request set status = case when p_accept then 'accepted' else 'declined' end, answered_at = now()
    where id = q.id;
  if p_accept then
    perform public.apply_manage_style(q.space_id, q.to_shared_living, q.to_shared_saving, q.to_mode, q.to_manager);
  end if;
  perform public.notify(q.from_user, q.space_id, 'mode_result',
    case when p_accept then coalesce(who || '님이', '파트너가') || ' 좋다고 했어요' -- [확인 필요]
         else '지금처럼 월급은 각자 써요' end, -- [확인 필요] 7-2
    null, '/settings/couple/style', 'arrows-clockwise', uid, 'mode_result:' || q.id);
  return case when p_accept then 'accepted' else 'declined' end;
end;
$$;

-- send_morning_notifications (최신 정의: 20261212090000_ux_b_home_notify.sql)
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
        case when c.secret then '경조사·기념일 알림이 있어요' end, c.secret);
      cnt := cnt + 1;
    end loop;
  end loop;

  -- 월급날: 오늘 시작한 체크리스트의 주인(합쳐서 = 둘 다). v2.2: 그 사람이 확인을 맡은 손 줄(pay_line_mine)이 1개 이상일 때만(F8).
  -- 한 사람 관리형 관리하지 않는 쪽은 관리하는 사람 줄로는 받지 않음(2026-11-13 UX B H2). 없으면 진행 소식(send_progress_news)
  for cl in
    select x.* from public.pay_checklist x
    join public.couple_space s on s.id = x.space_id and s.deleted_at is null
    where x.cycle_start = today and x.state <> 'closed'
      and exists (select 1 from public.pay_check_line l where l.checklist_id = x.id and not l.auto)
  loop
    for u in
      select x.* from public.app_user x
      where x.space_id = cl.space_id and x.status = 'active' and (cl.owner_user_id is null or x.id = cl.owner_user_id)
    loop
      continue when not exists (select 1 from public.pay_check_line l
        where l.checklist_id = cl.id and not l.auto and public.pay_line_mine(l.kind::text, l.user_id, cl.owner_user_id, cl.space_id, u.id));
      perform public.notify(u.id, cl.space_id, 'payday', '오늘은 월급날이에요',
        '계획대로 됐는지 한 번만 확인해 주세요', -- [확인 필요] v2.2 7-2
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
$function$;

-- inquiry_copy_mail (최신 정의: 20261111210000_partner_terms.sql)
create or replace function public.inquiry_copy_mail()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.inquiry;
  first boolean;
  label text;
  link text;
  t text;
begin
  if new.author <> 'user' then
    return new;
  end if;
  select * into q from public.inquiry where id = new.inquiry_id;
  if q.id is null or q.channel <> 'app' then
    return new;
  end if;
  first := not exists (select 1 from public.inquiry_message m where m.inquiry_id = q.id and m.id <> new.id);
  label := case q.category
    when 'account' then '계정·로그인' when 'couple' then '커플 연결' when 'calc' then '월급 계획·월급날 확인 목록'
    when 'sync' then '동기화' when 'billing' then '결제·환불' when 'privacy' then '개인정보' else '기타' end;
  link := 'https://ops.sweetwo.kr/inquiries/' || q.id;
  t := concat_ws(E'\n', '앱에서 온 문의예요. 답변은 어드민에서 써 주세요.', '문의 번호: ' || q.no, '분류: ' || label,
    '', new.body, '', '어드민에서 보기: ' || link);
  insert into public.mail_outbox (user_id, to_email, kind, subject, body_text, body_html, capped, dedupe, headers)
  values (q.user_id, 'help@sweetwo.kr', 'inquiry_copy',
    '[' || q.no || '] ' || case when first then '앱 문의 사본' else '앱 문의 덧붙임' end,
    t,
    concat('<p>앱에서 온 문의예요. 답변은 어드민에서 써 주세요.</p><p>문의 번호: ', public.html_esc(q.no),
      '<br>분류: ', public.html_esc(label), '</p><p>', replace(public.html_esc(new.body), E'\n', '<br>'),
      '</p><p><a href="', link, '">어드민에서 보기</a></p>'),
    false, 'inquiry_copy:' || new.id, jsonb_build_object('X-Sweetwo-Copy', q.no))
  on conflict (dedupe) do nothing;
  update public.inquiry set mail_copied_at = now() where id = q.id;
  return new;
end;
$$;
