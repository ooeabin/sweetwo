-- 어드민 운영(27 AD-10·14·15·16·18·19, 33 2·3장): 공지, 가이드·약관 버전, 앱 버전·점검, 관리자 계정, 기준 데이터, 2인 승인.
--
-- 2인 승인(admin_approval): 사용자에게 영향이 가는 실행(공지 게시, 약관 버전, 앱 버전·점검, 관리자 추가·역할 변경)은
--   요청 → 최고 관리자 승인(작성자 본인은 승인 불가) → 적용. 모두 감사 로그.
-- 첫 최고 관리자: 관리자가 한 명도 없을 때 회사 도메인(@sweetwo.kr) 이메일로 처음 로그인한 사람이 admin_bootstrap으로 최고 관리자가 됨.
-- 공지(notice): 게시된 것만 앱이 읽음(노출 기간·플랫폼). 앱 안 공지는 알림 상한과 무관.
-- 점검: app_config.maintenance_*(앱 13번 ‘점검’ 화면), 최신 버전 latest_version_*.

-- ── 2인 승인 ─────────────────────────────────────────────────────────────
create table public.admin_approval (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('notice_publish', 'terms_version', 'app_version', 'admin_add', 'admin_roles')),
  payload jsonb not null,
  summary text not null,
  requested_by uuid not null,
  requested_at timestamptz not null default now(),
  status text not null default 'requested' check (status in ('requested', 'approved', 'rejected', 'cancelled')),
  decided_by uuid,
  decided_at timestamptz
);
create index admin_approval_status_idx on public.admin_approval (status, requested_at);
alter table public.admin_approval enable row level security;
revoke all on public.admin_approval from anon, authenticated;

-- ── 공지(AD-10) ─────────────────────────────────────────────────────────
create table public.notice (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'info' check (kind in ('info', 'maintenance', 'incident', 'terms')),
  title text not null check (char_length(btrim(title)) between 1 and 60),
  body text not null default '' check (char_length(body) <= 2000),
  importance text not null default 'normal' check (importance in ('normal', 'must')),
  platforms text[] not null default array['desktop', 'web'] check (platforms <@ array['desktop', 'web'] and array_length(platforms, 1) >= 1),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  status text not null default 'draft' check (status in ('draft', 'requested', 'published', 'cancelled')),
  created_by uuid,
  created_at timestamptz not null default now(),
  published_at timestamptz
);
alter table public.notice enable row level security;
-- 앱은 게시됐고 노출 기간 안의 공지만
create policy notice_select on public.notice for select to anon, authenticated
  using (status = 'published' and now() between starts_at and ends_at);
revoke insert, update, delete on public.notice from anon, authenticated;

-- ── 가이드·도움말 버전(AD-14), 약관·처리방침 버전(AD-15) ─────────────────────
create table public.content_version (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('guide', 'checklist', 'faq')),
  key text not null check (key ~ '^[a-z0-9_-]{1,40}$'),
  version text not null check (version ~ '^\d+(\.\d+){0,2}$'),
  effective_on date not null,
  checked_on date not null,
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (kind, key, version)
);
alter table public.content_version enable row level security;
revoke all on public.content_version from anon, authenticated;

create table public.terms_version (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('terms', 'privacy')),
  version text not null check (version ~ '^v?\d+(\.\d+){0,2}$'),
  effective_on date not null,
  reconsent boolean not null default false,
  legal_checked boolean not null default false,
  status text not null default 'requested' check (status in ('requested', 'approved', 'rejected')),
  created_by uuid,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  unique (kind, version)
);
alter table public.terms_version enable row level security;
-- 앱은 승인된 버전만(재동의 화면)
create policy terms_version_select on public.terms_version for select to anon, authenticated using (status = 'approved');
revoke insert, update, delete on public.terms_version from anon, authenticated;

