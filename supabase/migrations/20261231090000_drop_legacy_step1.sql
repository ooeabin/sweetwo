-- 옛 열·함수 정리 1단계(CLAUDE.md ‘스키마는 추가만, 지우기는 2단계로’, ADR 0009 2026-11-13).
-- 30일 재연결 복구가 없어졌으므로 서버 함수가 couple_unlink.reconnect_until·reconnect_by를 더 이상 쓰거나 읽지 않는다.
-- 열과 함수(reconnect_ok, my_reconnect_ok)는 그대로 둔다(2단계 DROP은 다음 배포 뒤). 앱·api는 이 함수들을 부르지 않는다.
--
--  1. finish_unlink, account_deletion_for: 확정 기록을 만들 때 reconnect_until을 더 이상 채우지 않음.
--  2. cancel_account_deletion: 계정 삭제를 취소해도 reconnect_until을 늘리지 않음(알림은 그대로).
--  3. purge_unlinked_spaces, purge_left_spaces: 원래 공간을 지우는 시계를 reconnect_until 대신 confirmed_at + 30일로.
--     reconnect_until은 확정 때 now() + 30일이라 같은 시각이다(예외: 계정 삭제 취소로 늘어난 기록은 더 일찍 지움).
--  4. purge_deleted_accounts: 지울 해제 기록을 찾을 때 reconnect_by를 보지 않음(reconnect_by는 requested_by·partner_id 중 한 사람이라 같은 결과).
-- app_user.default_visibility는 서버 함수가 읽지 않는다(앱의 읽기만 뺌). goal.visibility는 이번에 건드리지 않는다.

