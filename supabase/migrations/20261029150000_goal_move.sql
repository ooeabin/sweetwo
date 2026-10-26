-- 목표 넣기·빼기(G-02a), 꺼내 쓰기(G-02b), 모은 돈, 목표와 분배표 저금 줄 맞추기(docs/spec/22-goals.md, 20 ‘분배표와 체크리스트’).
-- 모은 돈 = 이미 모은 돈(goal.other_held) + 체크한 저금 줄 + 넣기 − 빼기 − 꺼내 쓰기, 0 아래로 내려가지 않음(06 4장).

create table public.goal_move (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.couple_space (id) on delete cascade,
  goal_id uuid not null references public.goal (id) on delete cascade,
  kind text not null check (kind in ('in', 'out', 'use')), -- 넣기 / 빼기 / 꺼내 쓰기
  amount bigint not null check (amount between 1 and 99999999999),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz -- 되돌리기
);
create index goal_move_goal_idx on public.goal_move (goal_id) where deleted_at is null;

alter table public.goal_move enable row level security;
create policy goal_move_select on public.goal_move for select to authenticated using (public.is_space_member(space_id));
create policy goal_move_insert on public.goal_move for insert to authenticated with check (false);
create policy goal_move_update on public.goal_move for update to authenticated using (false);
create policy goal_move_delete on public.goal_move for delete to authenticated using (false);
revoke insert, update, delete on public.goal_move from authenticated, anon;

-- 내 목표는 주인만 고침(우리 목표는 둘 다). 배우자 내 목표는 보기만(22 ‘목표 종류’)
drop policy goal_update on public.goal;
create policy goal_update on public.goal for update to authenticated
  using (public.is_space_member(space_id) and (owner_user_id is null or owner_user_id = auth.uid()))
  with check (public.is_space_member(space_id) and (owner_user_id is null or owner_user_id = auth.uid()));

-- 목표 하나의 모은 돈(권한 확인 없이, 함수 안에서만)
create or replace function public.goal_saved(p_goal uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(
    g.other_held
    + coalesce((select sum(coalesce(l.actual, l.planned)) from public.pay_check_line l
                where l.goal_id = g.id and l.kind = 'saving' and l.state = 'checked'), 0)
    + coalesce((select sum(case m.kind when 'in' then m.amount else -m.amount end) from public.goal_move m
                where m.goal_id = g.id and m.deleted_at is null), 0),
    0)::bigint
  from public.goal g where g.id = p_goal;
$$;
revoke all on function public.goal_saved(uuid) from public, anon, authenticated;

-- 목표별 모은 돈(보는 사람 권한대로)
create or replace function public.goal_saved_sums()
returns table (goal_id uuid, saved bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, public.goal_saved(g.id)
  from public.goal g
  where g.space_id = (select space_id from public.app_user where id = auth.uid()) and g.deleted_at is null;
$$;
revoke all on function public.goal_saved_sums() from public, anon;
grant execute on function public.goal_saved_sums() to authenticated;

-- 넣기·빼기·꺼내 쓰기. 빼기·꺼내 쓰기는 모은 돈보다 많으면 안 됨. 내 목표는 주인만
create or replace function public.move_goal(p_goal uuid, p_kind text, p_amount bigint)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  g public.goal;
  v_id uuid;
begin
  select * into g from public.goal where goal.id = p_goal and deleted_at is null;
  if g.id is null or not public.is_space_member(g.space_id) then
    raise exception 'no_goal' using errcode = '42501';
  end if;
  if g.owner_user_id is not null and g.owner_user_id <> uid then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if p_kind not in ('in', 'out', 'use') or p_amount is null or p_amount < 1 or p_amount > 99999999999 then
    raise exception 'bad_move' using errcode = '22023';
  end if;
  if p_kind <> 'in' and p_amount > public.goal_saved(p_goal) then
    raise exception 'too_much' using errcode = '22023';
  end if;
  insert into public.goal_move (space_id, goal_id, kind, amount, created_by)
    values (g.space_id, g.id, p_kind, p_amount, uid) returning goal_move.id into v_id;
  return v_id;
end;
$$;
revoke all on function public.move_goal(uuid, text, bigint) from public, anon;
grant execute on function public.move_goal(uuid, text, bigint) to authenticated;

-- 되돌리기(Toast): 내가 한 기록만
create or replace function public.undo_goal_move(p_id uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.goal_move set deleted_at = now()
  where id = p_id and created_by = auth.uid() and deleted_at is null;
$$;
revoke all on function public.undo_goal_move(uuid) from public, anon;
grant execute on function public.undo_goal_move(uuid) to authenticated;

-- 목표와 분배표 저금 줄 맞추기. 모으는 목표(진행 중·지연)만 줄이 있음:
-- 합쳐서 = 공동 분배표 1줄, 각자 + 우리 목표 = 사람마다 분배표에 1줄, 각자 + 내 목표 = 주인 분배표에만.
-- 새 줄은 0원으로 저금 묶음 맨 아래. 빠지는 줄은 지움(체크한 이번 달 줄은 기록으로 남음). 이번 사이클 체크리스트도 맞춤.
create or replace function public.goal_lines_sync(p_goal uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  g public.goal;
  mode public.salary_mode;
  s record;
  last smallint;
  want boolean;
begin
  select * into g from public.goal where id = p_goal;
  if g.id is null then
    return;
  end if;
  select salary_mode into mode from public.couple_space where id = g.space_id;
  for s in select * from public.salary_split where space_id = g.space_id loop
    want := g.deleted_at is null and g.status in ('active', 'delayed') and (
      (mode = 'joint' and s.owner_user_id is null)
      or (mode = 'separate' and s.owner_user_id is not null
          and (g.owner_user_id is null or g.owner_user_id = s.owner_user_id)));
    if want and not exists (select 1 from public.split_line where split_id = s.id and goal_id = g.id) then
      select coalesce(max(sort), -1) into last from public.split_line where split_id = s.id and kind = 'saving';
      update public.split_line set sort = sort + 1 where split_id = s.id and sort > last;
      insert into public.split_line (split_id, space_id, kind, goal_id, amount, sort)
        values (s.id, g.space_id, 'saving', g.id, 0, last + 1);
      perform public.sync_checklist(s.id);
    elsif not want and exists (select 1 from public.split_line where split_id = s.id and goal_id = g.id) then
      delete from public.split_line where split_id = s.id and goal_id = g.id;
      perform public.sync_checklist(s.id);
    end if;
  end loop;
end;
$$;
revoke all on function public.goal_lines_sync(uuid) from public, anon, authenticated;

create or replace function public.goal_lines_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT'
     or new.status is distinct from old.status
     or new.deleted_at is distinct from old.deleted_at
     or new.owner_user_id is distinct from old.owner_user_id then
    perform public.goal_lines_sync(new.id);
  end if;
  return null;
end;
$$;
create trigger goal_lines after insert or update on public.goal
  for each row execute function public.goal_lines_trigger();
