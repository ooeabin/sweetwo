-- 연결 해제 확정(S-12d ‘동의해요’ → S-12h). 08 부부·제안·권한 3장, 31 보안·개인정보 4장 ‘연결 해제 시 데이터 소유’.
--
-- 확정 = 두 사람이 각자 새 공간(혼자 쓰기)으로 옮김. 원래 공간은 해제 전 공동 데이터 그대로 30일 보관(다시 연결 S-12g용),
-- 지운 표시(deleted_at)만 하고 구성원이 없어 아무도 못 봄. 30일 뒤 지우기는 다시 연결과 함께.
--
-- 사람별 새 공간에:
--   옮김(원래 행의 space_id만 바꿈): 내 명의 자산·부채와 그 기록, 내 개인 통장, 내 수입 항목·이벤트, 내 알림
--   사본(새 id): 목표, 고정 지출, 지출 항목, 공동 역할 통장, 월 플랜·플랜 줄, 월말 정리·지출·큰 지출·저축 기록,
--               제안 기록(열린 제안 제외), 내 할 일, 내 쪽 가족·그 챙길 날·드린 기록, 내가 만든 서프라이즈
--   공동 명의 자산·부채: 확정된 자산 정리 안의 내 몫으로 내 명의 사본
--   목표 보유액: 저축 기록 + 따로 모은 돈 − 쓴 돈을 자산 정리 안 비율(자산 항목 내 몫 합 ÷ 합계)로 나눠 ‘따로 모은 돈’에.
--                저축 기록 사본은 목표 연결 없이(월말 정리 기록으로만), 쓴 기록 사본은 만들지 않음(두 번 세지 않게)
--   남기지 않음: 부부·결혼 챙길 날(서프라이즈 제외), 상대 명의 항목, 상대 쪽 가족
-- 원래 id ↔ 사본 id는 unlink_copy에 남김(다시 연결 때 되돌리기).
--
-- 자산 정리 안에 공동 명의 부채도 넣음(사용자 결정 2026-10-18): request_unlink를 고쳐 plan 줄에 side를 둠.

alter table public.couple_unlink
  add column partner_id uuid references public.app_user (id),
  add column final_plan jsonb,
  add column how text check (how in ('agreed', 'counter', 'deadline')),
  add column reconnect_until timestamptz;
update public.couple_unlink u set partner_id = (
  select m.id from public.app_user m
  where m.space_id = u.space_id and m.status = 'active' and m.id <> u.requested_by limit 1)
where partner_id is null;

-- 해제 뒤에는 원래 공간 구성원이 아니어도 두 사람은 요청을 봄(S-12 혼자 쓰기 ‘다시 연결하기’)
drop policy couple_unlink_select on public.couple_unlink;
create policy couple_unlink_select on public.couple_unlink for select to authenticated
  using (public.is_space_member(space_id) or requested_by = (select auth.uid()) or partner_id = (select auth.uid()));

alter table public.couple_space add column unlinked_from uuid references public.couple_space (id) on delete set null;

create table public.unlink_copy (
  unlink_id uuid not null references public.couple_unlink (id) on delete cascade,
  user_id uuid not null,
  tbl text not null,
  old_id uuid not null,
  new_id uuid not null,
  primary key (unlink_id, user_id, old_id)
);
alter table public.unlink_copy enable row level security;
revoke all on public.unlink_copy from authenticated, anon;

