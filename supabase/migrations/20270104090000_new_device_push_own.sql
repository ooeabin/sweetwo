-- 새 기기 로그인 푸시는 로그인한 그 기기(세션)의 토큰을 빼고 보낸다(2026-11-26 사용자 결정, 14 ‘새 기기 로그인’ 푸시(기존 기기)).
-- - push_device.session_id: 토큰을 등록한 세션(JWT session_id, note_login·noti_hidden_here와 같은 기준). 다른 세션에서 다시 등록하면 갱신.
--   세션 id가 없는 옛 토큰은 null로 두고 지금처럼 보낸다(다음 등록 때 채워짐).
-- - claim_push: new_device 알림(링크 ‘/new-device/{세션}’)은 그 세션 id의 토큰을 건너뛴다. 다른 알림 종류는 그대로.
--   20261204090000_v22_unlink_rank.sql의 claim_push와 같고 마지막 join 조건 한 줄만 더함.
-- - 로그아웃 토큰 정리(unregister_push_device), 받을 수 없는 토큰 지우기(drop_push_tokens)는 그대로(토큰 기준).

alter table public.push_device add column session_id text
  check (session_id is null or char_length(session_id) between 1 and 64);

create or replace function public.register_push_device(p_platform text, p_token text, p_app_version text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  sid text := nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'session_id', '');
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  insert into public.push_device (user_id, platform, token, app_version, session_id)
    values (auth.uid(), p_platform, p_token, nullif(p_app_version, ''), sid)
    on conflict (token) do update set
      user_id = excluded.user_id, platform = excluded.platform,
      app_version = excluded.app_version, session_id = excluded.session_id, last_seen_at = now();
end;
$$;
revoke execute on function public.register_push_device(text, text, text) from public, anon;
grant execute on function public.register_push_device(text, text, text) to authenticated;

create or replace function public.claim_push(p_limit integer default 100, p_now timestamptz default now())
returns table(notification_id uuid, title text, body text, target text, platform text, token text)
language plpgsql security definer set search_path = '' as $$
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
      -- v2.2 알림 종류 골라 켜기(P-11·S-14), 인앱만 종류
      and public.push_kind_on(u.push_kinds, n.kind)
      and not public.noti_inapp_only(n.kind)
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
    select n.id,
      case when public.noti_lock_generic(n.kind) then 'sweeTwo' else coalesce(n.push_title, n.title) end,
      case when public.noti_lock_generic(n.kind) then '확인할 알림이 있어요' -- [확인 필요] 6-4
           when n.push_hidden or public.noti_push_body_hidden(n.kind) then null else n.body end,
      n.target, d.platform, d.token
    from public.notification n
    join public.push_device d on d.user_id = n.user_id
    where n.id = any(ids)
      -- 새 기기 로그인: 로그인한 그 세션에서 등록한 토큰은 빼고(세션 없는 옛 토큰은 보냄)
      and not (n.kind = 'new_device' and d.session_id is not null
        and n.target = '/new-device/' || d.session_id);
end;
$$;
revoke all on function public.claim_push(integer, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_push(integer, timestamptz) to service_role;