-- ── 앱 버전·점검(AD-16) ──────────────────────────────────────────────────
alter table public.app_config
  add column latest_version_desktop text not null default '0.0.0',
  add column maintenance_starts_at timestamptz,
  add column maintenance_ends_at timestamptz,
  add column maintenance_message text check (maintenance_message is null or char_length(maintenance_message) <= 200);

-- ── 기준 데이터(AD-19): 대출 유형별 평균 금리(연, 0.01% 단위 정수) ─────────────
create table public.loan_rate (
  kind text primary key check (kind in ('mortgage', 'jeonse', 'credit', 'student', 'card_loan')),
  rate_bp integer not null check (rate_bp between 0 and 10000),
  applied_on date not null,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
alter table public.loan_rate enable row level security;
create policy loan_rate_select on public.loan_rate for select to anon, authenticated using (true);
revoke insert, update, delete on public.loan_rate from anon, authenticated;
insert into public.loan_rate (kind, rate_bp, applied_on) values
  ('mortgage', 400, '2026-10-01'), ('jeonse', 400, '2026-10-01'), ('credit', 600, '2026-10-01'),
  ('student', 200, '2026-10-01'), ('card_loan', 1500, '2026-10-01');

-- 관리자 분기 점검 기록(AD-18)
create table public.admin_review (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  by_id uuid,
  note text not null check (char_length(btrim(note)) between 1 and 500)
);
alter table public.admin_review enable row level security;
revoke all on public.admin_review from anon, authenticated;

-- ── 첫 최고 관리자 ───────────────────────────────────────────────────────
create or replace function public.admin_bootstrap()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  em text;
begin
  select lower(email) into em from auth.users where id = auth.uid();
  if em is null or em !~ '@sweetwo\.kr$' or exists (select 1 from public.admin_user) then
    return false;
  end if;
  insert into public.admin_user (id, email, name, roles) values (auth.uid(), em, split_part(em, '@', 1), array['super']::public.admin_role[]);
  insert into public.admin_audit (admin_id, admin_email, action, screen, target, reason)
    values (auth.uid(), em, 'execute', 'AD-18', em, '첫 최고 관리자');
  return true;
end;
$$;
revoke execute on function public.admin_bootstrap() from public, anon;
grant execute on function public.admin_bootstrap() to authenticated;

-- ── 승인 요청·결정 ────────────────────────────────────────────────────────
create or replace function public.admin_request_approval(a public.admin_user, p_kind text, p_payload jsonb, p_summary text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  rid uuid;
begin
  insert into public.admin_approval (kind, payload, summary, requested_by)
    values (p_kind, p_payload, p_summary, a.id) returning id into rid;
  perform public.admin_log(a, 'request', 'AD-' || case p_kind when 'notice_publish' then '10' when 'terms_version' then '15'
    when 'app_version' then '16' else '18' end, rid::text, p_summary, p_payload);
  return rid;
end;
$$;
revoke execute on function public.admin_request_approval(public.admin_user, text, jsonb, text) from public, anon, authenticated;

create or replace function public.admin_approvals(p_status text default 'requested')
returns table (id uuid, kind text, summary text, payload jsonb, requested_by text, requested_at timestamptz, status text, decided_by text, decided_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['super', 'ops', 'cs']::public.admin_role[]);
begin
  return query
    select x.id, x.kind, x.summary, x.payload, r.email, x.requested_at, x.status, d.email, x.decided_at
    from public.admin_approval x
    left join public.admin_user r on r.id = x.requested_by
    left join public.admin_user d on d.id = x.decided_by
    where x.status = p_status and ('super' = any (a.roles) or x.requested_by = a.id)
    order by x.requested_at desc;
end;
$$;
revoke execute on function public.admin_approvals(text) from public, anon;
grant execute on function public.admin_approvals(text) to authenticated;

-- 승인(최고 관리자, 요청자 본인 불가) → 적용 / 거절 / 요청자 취소
create or replace function public.admin_decide(p_id uuid, p_decision text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['super', 'ops', 'cs']::public.admin_role[]);
  x public.admin_approval;
  p jsonb;
begin
  select * into x from public.admin_approval where id = p_id and status = 'requested' for update;
  if x.id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if p_decision = 'cancel' then
    if x.requested_by <> a.id then
      raise exception 'no_permission' using errcode = '42501';
    end if;
    update public.admin_approval set status = 'cancelled', decided_by = a.id, decided_at = now() where id = x.id;
    if x.kind = 'notice_publish' then
      update public.notice set status = 'draft' where id = (x.payload->>'notice_id')::uuid and status = 'requested';
    elsif x.kind = 'terms_version' then
      update public.terms_version set status = 'rejected' where id = (x.payload->>'terms_id')::uuid and status = 'requested';
    end if;
    perform public.admin_log(a, 'execute', 'AD-18', x.id::text, '승인 요청 취소');
    return;
  end if;
  if not ('super' = any (a.roles)) then
    raise exception 'no_permission' using errcode = '42501';
  end if;
  if x.requested_by = a.id then
    raise exception 'self_approval' using errcode = '42501';
  end if;
  if p_decision not in ('approve', 'reject') then
    raise exception 'bad_decision' using errcode = '22023';
  end if;
  update public.admin_approval set status = case when p_decision = 'approve' then 'approved' else 'rejected' end,
    decided_by = a.id, decided_at = now() where id = x.id;
  p := x.payload;
  if p_decision = 'reject' then
    if x.kind = 'notice_publish' then
      update public.notice set status = 'draft' where id = (p->>'notice_id')::uuid;
    elsif x.kind = 'terms_version' then
      update public.terms_version set status = 'rejected' where id = (p->>'terms_id')::uuid;
    end if;
  elsif x.kind = 'notice_publish' then
    update public.notice set status = 'published', published_at = now() where id = (p->>'notice_id')::uuid;
  elsif x.kind = 'terms_version' then
    update public.terms_version set status = 'approved', approved_at = now() where id = (p->>'terms_id')::uuid;
  elsif x.kind = 'app_version' then
    update public.app_config set
      latest_version_desktop = coalesce(p->>'latest_version_desktop', latest_version_desktop),
      min_version_desktop = coalesce(p->>'min_version_desktop', min_version_desktop),
      min_version_web = coalesce(p->>'min_version_web', min_version_web),
      maintenance_starts_at = (p->>'maintenance_starts_at')::timestamptz,
      maintenance_ends_at = (p->>'maintenance_ends_at')::timestamptz,
      maintenance_message = p->>'maintenance_message'
    where id = 1;
  elsif x.kind = 'admin_add' then
    insert into public.admin_user (email, name, roles, created_by)
      values (p->>'email', p->>'name', array(select jsonb_array_elements_text(p->'roles'))::public.admin_role[], x.requested_by)
      on conflict (email) do update set roles = excluded.roles, name = excluded.name, locked = false;
  elsif x.kind = 'admin_roles' then
    update public.admin_user set roles = array(select jsonb_array_elements_text(p->'roles'))::public.admin_role[]
      where email = p->>'email';
  end if;
  perform public.admin_log(a, 'approve', 'AD-' || case x.kind when 'notice_publish' then '10' when 'terms_version' then '15'
    when 'app_version' then '16' else '18' end, x.id::text, p_decision, p, a.id);
end;
$$;
revoke execute on function public.admin_decide(uuid, text) from public, anon;
grant execute on function public.admin_decide(uuid, text) to authenticated;

-- ── AD-10 공지 ───────────────────────────────────────────────────────────
create or replace function public.admin_notices()
returns setof public.notice
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['super', 'ops', 'cs', 'analyst']::public.admin_role[]);
begin
  return query select * from public.notice where status <> 'cancelled' order by starts_at desc limit 200;
end;
$$;
revoke execute on function public.admin_notices() from public, anon;
grant execute on function public.admin_notices() to authenticated;

-- 공지 저장(새로 또는 초안 고치기) + 게시 승인 요청. 밤 10시~아침 8시 시작은 저장 불가
create or replace function public.admin_save_notice(
  p_id uuid, p_kind text, p_title text, p_body text, p_importance text, p_platforms text[],
  p_starts_at timestamptz, p_ends_at timestamptz, p_request boolean
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['ops']::public.admin_role[]);
  nid uuid := p_id;
  h integer := extract(hour from p_starts_at at time zone 'Asia/Seoul');
begin
  if h >= 22 or h < 8 then
    raise exception 'quiet_hours' using errcode = '22023';
  end if;
  if nid is null then
    insert into public.notice (kind, title, body, importance, platforms, starts_at, ends_at, created_by)
      values (p_kind, btrim(p_title), coalesce(p_body, ''), p_importance, p_platforms, p_starts_at, p_ends_at, a.id)
      returning id into nid;
  else
    update public.notice set kind = p_kind, title = btrim(p_title), body = coalesce(p_body, ''), importance = p_importance,
      platforms = p_platforms, starts_at = p_starts_at, ends_at = p_ends_at
    where id = nid and status = 'draft';
    if not found then
      raise exception 'not_found' using errcode = 'P0001';
    end if;
  end if;
  perform public.admin_log(a, 'edit', 'AD-10', nid::text, btrim(p_title));
  if p_request then
    update public.notice set status = 'requested' where id = nid;
    perform public.admin_request_approval(a, 'notice_publish', jsonb_build_object('notice_id', nid), '공지 게시: ' || btrim(p_title));
  end if;
  return nid;
end;
$$;
revoke execute on function public.admin_save_notice(uuid, text, text, text, text, text[], timestamptz, timestamptz, boolean) from public, anon;
grant execute on function public.admin_save_notice(uuid, text, text, text, text, text[], timestamptz, timestamptz, boolean) to authenticated;

create or replace function public.admin_end_notice(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['super', 'ops']::public.admin_role[]);
begin
  update public.notice set status = 'cancelled' where id = p_id;
  perform public.admin_log(a, 'execute', 'AD-10', p_id::text, '공지 내림');
end;
$$;
revoke execute on function public.admin_end_notice(uuid) from public, anon;
grant execute on function public.admin_end_notice(uuid) to authenticated;

-- ── AD-14 가이드·도움말 버전 ───────────────────────────────────────────────
create or replace function public.admin_content_versions()
returns setof public.content_version
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['super', 'ops', 'cs']::public.admin_role[]);
begin
  return query select * from public.content_version order by kind, key, created_at desc;
