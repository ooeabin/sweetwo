-- v2.2 지표·마무리(PR 14, 2026-11-13, docs/spec/32 0장). 스키마는 추가만(새 함수·트리거, save_split 새 버전).
--
-- ■ 계약
--  1. 서버 분석 이벤트(32 0-4 ‘(서버)’, server_track = 분석 수집을 끈 사람 것은 안 남김). 함수를 다시 쓰지 않고 표 트리거로:
--     - auto_line_confirmed {kind}: 자동 줄이 나가는 날 앱이 자동 확인(pay_check_line wait → checked, checked_by 없음),
--       날짜 없는 사람의 자동 저금(goal_move reason_code auto)은 {kind: saving}
--     - progress_news_sent {}: 진행 소식 알림(notification kind progress_news)이 생김
--     - salary_change_applied {months_ahead, has_until}: 예약한 월급 변경이 적용됨(applied_at이 처음 채워짐).
--       months_ahead = 예약한 달(KST)부터 적용 달까지 개월, has_until = 끝 달이 있는지
--     - unlink_resolved {path: timeout, days_pending, exported_data: null}: 14일 기한으로 해제 확정(how = deadline).
--       상대 확인·취소는 앱이 보냄
--  2. 어드민 지표 admin_metrics(p_months) (AD-01 8번, aal2 관리자 모든 역할, 집계 숫자만, 사람·커플 ID 없음):
--     북극성(32 0-1 ‘이번 달 같이 모은 커플 수’, 달마다), 선행(0-2 중 DB로 셀 수 있는 것), 가드레일(0-3 중 넷).
--     커플 하나·달 하나 판정은 내부 metric_couple_month(space, month) 하나(아래 정의, 32 0-1과 같은 말).
--     ‘연결 커플’은 지금 연결(connected) 또는 해제 대기(unlink_pending) 공간(지난 달의 연결 여부는 기록이 없어 지금 값).
--  3. save_split 새 버전(각자 계열 보내기 줄 순서, 2026-11-13 남은 일): 줄을 다시 쓸 때 지워진 ‘보내기’ 줄을 트리거가
--     sort 0으로 다시 넣어 맨 위로 올라가던 것. 이제 보내기 줄은 늘 맨 뒤(다른 줄 다음)이고, 각자·합쳐서 모두
--     옛 줄 설정(체크리스트에 넣기, 자동, 나가는 날)을 이어받음.

-- ─────────────────────────── 1. 서버 분석 이벤트 ───────────────────────────

create function public.metric_auto_line_event() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  owner_ uuid;
begin
  if new.auto and new.state = 'checked' and old.state = 'wait' and new.checked_by is null then
    select owner_user_id into owner_ from public.pay_checklist where id = new.checklist_id;
    perform public.server_track('auto_line_confirmed', owner_, new.space_id,
      jsonb_build_object('kind', new.kind::text));
  end if;
  return null;
end;
$$;
revoke all on function public.metric_auto_line_event() from public, anon, authenticated;
create trigger pay_check_line_auto_event after update of state on public.pay_check_line
  for each row when (new.auto and old.state = 'wait' and new.state = 'checked')
  execute function public.metric_auto_line_event();

create function public.metric_auto_move_event() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  owner_ uuid;
begin
  select sp.owner_user_id into owner_
    from public.split_line l join public.salary_split sp on sp.id = l.split_id where l.id = new.auto_line_id;
  perform public.server_track('auto_line_confirmed', owner_, new.space_id, jsonb_build_object('kind', 'saving'));
  return null;
end;
$$;
revoke all on function public.metric_auto_move_event() from public, anon, authenticated;
create trigger goal_move_auto_event after insert on public.goal_move
  for each row when (new.reason_code = 'auto' and new.auto_line_id is not null)
  execute function public.metric_auto_move_event();

create function public.metric_progress_news_event() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.server_track('progress_news_sent', new.user_id, new.space_id, '{}'::jsonb);
  return null;
end;
$$;
revoke all on function public.metric_progress_news_event() from public, anon, authenticated;
create trigger notification_progress_news_event after insert on public.notification
  for each row when (new.kind = 'progress_news')
  execute function public.metric_progress_news_event();

create function public.metric_salary_change_event() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  made date := date_trunc('month', (new.created_at at time zone 'Asia/Seoul'))::date;
begin
  perform public.server_track('salary_change_applied', new.user_id, new.space_id, jsonb_build_object(
    'months_ahead', greatest(0, (extract(year from new.effective_from) - extract(year from made)) * 12
                                + extract(month from new.effective_from) - extract(month from made))::int,
    'has_until', new.until_month is not null));
  return null;
