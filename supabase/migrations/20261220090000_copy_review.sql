-- 문구 리뷰 반영(2026-11-16, 사용자 승인): 서버 알림 문구만 바꿈. 함수 본문은 최신 정의를 그대로 옮기고 문구 줄만 고침.
-- 이미 보낸 알림 행은 고치지 않음. 기획 14 알림, 20 W-01·W-02, 18 P-10, 19 띠 16번, 31 5-1.
--   goal_mark_achieved      “… 목표 금액을 다 모았어요!” → 느낌표 없앰
--   send_weekly_summary     “이번 주 …님이 바꾼 게 n개 있어요” → “이번 주 …님이 n가지를 바꿨어요”
--   notify_joined           ‘했어요만’ “이제 같이 모은 걸 같이 봐요” → “이제 같이 모으는 저금을 둘이 봐요”
--   note_marketing_result   “마케팅 정보 받기를 거부했어요” → “마케팅 정보를 받지 않기로 했어요”
--   nudge_starter           “…님이 기다리고 있어요. 월급 계획을 마쳐 주세요” → “… 월급 계획을 마저 만들어 볼까요?”
--   send_progress_news      “{저금} n%까지 왔어요” → “{저금}, 목표 금액의 n%까지 모았어요”
--   flush_partner_changes, revert_partner_change  “… 외 n개” → “…, n개 더”

-- public.goal_mark_achieved (최신 정의: 20261208090000_v22_followups.sql)
create or replace function public.goal_mark_achieved(p_goal uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  g public.goal;
  u record;
  joint boolean;
  done_only boolean;
begin
  select * into g from public.goal where id = p_goal;
  update public.goal set status = 'achieved', achieved_at = now(),
      achieved_seen = case when p_actor is null then '{}'::uuid[] else array[p_actor] end
    where id = g.id;
  select c.salary_mode = 'joint' into joint from public.couple_space c where c.id = g.space_id;
  done_only := not coalesce(joint, false) and exists (
    select 1 from public.app_user o where o.id = g.owner_user_id and o.plan_share = 'done_only');
  for u in select a.id from public.app_user a where a.space_id = g.space_id and a.status = 'active' loop
    if g.owner_user_id is not null and g.owner_user_id <> u.id and (g.visibility = 'amount' or done_only) then
      perform public.notify(u.id, g.space_id, 'goal_achieved', '개인 저금 목표 금액을 다 모았어요', null,
        '/salary' || case when coalesce(joint, false) then '' else '?who=' || g.owner_user_id::text end,
        'trophy', p_actor, 'goal_achieved:' || g.id::text || ':' || u.id::text);
      continue;
    end if;
    perform public.notify(u.id, g.space_id, 'goal_achieved', g.name || ' 목표 금액을 다 모았어요', null,
      '/salary/items/' || g.id::text
        || case when g.owner_user_id is null or g.owner_user_id = u.id
                  or (coalesce(joint, false) and g.visibility = 'all') then '/achieved' else '' end,
      'trophy', p_actor, 'goal_achieved:' || g.id::text || ':' || u.id::text);
  end loop;
end;
$$;

-- public.send_weekly_summary (최신 정의: 20261213090000_ux_a_saving.sql)
create or replace function public.send_weekly_summary(p_today date default null)
returns integer language plpgsql security definer set search_path = '' as $$
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
    title := '이번 주 ' || coalesce(nullif((select nickname from public.app_user where id = r.actor_id), '') || '님이', '파트너가') || ' ' || r.n || '가지를 바꿨어요';
    perform public.notify(r.receiver_id, r.space_id, 'weekly_summary', title,
      null, '/notifications', null, r.actor_id, 'weekly:' || r.receiver_id || ':' || today);
    select * into b from public.weekly_mail_body(r.receiver_id, r.actor_id, today);
    perform public.enqueue_mail(r.receiver_id, 'weekly_summary', 'partner_change', title, b.body_text, b.body_html,
      false, 'weekly:' || r.receiver_id || ':' || today);
    cnt := cnt + 1;
  end loop;
  -- G11: 같이 모으는 저금을 상대가 바로잡은 주(계약 3: 꺼내 씀 > 더함 > 맞춤)
  for r in
    select u.id as receiver_id, u.space_id,
      bool_or(m.kind = 'out' and m.reason_code in ('used', 'note_paid')) as took,
      bool_or(m.kind = 'in' and m.reason_code in ('interest', 'custom')) as added
    from public.goal_move m
    join public.app_user u on u.space_id = m.space_id and u.status = 'active' and u.id <> m.created_by
    where m.reason_code in ('fix', 'used', 'interest', 'reconcile', 'note_paid') and not m.hide_from_summary
      and m.deleted_at is null and m.created_by is not null
      and (m.created_at at time zone 'Asia/Seoul')::date between today - 7 and today - 1
      and public.goal_is_together(m.goal_id)
    group by u.id, u.space_id
  loop
    perform public.notify(r.receiver_id, r.space_id, 'weekly_saving',
      case when r.took then '이번 주 같이 모으기에서 꺼내 썼어요' when r.added then '이번 주 같이 모으기에 더했어요'
           else '이번 주 같이 모으기 금액을 맞췄어요' end, -- [확인 필요]
      null, '/salary', 'piggy-bank', null, 'weekly_saving:' || r.receiver_id || ':' || today);
    cnt := cnt + 1;
  end loop;
  return cnt;
end;
$$;

-- public.notify_joined (최신 정의: 20261212090000_ux_b_home_notify.sql)
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
      -- 2026-11-13 UX B M4: 합류한 사람이 실제로 보여 주는 만큼만(같이 계열·모두 = 월급 계획과 저금, 저금만, 했어요만) [확인 필요]
      case
        when new.salary_mode = 'joint' or joiner.plan_share = 'all' then '이제 월급 계획과 저금을 같이 봐요'
        when joiner.plan_share = 'saving_only' then '이제 저금을 같이 봐요'
        else '이제 같이 모으는 저금을 둘이 봐요'
      end, '/', null, joiner.id, 'joined:' || new.id || ':' || joiner.id);
  end if;
  return new;
