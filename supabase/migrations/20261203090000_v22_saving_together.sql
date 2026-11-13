-- v2.2 PR 4: 같이 모으기와 돈 기록(ADR 0009 결정 4·4-1·5·8-1(나), plan v2.2 2-3·2-4·6-1·6-2·6-3·9-2 PR 4). 스키마는 추가만.
--
-- ■ 계약(core가 같은 결과: saving-bundle.ts, money-in-period.ts, plan-ratio.ts, saving-item.ts)
--  1. 모은 금액(PR 2 계약 6 그대로) = start_saved + 체크한 저금 줄 + reason_code가 있는 goal_move(in +, out −).
--     바로잡기·잔액 맞추기·냈어요·돈 들어왔어요·자동 넣기 모두 goal_move 한 줄. 0원 아래로는 못 뺌('below_zero').
--     reason_code: fix(바로잡기 +/−) used(꺼내 씀) interest(이자) reconcile(잔액 맞추기) note_paid(쓸 곳 메모 냈어요)
--     custom(돈 들어왔어요 나눠 넣기, money_in_id 있음, 그 밖 직접) auto(날짜 없는 사람 자동 넣기).
--     사유 글(reason, 40자)은 넣은 사람만 읽음(goal_move.reason 열 권한 없음, goal_move_reasons(goal)로 내 것만).
--  2. 고칠 수 있는 저금(goal_editable): 공동(주인 없음), 내 것, 합쳐서 모드의 ‘모두 보여 주기’ 저금. 묶음에서는 내 저금만.
--  3. 같이 모으는 저금 바로잡기(G11): 공동 저금 또는 묶음에 든 저금이면 상대에게 사람·금액·사유 없이 인앱 한 줄
--     “같이 모으기에서 꺼내 썼어요”(−) / “같이 모으기에 더했어요”(+). 각자 계열 개인 저금은 알림 없음.
--     hide_from_summary면 주간 요약(weekly_saving)에서 뺌(인앱 한 줄은 남김).
--  4. 묶음 saving_bundle(각자 엔진에서만, 연결된 공간): 구성원 a = 만든 사람, b = 상대. 저금은 사람마다 하나(goal.bundle_id).
--     합계 = 묶은 저금 모은 금액 합. 상대 저금 금액은 show_each_a and show_each_b일 때만 응답.
--     percent_only_a or percent_only_b면 합계·목표 금액·각자 금액 없이 %만(둘 모두에게). %는 목표 금액이 있을 때만,
--     pct = 내림(합계 × 100 / 목표 금액), 최대 100. 목표 금액이 없으면 퍼센트만은 고를 수 없음('no_target').
--     목표 금액 처음 값(Q11) = 두 저금 목표 금액 합(둘 다 있을 때, 아니면 null).
--     달성(합계 기준): 합계 >= 목표 금액이면 achieved(두 사람 모두 푸시 bundle_achieved), 내려가면 되돌림.
--     goal_saved_sums는 상대의 묶인 저금 모은 금액을 show_each 둘 다일 때만 돌려줌.
--  5. 돈 들어왔어요 money_in: 주인만(주인이 plan_share = all이면 상대 읽기). 나눠 넣기 = goal_move(in, custom, money_in_id),
--     나눠 넣은 합 <= 들어온 금액('over').
--  6. 기간(G8) money_in_period(user, today) → {status none|early|bar|gap, start, end, day, received, needed, gap_days}:
--     기간 = 30일(S, E = S + 29). 첫 S = 처음 돈 들어온 날. 다음 S = E 뒤 처음 돈 들어온 날. 오늘이 [S, E] 안이면
--     day = 오늘 − S + 1, 1~15일째 early, 16일째부터 bar. 오늘이 마지막 E 뒤면 gap, gap_days = 오늘 − 마지막 받은 날.
--     돈이 한 번도 없으면 none. received = 그 기간 [S, min(E, 오늘)]에 받은 돈 합(종류 상관없음).
--     needed = 그 사람 월급 계획(각자 = 내 것, 합쳐서 = 공동) 모든 줄 합(체크리스트에 넣기와 상관없음, 여유 자금은 줄이 아님).
--     (설계는 ‘기간 시작 때’ 월급 계획이지만 계획 기록이 없어 지금 계획으로 셈. core도 같게)
--  7. 분담 shared_account(R3, 예외 (나)): 한 사람이 제안 → 상대 ‘좋아요’. rule half: a = 1만 원 반올림(total / 2), b = total − a.
--     income_ratio: 두 사람 모두 plan_share = all이고 월급이 있을 때만('not_allowed'), a = 1만 원 반올림(total × 월급a / (월급a + 월급b)),
--     b = total − a. custom: a를 받음, b = total − a. 응답·저장은 몫과 비율(ratio_a = 반올림(a × 100 / total))만, 월급 값은 넣지 않음.
--     a = 제안한 사람. 수락하면 각자 = 사람마다 월급 계획에 shared_account 줄(그 사람 몫), 합쳐서 = 공동 월급 계획에 한 줄(합계, Q14).
--     7일 지나면 expired. 열린 제안은 공간마다 1개.
--  8. 쓸 곳 메모 saving_note: 그 저금(또는 묶음)을 볼 수 있는 사람 읽기, 고칠 수 있는 사람 쓰기(직접, 열 권한),
--     냈어요 mark_note_paid(note, subtract): paid + subtract면 그 저금에서 메모 금액 바로잡기 −(note_paid).
--     묶음 메모는 내 저금에서 뺌.
--  9. 잔액 맞추기 reconcile_savings([{goal_id, actual}]): 저금마다 차이만큼 바로잡기(reconcile), last_reconciled_at = now.
--     묶음은 내 저금만.

