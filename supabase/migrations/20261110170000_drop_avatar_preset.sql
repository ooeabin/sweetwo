-- 지정 아바타 없애기 2단계(2026-11-05, 25 S-11e). 1단계(20261110160000)에서 앱이 쓰지 않게 했고, 여기서 열과 함수를 지움.
-- 사진이 없으면 사람 색 원 + 실루엣(앱). 같은 공간 사진 경로는 space_avatars()를 씀.
drop function if exists public.set_avatar_preset(text);
drop function if exists public.space_people_art();
alter table public.app_user drop column if exists avatar_preset;
