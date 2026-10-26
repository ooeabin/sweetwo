-- 재기획(ADR 0003) 전 DB 객체 지우기 2단계. 1단계(앱이 더는 안 씀)는 #122·#123에서 끝남.
--   지우는 것: 제안, 월 플랜·플랜 줄·월급 나누기, 월말 정리(지출·큰 지출·납입·잔액·함께 모드), 생활비 체크, 들어오는 돈·기간 수입,
--     결혼 비용 항목·결제, 비상금 이동, 목표 사용 기록(goal_use), 첫 주 할 일(todo), 가족 목록, 해제 사본 표(unlink_copy)와
--     그 함수·트리거·예약 작업. 열거형(enum)과 남는 표의 옛 열(care_day.member_id 등)은 그대로 둠(새로 안 씀).
--   남는 함수는 옛 표 없이 다시 정의: 챙길 날 기록(record_care), 휴지통, 어드민 회원·열람, 계정 삭제(새 모델).

-- ── 챙길 날 기록(Y-08): 기록만(낸 곳은 각자 돈, 목표·플랜 줄 없음. 목표 돈을 썼으면 앱이 G-02b 꺼내 쓰기로) ──
create or replace function public.record_care(
  p_care uuid,
  p_on date,
  p_amount bigint,
  p_paid_from public.paid_from,
  p_gifts text[],
  p_gift_name text,
  p_memo text,
  p_move bigint
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  me public.app_user;
  c public.care_day;
  rid uuid;
begin
  select * into me from public.app_user where id = uid and status = 'active';
  select * into c from public.care_day where id = p_care and deleted_at is null;
  if c.id is null or me.space_id is distinct from c.space_id or (c.secret and c.created_by is distinct from uid) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if p_amount < 0 or p_amount > 99999999999 then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  insert into public.care_record (space_id, care_day_id, occurs_on, amount, paid_from, gifts, gift_name, memo)
  values (c.space_id, c.id, p_on, p_amount, 'personal', coalesce(p_gifts, '{}'),
          nullif(btrim(p_gift_name), ''), nullif(btrim(p_memo), ''))
  returning id into rid;
  update public.care_day set status = 'done', status_on = p_on where id = c.id;
  return jsonb_build_object('record', rid, 'line', 0);
end;
$$;

-- ── 휴지통(S-21): 자산·부채, 목표, 챙길 날 ─────────────────────────────────────
create or replace function public.trash_rows()
returns table (kind text, id uuid, name text, sub text, deleted_at timestamptz, deleted_by uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select u.id, u.space_id from public.app_user u where u.id = auth.uid() and u.status = 'active')
  select 'asset', a.id, a.name, a.side::text, a.deleted_at, a.deleted_by
    from public.asset a, me
    where a.space_id = me.space_id and a.deleted_at is not null and a.deleted_at > now() - interval '30 days'
      and (a.owner = 'joint' or a.owner_user_id = me.id or (a.owner_user_id is null and a.created_by = me.id))
  union all
  select 'goal', g.id, g.name, null, g.deleted_at, g.deleted_by
    from public.goal g, me
    where g.space_id = me.space_id and g.deleted_at is not null and g.deleted_at > now() - interval '30 days'
      and (g.owner_user_id is null or g.owner_user_id = me.id) -- 배우자 내 목표는 안 보임
  union all
  select 'care_day', c.id, c.name, null, c.deleted_at, c.deleted_by
    from public.care_day c, me
    where c.space_id = me.space_id and c.deleted_at is not null and c.deleted_at > now() - interval '30 days'
      and (not c.secret or c.created_by = me.id)
  order by 5 desc;
$$;

create or replace function public.restore_trash(p_kind text, p_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  t timestamptz;
begin
  if not exists (select 1 from public.trash_rows() r where r.kind = p_kind and r.id = p_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if p_kind = 'asset' then
    update public.asset set deleted_at = null where id = p_id;
  elsif p_kind = 'goal' then
    update public.goal g set deleted_at = null,
      priority = (select coalesce(max(x.priority), 0) + 1 from public.goal x where x.space_id = g.space_id and x.deleted_at is null)
      where g.id = p_id;
  elsif p_kind = 'care_day' then
    select deleted_at into t from public.care_day where id = p_id;
    update public.care_day set deleted_at = null where id = p_id;
    update public.care_record set deleted_at = null
      where care_day_id = p_id and deleted_at is not null and abs(extract(epoch from deleted_at - t)) <= 10;
  end if;
  return 'restored';
end;
$$;

create or replace function public.purge_trash(p_kind text default null, p_id uuid default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r record;
  n integer := 0;
begin
  for r in select * from public.trash_rows() x
           where (p_id is null or (x.kind = p_kind and x.id = p_id)) loop
    if r.kind = 'asset' then delete from public.asset where id = r.id;
    elsif r.kind = 'goal' then delete from public.goal where id = r.id;
    elsif r.kind = 'care_day' then delete from public.care_day where id = r.id;
    end if;
    n := n + 1;
  end loop;
  if p_id is not null and n = 0 then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  return n;
end;
$$;

create or replace function public.purge_old_trash()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  delete from public.care_record where deleted_at < now() - interval '30 days';
  delete from public.care_day where deleted_at < now() - interval '30 days';
  delete from public.goal where deleted_at < now() - interval '30 days';
  delete from public.asset where deleted_at < now() - interval '30 days';
end;
$$;

-- ── 어드민(AD-03 회원, AD-04 열람): 플랜·정리 대신 월급 체크리스트. 키 이름은 그대로(closes = 끝난 체크리스트 수) ──
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
    'sessions', (select count(*) from auth.sessions s where s.user_id = u.id),
    'access', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'status', x.status, 'scope', to_jsonb(x.scope), 'expires_at', x.expires_at) order by x.created_at desc)
                        from public.access_request x where x.user_id = u.id and x.status in ('requested', 'approved')), '[]'::jsonb));