-- ─────────────────────────────── 표 ───────────────────────────────
create table public.saving_bundle (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.couple_space (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 20),
  target_amount bigint check (target_amount between 0 and 99999999999),
  deadline date check (deadline = date_trunc('month', deadline)::date),
  status text not null default 'active' check (status in ('active', 'achieved', 'closed')),
  achieved_at timestamptz,
  achieved_seen uuid[] not null default '{}',
  member_a uuid not null references auth.users (id) on delete cascade,
  member_b uuid references auth.users (id) on delete set null,
  show_each_a boolean not null default false,
  show_each_b boolean not null default false,
  percent_only_a boolean not null default false,
  percent_only_b boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index saving_bundle_space_idx on public.saving_bundle (space_id) where deleted_at is null;
alter table public.saving_bundle enable row level security;
create policy saving_bundle_select on public.saving_bundle for select to authenticated using (public.is_space_member(space_id));
create policy saving_bundle_insert on public.saving_bundle for insert to authenticated with check (false);
create policy saving_bundle_update on public.saving_bundle for update to authenticated using (false);
create policy saving_bundle_delete on public.saving_bundle for delete to authenticated using (false);
alter publication supabase_realtime add table public.saving_bundle;

alter table public.goal add column bundle_id uuid references public.saving_bundle (id) on delete set null;
create index goal_bundle_idx on public.goal (bundle_id) where bundle_id is not null;

create table public.money_in (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.couple_space (id) on delete cascade,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  amount bigint not null check (amount between 1 and 99999999999),
  received_on date not null,
  kind public.money_in_kind not null default 'etc',
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index money_in_owner_idx on public.money_in (owner_user_id, received_on) where deleted_at is null;
create index money_in_space_idx on public.money_in (space_id);
alter table public.money_in enable row level security;
create function public.money_in_visible(p_owner uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_owner = auth.uid() or exists (
    select 1 from public.app_user o join public.couple_space s on s.id = o.space_id
    where o.id = p_owner and o.plan_share = 'all' and s.couple_state = 'connected');
$$;
create policy money_in_select on public.money_in for select to authenticated
  using (public.is_space_member(space_id) and public.money_in_visible(owner_user_id));
create policy money_in_insert on public.money_in for insert to authenticated with check (false);
create policy money_in_update on public.money_in for update to authenticated using (false);
create policy money_in_delete on public.money_in for delete to authenticated using (false);

create table public.saving_note (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.couple_space (id) on delete cascade,
  goal_id uuid references public.goal (id) on delete cascade,
  bundle_id uuid references public.saving_bundle (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 20),
  amount bigint check (amount between 0 and 99999999999),
  due_on date,
  paid boolean not null default false,
  paid_at timestamptz,
  paid_move_id uuid references public.goal_move (id) on delete set null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  check ((goal_id is null) <> (bundle_id is null))
);
create index saving_note_space_idx on public.saving_note (space_id);

alter table public.goal_move
  add column reason text check (char_length(reason) <= 40),
  add column hide_from_summary boolean not null default false,
  add column money_in_id uuid references public.money_in (id) on delete set null,
  add column note_id uuid references public.saving_note (id) on delete set null;
-- 사유 글은 넣은 사람만(계약 1): 앱 역할은 reason 열을 못 읽음
revoke select on public.goal_move from anon, authenticated;
grant select (id, space_id, goal_id, kind, amount, created_by, created_at, deleted_at, reason_code, auto_line_id, auto_on,
  hide_from_summary, money_in_id, note_id) on public.goal_move to authenticated;
create view public.goal_move_public with (security_invoker = true) as
  select id, space_id, goal_id, kind, amount, created_by, created_at, reason_code, hide_from_summary, money_in_id, note_id
  from public.goal_move where deleted_at is null;
grant select on public.goal_move_public to authenticated;

create table public.shared_account (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.couple_space (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 20),
  monthly_total bigint not null check (monthly_total between 0 and 99999999999 and monthly_total % 10000 = 0),
  rule text not null check (rule in ('half', 'income_ratio', 'custom')),
  member_a uuid not null references auth.users (id) on delete cascade,
  member_b uuid not null references auth.users (id) on delete cascade,
  share_a bigint not null check (share_a >= 0),
  share_b bigint not null check (share_b >= 0),
  ratio_a smallint not null check (ratio_a between 0 and 100),
  status text not null default 'proposed' check (status in ('proposed', 'accepted', 'declined', 'expired', 'cancelled')),
  proposed_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days',
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  check (share_a + share_b = monthly_total)
);
create index shared_account_space_idx on public.shared_account (space_id);
create unique index shared_account_open on public.shared_account (space_id) where status = 'proposed';
alter table public.shared_account enable row level security;
create policy shared_account_select on public.shared_account for select to authenticated using (public.is_space_member(space_id));
create policy shared_account_insert on public.shared_account for insert to authenticated with check (false);
create policy shared_account_update on public.shared_account for update to authenticated using (false);
create policy shared_account_delete on public.shared_account for delete to authenticated using (false);
alter publication supabase_realtime add table public.shared_account;

alter table public.split_line add column shared_account_id uuid references public.shared_account (id) on delete set null;

-- ─────────────────────────── 권한 도우미 ───────────────────────────
-- 계약 2
create function public.goal_editable(p_goal uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.goal g join public.couple_space c on c.id = g.space_id
    where g.id = p_goal and g.deleted_at is null and public.is_space_member(g.space_id)
      and (g.owner_user_id = auth.uid()
        or (g.bundle_id is null and (g.owner_user_id is null or (g.visibility = 'all' and c.salary_mode = 'joint')))));
$$;

create function public.goal_visible(p_goal uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.goal g where g.id = p_goal and public.is_space_member(g.space_id)
      and (g.owner_user_id is null or g.owner_user_id = auth.uid() or g.visibility = 'all' or g.bundle_id is not null));
$$;

-- 같이 모으는 저금인가(계약 3): 공동 저금, 합쳐서 모드 저금, 묶음 저금
create function public.goal_is_together(p_goal uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.goal g join public.couple_space c on c.id = g.space_id
    where g.id = p_goal and (g.owner_user_id is null or g.bundle_id is not null or c.salary_mode = 'joint'));
$$;

-- ─────────────────────────── 묶음 ───────────────────────────
create function public.bundle_total(p_bundle uuid)
returns bigint language sql stable security definer set search_path = '' as $$
  select coalesce(sum(public.goal_saved(g.id)), 0)::bigint from public.goal g
  where g.bundle_id = p_bundle and g.deleted_at is null;
$$;

-- 계약 4: 달성·되돌림(합계 기준)
create function public.bundle_refresh(p_bundle uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  b public.saving_bundle;
  t bigint;
  u uuid;
begin
  select * into b from public.saving_bundle where id = p_bundle and deleted_at is null for update;
  if b.id is null or b.target_amount is null or b.target_amount = 0 or b.status = 'closed' then
    return;
  end if;
  t := public.bundle_total(b.id);
  if b.status = 'active' and t >= b.target_amount then
    update public.saving_bundle set status = 'achieved', achieved_at = now(), achieved_seen = '{}' where id = b.id;
    foreach u in array array_remove(array[b.member_a, b.member_b], null) loop
      perform public.notify(u, b.space_id, 'bundle_achieved', b.name || ' 다 모았어요!', null, -- [확인 필요]
        '/salary/bundles/' || b.id, 'trophy', null, 'bundle_achieved:' || b.id || ':' || u);
    end loop;
  elsif b.status = 'achieved' and t < b.target_amount then
    update public.saving_bundle set status = 'active', achieved_at = null, achieved_seen = '{}' where id = b.id;
    delete from public.notification where dedupe like 'bundle_achieved:' || b.id::text || ':%';
  end if;
end;
$$;
revoke all on function public.bundle_refresh(uuid) from public, anon, authenticated;

-- 모은 금액이 바뀐 뒤(서버): 저금 달성·되돌림 + 묶음
create function public.saving_after_change(p_goal uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  bid uuid := (select bundle_id from public.goal where id = p_goal);
begin
  perform public.goal_auto_achieve(p_goal);
  perform public.saving_unachieve(p_goal);
  if bid is not null then
    perform public.bundle_refresh(bid);
  end if;
end;
$$;
revoke all on function public.saving_after_change(uuid) from public, anon, authenticated;

-- 자동 확인·자동 넣기도 묶음을 봄(PR 2 goal_auto_achieve 뒤에)
create or replace function public.goal_auto_achieve(p_goal uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  g public.goal;
  done boolean := false;
begin
  select * into g from public.goal where id = p_goal and deleted_at is null for update;
  if g.id is null then
    return false;
  end if;
  if g.target_amount is not null and g.closed_at is null and g.status in ('active', 'delayed')
     and public.goal_saved(g.id) >= g.target_amount then
    perform public.goal_mark_achieved(g.id, null);
    done := true;
  end if;
  if g.bundle_id is not null then
    perform public.bundle_refresh(g.bundle_id);
  end if;
  return done;
end;
$$;

create function public.bundle_create(p_goal uuid, p_name text default null, p_target bigint default null,
  p_deadline date default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  g public.goal;
  sp public.couple_space;
  other uuid;
  bid uuid;
begin
  select * into g from public.goal where id = p_goal and deleted_at is null and closed_at is null for update;
  if g.id is null or g.owner_user_id is distinct from uid then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  select * into sp from public.couple_space where id = g.space_id;
  -- 각자 엔진에서만(합쳐서는 저금이 이미 공동, 2-5)
  if sp.salary_mode <> 'separate' then
    raise exception 'joint_engine' using errcode = '22023';
  end if;
  if sp.couple_state <> 'connected' then
    raise exception 'not_connected' using errcode = '22023';
  end if;
  if g.bundle_id is not null then
    raise exception 'already_bundled' using errcode = '22023';
  end if;
  if p_target is not null and (p_target < 0 or p_target > 99999999999) then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  select id into other from public.app_user where space_id = sp.id and status = 'active' and id <> uid limit 1;
  insert into public.saving_bundle (space_id, name, target_amount, deadline, member_a, member_b)
    values (sp.id, coalesce(nullif(btrim(p_name), ''), g.name), coalesce(p_target, g.target_amount),
            date_trunc('month', coalesce(p_deadline, g.deadline))::date, uid, other)
    returning id into bid;
  update public.goal set bundle_id = bid where id = g.id;
  perform public.notify(other, sp.id, 'bundle_created',
    coalesce((select nickname from public.app_user where id = uid) || '님', '파트너') || ' ‘' || g.name || '’에 같이 모을까요?', -- [확인 필요] 4-3 13번
    null, '/salary/bundles/' || bid, 'users', uid, 'bundle_created:' || bid);
  perform public.bundle_refresh(bid);
  return bid;
end;
$$;
grant execute on function public.bundle_create(uuid, text, bigint, date) to authenticated;

-- 상대가 자기 저금을 묶음에 넣음. 목표 금액이 처음 값(만든 사람 저금 목표 금액)이면 두 목표 금액 합으로(Q11)
create function public.bundle_join(p_bundle uuid, p_goal uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  b public.saving_bundle;
  g public.goal;
  first_target bigint;
begin
  select * into b from public.saving_bundle where id = p_bundle and deleted_at is null and status <> 'closed' for update;
  if b.id is null or not public.is_space_member(b.space_id) or uid not in (b.member_a, coalesce(b.member_b, b.member_a)) then
    raise exception 'not_found' using errcode = '42501';
  end if;
  select * into g from public.goal where id = p_goal and deleted_at is null and closed_at is null for update;
  if g.id is null or g.owner_user_id is distinct from uid or g.space_id <> b.space_id then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if g.bundle_id is not null or exists (select 1 from public.goal x where x.bundle_id = b.id and x.owner_user_id = uid) then
    raise exception 'already_bundled' using errcode = '22023';
  end if;
  select x.target_amount into first_target from public.goal x where x.bundle_id = b.id and x.owner_user_id = b.member_a limit 1;
  update public.goal set bundle_id = b.id where id = g.id;
  if b.target_amount is not distinct from first_target and first_target is not null and g.target_amount is not null then
    update public.saving_bundle set target_amount = first_target + g.target_amount, version = version + 1, updated_at = now()
      where id = b.id;
  end if;
  perform public.bundle_refresh(b.id);
end;
$$;
grant execute on function public.bundle_join(uuid, uuid) to authenticated;

create function public.bundle_update(p_bundle uuid, p_name text default null, p_target bigint default null,
  p_deadline date default null, p_clear_deadline boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  b public.saving_bundle;
  other uuid;
begin
  select * into b from public.saving_bundle where id = p_bundle and deleted_at is null for update;
  if b.id is null or not public.is_space_member(b.space_id) or uid not in (b.member_a, coalesce(b.member_b, b.member_a)) then
    raise exception 'not_found' using errcode = '42501';
  end if;
  if p_target is not null and (p_target < 0 or p_target > 99999999999) then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  update public.saving_bundle set
    name = coalesce(nullif(btrim(p_name), ''), name),
    target_amount = coalesce(p_target, target_amount),
    deadline = case when p_clear_deadline then null else coalesce(date_trunc('month', p_deadline)::date, deadline) end,
    percent_only_a = case when coalesce(p_target, target_amount) is null then false else percent_only_a end,
    percent_only_b = case when coalesce(p_target, target_amount) is null then false else percent_only_b end,
    version = version + 1, updated_at = now()
    where id = b.id;
  other := case when uid = b.member_a then b.member_b else b.member_a end;
  if other is not null and p_target is distinct from b.target_amount and p_target is not null then
    perform public.notify(other, b.space_id, 'bundle_changed', b.name || ' 목표 금액이 바뀌었어요', null, -- [확인 필요]
      '/salary/bundles/' || b.id, 'users', uid, 'bundle_changed:' || b.id || ':' || extract(epoch from clock_timestamp())::bigint);
  end if;
  perform public.bundle_refresh(b.id);
end;
$$;
grant execute on function public.bundle_update(uuid, text, bigint, date, boolean) to authenticated;

-- 풀기: 묶음을 닫고 저금은 각자에게(모은 금액은 그대로)
create function public.bundle_leave(p_bundle uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  b public.saving_bundle;
begin
  select * into b from public.saving_bundle where id = p_bundle and deleted_at is null for update;
  if b.id is null or not public.is_space_member(b.space_id) or uid not in (b.member_a, coalesce(b.member_b, b.member_a)) then
    raise exception 'not_found' using errcode = '42501';
  end if;
  update public.goal set bundle_id = null where bundle_id = b.id;
  update public.saving_bundle set status = 'closed', version = version + 1, updated_at = now() where id = b.id;
end;
$$;
grant execute on function public.bundle_leave(uuid) to authenticated;

-- 내 쪽만(show_each, percent_only)
create function public.bundle_set_visibility(p_bundle uuid, p_show_each boolean default null, p_percent_only boolean default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  b public.saving_bundle;
begin
  select * into b from public.saving_bundle where id = p_bundle and deleted_at is null for update;
  if b.id is null or uid not in (b.member_a, coalesce(b.member_b, b.member_a)) then
    raise exception 'not_found' using errcode = '42501';
  end if;
  if coalesce(p_percent_only, false) and (b.target_amount is null or b.target_amount = 0) then
    raise exception 'no_target' using errcode = '22023';
  end if;
  if uid = b.member_a then
    update public.saving_bundle set show_each_a = coalesce(p_show_each, show_each_a),
      percent_only_a = coalesce(p_percent_only, percent_only_a), version = version + 1, updated_at = now() where id = b.id;
  else
    update public.saving_bundle set show_each_b = coalesce(p_show_each, show_each_b),
      percent_only_b = coalesce(p_percent_only, percent_only_b), version = version + 1, updated_at = now() where id = b.id;
  end if;
end;
$$;
grant execute on function public.bundle_set_visibility(uuid, boolean, boolean) to authenticated;

-- 계약 4: 묶음 응답(H-10, W-15, 위젯이 같은 값). 내 공간의 닫히지 않은 묶음
create function public.bundle_view(p_bundle uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  sid uuid := (select space_id from public.app_user where id = auth.uid());
  hidden boolean := (select couple_state = 'unlink_pending' from public.couple_space where id = sid);
  r jsonb := '[]'::jsonb;
  b public.saving_bundle;
  total bigint;
  mine bigint;
  theirs bigint;
  pct int;
  pctonly boolean;
  each_ boolean;
begin
  for b in select x.* from public.saving_bundle x
    where x.space_id = sid and x.deleted_at is null and x.status <> 'closed' and (p_bundle is null or x.id = p_bundle)
    order by x.created_at
  loop
    mine := coalesce((select sum(public.goal_saved(g.id)) from public.goal g
      where g.bundle_id = b.id and g.owner_user_id = uid and g.deleted_at is null), 0);
    -- 해제 대기: 상대 몫을 빼고 멈춤(D5)
    theirs := case when coalesce(hidden, false) then 0 else coalesce((select sum(public.goal_saved(g.id)) from public.goal g
      where g.bundle_id = b.id and g.owner_user_id is distinct from uid and g.deleted_at is null), 0) end;
    total := mine + theirs;
    pctonly := b.percent_only_a or b.percent_only_b;
    each_ := b.show_each_a and b.show_each_b;
    pct := case when b.target_amount > 0 then least(100, floor(total::numeric * 100 / b.target_amount))::int end;
    r := r || jsonb_build_object(
      'id', b.id, 'name', b.name, 'status', b.status, 'deadline', b.deadline, 'paused', coalesce(hidden, false),
      'percent_only', pctonly, 'show_each', each_,
      'my_show_each', case when uid = b.member_a then b.show_each_a else b.show_each_b end,
      'my_percent_only', case when uid = b.member_a then b.percent_only_a else b.percent_only_b end,
      'pct', pct,
      'total', case when pctonly then null else total end,
      'target', case when pctonly then null else b.target_amount end,
      'mine', case when pctonly then null else mine end,
      'partner', case when pctonly or not each_ then null else theirs end,
      'goals', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'mine', g.owner_user_id = uid,
                  'name', g.name) order by g.created_at)
                from public.goal g where g.bundle_id = b.id and g.deleted_at is null), '[]'::jsonb));
  end loop;
  return r;
end;
$$;
grant execute on function public.bundle_view(uuid) to authenticated;

create function public.achieve_bundle(p_bundle uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  b public.saving_bundle;
begin
  select * into b from public.saving_bundle where id = p_bundle and deleted_at is null for update;
  if b.id is null or not public.is_space_member(b.space_id) then
    raise exception 'not_found' using errcode = '42501';
  end if;
  if b.status = 'achieved' and not (uid = any (b.achieved_seen)) then
    update public.saving_bundle set achieved_seen = array_append(achieved_seen, uid) where id = b.id;
    return true;
  end if;
  return false;
end;
$$;
grant execute on function public.achieve_bundle(uuid) to authenticated;

-- 모은 금액 목록: 상대의 묶인 저금은 각자 금액을 둘 다 켰을 때만(계약 4)
create or replace function public.goal_saved_sums()
returns table(goal_id uuid, saved bigint)
language sql stable security definer set search_path = '' as $$
  select g.id, public.goal_saved(g.id)
  from public.goal g
  left join public.saving_bundle b on b.id = g.bundle_id
  where g.space_id = (select space_id from public.app_user where id = auth.uid()) and g.deleted_at is null
    and (g.bundle_id is null or g.owner_user_id is null or g.owner_user_id = auth.uid()
         or (b.show_each_a and b.show_each_b and not (b.percent_only_a or b.percent_only_b)));
$$;

-- ─────────────────────────── 바로잡기·잔액 맞추기·쓸 곳 메모 ───────────────────────────
-- 계약 1·3. p_delta: + 더함, − 뺌
create function public.adjust_saving(p_goal uuid, p_delta bigint, p_reason_code public.goal_move_reason default 'fix',
  p_reason text default null, p_hide_from_summary boolean default false, p_note uuid default null, p_money_in uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  g public.goal;
  saved bigint;
  mid uuid;
  other uuid;
begin
  select * into g from public.goal where id = p_goal and deleted_at is null for update;
  if g.id is null or not public.goal_editable(p_goal) then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if (select couple_state from public.couple_space where id = g.space_id) = 'unlink_pending' and g.owner_user_id is distinct from uid then
    raise exception 'unlink_pending' using errcode = '42501';
  end if;
  if p_delta is null or p_delta = 0 or abs(p_delta) > 99999999999 then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  if p_reason_code = 'auto' then
    raise exception 'bad_reason' using errcode = '22023';
  end if;
  saved := public.goal_saved(g.id);
  if saved + p_delta < 0 then
    raise exception 'below_zero' using errcode = '22023';
  end if;
  insert into public.goal_move (space_id, goal_id, kind, amount, created_by, reason_code, reason, hide_from_summary,
                                note_id, money_in_id)
    values (g.space_id, g.id, case when p_delta > 0 then 'in' else 'out' end, abs(p_delta), uid, p_reason_code,
            nullif(left(btrim(p_reason), 40), ''), coalesce(p_hide_from_summary, false), p_note, p_money_in)
    returning id into mid;
  -- 같이 모으는 저금이면 상대에게 사람·금액·사유 없이 한 줄(인앱)
  if public.goal_is_together(g.id) then
    select id into other from public.app_user where space_id = g.space_id and status = 'active' and id <> uid limit 1;
    if other is not null then
      perform public.notify(other, g.space_id, 'saving_adjusted',
        case when p_delta < 0 then '같이 모으기에서 꺼내 썼어요' else '같이 모으기에 더했어요' end, -- [확인 필요] 7-2 G11
        null, '/salary/items/' || g.id, 'piggy-bank', null, 'saving_adjusted:' || mid);
    end if;
  end if;
  perform public.saving_after_change(g.id);
  return mid;
end;
$$;
grant execute on function public.adjust_saving(uuid, bigint, public.goal_move_reason, text, boolean, uuid, uuid) to authenticated;

-- 넣은 사람만 사유 글을 읽음
create function public.goal_move_reasons(p_goal uuid)
returns table(id uuid, reason text)
language sql stable security definer set search_path = '' as $$
  select m.id, m.reason from public.goal_move m
  where m.goal_id = p_goal and m.created_by = auth.uid() and m.reason is not null and m.deleted_at is null;
$$;
grant execute on function public.goal_move_reasons(uuid) to authenticated;

-- 계약 9
create function public.reconcile_savings(p_items jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  it jsonb;
  g public.goal;
  d bigint;
  n integer := 0;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 50 then
    raise exception 'bad_items' using errcode = '22023';
  end if;
  for it in select * from jsonb_array_elements(p_items) loop
    select * into g from public.goal where id = (it->>'goal_id')::uuid and deleted_at is null;
    if g.id is null or not public.goal_editable(g.id) then
      raise exception 'not_owner' using errcode = '42501';
    end if;
    if (it->>'actual')::bigint < 0 or (it->>'actual')::bigint > 99999999999 then
      raise exception 'bad_amount' using errcode = '22023';
    end if;
    d := (it->>'actual')::bigint - public.goal_saved(g.id);
    if d <> 0 then
      perform public.adjust_saving(g.id, d, 'reconcile', null, false);
      n := n + 1;
    end if;
  end loop;
  update public.app_user set last_reconciled_at = now() where id = auth.uid();
  return n;
end;
$$;
grant execute on function public.reconcile_savings(jsonb) to authenticated;

alter table public.saving_note enable row level security;
create function public.saving_note_visible(p_goal uuid, p_bundle uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case when p_goal is not null then public.goal_visible(p_goal)
    else exists (select 1 from public.saving_bundle b where b.id = p_bundle and public.is_space_member(b.space_id)) end;
$$;
create function public.saving_note_editable(p_goal uuid, p_bundle uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case when p_goal is not null then public.goal_editable(p_goal)
    else exists (select 1 from public.saving_bundle b where b.id = p_bundle and public.is_space_member(b.space_id)
                   and auth.uid() in (b.member_a, b.member_b)) end;
$$;
create policy saving_note_select on public.saving_note for select to authenticated
  using (public.is_space_member(space_id) and public.saving_note_visible(goal_id, bundle_id));
create policy saving_note_insert on public.saving_note for insert to authenticated
  with check (public.is_space_member(space_id) and public.saving_note_editable(goal_id, bundle_id) and not paid);
create policy saving_note_update on public.saving_note for update to authenticated
  using (public.is_space_member(space_id) and public.saving_note_editable(goal_id, bundle_id))
  with check (public.is_space_member(space_id) and public.saving_note_editable(goal_id, bundle_id));
create policy saving_note_delete on public.saving_note for delete to authenticated using (false);
revoke insert, update on public.saving_note from anon, authenticated;
grant insert (space_id, goal_id, bundle_id, name, amount, due_on) on public.saving_note to authenticated;
grant update (name, amount, due_on, deleted_at) on public.saving_note to authenticated;

-- 계약 8. 바로잡기 goal_move id(빼지 않으면 null)
create function public.mark_note_paid(p_note uuid, p_subtract boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  n public.saving_note;
  gid uuid;
  mid uuid;
begin
  select * into n from public.saving_note where id = p_note and deleted_at is null for update;
  if n.id is null or not public.saving_note_editable(n.goal_id, n.bundle_id) then
    raise exception 'not_found' using errcode = '42501';
  end if;
  if n.paid then
    raise exception 'already_paid' using errcode = '22023';
  end if;
  if p_subtract and coalesce(n.amount, 0) > 0 then
    gid := coalesce(n.goal_id, (select id from public.goal where bundle_id = n.bundle_id and owner_user_id = uid
                                  and deleted_at is null limit 1));
    if gid is null then
      raise exception 'no_goal' using errcode = '22023';
    end if;
    mid := public.adjust_saving(gid, -n.amount, 'note_paid', n.name, false, n.id);
  end if;
  update public.saving_note set paid = true, paid_at = now(), paid_move_id = mid where id = n.id;
  return mid;
end;
$$;
grant execute on function public.mark_note_paid(uuid, boolean) to authenticated;

-- ─────────────────────────── 돈 들어왔어요 ───────────────────────────
create function public.log_money_in(p_amount bigint, p_received_on date default null, p_kind public.money_in_kind default 'etc')
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  sid uuid := (select space_id from public.app_user where id = auth.uid());
  rid uuid;
begin
  if sid is null then
    raise exception 'no_space' using errcode = '42501';
  end if;
  if p_amount is null or p_amount < 1 or p_amount > 99999999999 then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  if coalesce(p_received_on, public.kst_today()) > public.kst_today() then
    raise exception 'future_date' using errcode = '22023';
  end if;
  insert into public.money_in (space_id, owner_user_id, amount, received_on, kind)
    values (sid, uid, p_amount, coalesce(p_received_on, public.kst_today()), coalesce(p_kind, 'etc'))
    returning id into rid;
  return rid;
end;
$$;
grant execute on function public.log_money_in(bigint, date, public.money_in_kind) to authenticated;

-- 받은 날·금액·종류 고치기(기간은 다시 계산됨)
create function public.money_in_set(p_id uuid, p_amount bigint default null, p_received_on date default null,
  p_kind public.money_in_kind default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  m public.money_in;
begin
  select * into m from public.money_in where id = p_id and owner_user_id = auth.uid() and deleted_at is null for update;
  if m.id is null then
    raise exception 'not_found' using errcode = '42501';
  end if;
  if p_amount is not null and (p_amount < 1 or p_amount > 99999999999
      or p_amount < coalesce((select sum(amount) from public.goal_move where money_in_id = m.id and deleted_at is null), 0)) then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  if p_received_on is not null and p_received_on > public.kst_today() then
    raise exception 'future_date' using errcode = '22023';
  end if;
  update public.money_in set amount = coalesce(p_amount, amount), received_on = coalesce(p_received_on, received_on),
    kind = coalesce(p_kind, kind) where id = m.id;
end;
$$;
grant execute on function public.money_in_set(uuid, bigint, date, public.money_in_kind) to authenticated;

-- 지우면 나눠 넣은 것도 지움
create function public.money_in_delete(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  gid uuid;
begin
  update public.money_in set deleted_at = now() where id = p_id and owner_user_id = auth.uid() and deleted_at is null;
  if not found then
    raise exception 'not_found' using errcode = '42501';
  end if;
  for gid in update public.goal_move set deleted_at = now() where money_in_id = p_id and deleted_at is null returning goal_id loop
    perform public.saving_after_change(gid);
  end loop;
end;
$$;
grant execute on function public.money_in_delete(uuid) to authenticated;

-- 계약 5. p_items = [{goal_id, amount}]
create function public.distribute_money_in(p_money_in uuid, p_items jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  m public.money_in;
  it jsonb;
  used bigint;
  total bigint := 0;
  n integer := 0;
begin
  select * into m from public.money_in where id = p_money_in and owner_user_id = auth.uid() and deleted_at is null for update;
  if m.id is null then
    raise exception 'not_found' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 30 then
    raise exception 'bad_items' using errcode = '22023';
  end if;
  select coalesce(sum(amount), 0) into used from public.goal_move where money_in_id = m.id and deleted_at is null;
  select coalesce(sum((x->>'amount')::bigint), 0) into total from jsonb_array_elements(p_items) x;
  if used + total > m.amount then
    raise exception 'over' using errcode = '22023';
  end if;
  for it in select * from jsonb_array_elements(p_items) loop
    continue when coalesce((it->>'amount')::bigint, 0) <= 0;
    perform public.adjust_saving((it->>'goal_id')::uuid, (it->>'amount')::bigint, 'custom', null, false, null, m.id);
    n := n + 1;
  end loop;
  return n;
end;
$$;
grant execute on function public.distribute_money_in(uuid, jsonb) to authenticated;

-- 계약 6. 날짜 없는 사람 H-11/H-13
create function public.money_in_period(p_user uuid default null, p_today date default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := coalesce(p_user, auth.uid());
  today date := coalesce(p_today, public.kst_today());
  u public.app_user;
  d date;
  s date;
  e date;
  last_on date;
  rec bigint;
  need bigint;
  joint boolean;
begin
  select * into u from public.app_user where id = uid;
  if u.id is null or (uid <> auth.uid() and auth.uid() is not null) then
    raise exception 'not_found' using errcode = '42501';
  end if;
  for d in select distinct received_on from public.money_in
    where owner_user_id = uid and deleted_at is null and received_on <= today order by received_on
  loop
    if s is null or d > e then
      s := d;
      e := d + 29;
    end if;
    last_on := d;
  end loop;
  if s is null then
    return jsonb_build_object('status', 'none', 'start', null, 'end', null, 'day', null, 'received', 0, 'needed', null,
      'gap_days', null);
  end if;
  select salary_mode = 'joint' into joint from public.couple_space where id = u.space_id;
  select coalesce(sum(l.amount), 0) into need from public.split_line l join public.salary_split sp on sp.id = l.split_id
    where sp.space_id = u.space_id and sp.owner_user_id is not distinct from case when joint then null else uid end;
  if today > e then
    return jsonb_build_object('status', 'gap', 'start', s, 'end', e, 'day', null,
      'received', (select coalesce(sum(amount), 0) from public.money_in where owner_user_id = uid and deleted_at is null
                     and received_on between s and least(e, today)),
      'needed', need, 'gap_days', today - last_on);
  end if;
  select coalesce(sum(amount), 0) into rec from public.money_in
    where owner_user_id = uid and deleted_at is null and received_on between s and least(e, today);
  return jsonb_build_object('status', case when today - s + 1 <= 15 then 'early' else 'bar' end,
    'start', s, 'end', e, 'day', today - s + 1, 'received', rec, 'needed', need, 'gap_days', null);
end;
$$;
grant execute on function public.money_in_period(uuid, date) to authenticated;

-- ─────────────────────────── 분담(R3) ───────────────────────────
create function public.round10k(v numeric)
returns bigint language sql immutable set search_path = '' as $$
  select (round(v / 10000) * 10000)::bigint;
$$;

-- 계약 7. p_share_mine은 custom일 때 제안한 사람 몫
create function public.propose_split(p_name text, p_monthly_total bigint, p_rule text, p_share_mine bigint default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  me public.app_user;
  other public.app_user;
  sp public.couple_space;
  a bigint;
  rid uuid;
begin
  select * into me from public.app_user where id = uid;
  select * into sp from public.couple_space where id = me.space_id;
  if sp.id is null or sp.couple_state <> 'connected' then
    raise exception 'not_connected' using errcode = '22023';
  end if;
  select * into other from public.app_user where space_id = sp.id and status = 'active' and id <> uid limit 1;
  if p_monthly_total is null or p_monthly_total <= 0 or p_monthly_total > 99999999999 or p_monthly_total % 10000 <> 0 then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  if p_rule = 'half' then
    a := public.round10k(p_monthly_total / 2.0);
  elsif p_rule = 'income_ratio' then
    if me.plan_share <> 'all' or other.plan_share <> 'all' or coalesce(me.monthly_income, 0) <= 0
       or coalesce(other.monthly_income, 0) <= 0 then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
    a := public.round10k(p_monthly_total::numeric * me.monthly_income / (me.monthly_income + other.monthly_income));
  elsif p_rule = 'custom' then
    if p_share_mine is null or p_share_mine < 0 or p_share_mine > p_monthly_total or p_share_mine % 10000 <> 0 then
      raise exception 'bad_amount' using errcode = '22023';
    end if;
    a := p_share_mine;
  else
    raise exception 'bad_rule' using errcode = '22023';
  end if;
  update public.shared_account set status = 'cancelled', answered_at = now() where space_id = sp.id and status = 'proposed';
  insert into public.shared_account (space_id, name, monthly_total, rule, member_a, member_b, share_a, share_b, ratio_a,
                                     proposed_by)
    values (sp.id, btrim(p_name), p_monthly_total, p_rule, uid, other.id, a, p_monthly_total - a,
            round(a * 100.0 / p_monthly_total)::smallint, uid)
    returning id into rid;
  perform public.notify(other.id, sp.id, 'split_request',
    coalesce(me.nickname || '님이', '파트너가') || ' ‘' || btrim(p_name) || '’을 나눠 보자고 해요', -- [확인 필요] 4-3 4번(‘제안’ 금지어 피함)
    null, '/salary/split/' || rid, 'users', uid, 'split_request:' || rid);
  return rid;
end;
$$;
grant execute on function public.propose_split(text, bigint, text, bigint) to authenticated;

-- 월급 계획에 같이 쓰는 통장 줄(내부): 각자 = 사람마다 그 몫, 합쳐서 = 공동 계획에 합계 한 줄
create function public.apply_shared_account(p_account uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  a public.shared_account;
  joint boolean;
  sp public.salary_split;
  amt bigint;
  lid uuid;
begin
  select * into a from public.shared_account where id = p_account;
  select salary_mode = 'joint' into joint from public.couple_space where id = a.space_id;
  for sp in select x.* from public.salary_split x
    where x.space_id = a.space_id and ((joint and x.owner_user_id is null)
      or (not joint and x.owner_user_id in (a.member_a, a.member_b)))
  loop
    amt := case when joint then a.monthly_total when sp.owner_user_id = a.member_a then a.share_a else a.share_b end;
    select id into lid from public.split_line where split_id = sp.id and kind = 'shared_account'
      and (shared_account_id = a.id or shared_account_id is null) order by shared_account_id nulls last limit 1;
    if lid is null then
      insert into public.split_line (split_id, space_id, kind, amount, sort, shared_account_id)
        values (sp.id, a.space_id, 'shared_account', amt,
          (select coalesce(max(sort), -1) + 1 from public.split_line where split_id = sp.id), a.id);
    else
      update public.split_line set amount = amt, shared_account_id = a.id where id = lid;
    end if;
    lid := null;
    update public.salary_split set version = version + 1, updated_at = now() where id = sp.id;
    perform public.sync_checklist(sp.id);
  end loop;
end;
$$;
revoke all on function public.apply_shared_account(uuid) from public, anon, authenticated;

create function public.answer_split(p_id uuid, p_accept boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  a public.shared_account;
begin
  select * into a from public.shared_account where id = p_id for update;
  if a.id is null or not public.is_space_member(a.space_id) or a.proposed_by = uid then
    raise exception 'not_found' using errcode = '42501';
  end if;
  if a.status <> 'proposed' then
    raise exception 'not_open' using errcode = '22023';
  end if;
  if a.expires_at < now() then
    update public.shared_account set status = 'expired' where id = a.id;
    return 'expired';
  end if;
  update public.shared_account set status = case when p_accept then 'accepted' else 'declined' end, answered_at = now()
    where id = a.id;
  if p_accept then
    perform public.apply_shared_account(a.id);
  end if;
  perform public.notify(a.proposed_by, a.space_id, 'split_result',
    case when p_accept then '‘' || a.name || '’ 나누기를 정했어요' else '‘' || a.name || '’ 나누기는 지금처럼 둘게요' end, -- [확인 필요]
    null, '/salary?view=plan', 'users', uid, 'split_result:' || a.id);
  return case when p_accept then 'accepted' else 'declined' end;
end;
$$;
grant execute on function public.answer_split(uuid, boolean) to authenticated;

-- ─────────────────────────── 알림 ───────────────────────────
create or replace function public.noti_inapp_only(p_kind text)
returns boolean language sql immutable set search_path = '' as $$
  select p_kind in ('salary_changed', 'mode_result', 'saving_adjusted', 'bundle_created', 'bundle_changed', 'split_result',
                    'weekly_saving');
$$;

-- 주간 요약에 같이 모으기 바로잡기 한 줄(사람·금액·사유 없음, hide_from_summary 빼고). 월요일 09:00 주간 요약 뒤에
create or replace function public.send_weekly_summary(p_today date default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  today date := coalesce(p_today, public.kst_today());
  r record;
  title text;
  b record;
  cnt integer := 0;
begin
  for r in
    with w as (
      select c.* from public.partner_change c
      where (c.created_at at time zone 'Asia/Seoul')::date between today - 7 and today - 1
    ),
    m as (
      select w.receiver_id, w.actor_id, w.space_id, w.topic, w.ref_id, w.field,
        (array_agg(w.before_v order by w.id))[1] as b, (array_agg(w.after_v order by w.id desc))[1] as a
      from w group by w.receiver_id, w.actor_id, w.space_id, w.topic, w.ref_id, w.field
    )
    select m.receiver_id, m.actor_id, m.space_id, count(*)::int as n
    from m
    join public.app_user u on u.id = m.receiver_id and u.space_id = m.space_id and u.status = 'active'
    where m.b is distinct from m.a
    group by m.receiver_id, m.actor_id, m.space_id
  loop
    title := '이번 주 ' || coalesce(nullif((select nickname from public.app_user where id = r.actor_id), '') || '님이', '파트너가') || ' 바꾼 게 ' || r.n || '개 있어요';
    perform public.notify(r.receiver_id, r.space_id, 'weekly_summary', title,
      null, '/notifications', null, r.actor_id, 'weekly:' || r.receiver_id || ':' || today);
    select * into b from public.weekly_mail_body(r.receiver_id, r.actor_id, today);
    perform public.enqueue_mail(r.receiver_id, 'weekly_summary', 'partner_change', title, b.body_text, b.body_html,
      false, 'weekly:' || r.receiver_id || ':' || today);
    cnt := cnt + 1;
  end loop;
  -- G11: 같이 모으는 저금을 상대가 바로잡은 주
  for r in
    select u.id as receiver_id, u.space_id, bool_or(m.kind = 'out') as took
    from public.goal_move m
    join public.app_user u on u.space_id = m.space_id and u.status = 'active' and u.id <> m.created_by
    where m.reason_code in ('fix', 'used', 'interest', 'reconcile', 'note_paid') and not m.hide_from_summary
      and m.deleted_at is null and m.created_by is not null
      and (m.created_at at time zone 'Asia/Seoul')::date between today - 7 and today - 1
      and public.goal_is_together(m.goal_id)
    group by u.id, u.space_id
  loop
    perform public.notify(r.receiver_id, r.space_id, 'weekly_saving',
      case when r.took then '이번 주 같이 모으기에서 꺼내 썼어요' else '이번 주 같이 모으기에 더했어요' end, -- [확인 필요]
      null, '/salary', 'piggy-bank', null, 'weekly_saving:' || r.receiver_id || ':' || today);
    cnt := cnt + 1;
  end loop;
  return cnt;
end;
$$;

-- 진행 소식 대표 저금: 묶음이 있으면 묶음(%만, PR 2 계약 그대로 그다음 저금)
create or replace function public.progress_hero(p_user uuid)
returns table(goal_id uuid, name text, pct integer)
language sql stable security definer set search_path = '' as $$
  (select b.id, b.name, least(100, floor(public.bundle_total(b.id)::numeric * 100 / b.target_amount))::int
   from public.saving_bundle b join public.app_user u on u.id = p_user and u.space_id = b.space_id
   where b.deleted_at is null and b.status = 'active' and b.target_amount > 0 and p_user in (b.member_a, b.member_b)
     and exists (select 1 from public.goal g where g.bundle_id = b.id and g.owner_user_id = p_user)
   order by b.created_at limit 1)
  union all
  (select g.id, g.name, least(100, floor(public.goal_saved(g.id)::numeric * 100 / g.target_amount))::int
   from public.goal g
   join public.app_user u on u.id = p_user and u.space_id = g.space_id
   where g.deleted_at is null and g.closed_at is null and g.status in ('active', 'delayed')
     and g.target_amount > 0 and (g.owner_user_id is null or g.owner_user_id = p_user)
   order by (g.owner_user_id is null) desc, g.priority, g.created_at
   limit 1)
  limit 1;
$$;

-- 체크·풀기(check_pay_line, confirm_payday 뒤 앱의 achieve_goal 경로)도 묶음 합계를 다시 봄
create or replace function public.saving_unachieve(p_goal uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  g public.goal;
begin
  select * into g from public.goal where id = p_goal for update;
  if g.id is null then
    return;
  end if;
  if g.bundle_id is not null then
    perform public.bundle_refresh(g.bundle_id);
  end if;
  if g.status <> 'achieved' or g.closed_at is not null or g.target_amount is null then
    return;
  end if;
  if public.goal_saved(g.id) >= g.target_amount then
    return;
  end if;
  update public.goal set status = 'active', achieved_at = null, achieved_seen = '{}' where id = g.id;
  delete from public.notification where dedupe like 'goal_achieved:' || g.id::text || ':%';
end;
$$;

-- 진행 소식 링크: 대표가 묶음일 수도 있어 홈(H-10)으로
create or replace function public.send_progress_news(p_today date default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  today date := coalesce(p_today, public.kst_today());
  cl public.pay_checklist;
  u public.app_user;
  h record;
  cnt integer := 0;
begin
  for cl in
    select x.* from public.pay_checklist x
    join public.couple_space s on s.id = x.space_id and s.deleted_at is null
    where x.cycle_start = today and x.state <> 'closed'
      and not exists (select 1 from public.pay_check_line l where l.checklist_id = x.id and not l.auto)
  loop
    for u in
      select x.* from public.app_user x
      where x.space_id = cl.space_id and x.status = 'active' and (cl.owner_user_id is null or x.id = cl.owner_user_id)
        and public.push_kind_on(x.push_kinds, 'progress_news')
    loop
      select * into h from public.progress_hero(u.id);
      continue when h.goal_id is null;
      perform public.notify(u.id, cl.space_id, 'progress_news', '월급날이에요', -- [확인 필요] v2.2 7-2
        h.name || ' ' || h.pct || '%까지 왔어요', '/', 'piggy-bank', null,
        'progress:' || cl.id || ':' || u.id);
      cnt := cnt + 1;
      h := null;
    end loop;
  end loop;
  -- 날짜 없는 사람(확인 목록 없음): 매달 1일
  if extract(day from today) = 1 then
    for u in
      select x.* from public.app_user x
      join public.couple_space s on s.id = x.space_id and s.deleted_at is null
      where x.status = 'active' and x.payday_none and public.push_kind_on(x.push_kinds, 'progress_news')
        and public.cycle_day(x.space_id, case when s.salary_mode = 'joint' then null else x.id end) is null
    loop
      select * into h from public.progress_hero(u.id);
      continue when h.goal_id is null;
      perform public.notify(u.id, u.space_id, 'progress_news', '이번 달 진행 소식이에요', -- [확인 필요]
        h.name || ' ' || h.pct || '%까지 왔어요', '/', 'piggy-bank', null,
        'progress:none:' || u.id || ':' || to_char(today, 'YYYY-MM'));
      cnt := cnt + 1;
      h := null;
    end loop;
  end if;
  return cnt;
end;
$$;

-- Realtime(H-10·W-13·W-14 갱신, PR 7 구독): 읽기 정책 그대로 걸러짐. money_in = 주인(공개 ‘모두’면 상대),
-- saving_note = 그 저금을 볼 수 있는 사람(메모 이름·금액·날짜만, 바로잡기 사유 없음).
-- goal_move는 넣지 않음: reason 열은 열 권한으로만 가려서 Realtime(행 단위 RLS)으로는 새어 나갈 수 있음.
-- 상대 화면은 saving_adjusted 알림·goal_saved_sums 다시 읽기로 갱신
alter publication supabase_realtime add table public.money_in, public.saving_note;
