-- AD-05 계정 조치(27 AD-05, 33 운영 절차 ‘소셜 계정을 잃어버려 로그인할 수 없어요’).
-- 1) 삭제 대리 접수: 앱 접근이 안 될 때 본인 확인(문의 번호) 뒤 S-18과 같은 30일 유예. 고객 지원이 바로 실행.
-- 2) 로그인 수단 이전: 사용자가 새 소셜 계정으로 한 번 로그인 → 고객 지원이 기존 계정 + 새 계정(이메일 또는 사용자 ID)으로
--    승인 요청 → 최고 관리자 승인 때 새 계정의 로그인 수단을 기존 계정으로 옮기고 이전 수단은 해제, 새 계정은 지움.
--    전체 기기 로그아웃 + 가입 이메일로 완료 메일(상한 밖).

-- ── S-18 삭제 본문을 나눔(본인 요청과 어드민 대리 접수가 같은 규칙) ──────────────
create or replace function public.account_deletion_for(uid uuid)
returns date
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me public.app_user;
  sp public.couple_space;
  other uuid;
  ns uuid;
  x uuid;
begin
  select * into me from public.app_user where id = uid and status = 'active' for update;
  if me.id is null then
    raise exception 'not_active' using errcode = 'P0001';
  end if;
  select * into sp from public.couple_space where id = me.space_id for update;
  select id into other from public.app_user
    where space_id = sp.id and status = 'active' and id <> uid limit 1;

  if sp.id is not null and other is not null and sp.couple_state in ('connected', 'unlink_pending') then
    -- 연결 해제 확정과 같음: 두 사람 모두 빈 새 공간으로, 원래 공간(같이 쓰던 데이터 전부)은 30일 보관 뒤 지움
    update public.couple_unlink set status = 'cancelled', cancelled_at = now()
      where space_id = sp.id and status = 'pending';
    insert into public.couple_unlink (space_id, requested_by, partner_id, deadline, ratio, plan, status, how, confirmed_at,
                                      reconnect_until)
      values (sp.id, uid, other, public.kst_today(), 50, '[]'::jsonb, 'confirmed', 'deleted', now(),
              now() + interval '30 days');
    delete from public.notification where space_id = sp.id;
    delete from public.partner_change where space_id = sp.id;
    foreach x in array array[uid, other] loop
      insert into public.couple_space (couple_state, created_by, unlinked_from)
        values ('solo', x, sp.id) returning id into ns;
      update public.app_user set space_id = ns, onboarding_step = 'S-12H' where id = x;
    end loop;
    update public.couple_space set couple_state = 'solo', deleted_at = now() where id = sp.id;
    perform public.notify(other, (select space_id from public.app_user where id = other), 'partner_deleted',
      coalesce(me.nickname, '') || '님이 계정을 삭제했어요', '같이 쓰던 데이터는 지웠어요', '/settings/couple/unlinked',
      'user-minus', null, 'deleted:' || uid || ':' || extract(epoch from now())::bigint);
  elsif sp.id is not null then
    update public.invite set expires_at = now() where space_id = sp.id and used_at is null and expires_at > now();
  end if;

  update public.app_user set status = 'deletion_requested', deletion_requested_at = now() where id = uid;
  return (now() at time zone 'Asia/Seoul')::date + 30;
end;
$$;
revoke execute on function public.account_deletion_for(uuid) from public, anon, authenticated;

create or replace function public.request_account_deletion()
returns date
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not exists (select 1 from public.app_user where id = uid and status = 'active') then
    raise exception 'not_active' using errcode = 'P0001';
  end if;
  if coalesce((select last_sign_in_at from auth.users where id = uid), '-infinity') < now() - interval '10 minutes' then
    raise exception 'reauth_required' using errcode = 'P0001';
  end if;
  return public.account_deletion_for(uid);
end;
$$;

-- ── AD-05 실행: 삭제 대리 접수 추가 ─────────────────────────────────────
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
  elsif p_action = 'delete_request' then
    perform public.account_deletion_for(p_user);
  end if;
end;
$$;

-- ── 로그인 수단 이전 ─────────────────────────────────────────────────────
alter table public.admin_approval drop constraint if exists admin_approval_kind_check;
alter table public.admin_approval add constraint admin_approval_kind_check
  check (kind in ('notice_publish', 'terms_version', 'app_version', 'admin_add', 'admin_roles', 'login_move'));

