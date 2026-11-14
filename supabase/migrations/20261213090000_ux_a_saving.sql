-- 실구동 사용성 고침 A(같이 모으기·저금·돈 기록, 2026-11-14). 스키마는 추가만(표·열 없음, 함수만 고침).
--
-- ■ 계약(앱이 같은 결과)
--  1. 묶음은 한 쌍에 하나씩(H1): bundle_create(goal, name, target, deadline, separate)는 같은 공간에 아직 한 사람만 든
--     묶음(상대가 만든 들어갈 묶음, 또는 내가 만들어 상대를 기다리는 묶음)이 열려 있으면 'bundle_open'으로 거절.
--     사용자가 따로 모으기로 고른 경우만 p_separate = true로 만듦. 둘 다 든 묶음은 막지 않음(다른 저금은 따로 묶을 수 있음).
--     옛 4개 인자 함수는 지우고 같은 이름 5개 인자(마지막 기본 false)로 바꿈(옛 앱 호출도 그대로 됨).
--  2. bundle_view 응답에 month_gain(이번 달 +, 06 5-6): 묶인 저금마다 주인의 이번 사이클 확인 목록에서 확인한 저금 줄
--     + 그 사이클 시작일(없으면 이달 1일)부터 오늘까지 돈 들어왔어요로 넣은 것·자동 넣기. 퍼센트만이면 null.
--     상대 저금 움직임을 볼 수 없는 사람도 묶음 합계와 같은 값을 봄(M1).
--  3. adjust_saving 상대 한 줄(M3): ‘주간 요약에 넣지 않기’(hide_from_summary)면 상대에게 아무것도 보내지 않음.
--     문구는 사유대로: 뺐고 사유가 used(꺼내 썼어요)·note_paid(쓸 곳 메모 냈어요)면 “같이 모으기에서 꺼내 썼어요”,
--     더했고 사유가 interest·custom이면 “같이 모으기에 더했어요”, 그 밖(숫자를 맞춰요, 잔액 맞추기, 직접 쓴 사유로 뺌)은
--     “같이 모으기 금액을 맞췄어요”. 주간 요약 한 줄도 같은 규칙(그 주에 꺼내 쓴 게 있으면 꺼내 썼어요가 먼저).
--  4. money_in_restore(id): 지운 돈 들어온 기록(주인만)과 그때 같이 지운 나눠 넣은 움직임을 되살림(M6 ‘되돌리기’).

-- ─────────────────────────── 1. 묶음 하나씩 ───────────────────────────
drop function public.bundle_create(uuid, text, bigint, date);
create function public.bundle_create(p_goal uuid, p_name text default null, p_target bigint default null,
  p_deadline date default null, p_separate boolean default false)
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
  -- 아직 한 사람만 든 묶음(들어갈 묶음 또는 기다리는 묶음)이 열려 있으면 거절(계약 1)
  if not coalesce(p_separate, false) and exists (
    select 1 from public.saving_bundle b
    where b.space_id = sp.id and b.deleted_at is null and b.status <> 'closed'
      and (select count(distinct x.owner_user_id) from public.goal x
           where x.bundle_id = b.id and x.deleted_at is null) < 2) then
    raise exception 'bundle_open' using errcode = '22023';
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
revoke all on function public.bundle_create(uuid, text, bigint, date, boolean) from public, anon;
grant execute on function public.bundle_create(uuid, text, bigint, date, boolean) to authenticated;

-- ─────────────────────────── 2. 묶음 이번 달 + ───────────────────────────
create function public.bundle_month_gain(p_bundle uuid, p_today date default null)
returns bigint language sql stable security definer set search_path = '' as $$
  select coalesce(sum(
    coalesce((select sum(coalesce(l.actual, l.planned)) from public.pay_check_line l
              where l.checklist_id = c.id and l.goal_id = g.id and l.kind = 'saving' and l.state = 'checked'), 0)
    + coalesce((select sum(m.amount) from public.goal_move m
                where m.goal_id = g.id and m.deleted_at is null and m.kind = 'in'
                  and (m.reason_code = 'auto' or m.money_in_id is not null)
                  and (m.created_at at time zone 'Asia/Seoul')::date
                      between coalesce(c.cycle_start, date_trunc('month', coalesce(p_today, public.kst_today()))::date)
                          and coalesce(p_today, public.kst_today())), 0)), 0)::bigint
  from public.goal g
  left join lateral (
    select k.id, k.cycle_start from public.pay_checklist k
    where k.space_id = g.space_id and k.owner_user_id is not distinct from g.owner_user_id
      and k.cycle_start <= coalesce(p_today, public.kst_today()) and k.cycle_end >= coalesce(p_today, public.kst_today())
    order by k.cycle_start desc limit 1) c on true
  where g.bundle_id = p_bundle and g.deleted_at is null;
$$;
revoke all on function public.bundle_month_gain(uuid, date) from public, anon, authenticated;

