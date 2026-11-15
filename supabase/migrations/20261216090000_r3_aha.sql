-- 3차 검토 PR-C ‘아하 순간’(2026-11-15 사용자 결정 D2·D3). 스키마는 추가만(표 1개 + 함수).
--
-- ■ 계약(앱이 같은 결과)
--  1. 합류 때 모은 금액(18 P-09): join_saving_offer() → 합류한 사람(각자 엔진, 연결됨)이 상대 같이 모으기에 바로
--     묶을 수 있으면 {bundle_id, goal_id, name}, 아니면 null.
--     고르는 순서: 상대만 든 열린 묶음(달성 전·후 상관없이 닫히지 않은 것, 가장 먼저 만든 것) →
--     상대의 묶이지 않은 첫 저금(만든 순서, 끝내지 않음, visibility = all, 상대가 ‘했어요만’ 공개가 아님).
--     내가 이미 묶음에 든 저금이 있으면 null. 합쳐서 엔진(저금이 이미 같이)도 null.
--  2. join_saving_start(p_amount): 위에서 고른 곳에 내 새 저금(이름 = 묶음 이름, 목표 금액 없음, 시작할 때 모은 금액
--     = p_amount)을 만들어 바로 묶음. 상대 저금뿐이면 상대 저금으로 묶음을 만듦(구성원 a = 상대, b = 나,
--     목표 금액·기한 = 상대 저금 것). ‘이미 모은 금액은 만들 때만’ 규칙 그대로(새 저금의 start_saved).
--     상대에게 인앱 한 줄 “{나}님도 ‘결혼 비용’에 같이 모아요”(bundle_changed, 인앱만). 달성 확인(bundle_refresh).
--     거절: 'no_offer'(1번 null), 'bad_amount'(0 미만, 999억 원 초과).
--  3. 이번 달 우리 둘(19 H-14, 14 month_us): 받는 사람 = 연결된 공간의 활성 사용자 중 같이 계열 공동 월급 계획을
--     관리하는 사람(관리자, 관리자 없는 같이 관리면 두 사람)이 아닌 사람(= 각자 계열 두 사람, 한 사람 관리형의 관리하지
--     않는 쪽), 온보딩(합류)을 마친 사람.
--     날: 월급날 다음 날(각자 = 내 월급날, 같이 = 공동 기준일, cycle_date로 그 달 날짜), 날짜 없으면 매달 1일.
--     달 키 = 보낸 날 전날의 ‘YYYY-MM’(한 사람에 달마다 1번).
--     saved_total = 그 사람이 금액을 볼 수 있는 저금 합: 같이 계열 = 공간의 모든 저금, 각자 계열 = 내 저금 + 공동 저금
--     (묶이지 않은 것) + 내가 든 묶음 합계(퍼센트만 묶음은 빼고 개수만 셈). 끝냈거나 지운 저금은 뺌.
--     saved_delta = saved_total − 그 사람의 바로 전 카드 saved_total(없으면 null).
--     hidden = 각자 계열이고 두 사람 중 한 명이라도 ‘했어요만’ 공개(done_only) → 앱 응답에서 금액 null(개수만).
--     care = 오늘부터 30일 안의 경조사·기념일(care_next_date, 상대가 만든 비밀 일정은 뺌) 이른 순 3개 {name, on},
--     care_count = 그 개수 전체.
--     allowance = 내 용돈 줄(각자 = 내 월급 계획, 같이 = 공동 월급 계획의 내 줄) 합, 없으면 null.
--     알림: push_kinds.month_us를 켠 사람만(없는 키 = 켬) 푸시·인앱 “이번 달 우리 둘” / “모은 금액과 다가올 일정을
--     확인해 보세요”(본문에 금액 없음), 이동 홈. 카드는 알림을 꺼도 만듦.
--  4. month_us_card() → 내 가장 최근 카드(보낸 지 14일 안, 닫지 않음) 또는 null. dismiss_month_us(id)는 닫기(내 것만).

-- ─────────────────────────────── 표 ───────────────────────────────
create table public.month_us (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  space_id uuid not null references public.couple_space (id) on delete cascade,
  month_key text not null check (month_key ~ '^\d{4}-\d{2}$'),
  sent_on date not null,
  saved_total bigint check (saved_total >= 0),
  saved_delta bigint,
  saving_count integer not null default 0 check (saving_count >= 0),
  hidden boolean not null default false,
  care jsonb not null default '[]'::jsonb check (jsonb_typeof(care) = 'array'),
  care_count integer not null default 0 check (care_count >= 0),
  allowance bigint check (allowance >= 0),
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, month_key)
);
create index month_us_user_idx on public.month_us (user_id, sent_on desc);
alter table public.month_us enable row level security;
-- 앱은 month_us_card()·dismiss_month_us()로만(금액 가림이 응답에서 일어남)
revoke all on public.month_us from anon, authenticated;
create policy month_us_none on public.month_us for select to authenticated using (false);

