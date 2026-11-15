-- 5차 검토 묶음 B(2026-11-16 사용자: “발견한 버그도 바로 수정해”). 스키마는 추가만(열 1개 + 함수·트리거).
--
-- ■ 계약(앱이 같은 결과)
--  1. B1 이번 달 우리 둘(14 month_us, 19 H-14): 날 = 앞당긴 월급날(07 1장 shifted_cycle_date, 주말·공휴일이면 직전 영업일,
--     앞당기기를 끄면 원래 날) 다음 날. 예전에는 원래 날(cycle_date)로 봐서 12월 25일(공휴일) 월급 → 24일에 받았는데 카드는
--     26일에 생겼음. 앞당겨 전 달 말일이 된 월급날(1일 → 12월 31일)도 그다음 날. 달 키 = 그 월급날의 원래 달
--     (예전 ‘보낸 날 전날의 달’, 앞당겨 달이 바뀌면 같은 달 두 번으로 막혔음). 날짜 없는 사람은 그대로 매달 1일, 달 키 = 전날의 달.
--  2. B3 쓸 곳 메모 D-7(14 v2.2 ‘쓸 곳 메모 D-7’, 20 W-14): 매일 09:00 KST send_note_reminders. 낼 날이 오늘 + 7일, 안 냈고 지우지
--     않은 메모. 받는 사람 [확인 필요] = 그 메모를 고칠 수 있는 사람: 주인 있는 저금은 주인, 주인 없는(공동) 저금은 공간의 두 사람,
--     묶음은 구성원 둘. kind saving_note_due, 알림 종류 키 care(경조사와 같이 켬·끔). 제목 “12월 3일 예식장 잔금이에요”, 본문 없음,
--     이동 W-14(저금 /salary/items/{id}/notes, 묶음 /salary/bundles/{id}/notes). 한 메모·낼 날·사람마다 1번.
--  3. B4 분담 ‘좋아요’ 뒤 줄이 줄어든 것 알리기(06 3-7 M9): answer_split 결과 인앱(split_result, 제안한 사람)에 본문 한 줄
--     [확인 필요] “통장에 넣는 만큼 생활비를 줄였어요” / “… 고정지출을 …” / “… 생활비와 고정지출을 …”(제안한 사람 월급 계획,
--     합쳐서면 공동 월급 계획에서 줄어든 것). 줄어든 게 없으면 예전처럼 본문 없음. 답한 사람은 앱 Toast(W-01c).
--  4. B5 혼자 쓰다 연결할 때 자산 공개(08 6장, 23 F-03e) [확인 필요]: 공간이 연결되는 순간(not_joined → connected) 그 공간을 만든
--     사람이 공개를 아직 고르지 않았으면(app_user.asset_share_default null) 그 사람 명의 ‘모두’ 자산을 ‘숨기기’로 두고
--     asset.share_pending = true. 앱은 홈 띠로 한 번 묻고 answer_asset_share(vis)로 그 자산들을 고른 값으로(+ 기본값이 없으면
--     고른 값을 기본값으로). 이미 연결된 공간·기존 자산은 바꾸지 않음(다음 연결부터). 합류한 사람의 옮긴 자산은 P-02a에서 고름.

