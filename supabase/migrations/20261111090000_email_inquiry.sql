-- 이메일 문의(27 AD-06 2번·예외, 29 고객 메일 수신, 28 L-06 3번). 추가만.
--
-- 흐름: 고객 → help@sweetwo.kr(네이버웍스) → 자동 전달 → Amazon SES 받기(서울) → 수신 규칙 SNS 동작 → SNS 주제
--   → Edge Function inbound-mail(HTTPS 구독) → ingest_inquiry_mail(service_role만).
-- - 회원 연결: 보낸 주소와 auth.users 이메일이 정확히 일치(대소문자 무시)하는 계정이 1명일 때만. 없으면 회원 없이.
-- - 같은 대화: In-Reply-To·References가 이 문의에서 받은·보낸 메일 ID와 같거나, 제목에 [A-10001] 같은 문의 번호가 있으면
--   (둘 다 보낸 주소가 같을 때만) 새 문의 대신 그 문의에 덧붙임. 완료 뒤 7일 안이면 다시 열림, 7일 넘으면 새 문의.
-- - 무시: sweetwo.kr 주소에서 온 메일(앱 문의 사본, 우리 답장), 같은 Message-ID(SNS 재전송), 같은 주소 하루 새 문의 10건 넘음.
-- - 보낸 주소는 문의에만 두고 어드민에는 가려서(mask_email) 보여 줌. 첨부 파일은 받지 않고 개수만 남김.
-- - 답변(admin_answer_inquiry): 이메일 문의면 help@sweetwo.kr에서 같은 주소로 답장 메일(mail_outbox → send-mail → SES),
--   In-Reply-To·References를 넣고 제목은 “Re: 원래 제목 [문의 번호]”. 앱 알림은 보내지 않음(앱 ‘내 문의’에 안 보임).
-- - 앱 문의 사본(S-19a “동시에 help@로 사본 메일”): 사용자 메시지가 쌓이면 help@로 사본을 쌓음.
--   제목 “[A-10001] 앱 문의 사본”, 머리글 X-Sweetwo-Copy, 보내는 주소 noti@ → 전달돼 돌아와도 위 규칙으로 무시.

-- ── 저장 ────────────────────────────────────────────────────────────────
alter table public.inquiry
  add column email_from text check (email_from is null or (email_from = lower(btrim(email_from)) and char_length(email_from) <= 254)),
  add column email_subject text check (email_subject is null or char_length(email_subject) <= 200);
create index inquiry_email_from_idx on public.inquiry (email_from, created_at desc) where channel = 'email';