-- ─────────────────────────── 1·2. 합류 때 모은 금액 ───────────────────────────
-- 계약 1: 묶을 곳(내가 고를 수 있는 것). 호출한 사람 기준
create function public.join_saving_target(p_user uuid)
returns table (bundle_id uuid, goal_id uuid, name text)
language plpgsql stable security definer set search_path = '' as $$
declare
  sp public.couple_space;
  other uuid;
begin
  select s.* into sp from public.couple_space s join public.app_user u on u.space_id = s.id
    where u.id = p_user and u.status = 'active' and s.deleted_at is null;
  if sp.id is null or sp.salary_mode <> 'separate' or sp.couple_state <> 'connected' then
    return;
  end if;
  select id into other from public.app_user where space_id = sp.id and status = 'active' and id <> p_user limit 1;
  if other is null then
    return;
  end if;
  -- 내가 이미 묶음에 든 저금이 있으면 없음
  if exists (select 1 from public.goal g where g.space_id = sp.id and g.owner_user_id = p_user
             and g.bundle_id is not null and g.deleted_at is null) then
    return;
  end if;
  -- 상대만 든 열린 묶음
  return query
    select b.id, null::uuid, b.name from public.saving_bundle b
    where b.space_id = sp.id and b.deleted_at is null and b.status <> 'closed'
      and exists (select 1 from public.goal x where x.bundle_id = b.id and x.deleted_at is null and x.owner_user_id = other)
      and not exists (select 1 from public.goal x where x.bundle_id = b.id and x.deleted_at is null
                      and x.owner_user_id is distinct from other)
    order by b.created_at limit 1;
  if found then
    return;
  end if;
  -- 상대의 묶이지 않은 첫 저금(보이는 것만: visibility all, 상대가 ‘했어요만’ 아님)
  return query
    select null::uuid, g.id, g.name from public.goal g
    join public.app_user o on o.id = g.owner_user_id
    where g.space_id = sp.id and g.owner_user_id = other and g.bundle_id is null
      and g.deleted_at is null and g.closed_at is null and g.status in ('active', 'delayed')
      and g.visibility = 'all' and o.plan_share <> 'done_only'
    order by g.created_at limit 1;
end;
$$;
revoke all on function public.join_saving_target(uuid) from public, anon, authenticated;

create function public.join_saving_offer()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('bundle_id', t.bundle_id, 'goal_id', t.goal_id, 'name', t.name)
  from public.join_saving_target(auth.uid()) t limit 1;
$$;
revoke all on function public.join_saving_offer() from public, anon;
grant execute on function public.join_saving_offer() to authenticated;

