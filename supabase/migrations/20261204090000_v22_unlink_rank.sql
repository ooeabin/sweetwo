-- v2.2 PR 5: 해제·순위·자산 공개(ADR 0009 결정 9·10·11·11-1, plan v2.2 3(d)·6-1·6-3·6-4·9-2 PR 5). 스키마는 추가만.
--
-- ■ 계약(core가 같은 결과: networth-rank.ts pair / peer_median, asset.ts 평가금액)
--  1. 해제 확정 finish_unlink(D5, D10): 혼자 공간 둘을 만들고 사람마다 ‘주인 있는 행’을 옮김(move_owned_rows):
--     내 명의 자산·부채(asset owner = person, owner_user_id = 나, asset_history 함께), 내 money_in, 내 salary_change,
--     원래 공간이 각자 엔진이면 내 월급 계획(salary_split + split_line, 공동 저금 줄은 뺌)·내 확인 목록·내 저금(goal
--     owner_user_id = 나, 묶음에서 빼고)과 그 돈 움직임·쓸 곳 메모. 나머지(공동 월급 계획·저금, 공동 명의, 경조사, 묶음,
--     shared_account, 활동·알림 기록)는 원래 공간에 남고 원래 공간은 30일 운영 보관 뒤 지움(purge_unlinked_spaces).
--     사용자 복구 없음: 해제 알림 “30일 안에 다시 연결할 수 있어요”를 뺌.
--  2. 해제 대기(request_unlink 뒤): 상대의 개인 저금(goal owner = 상대)은 읽기에서 가림(goal RLS), 월급 계획은 PR 3 공개
--     필터가 이미 가림, 묶음은 상대 몫 빼고 멈춤(PR 4 bundle_view paused).
--  3. 계정 삭제(account_deletion_for): 연결돼 있으면 해제 확정과 같은 규칙으로 상대 것은 상대에게 남김(상대 행을 옮김).
--  4. 다시 연결(D10, 복구 없는 새 연결 요청): request_reconnect()는 마지막 해제 상대에게 7일에 1번.
--     상대가 ‘다시 받지 않기’(answer_reconnect(false, true))를 골랐으면 조용히 거절(알림 없음, 오류 없음).
--     answer_reconnect(true) → 요청한 사람 공간에 새 초대 코드를 만들어 돌려줌(받은 사람 앱이 그 코드로 합류).
--  5. 잠금 화면(B8): 해제 요청·완료, 상대 계정 삭제, 다시 연결 요청 푸시는 제목 “sweeTwo”, 본문 “확인할 알림이 있어요”.
--  6. 자산 순위(G3): rank_consent_request(7일, 공간마다 열린 요청 1개) → answer_rank_consent(id, true)면 두 사람
--     rank_consent = true. set_rank_consent(false)는 내 동의를 끄고 두 사람 홈 배지·저장 순위를 지움.
--     rank_badge_home은 두 사람 모두 동의일 때만 true가 될 수 있음(트리거가 막음).
--     networth_rank_pair(): 연결 + 두 사람 동의 → {mode pair, net, band, top_pct, top_open, basis},
--       net = 두 사람 공간의 자산(평가금액 amount) − 부채, 상태 held, 지우지 않음, 숨기기(visibility private) 제외,
--       band = 먼저 태어난(출생연도가 작은) 사람 나이 = 올해 − 출생연도(10세 구간, 30 미만 20s, 60 이상 60s).
--       top_pct = core rankTopPct와 같은 점·보간(rank_top_pct). 연령대별 분위 표가 아직 없어 basis = 'all'(전체 가구).
--     그 밖 → {mode peer, band, median}(내 출생연도, peer_median = core RANK_AGE_MEDIAN).
--     첫 조회 무료: record_rank_view(paid_by_ad) — 사람마다 첫 기록은 광고 없이, 그다음부터 paid_by_ad = true여야 함.
--  7. 자산 공개 첫 선택(G2): app_user.asset_share_default(null = 아직 안 고름). set_asset_share_default(vis)로 고름(F-03e).
--     아직 null인 사람이 내 명의 자산을 처음 저장하면 그 행의 공개 단계가 기본값이 됨(트리거).
--     (설계는 ‘null이면 공개 단계를 명시해야 받음’이지만 asset.visibility에 기본값 'all'이 있어 명시와 기본을 서버가
--      가를 수 없음. 앱 v2.2 F-03e 뒤 2단계로 열 기본값을 지우고 거절로 바꿈)
--  8. 순자산 networth_summary(): {assets, debts, net} 평가금액(amount) 기준 + {principal_net} 원금 있는 자산은 원금으로.
--     내가 볼 수 있는 행만(asset RLS 그대로), 판 것·지운 것 제외.
--  9. 대신 입력 정리(R-13): 합류 전 공간에서 마지막 초대 만료 + 30일이 지나면 상대 명의 대신 입력(asset owner = person,
--     owner_user_id 없음)을 지움(deleted_at), 7일 전(만료 + 23일) 만든 사람에게 알림. pg_cron purge-proxy-entries 04:40 KST.
--
-- 못 한 것: revert_partner_change(N-02 ‘이전 값으로 돌리기’)는 partner_change에 원래 값이 글(read_won)로만 남아
--   되돌릴 수 없음. 원래 값 열을 더하는 별도 PR 필요.
-- 지금 안 쓰게 된 것(2단계 정리 대상): couple_unlink.reconnect_until·reconnect_by·reconnect_at·reconnect_answer·
--   reconnected_at(옛 30일 복구), reconnect_ok(), app_user.default_visibility(PR 3에서 이미 표시).