-- 옮겨도 되는지(요청 때와 승인 때 둘 다 봄). 새 계정은 가입을 안 했거나, 했어도 혼자 쓰는 계정이어야 함
create or replace function public.login_move_check(p_user uuid, p_new uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  nu public.app_user;
begin
  if p_new is null or not exists (select 1 from auth.users where id = p_new) then
    raise exception 'new_not_found' using errcode = 'P0001';
  end if;
  if p_new = p_user then
    raise exception 'same_account' using errcode = '22023';
  end if;
  if not exists (select 1 from public.app_user where id = p_user and status = 'active') then
    raise exception 'not_active' using errcode = 'P0001';
  end if;
  if not exists (select 1 from auth.identities where user_id = p_new) then
    raise exception 'new_no_login' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.admin_user where id = p_new) then
    raise exception 'no_permission' using errcode = '42501';
  end if;
  select * into nu from public.app_user where id = p_new;
  if nu.id is not null and exists (select 1 from public.app_user m where m.space_id = nu.space_id and m.id <> nu.id) then
    raise exception 'new_has_partner' using errcode = 'P0001';
  end if;
end;
$$;
revoke execute on function public.login_move_check(uuid, uuid) from public, anon, authenticated;

-- 고객 지원 → 최고 관리자 승인 요청. p_new = 새 계정의 사용자 ID 또는 이메일(정확히 일치)
create or replace function public.admin_request_login_move(p_user uuid, p_new text, p_inquiry_no text, p_note text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.admin_user := public.admin_require(array['super', 'cs']::public.admin_role[]);
  q text := btrim(coalesce(p_new, ''));
  nid uuid;
  ino text := upper(btrim(coalesce(p_inquiry_no, '')));
begin
  if not exists (select 1 from public.inquiry i where i.no = ino) then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  if q ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select id into nid from auth.users where id = q::uuid;
  elsif q <> '' then
    select id into nid from auth.users where lower(email) = lower(q) and id <> p_user
      order by created_at desc limit 1;
  end if;
  perform public.login_move_check(p_user, nid);
  if exists (select 1 from public.admin_approval where kind = 'login_move' and status = 'requested'
             and (payload->>'user')::uuid = p_user) then
    raise exception 'already_requested' using errcode = 'P0001';
  end if;
  return public.admin_request_approval(a, 'login_move',
    jsonb_build_object('user', p_user, 'new_user', nid, 'inquiry', ino,
      'providers', (select jsonb_agg(provider order by created_at) from auth.identities where user_id = nid)),
    '로그인 수단 이전 ' || ino || coalesce(' ' || nullif(left(btrim(p_note), 100), ''), ''));
end;
$$;
revoke execute on function public.admin_request_login_move(uuid, text, text, text) from public, anon;
grant execute on function public.admin_request_login_move(uuid, text, text, text) to authenticated;

-- 승인 때 실제로 옮김
create or replace function public.login_move_apply(p jsonb, p_approval uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := (p->>'user')::uuid;
  nid uuid := (p->>'new_user')::uuid;
  nu public.app_user;
  me public.app_user;
  prov text;
  b record;
begin
  perform public.login_move_check(uid, nid);
  -- 새 계정이 만든 것(혼자 쓰는 공간)은 지움
  select * into nu from public.app_user where id = nid;
  if nu.space_id is not null then
    update public.app_user set space_id = null where id = nid;
    delete from public.couple_space where id = nu.space_id
      and not exists (select 1 from public.app_user m where m.space_id = nu.space_id);
  end if;
  select provider into prov from auth.identities where user_id = nid order by created_at limit 1;
  delete from auth.identities where user_id = uid;
  update auth.identities set user_id = uid where user_id = nid;
  delete from auth.users where id = nid;
  update public.app_user set provider = prov::public.auth_provider where id = uid
    returning * into me;
  delete from auth.sessions where user_id = uid;
  select * into b from public.noti_mail_body('로그인 수단을 바꿨어요', -- [확인 필요]
    '이제 새 계정으로 로그인해요. 본인이 아니면 바로 문의해 주세요');
  insert into public.mail_outbox (user_id, to_email, kind, subject, body_text, body_html, capped, dedupe)
    values (uid, btrim(me.notify_email), 'login_moved', '로그인 수단을 바꿨어요', b.body_text, b.body_html, false,
            'login_move:' || p_approval)
    on conflict (dedupe) do nothing;
end;
$$;
revoke execute on function public.login_move_apply(jsonb, uuid) from public, anon, authenticated;

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
    when 'app_version' then '16' when 'login_move' then '05' else '18' end, rid::text, p_summary, p_payload);
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
  elsif x.kind = 'login_move' then
    perform public.login_move_apply(p, x.id);
  end if;
  perform public.admin_log(a, 'approve', 'AD-' || case x.kind when 'notice_publish' then '10' when 'terms_version' then '15'
    when 'app_version' then '16' when 'login_move' then '05' else '18' end, x.id::text, p_decision, p, a.id);
end;
$$;
