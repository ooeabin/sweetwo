-- QA 10구간(알림 N-01~N-03, 서버 알림) 서버 쪽(2026-11-12). 스키마는 추가만(함수 새 버전, 표 그대로).
-- 함수 본문은 각 최신 정의(pg_get_functiondef)와 같고 아래만 바꿈. 권한은 그대로(create or replace는 권한을 남김).
--
-- 1. S10-01 호칭이 없으면 ‘파트너가’(“님이 …” 대신, 14 규칙): partner_change_title, flush_partner_changes(여럿 묶음),
--    send_weekly_summary(“이번 주 파트너가 바꾼 게 n개 있어요”), weekly_mail_body, answer_access_request
--    (“운영자가 파트너 문의를 확인하고 있어요” / “파트너가 동의한 범위만, …까지 봐요” [확인 필요])
-- 2. S10-02 D1: 주인이 ‘금액만 보여 주기’로 둔 저금이 달성되면 파트너에게는 이름 없이 “개인 저금 목표 금액을 다 모았어요!”
--    [확인 필요] + W-02(각자면 그 사람 탭 /salary?who=주인, 합쳐서면 /salary). 주인 알림은 그대로
-- 3. S10-03 서버 분석 이벤트 notification_sent(32 4-7): 알림 행이 생길 때 channel inapp(notify), 푸시를 꺼낼 때 os(claim_push),
--    메일로 대신 보낼 때 email(mail_missed_notifications). type = kind, cap_scope = 상한 밖(noti_always_mail)이면 out_of_cap.
--    cap_used는 메일 상한을 없애(2026-11-04) 넣지 않음
-- 4. S10-04 방해 금지가 12시간을 넘으면(예: 19~9시) 끝나도 푸시·대신 메일이 안 가던 것: 보낼 수 있는 기간을
--    12시간과 (방해 금지 길이 + 1시간) 중 긴 쪽으로(noti_send_window)
-- 5. S10-06 알림 메일 반송 → S-11b 알림 이메일(/settings/me/email, 14 표)
-- 6. S10-08 D3: 관리 방식 변경 본문 “다음 월급날부터 합쳐서 관리해요” / “다음 월급날부터 각자 관리해요” [확인 필요],
--    합류 중 관리 방식(set_join_salary_mode) 링크 /salary?view=plan(옛 /salary/split 대신)

-- 1. 호칭이 없으면 ‘파트너가’ ──────────────────────────────────────────────────

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
    when p_topic = 'care' then '경조사를 바꿨어요' -- [확인 필요] 2026-11-09 ‘챙길 날’ 대신
    when p_topic = 'cycle_day' then '체크리스트 만드는 날을 바꿨어요'
    when p_topic = 'couple' then '결혼 정보를 바꿨어요' -- [확인 필요]
    else '바꿨어요' end;
$function$
;

