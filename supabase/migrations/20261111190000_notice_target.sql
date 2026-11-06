-- AD-10 공지 대상 조건·대상 수·테스트 발송(27 AD-10·11 2·4·6·7번, 14 ‘공지·캠페인’·‘장애 고지 (1등급)’, 33 ‘1등급 장애 뒤 고지’).
--
-- 대상 조건(notice.target, jsonb, 빈 객체 = 모두): 부부 상태(couple_states) / 앱 버전(version_below: 이 버전보다 낮은 앱) /
--   가입 주차(weeks_min·weeks_max: 가입한 날이 1주차). 금액·목표 금액 조건은 없음. 플랫폼은 그대로 notice.platforms.
-- 약관 개정(terms)은 법정 고지라 대상 조건 없이 모든 회원(14 ‘약관 개정’ 대상 전체).
-- 장애 고지(incident) 메일은 대상 조건에 맞는 사람만(33 ‘영향받은 부부’). 조건이 없으면 전과 같이 모든 회원.
-- 앱은 my_notices(플랫폼, 앱 버전)로 읽음: 조건은 읽을 때마다 서버가 다시 봄(승인 뒤 대상 변동은 노출·발송 시점에 반영).
--   전 앱 버전이 쓰던 notice 직접 읽기(RLS)는 대상 조건 없는 공지만 보이게 좁힘.
-- 대상 수(admin_notice_audience): 숫자만(개인정보 없음). 이메일은 반송·수신 거부로 막힌 주소를 ‘제외’로 셈.
-- 테스트 발송(admin_test_notice_mail): 메일 공지만, 요청한 관리자 본인 회사 메일로만(내부 계정), 10분에 5번까지.
-- 승인 요청(admin_request_notice): 대상 0명이면 안 됨.

