-- 어드민 기본(27 어드민 화면 AD-01~06·17, 33 어드민). 같은 Supabase 프로젝트, 관리자는 admin_user + 2단계 인증(aal2).
--
-- 원칙(33 1장): 금액·잔액·수입·항목명·메모·가족 정보·사진은 기본 비노출(L0). L1 = 사유 + 문의 번호로 이메일 전체·접속 기록·결제 내역.
--   L2 = 문의한 사용자 본인 동의(access_request, S-19b) 뒤 24시간, 동의한 화면 범위만, 금액은 구간(원값은 승인 뒤).
--   어드민은 service role을 쓰지 않고 이 파일의 함수로만 읽고 실행. 모든 조회·열람·실행은 admin_audit에(실패하면 조치도 안 함: 같은 트랜잭션).
-- 관리자 계정: 최고 관리자가 회사 이메일을 admin_user에 넣고(AD-18), 그 사람이 매직 링크로 처음 로그인하면 admin_me가 연결.
-- IP 허용 목록은 WAF(CloudFront)에서, 30분 무활동·8시간 만료는 어드민 앱에서.

create type public.admin_role as enum ('super', 'ops', 'cs', 'analyst');

create table public.admin_user (
  id uuid unique references auth.users (id) on delete set null, -- 처음 로그인하면 연결
  email text primary key check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+$'),
  name text not null check (char_length(btrim(name)) between 1 and 30),
  roles public.admin_role[] not null check (array_length(roles, 1) >= 1),
  locked boolean not null default false,
  last_seen_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.admin_user enable row level security;
revoke all on public.admin_user from anon, authenticated;

-- 감사 로그: 추가만(수정·삭제 없음). 보관 1년(정리 작업은 보관 기간 정리와 함께)
create table public.admin_audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  admin_id uuid,
  admin_email text,
  action text not null check (action in ('search', 'view', 'reveal', 'request', 'execute', 'approve', 'download', 'edit')),
  screen text not null,
  target text,
  reason text,
  detail jsonb not null default '{}'::jsonb,
  approver uuid,
  ip text
);
create index admin_audit_at_idx on public.admin_audit (at desc);
create index admin_audit_admin_idx on public.admin_audit (admin_id, at desc);
alter table public.admin_audit enable row level security;
revoke all on public.admin_audit from anon, authenticated;

-- 예약 작업 실행 기록(AD-01 실패 건수, DEV_GUIDE ‘예약 작업’)
create table public.job_run (
  id bigint generated always as identity primary key,
  job text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  spaces integer,
  failed jsonb not null default '[]'::jsonb
);
create index job_run_started_idx on public.job_run (started_at desc);
alter table public.job_run enable row level security;
revoke all on public.job_run from anon, authenticated;

-- ── 내부 도우미 ───────────────────────────────────────────────────────────
create or replace function public.jwt_aal() returns text language sql stable set search_path = '' as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'aal';
$$;

-- 관리자 확인: 잠기지 않은 관리자 + 2단계 인증 + 역할 중 하나. 돌려주는 값 = 관리자 행
create or replace function public.admin_require(p_roles public.admin_role[])
returns public.admin_user
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a public.admin_user;
begin
  select * into a from public.admin_user where id = auth.uid() and not locked;
  if a.email is null then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if coalesce(public.jwt_aal(), '') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if not (a.roles && p_roles) then
    raise exception 'no_permission' using errcode = '42501';
  end if;
  return a;
end;
$$;
revoke execute on function public.admin_require(public.admin_role[]) from public, anon, authenticated;