CREATE OR REPLACE FUNCTION public.flush_partner_changes(p_now timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  at_now timestamptz := coalesce(p_now, now());
  g record;
  urgent public.partner_change[];
  quiet public.partner_change[];
  who text;
  cnt integer := 0;
begin
  for g in
    select actor_id, receiver_id, min(space_id::text)::uuid as space_id, min(id) as first_id
    from public.partner_change
    where sent_at is null
    group by actor_id, receiver_id
    having min(created_at) <= at_now - interval '10 minutes'
  loop
    with rows as (
      select c.* from public.partner_change c
      where c.actor_id = g.actor_id and c.receiver_id = g.receiver_id and c.sent_at is null
    ),
    merged as (
      select distinct on (r.topic, r.ref_id, r.field)
        r.id, r.space_id, r.actor_id, r.receiver_id, r.topic, r.ref_id, r.field,
        (select x.noun from rows x where x.topic = r.topic and x.ref_id is not distinct from r.ref_id and x.field = r.field
          order by x.id desc limit 1) as noun,
        (select x.before_v from rows x where x.topic = r.topic and x.ref_id is not distinct from r.ref_id and x.field = r.field
          order by x.id limit 1) as before_v,
        (select x.after_v from rows x where x.topic = r.topic and x.ref_id is not distinct from r.ref_id and x.field = r.field
          order by x.id desc limit 1) as after_v,
        r.urgent, r.target, r.created_at, r.sent_at
      from rows r
      order by r.topic, r.ref_id, r.field, r.id
    )
    select
      array_agg(m::public.partner_change order by m.id) filter (where m.urgent and m.before_v is distinct from m.after_v),
      array_agg(m::public.partner_change order by m.id) filter (where not m.urgent and m.before_v is distinct from m.after_v)
    into urgent, quiet
    from merged m;

    update public.partner_change set sent_at = at_now
      where actor_id = g.actor_id and receiver_id = g.receiver_id and sent_at is null;
    -- 받는 사람이 아직 같은 공간일 때만
    continue when not exists (select 1 from public.app_user u
      where u.id = g.receiver_id and u.space_id = g.space_id and u.status = 'active');
    select coalesce(nickname, '') into who from public.app_user where id = g.actor_id;

    if coalesce(array_length(urgent, 1), 0) = 1 then
      perform public.notify(g.receiver_id, g.space_id, 'partner_change',
        public.partner_change_title(urgent[1].topic, urgent[1].noun, who),
        public.partner_change_line(urgent[1].topic, urgent[1].field, urgent[1].noun, urgent[1].before_v, urgent[1].after_v),
        urgent[1].target, null, g.actor_id, 'pc:' || g.first_id || ':now');
      cnt := cnt + 1;
    elsif coalesce(array_length(urgent, 1), 0) > 1 then
      perform public.notify(g.receiver_id, g.space_id, 'partner_change',
        coalesce(nullif(who, '') || '님이', '파트너가') || ' ' || array_length(urgent, 1) || '가지를 바꿨어요', -- [확인 필요]
        left(public.partner_change_line(urgent[1].topic, urgent[1].field, urgent[1].noun, urgent[1].before_v, urgent[1].after_v) || ' 외 ' || (array_length(urgent, 1) - 1) || '개', 200),
        urgent[1].target, null, g.actor_id, 'pc:' || g.first_id || ':now');
      cnt := cnt + 1;
    end if;
    if coalesce(array_length(quiet, 1), 0) = 1 then
      perform public.notify(g.receiver_id, g.space_id, 'partner_activity',
        public.partner_change_title(quiet[1].topic, quiet[1].noun, who),
        public.partner_change_line(quiet[1].topic, quiet[1].field, quiet[1].noun, quiet[1].before_v, quiet[1].after_v),
        quiet[1].target, null, g.actor_id, 'pc:' || g.first_id || ':week');
      cnt := cnt + 1;
    elsif coalesce(array_length(quiet, 1), 0) > 1 then
      perform public.notify(g.receiver_id, g.space_id, 'partner_activity',
        coalesce(nullif(who, '') || '님이', '파트너가') || ' ' || array_length(quiet, 1) || '가지를 바꿨어요',
        left(public.partner_change_line(quiet[1].topic, quiet[1].field, quiet[1].noun, quiet[1].before_v, quiet[1].after_v) || ' 외 ' || (array_length(quiet, 1) - 1) || '개', 200),
        quiet[1].target, null, g.actor_id, 'pc:' || g.first_id || ':week');
      cnt := cnt + 1;
    end if;
  end loop;
  return cnt;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.send_weekly_summary(p_today date DEFAULT NULL::date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  today date := coalesce(p_today, public.kst_today());
  r record;
  title text;
  b record;
  cnt integer := 0;
begin
  for r in
    with w as (
      select c.* from public.partner_change c
      where (c.created_at at time zone 'Asia/Seoul')::date between today - 7 and today - 1
    ),
    m as (
      select w.receiver_id, w.actor_id, w.space_id, w.topic, w.ref_id, w.field,
        (array_agg(w.before_v order by w.id))[1] as b, (array_agg(w.after_v order by w.id desc))[1] as a
      from w group by w.receiver_id, w.actor_id, w.space_id, w.topic, w.ref_id, w.field
    )
    select m.receiver_id, m.actor_id, m.space_id, count(*)::int as n
    from m
    join public.app_user u on u.id = m.receiver_id and u.space_id = m.space_id and u.status = 'active'
    where m.b is distinct from m.a
    group by m.receiver_id, m.actor_id, m.space_id
  loop
    title := '이번 주 ' || coalesce(nullif((select nickname from public.app_user where id = r.actor_id), '') || '님이', '파트너가') || ' 바꾼 게 ' || r.n || '개 있어요';
    perform public.notify(r.receiver_id, r.space_id, 'weekly_summary', title,
      null, '/notifications', null, r.actor_id, 'weekly:' || r.receiver_id || ':' || today);
    select * into b from public.weekly_mail_body(r.receiver_id, r.actor_id, today);
    perform public.enqueue_mail(r.receiver_id, 'weekly_summary', 'partner_change', title, b.body_text, b.body_html,
      false, 'weekly:' || r.receiver_id || ':' || today);
    cnt := cnt + 1;
  end loop;
  return cnt;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.weekly_mail_body(p_receiver uuid, p_actor uuid, p_today date)
 RETURNS TABLE(body_text text, body_html text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me public.app_user;
  who text := coalesce(nullif((select nickname from public.app_user where id = p_actor), '') || '님이', '파트너가');
  lines text[];
  checks text[];
  todo text;
  open_url text := 'https://sweetwo.kr/n';
  settings_url text := 'https://sweetwo.kr/n/settings';
begin
  select * into me from public.app_user where id = p_receiver;
  with w as (
    select c.* from public.partner_change c
    where c.receiver_id = p_receiver and c.actor_id = p_actor
      and (c.created_at at time zone 'Asia/Seoul')::date between p_today - 7 and p_today - 1
  ),
  m as (
    select w.topic, w.ref_id, w.field, min(w.id) as first_id,
      (array_agg(w.noun order by w.id desc))[1] as noun,
      (array_agg(w.before_v order by w.id))[1] as b, (array_agg(w.after_v order by w.id desc))[1] as a
    from w group by w.topic, w.ref_id, w.field
  )
  select array_agg(public.partner_change_line(m.topic, m.field, m.noun, m.b, m.a) order by m.first_id)
    into lines
  from (select * from m where m.b is distinct from m.a order by m.first_id limit 20) m;

  -- 이번 달 월급: 지금 사이클 체크리스트마다 “10월 월급(찬우) 5개 중 2개 완료” [확인 필요]
  select array_agg(
      c.label || case when c.owner_user_id is not null
        then '(' || coalesce((select nickname from public.app_user where id = c.owner_user_id), '') || ')' else '' end
      || ' ' || (select count(*) from public.pay_check_line l where l.checklist_id = c.id) || '개 중 '
      || (select count(*) from public.pay_check_line l where l.checklist_id = c.id and l.state = 'checked') || '개 완료'
      order by c.owner_user_id nulls first)
    into checks
  from public.pay_checklist c
  where c.space_id = me.space_id and c.state <> 'closed' and c.cycle_start <= p_today and c.cycle_end >= p_today;

  -- 남은 할 일: 내 월말 확인(다음 월급날 3일 전부터, 체크 안 한 줄이 있을 때)
  select c.label || '에서 체크 안 한 게 ' || count(l.id) || '개 있어요'
    into todo
  from public.pay_checklist c
  join public.pay_check_line l on l.checklist_id = c.id and l.state = 'wait'
  where c.space_id = me.space_id and c.state = 'open' and c.cycle_end >= p_today and c.cycle_end - 2 <= p_today
    and (c.owner_user_id is null or c.owner_user_id = p_receiver)
  group by c.id, c.label
  limit 1;

  body_text := concat_ws(E'\n',
    who || ' 바꾼 것',
    array_to_string(array(select '- ' || x from unnest(lines) x), E'\n'),
    case when checks is not null then E'\n이번 달 월급\n' || array_to_string(array(select '- ' || x from unnest(checks) x), E'\n') end,
    case when todo is not null then E'\n남은 할 일\n- ' || todo end,
    E'\n앱에서 보기: ' || open_url,
    '알림 설정: ' || settings_url);
  body_html := concat(
    '<p><b>', public.html_esc(who), ' 바꾼 것</b></p><ul>',
    (select string_agg('<li>' || public.html_esc(x) || '</li>', '') from unnest(lines) x),
    '</ul>',
    case when checks is not null then '<p><b>이번 달 월급</b></p><ul>'
      || (select string_agg('<li>' || public.html_esc(x) || '</li>', '') from unnest(checks) x) || '</ul>' end,
    case when todo is not null then '<p><b>남은 할 일</b></p><ul><li>' || public.html_esc(todo) || '</li></ul>' end,
    '<p><a href="', open_url, '">앱에서 보기</a></p>',
    '<p><a href="', settings_url, '">알림 설정</a></p>');
  return next;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.answer_access_request(p_id uuid, p_accept boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r public.access_request;
  me public.app_user;
  other uuid;
  until timestamptz := now() + interval '24 hours';
begin
  select * into r from public.access_request where id = p_id and user_id = auth.uid() for update;
  if r.id is null or r.status <> 'requested' then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if not p_accept then
    update public.access_request set status = 'declined', answered_at = now() where id = r.id;
    return;
  end if;
  update public.access_request
    set status = 'approved', answered_at = now(), expires_at = until, partner_notified_at = now()
    where id = r.id;
  select * into me from public.app_user where id = r.user_id;
  select id into other from public.app_user
    where space_id = me.space_id and status = 'active' and id <> me.id limit 1;
  if other is not null then
    perform public.notify(other, me.space_id, 'access_partner',
      '운영자가 ' || coalesce(nullif(me.nickname, '') || '님', '파트너') || ' 문의를 확인하고 있어요', -- 호칭이 없으면 [확인 필요]
      coalesce(nullif(me.nickname, '') || '님이', '파트너가') || ' 동의한 범위만, ' || public.md_label((until at time zone 'Asia/Seoul')::date) || '까지 봐요',
      '/settings/help', 'shield-check', null, 'access:' || r.id || ':partner');
  end if;
end;
$function$
;

-- 2. 목표 금액 달성: ‘금액만 보여 주기’ 저금은 파트너에게 이름 없이(D1) ───────────────────────

CREATE OR REPLACE FUNCTION public.achieve_goal(p_goal uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := auth.uid();
  g public.goal;
  u record;
  joint boolean;
begin
  select * into g from public.goal where id = p_goal and deleted_at is null for update;
  if g.id is null or not public.is_space_member(g.space_id) then
    raise exception 'not_found' using errcode = '42501';
  end if;
  if g.target_amount is null or g.closed_at is not null then
    return false;
  end if;
  if g.status in ('active', 'delayed') then
    if public.goal_saved(g.id) < g.target_amount then
      return false;
    end if;
    update public.goal set status = 'achieved', achieved_at = now(), achieved_seen = array[uid]
      where id = g.id;
    select c.salary_mode = 'joint' into joint from public.couple_space c where c.id = g.space_id;
    -- 링크(14 표): 고칠 수 있는 사람 = W-12 축하(우리 둘 항목, 주인, 합쳐서 모드의 ‘모두 보여 주기’ 항목은 두 사람 모두,
    -- 2026-11-12 D1), 파트너(각자) = W-10
    for u in select a.id from public.app_user a where a.space_id = g.space_id and a.status = 'active' loop
      -- 주인이 ‘금액만 보여 주기’로 둔 저금은 파트너에게 이름 없이 “개인 저금 …” + W-02(2026-11-12 QA 10구간 D1)
      if g.owner_user_id is not null and g.owner_user_id <> u.id and g.visibility = 'amount' then
        perform public.notify(u.id, g.space_id, 'goal_achieved', '개인 저금 목표 금액을 다 모았어요!', null, -- [확인 필요]
          '/salary' || case when coalesce(joint, false) then '' else '?who=' || g.owner_user_id::text end,
          'trophy', uid, 'goal_achieved:' || g.id::text || ':' || u.id::text);
        continue;
      end if;
      perform public.notify(u.id, g.space_id, 'goal_achieved', g.name || ' 목표 금액을 다 모았어요!', null, -- [확인 필요]
        '/salary/items/' || g.id::text
          || case when g.owner_user_id is null or g.owner_user_id = u.id
                    or (coalesce(joint, false) and g.visibility = 'all') then '/achieved' else '' end,
        'trophy', uid, 'goal_achieved:' || g.id::text || ':' || u.id::text);
    end loop;
    return true;
  end if;
  if g.status = 'achieved' and not (uid = any (g.achieved_seen)) then
    update public.goal set achieved_seen = array_append(achieved_seen, uid) where id = g.id;
    return true;
  end if;
  return false;
end;
$function$
;

-- 3·4. 분석 notification_sent, 방해 금지 뒤 보내기 ───────────────────────────────────────

/** 알림을 푸시·대신 메일로 보낼 수 있는 기간: 12시간, 방해 금지가 그보다 길면 (방해 금지 길이 + 1시간). 끝나는 시각에 꼭 나가게 */
create or replace function public.noti_send_window(p_quiet_start smallint, p_quiet_end smallint)
returns interval
language sql
immutable
set search_path = ''
as $$
  select greatest(interval '12 hours',
    make_interval(hours => ((coalesce(p_quiet_end, 8) - coalesce(p_quiet_start, 22) + 24) % 24) + 1));
$$;
revoke all on function public.noti_send_window(smallint, smallint) from public, anon, authenticated;

/** notification_sent 서버 이벤트(32 4-7): type, channel(os / email / inapp), cap_scope */
create or replace function public.track_noti_sent(p_user uuid, p_space uuid, p_kind text, p_channel text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  select public.server_track('notification_sent', p_user, p_space, jsonb_build_object(
    'type', p_kind, 'channel', p_channel,
    'cap_scope', case when public.noti_always_mail(p_kind) then 'out_of_cap' else 'in_cap' end));
$$;
revoke all on function public.track_noti_sent(uuid, uuid, text, text) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify(p_user uuid, p_space uuid, p_kind text, p_title text, p_body text, p_target text, p_icon text, p_actor uuid, p_dedupe text, p_push_title text DEFAULT NULL::text, p_push_hidden boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.notification (user_id, space_id, kind, title, body, target, icon, actor_id, dedupe, push_title, push_hidden)
  values (p_user, p_space, p_kind, p_title, p_body, p_target, p_icon, p_actor, p_dedupe, p_push_title, p_push_hidden)
  on conflict (dedupe) do nothing;
  -- 새로 쌓였을 때만(같은 dedupe면 안 남김). 알림 센터 = inapp
  if found then
    perform public.track_noti_sent(p_user, p_space, p_kind, 'inapp');
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.claim_push(p_limit integer DEFAULT 100, p_now timestamp with time zone DEFAULT now())
 RETURNS TABLE(notification_id uuid, title text, body text, target text, platform text, token text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  hour integer := extract(hour from p_now at time zone 'Asia/Seoul')::int;
  ids uuid[];
begin
  select array_agg(x.id) into ids from (
    select n.id
    from public.notification n
    join public.app_user u on u.id = n.user_id and u.status = 'active'
    where n.pushed_at is null and n.read_at is null
      and n.created_at > p_now - public.noti_send_window(u.quiet_start, u.quiet_end)
      and public.push_wanted(u.noti_prefs, n.topic)
      and exists (select 1 from public.push_device d where d.user_id = n.user_id)
      -- 방해 금지(보안·계정 알림은 바로): 끝나면 보냄
      and (public.noti_always_mail(n.kind) or not (
        u.quiet_start <> u.quiet_end and case when u.quiet_start < u.quiet_end
          then hour >= u.quiet_start and hour < u.quiet_end
          else hour >= u.quiet_start or hour < u.quiet_end end))
    order by n.created_at
    limit least(greatest(coalesce(p_limit, 100), 1), 500)
    for update of n skip locked
  ) x;
  if ids is null then
    return;
  end if;
  update public.notification set pushed_at = p_now where id = any(ids);
  -- 분석: 알림마다 한 번(기기 수와 상관없이)
  perform public.track_noti_sent(n.user_id, n.space_id, n.kind, 'os')
    from public.notification n where n.id = any(ids);
  return query
    select n.id, coalesce(n.push_title, n.title), case when n.push_hidden then null else n.body end, n.target,
      d.platform, d.token
    from public.notification n
    join public.push_device d on d.user_id = n.user_id
    where n.id = any(ids);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.mail_missed_notifications(p_now timestamp with time zone DEFAULT now())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  n record;
  b record;
  hour integer := extract(hour from p_now at time zone 'Asia/Seoul')::int;
  cnt integer := 0;
begin
  for n in
    select x.*, u.app_seen_at, u.quiet_start, u.quiet_end
    from public.notification x
    join public.app_user u on u.id = x.user_id and u.status = 'active'
    where x.mailed_at is null and x.read_at is null
      and x.created_at > p_now - public.noti_send_window(u.quiet_start, u.quiet_end)
      and coalesce(x.topic, '') <> 'silent'
      and (public.noti_always_mail(x.kind)
           or (x.kind = 'review_due'
               and x.created_at <= p_now - interval '10 minutes'
               and (u.app_seen_at is null or u.app_seen_at < x.created_at - interval '10 minutes')
               and not exists (select 1 from public.push_device d where d.user_id = x.user_id)))
    order by x.created_at
    limit 500
  loop
    -- 방해 금지 시간이면 끝날 때까지 미룸(상한 밖은 바로)
    if not public.noti_always_mail(n.kind) and coalesce(n.quiet_start, 22) <> coalesce(n.quiet_end, 8) and (
      case when coalesce(n.quiet_start, 22) < coalesce(n.quiet_end, 8)
        then hour >= coalesce(n.quiet_start, 22) and hour < coalesce(n.quiet_end, 8)
        else hour >= coalesce(n.quiet_start, 22) or hour < coalesce(n.quiet_end, 8) end) then
      continue;
    end if;
    select * into b from public.noti_mail_body(coalesce(n.push_title, n.title), case when n.push_hidden then null else n.body end);
    if public.enqueue_mail(n.user_id, n.kind, n.topic, coalesce(n.push_title, n.title), b.body_text, b.body_html,
        false, 'noti:' || n.id) then
      perform public.track_noti_sent(n.user_id, n.space_id, n.kind, 'email');
    end if;
    update public.notification set mailed_at = p_now where id = n.id;
    cnt := cnt + 1;
  end loop;
  return cnt;
end;
$function$
;

-- 5. 알림 메일 반송 → S-11b ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.note_mail_event(p_email text, p_kind text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  e text := lower(btrim(coalesce(p_email, '')));
  n integer := 0;
  u record;
begin
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or p_kind not in ('bounce', 'complaint') then
    return 0;
  end if;
  insert into public.mail_suppress (email, bounces, complaint, last_at)
    values (e, case when p_kind = 'bounce' then 1 else 0 end, p_kind = 'complaint', now())
    on conflict (email) do update set
      bounces = public.mail_suppress.bounces + case when p_kind = 'bounce' then 1 else 0 end,
      complaint = public.mail_suppress.complaint or p_kind = 'complaint',
      last_at = now();
  if p_kind = 'bounce' then
    for u in select a.id, a.space_id from public.app_user a where a.notify_email = e and a.status = 'active' loop
      perform public.notify(u.id, u.space_id, 'mail_bounced', '알림 메일이 전달되지 않았어요',
        '알림 이메일 주소를 확인해 주세요', '/settings/me/email', 'envelope-simple', null,
        'bounce:' || e || ':' || to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM-DD'));
      -- 반송된 주소로 이 알림을 메일로 다시 보내지 않음(mail_missed_notifications가 건너뜀)
      update public.notification set mailed_at = now()
        where user_id = u.id and kind = 'mail_bounced' and mailed_at is null;
      n := n + 1;
    end loop;
  end if;
  return n;
end;
$function$
;

-- 6. 관리 방식 변경 본문(D3), 합류 중 링크 ─────────────────────────────────────────────

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
      case when p_mode = 'joint' then '다음 월급날부터 합쳐서 관리해요' else '다음 월급날부터 각자 관리해요' end, -- [확인 필요] D3
      '/salary?view=plan', null, uid, 'mode:' || sid || ':' || now()::text);
  end if;
end;
$function$
;

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
      case when p_mode = 'joint' then '다음 월급날부터 합쳐서 관리해요' else '다음 월급날부터 각자 관리해요' end, -- [확인 필요] D3
      '/salary?view=plan', null, uid, 'join_mode:' || sid || ':' || uid || ':' || p_mode);
  end if;
end;
$function$
;