create or replace function public.bundle_view(p_bundle uuid default null)
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
    theirs := case when coalesce(hidden, false) then 0 else coalesce((select sum(public.goal_saved(g.id)) from public.goal g
      where g.bundle_id = b.id and g.owner_user_id is distinct from uid and g.deleted_at is null), 0) end;
    total := mine + theirs;
    pctonly := b.percent_only_a or b.percent_only_b;
    each_ := b.show_each_a and b.show_each_b and not exists (
      select 1 from public.app_user u join public.couple_space s on s.id = b.space_id
      where u.id in (b.member_a, b.member_b) and s.salary_mode <> 'joint' and u.plan_share = 'done_only');
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
      'month_gain', case when pctonly or coalesce(hidden, false) then null else public.bundle_month_gain(b.id) end,
      'goals', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'mine', g.owner_user_id = uid,
                  'name', case when public.saving_owner_hidden(g.space_id, g.owner_user_id) then null else g.name end)
                  order by g.created_at)
                from public.goal g where g.bundle_id = b.id and g.deleted_at is null), '[]'::jsonb));
  end loop;
  return r;
end;
$$;

-- ─────────────────────────── 3. 바로잡기 상대 한 줄 ───────────────────────────
create function public.saving_adjust_title(p_kind text, p_reason public.goal_move_reason)
returns text language sql immutable set search_path = '' as $$
  select case
    when p_kind = 'out' and p_reason in ('used', 'note_paid') then '같이 모으기에서 꺼내 썼어요' -- [확인 필요] 7-2 G11
    when p_kind = 'in' and p_reason in ('interest', 'custom') then '같이 모으기에 더했어요' -- [확인 필요]
    else '같이 모으기 금액을 맞췄어요' -- [확인 필요] 2026-11-14 M3
  end;
$$;

create or replace function public.adjust_saving(p_goal uuid, p_delta bigint, p_reason_code public.goal_move_reason default 'fix',
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
  -- 같이 모으는 저금이면 상대에게 사람·금액·사유 없이 한 줄(인앱). ‘주간 요약에 넣지 않기’면 보내지 않음(계약 3)
  if public.goal_is_together(g.id) and not coalesce(p_hide_from_summary, false) then
    select id into other from public.app_user where space_id = g.space_id and status = 'active' and id <> uid limit 1;
    if other is not null then
      perform public.notify(other, g.space_id, 'saving_adjusted',
        public.saving_adjust_title(case when p_delta < 0 then 'out' else 'in' end, p_reason_code),
        null, '/salary/items/' || g.id, 'piggy-bank', null, 'saving_adjusted:' || mid);
    end if;
  end if;
  perform public.saving_after_change(g.id);
  return mid;
end;
$$;

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
  -- G11: 같이 모으는 저금을 상대가 바로잡은 주(계약 3: 꺼내 씀 > 더함 > 맞춤)
  for r in
    select u.id as receiver_id, u.space_id,
      bool_or(m.kind = 'out' and m.reason_code in ('used', 'note_paid')) as took,
      bool_or(m.kind = 'in' and m.reason_code in ('interest', 'custom')) as added
    from public.goal_move m
    join public.app_user u on u.space_id = m.space_id and u.status = 'active' and u.id <> m.created_by
    where m.reason_code in ('fix', 'used', 'interest', 'reconcile', 'note_paid') and not m.hide_from_summary
      and m.deleted_at is null and m.created_by is not null
      and (m.created_at at time zone 'Asia/Seoul')::date between today - 7 and today - 1
      and public.goal_is_together(m.goal_id)
    group by u.id, u.space_id
  loop
    perform public.notify(r.receiver_id, r.space_id, 'weekly_saving',
      case when r.took then '이번 주 같이 모으기에서 꺼내 썼어요' when r.added then '이번 주 같이 모으기에 더했어요'
           else '이번 주 같이 모으기 금액을 맞췄어요' end, -- [확인 필요]
      null, '/salary', 'piggy-bank', null, 'weekly_saving:' || r.receiver_id || ':' || today);
    cnt := cnt + 1;
  end loop;
  return cnt;
end;
$$;

-- ─────────────────────────── 4. 돈 들어온 기록 지우기 되돌리기(M6) ───────────────────────────
-- money_in_delete(그대로)가 같은 시각으로 지운 기록과 나눠 넣은 움직임을 되살림(W-20b Toast ‘되돌리기’). 주인만
create function public.money_in_restore(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  m public.money_in;
  gid uuid;
begin
  select * into m from public.money_in where id = p_id and owner_user_id = auth.uid() and deleted_at is not null for update;
  if m.id is null then
    raise exception 'not_found' using errcode = '42501';
  end if;
  update public.money_in set deleted_at = null where id = m.id;
  for gid in update public.goal_move set deleted_at = null
      where money_in_id = m.id and deleted_at = m.deleted_at returning goal_id loop
    perform public.saving_after_change(gid);
  end loop;
end;
$$;
revoke all on function public.money_in_restore(uuid) from public, anon;
grant execute on function public.money_in_restore(uuid) to authenticated;