-- ─────────────────────────── 1. B1 이번 달 우리 둘 날 ───────────────────────────
-- 카드 하나 만들기(달 키를 받음). 본문은 month_us_build(20261216090000)와 같고 달 키만 바깥에서
create function public.month_us_build_key(p_user uuid, p_today date, p_key text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  u public.app_user;
  sp public.couple_space;
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
    values (p_user, sp.id, p_key, p_today, s.total, case when prev is null then null else s.total - prev end, s.cnt, hid,
            cares, ncare, allow_)
    on conflict (user_id, month_key) do nothing
    returning id into rid;
  return rid;
end;
$$;
revoke all on function public.month_us_build_key(uuid, date, text) from public, anon, authenticated;

create or replace function public.month_us_build(p_user uuid, p_today date)
returns uuid language sql security definer set search_path = '' as $$
  select public.month_us_build_key(p_user, p_today, to_char(p_today - 1, 'YYYY-MM'));
$$;

-- 예약 작업(매일 09:00 KST, pg_cron send-month-us 그대로): 어제가 그 사람의 앞당긴 월급날이면 카드 + (켠 사람만) 알림(계약 1)
create or replace function public.send_month_us(p_today date default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  today date := coalesce(p_today, public.kst_today());
  y date := today - 1;
  u public.app_user;
  sp public.couple_space;
  d smallint;
  mon date;
  key text;
  rid uuid;
  cnt integer := 0;
begin
  for u in select x.* from public.app_user x where public.month_us_for(x.id) loop
    select * into sp from public.couple_space where id = u.space_id;
    d := public.cycle_day(sp.id, case when sp.salary_mode = 'joint' then null else u.id end);
    key := null;
    if d is null then
      if extract(day from today) = 1 then
        key := to_char(y, 'YYYY-MM');
      end if;
    else
      -- 어제의 달, 또는 앞당겨 어제(전 달 말일 근처)가 된 다음 달 월급날
      for k in 0..1 loop
        mon := (date_trunc('month', y) + make_interval(months => k))::date;
        if public.shifted_cycle_date(sp.id, d, extract(year from mon)::int, extract(month from mon)::int) = y then
          key := to_char(mon, 'YYYY-MM');
          exit;
        end if;
      end loop;
    end if;
    continue when key is null;
    rid := public.month_us_build_key(u.id, today, key);
    continue when rid is null;
    if public.push_kind_on(u.push_kinds, 'month_us') then
      perform public.notify(u.id, sp.id, 'month_us', '이번 달 우리 둘', -- [확인 필요] 14 month_us
        '모은 금액과 다가올 일정을 확인해 보세요', '/', 'users', null, 'month_us:' || u.id || ':' || key);
    end if;
    cnt := cnt + 1;
  end loop;
  return cnt;
end;
$$;

-- ─────────────────────────── 2. B3 쓸 곳 메모 D-7 ───────────────────────────
create function public.send_note_reminders(p_today date default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  today date := coalesce(p_today, public.kst_today());
  n record;
  uid uuid;
  cnt integer := 0;
begin
  for n in
    select x.id, x.space_id, x.name, x.due_on, x.goal_id, x.bundle_id, g.owner_user_id, b.member_a, b.member_b
    from public.saving_note x
    join public.couple_space s on s.id = x.space_id and s.deleted_at is null
    left join public.goal g on g.id = x.goal_id
    left join public.saving_bundle b on b.id = x.bundle_id
    where x.deleted_at is null and not x.paid and x.due_on = today + 7
      and (x.goal_id is null or g.deleted_at is null)
      and (x.bundle_id is null or (b.deleted_at is null and b.status <> 'closed'))
  loop
    for uid in
      select u.id from public.app_user u
      where u.space_id = n.space_id and u.status = 'active'
        and case
          when n.bundle_id is not null then u.id in (n.member_a, n.member_b)
          when n.owner_user_id is not null then u.id = n.owner_user_id
          else true end
    loop
      perform public.notify(uid, n.space_id, 'saving_note_due',
        public.md_label(n.due_on) || ' ' || public.ko_is(n.name), null, -- [확인 필요] 14 ‘쓸 곳 메모 D-7’
        case when n.bundle_id is not null then '/salary/bundles/' || n.bundle_id || '/notes'
             else '/salary/items/' || n.goal_id || '/notes' end,
        'calendar-check', null, 'note_due:' || n.id || ':' || n.due_on || ':' || uid);
      cnt := cnt + 1;
    end loop;
  end loop;
  return cnt;
end;
$$;
revoke all on function public.send_note_reminders(date) from public, anon, authenticated;

-- 알림 종류 키(20261216090000 + 쓸 곳 메모 D-7 = care)
create or replace function public.push_kind_key(p_kind text)
returns text language sql immutable set search_path = '' as $$
  select case
    when p_kind in ('care_day', 'saving_note_due') then 'care'
    when p_kind in ('payday', 'review_due') then 'payday'
    when p_kind in ('goal_achieved', 'bundle_achieved') then 'achieved'
    when p_kind in ('partner_change', 'salary_mode', 'cycle_day', 'weekly_summary', 'behalf_checked') then 'shared_change'
    when p_kind = 'my_allowance' then 'my_allowance'
    when p_kind = 'progress_news' then 'progress_news'
    when p_kind = 'month_us' then 'month_us'
  end;
$$;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('send-note-reminders', '0 0 * * *', 'select public.send_note_reminders()');
  end if;
end;
$$;

-- ─────────────────────────── 3. B4 분담 ‘좋아요’ 뒤 줄어든 것 ───────────────────────────
-- 20261203090000과 같고 제안한 사람 결과 알림에 줄어든 줄 한 줄(계약 3)
create or replace function public.answer_split(p_id uuid, p_accept boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  a public.shared_account;
  joint boolean;
  plan uuid;
  living0 bigint;
  fixed0 bigint;
  living1 bigint;
  fixed1 bigint;
  cut text;
begin
  select * into a from public.shared_account where id = p_id for update;
  if a.id is null or not public.is_space_member(a.space_id) or a.proposed_by = uid then
    raise exception 'not_found' using errcode = '42501';
  end if;
  if a.status <> 'proposed' then
    raise exception 'not_open' using errcode = '22023';
  end if;
  if a.expires_at < now() then
    update public.shared_account set status = 'expired' where id = a.id;
    return 'expired';
  end if;
  update public.shared_account set status = case when p_accept then 'accepted' else 'declined' end, answered_at = now()
    where id = a.id;
  if p_accept then
    select salary_mode = 'joint' into joint from public.couple_space where id = a.space_id;
    select id into plan from public.salary_split
      where space_id = a.space_id and owner_user_id is not distinct from (case when joint then null else a.proposed_by end);
    select coalesce(sum(amount) filter (where kind = 'living'), 0), coalesce(sum(amount) filter (where kind = 'fixed'), 0)
      into living0, fixed0 from public.split_line where split_id = plan;
    perform public.apply_shared_account(a.id);
    select coalesce(sum(amount) filter (where kind = 'living'), 0), coalesce(sum(amount) filter (where kind = 'fixed'), 0)
      into living1, fixed1 from public.split_line where split_id = plan;
    cut := case
      when living1 < living0 and fixed1 < fixed0 then '생활비와 고정지출을'
      when living1 < living0 then '생활비를'
      when fixed1 < fixed0 then '고정지출을' end;
  end if;
  perform public.notify(a.proposed_by, a.space_id, 'split_result',
    case when p_accept then '‘' || a.name || '’ 나누기를 정했어요' else '‘' || a.name || '’ 나누기는 지금처럼 둘게요' end, -- [확인 필요]
    case when cut is not null then '통장에 넣는 만큼 ' || cut || ' 줄였어요' end, -- [확인 필요] 06 3-7 M9
    '/salary?view=plan', 'users', uid, 'split_result:' || a.id);
  return case when p_accept then 'accepted' else 'declined' end;
end;
$$;

-- ─────────────────────────── 4. B5 연결할 때 자산 공개 ───────────────────────────
alter table public.asset add column share_pending boolean not null default false;
comment on column public.asset.share_pending is
  '혼자 쓸 때 ‘모두’로 적은 내 명의 자산을 연결 순간 숨겨 둠(공개를 한 번 묻기 전, 20261218090000 계약 4)';

create function public.asset_share_on_connect()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.couple_state = 'not_joined' and new.couple_state = 'connected' and new.created_by is not null
     and exists (select 1 from public.app_user u where u.id = new.created_by and u.asset_share_default is null) then
    update public.asset set visibility = 'private', share_pending = true
      where space_id = new.id and owner = 'person' and owner_user_id = new.created_by
        and deleted_at is null and visibility = 'all';
  end if;
  return new;
end;
$$;
revoke all on function public.asset_share_on_connect() from public, anon, authenticated;
create trigger couple_space_asset_share after update of couple_state on public.couple_space
  for each row execute function public.asset_share_on_connect();

-- 홈 띠에서 고른 값(계약 4): 숨겨 둔 내 자산을 그 값으로, 기본값이 없으면 기본값도. 바꾼 개수
create function public.answer_asset_share(p_vis public.asset_visibility)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  n integer;
begin
  if uid is null then
    raise exception 'not_found' using errcode = '42501';
  end if;
  update public.asset set visibility = p_vis
    where owner_user_id = uid and share_pending and visibility = 'private' and deleted_at is null;
  get diagnostics n = row_count;
  update public.asset set share_pending = false where owner_user_id = uid and share_pending;
  update public.app_user set asset_share_default = coalesce(asset_share_default, p_vis) where id = uid;
  return n;
end;
$$;
revoke all on function public.answer_asset_share(public.asset_visibility) from public, anon;
grant execute on function public.answer_asset_share(public.asset_visibility) to authenticated;
