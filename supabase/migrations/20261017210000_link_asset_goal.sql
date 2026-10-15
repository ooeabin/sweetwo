-- 자산과 목표 잇기(docs/spec/23-assets.md F-03f~i, 22 G-03d ‘가진 자산에서 고르기’, 06 5-4 보유액 = 연결 자산 + …)
-- 자산: 청약 납입 회차, 월 납입액이 빠지는 통장. 목표 보유액용 연결 자산 합계(공개 범위: 배우자 비공개 제외, 합계만은 포함).

alter table public.asset add column paid_count smallint check (paid_count between 0 and 9999); -- 청약 납입 회차
alter table public.asset add column pay_from text check (pay_from in ('goal_fund', 'personal')); -- F-03f2 월 납입액이 빠지는 통장

-- 목표별 연결 자산 합계(원금 기준, 원금 없으면 평가금액). 행을 못 보는 배우자 ‘합계만’ 항목도 합계에는 들어감, 비공개는 뺌(두 사람이 같은 값)
create or replace function public.goal_asset_sums()
returns table (goal_id uuid, n integer, total bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select a.goal_id, count(*)::int, sum(coalesce(a.principal, a.amount))::bigint
  from public.app_user me
  join public.asset a on a.space_id = me.space_id
  where me.id = auth.uid() and me.status = 'active'
    and a.deleted_at is null and a.status = 'held' and a.side = 'asset' and a.goal_id is not null
    and a.visibility <> 'private' -- 비공개는 누구에게도 합계·진단에 안 들어감(23 F-02 10번)
  group by a.goal_id;
$$;
revoke execute on function public.goal_asset_sums() from public, anon;
grant execute on function public.goal_asset_sums() to authenticated;

-- 목표 추가 제안이 적용되면 고른 자산(after.asset_ids)을 새 목표에 연결
create or replace function public.apply_proposal_values(p public.proposal)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  gid uuid;
begin
  if p.item = 'allowance' then
    update public.app_user set allowance = (p.after->>'allowance')::bigint where id = p.proposer;
  elsif p.item = 'split' then
    update public.couple_space set
      split_mode = (p.after->>'mode')::public.split_mode,
      split_ratio = (p.after->>'starter_ratio')::smallint,
      split_deferred = false
    where id = p.space_id;
  elsif p.item = 'goal_amount' then
    update public.goal set target_amount = (p.after->>'target_amount')::bigint, amount_estimated = false
    where id = p.target_id and deleted_at is null;
  elsif p.item = 'goal_deadline' then
    update public.goal set deadline = (p.after->>'deadline')::date, deadline_estimated = false
    where id = p.target_id and deleted_at is null;
  elsif p.item = 'goal_pause' then
    if (p.after->>'paused')::boolean then
      update public.goal set status = 'paused' where id = p.target_id and deleted_at is null;
    else
      -- 다시 모으면 우선순위 맨 아래(22 달성·보류 상태 2번)
      update public.goal g set status = 'active',
        priority = (select coalesce(max(x.priority), 0) + 1 from public.goal x where x.space_id = g.space_id and x.deleted_at is null)
      where g.id = p.target_id and g.deleted_at is null;
    end if;
  elsif p.item = 'goal_add' then
    -- 맨 아래 우선순위. 만든 사람 = 제안한 사람(담당 ‘나’, ‘배우자’는 그 사람 기준)
    insert into public.goal (space_id, template, name, kind, priority, target_amount, deadline, other_held,
      owner, details, amount_estimated, deadline_estimated, created_by)
    values (
      p.space_id, p.after->>'template', btrim(p.after->>'name'), (p.after->>'kind')::public.goal_kind,
      (select coalesce(max(x.priority), 0) + 1 from public.goal x where x.space_id = p.space_id and x.deleted_at is null),
      nullif(p.after->>'target_amount', '')::bigint, nullif(p.after->>'deadline', '')::date,
      coalesce((p.after->>'other_held')::bigint, 0), (p.after->>'owner')::public.goal_owner,
      coalesce(p.after->'details', '{}'::jsonb),
      coalesce((p.after->>'amount_estimated')::boolean, false), coalesce((p.after->>'deadline_estimated')::boolean, false),
      p.proposer
    ) returning id into gid;
    -- 가진 자산에서 고른 것 연결(이 공간, 제안한 사람이 고칠 수 있는 자산만)
    update public.asset a set goal_id = gid
    where a.space_id = p.space_id and a.deleted_at is null and a.side = 'asset'
      and (a.owner = 'joint' or a.owner_user_id = p.proposer or (a.owner_user_id is null and a.created_by = p.proposer))
      and a.id::text in (select jsonb_array_elements_text(coalesce(p.after->'asset_ids', '[]'::jsonb)));
  elsif p.item = 'goal_order' then
    -- 받은 순서대로 우선순위 1, 2, 3 …(비상금은 0 그대로)
    update public.goal g set priority = o.n
    from jsonb_array_elements_text(p.after->'order') with ordinality as o(id, n)
    where g.id = o.id::uuid and g.space_id = p.space_id and g.deleted_at is null and g.template <> 'emergency';
  elsif p.item = 'living_budget' then
    update public.couple_space set living_budget = (p.after->>'living_budget')::bigint, living_budget_estimated = false
    where id = p.space_id;
  elsif p.item = 'goal_delete' then
    update public.goal set deleted_at = now() where id = p.target_id and deleted_at is null;
    -- 지운 목표의 다른 열린 제안은 거둠
    update public.proposal set status = 'withdrawn'
    where target_id = p.target_id and status = 'open' and id <> p.id;
  end if;
end;
$$;
revoke execute on function public.apply_proposal_values(public.proposal) from public, anon, authenticated;