end;
$$;
revoke execute on function public.admin_content_versions() from public, anon;
grant execute on function public.admin_content_versions() to authenticated;

create or replace function public.admin_add_content_version(p_kind text, p_key text, p_version text, p_effective date, p_checked date, p_note text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['ops']::public.admin_role[]);
begin
  insert into public.content_version (kind, key, version, effective_on, checked_on, note, created_by)
    values (p_kind, p_key, p_version, p_effective, p_checked, p_note, a.id);
  perform public.admin_log(a, 'edit', 'AD-14', p_kind || ':' || p_key, p_version);
end;
$$;
revoke execute on function public.admin_add_content_version(text, text, text, date, date, text) from public, anon;
grant execute on function public.admin_add_content_version(text, text, text, date, date, text) to authenticated;

-- ── AD-15 약관·처리방침 버전(법률 검토 체크 없으면 승인 요청 불가) + 버전별 동의 수 ──
create or replace function public.admin_terms_versions()
returns table (id uuid, kind text, version text, effective_on date, reconsent boolean, legal_checked boolean, status text, agreed bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['super', 'ops', 'cs']::public.admin_role[]);
begin
  return query
    select t.id, t.kind, t.version, t.effective_on, t.reconsent, t.legal_checked, t.status,
      (select count(distinct c.user_id) from public.consent c
       where c.kind::text = t.kind and c.terms_version = t.version and c.agreed)
    from public.terms_version t order by t.kind, t.effective_on desc;