end;
$$;

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
      from public.goal g where g.space_id = u.space_id and g.deleted_at is null
        and (g.owner_user_id is null or g.owner_user_id = u.id)), '[]'::jsonb));
  end if;
  if 'assets' = any (x.scope) then
    r := r || jsonb_build_object('assets', coalesce((
      select jsonb_agg(jsonb_build_object('name', s.name, 'grp', s.grp, 'side', s.side, 'estimated', s.estimated,
        'amount', case when x.raw_amount then to_jsonb(s.amount) else to_jsonb(public.won_band(s.amount)) end)
        order by s.side, s.amount desc)
      from public.asset s
      where s.space_id = u.space_id and s.deleted_at is null and s.status = 'held'
        and (s.owner = 'joint' or s.owner_user_id = u.id or s.visibility = 'all')), '[]'::jsonb));
  end if;
  -- 이번 달(옛 ‘월 플랜’ 범위): 내 이번 사이클 체크리스트 상태와 체크 개수
  if 'plan' = any (x.scope) or 'month' = any (x.scope) then
    r := r || jsonb_build_object('plan', (
      select jsonb_build_object('label_month', k.label, 'cycle_start', k.cycle_start, 'cycle_end', k.cycle_end, 'status', k.state,
        'lines', (select count(*) from public.pay_check_line l where l.checklist_id = k.id),
        'done', (select count(*) from public.pay_check_line l where l.checklist_id = k.id and l.state = 'checked'))
      from public.pay_checklist k where k.space_id = u.space_id and (k.owner_user_id is null or k.owner_user_id = u.id)
      order by k.cycle_start desc limit 1));
  end if;
  if 'calendar' = any (x.scope) then
    r := r || jsonb_build_object('calendar', coalesce((
      select jsonb_agg(jsonb_build_object('name', c.name, 'kind', c.kind) order by c.name)
      from public.care_day c where c.space_id = u.space_id and c.deleted_at is null and not c.secret), '[]'::jsonb));
  end if;
  return r || jsonb_build_object('expires_at', x.expires_at, 'raw', x.raw_amount, 'scope', to_jsonb(x.scope));
