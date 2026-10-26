-- 배우자 변경 알림(08 4장, 14 ‘배우자 변경 알림’). 제안 없이 바로 고치고, 상대에게 알림 + 활동 기록.
--   변경은 바로 알리지 않고 partner_change에 쌓음 → 1분마다 flush_partner_changes가 같은 사람이 첫 변경부터 10분 지난 묶음을
--   한 번에 보냄. 같은 항목·같은 값은 처음 전 값과 마지막 후 값만 보고, 둘이 같으면(‘되돌리기’) 알리지 않음.
--   바로 알림(푸시·인앱, topic partner_change): 분배표 금액, 월급 금액, 우리 목표 금액·기한·삭제, 우리 목표 넣기·빼기·꺼내 쓰기
--   주간 요약에만(인앱 활동 기록, topic silent): 자산 금액·추가·삭제, 우리 목표 이름·순서·보류·종류·추가·되살리기,
--     챙길 날 추가·메모, 체크리스트 만드는 날
--   월요일 오전 9시 send_weekly_summary: 지난주 바꾼 것이 있으면 “이번 주 예빈님이 바꾼 게 3개 있어요”
-- 미합류·혼자 쓰기·고친 사람이 없는 변경(예약 작업)·내 목표·비공개 자산은 남기지 않음. 대신 체크·관리 방식·달성은 따로 바로 알림.

