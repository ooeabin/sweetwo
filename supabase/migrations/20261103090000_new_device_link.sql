-- 새 기기 로그인 알림(15 A-08 4·5번): 누르면 ‘나예요 / 내가 아니에요’ 화면(/new-device/{새 세션 id})으로.
-- 20261102180000_noti_channels.sql의 note_login과 같고 링크만 바뀜.
create or replace function public.note_login()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  cur text := nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'session_id';
begin
  if uid is null or cur is null then
    return false;
  end if;
  if not exists (select 1 from auth.sessions s where s.user_id = uid and s.id::text <> cur) then
    return false;
  end if;
  perform public.notify(uid, (select space_id from public.app_user where id = uid), 'new_device',
    '새 기기에서 로그인했어요', '본인이 아니면 바로 로그아웃해 주세요', '/new-device/' || cur, 'shield-warning', null,
    'login:' || cur);
  return true;
end;
$$;
revoke execute on function public.note_login() from public, anon;
grant execute on function public.note_login() to authenticated;