create or replace function public.admin_log(
  a public.admin_user, p_action text, p_screen text, p_target text, p_reason text default null,
  p_detail jsonb default '{}'::jsonb, p_approver uuid default null
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.admin_audit (admin_id, admin_email, action, screen, target, reason, detail, approver, ip)
  values (a.id, a.email, p_action, p_screen, p_target, p_reason, coalesce(p_detail, '{}'::jsonb), p_approver,
    split_part(coalesce(nullif(current_setting('request.headers', true), '')::jsonb->>'x-forwarded-for', ''), ',', 1));
$$;
revoke execute on function public.admin_log(public.admin_user, text, text, text, text, jsonb, uuid) from public, anon, authenticated;

-- 이메일 가리기: 앞 3자 + ***@도메인
create or replace function public.mask_email(e text) returns text language sql immutable set search_path = '' as $$
  select case when e is null or position('@' in e) = 0 then null
    else left(split_part(e, '@', 1), 3) || '***@' || split_part(e, '@', 2) end;
$$;

-- 금액 구간(L2 기본, 32 5장 구간에 1억 위를 더함)
create or replace function public.won_band(v bigint) returns text language sql immutable set search_path = '' as $$
  select case when v is null then null
    when v < 100000 then '10만 원 미만'
    when v < 500000 then '10만~50만 원'
    when v < 1000000 then '50만~100만 원'
    when v < 3000000 then '100만~300만 원'
    when v < 10000000 then '300만~1,000만 원'
    when v < 100000000 then '1,000만~1억 원'
    else '1억 원 이상' end;
$$;

-- ── 내 관리자 정보(로그인 뒤 처음) ─────────────────────────────────────────
-- 처음 로그인하면 같은 이메일 행에 연결. 2단계 인증 전에도 부를 수 있음(등록 화면을 보여 주려고)
create or replace function public.admin_me()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.admin_user;
  em text;
begin
  select lower(email) into em from auth.users where id = auth.uid();
  update public.admin_user set id = auth.uid() where id is null and email = em;
  select * into a from public.admin_user where id = auth.uid();
  if a.email is null or a.locked then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if public.jwt_aal() = 'aal2' then
    update public.admin_user set last_seen_at = now() where email = a.email;
  end if;
  return jsonb_build_object('email', a.email, 'name', a.name, 'roles', to_jsonb(a.roles),
    'mfa', public.jwt_aal() = 'aal2', 'last_seen_at', a.last_seen_at);
end;
$$;
revoke execute on function public.admin_me() from public, anon;
grant execute on function public.admin_me() to authenticated;

-- ── AD-01 대시보드(집계만) ───────────────────────────────────────────────
create or replace function public.admin_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['super', 'ops', 'cs', 'analyst']::public.admin_role[]);
  today timestamptz := (public.kst_today()::timestamp at time zone 'Asia/Seoul');
begin
  return jsonb_build_object(
    'inquiries', jsonb_build_object(
      'received', (select count(*) from public.inquiry where status = 'received'),
      'in_progress', (select count(*) from public.inquiry where status = 'in_progress')),
    'failed', jsonb_build_object(
      'plans', (select count(*) from public.job_run where job = 'create-monthly-plans' and ok = false and started_at >= today),
      'notifications', (select count(*) from public.job_run where job like 'send-%' and ok = false and started_at >= today)),
    'at', now());
end;
$$;
revoke execute on function public.admin_dashboard() from public, anon;
grant execute on function public.admin_dashboard() to authenticated;

-- ── AD-02 검색: 정확히 일치만(이메일, 사용자 ID, 부부 공간 ID, 문의 번호) ───────
create or replace function public.admin_search(p_q text)
returns table (user_id uuid, email_masked text, created_at timestamptz, couple_state text, subscription text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['super', 'ops', 'cs']::public.admin_role[]);
  q text := btrim(coalesce(p_q, ''));
begin
  if q = '' then
    return;
  end if;
  perform public.admin_log(a, 'search', 'AD-02', null, null, jsonb_build_object('q_kind',
    case when q ~ '^A-\d+$' then 'inquiry' when position('@' in q) > 0 then 'email' else 'id' end));
  return query
    select u.id, public.mask_email(au.email::text), u.created_at, s.couple_state::text, '무료'::text
    from public.app_user u
    join auth.users au on au.id = u.id
    left join public.couple_space s on s.id = u.space_id
    where lower(au.email::text) = lower(q)
       or u.id::text = q
       or (u.space_id is not null and u.space_id::text = q)
       or u.id = (select i.user_id from public.inquiry i where i.no = upper(q))
    order by u.created_at;
end;
$$;
revoke execute on function public.admin_search(text) from public, anon;
grant execute on function public.admin_search(text) to authenticated;

-- ── AD-03 상세(L0: 구조 정보만) ──────────────────────────────────────────
create or replace function public.admin_user_detail(p_user uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['super', 'ops', 'cs']::public.admin_role[]);
  u public.app_user;
  au record;
  sp public.couple_space;
  partner uuid;
  r jsonb;