-- ─────────────────────────── 주인 있는 행 옮기기 ───────────────────────────
create function public.move_owned_rows(p_from uuid, p_user uuid, p_to uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  sep boolean := (select salary_mode = 'separate' from public.couple_space where id = p_from);
  goals uuid[];
  splits uuid[];
  lists uuid[];
begin
  -- 내 명의 자산·부채(이력 함께)
  update public.asset_history h set space_id = p_to
    from public.asset a where a.id = h.asset_id and a.space_id = p_from and a.owner = 'person' and a.owner_user_id = p_user;
  update public.asset set space_id = p_to, goal_id = null
    where space_id = p_from and owner = 'person' and owner_user_id = p_user;
  update public.money_in set space_id = p_to where space_id = p_from and owner_user_id = p_user;
  update public.salary_change set space_id = p_to where space_id = p_from and user_id = p_user;
  if not coalesce(sep, false) then
    return;
  end if;
  select coalesce(array_agg(id), '{}') into goals from public.goal
    where space_id = p_from and owner_user_id = p_user;
  select coalesce(array_agg(id), '{}') into splits from public.salary_split
    where space_id = p_from and owner_user_id = p_user;
  select coalesce(array_agg(id), '{}') into lists from public.pay_checklist
    where space_id = p_from and owner_user_id = p_user;
  update public.goal set bundle_id = null, space_id = p_to where id = any (goals);
  update public.goal_move set space_id = p_to where goal_id = any (goals);
  update public.saving_note set space_id = p_to where goal_id = any (goals);
  -- 공동 저금 줄은 원래 공간에 남는 저금이라 뺌, 같이 쓰는 통장 줄은 분담 연결을 끊음
  delete from public.split_line where split_id = any (splits) and kind = 'saving' and not (goal_id = any (goals));
  update public.split_line set space_id = p_to, shared_account_id = null where split_id = any (splits);
  update public.salary_split set space_id = p_to where id = any (splits);
  update public.pay_check_line set space_id = p_to where checklist_id = any (lists);
  update public.pay_checklist set space_id = p_to where id = any (lists);
end;
$$;
revoke all on function public.move_owned_rows(uuid, uuid, uuid) from public, anon, authenticated;

-- 계약 1
create or replace function public.finish_unlink(p_id uuid, p_how text)
returns void language plpgsql security definer set search_path = '' as $$
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
      '내 명의와 내 저금은 그대로 남았어요', '/settings/couple/unlinked', null, null, -- [확인 필요] v2.2 D5
      'unlink:' || u.id || ':confirmed:' || x);
  end loop;
  update public.couple_space set couple_state = 'solo', deleted_at = now() where id = u.space_id;