end;
$$;

-- ── 계정 삭제(25 S-18b, 08 8장): 공동 항목은 상대에게 남고, 내 명의 항목·내 목표·내 분배표·체크리스트는
-- 나와 함께 새 공간(혼자 쓰기)으로 옮겨 30일 보관 → 다시 로그인하면 그대로 혼자 쓰기, 30일 뒤 공간째 지움.
-- 상대는 원래 공간에서 혼자 쓰기로 이어짐 + 알림. 삭제를 취소하면 30일 안 다시 연결 가능(03 14번, 15 로그인):
-- 새 공간은 원래 공간에서 나온 공간(unlinked_from)으로 두고, 다시 연결하면 내 항목을 원래 공간으로 되돌림.
create or replace function public.request_account_deletion()
returns date
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  me public.app_user;
  sp public.couple_space;
  other uuid;
  ns uuid;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into me from public.app_user where id = uid and status = 'active' for update;
  if me.id is null then
    raise exception 'not_active' using errcode = 'P0001';
  end if;
  if coalesce((select last_sign_in_at from auth.users where id = uid), '-infinity') < now() - interval '10 minutes' then
    raise exception 'reauth_required' using errcode = 'P0001';
  end if;
  select * into sp from public.couple_space where id = me.space_id for update;
  select id into other from public.app_user
    where space_id = sp.id and status = 'active' and id <> uid limit 1;

  if sp.id is not null and other is not null and sp.couple_state in ('connected', 'unlink_pending') then
    update public.couple_unlink set status = 'cancelled', cancelled_at = now()
      where space_id = sp.id and status = 'pending';
    insert into public.couple_space (couple_state, created_by, unlinked_from) values ('solo', uid, sp.id) returning id into ns;
    -- 내 것만 새 공간으로
    update public.asset_history h set space_id = ns
      from public.asset a where a.id = h.asset_id and a.space_id = sp.id and a.owner = 'person' and a.owner_user_id = uid;
    update public.asset set space_id = ns where space_id = sp.id and owner = 'person' and owner_user_id = uid;
    update public.goal_move m set space_id = ns
      from public.goal g where g.id = m.goal_id and g.space_id = sp.id and g.owner_user_id = uid;
    delete from public.split_line l using public.goal g
      where l.goal_id = g.id and g.space_id = sp.id and g.owner_user_id = uid
        and l.split_id in (select s.id from public.salary_split s where s.space_id = sp.id and s.owner_user_id is distinct from uid);
    update public.goal set space_id = ns where space_id = sp.id and owner_user_id = uid;
    update public.split_line set space_id = ns
      where split_id in (select id from public.salary_split where space_id = sp.id and owner_user_id = uid);
    update public.salary_split set space_id = ns where space_id = sp.id and owner_user_id = uid;
    update public.pay_check_line set space_id = ns
      where checklist_id in (select id from public.pay_checklist where space_id = sp.id and owner_user_id = uid);
    update public.pay_checklist set space_id = ns where space_id = sp.id and owner_user_id = uid;
    -- 공동 분배표의 내 용돈 줄은 뺌
    delete from public.split_line
      where kind = 'allowance' and user_id = uid
        and split_id in (select id from public.salary_split where space_id = sp.id and owner_user_id is null);
    delete from public.notification where user_id = uid;
    delete from public.partner_change where actor_id = uid or receiver_id = uid;
    update public.app_user set space_id = ns where id = uid;
    update public.couple_space set couple_state = 'solo' where id = sp.id;
    insert into public.couple_unlink (space_id, requested_by, partner_id, deadline, ratio, plan, status, how, confirmed_at,
                                      reconnect_until)
      values (sp.id, uid, other, public.kst_today(), 50, '[]'::jsonb, 'confirmed', 'deleted', now(),
              now() + interval '30 days');
    perform public.notify(other, sp.id, 'partner_deleted',
      coalesce(me.nickname, '') || '님이 계정을 삭제했어요', '이제 혼자 쓰기로 이어져요', '/', 'user-minus', null,
      'deleted:' || uid || ':' || extract(epoch from now())::bigint);
  elsif sp.id is not null then
    update public.invite set expires_at = now() where space_id = sp.id and used_at is null and expires_at > now();
  end if;

  update public.app_user set status = 'deletion_requested', deletion_requested_at = now() where id = uid;
  return (now() at time zone 'Asia/Seoul')::date + 30;
