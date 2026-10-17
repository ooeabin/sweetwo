-- 문의(25 S-19a, 27 AD-06)와 관리자 열람 동의(S-19b, AD-04 L2). 09 데이터 항목 ‘문의’, ‘관리자 열람 요청’, 14 알림.
--
-- 문의: 번호는 서버가 발급(A-10001부터). 사용자는 내 문의와 그 대화만 봄. 보내기·덧붙이기는 함수로만.
--   자동 첨부(앱 버전·OS·부부 상태·동기화 상태·최근 오류 코드, 금액·메모 없음)는 사용자가 켰을 때만 attach에.
--   완료 뒤 7일 안에 덧붙이면 다시 열림. help@ 사본 메일은 메일 발송과 함께(notified_mail_at).
-- 열람 동의: 운영자 요청(어드민 단계에서 만듦) → 문의한 본인만 동의/거절. 동의하면 24시간, 배우자에게 열람 알림.
--   ‘지금 그만 보게 하기’ 또는 24시간 지나면 끝 + 본인 알림. 문의가 완료되면 답하지 않은 요청은 만료.

create type public.inquiry_category as enum ('account', 'couple', 'calc', 'sync', 'billing', 'privacy', 'etc');
create type public.inquiry_status as enum ('received', 'in_progress', 'waiting_user', 'done');

create sequence public.inquiry_no_seq start 10001;

create table public.inquiry (
  id uuid primary key default gen_random_uuid(),
  no text not null unique default ('A-' || nextval('public.inquiry_no_seq')),
  user_id uuid references auth.users (id) on delete set null,
  space_id uuid references public.couple_space (id) on delete set null,
  category public.inquiry_category not null,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  attach jsonb check (attach is null or (jsonb_typeof(attach) = 'object' and pg_column_size(attach) < 4000)),
  channel text not null default 'app' check (channel in ('app', 'email')),
  status public.inquiry_status not null default 'received',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  done_at timestamptz,
  mail_copied_at timestamptz
);
create index inquiry_user_idx on public.inquiry (user_id, created_at desc);
create index inquiry_status_idx on public.inquiry (status, created_at);