end;
$$;
revoke execute on function public.admin_terms_versions() from public, anon;
grant execute on function public.admin_terms_versions() to authenticated;

create or replace function public.admin_add_terms_version(p_kind text, p_version text, p_effective date, p_reconsent boolean, p_legal_checked boolean)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['ops']::public.admin_role[]);
  tid uuid;
begin
  if not p_legal_checked then
    raise exception 'legal_check_required' using errcode = '22023';
  end if;
  insert into public.terms_version (kind, version, effective_on, reconsent, legal_checked, created_by)
    values (p_kind, p_version, p_effective, p_reconsent, true, a.id) returning id into tid;
  perform public.admin_request_approval(a, 'terms_version', jsonb_build_object('terms_id', tid),
    case p_kind when 'terms' then '이용약관 ' else '개인정보 처리방침 ' end || p_version || ' (' || p_effective || ' 시행)');
  return tid;
end;
$$;
revoke execute on function public.admin_add_terms_version(text, text, date, boolean, boolean) from public, anon;
grant execute on function public.admin_add_terms_version(text, text, date, boolean, boolean) to authenticated;

-- ── AD-16 앱 버전·점검: 저장 = 승인 요청 ────────────────────────────────────
create or replace function public.admin_app_config()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['super', 'ops', 'cs']::public.admin_role[]);
begin
  return (select to_jsonb(c) - 'flags' - 'kill_switches' from public.app_config c where id = 1);
