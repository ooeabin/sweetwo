-- 휴지통 재기획(25 S-21): 제안 없이 바로 되살리기, 배우자의 내 목표는 휴지통에 안 보임.

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
  select 'family', f.id, f.title, null, f.deleted_at, f.deleted_by
    from public.family_member f, me
    where f.space_id = me.space_id and f.deleted_at is not null and f.deleted_at > now() - interval '30 days'
  union all
  select 'care_day', c.id, c.name, null, c.deleted_at, c.deleted_by
    from public.care_day c, me
    where c.space_id = me.space_id and c.deleted_at is not null and c.deleted_at > now() - interval '30 days'
      and (not c.secret or c.created_by = me.id)
      -- 같이 지워진 챙길 날은 가족 줄로만
      and not exists (select 1 from public.family_member f
        where f.id = c.member_id and f.deleted_at is not null
          and abs(extract(epoch from f.deleted_at - c.deleted_at)) <= 10)
  order by 5 desc;
$$;
revoke execute on function public.trash_rows() from public, anon;
grant execute on function public.trash_rows() to authenticated;

-- 되살리기(제안 없이 바로). 목표는 맨 아래 우선순위, 분배표 저금 줄은 goal_lines 트리거가 0원으로 다시 만듦. 돌려주는 값: 'restored'
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
    select deleted_at into t from public.goal where id = p_id;
    update public.goal g set deleted_at = null,
      priority = (select coalesce(max(x.priority), 0) + 1 from public.goal x where x.space_id = g.space_id and x.deleted_at is null)
      where g.id = p_id;
    update public.goal_use set deleted_at = null
      where goal_id = p_id and deleted_at is not null and abs(extract(epoch from deleted_at - t)) <= 10;
  elsif p_kind = 'family' then
    select deleted_at into t from public.family_member where id = p_id;
    update public.family_member set deleted_at = null where id = p_id;
    update public.care_record r set deleted_at = null
      from public.care_day c
      where r.care_day_id = c.id and c.member_id = p_id and r.deleted_at is not null
        and abs(extract(epoch from r.deleted_at - t)) <= 10;
    update public.care_day set deleted_at = null
      where member_id = p_id and deleted_at is not null and abs(extract(epoch from deleted_at - t)) <= 10;
  elsif p_kind = 'care_day' then
    select deleted_at into t from public.care_day where id = p_id;
    update public.care_day set deleted_at = null where id = p_id;
    update public.care_record set deleted_at = null
      where care_day_id = p_id and deleted_at is not null and abs(extract(epoch from deleted_at - t)) <= 10;
  end if;
  return 'restored';
end;
$$;
revoke execute on function public.restore_trash(text, uuid) from public, anon;
grant execute on function public.restore_trash(text, uuid) to authenticated;
