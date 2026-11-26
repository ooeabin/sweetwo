-- 새 기기 로그인 알림(new_device)은 로그인한 그 기기에서는 숨긴다(2026-11-26 사용자 결정, 15 A-08 5번, 14 ‘새 기기 로그인’).
-- 링크 ‘/new-device/{로그인한 세션 id}’가 지금 세션(JWT session_id, my_sessions의 current와 같은 기준)이면 그 기기의 알림 목록,
-- 안 읽은 점, 알림 하나 읽기, Realtime(RLS)에서 빠진다. 다른 기기에서는 그대로 보인다.
-- ‘모두 읽음’도 숨긴 알림은 건드리지 않는다(다른 기기에서는 안 읽음 그대로).

-- 지금 세션에서 숨길 알림인지(정책·함수 한 곳)
create or replace function public.noti_hidden_here(p_kind text, p_target text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_kind = 'new_device'
    and p_target = '/new-device/'
      || coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'session_id', '');
$$;
revoke execute on function public.noti_hidden_here(text, text) from public, anon;
grant execute on function public.noti_hidden_here(text, text) to authenticated;

drop policy notification_select on public.notification;
create policy notification_select on public.notification for select to authenticated
  using (user_id = (select auth.uid()) and not public.noti_hidden_here(kind, target));

create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  update public.notification set read_at = now()
  where user_id = auth.uid() and read_at is null and (p_ids is null or id = any (p_ids))
    and not public.noti_hidden_here(kind, target);
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.mark_notifications_read(uuid[]) from public, anon;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;