end;
$$;
revoke all on function public.metric_salary_change_event() from public, anon, authenticated;
create trigger salary_change_applied_event after update of applied_at on public.salary_change
  for each row when (old.applied_at is null and new.applied_at is not null)
  execute function public.metric_salary_change_event();

create function public.metric_unlink_timeout_event() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.server_track('unlink_resolved', new.requested_by, new.space_id, jsonb_build_object(
    'path', 'timeout',
    'days_pending', greatest(0, (new.confirmed_at at time zone 'Asia/Seoul')::date
                               - (new.requested_at at time zone 'Asia/Seoul')::date),
    'exported_data', null));
  return null;
end;
$$;
revoke all on function public.metric_unlink_timeout_event() from public, anon, authenticated;
create trigger couple_unlink_timeout_event after update of status on public.couple_unlink
  for each row when (old.status = 'pending' and new.status = 'confirmed' and new.how = 'deadline')
  execute function public.metric_unlink_timeout_event();

-- ─────────────────────────── 2. 어드민 지표 ───────────────────────────

-- 커플(공간) 하나·달 하나(32 0-1). 내부 전용. month = 그 달 1일.
--  대표 기간: 같이 계열(joint)은 공동 확인 목록, 각자 계열은 먼저 시작한 사람(공간을 만든 사람) 확인 목록,
--            그 달에 시작한 목록이 없으면 다른 사람 것, 모두 없으면 달력 월
--  confirmed(확인 끝): 그 달에 시작한 확인 목록(같이 계열은 공동 목록 하나, 각자는 사람마다)의 손 줄이 모두 체크·건너뜀.
--            확인 목록이 없는 사람 중 날짜 없는 사람(payday_none)은 기간이 그 달에 걸친 돈 들어왔어요 1건 이상
--            (기간 30일 = 그 달 첫날 29일 전부터 그 달 끝까지 받은 날), 나머지(월급 없음 등)는 뺌
--  saved(모음): 대표 기간에 저금 줄 확인(자동 포함, 금액 > 0) 또는 자동 저금(reason_code auto) 또는 돈 들어왔어요로 넣음.
--            이미 모은 금액, 바로잡기·잔액 맞추기, 쓸 곳 메모 ‘냈어요’는 셈에서 뺌
--  manual(사람이 직접 확인): 본 확인 목록에 손 줄이 있고 사람이 끝냄(checked_by 있음 또는 건너뜀)
create function public.metric_couple_month(p_space uuid, p_month date)
returns table (confirmed boolean, saved boolean, manual boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  sp public.couple_space;
  m0 date := date_trunc('month', p_month)::date;
  m1 date := (date_trunc('month', p_month) + interval '1 month')::date;
  rep public.pay_checklist;
  ws timestamptz;
  we timestamptz;
  lists uuid[];
  owners uuid[];
  ok_lists boolean;
  ok_none boolean;
begin
  select * into sp from public.couple_space where id = p_space;
  select array_agg(c.id), array_agg(c.owner_user_id) into lists, owners
    from public.pay_checklist c
    where c.space_id = p_space and c.cycle_start >= m0 and c.cycle_start < m1
      and (case when sp.salary_mode = 'joint' then c.owner_user_id is null else c.owner_user_id is not null end);
  select c.* into rep from public.pay_checklist c where c.id = any (coalesce(lists, '{}'))
    order by (c.owner_user_id is distinct from sp.created_by), c.cycle_start limit 1;
  if rep.id is not null then
    ws := rep.cycle_start::timestamp at time zone 'Asia/Seoul';
    we := (rep.cycle_end + 1)::timestamp at time zone 'Asia/Seoul';
  else
    ws := m0::timestamp at time zone 'Asia/Seoul';
    we := m1::timestamp at time zone 'Asia/Seoul';
  end if;

  ok_lists := not exists (
    select 1 from public.pay_check_line l
    where l.checklist_id = any (coalesce(lists, '{}')) and not l.auto and l.state = 'wait');
  -- 확인 목록이 없는 날짜 없는 사람(같이 계열에 공동 목록이 있으면 그것만 봄)
  ok_none := not exists (
    select 1 from public.app_user u
    where u.space_id = p_space and u.status = 'active' and u.payday_none
      and not (sp.salary_mode = 'joint' and lists is not null)
      and not (u.id = any (coalesce(owners, '{}')))
      and not exists (
        select 1 from public.money_in mi
        where mi.owner_user_id = u.id and mi.deleted_at is null
          and mi.received_on >= m0 - 29 and mi.received_on < m1));

  return query select
    ok_lists and ok_none,
    exists (
      select 1 from public.pay_check_line l
      where l.space_id = p_space and l.kind = 'saving' and l.state = 'checked'
        and coalesce(l.actual, l.planned) > 0 and l.checked_at >= ws and l.checked_at < we)
    or exists (
      select 1 from public.goal_move g
      where g.space_id = p_space and g.deleted_at is null and g.kind = 'in' and g.amount > 0
        and (g.reason_code = 'auto' or g.money_in_id is not null)
        and g.created_at >= ws and g.created_at < we),
    exists (
      select 1 from public.pay_check_line l
      where l.checklist_id = any (coalesce(lists, '{}')) and not l.auto
        and (l.checked_by is not null or l.state = 'skipped'));
end;
$$;
revoke all on function public.metric_couple_month(uuid, date) from public, anon, authenticated;

-- 비율 칸 하나: 분자, 분모, 퍼센트(분모 0이면 null). limit·alert는 가드레일만
create function public.metric_ratio(p_num bigint, p_den bigint)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('num', coalesce(p_num, 0), 'den', coalesce(p_den, 0),
    'pct', case when coalesce(p_den, 0) > 0 then round(100.0 * coalesce(p_num, 0) / p_den)::int end);
$$;
revoke all on function public.metric_ratio(bigint, bigint) from public, anon, authenticated;

create function public.admin_metrics(p_months integer default 6)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['super', 'ops', 'cs', 'analyst']::public.admin_role[]);
  d0 date := public.kst_today();
  n integer := least(greatest(coalesce(p_months, 6), 1), 12);
  t30 timestamptz := ((d0 - 29)::timestamp at time zone 'Asia/Seoul');
  t90 timestamptz := ((d0 - 89)::timestamp at time zone 'Asia/Seoul');
  m0 date := date_trunc('month', d0)::date;
  north jsonb;
  lead_ jsonb;
  guard jsonb;
  g jsonb;