begin
  select * into u from public.app_user where id = p_user;
  if u.id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  select email::text as email, created_at, last_sign_in_at into au from auth.users where id = p_user;
  select * into sp from public.couple_space where id = u.space_id;
  select x.id into partner from public.app_user x where x.space_id = u.space_id and x.id <> u.id and x.status = 'active' limit 1;
  perform public.admin_log(a, 'view', 'AD-03', p_user::text);
  r := jsonb_build_object(
    'user_id', u.id,
    'email_masked', public.mask_email(au.email),
    'provider', u.provider,
    'created_at', au.created_at,
    'last_sign_in_at', au.last_sign_in_at,
    'status', u.status,
    'deletion_requested_at', u.deletion_requested_at,
    'space_id', u.space_id,
    'couple_state', sp.couple_state,
    'marriage_status', sp.marriage_status,
    'partner_id', partner,
    'subscription', '무료',
    'invites', coalesce((select jsonb_agg(jsonb_build_object('created_at', i.created_at, 'expires_at', i.expires_at, 'used_at', i.used_at) order by i.created_at desc)
                         from public.invite i where i.space_id = u.space_id), '[]'::jsonb),
    'consents', coalesce((select jsonb_agg(jsonb_build_object('kind', c.kind, 'version', c.terms_version, 'agreed', c.agreed, 'at', c.created_at) order by c.created_at desc)
                          from public.consent c where c.user_id = u.id), '[]'::jsonb),
    'counts', jsonb_build_object(
      'assets', (select count(*) from public.asset x where x.space_id = u.space_id and x.deleted_at is null),
      'assets_estimated', (select count(*) from public.asset x where x.space_id = u.space_id and x.deleted_at is null and x.estimated),
      'goals', (select count(*) from public.goal g where g.space_id = u.space_id and g.deleted_at is null),
      'closes', (select count(*) from public.month_close m where m.space_id = u.space_id and m.status = 'done' and m.deleted_at is null)),
    'plan_status', (select p.status from public.monthly_plan p where p.space_id = u.space_id and p.deleted_at is null order by p.cycle_start desc limit 1),
    'sessions', (select count(*) from auth.sessions s where s.user_id = u.id),
    'access', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'status', x.status, 'scope', to_jsonb(x.scope), 'expires_at', x.expires_at) order by x.created_at desc)
                        from public.access_request x where x.user_id = u.id and x.status in ('requested', 'approved')), '[]'::jsonb));
  return r;
end;
$$;
revoke execute on function public.admin_user_detail(uuid) from public, anon;
grant execute on function public.admin_user_detail(uuid) to authenticated;

-- ── AD-04 L1: 사유 + 문의 번호 → 이메일 전체·접속 기록·결제 내역(앱이 30분 보여 주고 다시 가림) ──
create or replace function public.admin_reveal(p_user uuid, p_reason text, p_inquiry_no text, p_scopes text[])
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['super', 'cs']::public.admin_role[]);
  r jsonb := '{}'::jsonb;
begin
  if coalesce(btrim(p_reason), '') = '' or not exists (select 1 from public.inquiry i where i.no = upper(btrim(p_inquiry_no))) then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  if p_scopes is null or array_length(p_scopes, 1) is null
     or exists (select 1 from unnest(p_scopes) s where s not in ('email', 'sign_ins', 'payments')) then
    raise exception 'bad_scope' using errcode = '22023';
  end if;
  perform public.admin_log(a, 'reveal', 'AD-04', p_user::text, p_reason,
    jsonb_build_object('inquiry', upper(btrim(p_inquiry_no)), 'scopes', to_jsonb(p_scopes)));
  if 'email' = any (p_scopes) then
    r := r || jsonb_build_object('email', (select email from auth.users where id = p_user));
  end if;
  if 'sign_ins' = any (p_scopes) then
    r := r || jsonb_build_object('sign_ins', coalesce((
      select jsonb_agg(jsonb_build_object('created_at', s.created_at, 'updated_at', s.updated_at, 'user_agent', s.user_agent) order by s.updated_at desc)
      from auth.sessions s where s.user_id = p_user), '[]'::jsonb));
  end if;
  if 'payments' = any (p_scopes) then
    r := r || jsonb_build_object('payments', '[]'::jsonb); -- 유료화 전
  end if;
  return r;
end;
$$;
revoke execute on function public.admin_reveal(uuid, text, text, text[]) from public, anon;
grant execute on function public.admin_reveal(uuid, text, text, text[]) to authenticated;

