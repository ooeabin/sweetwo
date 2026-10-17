-- 서프라이즈 일정(24 ‘서프라이즈 일정’): 만든 사람만 보는 ‘우리 둘’ 챙길 날. 서버가 배우자에게 아예 보내지 않음(RLS).
-- 그 날의 기록(care_record)도 만든 사람만. 낸 곳은 각자 돈으로 고정(목표 사용·나누기 줄 없음).
-- 숨기기를 끄면 일반 ‘우리 둘’ 일정이 되고 그동안 기록도 함께 보임. 숨기기를 켜고 끄는 건 만든 사람만.

alter table public.care_day add column secret boolean not null default false;
alter table public.care_day add constraint care_day_secret_couple check (not secret or category = 'couple');

drop policy care_day_select on public.care_day;
create policy care_day_select on public.care_day for select to authenticated
  using (public.is_space_member(space_id) and (not secret or created_by = auth.uid()));
drop policy care_day_insert on public.care_day;
create policy care_day_insert on public.care_day for insert to authenticated
  with check (public.is_space_member(space_id) and (not secret or created_by = auth.uid()));
drop policy care_day_update on public.care_day;
create policy care_day_update on public.care_day for update to authenticated
  using (public.is_space_member(space_id) and (not secret or created_by = auth.uid()))
  with check (public.is_space_member(space_id) and (not secret or created_by = auth.uid()));

drop policy care_record_select on public.care_record;
create policy care_record_select on public.care_record for select to authenticated
  using (public.is_space_member(space_id) and exists (
    select 1 from public.care_day d
    where d.id = care_day_id and (not d.secret or d.created_by = auth.uid())));

-- record_care: 비밀 날은 만든 사람만 기록, 낸 곳은 각자 돈
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
  sp public.couple_space;
  gid uuid;
  rid uuid;
  uid_line uuid;
  plan public.monthly_plan;
  today date := (now() at time zone 'Asia/Seoul')::date;
  mv bigint := 0;
begin
  select * into me from public.app_user where id = uid and status = 'active';
  select * into c from public.care_day where id = p_care and deleted_at is null;
  if c.id is null or me.space_id is distinct from c.space_id or (c.secret and c.created_by is distinct from uid) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if p_amount < 0 or p_amount > 99999999999 then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  if c.secret then
    p_paid_from := 'personal';
  end if;
  select * into sp from public.couple_space where id = c.space_id;

  insert into public.care_record (space_id, care_day_id, member_id, occurs_on, amount, paid_from, gifts, gift_name, memo)
  values (c.space_id, c.id, c.member_id, p_on, p_amount, p_paid_from, coalesce(p_gifts, '{}'),
          nullif(btrim(p_gift_name), ''), nullif(btrim(p_memo), ''))
  returning id into rid;
  update public.care_day set status = 'done', status_on = p_on where id = c.id;

  if p_paid_from in ('goal_fund', 'living') and c.category = 'family' then
    select id into gid from public.goal
      where space_id = c.space_id and template = 'family_cost' and deleted_at is null
      order by created_at limit 1;
  elsif p_paid_from = 'wedding_account' then
    select id into gid from public.goal
      where space_id = c.space_id and template = 'wedding' and deleted_at is null
      order by created_at limit 1;
  end if;
  if gid is null or p_amount = 0 then
    return jsonb_build_object('record', rid, 'line', 0);
  end if;

  if p_paid_from = 'living' and sp.account_mode = 'roles' then
    mv := greatest(least(coalesce(p_move, 0), p_amount), 0);
    select * into plan from public.monthly_plan
      where space_id = c.space_id and deleted_at is null and cycle_start <= today and cycle_end >= today;
    if plan.id is not null and plan.status = 'closed' then
      select * into plan from public.monthly_plan
        where space_id = c.space_id and deleted_at is null and cycle_start > plan.cycle_end
        order by cycle_start limit 1;
    end if;
    if plan.id is not null and plan.status <> 'closed' and mv > 0 then
      insert into public.plan_line (plan_id, space_id, target, account_role, goal_id, kind, amount,
                                    amount_groom, amount_bride, sort)
      values (plan.id, c.space_id, 'account', 'living', gid, 'goal_to_living', mv,
              case when me.side = 'bride' then 0 else mv end,
              case when me.side = 'bride' then mv else 0 end,
              coalesce((select max(sort) + 1 from public.plan_line where plan_id = plan.id), 0))
      returning id into uid_line;
    else
      mv := 0;
    end if;
  end if;

  insert into public.goal_use (space_id, goal_id, amount, used_on, paid_from, source, care_record_id, plan_line_id)
  values (c.space_id, gid, p_amount, p_on, p_paid_from, 'care', rid, uid_line);
  return jsonb_build_object('record', rid, 'line', mv);
end;
$$;
