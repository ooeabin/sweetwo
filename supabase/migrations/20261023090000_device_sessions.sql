-- S-15 보안 ‘로그인된 기기’(25 S-15, 31 2장 ‘기기 관리’): 내 로그인 세션 목록, 기기별 로그아웃, 다른 기기 모두 로그아웃.
-- 세션은 Supabase Auth(auth.sessions)가 가짐. 앱은 함수로만 보고 지움(지우면 그 기기의 갱신 토큰도 함께 무효).
-- 지금 이 기기 = 접근 토큰의 session_id.

create or replace function public.my_sessions()
returns table (id uuid, user_agent text, created_at timestamptz, last_used_at timestamptz, current boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  cur text := nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'session_id';
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  return query
    select s.id, s.user_agent, s.created_at,
      coalesce(s.refreshed_at at time zone 'UTC', s.updated_at, s.created_at),
      s.id::text = cur
    from auth.sessions s
    where s.user_id = uid
    order by 4 desc;
end;
$$;
revoke execute on function public.my_sessions() from public, anon;
grant execute on function public.my_sessions() to authenticated;

-- 기기 하나 로그아웃(p_id) 또는 이 기기 빼고 모두(p_id null)
create or replace function public.end_sessions(p_id uuid default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  cur text := nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'session_id';
  n integer;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  delete from auth.sessions s
    where s.user_id = uid
      and (case when p_id is null then s.id::text is distinct from cur else s.id = p_id end);
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.end_sessions(uuid) from public, anon;
grant execute on function public.end_sessions(uuid) to authenticated;
