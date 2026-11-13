-- QA 12구간(2026-11-12) 어드민 서버 고침. docs/spec/27-admin-screens.md AD-01·AD-04·AD-05·AD-16.
-- 1) S12-06(D3): AD-04 L1 `admin_reveal`과 AD-05 `admin_account_action`은 문의 번호가 그 회원(또는 지금 연결된 파트너)의
--    문의일 때만. 아무 문의 번호로 어떤 회원이든 열람·조치하던 것을 막음. 거절은 문의 번호가 없을 때와 같은 reason_required.
-- 2) S12-15: `admin_request_app_config`은 데스크톱·웹 버전 키(min_version_desktop, latest_version_desktop, min_version_web)를
--    새 요청에서 거절(ADR 0008, 열은 나중에 2단계로 지움). AD-01 대시보드 앱 버전 칸은 데스크톱 기기를 셈에서 뺌.

-- 문의 번호가 이 사용자 것인지: 문의한 사람 본인, 또는 문의한 사람과 지금 같은 공간에 있는 파트너. 이메일 문의로 회원 연결이 없으면 아님
create or replace function public.inquiry_is_about(p_inquiry_no text, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.inquiry i
    where i.no = upper(btrim(coalesce(p_inquiry_no, '')))
      and i.user_id is not null
      and (i.user_id = p_user
           or exists (select 1 from public.app_user me join public.app_user pt on pt.space_id = me.space_id
                      where me.id = i.user_id and pt.id = p_user and pt.id <> me.id)));
$$;
revoke execute on function public.inquiry_is_about(text, uuid) from public, anon, authenticated;

-- ── AD-04 L1 ─────────────────────────────────────────────────────────────
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
  if coalesce(btrim(p_reason), '') = '' or not public.inquiry_is_about(p_inquiry_no, p_user) then
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

-- ── AD-05 계정 조치 ───────────────────────────────────────────────────────
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
  if p_action not in ('sign_out_all', 'delete_request', 'rights_access', 'rights_fix', 'rights_delete') then
    raise exception 'bad_action' using errcode = '22023';
  end if;
  if not public.inquiry_is_about(p_inquiry_no, p_user) then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.app_user where id = p_user) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  perform public.admin_log(a, 'execute', 'AD-05', p_user::text, p_note,
    jsonb_build_object('action', p_action, 'inquiry', upper(btrim(p_inquiry_no))));
  if p_action = 'sign_out_all' then
    delete from auth.sessions where user_id = p_user;
  elsif p_action = 'delete_request' then
    perform public.account_deletion_for(p_user);
  end if;
end;
$$;

-- ── AD-16 앱 버전·점검 요청: iOS·Android·점검만 ──────────────────────────
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
      'min_version_ios', 'min_version_android',
      'maintenance_starts_at', 'maintenance_ends_at', 'maintenance_message'))
     or (p ? 'maintenance_starts_at' and p->>'maintenance_starts_at' is not null
         and (p->>'maintenance_ends_at') is null)
     or (p ? 'min_version_ios' and coalesce(p->>'min_version_ios', '') !~ '^\d+\.\d+\.\d+$')
     or (p ? 'min_version_android' and coalesce(p->>'min_version_android', '') !~ '^\d+\.\d+\.\d+$') then
    raise exception 'bad_value' using errcode = '22023';
  end if;
  return public.admin_request_approval(a, 'app_version', p, '앱 버전·점검 변경');
end;
$$;

-- ── AD-01 대시보드: 앱 버전 칸은 iOS·Android 기기만 ──────────────────────
create or replace function public.admin_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['super', 'ops', 'cs', 'analyst']::public.admin_role[]);
  d0 date := public.kst_today();
  today timestamptz := (d0::timestamp at time zone 'Asia/Seoul');
  yesterday timestamptz := ((d0 - 1)::timestamp at time zone 'Asia/Seoul');
  week timestamptz := ((d0 - 6)::timestamp at time zone 'Asia/Seoul');
  can_ops boolean := a.roles && array['super', 'ops', 'cs']::public.admin_role[];
  everyone boolean := 'super' = any (a.roles);
  cfg public.app_config;
  plans integer := 0;
  notis integer := 0;
  rate_days integer;
  alerts jsonb := '[]'::jsonb;