end;
$$;

-- 30일 안 다시 로그인해 취소: 혼자 쓰기로. 연결돼 있던 배우자에게 ‘계정 복구’ 알림
create or replace function public.cancel_account_deletion()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  me public.app_user;
  u public.couple_unlink;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into me from public.app_user where id = uid and status = 'deletion_requested' for update;
  if me.id is null or me.deletion_requested_at < now() - interval '30 days' then
    raise exception 'not_requested' using errcode = 'P0001';
  end if;
  update public.app_user set status = 'active', deletion_requested_at = null where id = uid;
  select * into u from public.couple_unlink
    where requested_by = uid and how = 'deleted' and status = 'confirmed'
      and confirmed_at >= me.deletion_requested_at - interval '1 minute'
    order by confirmed_at desc limit 1;
  if u.id is not null and u.partner_id is not null then
    -- 복구한 때부터 30일 안 다시 연결 가능(08 8장)
    update public.couple_unlink set reconnect_until = now() + interval '30 days' where id = u.id;
    perform public.notify(u.partner_id, (select space_id from public.app_user where id = u.partner_id),
      'partner_restored', coalesce(me.nickname, '') || '님이 계정 삭제를 취소했어요',
      null, '/settings/couple', null, uid,
      'unlink:' || u.id || ':restored:' || extract(epoch from now())::bigint);
  end if;
end;
$$;

-- ── 다시 연결(S-12g): 계정 삭제 뒤에도. 상대는 원래 공간에 그대로 있음 ───────────────────
create or replace function public.my_unlink()
returns setof public.couple_unlink
language sql
stable
security definer
set search_path = ''
as $$
  select u.* from public.couple_unlink u
  join public.app_user me on me.id = auth.uid()
  join public.couple_space s on s.id = me.space_id
  where u.status = 'confirmed' and (u.requested_by = me.id or u.partner_id = me.id)
    and (s.unlinked_from = u.space_id or (u.how = 'deleted' and s.id = u.space_id))
  order by u.confirmed_at desc limit 1;
$$;

