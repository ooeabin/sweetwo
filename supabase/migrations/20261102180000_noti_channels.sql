-- 알림 채널 빠진 것(14 규칙·알림 종류).
-- 1) 데스크톱 앱 접속 신호(app_user.app_seen_at, touch_app()): 앱이 켜져 있는 동안 5분마다.
-- 2) 메일로 대신: 푸시로 갈 알림인데 만들어진 뒤 10분 안에 데스크톱 접속 신호가 없으면(모바일 푸시는 아직 없음) 메일 한 통.
--    보안·계정·문의 알림(상한 밖)은 접속과 상관없이 바로 메일. 방해 금지 시간에는 미뤘다가 끝나면.
-- 3) 계정 삭제 접수·완료 메일(본인, 상한 밖).
alter table public.app_user add column if not exists app_seen_at timestamptz;
alter table public.notification add column if not exists mailed_at timestamptz;

create or replace function public.touch_app()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.app_user set app_seen_at = now() where id = auth.uid();
$$;
revoke execute on function public.touch_app() from public, anon;
grant execute on function public.touch_app() to authenticated;

-- 알림 한 통을 메일 본문으로(제목, 본문, 앱에서 보기, 알림 설정)
create or replace function public.noti_mail_body(p_title text, p_body text)
returns table (body_text text, body_html text)
language sql
immutable
set search_path = ''
as $$
  select
    concat_ws(E'\n', p_title, p_body, E'\n앱에서 보기: https://sweetwo.kr/n', '알림 설정: https://sweetwo.kr/n/settings'),
    concat('<p><b>', public.html_esc(p_title), '</b></p>',
      case when p_body is not null then '<p>' || public.html_esc(p_body) || '</p>' end,
      '<p><a href="https://sweetwo.kr/n">앱에서 보기</a></p>',
      '<p><a href="https://sweetwo.kr/n/settings">알림 설정</a></p>');
$$;
revoke all on function public.noti_mail_body(text, text) from public, anon, authenticated;

-- 상한 밖(보안·계정·문의) 알림 종류: 접속과 상관없이 메일
create or replace function public.noti_always_mail(p_kind text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_kind in ('unlink_requested', 'unlink_confirmed', 'partner_deleted', 'partner_restored',
                    'access_request', 'access_partner', 'inquiry_answered', 'new_device');
$$;

-- 10분마다: 메일로 대신 보낼 알림
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
               and (u.app_seen_at is null or u.app_seen_at < x.created_at - interval '10 minutes')))
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

-- 계정 삭제 접수 메일(상한 밖)
create or replace function public.deletion_mail()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  until_ date := (now() at time zone 'Asia/Seoul')::date + 30;
  t text := '계정 삭제 요청을 받았어요';
  body text := extract(month from until_)::int || '월 ' || extract(day from until_)::int || '일까지 다시 로그인하면 취소할 수 있어요';
  b record;
begin
  if new.status = 'deletion_requested' and old.status is distinct from 'deletion_requested'
     and new.notify_email is not null then
    select * into b from public.noti_mail_body(t, body);
    insert into public.mail_outbox (user_id, to_email, kind, subject, body_text, body_html, capped, dedupe)
      values (new.id, btrim(new.notify_email), 'deletion_requested', t, b.body_text, b.body_html, false,
              'deletion:' || new.id || ':' || extract(epoch from now())::bigint)
      on conflict (dedupe) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists deletion_mail on public.app_user;
create trigger deletion_mail after update of status on public.app_user
  for each row execute function public.deletion_mail();

-- 계정 삭제 완료 메일: 지우기 직전에 남김(user_id 없이, 계정이 지워져도 보냄)
create or replace function public.purge_deleted_accounts()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me public.app_user;
  u public.couple_unlink;
  b record;
begin
  for me in select * from public.app_user
            where status = 'deletion_requested' and deletion_requested_at < now() - interval '30 days' loop
    if me.notify_email is not null then
      select * into b from public.noti_mail_body('계정을 삭제했어요', '그동안 sweeTwo를 써 주셔서 고마워요');
      insert into public.mail_outbox (user_id, to_email, kind, subject, body_text, body_html, capped, dedupe)
        values (null, btrim(me.notify_email), 'deletion_done', '계정을 삭제했어요', b.body_text, b.body_html, false,
                'deleted:' || me.id)
        on conflict (dedupe) do nothing;
    end if;
    for u in select * from public.couple_unlink
             where requested_by = me.id or partner_id = me.id or reconnect_by = me.id loop
      delete from public.couple_space s where s.id = u.space_id and s.deleted_at is not null
        and not exists (select 1 from public.app_user m where m.space_id = s.id);
      delete from public.couple_unlink where id = u.id;
    end loop;
    if me.space_id is not null and not exists (
        select 1 from public.app_user m where m.space_id = me.space_id and m.id <> me.id) then
      update public.app_user set space_id = null where id = me.id;
      delete from public.couple_space where id = me.space_id;
    end if;
    delete from auth.users where id = me.id;
  end loop;
end;
$$;
revoke execute on function public.purge_deleted_accounts() from public, anon, authenticated;

-- 새 기기 로그인(15 A-08 4번, 14): 로그인 뒤 앱이 부름. 이 계정의 다른 세션이 있으면(다른 기기) 본인에게 알림 + 메일(상한 밖)
create or replace function public.note_login()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  cur text := nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'session_id';
  ua text;
begin
  if uid is null or cur is null then
    return false;
  end if;
  if not exists (select 1 from auth.sessions s where s.user_id = uid and s.id::text <> cur) then
    return false;
  end if;
  select s.user_agent into ua from auth.sessions s where s.id::text = cur;
  perform public.notify(uid, (select space_id from public.app_user where id = uid), 'new_device',
    '새 기기에서 로그인했어요', '본인이 아니면 바로 로그아웃해 주세요', '/settings/security', 'shield-warning', null,
    'login:' || cur);
  return true;
end;
$$;
revoke execute on function public.note_login() from public, anon;
grant execute on function public.note_login() to authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('mail-missed-notifications', '*/10 * * * *', 'select public.mail_missed_notifications()');
  end if;
end;
$$;