create table public.partner_change (
  id bigint generated always as identity primary key,
  space_id uuid not null references public.couple_space (id) on delete cascade,
  actor_id uuid not null references auth.users (id) on delete cascade,
  receiver_id uuid not null references auth.users (id) on delete cascade,
  topic text not null check (topic in ('split', 'income', 'goal', 'goal_move', 'asset', 'goal_meta', 'care', 'cycle_day')),
  ref_id uuid, -- 바뀐 항목
  field text not null, -- 무엇(같은 ref·field끼리 묶음)
  noun text not null, -- 문구에 쓰는 이름(목표 이름, 줄 이름, 자산 이름)
  before_v text, -- 문구용 값(이미 읽기 좋게)
  after_v text,
  urgent boolean not null, -- 바로 알림이면 true, 주간 요약에만이면 false
  target text not null check (target ~ '^/'),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index partner_change_unsent_idx on public.partner_change (actor_id, receiver_id) where sent_at is null;
create index partner_change_week_idx on public.partner_change (receiver_id, created_at);
alter table public.partner_change enable row level security;
revoke all on public.partner_change from anon, authenticated;

-- 기록(내부). 고친 사람 = auth.uid(), 받는 사람 = 같은 공간 상대. 연결(또는 해제 대기)일 때만
create or replace function public.log_partner_change(
  p_space uuid, p_topic text, p_ref uuid, p_field text, p_noun text,
  p_before text, p_after text, p_urgent boolean, p_target text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  other uuid;
begin
  if uid is null or p_before is not distinct from p_after then
    return;
  end if;
  if not exists (select 1 from public.couple_space where id = p_space and couple_state in ('connected', 'unlink_pending')) then
    return;
  end if;
  select id into other from public.app_user where space_id = p_space and status = 'active' and id <> uid limit 1;
  if other is null then
    return;
  end if;
  insert into public.partner_change (space_id, actor_id, receiver_id, topic, ref_id, field, noun, before_v, after_v, urgent, target)
    values (p_space, uid, other, p_topic, p_ref, p_field, coalesce(p_noun, ''), p_before, p_after, p_urgent, p_target);
end;
$$;
revoke all on function public.log_partner_change(uuid, text, uuid, text, text, text, text, boolean, text) from public, anon, authenticated;

-- 목표 기한 “2032년 3월”
create or replace function public.ym_label(d date) returns text language sql immutable set search_path = '' as $$
  select case when d is null then '없음' else extract(year from d)::int || '년 ' || extract(month from d)::int || '월' end;
$$;

-- 한 줄 설명(알림 본문, 활동 기록). [확인 필요] 문구는 14 표에 없는 것
-- 행 타입 하나만 받으면 PostgREST가 계산 열로 보므로 값으로 받음
create or replace function public.partner_change_line(p_topic text, p_field text, p_noun text, p_before text, p_after text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_topic = 'split' then p_noun || ' ' || coalesce(p_before, '0원') || ' → ' || coalesce(p_after, '0원')
    when p_topic = 'income' then coalesce(p_before, '0원') || ' → ' || coalesce(p_after, '0원')
    when p_topic in ('goal', 'goal_meta') and p_field = 'deleted' then '목표를 지웠어요' -- [확인 필요]
    when p_topic in ('goal', 'goal_meta') and p_field = 'restored' then '목표를 되살렸어요' -- [확인 필요]
    when p_topic = 'goal_meta' and p_field = 'added' then '목표를 추가했어요' -- [확인 필요]
    when p_topic = 'goal_meta' and p_field = 'order' then '목표 순서를 바꿨어요' -- [확인 필요]
    when p_topic in ('goal', 'goal_meta') then
      case p_field when 'amount' then '목표 금액' when 'deadline' then '기한' when 'name' then '이름'
        when 'status' then '상태' when 'kind' then '형태' else p_field end
      || ' ' || coalesce(p_before, '없음') || ' → ' || coalesce(p_after, '없음')
    when p_topic = 'goal_move' then coalesce(p_after, '') -- “50만 원 넣었어요” [확인 필요]
    when p_topic = 'asset' and p_field = 'amount_hidden' then '개인 자산 금액이 바뀌었어요'
    when p_topic = 'asset' and p_field = 'amount' then p_noun || ' ' || p_before || ' → ' || p_after
    when p_topic = 'asset' and p_field = 'added' then p_noun || ' 추가' -- [확인 필요]
    when p_topic = 'asset' and p_field = 'deleted' then p_noun || ' 삭제' -- [확인 필요]
    when p_topic = 'asset' and p_field = 'restored' then p_noun || ' 되살림' -- [확인 필요]
    when p_topic = 'care' and p_field = 'added' then p_noun || ' 추가' -- [확인 필요]
    when p_topic = 'care' then p_noun || ' 메모' -- [확인 필요]
    when p_topic = 'cycle_day' then '체크리스트 만드는 날 ' || p_before || ' → ' || p_after -- [확인 필요]
    else p_noun
  end;
$$;
revoke all on function public.partner_change_line(text, text, text, text, text) from public, anon, authenticated;

-- 하나일 때 제목(14 표). 여럿이면 “예빈님이 3가지를 바꿨어요” [확인 필요]
create or replace function public.partner_change_title(p_topic text, p_noun text, who text)
returns text
language sql
immutable
set search_path = ''
as $$
  select who || '님이 ' || case
    when p_topic = 'split' then '분배표를 바꿨어요'
    when p_topic = 'income' then '월급을 바꿨어요' -- [확인 필요]
    when p_topic in ('goal', 'goal_meta', 'goal_move') then p_noun || ' 목표를 바꿨어요'
    when p_topic = 'asset' then '우리 자산을 바꿨어요'
    when p_topic = 'care' then '챙길 날을 바꿨어요' -- [확인 필요]
    when p_topic = 'cycle_day' then '체크리스트 만드는 날을 바꿨어요'
    else '바꿨어요' end;
$$;
revoke all on function public.partner_change_title(text, text, text) from public, anon, authenticated;

-- 묶어 보내기: 첫 변경부터 10분이 지난 (고친 사람, 받는 사람) 묶음마다. 같은 항목은 처음 전 값 → 마지막 후 값
create or replace function public.flush_partner_changes(p_now timestamptz default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
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
        who || '님이 ' || array_length(urgent, 1) || '가지를 바꿨어요', -- [확인 필요]
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
        who || '님이 ' || array_length(quiet, 1) || '가지를 바꿨어요',
        left(public.partner_change_line(quiet[1].topic, quiet[1].field, quiet[1].noun, quiet[1].before_v, quiet[1].after_v) || ' 외 ' || (array_length(quiet, 1) - 1) || '개', 200),
        quiet[1].target, null, g.actor_id, 'pc:' || g.first_id || ':week');
      cnt := cnt + 1;
    end if;
  end loop;
  return cnt;
end;
$$;
revoke all on function public.flush_partner_changes(timestamptz) from public, anon, authenticated;

-- 월요일 오전 9시: 지난주(지난 월요일 ~ 어제) 상대가 바꾼 것 개수(같은 항목은 하나, 되돌린 것은 빼고)
create or replace function public.send_weekly_summary(p_today date default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  today date := coalesce(p_today, public.kst_today());
  r record;
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
    perform public.notify(r.receiver_id, r.space_id, 'weekly_summary',
      '이번 주 ' || coalesce((select nickname from public.app_user where id = r.actor_id), '') || '님이 바꾼 게 ' || r.n || '개 있어요',
      null, '/notifications', null, r.actor_id, 'weekly:' || r.receiver_id || ':' || today);
    cnt := cnt + 1;
  end loop;
  return cnt;
end;
$$;
revoke all on function public.send_weekly_summary(date) from public, anon, authenticated;

-- ── 기록하는 곳 ──────────────────────────────────────────────────────────────
-- 우리 목표(내 목표는 남기지 않음). 달성·사용으로 바뀐 상태는 빼고
create or replace function public.goal_partner_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t text;
begin
  if coalesce(new.owner_user_id, old.owner_user_id) is not null then
    return null;
  end if;
  t := '/goals/' || new.id;
  if tg_op = 'INSERT' then
    perform public.log_partner_change(new.space_id, 'goal_meta', new.id, 'added', new.name, null, '1', false, t);
    return null;
  end if;
  if old.deleted_at is null and new.deleted_at is not null then
    perform public.log_partner_change(new.space_id, 'goal', new.id, 'deleted', new.name, null, '1', true, '/goals');
    return null;
  end if;
  if old.deleted_at is not null and new.deleted_at is null then
    perform public.log_partner_change(new.space_id, 'goal_meta', new.id, 'restored', new.name, null, '1', false, t);
    return null;
  end if;
  if new.target_amount is distinct from old.target_amount then
    perform public.log_partner_change(new.space_id, 'goal', new.id, 'amount', new.name,
      case when old.target_amount is not null then public.read_won(old.target_amount) end,
      case when new.target_amount is not null then public.read_won(new.target_amount) end, true, t);
  end if;
  if new.deadline is distinct from old.deadline then
    perform public.log_partner_change(new.space_id, 'goal', new.id, 'deadline', new.name,
      public.ym_label(old.deadline), public.ym_label(new.deadline), true, t);
  end if;
  if new.name is distinct from old.name then
    perform public.log_partner_change(new.space_id, 'goal_meta', new.id, 'name', new.name, old.name, new.name, false, t);
  end if;
  if new.priority is distinct from old.priority then
    -- 순서는 여러 목표가 한 번에 바뀌므로 공간에 하나로 묶음
    perform public.log_partner_change(new.space_id, 'goal_meta', null, 'order', '', null, '1', false, '/goals');
  end if;
  if new.kind is distinct from old.kind then
    perform public.log_partner_change(new.space_id, 'goal_meta', new.id, 'kind', new.name,
      case old.kind when 'once' then '한 번' when 'yearly' then '매년' else '매달' end,
      case new.kind when 'once' then '한 번' when 'yearly' then '매년' else '매달' end, false, t); -- [확인 필요]
  end if;
  if new.status is distinct from old.status
     and old.status in ('active', 'delayed', 'paused') and new.status in ('active', 'delayed', 'paused')
     and (old.status = 'paused') <> (new.status = 'paused') then
    perform public.log_partner_change(new.space_id, 'goal_meta', new.id, 'status', new.name,
      case when old.status = 'paused' then '보류' else '진행 중' end,
      case when new.status = 'paused' then '보류' else '진행 중' end, false, t); -- [확인 필요]
  end if;
  return null;
end;
$$;
revoke all on function public.goal_partner_change() from public, anon, authenticated;
create trigger goal_partner_change after insert or update on public.goal
  for each row execute function public.goal_partner_change();

-- 우리 목표 넣기·빼기·꺼내 쓰기(바로 알림). 되돌리기(deleted_at)는 같은 항목 빈 값으로 → 알리지 않음
create or replace function public.goal_move_partner_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.goal;
  v text;
begin
  select * into g from public.goal where id = new.goal_id;
  if g.owner_user_id is not null then
    return null;
  end if;
  v := public.read_won(new.amount) || ' ' || case new.kind when 'in' then '넣었어요' when 'out' then '뺐어요' else '꺼내 썼어요' end;
  if tg_op = 'INSERT' and new.deleted_at is null then
    perform public.log_partner_change(new.space_id, 'goal_move', new.id, 'move', g.name, '', v, true, '/goals/' || g.id);
  elsif tg_op = 'UPDATE' and old.deleted_at is null and new.deleted_at is not null then
    perform public.log_partner_change(new.space_id, 'goal_move', new.id, 'move', g.name, v, '', true, '/goals/' || g.id);
  end if;
  return null;
end;
$$;
revoke all on function public.goal_move_partner_change() from public, anon, authenticated;
create trigger goal_move_partner_change after insert or update of deleted_at on public.goal_move
  for each row execute function public.goal_move_partner_change();

-- 자산·부채(주간 요약에만). 비공개 개인 항목은 남기지 않고, 합계만 보여 주는 개인 항목은 이름·금액 없이
create or replace function public.asset_partner_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  hidden boolean := new.owner = 'person' and new.visibility = 'sum';
  noun text := case when new.owner = 'person' and new.visibility = 'sum' then '개인 자산' else new.name end;
begin
  if new.owner = 'person' and new.visibility = 'private' then
    return null;
  end if;
  if tg_op = 'INSERT' then
    perform public.log_partner_change(new.space_id, 'asset', new.id, 'added', noun, null, '1', false, '/assets/' || new.id);
  elsif old.deleted_at is null and new.deleted_at is not null then
    perform public.log_partner_change(new.space_id, 'asset', new.id, 'deleted', noun, null, '1', false, '/assets');
  elsif old.deleted_at is not null and new.deleted_at is null then
    perform public.log_partner_change(new.space_id, 'asset', new.id, 'restored', noun, null, '1', false, '/assets/' || new.id);
  elsif new.amount is distinct from old.amount then
    if hidden then
      -- 합계만 보여 주는 개인 항목: 문구에는 금액 없이(비교에만 값을 씀)
      perform public.log_partner_change(new.space_id, 'asset', new.id, 'amount_hidden', noun,
        old.amount::text, new.amount::text, false, '/assets');
    else
      perform public.log_partner_change(new.space_id, 'asset', new.id, 'amount', noun,
        public.read_won(old.amount), public.read_won(new.amount), false, '/assets/' || new.id);
    end if;
  end if;
  return null;
end;
$$;
revoke all on function public.asset_partner_change() from public, anon, authenticated;
create trigger asset_partner_change after insert or update on public.asset
  for each row execute function public.asset_partner_change();

-- 챙길 날 추가·메모(주간 요약에만). 남은 서프라이즈는 남기지 않음
create or replace function public.care_partner_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.secret or new.auto is not null then
    return null;
  end if;
  if tg_op = 'INSERT' then
    perform public.log_partner_change(new.space_id, 'care', new.id, 'added', new.name, null, '1', false, '/calendar/day/' || new.id);
  elsif new.memo is distinct from old.memo and new.deleted_at is null then
    perform public.log_partner_change(new.space_id, 'care', new.id, 'memo', new.name, old.memo, new.memo, false, '/calendar/day/' || new.id);
  end if;
  return null;
end;
$$;
revoke all on function public.care_partner_change() from public, anon, authenticated;
create trigger care_partner_change after insert or update of memo on public.care_day
  for each row execute function public.care_partner_change();

-- 월급 금액(바로 알림)
create or replace function public.income_partner_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.monthly_income is distinct from old.monthly_income and new.id = auth.uid() then
    perform public.log_partner_change(new.space_id, 'income', new.id, 'income', coalesce(new.nickname, ''),
      case when old.monthly_income is not null then public.read_won(old.monthly_income) end,
      case when new.monthly_income is not null then public.read_won(new.monthly_income) end, true, '/settings/me/salary');
  end if;
  return null;
end;
$$;
revoke all on function public.income_partner_change() from public, anon, authenticated;
create trigger income_partner_change after update of monthly_income on public.app_user
  for each row execute function public.income_partner_change();

-- 분배표: 저장 전 줄과 저장 뒤 줄을 줄마다(종류·목표·사람·이름) 비교. 처음 만들 때는 남기지 않음
create or replace function public.log_split_changes(p_split uuid, p_old jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  sp public.salary_split;
  r record;
begin
  select * into sp from public.salary_split where id = p_split;
  for r in
    with o as (
      select (x->>'kind')::public.split_line_kind as kind, (x->>'goal_id')::uuid as goal_id, (x->>'user_id')::uuid as user_id,
        x->>'name' as name, sum((x->>'amount')::bigint) as amount
      from jsonb_array_elements(coalesce(p_old, '[]'::jsonb)) x
      group by 1, 2, 3, 4
    ),
    n as (
      select kind, goal_id, user_id, name, sum(amount) as amount
      from public.split_line where split_id = p_split group by 1, 2, 3, 4
    )
    select coalesce(n.kind, o.kind) as kind, coalesce(n.goal_id, o.goal_id) as goal_id,
      coalesce(n.user_id, o.user_id) as user_id, coalesce(n.name, o.name) as name,
      o.amount as before_amount, n.amount as after_amount
    from o full join n
      on n.kind = o.kind and n.goal_id is not distinct from o.goal_id
      and n.user_id is not distinct from o.user_id and n.name is not distinct from o.name
  loop
    continue when coalesce(r.before_amount, 0) = coalesce(r.after_amount, 0);
    perform public.log_partner_change(sp.space_id, 'split', p_split,
      r.kind || ':' || coalesce(r.goal_id::text, '') || ':' || coalesce(r.user_id::text, '') || ':' || coalesce(r.name, ''),
      public.pay_line_noun(r.kind, r.goal_id, r.name)
        || case when r.kind = 'allowance' and r.user_id is not null and sp.owner_user_id is null
             then '(' || coalesce((select nickname from public.app_user where id = r.user_id), '') || ')' else '' end,
      public.read_won(coalesce(r.before_amount, 0)), public.read_won(coalesce(r.after_amount, 0)), true, '/salary/split');
  end loop;
end;
$$;
revoke all on function public.log_split_changes(uuid, jsonb) from public, anon, authenticated;

create or replace function public.save_split(p_lines jsonb, p_owner uuid default null)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
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

  select id into split from public.salary_split
    where space_id = sid and owner_user_id is not distinct from p_owner;
  if split is null then
    insert into public.salary_split (space_id, owner_user_id, updated_by)
      values (sid, p_owner, uid) returning id into split;
  else
    select jsonb_agg(jsonb_build_object('kind', kind, 'goal_id', goal_id, 'user_id', user_id, 'name', name, 'amount', amount))
      into old_lines from public.split_line where split_id = split;
    update public.salary_split set updated_by = uid, updated_at = now(), version = version + 1
      where id = split;
    delete from public.split_line where split_id = split;
  end if;

  for l in select * from jsonb_array_elements(p_lines) loop
    k := (l->>'kind')::public.split_line_kind;
    if k = 'saving' and not exists (
        select 1 from public.goal g
        where g.id = (l->>'goal_id')::uuid and g.space_id = sid and g.deleted_at is null) then
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
    insert into public.split_line (split_id, space_id, kind, goal_id, user_id, name, amount, sort)
    values (
      split, sid, k,
      case when k = 'saving' then (l->>'goal_id')::uuid end,
      case when k = 'allowance' then coalesce((l->>'user_id')::uuid, p_owner, uid) end,
      case when k = 'custom' then btrim(l->>'name') end,
      (l->>'amount')::bigint,
      i
    );
    i := i + 1;
  end loop;
  if old_lines is not null then
    perform public.log_split_changes(split, old_lines);
  end if;
  perform public.sync_checklist(split);
  return split;
end;
$$;

-- 체크리스트 만드는 날: 바로 알림 대신 주간 요약(08 4장 ‘주간 요약에 더함’)
create or replace function public.set_joint_cycle_day(p_day smallint)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  sid uuid := (select space_id from public.app_user where id = auth.uid());
  sp public.couple_space;
  today date := public.kst_today();
  nxt date;
begin
  select * into sp from public.couple_space where id = sid for update;
  if sp.id is null or sp.salary_mode <> 'joint' then
    raise exception 'not_joint' using errcode = '22023';
  end if;
  if sp.couple_state = 'unlink_pending' then
    raise exception 'unlink_pending' using errcode = '42501';
  end if;
  if p_day is null or p_day not in (
    select case when u.payday_last then 31 else u.payday end from public.app_user u where u.space_id = sid and u.status = 'active'
  ) then
    raise exception 'bad_day' using errcode = '22023';
  end if;
  update public.couple_space set joint_cycle_day = p_day where id = sid;
  -- 이번 사이클 끝 = 새 기준일 전날(오늘 뒤 처음 오는 새 기준일)
  nxt := public.cycle_date(p_day, extract(year from today)::int, extract(month from today)::int);
  if nxt <= today then
    nxt := public.cycle_date(p_day, extract(year from today + interval '1 month')::int, extract(month from today + interval '1 month')::int);
  end if;
  update public.pay_checklist set cycle_end = greatest(nxt - 1, cycle_start)
    where space_id = sid and owner_user_id is null and state <> 'closed' and cycle_end >= today;
  perform public.log_partner_change(sid, 'cycle_day', sid, 'cycle_day', '',
    case when sp.joint_cycle_day is null then '자동' when sp.joint_cycle_day = 31 then '말일' else sp.joint_cycle_day || '일' end,
    case when p_day = 31 then '말일' else p_day || '일' end, false, '/settings/me/plan-day');
end;
$$;

-- 알림 묶음: 바로 알림은 partner_change, 활동 기록은 silent
alter table public.notification drop column topic;
alter table public.notification add column topic text generated always as (
  case
    when kind in ('payday', 'review_due', 'first_goal', 'plan_ready', 'close_start', 'close_remind') then 'plan'
    when kind in ('behalf_checked', 'partner_change', 'salary_mode', 'cycle_day', 'weekly_summary') then 'partner_change'
    when kind in ('partner_done', 'partner_activity') then 'silent'
    when kind in ('maturity', 'jeonse_end') then 'money'
    when kind = 'goal_achieved' then 'goal'
    when kind in ('partner_joined', 'invite_remind', 'invite_expired') then 'invite'
    when kind = 'care_day' then 'care_' || split_part(dedupe, ':', 4)
    when kind like 'proposal\_%' then 'proposal'
    else 'other'
  end
) stored;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('flush-partner-changes', '* * * * *', 'select public.flush_partner_changes()');
    perform cron.schedule('send-weekly-summary', '0 0 * * 1', 'select public.send_weekly_summary()');
  end if;
end;
$$;