end;
$function$;

-- public.note_marketing_result (최신 정의: 20261117090000_signup_docs_cleanup.sql)
create or replace function public.note_marketing_result()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  d date := (new.created_at at time zone 'Asia/Seoul')::date;
begin
  if new.kind <> 'marketing' or (new.source = 'signup' and not new.agreed) then
    return new; -- 가입 때 안 받기는 바뀐 게 없어 알리지 않음
  end if;
  insert into public.notification (user_id, kind, title, body, target, icon, dedupe)
  values (
    new.user_id, 'marketing_result',
    case when new.agreed then '마케팅 정보 받기에 동의했어요' else '마케팅 정보를 받지 않기로 했어요' end,
    extract(year from d)::int || '년 ' || extract(month from d)::int || '월 ' || extract(day from d)::int
      || '일 sweeTwo가 처리했어요',
    '/settings/notifications', 'megaphone', 'marketing_result:' || new.id
  )
  on conflict (dedupe) do nothing;
  return new;
end;
$$;

-- public.nudge_starter (최신 정의: 20261206090000_v22_join_style.sql)
create or replace function public.nudge_starter()
returns text language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  me public.app_user;
  s public.couple_space;
begin
  select * into me from public.app_user where id = uid and status = 'active';
  select * into s from public.couple_space where id = me.space_id;
  if s.id is null or s.couple_state <> 'connected' or s.salary_mode <> 'joint' or s.created_by = uid
     or exists (select 1 from public.salary_split x join public.split_line l on l.split_id = x.id
                where x.space_id = s.id and l.kind <> 'send') then
    return 'not_waiting';
  end if;
  if exists (select 1 from public.notification n where n.user_id = s.created_by and n.kind = 'join_nudge'
             and n.created_at > now() - interval '24 hours') then
    return 'too_soon';
  end if;
  perform public.notify(s.created_by, s.id, 'join_nudge',
    coalesce(me.nickname || '님이', '파트너가') || ' 기다리고 있어요. 월급 계획을 마저 만들어 볼까요?', null,
    '/', 'bell', uid, 'join_nudge:' || s.id || ':' || extract(epoch from now())::bigint);
  return 'sent';
