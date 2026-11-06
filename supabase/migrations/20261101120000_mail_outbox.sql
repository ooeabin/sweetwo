-- 알림 메일(14 ‘규칙’, ‘배우자 변경 주간 요약 메일’). 메일은 DB가 보낼 메일을 mail_outbox에 쌓고,
-- Edge Function send-mail(supabase/functions/send-mail)이 꺼내 Amazon SES로 보냄. 비밀 값(AWS 키)은 함수 비밀 값에만.
--   지금 보내는 메일: 배우자 변경 주간 요약(월요일 오전 9시, 메일 상한 밖, S-14 ‘배우자가 바꾼 값’ 이메일 토글로 따로 끔)
--   상한: 메일만 계정마다 월 6회(capped = true인 것만 셈, 넘으면 쌓지 않음. 센터 기록은 그대로)
--   보내는 사람: 알림 이메일(app_user.notify_email). 받는 방법 이메일을 끄면 보내지 않음
--   깨우기: 1분마다 보낼 메일이 있으면 pg_net으로 함수를 부름(Vault 비밀 값 mail_function_url, mail_cron_secret이 있을 때만)

create table public.mail_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  to_email text not null check (to_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  kind text not null check (kind ~ '^[a-z_]{2,40}$'),
  subject text not null check (char_length(subject) between 1 and 200),
  body_text text not null,
  body_html text not null,
  capped boolean not null, -- 월 6회 상한에 세는 메일
  dedupe text not null unique,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  attempts smallint not null default 0,
  sent_at timestamptz,
  message_id text,
  last_error text
);
create index mail_outbox_due_idx on public.mail_outbox (created_at) where sent_at is null;
alter table public.mail_outbox enable row level security;
revoke all on public.mail_outbox from anon, authenticated;