end;
$$;

-- 계약 3
create or replace function public.account_deletion_for(uid uuid)
returns date language plpgsql security definer set search_path = '' as $$
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
      coalesce(me.nickname || '님이', '파트너가') || ' 계정을 삭제했어요', '내 명의와 내 저금은 그대로 남았어요', -- [확인 필요] v2.2 D5
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
$$;

-- 계약 2: 해제 대기 중에는 상대 개인 저금을 읽지 않음
drop policy goal_select on public.goal;
create policy goal_select on public.goal for select to authenticated
  using (public.is_space_member(space_id) and (owner_user_id is null or owner_user_id = auth.uid()
    or (visibility = 'all' and not exists (select 1 from public.couple_space c
                                            where c.id = space_id and c.couple_state = 'unlink_pending'))));

-- ─────────────────────────── 다시 연결(계약 4) ───────────────────────────
create table public.reconnect_request (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'accepted', 'declined', 'silenced')),
  blocked boolean not null default false,
  answered_at timestamptz,
  invite_code text
);
create index reconnect_request_pair_idx on public.reconnect_request (from_user, to_user, created_at desc);
create index reconnect_request_to_idx on public.reconnect_request (to_user) where status = 'open';
alter table public.reconnect_request enable row level security;
create policy reconnect_request_select on public.reconnect_request for select to authenticated
  using ((from_user = auth.uid() and status <> 'silenced') or (to_user = auth.uid() and status <> 'silenced'));
create policy reconnect_request_insert on public.reconnect_request for insert to authenticated with check (false);
create policy reconnect_request_update on public.reconnect_request for update to authenticated using (false);
create policy reconnect_request_delete on public.reconnect_request for delete to authenticated using (false);

-- 마지막으로 해제한 상대(해제·탈퇴 확정 행)
create function public.last_unlinked_partner(p_user uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select case when u.requested_by = p_user then u.partner_id else u.requested_by end
  from public.couple_unlink u
  where u.status in ('confirmed', 'reconnected') and (u.requested_by = p_user or u.partner_id = p_user)
  order by u.confirmed_at desc nulls last limit 1;
$$;

create or replace function public.request_reconnect()
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  other uuid;
  who text;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  other := public.last_unlinked_partner(uid);
  if other is null or not exists (select 1 from public.app_user where id = other and status = 'active') then
    raise exception 'reconnect_closed' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.app_user a join public.couple_space s on s.id = a.space_id
             where a.id in (uid, other) and s.couple_state in ('connected', 'unlink_pending')) then
    raise exception 'reconnect_closed' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.reconnect_request where from_user = uid and to_user = other
             and created_at > now() - interval '7 days') then
    raise exception 'too_soon' using errcode = 'P0001';
  end if;
  -- 상대가 ‘다시 받지 않기’를 골랐으면 조용히(요청한 사람은 보낸 것처럼)
  if exists (select 1 from public.reconnect_request where from_user = uid and to_user = other and blocked) then
    insert into public.reconnect_request (from_user, to_user, status, blocked) values (uid, other, 'silenced', true);
    return;
  end if;
  update public.reconnect_request set status = 'declined', answered_at = now()
    where to_user = other and from_user = uid and status = 'open';
  insert into public.reconnect_request (from_user, to_user) values (uid, other);
  select nickname into who from public.app_user where id = uid;
  perform public.notify(other, (select space_id from public.app_user where id = other), 'reconnect_requested',
    coalesce(who || '님이', '파트너가') || ' 다시 연결하자고 했어요', '연결하면 새로 같이 시작해요', -- [확인 필요] 4-3 2번, D10
    '/settings/couple/reconnect', null, uid, 'reconnect:' || uid || ':' || extract(epoch from now())::bigint,
    'sweeTwo', true);
end;
$$;

