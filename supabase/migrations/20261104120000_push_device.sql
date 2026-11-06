-- 모바일 푸시(14 ‘센터와 푸시·메일’, DEV_GUIDE 알림): 알림 행이 생기면 Edge Function send-push가 그 사람의 기기로 APNs·FCM 발송.
-- - push_device: 기기 토큰(로그인한 사람마다, 같은 토큰은 마지막에 등록한 사람 것). 앱은 함수로만 등록·해제
-- - claim_push(): 보낼 알림(30분 안, 인앱만(silent)·끈 묶음 빼고, 방해 금지 시간은 끝날 때까지 미룸) + 기기 토큰. 꺼낼 때 pushed_at
-- - kick_push(): 보낼 것이 있을 때만 pg_net으로 함수 호출(1분마다, 메일 kick_mail과 같은 방식, Vault push_function_url·push_cron_secret)
-- - 메일로 대신(mail_missed_notifications): 푸시 받을 기기가 있으면 접속 신호가 없어도 메일로 대신 보내지 않음(보안·계정 메일은 그대로)
create table public.push_device (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  token text not null unique check (char_length(token) between 16 and 4096 and token ~ '^[A-Za-z0-9:_.-]+$'),
  app_version text check (app_version ~ '^\d+\.\d+\.\d+$'),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index push_device_user_idx on public.push_device (user_id);
alter table public.push_device enable row level security;
create policy push_device_select on public.push_device for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.push_device from anon, authenticated;

alter table public.notification add column pushed_at timestamptz;

create or replace function public.register_push_device(p_platform text, p_token text, p_app_version text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  insert into public.push_device (user_id, platform, token, app_version)
    values (auth.uid(), p_platform, p_token, nullif(p_app_version, ''))
    on conflict (token) do update set
      user_id = excluded.user_id, platform = excluded.platform,
      app_version = excluded.app_version, last_seen_at = now();
end;
$$;
revoke execute on function public.register_push_device(text, text, text) from public, anon;
grant execute on function public.register_push_device(text, text, text) to authenticated;

-- 로그아웃하면 이 기기 토큰을 지움(내 것만)
create or replace function public.unregister_push_device(p_token text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from public.push_device where token = p_token and user_id = auth.uid();
$$;
revoke execute on function public.unregister_push_device(text) from public, anon;
grant execute on function public.unregister_push_device(text) to authenticated;

-- 푸시를 보낼 알림인지(설정: 받는 방법 OS 알림 + 그 묶음, core pushAllowed와 같은 규칙. 방해 금지는 claim_push가 따로)
create or replace function public.push_wanted(p_prefs jsonb, p_topic text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_topic, '') <> 'silent'
    and coalesce(p_prefs->>'push', 'true') <> 'false'
    and (p_topic is null
      or coalesce(p_prefs #>> array['topics', p_topic, 'push'],
        case when p_topic in ('care_14', 'care_0') then 'false' else 'true' end) <> 'false');
$$;

-- 함수 전용: 보낼 알림 + 기기 토큰. 꺼내면서 pushed_at(한 번만 보냄)
create or replace function public.claim_push(p_limit integer default 100, p_now timestamptz default now())
returns table (notification_id uuid, title text, body text, target text, platform text, token text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  hour integer := extract(hour from p_now at time zone 'Asia/Seoul')::int;
  ids uuid[];
begin
  select array_agg(x.id) into ids from (
    select n.id
    from public.notification n
    join public.app_user u on u.id = n.user_id and u.status = 'active'
    where n.pushed_at is null and n.read_at is null
      and n.created_at > p_now - interval '12 hours'
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
  return query
    select n.id, coalesce(n.push_title, n.title), case when n.push_hidden then null else n.body end, n.target,
      d.platform, d.token
    from public.notification n
    join public.push_device d on d.user_id = n.user_id
    where n.id = any(ids);
end;
$$;
revoke all on function public.claim_push(integer, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_push(integer, timestamptz) to service_role;

-- 함수 전용: 더는 받을 수 없는 토큰(APNs 410, FCM UNREGISTERED) 지우기
create or replace function public.drop_push_tokens(p_tokens text[])
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  with d as (delete from public.push_device where token = any(p_tokens) returning 1)
  select count(*)::int from d;
$$;
revoke all on function public.drop_push_tokens(text[]) from public, anon, authenticated;
grant execute on function public.drop_push_tokens(text[]) to service_role;

create or replace function public.kick_push()
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
  if not exists (
    select 1 from public.notification n
    where n.pushed_at is null and n.read_at is null and n.created_at > now() - interval '12 hours'
      and exists (select 1 from public.push_device d where d.user_id = n.user_id)) then
    return false;
  end if;
  if to_regclass('vault.decrypted_secrets') is null or to_regnamespace('net') is null then
    return false;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into fn_url using 'push_function_url';
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into secret using 'push_cron_secret';
  if fn_url is null or secret is null then
    return false;
  end if;
  execute 'select net.http_post(url := $1, headers := $2, body := $3)'
    using fn_url, jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', secret), '{}'::jsonb;
  return true;
end;
$$;
revoke all on function public.kick_push() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('kick-push', '* * * * *', 'select public.kick_push()');
  end if;
end;
$$;

-- 메일로 대신: 푸시 받을 기기가 있으면 빼기(20261102180000과 같고 조건 한 줄만 더함)
create or replace function public.mail_missed_notifications(p_now timestamptz default now())
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
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
      and x.created_at > p_now - interval '12 hours'
      and coalesce(x.topic, '') <> 'silent' and x.kind <> 'weekly_summary'
      and (public.noti_always_mail(x.kind)
           or (x.created_at <= p_now - interval '10 minutes'
               and (u.app_seen_at is null or u.app_seen_at < x.created_at - interval '10 minutes')
               -- 푸시를 받을 휴대폰이 있으면 메일로 대신 보내지 않음(14 ‘메일로 대신’)
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
    perform public.enqueue_mail(n.user_id, n.kind, n.topic, coalesce(n.push_title, n.title), b.body_text, b.body_html,
      not (public.noti_always_mail(n.kind) or n.kind = 'review_due'), 'noti:' || n.id);
    update public.notification set mailed_at = p_now where id = n.id;
    cnt := cnt + 1;
  end loop;
  return cnt;
end;
$$;
revoke all on function public.mail_missed_notifications(timestamptz) from public, anon, authenticated;
