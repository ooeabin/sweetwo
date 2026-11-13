-- AD-01 대시보드 더 보기(2026-11-06, docs/spec/27-admin-screens.md AD-01 4~7번).
-- 회원 현황(오늘 가입·어제 가입·오늘 삭제 요청·전체 회원·연결된 부부), 최근 7일 추이(가입·부부 연결·체크한 줄),
-- 앱 버전(최소 지원 버전 미만 기기 수 + 버전별 기기 수 상위 8), 최근 활동(승인 대기 수, 최근 문의 5건, 최근 감사 로그 5줄).
-- 모두 집계값. 문의 본문·이메일·금액은 내보내지 않음. 감사 로그는 admin_audit_rows와 같은 규칙(최고 관리자는 모두, 나머지는 자기 것만, 분석은 없음).
-- 기존 키(inquiries, failed, alerts, at)는 그대로 둔다.

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
          and v.app_version ~ '^\d{1,4}(\.\d{1,4}){0,3}$'
          and public.version_below(v.app_version, case v.platform
                when 'desktop' then coalesce(cfg.min_version_desktop, '0.0.0')
                when 'ios' then coalesce(cfg.min_version_ios, '0.0.0')
                else coalesce(cfg.min_version_android, '0.0.0') end)),
      'top', coalesce((
        select jsonb_agg(jsonb_build_object('platform', t.platform, 'version', t.app_version, 'devices', t.n)
                         order by t.n desc, t.platform, t.app_version)
        from (select v.platform, v.app_version, count(*) as n from public.app_device v
              where v.last_seen_at >= week
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
revoke execute on function public.admin_dashboard() from public, anon;
grant execute on function public.admin_dashboard() to authenticated;