drop function public.answer_reconnect(boolean);
-- 받은 사람: 수락 → 요청한 사람 공간 초대 코드(앱이 join_space로 합류), 거절, 거절 + 다시 받지 않기
create function public.answer_reconnect(p_accept boolean, p_block boolean default false)
returns text language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  r public.reconnect_request;
  sid uuid;
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  c text;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into r from public.reconnect_request where to_user = uid and status = 'open'
    order by created_at desc limit 1 for update;
  if r.id is null then
    raise exception 'no_request' using errcode = 'P0001';
  end if;
  if not p_accept then
    update public.reconnect_request set status = 'declined', answered_at = now(), blocked = coalesce(p_block, false)
      where id = r.id;
    return null;
  end if;
  select space_id into sid from public.app_user where id = r.from_user and status = 'active';
  if sid is null or exists (select 1 from public.couple_space where id = sid and couple_state in ('connected', 'unlink_pending')) then
    raise exception 'reconnect_closed' using errcode = 'P0001';
  end if;
  update public.couple_space set couple_state = 'not_joined' where id = sid and couple_state = 'solo';
  select i.code into c from public.invite i where i.space_id = sid and i.used_at is null and i.expires_at > now()
    order by i.created_at desc limit 1;
  while c is null loop
    c := '';
    for k in 1..6 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      insert into public.invite (space_id, code, created_by, expires_at) values (sid, c, r.from_user, now() + interval '7 days');
    exception when unique_violation then
      c := null;
    end;
  end loop;
  update public.reconnect_request set status = 'accepted', answered_at = now(), invite_code = c where id = r.id;
  perform public.notify(r.from_user, sid, 'reconnected',
    coalesce((select nickname from public.app_user where id = uid) || '님이', '파트너가') || ' 다시 연결하기로 했어요', null, -- [확인 필요] D10 ‘되살렸어요’ 없음
    '/', null, uid, 'reconnect_accepted:' || r.id);
  return c;
end;
$$;
grant execute on function public.answer_reconnect(boolean, boolean) to authenticated;

-- 계약 5: 잠금 화면 가림
create function public.noti_lock_generic(p_kind text)
returns boolean language sql immutable set search_path = '' as $$
  select p_kind in ('unlink_requested', 'unlink_confirmed', 'partner_deleted', 'reconnect_requested');
$$;

create or replace function public.claim_push(p_limit integer default 100, p_now timestamptz default now())
returns table(notification_id uuid, title text, body text, target text, platform text, token text)
language plpgsql security definer set search_path = '' as $$
declare
  hour integer := extract(hour from p_now at time zone 'Asia/Seoul')::int;
  ids uuid[];
begin
  select array_agg(x.id) into ids from (
    select n.id
    from public.notification n
    join public.app_user u on u.id = n.user_id and u.status = 'active'
    where n.pushed_at is null and n.read_at is null
      and n.created_at > p_now - public.noti_send_window(u.quiet_start, u.quiet_end)
      and public.push_wanted(u.noti_prefs, n.topic)
      -- v2.2 알림 종류 골라 켜기(P-11·S-14), 인앱만 종류
      and public.push_kind_on(u.push_kinds, n.kind)
      and not public.noti_inapp_only(n.kind)
      and exists (select 1 from public.push_device d where d.user_id = n.user_id)
      -- 방해 금지(보안·계정 알림은 바로): 끝나면 보냄
      and (public.noti_always_mail(n.kind) or not (
        u.quiet_start <> u.quiet_end and case when u.quiet_start < u.quiet_end
          then hour >= u.quiet_start and hour < u.quiet_end
          else hour >= u.quiet_start or hour < u.quiet_end end))
    order by n.created_at
    limit least(greatest(coalesce(p_limit, 100), 1), 500)
    for update of n skip locked
  ) x;
  if ids is null then
    return;
  end if;
  update public.notification set pushed_at = p_now where id = any(ids);
  -- 분석: 알림마다 한 번(기기 수와 상관없이)
  perform public.track_noti_sent(n.user_id, n.space_id, n.kind, 'os')
    from public.notification n where n.id = any(ids);
  return query
    select n.id,
      case when public.noti_lock_generic(n.kind) then 'sweeTwo' else coalesce(n.push_title, n.title) end,
      case when public.noti_lock_generic(n.kind) then '확인할 알림이 있어요' -- [확인 필요] 6-4
           when n.push_hidden or public.noti_push_body_hidden(n.kind) then null else n.body end,
      n.target, d.platform, d.token
    from public.notification n
    join public.push_device d on d.user_id = n.user_id
    where n.id = any(ids);
