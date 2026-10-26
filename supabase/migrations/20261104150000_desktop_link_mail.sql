-- 18 ‘합류 뒤’: 모바일 앱 첫 홈 띠 ‘데스크톱 앱 받기 링크 보내기’ → 알림 이메일로 웹사이트 L-02(/download, OS에 맞는 파일).
-- 본인이 눌러 받는 안내 메일이라 알림 메일 설정·상한과 상관없이 보냄, 하루 한 번(같은 날 다시 누르면 다시 쌓지 않음).
create or replace function public.send_desktop_link()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  url text := 'https://sweetwo.kr/download';
  email text;
begin
  if uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  select notify_email into email from public.app_user where id = uid and status = 'active';
  if email is null or btrim(email) = '' then
    return false;
  end if;
  insert into public.mail_outbox (user_id, to_email, kind, subject, body_text, body_html, capped, dedupe)
    values (uid, btrim(email), 'desktop_link',
      '컴퓨터에서도 sweeTwo를 써 보세요',
      E'Mac이나 Windows에서 같은 계정으로 로그인하면 기록이 그대로 있어요.\n\n컴퓨터에서 이 주소를 열어 주세요: ' || url,
      '<p>Mac이나 Windows에서 같은 계정으로 로그인하면 기록이 그대로 있어요.</p><p><a href="' || url
        || '">컴퓨터 앱 받기</a></p>',
      false, 'desktop_link:' || uid || ':' || public.kst_today())
    on conflict (dedupe) do nothing;
  return found;
end;
$$;
revoke execute on function public.send_desktop_link() from public, anon;
grant execute on function public.send_desktop_link() to authenticated;