-- ── 요청: 공동 명의 부채도 자산 정리 안에(plan 줄 side) ─────────────────────────
create or replace function public.request_unlink(p_shares jsonb, p_confirm text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  me public.app_user;
  other public.app_user;
  sp public.couple_space;
  pct smallint;
  items jsonb := '[]'::jsonb;
  a record;
  v jsonb;
  mine bigint;
  new_id uuid;
  dl date := public.kst_today() + 14;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_confirm is distinct from '연결 해제' then
    raise exception 'confirm_mismatch' using errcode = 'P0001';
  end if;
  if p_shares is null or jsonb_typeof(p_shares) <> 'object' then
    raise exception 'invalid_shares' using errcode = '22023';
  end if;
  select * into me from public.app_user where id = uid and status = 'active';
  select * into sp from public.couple_space where id = me.space_id for update;
  if sp.id is null or sp.couple_state <> 'connected' then
    raise exception 'not_connected' using errcode = '42501';
  end if;
  select * into other from public.app_user
    where space_id = sp.id and status = 'active' and id <> uid limit 1;
  if other.id is null then
    raise exception 'not_connected' using errcode = '42501';
  end if;
  pct := public.unlink_ratio(sp.id, uid);
  for a in
    select x.id, x.name, x.amount, x.side from public.asset x
    where x.space_id = sp.id and x.owner = 'joint' and x.status = 'held'
      and x.deleted_at is null and x.amount > 0
    order by x.side, x.created_at, x.id
  loop
    v := p_shares -> a.id::text;
    if v is null or jsonb_typeof(v) = 'null' then
      mine := public.unlink_share(a.amount, pct);
    elsif jsonb_typeof(v) <> 'number' or (v #>> '{}') !~ '^\d+$' then
      raise exception 'invalid_shares' using errcode = '22023';
    else
      mine := (v #>> '{}')::bigint;
      if mine > a.amount then
        raise exception 'invalid_shares' using errcode = '22023';
      end if;
    end if;
    items := items || jsonb_build_array(jsonb_build_object(
      'asset_id', a.id, 'name', a.name, 'amount', a.amount, 'mine', mine, 'side', a.side));
  end loop;

  insert into public.couple_unlink (space_id, requested_by, partner_id, deadline, ratio, plan)
    values (sp.id, uid, other.id, dl, pct, items)
    returning id into new_id;
  update public.couple_space set couple_state = 'unlink_pending' where id = sp.id;

  perform public.notify(
    other.id, sp.id, 'unlink_requested',
    coalesce(me.nickname, '') || '님이 연결 해제를 요청했어요',
    '자산 정리 안을 확인해 주세요',
    '/settings/couple', null, uid, 'unlink:' || new_id || ':requested');
  return new_id;
end;
$$;

-- ── 한 사람 몫으로 새 공간 만들기(내부) ───────────────────────────────────────
-- is_req: 이 사람이 요청한 사람인지(plan의 mine = 요청한 사람 몫)
create or replace function public.unlink_make_space(u public.couple_unlink, x uuid, is_req boolean, plan jsonb)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s uuid := u.space_id;
  n uuid;
  xu public.app_user;
  frac numeric;
  tot numeric;
  mine_sum numeric;
begin
  select * into xu from public.app_user where id = x;

  -- 자산 정리 안 비율(자산 항목만). 자산 항목이 없으면 분담 비율
  select coalesce(sum((e->>'amount')::numeric), 0),
         coalesce(sum((e->>'mine')::numeric), 0)
    into tot, mine_sum
    from jsonb_array_elements(plan) e where coalesce(e->>'side', 'asset') = 'asset';
  if tot > 0 then
    frac := case when is_req then mine_sum / tot else (tot - mine_sum) / tot end;
  else
    frac := case when is_req then u.ratio / 100.0 else (100 - u.ratio) / 100.0 end;
  end if;

  -- 새 공간(혼자 쓰기). 분담·배우자 값은 비움
  insert into public.couple_space (
    couple_state, created_by, unlinked_from, marriage_status, housing, child_plan, newlywed_home,
    newlywed_home_month, prep_money_mode, wedding_date, wedding_date_estimated, wedding_month,
    wedding_budget, wedding_budget_estimated, wedding_saved, fixed_total, fixed_total_estimated,
    living_budget, living_budget_estimated, loan_repayment, family_support, family_support_answer,
    family_support_estimated, account_mode, base_day, base_day_last, holiday_shift)
  select 'solo', x, s, c.marriage_status, c.housing, c.child_plan, c.newlywed_home,
    c.newlywed_home_month, c.prep_money_mode, c.wedding_date, c.wedding_date_estimated, c.wedding_month,
    c.wedding_budget, c.wedding_budget_estimated, c.wedding_saved, c.fixed_total, c.fixed_total_estimated,
    c.living_budget, c.living_budget_estimated, c.loan_repayment, c.family_support, c.family_support_answer,
    c.family_support_estimated, c.account_mode, c.base_day, c.base_day_last, c.holiday_shift
  from public.couple_space c where c.id = s
  returning id into n;

  -- id 짝 미리 만들기(사본)
  insert into public.unlink_copy (unlink_id, user_id, tbl, old_id, new_id)
  select u.id, x, t.tbl, t.id, gen_random_uuid() from (
    select 'goal' tbl, id from public.goal where space_id = s and deleted_at is null
    union all select 'fixed_expense', id from public.fixed_expense where space_id = s and deleted_at is null
    union all select 'spend_category', id from public.spend_category where space_id = s and deleted_at is null
    union all select 'asset', id from public.asset where space_id = s and deleted_at is null and owner = 'joint'
    union all select 'account', id from public.account
      where space_id = s and deleted_at is null and role <> 'personal'
    union all select 'monthly_plan', id from public.monthly_plan where space_id = s and deleted_at is null
    union all select 'plan_line', id from public.plan_line where space_id = s and deleted_at is null
    union all select 'month_close', id from public.month_close where space_id = s and deleted_at is null
    union all select 'month_spend', id from public.month_spend where space_id = s and deleted_at is null
    union all select 'big_expense', id from public.big_expense where space_id = s and deleted_at is null
    union all select 'saving_deposit', id from public.saving_deposit where space_id = s and deleted_at is null
    union all select 'proposal', id from public.proposal where space_id = s and status <> 'open'
    union all select 'todo', id from public.todo
      where space_id = s and deleted_at is null and (for_user is null or for_user = x)
    union all select 'family_member', id from public.family_member
      where space_id = s and deleted_at is null and side = xu.side
    union all select 'care_day', id from public.care_day
      where space_id = s and deleted_at is null and (
        (secret and created_by = x)
        or (not secret and category = 'family' and side = xu.side))
  ) t;
  -- 옮기는 행은 같은 id로 짝(다시 연결 때 되돌릴 목록)
  insert into public.unlink_copy (unlink_id, user_id, tbl, old_id, new_id)
  select u.id, x, t.tbl, t.id, t.id from (
    select 'asset_moved' tbl, id from public.asset
      where space_id = s and owner = 'person' and owner_user_id = x
    union all select 'account_moved', id from public.account
      where space_id = s and role = 'personal' and owner_user_id = x
    union all select 'income_item_moved', id from public.income_item where space_id = s and owner_user_id = x
    union all select 'income_event_moved', id from public.income_event where space_id = s and owner_user_id = x
  ) t;
  -- 챙길 날 사본의 드린 기록
  insert into public.unlink_copy (unlink_id, user_id, tbl, old_id, new_id)
  select u.id, x, 'care_record', r.id, gen_random_uuid() from public.care_record r
  where r.space_id = s and r.deleted_at is null
    and r.care_day_id in (select old_id from public.unlink_copy where unlink_id = u.id and user_id = x and tbl = 'care_day');

  -- 옮기기
  update public.asset set space_id = n where space_id = s and owner = 'person' and owner_user_id = x;
  update public.asset_history h set space_id = n
    where h.asset_id in (select old_id from public.unlink_copy where unlink_id = u.id and user_id = x and tbl = 'asset_moved');
  update public.account set space_id = n where space_id = s and role = 'personal' and owner_user_id = x;
  update public.income_item set space_id = n where space_id = s and owner_user_id = x;
  update public.income_event set space_id = n where space_id = s and owner_user_id = x;
  update public.notification set space_id = n where space_id = s and user_id = x;

  -- 목표(보유액 = 기록으로 모은 돈을 비율대로 나눠 따로 모은 돈에)
  insert into public.goal (id, space_id, template, name, kind, target_amount, amount_estimated, deadline,
    deadline_estimated, priority, owner, status, details, other_held, after_marriage, created_by, created_at)
  select m.new_id, n, g.template, g.name, g.kind, g.target_amount, g.amount_estimated, g.deadline,
    g.deadline_estimated, g.priority, g.owner, g.status, g.details,
    greatest(round((g.other_held
      + coalesce((select sum(d.amount) from public.saving_deposit d join public.month_close c on c.id = d.month_close_id
          where d.goal_id = g.id and d.deleted_at is null and c.status = 'done'), 0)
      - coalesce((select sum(w.amount) from public.goal_use w where w.goal_id = g.id and w.deleted_at is null), 0)
      ) * frac), 0)::bigint,
    g.after_marriage, g.created_by, g.created_at
  from public.goal g join public.unlink_copy m on m.old_id = g.id and m.unlink_id = u.id and m.user_id = x;

  -- 공동 명의 자산·부채 → 내 몫으로 내 명의 사본
  insert into public.asset (id, space_id, side, grp, kind, name, amount, principal, interest_rate, rate_estimated,
    maturity_date, monthly_payment, paid_count, pay_from, estimated, owner, owner_user_id, visibility, goal_id,
    status, created_by, created_at)
  select m.new_id, n, a.side, a.grp, a.kind, a.name, sh.v,
    case when a.principal is null or a.amount = 0 then a.principal else round(a.principal * sh.v::numeric / a.amount)::bigint end,
    a.interest_rate, a.rate_estimated, a.maturity_date,
    case when a.monthly_payment is null or a.amount = 0 then a.monthly_payment
      else round(a.monthly_payment * sh.v::numeric / a.amount)::bigint end,
    a.paid_count, a.pay_from, a.estimated, 'person', x, a.visibility,
    (select g.new_id from public.unlink_copy g where g.unlink_id = u.id and g.user_id = x and g.old_id = a.goal_id),
    a.status, a.created_by, a.created_at
  from public.asset a
  join public.unlink_copy m on m.old_id = a.id and m.unlink_id = u.id and m.user_id = x and m.tbl = 'asset'
  cross join lateral (
    select coalesce((
      select case when is_req then (e->>'mine')::bigint else (e->>'amount')::bigint - (e->>'mine')::bigint end
      from jsonb_array_elements(plan) e where e->>'asset_id' = a.id::text limit 1),
      -- 정리 안에 없는 공동 항목(금액 0 등): 분담 비율
      public.unlink_share(a.amount, case when is_req then u.ratio else 100 - u.ratio end)) as v
  ) sh;
  -- 옮긴 내 명의 자산이 원래 공간 목표에 이어져 있으면 사본 목표로
  update public.asset a set goal_id = g.new_id
    from public.unlink_copy g
    where a.space_id = n and g.unlink_id = u.id and g.user_id = x and g.tbl = 'goal' and g.old_id = a.goal_id;

  -- 공동 역할 통장 사본(자산은 사본 자산으로)
  insert into public.account (id, space_id, role, name, start_balance, is_existing, sort, owner_user_id, asset_id,
    created_by, created_at)
  select m.new_id, n, c.role, c.name, c.start_balance, c.is_existing, c.sort, c.owner_user_id,
    (select z.new_id from public.unlink_copy z where z.unlink_id = u.id and z.user_id = x and z.old_id = c.asset_id),
    c.created_by, c.created_at
  from public.account c join public.unlink_copy m on m.old_id = c.id and m.unlink_id = u.id and m.user_id = x;

  insert into public.fixed_expense (id, space_id, group_key, name, monthly_amount, burden, sort, created_by, created_at)
  select m.new_id, n, f.group_key, f.name, f.monthly_amount, f.burden, f.sort, f.created_by, f.created_at
  from public.fixed_expense f join public.unlink_copy m on m.old_id = f.id and m.unlink_id = u.id and m.user_id = x;

  insert into public.spend_category (id, space_id, default_key, name, enabled, sort, created_by, created_at)
  select m.new_id, n, c.default_key, c.name, c.enabled, c.sort, c.created_by, c.created_at
  from public.spend_category c join public.unlink_copy m on m.old_id = c.id and m.unlink_id = u.id and m.user_id = x;

  insert into public.monthly_plan (id, space_id, label_month, cycle_start, cycle_end, status, is_partial,
    first_adjust, merged_close, is_temp, snapshot, created_by, created_at)
  select m.new_id, n, p.label_month, p.cycle_start, p.cycle_end, p.status, p.is_partial,
    p.first_adjust, p.merged_close, p.is_temp, p.snapshot, p.created_by, p.created_at
  from public.monthly_plan p join public.unlink_copy m on m.old_id = p.id and m.unlink_id = u.id and m.user_id = x;

  insert into public.plan_line (id, space_id, plan_id, kind, target, account_role, goal_id, amount, amount_groom,
    amount_bride, state, sort, done_amount, groom_done_amount, groom_done_at, groom_done_by, bride_done_amount,
    bride_done_at, bride_done_by, created_by, created_at)
  select m.new_id, n, pm.new_id, l.kind, l.target, l.account_role,
    (select g.new_id from public.unlink_copy g where g.unlink_id = u.id and g.user_id = x and g.old_id = l.goal_id),
    l.amount, l.amount_groom, l.amount_bride, l.state, l.sort, l.done_amount, l.groom_done_amount, l.groom_done_at,
    l.groom_done_by, l.bride_done_amount, l.bride_done_at, l.bride_done_by, l.created_by, l.created_at
  from public.plan_line l
  join public.unlink_copy m on m.old_id = l.id and m.unlink_id = u.id and m.user_id = x
  join public.unlink_copy pm on pm.old_id = l.plan_id and pm.unlink_id = u.id and pm.user_id = x;

  insert into public.month_close (id, space_id, plan_id, status, income, big_none, started_at, started_by,
    closed_at, closed_by, created_by, created_at)
  select m.new_id, n, pm.new_id, c.status, c.income, c.big_none, c.started_at, c.started_by,
    c.closed_at, c.closed_by, c.created_by, c.created_at
  from public.month_close c
  join public.unlink_copy m on m.old_id = c.id and m.unlink_id = u.id and m.user_id = x
  join public.unlink_copy pm on pm.old_id = c.plan_id and pm.unlink_id = u.id and pm.user_id = x;

  insert into public.month_spend (id, space_id, month_close_id, category_id, amount, created_by, created_at)
  select m.new_id, n, cm.new_id, km.new_id, s2.amount, s2.created_by, s2.created_at
  from public.month_spend s2
  join public.unlink_copy m on m.old_id = s2.id and m.unlink_id = u.id and m.user_id = x
  join public.unlink_copy cm on cm.old_id = s2.month_close_id and cm.unlink_id = u.id and cm.user_id = x
  join public.unlink_copy km on km.old_id = s2.category_id and km.unlink_id = u.id and km.user_id = x;

  insert into public.big_expense (id, space_id, month_close_id, kind, name, amount, how, goal_id, created_by, created_at)
  select m.new_id, n, cm.new_id, b.kind, b.name, b.amount, b.how,
    (select g.new_id from public.unlink_copy g where g.unlink_id = u.id and g.user_id = x and g.old_id = b.goal_id),
    b.created_by, b.created_at
  from public.big_expense b
  join public.unlink_copy m on m.old_id = b.id and m.unlink_id = u.id and m.user_id = x
  join public.unlink_copy cm on cm.old_id = b.month_close_id and cm.unlink_id = u.id and cm.user_id = x;

  -- 저축 기록: 월말 정리 기록으로만(목표 보유액은 위에서 나눔)
  insert into public.saving_deposit (id, space_id, month_close_id, name, amount, asset_id, goal_id, created_by, created_at)
  select m.new_id, n, cm.new_id, d.name, d.amount,
    (select z.new_id from public.unlink_copy z where z.unlink_id = u.id and z.user_id = x and z.old_id = d.asset_id),
    null, d.created_by, d.created_at
  from public.saving_deposit d
  join public.unlink_copy m on m.old_id = d.id and m.unlink_id = u.id and m.user_id = x
  join public.unlink_copy cm on cm.old_id = d.month_close_id and cm.unlink_id = u.id and cm.user_id = x;

  insert into public.proposal (id, space_id, proposer, item, target_id, before, after, apply_on, status, response,
    responded_at, applied_at, oppose_count, round_trips, together, replaces, seen_at, created_at)
  select m.new_id, n, p.proposer, p.item,
    coalesce((select z.new_id from public.unlink_copy z where z.unlink_id = u.id and z.user_id = x and z.old_id = p.target_id), p.target_id),
    p.before, p.after, p.apply_on, p.status, p.response, p.responded_at, p.applied_at, p.oppose_count,
    p.round_trips, p.together, null, p.seen_at, p.created_at
  from public.proposal p join public.unlink_copy m on m.old_id = p.id and m.unlink_id = u.id and m.user_id = x;

  insert into public.todo (id, space_id, kind, for_user, target_id, screen, status, open_on, snoozed_until, sort,
    done_at, done_by, created_by, created_at)
  select m.new_id, n, t.kind, t.for_user,
    coalesce((select z.new_id from public.unlink_copy z where z.unlink_id = u.id and z.user_id = x and z.old_id = t.target_id), t.target_id),
    t.screen, t.status, t.open_on, t.snoozed_until, t.sort, t.done_at, t.done_by, t.created_by, t.created_at
  from public.todo t join public.unlink_copy m on m.old_id = t.id and m.unlink_id = u.id and m.user_id = x;

  insert into public.family_member (id, space_id, side, relation, title, birth_year, birth_month, birth_day,
    birth_lunar, birth_leap, korean_age, memo, sort, created_by, created_at)
  select m.new_id, n, f.side, f.relation, f.title, f.birth_year, f.birth_month, f.birth_day,
    f.birth_lunar, f.birth_leap, f.korean_age, f.memo, f.sort, f.created_by, f.created_at
  from public.family_member f join public.unlink_copy m on m.old_id = f.id and m.unlink_id = u.id and m.user_id = x;

  insert into public.care_day (id, space_id, category, kind, name, member_id, side, carer, date_rule, month, day,
    leap, once_on, budget, alerts, memo, status, status_on, secret, created_by, created_at)
  select m.new_id, n, c.category, c.kind, c.name,
    (select z.new_id from public.unlink_copy z where z.unlink_id = u.id and z.user_id = x and z.old_id = c.member_id),
    c.side, c.carer, c.date_rule, c.month, c.day, c.leap, c.once_on, c.budget, c.alerts, c.memo, c.status,
    c.status_on, c.secret, c.created_by, c.created_at
  from public.care_day c join public.unlink_copy m on m.old_id = c.id and m.unlink_id = u.id and m.user_id = x;

  insert into public.care_record (id, space_id, care_day_id, member_id, occurs_on, amount, paid_from, gifts,
    gift_name, memo, created_by, created_at)
  select m.new_id, n, dm.new_id,
    (select z.new_id from public.unlink_copy z where z.unlink_id = u.id and z.user_id = x and z.old_id = r.member_id),
    r.occurs_on, r.amount, r.paid_from, r.gifts, r.gift_name, r.memo, r.created_by, r.created_at
  from public.care_record r
  join public.unlink_copy m on m.old_id = r.id and m.unlink_id = u.id and m.user_id = x
  join public.unlink_copy dm on dm.old_id = r.care_day_id and dm.unlink_id = u.id and dm.user_id = x;

  update public.app_user set space_id = n where id = x;
  return n;
end;
$$;
revoke execute on function public.unlink_make_space(public.couple_unlink, uuid, boolean, jsonb) from public, anon, authenticated;

-- ── 확정(내부): 두 사람 새 공간, 원래 공간 보관, 알림 ────────────────────────────
create or replace function public.confirm_unlink(p_id uuid, p_plan jsonb, p_how text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  u public.couple_unlink;
  nr uuid;
  nq uuid;
  r public.app_user;
  q public.app_user;
begin
  select * into u from public.couple_unlink where id = p_id and status = 'pending' for update;
  if u.id is null then
    raise exception 'no_request' using errcode = 'P0001';
  end if;
  select * into r from public.app_user where id = u.requested_by;
  select * into q from public.app_user where id = u.partner_id;
  update public.couple_unlink set status = 'confirmed', confirmed_at = now(), final_plan = p_plan, how = p_how,
    reconnect_until = now() + interval '30 days'
    where id = u.id;
  nr := public.unlink_make_space(u, r.id, true, p_plan);
  if q.id is not null and q.space_id = u.space_id then
    nq := public.unlink_make_space(u, q.id, false, p_plan);
  end if;
  -- 원래 공간: 해제 전 공동 데이터 보관(30일), 구성원 없음
  update public.couple_space set couple_state = 'solo', deleted_at = now() where id = u.space_id;

  perform public.notify(r.id, nr, 'unlink_confirmed', '연결이 해제됐어요', '30일 안에 다시 연결할 수 있어요',
    '/settings/couple/unlinked', null, null, 'unlink:' || u.id || ':confirmed:' || r.id);
  if nq is not null then
    perform public.notify(q.id, nq, 'unlink_confirmed', '연결이 해제됐어요', '30일 안에 다시 연결할 수 있어요',
      '/settings/couple/unlinked', null, null, 'unlink:' || u.id || ':confirmed:' || q.id);
  end if;
end;
$$;
revoke execute on function public.confirm_unlink(uuid, jsonb, text) from public, anon, authenticated;

-- S-12d ‘동의해요’(받은 사람) → 요청한 자산 정리 안대로 바로 확정
create or replace function public.agree_unlink()
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
  select * into me from public.app_user where id = uid and status = 'active';
  select * into u from public.couple_unlink where space_id = me.space_id and status = 'pending';
  if u.id is null then
    raise exception 'no_request' using errcode = 'P0001';
  end if;
  if u.requested_by = uid then
    raise exception 'not_partner' using errcode = '42501';
  end if;
  perform public.confirm_unlink(u.id, u.plan, 'agreed');
end;
$$;
revoke execute on function public.agree_unlink() from public, anon;
grant execute on function public.agree_unlink() to authenticated;

-- 지금 공간이 해제로 만든 공간이면, 그 해제(S-12 혼자 쓰기: 몫 안내, 다시 연결 기한)
create or replace function public.my_unlink()
returns setof public.couple_unlink
language sql
stable
security definer
set search_path = ''
as $$
  select u.* from public.couple_unlink u
  join public.couple_space s on s.unlinked_from = u.space_id
  join public.app_user me on me.space_id = s.id and me.id = auth.uid()
  where u.status = 'confirmed' and (u.requested_by = me.id or u.partner_id = me.id)
  order by u.confirmed_at desc limit 1;
$$;
revoke execute on function public.my_unlink() from public, anon;
grant execute on function public.my_unlink() to authenticated;
