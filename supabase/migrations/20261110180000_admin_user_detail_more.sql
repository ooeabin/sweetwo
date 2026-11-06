-- AD-03 회원 상세(27 AD-03 4·5번)에 빠진 구조 정보 더함: 월급 관리 방식, 이번 달 체크리스트(상태, 체크한 줄 수),
-- 기기·앱 버전(app_device). 금액·항목명·메모는 여전히 없음. 기존 키는 그대로 둠(추가만).
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
begin
  select * into u from public.app_user where id = p_user;
  if u.id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  select email::text as email, created_at, last_sign_in_at into au from auth.users where id = p_user;
  select * into sp from public.couple_space where id = u.space_id;
  select x.id into partner from public.app_user x where x.space_id = u.space_id and x.id <> u.id and x.status = 'active' limit 1;
  perform public.admin_log(a, 'view', 'AD-03', p_user::text);
  return jsonb_build_object(
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
      'closes', (select count(*) from public.pay_checklist k where k.space_id = u.space_id and k.state = 'closed')),
    'plan_status', (select k.state from public.pay_checklist k where k.space_id = u.space_id
                     and (k.owner_user_id is null or k.owner_user_id = u.id) order by k.cycle_start desc limit 1),
    'salary_mode', sp.salary_mode,
    'checklist', (select jsonb_build_object('state', k.state, 'label', k.label,
                    'checked', (select count(*) from public.pay_check_line l where l.checklist_id = k.id and l.state = 'checked'),
                    'total', (select count(*) from public.pay_check_line l where l.checklist_id = k.id))
                  from public.pay_checklist k where k.space_id = u.space_id
                   and (k.owner_user_id is null or k.owner_user_id = u.id) order by k.cycle_start desc limit 1),
    'devices', coalesce((select jsonb_agg(jsonb_build_object('platform', d.platform, 'app_version', d.app_version, 'last_seen_at', d.last_seen_at) order by d.last_seen_at desc)
                         from public.app_device d where d.user_id = u.id), '[]'::jsonb),
    'sessions', (select count(*) from auth.sessions s where s.user_id = u.id),
    'access', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'status', x.status, 'scope', to_jsonb(x.scope), 'expires_at', x.expires_at) order by x.created_at desc)
                        from public.access_request x where x.user_id = u.id and x.status in ('requested', 'approved')), '[]'::jsonb));
end;
$$;
revoke execute on function public.admin_user_detail(uuid) from public, anon;
grant execute on function public.admin_user_detail(uuid) to authenticated;