end;
$$;

-- ─────────────────────────── 자산 순위(계약 6) ───────────────────────────
create table public.rank_consent_request (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.couple_space (id) on delete cascade,
  from_user uuid not null references auth.users (id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'accepted', 'declined', 'expired', 'cancelled')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  answered_at timestamptz
);
create index rank_consent_request_space_idx on public.rank_consent_request (space_id);
create unique index rank_consent_request_open on public.rank_consent_request (space_id) where status = 'open';
alter table public.rank_consent_request enable row level security;
create policy rank_consent_request_select on public.rank_consent_request for select to authenticated
  using (public.is_space_member(space_id));
create policy rank_consent_request_insert on public.rank_consent_request for insert to authenticated with check (false);
create policy rank_consent_request_update on public.rank_consent_request for update to authenticated using (false);
create policy rank_consent_request_delete on public.rank_consent_request for delete to authenticated using (false);
-- Realtime(F-08c·홈 띠 5번): 공간 구성원만(읽기 정책 그대로)
alter publication supabase_realtime add table public.rank_consent_request;

create table public.rank_view (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  space_id uuid references public.couple_space (id) on delete set null,
  mode text not null check (mode in ('pair', 'peer')),
  paid_by_ad boolean not null default false,
  top_pct smallint,
  net bigint,
  viewed_at timestamptz not null default now()
);
create index rank_view_user_idx on public.rank_view (user_id, viewed_at desc);
alter table public.rank_view enable row level security;
create policy rank_view_select on public.rank_view for select to authenticated using (user_id = auth.uid());
create policy rank_view_insert on public.rank_view for insert to authenticated with check (false);
create policy rank_view_update on public.rank_view for update to authenticated using (false);
create policy rank_view_delete on public.rank_view for delete to authenticated using (false);

-- 두 사람 모두 동의했나
create function public.rank_pair_consented(p_space uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select s.couple_state = 'connected' from public.couple_space s where s.id = p_space), false)
    and (select count(*) from public.app_user u where u.space_id = p_space and u.status = 'active' and u.rank_consent) = 2;
$$;

create function public.request_rank_consent()
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  me public.app_user;
  other uuid;
  rid uuid;
begin
  select * into me from public.app_user where id = uid;
  if not exists (select 1 from public.couple_space where id = me.space_id and couple_state = 'connected') then
    raise exception 'not_connected' using errcode = '22023';
  end if;
  select id into other from public.app_user where space_id = me.space_id and status = 'active' and id <> uid limit 1;
  update public.app_user set rank_consent = true where id = uid;
  update public.rank_consent_request set status = 'cancelled', answered_at = now() where space_id = me.space_id and status = 'open';
  insert into public.rank_consent_request (space_id, from_user) values (me.space_id, uid) returning id into rid;
  perform public.notify(other, me.space_id, 'rank_request',
    coalesce(me.nickname || '님이', '파트너가') || ' 자산 순위를 같이 보자고 해요', null, -- [확인 필요] 4-3 5번
    '/assets/rank/consent/' || rid, 'chart-bar', uid, 'rank_request:' || rid);
  return rid;
end;
$$;
grant execute on function public.request_rank_consent() to authenticated;

