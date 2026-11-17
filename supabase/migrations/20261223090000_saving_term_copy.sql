-- 2026-11-17 사용자 결정: 사용자에게 보이는 ‘저금’ → ‘저축·투자’ (docs/spec/README.md 용어 표).
-- 서버 알림·이름의 현재 정의만 create or replace로 바꾼다. 옛 마이그레이션 파일과 이미 보낸 알림 행은 고치지 않는다.
-- 앱 쪽 같은 말: salary/copy.ts privateSaving(‘개인 저축·투자’), pairing/copy.ts joinedHelp, settings/copy.ts previewPrivate.

CREATE OR REPLACE FUNCTION public.partner_change_title(p_topic text, p_noun text, who text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select coalesce(nullif(who, '') || '님이', '파트너가') || ' ' || case
    when p_topic = 'split' then '월급 계획을 바꿨어요'
    when p_topic = 'income' then '월급을 바꿨어요' -- [확인 필요]
    when p_topic in ('goal', 'goal_meta', 'goal_move') then p_noun || ' 저축·투자를 바꿨어요' -- [확인 필요] 2026-11-09 사용자에게는 ‘저금’
    when p_topic = 'asset' then '자산을 바꿨어요' -- [확인 필요] 2026-11-09 ‘우리 자산’ 대신
    when p_topic = 'care' then '경조사·기념일을 바꿨어요' -- [확인 필요] 2026-11-15 3차 검토(제목 ‘경조사·기념일’)
    when p_topic = 'cycle_day' then '월급날 확인 목록 만드는 날을 바꿨어요' -- [확인 필요] 2026-11-15 3차 검토
    when p_topic = 'couple' then '결혼 정보를 바꿨어요' -- [확인 필요]
    else '바꿨어요' end;
$function$;

CREATE OR REPLACE FUNCTION public.partner_change_line(p_topic text, p_field text, p_noun text, p_before text, p_after text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    when p_topic = 'split' and p_field = 'order' then '월급 계획 순서를 바꿨어요' -- [확인 필요] 2026-11-09 W-01 편집
    when p_topic = 'split' and p_field like 'name:%' then '이름 ' || coalesce(p_before, '') || ' → ' || coalesce(p_after, '') -- [확인 필요]
    when p_topic = 'split' then p_noun || ' ' || coalesce(p_before, '0원') || ' → ' || coalesce(p_after, '0원')
    when p_topic = 'income' then coalesce(p_before, '0원') || ' → ' || coalesce(p_after, '0원')
    when p_topic in ('goal', 'goal_meta') and p_field = 'deleted' then '저축·투자를 지웠어요' -- [확인 필요] 2026-11-09
    when p_topic in ('goal', 'goal_meta') and p_field = 'restored' then '저축·투자를 되살렸어요' -- [확인 필요] 2026-11-09
    when p_topic = 'goal_meta' and p_field = 'added' then '저축·투자를 추가했어요' -- [확인 필요] 2026-11-09
    when p_topic = 'goal_meta' and p_field = 'closed' then
      case when p_after = '0' then '다시 모으기로 했어요' else '그만 모으기로 했어요' end -- [확인 필요]
    when p_topic = 'goal_meta' and p_field = 'order' then '목표 순서를 바꿨어요' -- (예전 기록)
    when p_topic = 'goal_meta' and p_field = 'photo' then '목표 사진을 바꿨어요' -- (예전 기록)
    when p_topic in ('goal', 'goal_meta') then
      case p_field when 'amount' then '목표 금액' when 'deadline' then '기한' when 'name' then '이름'
        when 'status' then '상태' when 'kind' then '형태' when 'owner' then '종류' else p_field end
      || ' ' || coalesce(p_before, '없음') || ' → ' || coalesce(p_after, '없음')
    when p_topic = 'goal_move' then coalesce(p_after, '') -- (예전 기록)
    when p_topic = 'asset' and p_field = 'amount_hidden' then '개인 자산 금액이 바뀌었어요'
    when p_topic = 'asset' and p_field = 'amount' then p_noun || ' ' || p_before || ' → ' || p_after
    when p_topic = 'asset' and p_field = 'added' then p_noun || ' 추가' -- [확인 필요]
    when p_topic = 'asset' and p_field = 'deleted' then p_noun || ' 삭제' -- [확인 필요]
    when p_topic = 'asset' and p_field = 'restored' then p_noun || ' 되살림' -- [확인 필요]
    when p_topic = 'care' and p_field = 'added' then p_noun || ' 추가' -- [확인 필요]
    when p_topic = 'care' then p_noun || ' 메모' -- [확인 필요]
    when p_topic = 'cycle_day' then '월급날 확인 목록 만드는 날 ' || p_before || ' → ' || p_after -- [확인 필요] 2026-11-15 3차 검토
    when p_topic = 'couple' then
      case p_field when 'marriage' then '결혼 상태' else '결혼한 날' end
      || ' ' || coalesce(p_before, '없음') || ' → ' || coalesce(p_after, '없음') -- [확인 필요]
    else p_noun
  end;
$function$;

CREATE OR REPLACE FUNCTION public.goal_mark_achieved(p_goal uuid, p_actor uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  g public.goal;
  u record;
  joint boolean;
  done_only boolean;
begin
  select * into g from public.goal where id = p_goal;
  update public.goal set status = 'achieved', achieved_at = now(),
      achieved_seen = case when p_actor is null then '{}'::uuid[] else array[p_actor] end
    where id = g.id;
  select c.salary_mode = 'joint' into joint from public.couple_space c where c.id = g.space_id;
  done_only := not coalesce(joint, false) and exists (
    select 1 from public.app_user o where o.id = g.owner_user_id and o.plan_share = 'done_only');
  for u in select a.id from public.app_user a where a.space_id = g.space_id and a.status = 'active' loop
    if g.owner_user_id is not null and g.owner_user_id <> u.id and (g.visibility = 'amount' or done_only) then
      perform public.notify(u.id, g.space_id, 'goal_achieved', '개인 저축·투자 목표 금액을 다 모았어요', null,
        '/salary' || case when coalesce(joint, false) then '' else '?who=' || g.owner_user_id::text end,
        'trophy', p_actor, 'goal_achieved:' || g.id::text || ':' || u.id::text);
      continue;
    end if;
    perform public.notify(u.id, g.space_id, 'goal_achieved', g.name || ' 목표 금액을 다 모았어요', null,
      '/salary/items/' || g.id::text
        || case when g.owner_user_id is null or g.owner_user_id = u.id
                  or (coalesce(joint, false) and g.visibility = 'all') then '/achieved' else '' end,
      'trophy', p_actor, 'goal_achieved:' || g.id::text || ':' || u.id::text);
  end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION public.space_goals()
 RETURNS SETOF goal
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case
    when x.partner and (g.visibility = 'amount' or x.hidden)
      then jsonb_populate_record(g, jsonb_build_object('name', '개인 저축·투자', 'template', 'custom', 'details', '{}'::jsonb,
        'photo_path', null, 'photo_preset', null) -- [확인 필요]
        || case when x.hidden then jsonb_build_object('target_amount', null, 'deadline', null, 'start_saved', 0,
             'other_held', 0, 'freed_lines', '[]'::jsonb, 'amount_estimated', false, 'deadline_estimated', false)
           else '{}'::jsonb end)
    else g
  end
  from public.goal g
  join public.couple_space s on s.id = g.space_id
  cross join lateral (select g.owner_user_id is not null and g.owner_user_id <> auth.uid() as partner,
                             public.saving_owner_hidden(g.space_id, g.owner_user_id) as hidden) x
  where public.is_space_member(g.space_id)
    and not (x.partner and s.couple_state = 'unlink_pending');
$function$;

CREATE OR REPLACE FUNCTION public.pay_line_noun(p_kind split_line_kind, p_goal uuid, p_name text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select case p_kind
    when 'saving' then coalesce((select g.name from public.goal g where g.id = p_goal), p_name, '저축·투자')
    when 'fixed' then '고정지출'
    when 'living' then '생활비'
    when 'allowance' then '용돈'
    else coalesce(p_name, '')
  end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_joined()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  joiner public.app_user;
begin
  if old.couple_state = 'not_joined' and new.couple_state = 'connected' then
    select * into joiner from public.app_user
      where space_id = new.id and status = 'active' and id <> new.created_by limit 1;
    if joiner.id is null or new.created_by is null then return new; end if;
    perform public.notify(
      new.created_by, new.id, 'partner_joined',
      coalesce(coalesce(joiner.nickname, new.partner_nickname) || '님이', '파트너가') || ' 합류했어요',
      -- 2026-11-13 UX B M4: 합류한 사람이 실제로 보여 주는 만큼만(같이 계열·모두 = 월급 계획과 저금, 저금만, 했어요만) [확인 필요]
      case
        when new.salary_mode = 'joint' or joiner.plan_share = 'all' then '이제 월급 계획과 저축·투자를 같이 봐요'
        when joiner.plan_share = 'saving_only' then '이제 저축·투자를 같이 봐요'
        else '이제 같이 모으는 저축·투자를 둘이 봐요'
      end, '/', null, joiner.id, 'joined:' || new.id || ':' || joiner.id);
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.finish_unlink(p_id uuid, p_how text)
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
    set status = 'confirmed', confirmed_at = now(), how = p_how, reconnect_until = now() + interval '30 days'
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

CREATE OR REPLACE FUNCTION public.account_deletion_for(uid uuid)
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
    insert into public.couple_unlink (space_id, requested_by, partner_id, deadline, ratio, plan, status, how, confirmed_at,
                                      reconnect_until)
      values (sp.id, uid, other, public.kst_today(), 50, '[]'::jsonb, 'confirmed', 'deleted', now(),
              now() + interval '30 days');
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