-- 문의 메일 한 통(받은 것 in, 보낸 것 out). 대화 이어 붙이기와 답장 머리글용. Message-ID는 <> 없이
create table public.inquiry_mail (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.inquiry (id) on delete cascade,
  inquiry_message_id uuid references public.inquiry_message (id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  message_id text check (message_id is null or message_id ~ '^[^<>\s]{1,250}$'),
  refs text[] not null default '{}' check (coalesce(array_length(refs, 1), 0) <= 30),
  outbox_id uuid references public.mail_outbox (id) on delete set null, -- 보낸 것: SES MessageId는 mail_outbox.message_id
  attachments smallint not null default 0 check (attachments >= 0),
  created_at timestamptz not null default now()
);
create unique index inquiry_mail_in_mid_key on public.inquiry_mail (message_id) where direction = 'in' and message_id is not null;
create index inquiry_mail_inquiry_idx on public.inquiry_mail (inquiry_id, created_at);
create index inquiry_mail_outbox_idx on public.inquiry_mail (outbox_id) where outbox_id is not null;
alter table public.inquiry_mail enable row level security;
revoke all on public.inquiry_mail from anon, authenticated;

-- 보내는 메일: 보내는 주소(없으면 함수 비밀 값 MAIL_FROM)와 머리글(In-Reply-To, References, X-Sweetwo-Copy)
alter table public.mail_outbox
  add column from_email text check (from_email is null or from_email ~ '^([ -;=?-~]*<)?[^@\s<>]+@sweetwo\.kr>?$'),
  add column headers jsonb check (headers is null or (jsonb_typeof(headers) = 'object' and pg_column_size(headers) < 4000));

-- ── 앱 ‘내 문의’에는 앱 문의만(이메일은 보낸 주소를 꾸밀 수 있어 앱에 보이지 않게) ───────────
drop policy inquiry_select on public.inquiry;
create policy inquiry_select on public.inquiry for select to authenticated
  using (user_id = (select auth.uid()) and channel = 'app');
drop policy inquiry_message_select on public.inquiry_message;
create policy inquiry_message_select on public.inquiry_message for select to authenticated
  using (exists (select 1 from public.inquiry i where i.id = inquiry_id and i.user_id = (select auth.uid()) and i.channel = 'app'));

-- 내 문의에 덧붙이기: 앱 문의만(나머지는 20261022180000과 같음)
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
  select * into q from public.inquiry where id = p_inquiry and user_id = auth.uid() and channel = 'app' for update;
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

-- ── 앱 문의 사본 메일(help@) ──────────────────────────────────────────────
-- 문구 [확인 필요]: 제목 “[A-10001] 앱 문의 사본” / “[A-10001] 앱 문의 덧붙임”, 본문 첫 줄 “앱에서 온 문의예요. 답변은 어드민에서 써 주세요.”
create or replace function public.inquiry_copy_mail()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.inquiry;
  first boolean;
  label text;
  link text;
  t text;
begin
  if new.author <> 'user' then
    return new;
  end if;
  select * into q from public.inquiry where id = new.inquiry_id;
  if q.id is null or q.channel <> 'app' then
    return new;
  end if;
  first := not exists (select 1 from public.inquiry_message m where m.inquiry_id = q.id and m.id <> new.id);
  label := case q.category
    when 'account' then '계정·로그인' when 'couple' then '부부 연결' when 'calc' then '목표·월급 체크리스트'
    when 'sync' then '동기화' when 'billing' then '결제·환불' when 'privacy' then '개인정보' else '기타' end;
  link := 'https://ops.sweetwo.kr/inquiries/' || q.id;
  t := concat_ws(E'\n', '앱에서 온 문의예요. 답변은 어드민에서 써 주세요.', '문의 번호: ' || q.no, '분류: ' || label,
    '', new.body, '', '어드민에서 보기: ' || link);
  insert into public.mail_outbox (user_id, to_email, kind, subject, body_text, body_html, capped, dedupe, headers)
  values (q.user_id, 'help@sweetwo.kr', 'inquiry_copy',
    '[' || q.no || '] ' || case when first then '앱 문의 사본' else '앱 문의 덧붙임' end,
    t,
    concat('<p>앱에서 온 문의예요. 답변은 어드민에서 써 주세요.</p><p>문의 번호: ', public.html_esc(q.no),
      '<br>분류: ', public.html_esc(label), '</p><p>', replace(public.html_esc(new.body), E'\n', '<br>'),
      '</p><p><a href="', link, '">어드민에서 보기</a></p>'),
    false, 'inquiry_copy:' || new.id, jsonb_build_object('X-Sweetwo-Copy', q.no))
  on conflict (dedupe) do nothing;
  update public.inquiry set mail_copied_at = now() where id = q.id;
  return new;
end;
$$;
revoke execute on function public.inquiry_copy_mail() from public, anon, authenticated;
create trigger inquiry_copy_mail after insert on public.inquiry_message
  for each row execute function public.inquiry_copy_mail();

-- ── 받은 메일 넣기(Edge Function inbound-mail 전용, service_role) ───────────────
-- p_refs = In-Reply-To + References의 Message-ID들(<> 없이). 돌려주는 값 {result: created|appended|duplicate|ignored, no}
-- 시각은 clock_timestamp(): 한 트랜잭션에서 여러 통이 들어와도 대화 순서가 맞게
create or replace function public.ingest_inquiry_mail(
  p_from text, p_subject text, p_message_id text, p_refs text[], p_body text, p_attachments integer default 0
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_from text := lower(btrim(coalesce(p_from, '')));
  v_subject text := nullif(left(btrim(regexp_replace(coalesce(p_subject, ''), '\s+', ' ', 'g')), 200), '');
  v_mid text := nullif(btrim(coalesce(p_message_id, '')), '');
  v_refs text[];
  v_locals text[];
  v_body text := btrim(coalesce(p_body, ''));
  v_no text;
  v_att smallint := least(greatest(coalesce(p_attachments, 0), 0), 100)::smallint;
  q public.inquiry;
  uid uuid;
  cnt integer;
  sid uuid;
  mid uuid;
begin
  if v_from !~ '^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$' or char_length(v_from) > 254 then
    raise exception 'bad_from' using errcode = '22023';
  end if;
  -- 우리 주소에서 온 메일(앱 문의 사본, 우리 답장이 되돌아온 것)
  if split_part(v_from, '@', 2) = 'sweetwo.kr' or split_part(v_from, '@', 2) like '%.sweetwo.kr' then
    return jsonb_build_object('result', 'ignored');
  end if;
  if v_mid is not null and v_mid !~ '^[^<>\s]{1,250}$' then
    v_mid := null;
  end if;
  if v_mid is not null and exists (
      select 1 from public.inquiry_mail m where m.direction = 'in' and m.message_id = v_mid) then
    return jsonb_build_object('result', 'duplicate');
  end if;
  v_refs := array(select x from unnest((coalesce(p_refs, '{}'::text[]))[1:30]) x where x ~ '^[^<>\s]{1,250}$');
  v_locals := array(select split_part(x, '@', 1) from unnest(v_refs) x);
  v_no := substring(coalesce(v_subject, '') from '\[(A-[0-9]+)\]');
  if v_body = '' then
    v_body := coalesce(v_subject, '(내용 없음)'); -- [확인 필요]
  end if;
  v_body := btrim(left(v_body, 4000));

  -- 같은 대화(보낸 주소가 같을 때만)
  select i.* into q from public.inquiry i
  where i.channel = 'email' and i.email_from = v_from
    and (
      exists (
        select 1 from public.inquiry_mail m
        left join public.mail_outbox o on o.id = m.outbox_id
        where m.inquiry_id = i.id
          and ((m.direction = 'in' and m.message_id = any (v_refs))
            or (m.direction = 'out' and o.message_id is not null and o.message_id = any (v_locals))))
      or (v_no is not null and i.no = v_no))
  order by i.created_at desc
  limit 1
  for update of i;

  if q.id is not null and not (q.status = 'done' and q.done_at < now() - interval '7 days') then
    insert into public.inquiry_message (inquiry_id, author, body, created_at)
      values (q.id, 'user', v_body, clock_timestamp()) returning id into mid;
    insert into public.inquiry_mail (inquiry_id, inquiry_message_id, direction, message_id, refs, attachments, created_at)
      values (q.id, mid, 'in', v_mid, v_refs, v_att, clock_timestamp());
    update public.inquiry set
      status = case when q.status = 'done' then 'received'::public.inquiry_status
                    when q.status = 'waiting_user' then 'in_progress'::public.inquiry_status
                    else q.status end,
      done_at = case when q.status = 'done' then null else q.done_at end,
      updated_at = now()
    where id = q.id;
    return jsonb_build_object('result', 'appended', 'no', q.no);
  end if;

  -- 같은 주소 하루 새 문의 상한
  if (select count(*) from public.inquiry i
      where i.channel = 'email' and i.email_from = v_from and i.created_at > now() - interval '1 day') >= 10 then
    return jsonb_build_object('result', 'ignored');
  end if;

  -- 회원 연결: 이메일 정확히 일치(대소문자 무시) 1명일 때만
  select (array_agg(u.id))[1], count(*) into uid, cnt from auth.users u where lower(u.email) = v_from;
  if cnt <> 1 then
    uid := null;
  end if;
  if uid is not null then
    select a.space_id into sid from public.app_user a where a.id = uid;
  end if;

  insert into public.inquiry (user_id, space_id, category, body, channel, email_from, email_subject)
    values (uid, sid, 'etc', btrim(left(v_body, 2000)), 'email', v_from, v_subject)
    returning * into q;
  insert into public.inquiry_message (inquiry_id, author, body, created_at)
    values (q.id, 'user', v_body, clock_timestamp()) returning id into mid;
  insert into public.inquiry_mail (inquiry_id, inquiry_message_id, direction, message_id, refs, attachments, created_at)
    values (q.id, mid, 'in', v_mid, v_refs, v_att, clock_timestamp());
  return jsonb_build_object('result', 'created', 'no', q.no);
end;
$$;
revoke all on function public.ingest_inquiry_mail(text, text, text, text[], text, integer) from public, anon, authenticated;
grant execute on function public.ingest_inquiry_mail(text, text, text, text[], text, integer) to service_role;

-- ── AD-06 상세: 이메일 문의면 제목, 가린 보낸 주소, 받지 않은 첨부 수(나머지는 20261025090000과 같음) ──
create or replace function public.admin_inquiry(p_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['super', 'ops', 'cs']::public.admin_role[]);
  q public.inquiry;
begin
  select * into q from public.inquiry where id = p_id;
  if q.id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  perform public.admin_log(a, 'view', 'AD-06', q.no);
  return jsonb_build_object(
    'id', q.id, 'no', q.no, 'category', q.category, 'status', q.status, 'channel', q.channel,
    'user_id', q.user_id, 'created_at', q.created_at, 'done_at', q.done_at, 'attach', q.attach,
    'email', case when q.channel = 'email' then jsonb_build_object(
      'from_masked', public.mask_email(q.email_from),
      'subject', q.email_subject,
      'attachments', (select coalesce(sum(m.attachments), 0)::int from public.inquiry_mail m
                      where m.inquiry_id = q.id and m.direction = 'in')) end,
    'messages', coalesce((select jsonb_agg(jsonb_build_object('author', m.author, 'body', m.body, 'created_at', m.created_at) order by m.created_at)
                          from public.inquiry_message m where m.inquiry_id = q.id), '[]'::jsonb),
    'access', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'status', x.status, 'scope', to_jsonb(x.scope), 'raw', x.raw_amount, 'expires_at', x.expires_at) order by x.created_at desc)
                        from public.access_request x where x.inquiry_id = q.id), '[]'::jsonb));
