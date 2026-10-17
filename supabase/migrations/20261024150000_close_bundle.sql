-- 월말 정리 제안 묶음(21 W-04h·W-04 끝·W-04p, 08 6장). 혼자 정리하며 바꾼 값은 끝에서 배우자에게 ‘월말 정리 제안’ 1건으로 감.
--
-- proposal.month_close_id: 그 정리에서 보낸 제안(묶음). 묶음 제안은 하나씩 알리지 않고, 정리를 끝낼 때
--   send_close_bundle이 배우자에게 한 번만 알림(“찬우님이 10월 월급 플랜을 정리했어요”, → W-04p).
-- propose_in_close: propose와 같고 묶음에 넣음(그 트랜잭션에서만 하나씩 알림을 끔).

alter table public.proposal add column month_close_id uuid references public.month_close (id) on delete set null;
create index proposal_close_idx on public.proposal (month_close_id) where month_close_id is not null;

-- 제안 알림: 묶음으로 보내는 중이면 하나씩 알리지 않음(나머지는 20261022120000과 같음)
create or replace function public.notify_proposal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  other public.app_user;
  who text;
  noun text := public.proposal_item_noun(new);
begin
  if tg_op = 'INSERT' and new.status = 'open' then
    if coalesce(current_setting('sweetwo.close_bundle', true), '') <> '' then
      return new;
    end if;
    select * into other from public.app_user
      where space_id = new.space_id and status = 'active' and id <> new.proposer limit 1;
    if other.id is null then return new; end if;
    select coalesce(nickname, '') into who from public.app_user where id = new.proposer;
    perform public.notify(
      other.id, new.space_id, 'proposal_arrived',
      case when new.item = 'goal_add'
        then who || '님이 ' || public.ko_obj(noun) || ' 추가하자고 제안했어요'
        when new.item = 'goal_restore'
        then who || '님이 ' || public.ko_obj(noun) || ' 되살리자고 제안했어요'
        else who || '님이 ' || public.ko_obj(noun) || ' 바꾸자고 제안했어요' end,
      '좋아요면 바로, 반대 없으면 ' || public.md_label(new.apply_on) || '부터 적용돼요',
      '/proposals/' || new.id, null, new.proposer, 'proposal:' || new.id || ':arrived');
  elsif tg_op = 'UPDATE' and old.response is null and new.response in ('like', 'oppose') then
    select * into other from public.app_user
      where space_id = new.space_id and status = 'active' and id <> new.proposer limit 1;
    who := coalesce(other.nickname, '');
    perform public.notify(
      new.proposer, new.space_id, 'proposal_answered',
      case when new.response = 'like'
        then who || '님이 ' || noun || ' 제안에 좋아요를 눌렀어요'
        else who || '님이 ' || noun || ' 제안에 반대했어요' end,
      case when new.response = 'like' then '바로 적용했어요' else '월말 정리에서 함께 정해요' end,
      '/proposals/' || new.id, null, other.id, 'proposal:' || new.id || ':answered');
  end if;
  return new;
end;
$$;

-- 묶음에 제안 넣기. 돌려주는 값 = 제안 id
create or replace function public.propose_in_close(
  p_close uuid, p_item text, p_after jsonb, p_apply_on date, p_target uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c public.month_close;
  pid uuid;
begin
  select * into c from public.month_close where id = p_close and deleted_at is null;
  if c.id is null or not public.is_space_member(c.space_id) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  perform set_config('sweetwo.close_bundle', c.id::text, true);
  pid := public.propose(p_item, p_after, p_apply_on, p_target);
  perform set_config('sweetwo.close_bundle', '', true);
  update public.proposal set month_close_id = c.id where id = pid;
  return pid;
end;
$$;
revoke execute on function public.propose_in_close(uuid, text, jsonb, date, uuid) from public, anon;
grant execute on function public.propose_in_close(uuid, text, jsonb, date, uuid) to authenticated;

-- 정리를 끝낼 때: 열린 묶음 제안이 있으면 배우자에게 한 번 알림. 돌려주는 값 = 묶음 제안 수
create or replace function public.send_close_bundle(p_close uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c public.month_close;
  p public.monthly_plan;
  me public.app_user;
  other uuid;
  n integer;
  apply_on date;
begin
  select * into c from public.month_close where id = p_close and deleted_at is null;
  if c.id is null or not public.is_space_member(c.space_id) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  select count(*)::int, min(x.apply_on) into n, apply_on
    from public.proposal x where x.month_close_id = c.id and x.status = 'open';
  if n = 0 then
    return 0;
  end if;
  select * into p from public.monthly_plan where id = c.plan_id;
  select * into me from public.app_user where id = auth.uid();
  select id into other from public.app_user
    where space_id = c.space_id and status = 'active' and id <> me.id limit 1;
  if other is not null then
    perform public.notify(other, c.space_id, 'close_bundle',
      coalesce(me.nickname, '') || '님이 ' || extract(month from p.label_month)::int || '월 월급 플랜을 정리했어요',
      '반대 없으면 ' || public.md_label(apply_on) || '부터 적용돼요',
      '/month/close/w-04p/' || c.id, 'clipboard-text', me.id, 'bundle:' || c.id);
  end if;
  return n;
end;
$$;
revoke execute on function public.send_close_bundle(uuid) from public, anon;
grant execute on function public.send_close_bundle(uuid) to authenticated;