create table public.inquiry_message (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.inquiry (id) on delete cascade,
  author text not null check (author in ('user', 'admin')),
  admin_id uuid, -- 어드민 계정(어드민 단계)
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index inquiry_message_idx on public.inquiry_message (inquiry_id, created_at);

alter table public.inquiry enable row level security;
alter table public.inquiry_message enable row level security;
create policy inquiry_select on public.inquiry for select to authenticated using (user_id = (select auth.uid()));
create policy inquiry_message_select on public.inquiry_message for select to authenticated
  using (exists (select 1 from public.inquiry i where i.id = inquiry_id and i.user_id = (select auth.uid())));
revoke insert, update, delete on public.inquiry, public.inquiry_message from authenticated, anon;

-- 관리자 열람 요청(L2)
create table public.access_request (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.inquiry (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  admin_id uuid, -- 요청한 운영자(어드민 단계)
  reason text,
  scope text[] not null check (array_length(scope, 1) between 1 and 8),
  raw_amount boolean not null default false, -- 원값(화면 1개, 최고 관리자 승인 뒤)
  status text not null default 'requested' check (status in ('requested', 'approved', 'declined', 'expired', 'done')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  expires_at timestamptz,
  ended_at timestamptz,
  partner_notified_at timestamptz
);
create index access_request_user_idx on public.access_request (user_id, created_at desc);
alter table public.access_request enable row level security;
create policy access_request_select on public.access_request for select to authenticated
  using (user_id = (select auth.uid()));
revoke insert, update, delete on public.access_request from authenticated, anon;

-- S-19a 보내기. 돌려주는 값 = 문의 번호
create or replace function public.create_inquiry(p_category public.inquiry_category, p_body text, p_attach jsonb default null)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid uuid;
  n text;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  -- 금액·메모가 섞이지 않게 정해진 키만
  if p_attach is not null and exists (
      select 1 from jsonb_object_keys(p_attach) k
      where k not in ('app_version', 'os', 'platform', 'couple_state', 'sync', 'errors')) then
    raise exception 'bad_attach' using errcode = '22023';
  end if;
  select space_id into sid from public.app_user where id = uid;
  insert into public.inquiry (user_id, space_id, category, body, attach)
    values (uid, sid, p_category, btrim(p_body), p_attach)
    returning no into n;
  insert into public.inquiry_message (inquiry_id, author, body)
    select id, 'user', btrim(p_body) from public.inquiry where no = n;
  return n;
end;
$$;
revoke execute on function public.create_inquiry(public.inquiry_category, text, jsonb) from public, anon;
grant execute on function public.create_inquiry(public.inquiry_category, text, jsonb) to authenticated;

-- 내 문의에 덧붙이기(답변 대기면 처리 중으로, 완료 7일 안이면 다시 열림)
create or replace function public.add_inquiry_message(p_inquiry uuid, p_body text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  q public.inquiry;
begin
  select * into q from public.inquiry where id = p_inquiry and user_id = auth.uid() for update;
  if q.id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if q.status = 'done' and q.done_at < now() - interval '7 days' then
    raise exception 'closed' using errcode = 'P0001';
  end if;
  insert into public.inquiry_message (inquiry_id, author, body) values (q.id, 'user', btrim(p_body));
  update public.inquiry set
    status = case when q.status = 'done' then 'received'::public.inquiry_status
                  when q.status = 'waiting_user' then 'in_progress'::public.inquiry_status
                  else q.status end,
    done_at = case when q.status = 'done' then null else q.done_at end,
    updated_at = now()
  where id = q.id;
end;
$$;
revoke execute on function public.add_inquiry_message(uuid, text) from public, anon;
grant execute on function public.add_inquiry_message(uuid, text) to authenticated;

-- S-19b 동의/거절(문의한 본인만). 동의하면 24시간 + 배우자 열람 알림
create or replace function public.answer_access_request(p_id uuid, p_accept boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r public.access_request;
  me public.app_user;
  other uuid;
  until timestamptz := now() + interval '24 hours';
begin
  select * into r from public.access_request where id = p_id and user_id = auth.uid() for update;
  if r.id is null or r.status <> 'requested' then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if not p_accept then
    update public.access_request set status = 'declined', answered_at = now() where id = r.id;
    return;
  end if;
  update public.access_request
    set status = 'approved', answered_at = now(), expires_at = until, partner_notified_at = now()
    where id = r.id;
  select * into me from public.app_user where id = r.user_id;
  select id into other from public.app_user
    where space_id = me.space_id and status = 'active' and id <> me.id limit 1;
  if other is not null then
    perform public.notify(other, me.space_id, 'access_partner',
      '운영자가 ' || coalesce(me.nickname, '') || '님 문의를 확인하고 있어요',
      coalesce(me.nickname, '') || '님이 동의한 범위만, ' || public.md_label((until at time zone 'Asia/Seoul')::date) || '까지 봐요',
      '/settings/help', 'shield-check', null, 'access:' || r.id || ':partner');
  end if;
end;
$$;
revoke execute on function public.answer_access_request(uuid, boolean) from public, anon;
grant execute on function public.answer_access_request(uuid, boolean) to authenticated;

-- 열람 끝(내부): 상태 done + 본인 알림(인앱만)
-- (행 타입 하나를 받으면 PostgREST가 계산 열로 보여서 id로 받음)
create or replace function public.end_access(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r public.access_request;
begin
  select * into r from public.access_request where id = p_id;
  update public.access_request set status = 'done', ended_at = now() where id = r.id and status = 'approved';
  perform public.notify(r.user_id, (select space_id from public.app_user where id = r.user_id), 'access_done',
    '문의 확인이 끝났어요', '이제 운영자는 볼 수 없어요', '/settings/help/inquiries/' || r.inquiry_id,
    'shield-check', null, 'access:' || r.id || ':done');
end;
$$;
revoke execute on function public.end_access(uuid) from public, anon, authenticated;

-- S-19b ‘지금 그만 보게 하기’
create or replace function public.stop_access(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r public.access_request;
begin
  select * into r from public.access_request where id = p_id and user_id = auth.uid() and status = 'approved' for update;
  if r.id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  perform public.end_access(r.id);
end;
$$;
revoke execute on function public.stop_access(uuid) from public, anon;
grant execute on function public.stop_access(uuid) to authenticated;

-- 매시간: 24시간 지난 열람 끝, 문의가 완료된 요청 만료
create or replace function public.run_access_expiry()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r public.access_request;
begin
  for r in select * from public.access_request where status = 'approved' and expires_at <= now() loop
    perform public.end_access(r.id);
  end loop;
  update public.access_request a set status = 'expired'
    from public.inquiry q
    where a.inquiry_id = q.id and a.status = 'requested' and q.status = 'done';
end;
$$;
revoke execute on function public.run_access_expiry() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('access-expiry', '5 * * * *', 'select public.run_access_expiry()');
  end if;
end;
$$;
