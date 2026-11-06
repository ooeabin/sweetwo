-- AD-10 공지 메일(27 AD-10·11 1번: MVP는 앱 내 공지 + 약관 개정 고지 이메일(법적 고지) + 1등급 장애 고지 이메일(서비스 메일, 메일 상한 밖)).
-- 약관 개정(terms)·장애(incident) 공지만 ‘이메일로도 보내기’를 켤 수 있음. 승인돼 게시되고 노출 시작 시각이 되면
-- send_notice_mails()(5분마다)가 사용 중인 모든 사용자의 알림 이메일로 한 번씩 쌓음(상한 밖, 알림 설정과 상관없음).
alter table public.notice add column email boolean not null default false;
alter table public.notice add column mailed_at timestamptz;
alter table public.notice add constraint notice_email_kind check (not email or kind in ('terms', 'incident'));

create or replace function public.admin_set_notice_email(p_id uuid, p_email boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['ops']::public.admin_role[]);
begin
  update public.notice set email = p_email where id = p_id and status in ('draft', 'requested');
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  perform public.admin_log(a, 'edit', 'AD-10', p_id::text, case when p_email then '이메일로도 보내기' else '이메일 끔' end);
end;
$$;
revoke execute on function public.admin_set_notice_email(uuid, boolean) from public, anon;
grant execute on function public.admin_set_notice_email(uuid, boolean) to authenticated;

create or replace function public.send_notice_mails(p_now timestamptz default now())
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  n record;
  cnt integer := 0;
  added integer;
begin
  for n in
    select * from public.notice
    where email and status = 'published' and mailed_at is null and starts_at <= p_now and ends_at > p_now
    order by starts_at
  loop
    insert into public.mail_outbox (user_id, to_email, kind, subject, body_text, body_html, capped, dedupe)
    select u.id, btrim(u.notify_email), 'notice_' || n.kind, n.title,
      n.body || E'\n\nsweeTwo',
      '<h1 style="font-size:18px">' || public.html_esc(n.title) || '</h1><p>'
        || replace(public.html_esc(n.body), E'\n', '<br>') || '</p><p>sweeTwo</p>',
      false, 'notice:' || n.id || ':' || u.id
    from public.app_user u
    where u.status = 'active' and nullif(btrim(coalesce(u.notify_email, '')), '') is not null
    on conflict (dedupe) do nothing;
    get diagnostics added = row_count;
    cnt := cnt + added;
    update public.notice set mailed_at = p_now where id = n.id;
  end loop;
  return cnt;
end;
$$;
revoke all on function public.send_notice_mails(timestamptz) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('send-notice-mails', '*/5 * * * *', 'select public.send_notice_mails()');
  end if;
end;
$$;
