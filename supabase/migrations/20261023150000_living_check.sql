-- 생활비 체크(20 W-03, 07 3-2장, 14 알림, 25 S-14 3번).
--
-- 켜기는 부부 단위(couple_space.living_check, 기본 꺼짐). 한 명이 답하면 둘 다 끝(플랜마다 답 하나).
-- 체크일 = 기준일 + 사이클 길이의 절반(반올림). 카드는 체크일 전후 2일, 알림은 체크일 오후 8시.
-- ‘내 용돈에서’(W-03c)는 즉시 적용: 이번 달 내 용돈에서 그만큼 빼서(allowance_cut) 월말 정리 용돈에 반영 + 상대 알림.
--   되돌리기(토스트)는 답한 사람이 10분 안에만. 나머지 선택(목표 배분에서, 다음 달에 메울게요)은 기록만, 월말 정리에서 씀.
-- 결과는 생활비 예산 보정에 쓰지 않음. 예비부부(결혼 전)는 생활비 체크 없음.

alter table public.couple_space add column living_check boolean not null default false;

create table public.living_check (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.couple_space (id) on delete cascade,
  plan_id uuid not null references public.monthly_plan (id) on delete cascade,
  answer text not null check (answer in ('enough', 'just', 'over')),
  over_amount bigint check (over_amount between 1 and 99999999999),
  cover_from text check (cover_from in ('goal', 'allowance', 'next_month')),
  allowance_side public.couple_side,
  allowance_cut bigint check (allowance_cut between 1 and 99999999999),
  answered_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((answer = 'over') = (over_amount is not null and cover_from is not null)),
  check ((cover_from = 'allowance') = (allowance_cut is not null))
);
create unique index living_check_plan_once on public.living_check (plan_id);
alter table public.living_check enable row level security;
create policy living_check_select on public.living_check for select to authenticated
  using (public.is_space_member(space_id));
revoke insert, update, delete on public.living_check from authenticated, anon;

-- 체크일(core rules/living-check.ts livingCheckDay와 같음)
create or replace function public.living_check_day(p_start date, p_end date)
returns date
language sql
immutable
set search_path = ''
as $$
  select p_start + round((p_end - p_start + 1) / 2.0)::int;
$$;

-- S-14 켜기·끄기(부부 단위)
create or replace function public.set_living_check(p_on boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  sid uuid;
begin
  select space_id into sid from public.app_user where id = auth.uid();
  if sid is null then
    raise exception 'not_member' using errcode = '42501';
  end if;
  update public.couple_space set living_check = p_on where id = sid;
end;
$$;
revoke execute on function public.set_living_check(boolean) from public, anon;
grant execute on function public.set_living_check(boolean) to authenticated;

-- W-03 답하기. 돌려주는 값 = 답 id(되돌리기용)
create or replace function public.answer_living_check(
  p_plan uuid, p_answer text, p_over bigint default null, p_cover text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  p public.monthly_plan;
  sp public.couple_space;
  me public.app_user;
  other uuid;
  rid uuid;
begin
  select * into me from public.app_user where id = auth.uid();
  select * into p from public.monthly_plan where id = p_plan and deleted_at is null;
  if p.id is null or me.id is null or p.space_id is distinct from me.space_id then
    raise exception 'not_member' using errcode = '42501';
  end if;
  select * into sp from public.couple_space where id = p.space_id;
  if not sp.living_check or p.status = 'closed' then
    raise exception 'not_open' using errcode = 'P0001';
  end if;
  if p_answer not in ('enough', 'just', 'over')
     or (p_answer = 'over' and (p_over is null or p_over < 1 or p_over > 99999999999
                                or p_cover is null or p_cover not in ('goal', 'allowance', 'next_month')))
     or (p_answer <> 'over' and (p_over is not null or p_cover is not null)) then
    raise exception 'bad_answer' using errcode = '22023';
  end if;
  -- ‘내 용돈에서’는 내 용돈보다 많으면 안 됨
  if p_cover = 'allowance' and p_over > coalesce(me.allowance, 0) then
    raise exception 'over_allowance' using errcode = '22023';
  end if;
  if exists (select 1 from public.living_check where plan_id = p.id) then
    raise exception 'already_answered' using errcode = 'P0001';
  end if;
  insert into public.living_check (space_id, plan_id, answer, over_amount, cover_from, allowance_side, allowance_cut, answered_by)
    values (p.space_id, p.id, p_answer, p_over, p_cover,
      case when p_cover = 'allowance' then me.side end,
      case when p_cover = 'allowance' then p_over end, me.id)
    returning id into rid;
  if p_cover = 'allowance' then
    select id into other from public.app_user
      where space_id = p.space_id and status = 'active' and id <> me.id limit 1;
    if other is not null then
      perform public.notify(other, p.space_id, 'living_allowance',
        coalesce(me.nickname, '') || '님이 이번 달 용돈에서 ' || public.read_won(p_over) || '을 생활비로 돌렸어요',
        null, '/', 'wallet', me.id, 'living:' || rid || ':partner');
    end if;
  end if;
  return rid;
end;
$$;
revoke execute on function public.answer_living_check(uuid, text, bigint, text) from public, anon;
grant execute on function public.answer_living_check(uuid, text, bigint, text) to authenticated;

-- 토스트 ‘되돌리기’: 답한 사람이 10분 안에만. 상대 알림도 지움
create or replace function public.undo_living_check(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r public.living_check;
begin
  select * into r from public.living_check
    where id = p_id and answered_by = auth.uid() and created_at > now() - interval '10 minutes' for update;
  if r.id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  delete from public.notification where dedupe = 'living:' || r.id || ':partner';
  delete from public.living_check where id = r.id;
end;
$$;
revoke execute on function public.undo_living_check(uuid) from public, anon;
grant execute on function public.undo_living_check(uuid) to authenticated;

-- 체크일 오후 8시 알림(켠 부부, 아직 답 없음, 결혼 전 예비부부 아님)
create or replace function public.send_living_check_notifications(p_today date default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  today date := coalesce(p_today, public.kst_today());
  p public.monthly_plan;
  u public.app_user;
  cnt integer := 0;
begin
  for p in
    select m.* from public.monthly_plan m
    join public.couple_space s on s.id = m.space_id
    where m.deleted_at is null and m.status <> 'closed' and s.living_check and s.deleted_at is null
      and s.marriage_status is distinct from 'engaged'
      and public.living_check_day(m.cycle_start, m.cycle_end) = today
      and not exists (select 1 from public.living_check l where l.plan_id = m.id)
  loop
    for u in select * from public.app_user where space_id = p.space_id and status = 'active' loop
      perform public.notify(u.id, p.space_id, 'living_check', '이번 달 생활비, 지금까지 어때요?', null,
        '/plan/living-check', 'wallet', null, 'living:' || p.id || ':' || u.id);
      cnt := cnt + 1;
    end loop;
  end loop;
  return cnt;
end;
$$;
revoke execute on function public.send_living_check_notifications(date) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('living-check-notifications', '0 11 * * *', 'select public.send_living_check_notifications()');
  end if;
end;
$$;