end;
$$;

-- public.send_progress_news (최신 정의: 20261212090000_ux_b_home_notify.sql)
CREATE OR REPLACE FUNCTION public.send_progress_news(p_today date DEFAULT NULL::date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  today date := coalesce(p_today, public.kst_today());
  cl public.pay_checklist;
  u public.app_user;
  h record;
  cnt integer := 0;
begin
  for cl in
    select x.* from public.pay_checklist x
    join public.couple_space s on s.id = x.space_id and s.deleted_at is null
    where x.cycle_start = today and x.state <> 'closed'
  loop
    for u in
      select x.* from public.app_user x
      where x.space_id = cl.space_id and x.status = 'active' and (cl.owner_user_id is null or x.id = cl.owner_user_id)
        and public.push_kind_on(x.push_kinds, 'progress_news')
    loop
      -- 그 사람이 확인을 맡은 손 줄이 없을 때만(월급날 알림 대신, 2026-11-13 UX B H2: 관리하지 않는 쪽 포함)
      continue when exists (select 1 from public.pay_check_line l
        where l.checklist_id = cl.id and not l.auto and public.pay_line_mine(l.kind::text, l.user_id, cl.owner_user_id, cl.space_id, u.id));
      select * into h from public.progress_hero(u.id);
      continue when h.goal_id is null;
      perform public.notify(u.id, cl.space_id, 'progress_news', '월급날이에요', -- [확인 필요] v2.2 7-2
        h.name || ', 목표 금액의 ' || h.pct || '%까지 모았어요', '/', 'piggy-bank', null,
        'progress:' || cl.id || ':' || u.id);
      cnt := cnt + 1;
      h := null;
    end loop;
  end loop;
  -- 날짜 없는 사람(확인 목록 없음): 매달 1일
  if extract(day from today) = 1 then
    for u in
      select x.* from public.app_user x
      join public.couple_space s on s.id = x.space_id and s.deleted_at is null
      where x.status = 'active' and x.payday_none and public.push_kind_on(x.push_kinds, 'progress_news')
        and public.cycle_day(x.space_id, case when s.salary_mode = 'joint' then null else x.id end) is null
    loop
      select * into h from public.progress_hero(u.id);
      continue when h.goal_id is null;
      perform public.notify(u.id, u.space_id, 'progress_news', '이번 달 진행 소식이에요', -- [확인 필요]
        h.name || ', 목표 금액의 ' || h.pct || '%까지 모았어요', '/', 'piggy-bank', null,
        'progress:none:' || u.id || ':' || to_char(today, 'YYYY-MM'));
      cnt := cnt + 1;
      h := null;
    end loop;
  end if;
  return cnt;
end;
$function$;

-- public.flush_partner_changes (최신 정의: 20261210090000_v22_revert_change.sql)
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
        r.urgent, r.target, r.created_at, r.sent_at,
        -- 20261210090000: 원래 값 열을 더해 행 모양을 표와 같게(돌리기는 partner_change_group이 행에서 직접 읽음)
        r.before_raw, r.after_raw, r.reverted_at, r.reverted_by
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
        left(public.partner_change_line(urgent[1].topic, urgent[1].field, urgent[1].noun, urgent[1].before_v, urgent[1].after_v) || ', ' || (array_length(urgent, 1) - 1) || '개 더', 200),
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
        left(public.partner_change_line(quiet[1].topic, quiet[1].field, quiet[1].noun, quiet[1].before_v, quiet[1].after_v) || ', ' || (array_length(quiet, 1) - 1) || '개 더', 200),
        quiet[1].target, null, g.actor_id, 'pc:' || g.first_id || ':week');
      cnt := cnt + 1;
    end if;
  end loop;
  return cnt;