begin
  -- 북극성(달마다): 연결 커플 중 confirmed and saved, 혼자 쓰는 사람(같은 정의), 그중 사람이 직접 확인한 비율, 묶음 커플 비율
  select coalesce(jsonb_agg(x.v order by x.month), '[]'::jsonb) into north from (
    select mo.month, jsonb_build_object(
      'month', to_char(mo.month, 'YYYY-MM'),
      'couples', count(*) filter (where z.linked and z.confirmed and z.saved),
      'connected', count(*) filter (where z.linked),
      'solo', count(*) filter (where not z.linked and z.confirmed and z.saved),
      'manual', public.metric_ratio(count(*) filter (where z.linked and z.confirmed and z.saved and z.manual),
                                    count(*) filter (where z.linked and z.confirmed and z.saved)),
      'bundle', public.metric_ratio(count(*) filter (where z.linked and z.confirmed and z.saved and z.bundled),
                                    count(*) filter (where z.linked and z.confirmed and z.saved))) as v
    from (select (m0 - make_interval(months => k))::date as month from generate_series(0, n - 1) k) mo
    -- 그 달에 커플이 없어도 달 칸은 0으로
    left join lateral (
      select s.linked, s.bundled, r.confirmed, r.saved, r.manual
      from (
        select c.id, c.couple_state in ('connected', 'unlink_pending') as linked,
          exists (select 1 from public.saving_bundle b where b.space_id = c.id and b.deleted_at is null) as bundled
        from public.couple_space c
        where c.deleted_at is null
          and (c.created_at at time zone 'Asia/Seoul')::date < (mo.month + interval '1 month')::date
          and exists (select 1 from public.app_user u where u.space_id = c.id and u.status = 'active')) s
      cross join lateral public.metric_couple_month(s.id, mo.month) r) z on true
    group by mo.month) x;

  -- 선행(32 0-2 중 DB로 셀 수 있는 것)
  lead_ := jsonb_build_object(
    -- 첫 저금률: 최근 30일 온보딩을 마친 사람 중 24시간 안 저금 1개 이상(만든 사람 기준)
    'first_saving', (
      select public.metric_ratio(
        count(*) filter (where exists (
          select 1 from public.goal gl where gl.created_by = u.id and gl.deleted_at is null
            and gl.created_at <= u.onboarding_done_at + interval '24 hours')),
        count(*))
      from public.app_user u where u.status = 'active' and u.onboarding_done_at >= t30),
    -- 첫 월급날 확인률: 손 줄이 있는 사람마다 첫 확인 목록(7일이 지난 것) 중 7일 안 손 줄이 모두 끝남
    'first_payday', (
      select public.metric_ratio(
        count(*) filter (where not exists (
          select 1 from public.pay_check_line l where l.checklist_id = f.id and not l.auto
            and (l.state = 'wait' or l.checked_at >= ((f.cycle_start + 7)::timestamp at time zone 'Asia/Seoul')))),
        count(*))
      from (select distinct on (coalesce(c.owner_user_id, c.space_id)) c.*
            from public.pay_checklist c
            where exists (select 1 from public.pay_check_line l where l.checklist_id = c.id and not l.auto)
            order by coalesce(c.owner_user_id, c.space_id), c.cycle_start) f
      where f.cycle_start <= d0 - 7 and f.cycle_start > d0 - 97),
    -- 자동 줄 설정률(지금): 월급 계획이 있는 계획 중 자동 줄 1개 이상
    'auto_line', (
      select public.metric_ratio(
        count(*) filter (where exists (select 1 from public.split_line l where l.split_id = sp.id and l.auto_pay)),
        count(*))
      from public.salary_split sp join public.couple_space c on c.id = sp.space_id and c.deleted_at is null),
    -- 돈 들어왔어요 사용(이번 달): 월급 계획이 있는 사람 중 이번 달 1건 이상, 날짜 있음 / 없음 따로
    'money_in', (
      select jsonb_build_object(
        'dated', public.metric_ratio(count(*) filter (where not u.payday_none and used), count(*) filter (where not u.payday_none)),
        'none', public.metric_ratio(count(*) filter (where u.payday_none and used), count(*) filter (where u.payday_none)))
      from public.app_user u
      cross join lateral (select exists (
        select 1 from public.money_in mi where mi.owner_user_id = u.id and mi.deleted_at is null
          and mi.received_on >= m0) as used) z
      where u.status = 'active' and exists (
        select 1 from public.salary_split sp where sp.space_id = u.space_id
          and (sp.owner_user_id = u.id or sp.owner_user_id is null))),
    -- 묶음률(지금): 각자 계열 연결 커플 중 묶음 1개 이상
    'bundle', (
      select public.metric_ratio(
        count(*) filter (where exists (select 1 from public.saving_bundle b where b.space_id = c.id and b.deleted_at is null)),
        count(*))
      from public.couple_space c
      where c.deleted_at is null and c.couple_state = 'connected' and c.salary_mode = 'separate'),
    -- 분담 제안 수락률(최근 90일, 답이 난 것): 수락 ÷ (수락 + 거절 + 만료)
    'split_accept', (
      select public.metric_ratio(count(*) filter (where x.status = 'accepted'),
                                 count(*) filter (where x.status in ('accepted', 'declined', 'expired')))
      from public.shared_account x where x.created_at >= t90),
    -- 순위 같이 보기: 연결 커플 중 두 사람 모두 동의
    'rank_pair', (
      select public.metric_ratio(
        count(*) filter (where (select count(*) from public.app_user u where u.space_id = c.id and u.status = 'active'
                                  and u.rank_consent) >= 2),
        count(*))
      from public.couple_space c where c.deleted_at is null and c.couple_state = 'connected'));

  -- 가드레일(32 0-3 중 넷). limit = 경보 기준 %, alert = 기준을 넘음
  guard := '[]'::jsonb;
  -- 요청 거절: 최근 30일 끝난 관리 형태·분담 요청 중 거절 + 만료
  select public.metric_ratio(sum(bad)::bigint, sum(total)::bigint) into g from (
    select count(*) filter (where status in ('declined', 'expired')) as bad,
           count(*) filter (where status in ('accepted', 'declined', 'expired')) as total
      from public.mode_change_request where created_at >= t30
    union all
    select count(*) filter (where status in ('declined', 'expired')),
           count(*) filter (where status in ('accepted', 'declined', 'expired'))
      from public.shared_account where created_at >= t30) z;
  guard := guard || jsonb_build_array(g || jsonb_build_object('kind', 'request_declined', 'limit', 50));
  -- 연결 해제: 최근 30일 해제 요청 ÷ 연결 커플(해제 대기 포함)
  select public.metric_ratio(
    (select count(distinct space_id) from public.couple_unlink where requested_at >= t30),
    (select count(*) from public.couple_space where deleted_at is null and couple_state in ('connected', 'unlink_pending')))
    into g;
  guard := guard || jsonb_build_array(g || jsonb_build_object('kind', 'unlink', 'limit', 1));
  -- 자동 줄 바꿈: 최근 30일 나가는 날이 온 자동 줄 중 사람이 건너뜀·다른 금액으로 바꿈(사람이 다시 확인한 줄 포함)
  select public.metric_ratio(
    count(*) filter (where l.state = 'skipped' or l.checked_by is not null or l.actual is not null),
    count(*))
    into g
  from public.pay_check_line l where l.auto and l.auto_due >= d0 - 29 and l.auto_due <= d0 and l.state <> 'wait';
  guard := guard || jsonb_build_array(g || jsonb_build_object('kind', 'auto_line_changed', 'limit', 10));
  -- 잔액 차이: 최근 90일 잔액 맞추기로 맞춘 저금 중 −로 맞춘 것(G7)
  select public.metric_ratio(count(distinct m.goal_id) filter (where m.kind = 'out'), count(distinct m.goal_id))
    into g
  from public.goal_move m where m.reason_code = 'reconcile' and m.deleted_at is null and m.created_at >= t90;
  guard := guard || jsonb_build_array(g || jsonb_build_object('kind', 'reconcile_minus', 'limit', 20));
  select coalesce(jsonb_agg(x || jsonb_build_object('alert', (x->>'pct') is not null and (x->>'pct')::int > (x->>'limit')::int)),
                  '[]'::jsonb)
    into guard from jsonb_array_elements(guard) x;

  return jsonb_build_object('north_star', north, 'leading', lead_, 'guardrails', guard, 'at', now());
