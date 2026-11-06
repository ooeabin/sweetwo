-- 2026-11-06 어드민 권한 정리(docs/spec/33-admin.md 2장).
-- 1) 최고 관리자는 운영 역할이 할 수 있는 것을 모두 할 수 있음(공지·콘텐츠·약관·앱 버전 작성). admin_require에서 'ops'를 요구하면 'super'도 통과.
-- 2) 작성자 본인도 승인할 수 있음(본인 승인 막기 없앰). 승인은 그대로 최고 관리자 + 재인증.
-- 3) 최고 관리자 최소 인원 2명 → 1명(마지막 최고 관리자의 역할을 빼거나 잠그는 것만 막음).

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
  if not ((a.roles && p_roles) or ('super' = any (a.roles) and 'ops' = any (p_roles))) then
    raise exception 'no_permission' using errcode = '42501';
  end if;
  return a;
end;
$$;
revoke execute on function public.admin_require(public.admin_role[]) from public, anon, authenticated;

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
       and (select count(*) from public.admin_user u where 'super' = any (u.roles) and not u.locked) <= 1 then
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
     and (select count(*) from public.admin_user u where 'super' = any (u.roles) and not u.locked) <= 1 then
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