-- ── 대상 조건 ────────────────────────────────────────────────────────────
create or replace function public.notice_target_valid(p jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  k text;
  v jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    return false;
  end if;
  for k, v in select * from jsonb_each(p) loop
    if k = 'couple_states' then
      if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) < 1 or exists (
        select 1 from jsonb_array_elements(v) e
        where jsonb_typeof(e) <> 'string' or e #>> '{}' not in ('not_joined', 'connected', 'unlink_pending', 'solo')
      ) then
        return false;
      end if;
    elsif k = 'version_below' then
      if jsonb_typeof(v) <> 'string' or (v #>> '{}') !~ '^\d{1,4}\.\d{1,4}\.\d{1,4}$' then
        return false;
      end if;
    elsif k in ('weeks_min', 'weeks_max') then
      if jsonb_typeof(v) <> 'number' then
        return false;
      end if;
      if (v #>> '{}') !~ '^\d{1,3}$' then
        return false;
      end if;
      if (v #>> '{}')::int not between 1 and 520 then
        return false;
      end if;
    else
      return false;
    end if;
  end loop;
  if p ? 'weeks_min' and p ? 'weeks_max' and (p ->> 'weeks_min')::int > (p ->> 'weeks_max')::int then
    return false;
  end if;
  return true;
end;
$$;

alter table public.notice add column target jsonb not null default '{}'::jsonb;
alter table public.notice add constraint notice_target_check check (public.notice_target_valid(target));
alter table public.notice add constraint notice_terms_all check (kind <> 'terms' or target = '{}'::jsonb);

-- 한 사람이 공지 대상인지(내부). p_platform·p_version = 지금 공지를 읽는 앱(앱 안 공지).
-- p_platform이 null이면(대상 수·메일) 기록된 기기(app_device)로 봄: 데스크톱·모바일 둘 다 고르고 버전 조건이 없으면 기기 기록과 상관없이 모두.
create or replace function public.notice_user_match(
  p_user uuid, p_target jsonb, p_platforms text[], p_platform text default null, p_version text default null,
  p_now timestamptz default now()
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  u public.app_user;
  st text;
  wk integer;
  vb text := p_target ->> 'version_below';
begin
  select * into u from public.app_user where id = p_user and status = 'active';
  if u.id is null then
    return false;
  end if;
  if p_target ? 'couple_states' then
    select coalesce((select s.couple_state::text from public.couple_space s where s.id = u.space_id), 'not_joined') into st;
    if not ((p_target -> 'couple_states') ? st) then
      return false;
    end if;
  end if;
  if p_target ? 'weeks_min' or p_target ? 'weeks_max' then
    wk := floor(extract(epoch from (p_now - u.created_at)) / 604800)::int + 1;
    if wk < coalesce((p_target ->> 'weeks_min')::int, 1) or wk > coalesce((p_target ->> 'weeks_max')::int, 100000) then
      return false;
    end if;
  end if;
  if p_platform is not null then
    if not ((case when p_platform in ('ios', 'android') then 'mobile' else p_platform end) = any (p_platforms)) then
      return false;
    end if;
    if vb is not null and not (case when coalesce(p_version, '') ~ '^\d{1,4}(\.\d{1,4}){0,3}$'
                                    then public.version_below(p_version, vb) else false end) then
      return false;
    end if;
    return true;
  end if;
  if vb is null and p_platforms @> array['desktop', 'mobile'] then
    return true;
  end if;
  return exists (
    select 1 from public.app_device d
    where d.user_id = u.id
      and (case when d.platform in ('ios', 'android') then 'mobile' else d.platform end) = any (p_platforms)
      and (vb is null or case when d.app_version ~ '^\d{1,4}(\.\d{1,4}){0,3}$'
                              then public.version_below(d.app_version, vb) else false end)
  );
end;
$$;
revoke execute on function public.notice_user_match(uuid, jsonb, text[], text, text, timestamptz) from public, anon, authenticated;

-- ── 앱: 나에게 보일 공지 ──────────────────────────────────────────────────
-- [{id, kind, title, body, importance, platforms}] 최근 시작 순
create or replace function public.my_notices(p_platform text, p_version text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_platform not in ('desktop', 'ios', 'android', 'web') then
    raise exception 'bad_platform' using errcode = '22023';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', n.id, 'kind', n.kind, 'title', n.title, 'body', n.body,
      'importance', n.importance, 'platforms', to_jsonb(n.platforms)) order by n.starts_at desc)
    from public.notice n
    where n.status = 'published' and now() between n.starts_at and n.ends_at
      and public.notice_user_match(uid, n.target, n.platforms, p_platform, p_version)
  ), '[]'::jsonb);
end;
$$;
revoke execute on function public.my_notices(text, text) from public, anon;
grant execute on function public.my_notices(text, text) to authenticated;

-- 전 앱 버전(직접 읽기)은 대상 조건 없는 공지만
drop policy notice_select on public.notice;
create policy notice_select on public.notice for select to anon, authenticated
  using (status = 'published' and now() between starts_at and ends_at and target = '{}'::jsonb);

-- ── 어드민: 대상 조건 저장, 대상 수, 승인 요청, 테스트 발송 ─────────────────
create or replace function public.admin_set_notice_target(p_id uuid, p_target jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['ops']::public.admin_role[]);
  t jsonb := coalesce(p_target, '{}'::jsonb);
begin
  if not public.notice_target_valid(t) then
    raise exception 'bad_target' using errcode = '22023';
  end if;
  update public.notice set target = t
  where id = p_id and status in ('draft', 'requested') and (kind <> 'terms' or t = '{}'::jsonb);
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  perform public.admin_log(a, 'edit', 'AD-10', p_id::text, '대상 조건', jsonb_build_object('target', t));
end;
$$;
revoke execute on function public.admin_set_notice_target(uuid, jsonb) from public, anon;
grant execute on function public.admin_set_notice_target(uuid, jsonb) to authenticated;

-- 대상 수: {target, excluded, blocked}. 앱 안 공지는 제외 없음. 메일은 막힌 주소(반송 2번·수신 거부)를 제외로
create or replace function public.admin_notice_audience(p_kind text, p_platforms text[], p_target jsonb, p_email boolean)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['super', 'ops']::public.admin_role[]);
  t jsonb := case when p_kind = 'terms' then '{}'::jsonb else coalesce(p_target, '{}'::jsonb) end;
  mail boolean := coalesce(p_email, false) and p_kind in ('terms', 'incident');
  matched integer;
  blocked integer := 0;