begin
  if to_regclass('cron.job_run_details') is not null then
    execute $q$
      select count(*) filter (where j.jobname = 'cycle-checklists'),
             count(*) filter (where j.jobname in ('send-morning-notifications', 'send-evening-notifications',
               'living-check-notifications', 'mail-missed-notifications', 'send-weekly-summary', 'send-notice-mails',
               'kick-push', 'kick-mail'))
      from cron.job_run_details d join cron.job j on j.jobid = d.jobid
      where d.status = 'failed' and d.start_time >= $1
    $q$ into plans, notis using today;
  end if;
  select (d0 - min(updated_at at time zone 'Asia/Seoul')::date) into rate_days from public.loan_rate;
  if rate_days is not null and rate_days > 90 then
    alerts := alerts || jsonb_build_array(jsonb_build_object('kind', 'loan_rate_stale', 'value', rate_days, 'limit', 90));
  end if;
  select * into cfg from public.app_config where id = 1;

  return jsonb_build_object(
    'inquiries', jsonb_build_object(
      'received', (select count(*) from public.inquiry where status = 'received'),
      'in_progress', (select count(*) from public.inquiry where status = 'in_progress')),
    'failed', jsonb_build_object('plans', plans, 'notifications', notis),
    'alerts', alerts,
    'members', jsonb_build_object(
      'total', (select count(*) from public.app_user where status <> 'deleted'),
      'joined_today', (select count(*) from public.app_user where created_at >= today),
      'joined_yesterday', (select count(*) from public.app_user where created_at >= yesterday and created_at < today),
      'deletion_today', (select count(*) from public.app_user where deletion_requested_at >= today),
      'connected', (select count(*) from public.couple_space where couple_state = 'connected')),
    'trend', (
      select jsonb_agg(jsonb_build_object(
        'day', g.day,
        'joined', (select count(*) from public.app_user u
                   where (u.created_at at time zone 'Asia/Seoul')::date = g.day),
        'connected', (select count(*) from public.invite i
                      where i.used_at is not null and (i.used_at at time zone 'Asia/Seoul')::date = g.day),
        'checked', (select count(*) from public.pay_check_line l
                    where l.state = 'checked' and (l.checked_at at time zone 'Asia/Seoul')::date = g.day))
        order by g.day)
      from (select (d0 - n)::date as day from generate_series(6, 0, -1) n) g),
    'versions', jsonb_build_object(
      'below_min', (
        select count(*) from public.app_device v
        where v.last_seen_at >= week
          and v.platform in ('ios', 'android')
          and v.app_version ~ '^\d{1,4}(\.\d{1,4}){0,3}$'
          and public.version_below(v.app_version, case v.platform
                when 'ios' then coalesce(cfg.min_version_ios, '0.0.0')
                else coalesce(cfg.min_version_android, '0.0.0') end)),
      'top', coalesce((
        select jsonb_agg(jsonb_build_object('platform', t.platform, 'version', t.app_version, 'devices', t.n)
                         order by t.n desc, t.platform, t.app_version)
        from (select v.platform, v.app_version, count(*) as n from public.app_device v
              where v.last_seen_at >= week and v.platform in ('ios', 'android')
              group by v.platform, v.app_version
              order by count(*) desc, v.platform, v.app_version limit 8) t), '[]'::jsonb)),
    'recent', jsonb_build_object(
      'approvals', case when can_ops
        then (select count(*) from public.admin_approval where status = 'requested') end,
      'inquiries', case when can_ops then coalesce((
        select jsonb_agg(jsonb_build_object('id', q.id, 'no', q.no, 'category', q.category, 'channel', q.channel,
                                            'status', q.status, 'created_at', q.created_at) order by q.created_at desc)
        from (select * from public.inquiry order by created_at desc limit 5) q), '[]'::jsonb) end,
      'audit', case when can_ops then coalesce((
        select jsonb_agg(jsonb_build_object('at', l.at, 'admin_email', l.admin_email, 'action', l.action,
                                            'screen', l.screen) order by l.at desc)
        from (select * from public.admin_audit x where everyone or x.admin_id = a.id order by x.at desc limit 5) l),
        '[]'::jsonb) end),
    'at', now());
end;
$$;