create or replace function public.reconnect_ok(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select u.status = 'confirmed' and u.reconnect_until > now()
    and (select count(*) from public.app_user m
         join public.couple_space s on s.id = m.space_id
         where m.id in (u.requested_by, u.partner_id) and m.status = 'active'
           and (s.unlinked_from = u.space_id or (u.how = 'deleted' and s.id = u.space_id))
           and s.deleted_at is null
           and s.couple_state in ('solo', 'not_joined')
           and (select count(*) from public.app_user o where o.space_id = s.id and o.status = 'active') = 1) = 2
  from public.couple_unlink u where u.id = p_id;
$$;
revoke execute on function public.reconnect_ok(uuid) from public, anon, authenticated;

-- 받아들이면 원래 공간으로. 해제 뒤 새로 만든 공간은 지움. 계정 삭제였으면 삭제한 사람 공간의 항목(원래 내 것)을 먼저 되돌림
create or replace function public.answer_reconnect(p_accept boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  u public.couple_unlink;
  s uuid;
  x uuid;
  n uuid;
  t text;
  who text;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into u from public.couple_unlink where id = (select m.id from public.my_unlink() m) for update;
  if u.id is null or u.reconnect_by is null or u.reconnect_answer is not null then
    raise exception 'no_request' using errcode = 'P0001';
  end if;
  if u.reconnect_by = uid then
    raise exception 'not_partner' using errcode = '42501';
  end if;
  if not p_accept then
    update public.couple_unlink set reconnect_answer = 'declined' where id = u.id;
    return;
  end if;
  if not coalesce(public.reconnect_ok(u.id), false) then
    raise exception 'reconnect_closed' using errcode = 'P0001';
  end if;
  s := u.space_id;
  foreach x in array array[u.requested_by, u.partner_id] loop
    select space_id into n from public.app_user where id = x;
    if u.how = 'deleted' and n <> s then
      for t in
        select c.table_name from information_schema.columns c
        join information_schema.tables b on b.table_schema = c.table_schema and b.table_name = c.table_name
        where c.table_schema = 'public' and c.column_name = 'space_id' and b.table_type = 'BASE TABLE'
          and c.table_name not in ('app_user', 'couple_space', 'couple_unlink')
      loop
        execute format('update public.%I set space_id = $1 where space_id = $2', t) using s, n;
      end loop;
    end if;
    update public.app_user
      set space_id = s, onboarding_step = 'O-60', onboarding_done_at = coalesce(onboarding_done_at, now())
      where id = x;
    delete from public.couple_space where id = n and unlinked_from = s;
  end loop;
  update public.couple_space set couple_state = 'connected', deleted_at = null where id = s;
  update public.couple_unlink
    set reconnect_answer = 'accepted', status = 'reconnected', reconnected_at = now()
    where id = u.id;
  select coalesce(nickname, '') into who from public.app_user where id = uid;
  perform public.notify(
    u.reconnect_by, s, 'reconnected', who || '님과 다시 연결됐어요', '해제 전 같이 쓰던 목표와 분배표가 돌아왔어요',
    '/', null, uid, 'reconnect:' || u.id || ':accepted');
end;
$$;

-- ── 옛 함수 지우기(이름으로, 겹치는 정의 모두) ─────────────────────────────────
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any (array[
      'accept_counter_unlink', 'add_income_supplement', 'add_period_supplement', 'adjust_plan', 'answer_actual_income',
      'answer_goal_gap', 'answer_living_check', 'apply_base_day', 'apply_due_proposals', 'apply_family_budget',
      'apply_proposal_values', 'change_wedding_budget', 'check_split', 'close_together_active', 'confirm_together',
      'confirm_unlink', 'counter_unlink', 'create_cycle_plan', 'end_income_periods', 'family_budget_now',
      'join_close_together', 'leave_close_together', 'living_check_day', 'mark_proposal_seen', 'move_emergency',
      'move_goal_rest', 'notify_first_plan', 'notify_proposal', 'partner_activity', 'plan_add_period_supplement',
      'plan_add_supplement', 'proposal_item_noun', 'proposal_space', 'propose', 'propose_in_close', 'record_wedding_payment',
      'respond_proposal', 'rest_missed_months', 'save_base_day', 'save_family_budget', 'send_close_bundle',
      'send_living_check_notifications', 'set_income_period', 'set_living_check', 'set_my_side', 'split_line_done',
      'start_first_plan', 'sum_other_income', 'uncheck_split', 'undo_emergency_move', 'undo_living_check',
      'unlink_default_plan', 'unlink_make_space', 'unlink_ratio', 'unlink_share', 'update_pending_shares', 'use_goal',
      'withdraw_proposal'])
  loop
    execute 'drop function ' || r.sig || ' cascade';
  end loop;
end;
$$;

-- ── 옛 예약 작업 ─────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and to_regclass('cron.job') is not null then
    perform cron.unschedule(jobname) from cron.job
      where jobname in ('end-income-periods', 'living-check-notifications', 'create-monthly-plans');
  end if;
end;
$$;

-- ── 옛 표 지우기 ──────────────────────────────────────────────────────────────
drop table if exists
  public.proposal, public.saving_deposit, public.big_expense, public.month_spend, public.close_balance,
  public.month_close, public.plan_line, public.monthly_plan, public.spend_category, public.goal_use,
  public.emergency_move, public.living_check, public.income_event, public.income_item, public.income_period,
  public.wedding_payment, public.wedding_item, public.todo, public.family_member, public.unlink_copy
  cascade;