end;
$$;
revoke execute on function public.admin_app_config() from public, anon;
grant execute on function public.admin_app_config() to authenticated;

create or replace function public.admin_request_app_config(p jsonb)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['ops']::public.admin_role[]);
begin
  if exists (select 1 from jsonb_object_keys(p) k where k not in (
      'latest_version_desktop', 'min_version_desktop', 'min_version_web',
      'maintenance_starts_at', 'maintenance_ends_at', 'maintenance_message'))
     or (p ? 'maintenance_starts_at' and p->>'maintenance_starts_at' is not null
         and (p->>'maintenance_ends_at') is null) then
    raise exception 'bad_value' using errcode = '22023';
  end if;
  return public.admin_request_approval(a, 'app_version', p, '앱 버전·점검 변경');
end;
$$;
revoke execute on function public.admin_request_app_config(jsonb) from public, anon;
grant execute on function public.admin_request_app_config(jsonb) to authenticated;

-- ── AD-18 관리자 계정 ────────────────────────────────────────────────────
create or replace function public.admin_users()
returns table (email text, name text, roles public.admin_role[], locked boolean, last_seen_at timestamptz, linked boolean, mfa boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['super']::public.admin_role[]);
begin
  return query
    select u.email, u.name, u.roles, u.locked, u.last_seen_at, u.id is not null,
      exists (select 1 from auth.mfa_factors f where f.user_id = u.id and f.status = 'verified')
    from public.admin_user u order by u.created_at;
end;
$$;
revoke execute on function public.admin_users() from public, anon;
grant execute on function public.admin_users() to authenticated;

create or replace function public.admin_request_user(p_email text, p_name text, p_roles public.admin_role[])
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['super']::public.admin_role[]);
  em text := lower(btrim(p_email));
begin
  if em !~ '^[^@\s]+@[^@\s]+$' or coalesce(btrim(p_name), '') = '' or array_length(p_roles, 1) is null then
    raise exception 'bad_value' using errcode = '22023';
  end if;
  if exists (select 1 from public.admin_user where email = em) then
    return public.admin_request_approval(a, 'admin_roles', jsonb_build_object('email', em, 'roles', to_jsonb(p_roles)),
      '역할 변경: ' || em);
  end if;
  return public.admin_request_approval(a, 'admin_add',
    jsonb_build_object('email', em, 'name', btrim(p_name), 'roles', to_jsonb(p_roles)), '관리자 추가: ' || em);
