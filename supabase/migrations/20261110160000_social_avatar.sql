-- 소셜 계정 프로필 사진 가져오기(2026-11-05, 25 S-11e ‘처음 사진’). 지정 아바타(a01~a07)는 없앰.
-- - 카카오·구글 계정 사진을 부부 공간이 생긴 뒤 한 번만 가져옴(앱이 함수 social-avatar로 받아 512px JPEG로 다시 그려 set_avatar로 저장).
-- - avatar_social_checked_at: 한 번 시도한 시각(가져왔든 못 가져왔든). 있으면 다시 시도하지 않음.
-- - avatar_preset 열과 set_avatar_preset은 더 쓰지 않음(스키마는 추가만: 지우기는 다음 단계에서).
alter table public.app_user
  add column avatar_social_checked_at timestamptz;

-- 시도했다고 남김(이미 남았으면 그대로)
create or replace function public.mark_social_avatar_checked()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.app_user
    set avatar_social_checked_at = coalesce(avatar_social_checked_at, now())
    where id = auth.uid();
$$;
revoke all on function public.mark_social_avatar_checked() from public, anon;
grant execute on function public.mark_social_avatar_checked() to authenticated;

-- 이미 가입한 사람: 올린 사진이 있으면 시도한 것으로 봄(사진을 바꾸지 않게)
update public.app_user set avatar_social_checked_at = now()
  where avatar_path is not null and avatar_social_checked_at is null;