create function public.answer_rank_consent(p_request uuid, p_accept boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  q public.rank_consent_request;
begin
  select * into q from public.rank_consent_request where id = p_request for update;
  if q.id is null or not public.is_space_member(q.space_id) or q.from_user = uid then
    raise exception 'not_found' using errcode = '42501';
  end if;
  if q.status <> 'open' then
    raise exception 'not_open' using errcode = '22023';
  end if;
  if q.expires_at < now() then
    update public.rank_consent_request set status = 'expired' where id = q.id;
    return 'expired';
  end if;
  update public.rank_consent_request set status = case when p_accept then 'accepted' else 'declined' end, answered_at = now()
    where id = q.id;
  if p_accept then
    update public.app_user set rank_consent = true where id = uid;
  end if;
  perform public.notify(q.from_user, q.space_id, 'rank_result',
    case when p_accept then '이제 자산 순위를 같이 봐요' else '자산 순위는 지금처럼 따로 봐요' end, null, -- [확인 필요]
    '/assets/rank', 'chart-bar', uid, 'rank_result:' || q.id);
  return case when p_accept then 'accepted' else 'declined' end;
end;
$$;
grant execute on function public.answer_rank_consent(uuid, boolean) to authenticated;

-- 동의 끄기: 두 사람 홈 배지·저장 순위를 지움
create function public.set_rank_consent(p_on boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  sid uuid := (select space_id from public.app_user where id = auth.uid());
begin
  if p_on then
    raise exception 'use_request' using errcode = '22023';
  end if;
  update public.app_user set rank_consent = false where id = auth.uid();
  update public.app_user set rank_badge_home = false, rank_month = null, rank_pct = null, rank_net = null
    where space_id = sid;
end;
$$;
grant execute on function public.set_rank_consent(boolean) to authenticated;

-- 홈 배지는 두 사람 모두 동의일 때만
create function public.rank_badge_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.rank_badge_home and not public.rank_pair_consented(new.space_id) then
    new.rank_badge_home := false;
  end if;
  return new;
end;
$$;
create trigger rank_badge_guard before update of rank_badge_home on public.app_user
  for each row execute function public.rank_badge_guard();

-- core rankTopPct와 같은 점(2025 가계금융복지조사)·선형 보간·올림
create function public.rank_top_pct(p_net bigint)
returns smallint language plpgsql immutable set search_path = '' as $$
declare
  nets bigint[] := array[-100000000, 0, 12100000, 51080000, 102960000, 164720000, 238600000, 330500000, 461800000,
                         693800000, 1100200000];
  below numeric[] := array[0.2, 3, 10, 20, 30, 40, 50, 60, 70, 80, 90];
  i int;
  b numeric;
begin
  if p_net < nets[1] then
    return 99;
  end if;
  if p_net >= nets[11] then
    return 10;
  end if;
  i := 2;
  while p_net >= nets[i] loop
    i := i + 1;
  end loop;
  b := below[i - 1] + (below[i] - below[i - 1]) * (p_net - nets[i - 1]) / (nets[i] - nets[i - 1]);
  return least(99, greatest(1, ceil(100 - b - 1e-9)))::smallint;
end;
$$;

create function public.rank_age_band(p_birth_year integer, p_year integer)
returns text language sql immutable set search_path = '' as $$
  select case when p_birth_year is null then null
    when p_year - p_birth_year < 30 then '20s' when p_year - p_birth_year < 40 then '30s'
    when p_year - p_birth_year < 50 then '40s' when p_year - p_birth_year < 60 then '50s' else '60s' end;
$$;

-- core RANK_AGE_MEDIAN과 같음
create function public.peer_median(p_birth_year integer)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('band', b, 'median', case b when '20s' then 50000000 when '30s' then 155850000
    when '40s' then 283840000 when '50s' then 316850000 when '60s' then 250000000 end)
  from (select public.rank_age_band(p_birth_year, extract(year from public.kst_today())::int) b) x;
$$;

create function public.networth_rank_pair()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  me public.app_user;
  net bigint;
  by_ smallint;
begin
  select * into me from public.app_user where id = auth.uid();
  if me.id is null then
    raise exception 'not_found' using errcode = '42501';
  end if;
  if not public.rank_pair_consented(me.space_id) then
    return jsonb_build_object('mode', 'peer') || public.peer_median(me.birth_year);
  end if;
  select coalesce(sum(case when side = 'asset' then amount else -amount end), 0) into net
    from public.asset where space_id = me.space_id and deleted_at is null and status = 'held' and visibility <> 'private';
  select min(birth_year) into by_ from public.app_user where space_id = me.space_id and status = 'active';
  return jsonb_build_object('mode', 'pair', 'net', net, 'top_pct', public.rank_top_pct(net),
    'top_open', net >= 1100200000, 'band', public.rank_age_band(by_, extract(year from public.kst_today())::int),
    'basis', 'all');
end;
$$;
grant execute on function public.networth_rank_pair() to authenticated;

-- 첫 조회 무료, 그다음부터 광고를 본 뒤(paid_by_ad = true)만 기록. 반환 = 저장한 결과
create function public.record_rank_view(p_paid_by_ad boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  r jsonb := public.networth_rank_pair();
  sid uuid := (select space_id from public.app_user where id = auth.uid());
begin
  if exists (select 1 from public.rank_view where user_id = uid) and not coalesce(p_paid_by_ad, false) then
    raise exception 'ad_required' using errcode = '22023';
  end if;
  insert into public.rank_view (user_id, space_id, mode, paid_by_ad, top_pct, net)
    values (uid, sid, r->>'mode', coalesce(p_paid_by_ad, false), (r->>'top_pct')::smallint, (r->>'net')::bigint);
  if r->>'mode' = 'pair' then
    update public.app_user set rank_month = date_trunc('month', public.kst_today())::date,
      rank_pct = (r->>'top_pct')::smallint, rank_net = (r->>'net')::bigint where id = uid;
  end if;
  return r;
end;
$$;
grant execute on function public.record_rank_view(boolean) to authenticated;

-- ─────────────────────────── 자산 공개 첫 선택(계약 7) ───────────────────────────
create function public.set_asset_share_default(p_vis public.asset_visibility)
returns void language sql security definer set search_path = '' as $$
  update public.app_user set asset_share_default = p_vis where id = auth.uid();
$$;
grant execute on function public.set_asset_share_default(public.asset_visibility) to authenticated;

create function public.asset_first_share() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.owner = 'person' and new.owner_user_id is not null and new.owner_user_id = auth.uid() then
    update public.app_user set asset_share_default = new.visibility
      where id = new.owner_user_id and asset_share_default is null;
  end if;
  return null;
end;
$$;
create trigger asset_first_share after insert on public.asset for each row execute function public.asset_first_share();

-- ─────────────────────────── 순자산(계약 8) ───────────────────────────
create function public.networth_summary()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'assets', coalesce(sum(amount) filter (where side = 'asset'), 0),
    'debts', coalesce(sum(amount) filter (where side = 'debt'), 0),
    'net', coalesce(sum(case when side = 'asset' then amount else -amount end), 0),
    'principal_net', coalesce(sum(case when side = 'asset' then coalesce(principal, amount) else -amount end), 0))
  from public.asset where deleted_at is null and status = 'held'
    and space_id = (select space_id from public.app_user where id = auth.uid());
$$;
grant execute on function public.networth_summary() to authenticated;

-- ─────────────────────────── 대신 입력 정리(계약 9) ───────────────────────────
create function public.purge_proxy_entries(p_today date default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  today date := coalesce(p_today, public.kst_today());
  r record;
  cnt integer := 0;
begin
  for r in
    select distinct on (i.space_id) i.space_id, i.created_by, (i.expires_at at time zone 'Asia/Seoul')::date as exp
    from public.invite i
    join public.couple_space s on s.id = i.space_id and s.deleted_at is null and s.couple_state = 'not_joined'
    where i.used_at is null
    order by i.space_id, i.expires_at desc
  loop
    continue when not exists (select 1 from public.asset a where a.space_id = r.space_id and a.owner = 'person'
                                and a.owner_user_id is null and a.deleted_at is null);
    if today = r.exp + 23 and r.created_by is not null then
      perform public.notify(r.created_by, r.space_id, 'proxy_purge_soon', '대신 적은 파트너 자산이 7일 뒤 지워져요', -- [확인 필요] R-13
        '파트너가 합류하면 그대로 남아요', '/assets', 'clock', null, 'proxy_purge:' || r.space_id || ':' || r.exp);
      cnt := cnt + 1;
    elsif today >= r.exp + 30 then
      update public.asset set deleted_at = now()
        where space_id = r.space_id and owner = 'person' and owner_user_id is null and deleted_at is null;
      cnt := cnt + 1;
    end if;
  end loop;
  return cnt;
end;
$$;
revoke all on function public.purge_proxy_entries(date) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('purge-proxy-entries', '40 19 * * *', 'select public.purge_proxy_entries()');
  end if;
end;
$$;