create or replace FUNCTION public.finish_unlink(p_id uuid, p_how text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  u public.couple_unlink;
  x uuid;
  n uuid;
begin
  select * into u from public.couple_unlink where id = p_id and status = 'pending' for update;
  if u.id is null then
    raise exception 'no_request' using errcode = 'P0001';
  end if;
  update public.couple_unlink
    set status = 'confirmed', confirmed_at = now(), how = p_how
    where id = u.id;
  delete from public.notification where space_id = u.space_id;
  -- 묶음 해체(합계는 같이 쓰던 것)
  update public.goal set bundle_id = null where space_id = u.space_id and bundle_id is not null;
  update public.saving_bundle set status = 'closed' where space_id = u.space_id;
  foreach x in array array[u.requested_by, u.partner_id] loop
    if x is null or not exists (select 1 from public.app_user where id = x and space_id = u.space_id) then
      continue;
    end if;
    insert into public.couple_space (couple_state, created_by, unlinked_from)
      values ('solo', x, u.space_id) returning id into n;
    perform public.move_owned_rows(u.space_id, x, n);
    -- 이름·로그인은 남김. 해제 안내(S-12h)를 먼저 보고 ‘시작하기’로 온보딩 O-11부터
    update public.app_user set space_id = n, onboarding_step = 'S-12H', rank_consent = false, rank_badge_home = false
      where id = x;
    perform public.notify(x, n, 'unlink_confirmed', '연결이 해제됐어요',
      '내 명의와 내 저축·투자는 그대로 남았어요', '/settings/couple/unlinked', null, null, -- [확인 필요] v2.2 D5
      'unlink:' || u.id || ':confirmed:' || x);
  end loop;
  update public.couple_space set couple_state = 'solo', deleted_at = now() where id = u.space_id;
end;
$function$;

create or replace FUNCTION public.account_deletion_for(uid uuid)
 RETURNS date
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    -- 연결 해제 확정과 같음(v2.2 D5): 상대 것은 상대 새 공간으로 옮겨 남기고, 같이 쓰던 것은 원래 공간째 30일 보관 뒤 지움
    update public.couple_unlink set status = 'cancelled', cancelled_at = now()
      where space_id = sp.id and status = 'pending';
    insert into public.couple_unlink (space_id, requested_by, partner_id, deadline, ratio, plan, status, how, confirmed_at)
      values (sp.id, uid, other, public.kst_today(), 50, '[]'::jsonb, 'confirmed', 'deleted', now());
    delete from public.notification where space_id = sp.id;
    delete from public.partner_change where space_id = sp.id;
    update public.goal set bundle_id = null where space_id = sp.id and bundle_id is not null;
    update public.saving_bundle set status = 'closed' where space_id = sp.id;
    foreach x in array array[uid, other] loop
      insert into public.couple_space (couple_state, created_by, unlinked_from)
        values ('solo', x, sp.id) returning id into ns;
      if x = other then
        perform public.move_owned_rows(sp.id, x, ns);
      end if;
      update public.app_user set space_id = ns, onboarding_step = 'S-12H', rank_consent = false, rank_badge_home = false
        where id = x;
    end loop;
    update public.couple_space set couple_state = 'solo', deleted_at = now() where id = sp.id;
    perform public.notify(other, (select space_id from public.app_user where id = other), 'partner_deleted',
      coalesce(me.nickname || '님이', '파트너가') || ' 계정을 삭제했어요', '내 명의와 내 저축·투자는 그대로 남았어요', -- [확인 필요] v2.2 D5
      '/settings/couple/unlinked', 'user-minus', null, 'deleted:' || uid || ':' || extract(epoch from now())::bigint);
  elsif sp.id is not null then
    update public.invite set expires_at = now() where space_id = sp.id and used_at is null and expires_at > now();
  end if;

  update public.app_user set status = 'deletion_requested', deletion_requested_at = now() where id = uid;
  -- S11-05: 다른 기기도 바로 로그아웃(31 3-2 ‘삭제 요청 즉시 로그아웃’). 세션을 지우면 갱신 토큰도 함께 지워짐(외래 키),
  -- 세션 없이 남은 옛 갱신 토큰도 지움
  delete from auth.sessions where user_id = uid;
  begin
    delete from auth.refresh_tokens where user_id = uid::text;
  exception when insufficient_privilege or undefined_table then
    null;
  end;
  return (now() at time zone 'Asia/Seoul')::date + 30;
end;
$function$;

create or replace FUNCTION public.cancel_account_deletion()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    perform public.notify(u.partner_id, (select space_id from public.app_user where id = u.partner_id),
      'partner_restored', coalesce(me.nickname || '님이', '파트너가') || ' 계정 삭제를 취소했어요',
      '30일 안에 다시 연결할 수 있어요', '/settings/couple', null, uid,
      'unlink:' || u.id || ':restored:' || extract(epoch from now())::bigint);
  end if;
end;
$function$;

create or replace FUNCTION public.purge_unlinked_spaces()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  u public.couple_unlink;
begin
  for u in select * from public.couple_unlink where status = 'confirmed' and confirmed_at + interval '30 days' <= now() loop
    -- 혹시 원래 공간에 남은 사람이 있으면 지우지 않음
    if exists (select 1 from public.app_user where space_id = u.space_id) then
      continue;
    end if;
    delete from public.couple_space where id = u.space_id and deleted_at is not null;
  end loop;
end;
$function$;

create or replace FUNCTION public.purge_left_spaces()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  n integer;
begin
  delete from public.couple_space s
    where s.deleted_at is not null and s.deleted_at < now() - interval '30 days'
      and not exists (select 1 from public.app_user u where u.space_id = s.id)
      and not exists (select 1 from public.couple_unlink u where u.space_id = s.id and u.status = 'confirmed'
                      and u.confirmed_at + interval '30 days' > now());
  get diagnostics n = row_count;
  return n;
end;
$function$;

create or replace FUNCTION public.purge_deleted_accounts()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me public.app_user;
  u public.couple_unlink;
  b record;
begin
  for me in select * from public.app_user
            where status = 'deletion_requested' and deletion_requested_at < now() - interval '30 days' loop
    if me.notify_email is not null then
      select * into b from public.noti_mail_body('계정을 삭제했어요', '그동안 sweeTwo를 써 주셔서 고마워요');
      insert into public.mail_outbox (user_id, to_email, kind, subject, body_text, body_html, capped, dedupe)
        values (null, btrim(me.notify_email), 'deletion_done', '계정을 삭제했어요', b.body_text, b.body_html, false,
                'deleted:' || me.id)
        on conflict (dedupe) do nothing;
    end if;
    for u in select * from public.couple_unlink
             where requested_by = me.id or partner_id = me.id loop
      delete from public.couple_space s where s.id = u.space_id and s.deleted_at is not null
        and not exists (select 1 from public.app_user m where m.space_id = s.id);
      delete from public.couple_unlink where id = u.id;
    end loop;
    if me.space_id is not null and not exists (
        select 1 from public.app_user m where m.space_id = me.space_id and m.id <> me.id) then
      update public.app_user set space_id = null where id = me.id;
      delete from public.couple_space where id = me.space_id;
    end if;
    delete from auth.users where id = me.id;
  end loop;
end;
$function$;