end;
$$;
revoke execute on function public.admin_request_user(text, text, public.admin_role[]) from public, anon;
grant execute on function public.admin_request_user(text, text, public.admin_role[]) to authenticated;

-- 잠금·풀기(최고 관리자, 본인 잠금 불가). 최고 관리자는 2명 아래로 줄일 수 없음은 화면 안내
create or replace function public.admin_set_lock(p_email text, p_locked boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['super']::public.admin_role[]);
begin
  if lower(p_email) = a.email then
    raise exception 'self_lock' using errcode = '22023';
  end if;
  update public.admin_user set locked = p_locked where email = lower(p_email);
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  perform public.admin_log(a, 'execute', 'AD-18', lower(p_email), case when p_locked then '잠금' else '잠금 풀기' end);
end;
$$;
revoke execute on function public.admin_set_lock(text, boolean) from public, anon;
grant execute on function public.admin_set_lock(text, boolean) to authenticated;

create or replace function public.admin_add_review(p_note text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['super']::public.admin_role[]);
begin
  insert into public.admin_review (by_id, note) values (a.id, btrim(p_note));
  perform public.admin_log(a, 'edit', 'AD-18', null, '분기 점검 기록');
end;
$$;
revoke execute on function public.admin_add_review(text) from public, anon;
grant execute on function public.admin_add_review(text) to authenticated;

create or replace function public.admin_reviews()
returns table (at timestamptz, by_email text, note text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['super']::public.admin_role[]);
begin
  return query select r.at, u.email, r.note from public.admin_review r left join public.admin_user u on u.id = r.by_id order by r.at desc limit 20;
end;
$$;
revoke execute on function public.admin_reviews() from public, anon;
grant execute on function public.admin_reviews() to authenticated;

-- 90일 미접속 관리자 자동 잠금(매일)
create or replace function public.lock_idle_admins()
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  with x as (
    update public.admin_user set locked = true
    where not locked and coalesce(last_seen_at, created_at) < now() - interval '90 days'
    returning 1)
  select count(*)::int from x;
$$;
revoke execute on function public.lock_idle_admins() from public, anon, authenticated;

-- ── AD-19 기준 데이터: 대출 평균 금리, 공휴일 ─────────────────────────────────
create or replace function public.admin_set_loan_rate(p_kind text, p_rate_bp integer, p_applied date)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['ops']::public.admin_role[]);
  before integer;
begin
  select rate_bp into before from public.loan_rate where kind = p_kind;
  update public.loan_rate set rate_bp = p_rate_bp, applied_on = p_applied, updated_by = a.id, updated_at = now() where kind = p_kind;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  perform public.admin_log(a, 'edit', 'AD-19', p_kind, null, jsonb_build_object('before', before, 'after', p_rate_bp));
end;
$$;
revoke execute on function public.admin_set_loan_rate(text, integer, date) from public, anon;
grant execute on function public.admin_set_loan_rate(text, integer, date) to authenticated;

create or replace function public.admin_set_holiday(p_date date, p_name text, p_kind public.holiday_kind, p_delete boolean default false)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['ops']::public.admin_role[]);
begin
  if p_delete then
    delete from public.holiday where date = p_date;
  else
    insert into public.holiday (date, name, kind, source) values (p_date, btrim(p_name), p_kind, 'admin')
      on conflict (date) do update set name = excluded.name, kind = excluded.kind, source = 'admin', fetched_at = now();
  end if;
  perform public.admin_log(a, 'edit', 'AD-19', p_date::text, case when p_delete then '공휴일 지움' else btrim(p_name) end);
end;
$$;
revoke execute on function public.admin_set_holiday(date, text, public.holiday_kind, boolean) from public, anon;
grant execute on function public.admin_set_holiday(date, text, public.holiday_kind, boolean) to authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('lock-idle-admins', '50 19 * * *', 'select public.lock_idle_admins()');
  end if;
end;
$$;
