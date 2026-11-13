-- 어드민 재인증(33 3장 ‘재인증’, 27 AD-04 5번): L2 동의 요청, 승인·거절(발송·약관·버전·권한 변경), 관리자 잠금 직전에
-- 인증 앱 숫자를 다시 받음. 최근 5분 안에 인증 앱(totp)으로 확인한 세션만 통과(JWT amr의 totp 시각).
-- 최고 관리자 최소 2명(33 2장): 역할 회수·잠금으로 잠기지 않은 최고 관리자가 2명보다 적어지면 막음.
-- L2 범위는 지금 앱 화면만(month, goals, assets, calendar). 예전 키는 기록 읽기만.

create or replace function public.admin_require_fresh(p_seconds integer default 300)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  ts double precision;
begin
  select max((e->>'timestamp')::double precision) into ts
    from jsonb_array_elements(coalesce(auth.jwt()->'amr', '[]'::jsonb)) e
    where e->>'method' = 'totp';
  if ts is null or extract(epoch from now()) - ts > p_seconds then
    raise exception 'reauth_required' using errcode = '42501';
  end if;
end;
$$;
revoke execute on function public.admin_require_fresh(integer) from public, anon, authenticated;

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
begin
  perform public.admin_require_fresh();
  select * into q from public.inquiry where id = p_inquiry;
  if q.id is null or q.user_id is null or q.status = 'done' then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if p_scopes is null or array_length(p_scopes, 1) is null
     or exists (select 1 from unnest(p_scopes) s
                where s not in ('month', 'goals', 'assets', 'calendar')) then
    raise exception 'bad_scope' using errcode = '22023';
  end if;
  -- 금액 원값은 화면 1개만, 최고 관리자 승인 뒤에 사용자에게 요청. 돌려주는 값 = 승인 요청 ID
  if p_raw then
    if array_length(p_scopes, 1) <> 1 then
      raise exception 'raw_one_screen' using errcode = '22023';
    end if;
    return public.admin_request_approval(a, 'access_raw',
      jsonb_build_object('inquiry_id', q.id, 'inquiry', q.no, 'scopes', to_jsonb(p_scopes), 'reason', p_reason),
      '금액 원값 열람 ' || q.no);
  end if;
  return public.access_send(q, a.id, p_scopes, false, p_reason);
end;
$$;
revoke execute on function public.admin_request_access(uuid, text[], boolean, text) from public, anon;
grant execute on function public.admin_request_access(uuid, text[], boolean, text) to authenticated;

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
  perform public.admin_require_fresh();
  update public.admin_approval set status = case when p_decision = 'approve' then 'approved' else 'rejected' end,
    decided_by = a.id, decided_at = now() where id = x.id;
  p := x.payload;
  if x.kind = 'access_raw' then
    -- 승인 = 원값으로, 거절 = 구간으로만 사용자에게 요청. 문의가 끝났거나 사용자가 없으면 보내지 않음
    perform public.access_send(q, x.requested_by, array(select jsonb_array_elements_text(p->'scopes')), p_decision = 'approve',
      p->>'reason')
      from public.inquiry q where q.id = (p->>'inquiry_id')::uuid and q.user_id is not null and q.status <> 'done';
  elsif p_decision = 'reject' then
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
    if exists (select 1 from public.admin_user u where u.email = p->>'email' and 'super' = any (u.roles) and not u.locked)
       and not ('super' = any (array(select jsonb_array_elements_text(p->'roles'))))
       and (select count(*) from public.admin_user u where 'super' = any (u.roles) and not u.locked) <= 2 then
      raise exception 'super_min' using errcode = '22023';
    end if;
    update public.admin_user set roles = array(select jsonb_array_elements_text(p->'roles'))::public.admin_role[]
      where email = p->>'email';
  elsif x.kind = 'login_move' then
    perform public.login_move_apply(p, x.id);
  end if;
  perform public.admin_log(a, 'approve', 'AD-' || case x.kind when 'notice_publish' then '10' when 'terms_version' then '15'
    when 'app_version' then '16' when 'login_move' then '05' when 'access_raw' then '04' else '18' end, x.id::text, p_decision, p, a.id);
end;
$$;
revoke execute on function public.admin_decide(uuid, text) from public, anon;
grant execute on function public.admin_decide(uuid, text) to authenticated;

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
  perform public.admin_require_fresh();
  if lower(p_email) = a.email then
    raise exception 'self_lock' using errcode = '22023';
  end if;
  if p_locked and exists (select 1 from public.admin_user u where u.email = lower(p_email) and 'super' = any (u.roles) and not u.locked)
     and (select count(*) from public.admin_user u where 'super' = any (u.roles) and not u.locked) <= 2 then
    raise exception 'super_min' using errcode = '22023';
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

-- ── AD-01 대시보드(27 AD-01): 실패 건수는 pg_cron 실행 기록(cron.job_run_details)에서 오늘(KST) 실패만 셈.
-- 상시 경보(alerts): 지금은 AD-19 ‘마지막 갱신 90일 넘음’(평균 금리)만. 성공 지표 3장 경보는 분석 도구 연결 뒤.
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
  select (public.kst_today() - min(updated_at at time zone 'Asia/Seoul')::date) into rate_days from public.loan_rate;
  if rate_days is not null and rate_days > 90 then
    alerts := alerts || jsonb_build_array(jsonb_build_object('kind', 'loan_rate_stale', 'value', rate_days, 'limit', 90));
  end if;
  return jsonb_build_object(
    'inquiries', jsonb_build_object(
      'received', (select count(*) from public.inquiry where status = 'received'),
      'in_progress', (select count(*) from public.inquiry where status = 'in_progress')),
    'failed', jsonb_build_object('plans', plans, 'notifications', notis),
    'alerts', alerts,
    'at', now());
end;
$$;
revoke execute on function public.admin_dashboard() from public, anon;
grant execute on function public.admin_dashboard() to authenticated;