-- HTML 글자 바꾸기
create or replace function public.html_esc(t text) returns text language sql immutable set search_path = '' as $$
  select replace(replace(replace(replace(coalesce(t, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;');
$$;

-- 메일 쌓기(내부). 알림 이메일이 있고, 받는 방법 이메일과 그 묶음 이메일이 켜져 있고, 상한 안일 때만. 쌓았으면 true
create or replace function public.enqueue_mail(
  p_user uuid, p_kind text, p_topic text, p_subject text, p_text text, p_html text, p_capped boolean, p_dedupe text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  u public.app_user;
  prefs jsonb;
begin
  select * into u from public.app_user where id = p_user and status = 'active';
  if u.id is null or u.notify_email is null or btrim(u.notify_email) = '' then
    return false;
  end if;
  prefs := coalesce(u.noti_prefs, '{}'::jsonb);
  if (prefs->>'email') = 'false' or (p_topic is not null and (prefs #>> array['topics', p_topic, 'email']) = 'false') then
    return false;
  end if;
  if p_capped and (
    select count(*) from public.mail_outbox m
    where m.user_id = p_user and m.capped
      and (m.created_at at time zone 'Asia/Seoul') >= date_trunc('month', now() at time zone 'Asia/Seoul')
  ) >= 6 then
    return false;
  end if;
  insert into public.mail_outbox (user_id, to_email, kind, subject, body_text, body_html, capped, dedupe)
    values (p_user, btrim(u.notify_email), p_kind, p_subject, p_text, p_html, p_capped, p_dedupe)
    on conflict (dedupe) do nothing;
  return found;
end;
$$;
revoke all on function public.enqueue_mail(uuid, text, text, text, text, text, boolean, text) from public, anon, authenticated;

-- 보낼 메일 꺼내기(함수 전용, service_role). 5분 넘게 붙잡혀 있던 것도 다시, 3번 실패하면 그만
create or replace function public.claim_mail(p_limit integer default 10)
returns setof public.mail_outbox
language sql
volatile
security definer
set search_path = ''
as $$
  update public.mail_outbox m set claimed_at = now(), attempts = m.attempts + 1
  where m.id in (
    select x.id from public.mail_outbox x
    where x.sent_at is null and x.attempts < 3 and (x.claimed_at is null or x.claimed_at < now() - interval '5 minutes')
    order by x.created_at
    limit least(greatest(coalesce(p_limit, 10), 1), 50)
    for update skip locked
  )
  returning m.*;
$$;
revoke all on function public.claim_mail(integer) from public, anon, authenticated;
grant execute on function public.claim_mail(integer) to service_role;

-- 보낸 결과(함수 전용). 오류면 다음 깨울 때 다시(3번까지)
create or replace function public.finish_mail(p_id uuid, p_message_id text default null, p_error text default null)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.mail_outbox set
    sent_at = case when p_error is null then now() end,
    message_id = p_message_id,
    last_error = left(p_error, 500),
    claimed_at = case when p_error is null then claimed_at end
  where id = p_id;
$$;
revoke all on function public.finish_mail(uuid, text, text) from public, anon, authenticated;
grant execute on function public.finish_mail(uuid, text, text) to service_role;

-- 주간 요약 메일 본문(14 ‘배우자 변경 주간 요약 메일’): 바뀐 것(전 → 후), 이번 달 월급 진행, 남은 할 일, 앱에서 보기, 알림 설정
create or replace function public.weekly_mail_body(p_receiver uuid, p_actor uuid, p_today date)
returns table (body_text text, body_html text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me public.app_user;
  who text := coalesce((select nickname from public.app_user where id = p_actor), '');
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

  -- 이번 달 월급: 지금 사이클 체크리스트마다 “10월 월급(찬우) 5개 중 2개 했어요” [확인 필요]
  select array_agg(
      c.label || case when c.owner_user_id is not null
        then '(' || coalesce((select nickname from public.app_user where id = c.owner_user_id), '') || ')' else '' end
      || ' ' || (select count(*) from public.pay_check_line l where l.checklist_id = c.id) || '개 중 '
      || (select count(*) from public.pay_check_line l where l.checklist_id = c.id and l.state = 'checked') || '개 했어요'
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
    who || '님이 바꾼 것',
    array_to_string(array(select '- ' || x from unnest(lines) x), E'\n'),
    case when checks is not null then E'\n이번 달 월급\n' || array_to_string(array(select '- ' || x from unnest(checks) x), E'\n') end,
    case when todo is not null then E'\n남은 할 일\n- ' || todo end,
    E'\n앱에서 보기: ' || open_url,
    '알림 설정: ' || settings_url);
  body_html := concat(
    '<p><b>', public.html_esc(who), '님이 바꾼 것</b></p><ul>',
    (select string_agg('<li>' || public.html_esc(x) || '</li>', '') from unnest(lines) x),
    '</ul>',
    case when checks is not null then '<p><b>이번 달 월급</b></p><ul>'
      || (select string_agg('<li>' || public.html_esc(x) || '</li>', '') from unnest(checks) x) || '</ul>' end,
    case when todo is not null then '<p><b>남은 할 일</b></p><ul><li>' || public.html_esc(todo) || '</li></ul>' end,
    '<p><a href="', open_url, '">앱에서 보기</a></p>',
    '<p><a href="', settings_url, '">알림 설정</a></p>');
  return next;
end;
$$;
revoke all on function public.weekly_mail_body(uuid, uuid, date) from public, anon, authenticated;

-- 주간 요약: 알림 + 메일(상한 밖)
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
    title := '이번 주 ' || coalesce((select nickname from public.app_user where id = r.actor_id), '') || '님이 바꾼 게 ' || r.n || '개 있어요';
    perform public.notify(r.receiver_id, r.space_id, 'weekly_summary', title,
      null, '/notifications', null, r.actor_id, 'weekly:' || r.receiver_id || ':' || today);
    select * into b from public.weekly_mail_body(r.receiver_id, r.actor_id, today);
    perform public.enqueue_mail(r.receiver_id, 'weekly_summary', 'partner_change', title, b.body_text, b.body_html,
      false, 'weekly:' || r.receiver_id || ':' || today);
    cnt := cnt + 1;
  end loop;
  return cnt;
end;
$$;
revoke all on function public.send_weekly_summary(date) from public, anon, authenticated;

-- 깨우기: 보낼 메일이 있고 Vault에 함수 주소·비밀 값이 있으면 pg_net으로 함수 호출(없으면 아무것도 안 함)
create or replace function public.kick_mail()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  fn_url text;
  secret text;
begin
  if not exists (select 1 from public.mail_outbox where sent_at is null and attempts < 3) then
    return false;
  end if;
  if to_regclass('vault.decrypted_secrets') is null or to_regnamespace('net') is null then
    return false;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into fn_url using 'mail_function_url';
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into secret using 'mail_cron_secret';
  if fn_url is null or secret is null then
    return false;
  end if;
  execute 'select net.http_post(url := $1, headers := $2, body := $3)'
    using fn_url, jsonb_build_object('Content-Type', 'application/json', 'x-mail-secret', secret), '{}'::jsonb;
  return true;
end;
$$;
revoke all on function public.kick_mail() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
  end if;
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('kick-mail', '* * * * *', 'select public.kick_mail()');
  end if;
end;
$$;