-- ── AD-04 L2 동의 요청: 문의한 사용자 본인에게만(S-19b) ─────────────────────
create or replace function public.admin_request_access(p_inquiry uuid, p_scopes text[], p_raw boolean, p_reason text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['cs']::public.admin_role[]);
  q public.inquiry;
  rid uuid;
begin
  select * into q from public.inquiry where id = p_inquiry;
  if q.id is null or q.user_id is null or q.status = 'done' then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if p_scopes is null or array_length(p_scopes, 1) is null
     or exists (select 1 from unnest(p_scopes) s
                where s not in ('month', 'plan', 'close', 'goals', 'assets', 'income_spend', 'calendar')) then
    raise exception 'bad_scope' using errcode = '22023';
  end if;
  -- 금액 원값은 화면 1개만(최고 관리자 승인은 다음 단계, 지금은 1개 제한만)
  if p_raw and array_length(p_scopes, 1) <> 1 then
    raise exception 'raw_one_screen' using errcode = '22023';
  end if;
  insert into public.access_request (inquiry_id, user_id, admin_id, reason, scope, raw_amount)
    values (q.id, q.user_id, a.id, p_reason, p_scopes, coalesce(p_raw, false))
    returning id into rid;
  perform public.notify(q.user_id, (select space_id from public.app_user where id = q.user_id), 'access_request',
    '문의를 확인하려면 동의가 필요해요', '동의한 범위만, 정한 기간 동안 봐요',
    '/settings/help/access/' || rid, 'shield-check', null, 'access:' || rid || ':request');
  perform public.admin_log(a, 'request', 'AD-04', q.user_id::text, p_reason,
    jsonb_build_object('inquiry', q.no, 'scopes', to_jsonb(p_scopes), 'raw', coalesce(p_raw, false), 'access_id', rid));
  return rid;
end;
$$;
revoke execute on function public.admin_request_access(uuid, text[], boolean, text) from public, anon;
grant execute on function public.admin_request_access(uuid, text[], boolean, text) to authenticated;

-- ── L2 보기: 동의한 범위·기한 안에서만, 금액은 구간(원값 동의면 그대로). 메모·가족·사진·비공개·용돈 내역 없음 ──
create or replace function public.admin_access_data(p_access uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['cs']::public.admin_role[]);
  x public.access_request;
  u public.app_user;
  sp public.couple_space;
  r jsonb := '{}'::jsonb;
  amt text;