begin
  if not public.notice_target_valid(t) or coalesce(array_length(p_platforms, 1), 0) = 0 then
    return jsonb_build_object('target', 0, 'excluded', 0, 'blocked', 0);
  end if;
  -- 약관 개정은 대상 조건·플랫폼 없이 모든 회원
  select count(*), count(*) filter (where mail and public.mail_blocked(u.notify_email))
    into matched, blocked
  from public.app_user u
  where u.status = 'active'
    and (p_kind = 'terms' or public.notice_user_match(u.id, t, p_platforms));
  return jsonb_build_object('target', matched - blocked, 'excluded', blocked, 'blocked', blocked);
end;
$$;
revoke execute on function public.admin_notice_audience(text, text[], jsonb, boolean) from public, anon;
grant execute on function public.admin_notice_audience(text, text[], jsonb, boolean) to authenticated;

-- 초안 → 승인 요청(대상 0명이면 안 됨)
create or replace function public.admin_request_notice(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['ops']::public.admin_role[]);
  n public.notice;
begin
  select * into n from public.notice where id = p_id and status = 'draft' for update;
  if n.id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.app_user u
    where u.status = 'active'
      and (n.kind = 'terms' or public.notice_user_match(u.id, n.target, n.platforms))
      and not (n.email and public.mail_blocked(u.notify_email))
  ) then
    raise exception 'no_audience' using errcode = '22023';
  end if;
  update public.notice set status = 'requested' where id = n.id;
  perform public.admin_request_approval(a, 'notice_publish', jsonb_build_object('notice_id', n.id), '공지 게시: ' || n.title);
end;
$$;
revoke execute on function public.admin_request_notice(uuid) from public, anon;
grant execute on function public.admin_request_notice(uuid) to authenticated;

-- 테스트 발송: 메일 공지(약관 개정·장애 고지)를 요청한 관리자 본인 메일로만. 제목 앞 ‘[테스트]’. 10분에 5번까지
create or replace function public.admin_test_notice_mail(p_kind text, p_title text, p_body text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['ops']::public.admin_role[]);
  ttl text := btrim(coalesce(p_title, ''));
begin
  if p_kind not in ('terms', 'incident') or char_length(ttl) not between 1 and 60 or char_length(coalesce(p_body, '')) > 2000 then
    raise exception 'bad_notice' using errcode = '22023';
  end if;
  if (select count(*) from public.mail_outbox m
      where m.kind = 'notice_test' and m.to_email = a.email and m.created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'too_many' using errcode = 'P0001';
  end if;
  insert into public.mail_outbox (user_id, to_email, kind, subject, body_text, body_html, capped, dedupe)
  values (null, a.email, 'notice_test', '[테스트] ' || ttl,
    coalesce(p_body, '') || E'\n\nsweeTwo',
    '<h1 style="font-size:18px">' || public.html_esc(ttl) || '</h1><p>'
      || replace(public.html_esc(coalesce(p_body, '')), E'\n', '<br>') || '</p><p>sweeTwo</p>',
    false, 'notice_test:' || a.email || ':' || gen_random_uuid());
  perform public.admin_log(a, 'execute', 'AD-10', null, '테스트 발송: ' || ttl);
end;
$$;
revoke execute on function public.admin_test_notice_mail(text, text, text) from public, anon;
grant execute on function public.admin_test_notice_mail(text, text, text) to authenticated;

-- ── 공지 메일: 장애 고지는 대상 조건에 맞는 사람만(약관 개정은 그대로 모두) ─────────
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
      and (n.kind = 'terms' or public.notice_user_match(u.id, n.target, n.platforms, null, null, p_now))
    on conflict (dedupe) do nothing;
    get diagnostics added = row_count;
    cnt := cnt + added;
    update public.notice set mailed_at = p_now where id = n.id;
  end loop;
  return cnt;
end;
$$;
revoke all on function public.send_notice_mails(timestamptz) from public, anon, authenticated;