create function public.join_saving_start(p_amount bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  t record;
  base public.goal;
  sid uuid := (select space_id from public.app_user where id = auth.uid());
  bid uuid;
  gid uuid;
  nm text;
  me_name text;
begin
  if p_amount is null or p_amount < 0 or p_amount > 99999999999 then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  select * into t from public.join_saving_target(uid) limit 1;
  if t.bundle_id is null and t.goal_id is null then
    raise exception 'no_offer' using errcode = '22023';
  end if;
  if t.bundle_id is not null then
    select b.id, b.name into bid, nm from public.saving_bundle b where b.id = t.bundle_id for update;
  else
    -- 상대 저금으로 묶음을 만듦(상대가 만든 것처럼 구성원 a = 상대)
    select * into base from public.goal where id = t.goal_id for update;
    insert into public.saving_bundle (space_id, name, target_amount, deadline, member_a, member_b)
      values (sid, left(base.name, 20), base.target_amount, base.deadline, base.owner_user_id, uid)
      returning id, name into bid, nm;
    update public.goal set bundle_id = bid where id = base.id;
  end if;
  insert into public.goal (space_id, template, name, kind, priority, owner_user_id, created_by, start_saved, bundle_id)
    values (sid, 'custom', nm, 'once',
      coalesce((select max(priority) + 1 from public.goal where space_id = sid), 1), uid, uid, p_amount, bid)
    returning id into gid;
  -- 들어온 쪽이 비어 있던 b 자리 채움
  update public.saving_bundle set member_b = uid, version = version + 1, updated_at = now()
    where id = bid and member_b is null and member_a <> uid;
  me_name := (select nickname from public.app_user where id = uid);
  perform public.notify(o.id, sid, 'bundle_changed',
      coalesce(me_name || '님도', '파트너도') || ' ‘' || nm || '’에 같이 모아요', null, -- [확인 필요] 18 P-09
      '/salary/bundles/' || bid, 'users', uid, 'bundle_joined:' || bid || ':' || uid)
    from public.app_user o where o.space_id = sid and o.status = 'active' and o.id <> uid;
  perform public.bundle_refresh(bid);
  return jsonb_build_object('bundle_id', bid, 'goal_id', gid);
end;
$$;
revoke all on function public.join_saving_start(bigint) from public, anon;
grant execute on function public.join_saving_start(bigint) to authenticated;

-- ─────────────────────────── 3. 이번 달 우리 둘 ───────────────────────────
-- 받는 사람인가(계약 3)
create function public.month_us_for(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.app_user u join public.couple_space s on s.id = u.space_id
    where u.id = p_user and u.status = 'active' and u.onboarding_done_at is not null
      and s.deleted_at is null and s.couple_state = 'connected'
      and (s.salary_mode <> 'joint' or (s.manager_user_id is not null and s.manager_user_id <> u.id)));
$$;
revoke all on function public.month_us_for(uuid) from public, anon, authenticated;

-- 그 사람이 볼 수 있는 저금 합과 개수(계약 3)
create function public.month_us_saved(p_user uuid)
returns table (total bigint, cnt integer)
language plpgsql stable security definer set search_path = '' as $$
declare
  sp public.couple_space;
  t bigint;
  n integer;
begin
  select s.* into sp from public.couple_space s join public.app_user u on u.space_id = s.id where u.id = p_user;
  if sp.salary_mode = 'joint' then
    return query select coalesce(sum(public.goal_saved(g.id)), 0)::bigint, count(*)::int from public.goal g
      where g.space_id = sp.id and g.deleted_at is null and g.closed_at is null;
    return;
  end if;
  select coalesce(sum(public.goal_saved(g.id)), 0), count(*) into t, n from public.goal g
    where g.space_id = sp.id and g.deleted_at is null and g.closed_at is null and g.bundle_id is null
      and (g.owner_user_id = p_user or g.owner_user_id is null);
  t := t + coalesce((select sum(public.bundle_total(b.id)) from public.saving_bundle b
    where b.space_id = sp.id and b.deleted_at is null and b.status <> 'closed'
      and not (b.percent_only_a or b.percent_only_b)
      and exists (select 1 from public.goal x where x.bundle_id = b.id and x.owner_user_id = p_user and x.deleted_at is null)), 0);
  n := n + (select count(*) from public.saving_bundle b
    where b.space_id = sp.id and b.deleted_at is null and b.status <> 'closed'
      and exists (select 1 from public.goal x where x.bundle_id = b.id and x.owner_user_id = p_user and x.deleted_at is null))::int;
  return query select t, n;
end;
$$;
revoke all on function public.month_us_saved(uuid) from public, anon, authenticated;

-- 카드 하나 만들기(이미 그 달 것이 있으면 null)
create function public.month_us_build(p_user uuid, p_today date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  u public.app_user;
  sp public.couple_space;
  key text := to_char(p_today - 1, 'YYYY-MM');
  s record;
  prev bigint;
  hid boolean;
  cares jsonb;
  ncare integer;
  allow_ bigint;
  rid uuid;
begin
  select * into u from public.app_user where id = p_user;
  select * into sp from public.couple_space where id = u.space_id;
  select * into s from public.month_us_saved(p_user);
  select m.saved_total into prev from public.month_us m
    where m.user_id = p_user and m.sent_on < p_today order by m.sent_on desc limit 1;
  hid := sp.salary_mode <> 'joint' and exists (
    select 1 from public.app_user x where x.space_id = sp.id and x.status = 'active' and x.plan_share = 'done_only');
  select coalesce(jsonb_agg(jsonb_build_object('name', c.name, 'on', c.d) order by c.d, c.name)
           filter (where c.rn <= 3), '[]'::jsonb), count(*)
    into cares, ncare
    from (select x.name, x.d, row_number() over (order by x.d, x.name) rn
          from (select c.name, public.care_next_date(c, p_today) d from public.care_day c
                where c.space_id = sp.id and c.deleted_at is null
                  and (not c.secret or c.created_by = p_user)) x
          where x.d between p_today and p_today + 30) c;
  select sum(l.amount) into allow_ from public.split_line l join public.salary_split x on x.id = l.split_id
    where x.space_id = sp.id and l.kind = 'allowance' and l.user_id = p_user
      and x.owner_user_id is not distinct from (case when sp.salary_mode = 'joint' then null else p_user end);
  insert into public.month_us (user_id, space_id, month_key, sent_on, saved_total, saved_delta, saving_count, hidden,
                               care, care_count, allowance)
    values (p_user, sp.id, key, p_today, s.total, case when prev is null then null else s.total - prev end, s.cnt, hid,
            cares, ncare, allow_)
    on conflict (user_id, month_key) do nothing
    returning id into rid;
  return rid;
end;
$$;
revoke all on function public.month_us_build(uuid, date) from public, anon, authenticated;

-- 예약 작업(매일 09:00 KST): 오늘이 그 사람 날이면 카드 + (켠 사람만) 알림
create function public.send_month_us(p_today date default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  today date := coalesce(p_today, public.kst_today());
  y date := today - 1;
  u public.app_user;
  sp public.couple_space;
  d smallint;
  rid uuid;
  cnt integer := 0;
begin
  for u in select x.* from public.app_user x where public.month_us_for(x.id) loop
    select * into sp from public.couple_space where id = u.space_id;
    d := public.cycle_day(sp.id, case when sp.salary_mode = 'joint' then null else u.id end);
    continue when not (case when d is null then extract(day from today) = 1
      else y = public.cycle_date(d, extract(year from y)::int, extract(month from y)::int) end);
    rid := public.month_us_build(u.id, today);
    continue when rid is null;
    if public.push_kind_on(u.push_kinds, 'month_us') then
      perform public.notify(u.id, sp.id, 'month_us', '이번 달 우리 둘', -- [확인 필요] 14 month_us
        '모은 금액과 다가올 일정을 확인해 보세요', '/', 'users', null, 'month_us:' || u.id || ':' || to_char(y, 'YYYY-MM'));
    end if;
    cnt := cnt + 1;
  end loop;
  return cnt;
end;
$$;
revoke all on function public.send_month_us(date) from public, anon, authenticated;

-- 계약 4: 내 카드(14일 안, 닫지 않음). 금액 가림(hidden)은 여기서
create function public.month_us_card(p_today date default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', m.id, 'sent_on', m.sent_on, 'month_key', m.month_key,
    'saved_total', case when m.hidden then null else m.saved_total end,
    'saved_delta', case when m.hidden then null else m.saved_delta end,
    'saving_count', m.saving_count, 'hidden', m.hidden,
    'care', m.care, 'care_count', m.care_count, 'allowance', m.allowance)
  from public.month_us m
  where m.user_id = auth.uid() and m.dismissed_at is null
    and m.space_id = (select space_id from public.app_user where id = auth.uid())
    and m.sent_on > coalesce(p_today, public.kst_today()) - 14
  order by m.sent_on desc limit 1;
$$;
revoke all on function public.month_us_card(date) from public, anon;
grant execute on function public.month_us_card(date) to authenticated;

create function public.dismiss_month_us(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.month_us set dismissed_at = now() where id = p_id and user_id = auth.uid() and dismissed_at is null;
end;
$$;
revoke all on function public.dismiss_month_us(uuid) from public, anon;
grant execute on function public.dismiss_month_us(uuid) to authenticated;

-- 알림 종류 키(계약 10에 month_us 더함)
create or replace function public.push_kind_key(p_kind text)
returns text language sql immutable set search_path = '' as $$
  select case
    when p_kind = 'care_day' then 'care'
    when p_kind in ('payday', 'review_due') then 'payday'
    when p_kind in ('goal_achieved', 'bundle_achieved') then 'achieved'
    when p_kind in ('partner_change', 'salary_mode', 'cycle_day', 'weekly_summary', 'behalf_checked') then 'shared_change'
    when p_kind = 'my_allowance' then 'my_allowance'
    when p_kind = 'progress_news' then 'progress_news'
    when p_kind = 'month_us' then 'month_us'
  end;
$$;

comment on column public.app_user.push_kinds is
  '알림 종류 켜기(P-11·S-14) {care,payday,achieved,shared_change,my_allowance,progress_news,month_us: bool}, 없는 키 = 켬';

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('send-month-us', '0 0 * * *', 'select public.send_month_us()');
  end if;
end;
$$;
