-- 알림(docs/spec/14-notifications.md). 센터 = 받는 사람 기준 모든 알림 기록(90일 보관). 앱은 내 알림만 읽고 읽음 처리만 함.
-- 데스크톱 OS 알림은 앱(트레이 포함)이 Realtime으로 받아 로컬로 띄움(서버 푸시 없음). 메일(SES)은 다음 단계.
-- 이번에 만드는 것:
--   즉시(트리거): 제안 도착, 제안 응답 결과(좋아요·반대), 배우자 합류
--   오전 9시(pg_cron 0 0 * * * UTC): 챙길 날 D-30·D-14·D-7·당일(담당자, 서프라이즈는 만든 사람만), 월급날(월급 나누기를 쓰는
--     사람, 주말·공휴일이면 직전 영업일), 월급 플랜(나누기를 안 쓰는 사람, 그 사이클 플랜이 시작한 날)
--   오후 8시(pg_cron 0 11 * * * UTC): 월말 정리(기준일 3일 전), 월말 정리 리마인드(전날, 정리 전일 때만)
--   새벽 4시(0 19 * * * UTC): 90일 지난 알림 지우기
-- 같은 알림은 dedupe 키로 한 번만(예약 작업을 다시 돌려도 같음).

create table public.notification (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade, -- 받는 사람
  space_id uuid references public.couple_space (id) on delete set null,
  kind text not null check (kind ~ '^[a-z_]{2,40}$'),
  title text not null check (char_length(title) between 1 and 120),
  body text check (char_length(body) <= 200),
  -- OS 알림에 보일 문구(서프라이즈는 “챙길 날 알림이 있어요” + 본문 숨김). null이면 title·body
  push_title text check (char_length(push_title) <= 120),
  push_hidden boolean not null default false,
  target text not null check (target ~ '^/'), -- 누르면 갈 화면(앱 경로)
  icon text check (icon ~ '^[a-z-]{2,30}$'), -- 앱 안내 아이콘(Phosphor 이름). 사람이 한 일은 actor_id
  actor_id uuid references auth.users (id) on delete set null,
  dedupe text not null unique,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notification_user_idx on public.notification (user_id, created_at desc);

alter table public.notification enable row level security;
create policy notification_select on public.notification for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.notification from anon, authenticated;

-- 읽음: 고른 알림, 또는 null이면 모두. 내 알림만
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  update public.notification set read_at = now()
  where user_id = auth.uid() and read_at is null and (p_ids is null or id = any (p_ids));
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.mark_notifications_read(uuid[]) from public, anon;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

-- ── 문구 도우미(앱 copy와 같은 규칙) ─────────────────────────────────────────
-- 받침 있으면 true(한글이 아니면 false)
create or replace function public.ko_batchim(w text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when ascii(right(btrim(w), 1)) between 44032 and 55203 then (ascii(right(btrim(w), 1)) - 44032) % 28 <> 0
    else false end;
$$;
-- 이/가, 을/를, 이에요/예요
create or replace function public.ko_subj(w text) returns text language sql immutable set search_path = '' as $$
  select w || case when public.ko_batchim(w) then '이' else '가' end;
$$;
create or replace function public.ko_obj(w text) returns text language sql immutable set search_path = '' as $$
  select w || case when public.ko_batchim(w) then '을' else '를' end;
$$;
create or replace function public.ko_is(w text) returns text language sql immutable set search_path = '' as $$
  select w || case when public.ko_batchim(w) then '이에요' else '예요' end;
$$;
-- 금액 읽기(core readWon): 300000 → 30만 원, 3205000 → 320만 5,000원
create or replace function public.read_won(v bigint)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when v = 0 then '0원'
    else concat_ws(' ',
      case when v / 100000000 > 0 then to_char(v / 100000000, 'FM999,999') || '억' end,
      case when (v % 100000000) / 10000 > 0 then to_char((v % 100000000) / 10000, 'FM9,999') || '만' end,
      case when v % 10000 > 0 then to_char(v % 10000, 'FM9,999') || '원' end
    ) || case when v % 10000 = 0 then ' 원' else '' end
  end;
$$;
-- “10월 25일”
create or replace function public.md_label(d date) returns text language sql immutable set search_path = '' as $$
  select extract(month from d)::int || '월 ' || extract(day from d)::int || '일';
$$;
create or replace function public.kst_today() returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Seoul')::date;
$$;

-- 알림 넣기(내부). 같은 dedupe는 한 번만
create or replace function public.notify(
  p_user uuid, p_space uuid, p_kind text, p_title text, p_body text, p_target text,
  p_icon text, p_actor uuid, p_dedupe text, p_push_title text default null, p_push_hidden boolean default false
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.notification (user_id, space_id, kind, title, body, target, icon, actor_id, dedupe, push_title, push_hidden)
  values (p_user, p_space, p_kind, p_title, p_body, p_target, p_icon, p_actor, p_dedupe, p_push_title, p_push_hidden)
  on conflict (dedupe) do nothing;
$$;
revoke execute on function public.notify(uuid, uuid, text, text, text, text, text, uuid, text, text, boolean) from public, anon, authenticated;

-- ── 날짜 도우미(core rules/care.ts, calendar.ts와 같은 결과) ───────────────────
create or replace function public.care_date_in_year(c public.care_day, y integer)
returns date
language sql
stable
set search_path = ''
as $$
  select case
    when c.date_rule = 'once' then c.once_on
    when c.month is null or c.day is null then null
    when c.date_rule = 'lunar_yearly' then coalesce(
      (select l.solar from public.lunar_date l where l.lunar_year = y and l.month = c.month and l.day = c.day and l.leap and c.leap),
      (select l.solar from public.lunar_date l where l.lunar_year = y and l.month = c.month and l.day = c.day and not l.leap))
    else make_date(y, c.month, least(c.day, extract(day from (make_date(y, c.month, 1) + interval '1 month - 1 day'))::int))
  end;
$$;
-- 오늘(포함) 뒤 처음 오는 날. 한 번이면 그 날
create or replace function public.care_next_date(c public.care_day, today date)
returns date
language sql
stable
set search_path = ''
as $$
  select case when c.date_rule = 'once' then c.once_on else (
    select min(d) from (
      select public.care_date_in_year(c, y) as d
      from generate_series(extract(year from today)::int - 1, extract(year from today)::int + 1) y
    ) x where d >= today)
  end;
$$;
-- 주말·공휴일이면 직전 영업일
create or replace function public.business_day_on_or_before(d date)
returns date
language plpgsql
stable
set search_path = ''
as $$
declare
  x date := d;
begin
  for i in 1..14 loop
    exit when extract(isodow from x) < 6 and not exists (select 1 from public.holiday h where h.date = x);
    x := x - 1;
  end loop;
  return x;
end;
$$;
-- 그 달의 월급날(말일, 없는 날은 말일), 앞당기기 켜져 있으면 직전 영업일
create or replace function public.payday_in(u public.app_user, shift boolean, y integer, m integer)
returns date
language sql
stable
set search_path = ''
as $$
  select case when u.payday is null and not u.payday_last then null else (
    select case when shift then public.business_day_on_or_before(d) else d end
    from (select case when u.payday_last then last else make_date(y, m, least(u.payday, extract(day from last)::int)) end as d
          from (select (make_date(y, m, 1) + interval '1 month - 1 day')::date as last) l) z)
  end;
$$;

-- ── 즉시: 제안 도착, 제안 응답 결과 ───────────────────────────────────────────
-- 항목 이름(“용돈”, “어머니 생신 목표” …). 목표 항목은 목표 이름
create or replace function public.proposal_item_noun(p public.proposal)
returns text
language sql
stable
set search_path = ''
as $$
  select case p.item
    when 'allowance' then '용돈'
    when 'split' then '분담 방식'
    when 'living_budget' then '생활비 예산'
    when 'family_budget' then '양가 비용 예산'
    when 'goal_order' then '목표 순서'
    when 'goal_add' then coalesce(btrim(p.after->>'name'), '새') || ' 목표'
    else coalesce((select g.name from public.goal g where g.id = p.target_id), '') || ' 목표'
  end;
$$;

create or replace function public.notify_proposal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  other public.app_user;
  who text;
  noun text := public.proposal_item_noun(new);
begin
  if tg_op = 'INSERT' and new.status = 'open' then
    select * into other from public.app_user
      where space_id = new.space_id and status = 'active' and id <> new.proposer limit 1;
    if other.id is null then return new; end if;
    select coalesce(nickname, '') into who from public.app_user where id = new.proposer;
    perform public.notify(
      other.id, new.space_id, 'proposal_arrived',
      case when new.item = 'goal_add'
        then who || '님이 ' || public.ko_obj(noun) || ' 추가하자고 제안했어요'
        else who || '님이 ' || public.ko_obj(noun) || ' 바꾸자고 제안했어요' end,
      '좋아요면 바로, 반대 없으면 ' || public.md_label(new.apply_on) || '부터 적용돼요',
      '/proposals/' || new.id, null, new.proposer, 'proposal:' || new.id || ':arrived');
  elsif tg_op = 'UPDATE' and old.response is null and new.response in ('like', 'oppose') then
    select * into other from public.app_user
      where space_id = new.space_id and status = 'active' and id <> new.proposer limit 1;
    who := coalesce(other.nickname, '');
    perform public.notify(
      new.proposer, new.space_id, 'proposal_answered',
      case when new.response = 'like'
        then who || '님이 ' || noun || ' 제안에 좋아요를 눌렀어요'
        else who || '님이 ' || noun || ' 제안에 반대했어요' end,
      case when new.response = 'like' then '바로 적용했어요' else '월말 정리에서 함께 정해요' end,
      '/proposals/' || new.id, null, other.id, 'proposal:' || new.id || ':answered');
  end if;
  return new;
end;
$$;
revoke execute on function public.notify_proposal() from public, anon, authenticated;
create trigger proposal_notify after insert or update of response on public.proposal
  for each row execute function public.notify_proposal();

-- ── 즉시: 배우자 합류(P-11) → 초대한 사람 ─────────────────────────────────────
create or replace function public.notify_joined()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  joiner public.app_user;
begin
  if old.couple_state = 'not_joined' and new.couple_state = 'connected' then
    select * into joiner from public.app_user
      where space_id = new.id and status = 'active' and id <> new.created_by limit 1;
    if joiner.id is null or new.created_by is null then return new; end if;
    perform public.notify(
      new.created_by, new.id, 'partner_joined',
      coalesce(joiner.nickname, new.partner_nickname, '배우자') || '님이 합류했어요',
      '이제 같은 플랜을 함께 봐요', '/', null, joiner.id, 'joined:' || new.id || ':' || joiner.id);
  end if;
  return new;
end;
$$;
revoke execute on function public.notify_joined() from public, anon, authenticated;
create trigger couple_space_joined after update of couple_state on public.couple_space
  for each row execute function public.notify_joined();

-- ── 오전 9시: 챙길 날, 월급날, 월급 플랜 ───────────────────────────────────────
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
  sp public.couple_space;
  u public.app_user;
  d date;
  n integer;
  title text;
  body text;
  cnt integer := 0;
  split boolean;
begin
  -- 챙길 날: 담당자에게(같이 = 둘 다). 미합류 배우자가 담당이면 시작한 사람. 서프라이즈는 만든 사람만, OS 알림은 숨김
  for c in select * from public.care_day where deleted_at is null and coalesce(array_length(alerts, 1), 0) > 0 loop
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
    body := case n
      when 30 then case when c.budget > 0 then '예산은 ' || public.ko_is(public.read_won(c.budget)) end
      when 7 then '준비는 어떻게 되고 있나요?'
      else null end;
    for u in
      select a.* from public.app_user a
      where a.space_id = c.space_id and a.status = 'active'
        and (case
          when c.secret then a.id = c.created_by
          when c.carer = 'together' then true
          -- 담당 쪽 사람이 없으면(미합류) 있는 사람에게
          when exists (select 1 from public.app_user b where b.space_id = c.space_id and b.status = 'active'
                       and b.side::text = c.carer::text) then a.side::text = c.carer::text
          else true end)
    loop
      perform public.notify(
        u.id, c.space_id, 'care_day', title, body, '/calendar/day/' || c.id, 'gift', null,
        'care:' || c.id || ':' || d || ':' || n || ':' || u.id,
        case when c.secret then '챙길 날 알림이 있어요' end, c.secret);
      cnt := cnt + 1;
    end loop;
  end loop;

  -- 월급날(나누기를 쓰는 부부: 연결, 통장 역할, 각자 관리 예비부부 아님) / 월급 플랜(그 밖, 사이클 시작일)
  for sp in select * from public.couple_space loop
    split := sp.couple_state = 'connected' and sp.account_mode = 'roles'
      and not (sp.marriage_status = 'engaged' and sp.prep_money_mode = 'separate');
    for u in select * from public.app_user where space_id = sp.id and status = 'active' loop
      if split then
        if public.payday_in(u, sp.holiday_shift, extract(year from today)::int, extract(month from today)::int) = today then
          perform public.notify(u.id, sp.id, 'payday', '오늘은 월급 나누는 날이에요', '옮긴 통장은 체크해 주세요',
            '/plan/split', 'calendar-check', null, 'payday:' || u.id || ':' || today);
          cnt := cnt + 1;
        end if;
      elsif not (sp.marriage_status = 'engaged' and sp.prep_money_mode = 'separate')
        and exists (select 1 from public.monthly_plan p where p.space_id = sp.id and p.deleted_at is null and p.cycle_start = today) then
        perform public.notify(u.id, sp.id, 'plan_ready', '이번 달 월급 플랜이 나왔어요', null,
          '/plan', 'calendar-check', null, 'plan:' || sp.id || ':' || today || ':' || u.id);
        cnt := cnt + 1;
      end if;
    end loop;
  end loop;
  return cnt;
end;
$$;
revoke execute on function public.send_morning_notifications(date) from public, anon, authenticated;

-- ── 오후 8시: 월말 정리(기준일 3일 전), 리마인드(전날, 정리 전) ─────────────────
create or replace function public.send_evening_notifications(p_today date default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  today date := coalesce(p_today, public.kst_today());
  p public.monthly_plan;
  sp public.couple_space;
  u public.app_user;
  mon text;
  prep boolean;
  cnt integer := 0;
begin
  for p in
    select * from public.monthly_plan
    where deleted_at is null and status <> 'closed' and (cycle_end - 2 = today or cycle_end = today)
  loop
    select * into sp from public.couple_space where id = p.space_id;
    prep := sp.marriage_status = 'engaged' and sp.prep_money_mode = 'separate';
    mon := extract(month from p.label_month)::int || '월';
    continue when p.cycle_end = today and exists (
      select 1 from public.month_close m where m.plan_id = p.id and m.status = 'done' and m.deleted_at is null);
    for u in select * from public.app_user where space_id = p.space_id and status = 'active' loop
      if p.cycle_end - 2 = today then
        perform public.notify(u.id, p.space_id, 'close_start',
          case when prep then '이번 달 결혼 준비 돈을 확인할 차례예요' else mon || ' 월급 플랜을 정리할 차례예요' end,
          case when prep then '1~2분이면 돼요' else '5~10분이면 돼요' end,
          '/month/close/w-04a', 'clipboard-text', null, 'close:' || p.id || ':start:' || u.id);
      else
        perform public.notify(u.id, p.space_id, 'close_remind',
          case when prep then '이번 달 결혼 준비 돈 확인이 남았어요' else mon || ' 월급 플랜 정리가 남았어요' end,
          '내일까지 월말 정리를 마쳐 주세요',
          '/month/close/w-04a', 'clipboard-text', null, 'close:' || p.id || ':remind:' || u.id);
      end if;
      cnt := cnt + 1;
    end loop;
  end loop;
  return cnt;
end;
$$;
revoke execute on function public.send_evening_notifications(date) from public, anon, authenticated;

-- 90일 지난 알림 지우기
create or replace function public.purge_notifications()
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  with d as (delete from public.notification where created_at < now() - interval '90 days' returning 1)
  select count(*)::int from d;
$$;
revoke execute on function public.purge_notifications() from public, anon, authenticated;

-- Realtime(새 알림 → 앱 점, 데스크톱 OS 알림)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notification;
  end if;
end;
$$;

-- 예약 작업(pg_cron, UTC). pg_cron이 없는 환경(테스트 흉내)에서는 건너뜀
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('send-morning-notifications', '0 0 * * *', 'select public.send_morning_notifications()');
    perform cron.schedule('send-evening-notifications', '0 11 * * *', 'select public.send_evening_notifications()');
    perform cron.schedule('purge-notifications', '0 19 * * *', 'select public.purge_notifications()');
  end if;
end;
$$;
