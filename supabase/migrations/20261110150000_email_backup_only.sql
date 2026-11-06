-- 이메일은 자동 예비로만(2026-11-04, 14 알림 ‘채널’). 설정에서 이메일 받는 방법·종류별 이메일 토글을 없앰.
-- - 메일은 끌 수 없는 꼭 필요한 것(상한 밖: 보안·계정·연결 해제·문의 답변·법정 고지)과
--   푸시를 받을 수 없는 사람의 월말 확인(review_due)만. 받는 방법 설정(noti_prefs.email, topics.*.email)은 보지 않음.
-- - 종류별 알림 메일(상한 안)과 배우자 변경 주간 요약 메일은 보내지 않음(주간 요약은 알림 센터·푸시로만).
-- - 반송 막힘(mail_suppress)은 mail_outbox 쪽 그대로.

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
begin
  -- 상한 안 메일(종류별 알림)과 주간 요약은 더 보내지 않음
  if p_capped or p_kind = 'weekly_summary' then
    return false;
  end if;
  select * into u from public.app_user where id = p_user and status = 'active';
  if u.id is null or u.notify_email is null or btrim(u.notify_email) = '' then
    return false;
  end if;
  insert into public.mail_outbox (user_id, to_email, kind, subject, body_text, body_html, capped, dedupe)
    values (p_user, btrim(u.notify_email), p_kind, p_subject, p_text, p_html, false, p_dedupe)
    on conflict (dedupe) do nothing;
  return found;
end;
$$;
revoke all on function public.enqueue_mail(uuid, text, text, text, text, text, boolean, text) from public, anon, authenticated;

-- 10분마다: 메일로 대신 보낼 알림. 상한 밖은 바로, 월말 확인은 푸시를 받을 곳이 없을 때만(휴대폰 푸시 기기 없음 +
-- 10분 넘게 데스크톱 접속 신호 없음). 그 밖의 종류는 메일로 대신 보내지 않음
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
      and coalesce(x.topic, '') <> 'silent'
      and (public.noti_always_mail(x.kind)
           or (x.kind = 'review_due'
               and x.created_at <= p_now - interval '10 minutes'
               and (u.app_seen_at is null or u.app_seen_at < x.created_at - interval '10 minutes')
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
      false, 'noti:' || n.id);
    update public.notification set mailed_at = p_now where id = n.id;
    cnt := cnt + 1;
  end loop;
  return cnt;
end;
$$;
revoke all on function public.mail_missed_notifications(timestamptz) from public, anon, authenticated;