begin
  select * into x from public.access_request where id = p_access;
  if x.id is null or x.status <> 'approved' or x.expires_at <= now() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into u from public.app_user where id = x.user_id;
  select * into sp from public.couple_space where id = u.space_id;
  perform public.admin_log(a, 'view', 'AD-04', x.user_id::text, null, jsonb_build_object('access_id', x.id, 'scopes', to_jsonb(x.scope)));
  if 'income_spend' = any (x.scope) then
    r := r || jsonb_build_object('income_spend', jsonb_build_object(
      'monthly_income', case when x.raw_amount then to_jsonb(u.monthly_income) else to_jsonb(public.won_band(u.monthly_income)) end,
      'fixed_total', case when x.raw_amount then to_jsonb(sp.fixed_total) else to_jsonb(public.won_band(sp.fixed_total)) end,
      'living_budget', case when x.raw_amount then to_jsonb(sp.living_budget) else to_jsonb(public.won_band(sp.living_budget)) end,
      'loan_repayment', case when x.raw_amount then to_jsonb(sp.loan_repayment) else to_jsonb(public.won_band(sp.loan_repayment)) end));
  end if;
  if 'goals' = any (x.scope) then
    r := r || jsonb_build_object('goals', coalesce((
      select jsonb_agg(jsonb_build_object('name', g.name, 'kind', g.kind, 'status', g.status, 'deadline', g.deadline,
        'target', case when x.raw_amount then to_jsonb(g.target_amount) else to_jsonb(public.won_band(g.target_amount)) end)
        order by g.priority)
      from public.goal g where g.space_id = u.space_id and g.deleted_at is null), '[]'::jsonb));
  end if;
  if 'assets' = any (x.scope) then
    -- 사용자가 앱에서 보는 범위만: 공동, 내 것, 배우자가 항목까지 공개한 것(합계만·비공개는 안 보임)
    r := r || jsonb_build_object('assets', coalesce((
      select jsonb_agg(jsonb_build_object('name', s.name, 'grp', s.grp, 'side', s.side, 'estimated', s.estimated,
        'amount', case when x.raw_amount then to_jsonb(s.amount) else to_jsonb(public.won_band(s.amount)) end)
        order by s.side, s.amount desc)
      from public.asset s
      where s.space_id = u.space_id and s.deleted_at is null and s.status = 'held'
        and (s.owner = 'joint' or s.owner_user_id = u.id or s.visibility = 'all')), '[]'::jsonb));
  end if;
  if 'plan' = any (x.scope) or 'month' = any (x.scope) then
    r := r || jsonb_build_object('plan', (
      select jsonb_build_object('label_month', p.label_month, 'cycle_start', p.cycle_start, 'cycle_end', p.cycle_end, 'status', p.status,
        'lines', (select count(*) from public.plan_line l where l.plan_id = p.id and l.deleted_at is null),
        'done', (select count(*) from public.plan_line l where l.plan_id = p.id and l.deleted_at is null and l.state = 'done'))
      from public.monthly_plan p where p.space_id = u.space_id and p.deleted_at is null order by p.cycle_start desc limit 1));
  end if;
  if 'close' = any (x.scope) then
    r := r || jsonb_build_object('close', (
      select jsonb_build_object('status', m.status, 'closed_at', m.closed_at,
        'income', case when x.raw_amount then to_jsonb(m.income) else to_jsonb(public.won_band(m.income)) end,
        'spent', case when x.raw_amount then to_jsonb((select coalesce(sum(s.amount), 0) from public.month_spend s where s.month_close_id = m.id and s.deleted_at is null))
                 else to_jsonb(public.won_band((select coalesce(sum(s.amount), 0) from public.month_spend s where s.month_close_id = m.id and s.deleted_at is null)::bigint)) end)
      from public.month_close m where m.space_id = u.space_id and m.deleted_at is null order by m.created_at desc limit 1));
  end if;
  if 'calendar' = any (x.scope) then
    r := r || jsonb_build_object('calendar', coalesce((
      select jsonb_agg(jsonb_build_object('name', c.name, 'kind', c.kind) order by c.name)
      from public.care_day c where c.space_id = u.space_id and c.deleted_at is null and not c.secret), '[]'::jsonb));
  end if;
  return r || jsonb_build_object('expires_at', x.expires_at, 'raw', x.raw_amount, 'scope', to_jsonb(x.scope));
end;
$$;
revoke execute on function public.admin_access_data(uuid) from public, anon;
grant execute on function public.admin_access_data(uuid) to authenticated;

-- ── AD-05 계정 조치: 전체 기기 로그아웃 / 권리 요구 기록(열람·정정·삭제) ───────
create or replace function public.admin_account_action(p_user uuid, p_action text, p_inquiry_no text, p_note text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['super', 'cs']::public.admin_role[]);
begin
  if p_action not in ('sign_out_all', 'rights_access', 'rights_fix', 'rights_delete') then
    raise exception 'bad_action' using errcode = '22023';
  end if;
  if not exists (select 1 from public.inquiry i where i.no = upper(btrim(p_inquiry_no))) then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.app_user where id = p_user) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  perform public.admin_log(a, 'execute', 'AD-05', p_user::text, p_note,
    jsonb_build_object('action', p_action, 'inquiry', upper(btrim(p_inquiry_no))));
  if p_action = 'sign_out_all' then
    delete from auth.sessions where user_id = p_user;
  end if;
end;
$$;
revoke execute on function public.admin_account_action(uuid, text, text, text) from public, anon;
grant execute on function public.admin_account_action(uuid, text, text, text) to authenticated;

-- ── AD-06 문의 처리 ──────────────────────────────────────────────────────
create or replace function public.admin_inquiries(p_status public.inquiry_status)
returns table (id uuid, no text, category text, status text, channel text, user_id uuid, created_at timestamptz, updated_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['super', 'ops', 'cs']::public.admin_role[]);
begin
  return query
    select q.id, q.no, q.category::text, q.status::text, q.channel, q.user_id, q.created_at, q.updated_at
    from public.inquiry q where q.status = p_status order by q.created_at;
end;
$$;
revoke execute on function public.admin_inquiries(public.inquiry_status) from public, anon;
grant execute on function public.admin_inquiries(public.inquiry_status) to authenticated;