end;
$$;
revoke execute on function public.admin_inquiry(uuid) from public, anon;
grant execute on function public.admin_inquiry(uuid) to authenticated;

-- ── 답변 보내기: 앱 문의는 앱 알림(그대로), 이메일 문의는 help@에서 답장 메일 ─────────────
create or replace function public.admin_answer_inquiry(p_id uuid, p_body text, p_status public.inquiry_status default 'waiting_user')
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['cs']::public.admin_role[]);
  q public.inquiry;
  mid uuid;
  oid uuid;
  last_in public.inquiry_mail;
  chain text[];
  hdr jsonb;
  subj text;
  b text := btrim(coalesce(p_body, ''));
begin
  select * into q from public.inquiry where id = p_id for update;
  if q.id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if char_length(b) not between 1 and 4000 then
    raise exception 'bad_body' using errcode = '22023';
  end if;
  insert into public.inquiry_message (inquiry_id, author, admin_id, body, created_at)
    values (q.id, 'admin', a.id, b, clock_timestamp()) returning id into mid;
  update public.inquiry set status = p_status, updated_at = now(),
    done_at = case when p_status = 'done' then now() else null end
  where id = q.id;
  if q.channel = 'email' and q.email_from is not null then
    -- 가장 최근에 받은 메일에 답장: In-Reply-To = 그 메일, References = 그 메일의 References + 그 메일(최근 10개)
    select * into last_in from public.inquiry_mail m
      where m.inquiry_id = q.id and m.direction = 'in' order by m.created_at desc limit 1;
    hdr := null;
    if last_in.message_id is not null then
      chain := coalesce(last_in.refs, '{}'::text[]) || last_in.message_id;
      hdr := jsonb_build_object(
        'In-Reply-To', '<' || last_in.message_id || '>',
        'References', (select string_agg('<' || x || '>', ' ' order by o)
                       from unnest(chain) with ordinality t(x, o) where o > cardinality(chain) - 10));
    end if;
    subj := left(regexp_replace(coalesce(q.email_subject, '문의'), '^\s*((re|fw|fwd)\s*:\s*)+', '', 'i'), 170);
    if position('[' || q.no || ']' in subj) = 0 then
      subj := subj || ' [' || q.no || ']';
    end if;
    insert into public.mail_outbox (user_id, to_email, kind, subject, body_text, body_html, capped, dedupe, from_email, headers)
      values (q.user_id, q.email_from, 'inquiry_reply', 'Re: ' || subj, b,
        '<p>' || replace(public.html_esc(b), E'\n', '<br>') || '</p>',
        false, 'inquiry_reply:' || mid, 'sweeTwo <help@sweetwo.kr>', hdr)
      returning id into oid;
    insert into public.inquiry_mail (inquiry_id, inquiry_message_id, direction, outbox_id, created_at)
      values (q.id, mid, 'out', oid, clock_timestamp());
  elsif q.user_id is not null then
    perform public.notify(q.user_id, (select space_id from public.app_user where id = q.user_id), 'inquiry_answered',
      '문의에 답변이 왔어요', '문의 #' || q.no || ' 답변을 내 문의에서 확인해 주세요',
      '/settings/help/inquiries/' || q.id, 'chat-circle-text', null, 'inquiry:' || q.id || ':' || now());
  end if;
  perform public.admin_log(a, 'execute', 'AD-06', q.no, null, jsonb_build_object('status', p_status));
end;
$$;
revoke execute on function public.admin_answer_inquiry(uuid, text, public.inquiry_status) from public, anon;
grant execute on function public.admin_answer_inquiry(uuid, text, public.inquiry_status) to authenticated;
