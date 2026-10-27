-- AD-04 금액 원값(27 AD-04 4번): 체크하면 화면 1개만, 최고 관리자 승인 뒤 사용자에게 S-19b 요청.
-- 승인 거절이면 구간으로만 요청(같은 범위, raw_amount = false)을 사용자에게 보냄. 요청자는 고객 지원 그대로.

alter table public.admin_approval drop constraint if exists admin_approval_kind_check;
alter table public.admin_approval add constraint admin_approval_kind_check
  check (kind in ('notice_publish', 'terms_version', 'app_version', 'admin_add', 'admin_roles', 'login_move', 'access_raw'));

-- 사용자에게 동의 요청 보내기(S-19b). 감사 로그는 요청한 관리자 이름으로
create or replace function public.access_send(q public.inquiry, p_admin uuid, p_scopes text[], p_raw boolean, p_reason text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.admin_user;
  rid uuid;
begin
  select * into a from public.admin_user where id = p_admin;
  insert into public.access_request (inquiry_id, user_id, admin_id, reason, scope, raw_amount)
    values (q.id, q.user_id, p_admin, p_reason, p_scopes, p_raw)
    returning id into rid;
  perform public.notify(q.user_id, (select space_id from public.app_user where id = q.user_id), 'access_request',
    '문의를 확인하려면 동의가 필요해요', '동의한 범위만, 정한 기간 동안 봐요',
    '/settings/help/access/' || rid, 'shield-check', null, 'access:' || rid || ':request');
  perform public.admin_log(a, 'request', 'AD-04', q.user_id::text, p_reason,
    jsonb_build_object('inquiry', q.no, 'scopes', to_jsonb(p_scopes), 'raw', p_raw, 'access_id', rid));
  return rid;
end;
$$;
revoke execute on function public.access_send(public.inquiry, uuid, text[], boolean, text) from public, anon, authenticated;

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
  select * into q from public.inquiry where id = p_inquiry;
  if q.id is null or q.user_id is null or q.status = 'done' then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if p_scopes is null or array_length(p_scopes, 1) is null
     or exists (select 1 from unnest(p_scopes) s
                where s not in ('month', 'plan', 'close', 'goals', 'assets', 'income_spend', 'calendar')) then
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
    when 'app_version' then '16' when 'login_move' then '05' when 'access_raw' then '04' else '18' end, rid::text, p_summary, p_payload);
  return rid;
end;
$$;
revoke execute on function public.admin_request_approval(public.admin_user, text, jsonb, text) from public, anon, authenticated;

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
    update public.admin_user set roles = array(select jsonb_array_elements_text(p->'roles'))::public.admin_role[]
      where email = p->>'email';
  elsif x.kind = 'login_move' then
    perform public.login_move_apply(p, x.id);
  end if;
  perform public.admin_log(a, 'approve', 'AD-' || case x.kind when 'notice_publish' then '10' when 'terms_version' then '15'
    when 'app_version' then '16' when 'login_move' then '05' when 'access_raw' then '04' else '18' end, x.id::text, p_decision, p, a.id);
end;
$$;