create or replace function public.admin_inquiry_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['super', 'ops', 'cs']::public.admin_role[]);
begin
  return (select jsonb_object_agg(s, (select count(*) from public.inquiry q where q.status::text = s))
          from unnest(array['received', 'in_progress', 'waiting_user', 'done']) s);
end;
$$;
revoke execute on function public.admin_inquiry_counts() from public, anon;
grant execute on function public.admin_inquiry_counts() to authenticated;

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
    'messages', coalesce((select jsonb_agg(jsonb_build_object('author', m.author, 'body', m.body, 'created_at', m.created_at) order by m.created_at)
                          from public.inquiry_message m where m.inquiry_id = q.id), '[]'::jsonb),
    'access', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'status', x.status, 'scope', to_jsonb(x.scope), 'raw', x.raw_amount, 'expires_at', x.expires_at) order by x.created_at desc)
                        from public.access_request x where x.inquiry_id = q.id), '[]'::jsonb));
end;
$$;
revoke execute on function public.admin_inquiry(uuid) from public, anon;
grant execute on function public.admin_inquiry(uuid) to authenticated;

-- 답변 보내기(해요체): 메시지 + 상태(기본 ‘사용자 답변 대기’) + 문의한 사람 알림. 메일 사본은 메일 발송과 함께
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
begin
  select * into q from public.inquiry where id = p_id for update;
  if q.id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if coalesce(char_length(btrim(p_body)), 0) not between 1 and 4000 then
    raise exception 'bad_body' using errcode = '22023';
  end if;
  insert into public.inquiry_message (inquiry_id, author, admin_id, body) values (q.id, 'admin', a.id, btrim(p_body));
  update public.inquiry set status = p_status, updated_at = now(),
    done_at = case when p_status = 'done' then now() else null end
  where id = q.id;
  if q.user_id is not null then
    perform public.notify(q.user_id, (select space_id from public.app_user where id = q.user_id), 'inquiry_answered',
      '문의에 답변이 왔어요', '문의 #' || q.no || ' 답변을 내 문의에서 확인해 주세요',
      '/settings/help/inquiries/' || q.id, 'chat-circle-text', null, 'inquiry:' || q.id || ':' || now());
  end if;
  perform public.admin_log(a, 'execute', 'AD-06', q.no, null, jsonb_build_object('status', p_status));
end;
$$;
revoke execute on function public.admin_answer_inquiry(uuid, text, public.inquiry_status) from public, anon;
grant execute on function public.admin_answer_inquiry(uuid, text, public.inquiry_status) to authenticated;

create or replace function public.admin_set_inquiry_status(p_id uuid, p_status public.inquiry_status)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['cs']::public.admin_role[]);
  n text;
begin
  update public.inquiry set status = p_status, updated_at = now(),
    done_at = case when p_status = 'done' then now() else null end
  where id = p_id returning no into n;
  if n is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  perform public.admin_log(a, 'execute', 'AD-06', n, null, jsonb_build_object('status', p_status));
end;
$$;
revoke execute on function public.admin_set_inquiry_status(uuid, public.inquiry_status) from public, anon;
grant execute on function public.admin_set_inquiry_status(uuid, public.inquiry_status) to authenticated;

-- ── AD-17 감사 로그: 최고 관리자는 전체, 나머지는 본인 기록만 ─────────────────
create or replace function public.admin_audit_rows(
  p_admin text default null, p_target text default null, p_action text default null,
  p_from timestamptz default null, p_to timestamptz default null, p_limit integer default 200
)
returns setof public.admin_audit
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['super', 'ops', 'cs']::public.admin_role[]);
  everyone boolean := 'super' = any (a.roles);
begin
  return query
    select * from public.admin_audit l
    where (everyone or l.admin_id = a.id)
      and (p_admin is null or not everyone or l.admin_email = lower(p_admin))
      and (p_target is null or l.target = p_target)
      and (p_action is null or l.action = p_action)
      and (p_from is null or l.at >= p_from)
      and (p_to is null or l.at < p_to)
    order by l.at desc
    limit least(greatest(coalesce(p_limit, 200), 1), 1000);
end;
$$;
revoke execute on function public.admin_audit_rows(text, text, text, timestamptz, timestamptz, integer) from public, anon;
grant execute on function public.admin_audit_rows(text, text, text, timestamptz, timestamptz, integer) to authenticated;