end;
$function$
;

-- public.revert_partner_change (최신 정의: 20261210090000_v22_revert_change.sql)
create or replace function public.revert_partner_change(p_notification uuid)
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  g record;
  cnt integer := 0;
  actor uuid;
  sid uuid;
  first_noun text;
  first_target text;
  old_lines jsonb;
  k text[];
  who text := (select nickname from public.app_user where id = auth.uid());
begin
  if not exists (select 1 from public.notification where id = p_notification and user_id = uid) then
    raise exception 'no_notification' using errcode = '42501';
  end if;
  for g in select * from public.partner_change_group(p_notification) x where x.ok order by x.ids[1] loop
    actor := g.actor_id;
    sid := g.space_id;
    first_noun := coalesce(first_noun, g.noun);
    first_target := coalesce(first_target, g.target);
    if g.topic = 'goal' and g.field = 'amount' then
      update public.goal set target_amount = (g.before_raw #>> '{}')::bigint, version = version + 1,
          updated_at = now(), updated_by = uid
        where id = g.ref_id;
      perform public.goal_auto_achieve(g.ref_id);
      perform public.saving_unachieve(g.ref_id);
    elsif g.topic = 'goal' and g.field = 'deadline' then
      update public.goal set deadline = (g.before_raw #>> '{}')::date, version = version + 1,
          updated_at = now(), updated_by = uid
        where id = g.ref_id;
    elsif g.topic = 'goal_meta' and g.field = 'name' then
      update public.goal set name = g.before_raw #>> '{}', version = version + 1, updated_at = now(), updated_by = uid
        where id = g.ref_id;
    elsif g.topic = 'split' then
      k := string_to_array(g.field, ':');
      select jsonb_agg(jsonb_build_object('kind', kind, 'goal_id', goal_id, 'user_id', user_id, 'name', name, 'amount', amount))
        into old_lines from public.split_line where split_id = g.ref_id and kind <> 'send';
      update public.split_line l set amount = (g.before_raw #>> '{}')::bigint
        where l.split_id = g.ref_id and l.kind::text = k[1]
          and l.goal_id is not distinct from nullif(k[2], '')::uuid
          and l.user_id is not distinct from nullif(k[3], '')::uuid
          and l.name is not distinct from nullif(array_to_string(k[4:], ':'), '');
      update public.salary_split set version = version + 1, updated_at = now(), updated_by = uid where id = g.ref_id;
      perform public.log_split_changes(g.ref_id, old_lines);
      perform public.sync_checklist(g.ref_id);
      if k[1] = 'allowance' then
        perform public.notify_my_allowance(sid, nullif(k[3], '')::uuid);
      end if;
    elsif g.topic = 'care' and g.field = 'memo' then
      update public.care_day set memo = g.before_raw #>> '{}', version = version + 1, updated_at = now(), updated_by = uid
        where id = g.ref_id;
    else
      continue;
    end if;
    update public.partner_change set reverted_at = now(), reverted_by = uid where id = any (g.ids);
    cnt := cnt + 1;
  end loop;
  if cnt = 0 then
    raise exception 'not_revertible' using errcode = '22023';
  end if;
  -- 돌리면서 내가 남긴 변경 기록은 아래 한 건으로 대신 알림(같은 알림 두 번 막음, 활동·주간 요약에는 그대로 셈)
  update public.partner_change set sent_at = now()
    where actor_id = uid and sent_at is null and created_at = now();
  perform public.notify(actor, sid, 'partner_change',
    coalesce(nullif(who, ''), '파트너') || '님이 이전 값으로 돌렸어요', -- [확인 필요] 14 v2.2 R-08
    first_noun || case when cnt > 1 then ', ' || (cnt - 1) || '개 더' else '' end,
    coalesce(first_target, '/'), null, uid, 'pcr:' || p_notification);
  return cnt;
end;
$$;
