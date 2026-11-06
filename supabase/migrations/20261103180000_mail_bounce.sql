-- 알림 메일 반송·수신 거부(14 ‘알림 메일 반송’, DEV_GUIDE 알림): SES 이벤트 → SNS → Edge Function mail-events → note_mail_event.
-- 영구 반송은 주소마다 셈. 같은 주소 2번 반송이거나 수신 거부 신고면 그 주소로 더 보내지 않음(mail_outbox에 넣지 않음).
-- 반송될 때마다 그 주소를 알림 이메일로 쓰는 사람에게 인앱 알림 “알림 메일이 전달되지 않았어요”(끌 수 없음) + 홈 띠.
create table public.mail_suppress (
  email text primary key check (email = lower(btrim(email))),
  bounces integer not null default 0,
  complaint boolean not null default false,
  last_at timestamptz not null default now()
);
alter table public.mail_suppress enable row level security;
revoke all on public.mail_suppress from anon, authenticated;

create or replace function public.mail_blocked(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.mail_suppress s
    where s.email = lower(btrim(p_email)) and (s.bounces >= 2 or s.complaint)
  );
$$;
revoke execute on function public.mail_blocked(text) from public, anon, authenticated;

-- 막힌 주소로는 쌓지 않음
create or replace function public.mail_outbox_skip_blocked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.mail_blocked(new.to_email) then
    return null;
  end if;
  return new;
end;
$$;
create trigger mail_outbox_skip_blocked before insert on public.mail_outbox
  for each row execute function public.mail_outbox_skip_blocked();

-- 함수 전용(service_role): kind = 'bounce'(영구 반송) / 'complaint'(수신 거부 신고)
create or replace function public.note_mail_event(p_email text, p_kind text)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  e text := lower(btrim(coalesce(p_email, '')));
  n integer := 0;
  u record;
begin
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or p_kind not in ('bounce', 'complaint') then
    return 0;
  end if;
  insert into public.mail_suppress (email, bounces, complaint, last_at)
    values (e, case when p_kind = 'bounce' then 1 else 0 end, p_kind = 'complaint', now())
    on conflict (email) do update set
      bounces = public.mail_suppress.bounces + case when p_kind = 'bounce' then 1 else 0 end,
      complaint = public.mail_suppress.complaint or p_kind = 'complaint',
      last_at = now();
  if p_kind = 'bounce' then
    for u in select a.id, a.space_id from public.app_user a where a.notify_email = e and a.status = 'active' loop
      perform public.notify(u.id, u.space_id, 'mail_bounced', '알림 메일이 전달되지 않았어요',
        '알림 이메일 주소를 확인해 주세요', '/settings/notifications', 'envelope-simple', null,
        'bounce:' || e || ':' || to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM-DD'));
      -- 반송된 주소로 이 알림을 메일로 다시 보내지 않음(mail_missed_notifications가 건너뜀)
      update public.notification set mailed_at = now()
        where user_id = u.id and kind = 'mail_bounced' and mailed_at is null;
      n := n + 1;
    end loop;
  end if;
  return n;
end;
$$;
revoke execute on function public.note_mail_event(text, text) from public, anon, authenticated;
grant execute on function public.note_mail_event(text, text) to service_role;

-- 홈 띠: 내 알림 이메일이 반송됐는지(바꾸면 사라짐)
create or replace function public.my_mail_bounced()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.app_user a join public.mail_suppress s on s.email = a.notify_email
    where a.id = auth.uid() and s.bounces > 0
  );
$$;
revoke execute on function public.my_mail_bounced() from public, anon;
grant execute on function public.my_mail_bounced() to authenticated;
