-- P-02a 혼자 쓰던 기록 옮기기(18 P-02a, 15 A-07 6번): 혼자 시작한 기록이 있는 사람이 ‘합류하기’를 누르면
-- 내 명의 사실값만 옮김. 월급·월급날은 app_user에 그대로, 내 명의 자산·부채(+ 금액 이력)는 초대 공간으로(공개 범위는 고른 값, 기본 금액만).
-- 목표·분배표·체크리스트·챙길 날은 안 옮김: 원래 공간은 30일 보관 후 지움(purge_left_spaces). 그동안 사본은 합류 전에 S-18에서.
create or replace function public.join_moving_records(p_code text, p_vis jsonb default '{}'::jsonb)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  old_space uuid;
  new_space uuid;
  r text;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select space_id into old_space from public.app_user where id = uid and status = 'active' for update;
  if old_space is null or exists (
    select 1 from public.couple_space x where x.id = old_space and x.couple_state in ('connected', 'unlink_pending')
  ) then
    raise exception 'nothing_to_move' using errcode = 'P0001';
  end if;
  if jsonb_typeof(coalesce(p_vis, '{}'::jsonb)) <> 'object' then
    raise exception 'bad_vis' using errcode = '22023';
  end if;
  -- 원래 공간에서 잠깐 빠져 join_space의 ‘기록 있음’ 확인을 넘김(실패하면 아래 raise로 전체 되돌림)
  update public.app_user set space_id = null where id = uid;
  r := public.join_space(p_code);
  if r not in ('joined', 'resume') then
    raise exception 'join_failed:%', r using errcode = 'P0001';
  end if;
  select space_id into new_space from public.app_user where id = uid;
  -- 내 명의 자산·부채와 금액 이력
  update public.asset_history h set space_id = new_space
    from public.asset a
    where a.id = h.asset_id and a.space_id = old_space and a.owner = 'person'
      and coalesce(a.owner_user_id, a.created_by) = uid;
  update public.asset a set
    space_id = new_space,
    owner_user_id = uid,
    goal_id = null,
    visibility = (case coalesce(p_vis->>a.id::text, 'sum') when 'all' then 'all' when 'private' then 'private' else 'sum' end)::public.asset_visibility
    where a.space_id = old_space and a.owner = 'person' and coalesce(a.owner_user_id, a.created_by) = uid;
  -- 원래 공간: 30일 보관 후 지움(구성원 없음)
  update public.couple_space set deleted_at = now() where id = old_space;
  delete from public.notification where user_id = uid and space_id = old_space;
  return r;
end;
$$;
revoke execute on function public.join_moving_records(text, jsonb) from public, anon;
grant execute on function public.join_moving_records(text, jsonb) to authenticated;

-- 아무도 없는 지운 공간을 30일 뒤 영구 삭제(합류로 떠난 혼자 공간)
create or replace function public.purge_left_spaces()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  delete from public.couple_space s
    where s.deleted_at is not null and s.deleted_at < now() - interval '30 days'
      and not exists (select 1 from public.app_user u where u.space_id = s.id)
      and not exists (select 1 from public.couple_unlink u where u.space_id = s.id and u.status = 'confirmed'
                      and u.reconnect_until > now());
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.purge_left_spaces() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('purge-left-spaces', '45 19 * * *', 'select public.purge_left_spaces()');
  end if;
end;
$$;