end;
$$;
revoke all on function public.admin_metrics(integer) from public, anon;
grant execute on function public.admin_metrics(integer) to authenticated;

-- ─────────────────────────── 3. save_split: 보내기 줄 순서 ───────────────────────────

create or replace function public.save_split(p_lines jsonb, p_owner uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  sid uuid := (select space_id from public.app_user where id = auth.uid());
  mode public.salary_mode;
  split uuid;
  l jsonb;
  i integer := 0;
  customs integer := 0;
  k public.split_line_kind;
  old_lines jsonb;
  old_set jsonb := '[]'::jsonb;
  g uuid;
  u uuid;
  nm text;
  prev jsonb;
  a record;
  touched uuid[] := '{}';
  t uuid;
begin
  if sid is null then
    raise exception 'no_space' using errcode = '42501';
  end if;
  select salary_mode into mode from public.couple_space where id = sid;
  -- 연결 해제 대기 중에는 분배표를 고칠 수 없음(25 ‘연결 해제, 대기와 혼자 쓰기’ 2번)
  if (select couple_state from public.couple_space where id = sid) = 'unlink_pending' then
    raise exception 'unlink_pending' using errcode = '42501';
  end if;
  if mode = 'joint' and p_owner is not null then
    raise exception 'joint_split_has_no_owner' using errcode = '22023';
  end if;
  if mode = 'separate' and (p_owner is null
      or not exists (select 1 from public.app_user where id = p_owner and space_id = sid)) then
    raise exception 'bad_owner' using errcode = '22023';
  end if;
  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) > 60 then
    raise exception 'bad_lines' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_lines) x where x->>'kind' = 'send') then
    raise exception 'send_locked' using errcode = '42501';
  end if;

  select id into split from public.salary_split
    where space_id = sid and owner_user_id is not distinct from p_owner;
  -- 2026-11-09: 각자 모드 파트너 월급 계획은 보기만(쓰는 돈 줄도 못 고침). 예전 ‘파트너 저금 줄만 잠금’ 대신
  if mode = 'separate' and p_owner <> uid then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  -- 합쳐서 남의 용돈 줄(B7, G9): 금액이 바뀌거나 빠지면 주인(또는 한 사람 관리형의 관리하는 사람)만
  if mode = 'joint' and split is not null then
    for a in
      select o.user_id, o.amount as before_amount,
        (select sum((x->>'amount')::bigint) from jsonb_array_elements(p_lines) x
          where x->>'kind' = 'allowance' and (x->>'user_id')::uuid = o.user_id) as after_amount
      from public.split_line o
      where o.split_id = split and o.kind = 'allowance' and o.user_id is not null and o.user_id <> uid
    loop
      if a.after_amount is distinct from a.before_amount then
        if not public.allowance_editable(sid, a.user_id) then
          raise exception 'not_owner' using errcode = '42501';
        end if;
        touched := touched || a.user_id;
      end if;
    end loop;
  end if;
  if split is null then
    insert into public.salary_split (space_id, owner_user_id, updated_by)
      values (sid, p_owner, uid) returning id into split;
  else
    select jsonb_agg(jsonb_build_object('kind', kind, 'goal_id', goal_id, 'user_id', user_id, 'name', name, 'amount', amount))
             filter (where kind <> 'send'),
           coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'goal_id', goal_id, 'user_id', user_id, 'name', name,
             'in_checklist', in_checklist, 'auto_pay', auto_pay, 'auto_day', auto_day)), '[]'::jsonb)
      into old_lines, old_set from public.split_line where split_id = split;
    update public.salary_split set updated_by = uid, updated_at = now(), version = version + 1
      where id = split;
    delete from public.split_line where split_id = split;
  end if;

  for l in select * from jsonb_array_elements(p_lines) loop
    k := (l->>'kind')::public.split_line_kind;
    if k = 'saving' and not exists (
        select 1 from public.goal g0
        where g0.id = (l->>'goal_id')::uuid and g0.space_id = sid and g0.deleted_at is null) then
      raise exception 'bad_goal' using errcode = '22023';
    end if;
    if k = 'allowance' and (l->>'user_id') is not null and not exists (
        select 1 from public.app_user where id = (l->>'user_id')::uuid and space_id = sid) then
      raise exception 'bad_user' using errcode = '22023';
    end if;
    if k = 'custom' then
      customs := customs + 1;
      if customs > 10 then
        raise exception 'too_many_custom' using errcode = '22023';
      end if;
    end if;
    g := case when k = 'saving' then (l->>'goal_id')::uuid end;
    u := case when k = 'allowance' then coalesce((l->>'user_id')::uuid, p_owner, uid) end;
    nm := case when k = 'custom' then btrim(l->>'name') end;
    select x into prev from jsonb_array_elements(old_set) x
      where x->>'kind' = k::text and (x->>'goal_id')::uuid is not distinct from g
        and (x->>'user_id')::uuid is not distinct from u and (x->>'name') is not distinct from nm
      limit 1;
    insert into public.split_line (split_id, space_id, kind, goal_id, user_id, name, amount, sort,
                                   in_checklist, auto_pay, auto_day)
    values (
      split, sid, k, g, u, nm,
      (l->>'amount')::bigint,
      i,
      coalesce((l->>'in_checklist')::boolean, (prev->>'in_checklist')::boolean),
      coalesce((l->>'auto_pay')::boolean, (prev->>'auto_pay')::boolean),
      case when l ? 'auto_day' then (l->>'auto_day')::smallint else (prev->>'auto_day')::smallint end
    );
    prev := null;
    i := i + 1;
  end loop;
  -- 보내기 줄은 서버가 다시(각자 계열은 줄을 지울 때 트리거가 이미 다시 넣음). 2026-11-13 PR 14: 어느 계열이든
  -- 보내기 줄은 맨 뒤(다른 줄 다음, 사람 순서), 옛 설정(체크리스트에 넣기, 자동, 나가는 날) 이어받기
  perform public.recalc_send_line(sid);
  update public.split_line l0 set sort = i + z.rn
    from (select id, (row_number() over (order by sort, user_id) - 1)::int as rn
            from public.split_line where split_id = split and kind = 'send') z
    where l0.id = z.id;
  update public.split_line l0 set in_checklist = (x->>'in_checklist')::boolean, auto_pay = (x->>'auto_pay')::boolean,
      auto_day = (x->>'auto_day')::smallint
    from jsonb_array_elements(old_set) x
    where l0.split_id = split and l0.kind = 'send' and x->>'kind' = 'send' and (x->>'user_id')::uuid = l0.user_id;
  if old_lines is not null then
    perform public.log_split_changes(split, old_lines);
  end if;
  foreach t in array touched loop
    perform public.notify_my_allowance(sid, t);
  end loop;
  perform public.sync_checklist(split);
  return split;
end;
$$;
