-- 이번 달만 바꾸기(20 W-01a, 06 1장 ‘즉시 적용, 되돌리기 가능’): 이번 플랜 통장 줄 하나의 금액을 바꾸고 차이는 빠지는 곳 줄이 받음.
-- 합계는 그대로. 아직 아무도 옮기지 않은 줄만(이미 옮긴 줄은 바꾸지 않음). 몫은 지금 몫 비율대로, 기준값(snapshot.parts)도 맞춤.
-- 되돌리기 = 바꾸기 전 금액으로 같은 함수를 다시 부름.

create or replace function public.adjust_plan(
  p_plan uuid,
  p_role public.account_role,
  p_amount bigint,
  p_counter public.account_role
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  p public.monthly_plan;
  a public.plan_line;
  b public.plan_line;
  diff bigint;
  key_a text;
  key_b text;
begin
  select * into p from public.monthly_plan where id = p_plan and deleted_at is null;
  if p.id is null or not public.is_space_member(p.space_id) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if p_role = p_counter or p_amount < 0 or p_amount > 99999999999 then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  select * into a from public.plan_line
    where plan_id = p_plan and target = 'account' and account_role = p_role and deleted_at is null for update;
  select * into b from public.plan_line
    where plan_id = p_plan and target = 'account' and account_role = p_counter and deleted_at is null for update;
  if a.id is null or b.id is null then
    raise exception 'no_line' using errcode = '22023';
  end if;
  if a.groom_done_at is not null or a.bride_done_at is not null
     or b.groom_done_at is not null or b.bride_done_at is not null then
    raise exception 'already_split' using errcode = '22023';
  end if;
  diff := p_amount - a.amount;
  if b.amount - diff < 0 then
    raise exception 'not_enough' using errcode = '22023';
  end if;
  update public.plan_line set
    amount = p_amount,
    amount_groom = case when a.amount > 0 then round(p_amount * coalesce(a.amount_groom, 0)::numeric / a.amount)::bigint
                        else round(p_amount / 2.0)::bigint end,
    amount_bride = p_amount - case when a.amount > 0 then round(p_amount * coalesce(a.amount_groom, 0)::numeric / a.amount)::bigint
                                   else round(p_amount / 2.0)::bigint end
  where id = a.id;
  update public.plan_line set
    amount = b.amount - diff,
    amount_groom = case when b.amount > 0 then round((b.amount - diff) * coalesce(b.amount_groom, 0)::numeric / b.amount)::bigint
                        else round((b.amount - diff) / 2.0)::bigint end,
    amount_bride = (b.amount - diff) - case when b.amount > 0 then round((b.amount - diff) * coalesce(b.amount_groom, 0)::numeric / b.amount)::bigint
                                            else round((b.amount - diff) / 2.0)::bigint end
  where id = b.id;
  key_a := case p_role when 'living' then 'living' when 'goal_fund' then 'goalFund' when 'emergency' then 'emergency' end;
  key_b := case p_counter when 'living' then 'living' when 'goal_fund' then 'goalFund' when 'emergency' then 'emergency' end;
  if key_a is not null and key_b is not null and p.snapshot ? 'parts' then
    update public.monthly_plan set snapshot = jsonb_set(
      jsonb_set(snapshot, array['parts', key_a], to_jsonb(p_amount)),
      array['parts', key_b], to_jsonb(b.amount - diff))
    where id = p_plan;
  end if;
end;
$$;
revoke execute on function public.adjust_plan(uuid, public.account_role, bigint, public.account_role) from public, anon;
grant execute on function public.adjust_plan(uuid, public.account_role, bigint, public.account_role) to authenticated;
