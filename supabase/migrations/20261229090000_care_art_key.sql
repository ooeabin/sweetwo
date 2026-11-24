-- 경조사 그림 키(24 Y-04 K안, 2026-11-24): 달력 칸·고른 날 줄 앞에 보이는 그림 이름. 스키마는 추가만.
-- 값은 docs/design/assets/Illustrations.md 10번 경조사 그림 키 12개(코드 표: core rules/calendar-art.ts).
-- null이면 앱이 이름 칩(kind) 기본값을 씀. 기존 행은 kind 기준 기본값으로 채움.
alter table public.care_day add column art_key text check (art_key ~ '^[a-z][a-z-]{1,29}$');

update public.care_day set art_key = case kind
  when 'birthday' then 'cake'
  when 'anniversary' then 'diamond'
  when 'dating_anniversary' then 'heart'
  when 'seollal' then 'moon-stars'
  when 'chuseok' then 'moon-stars'
  when 'parents_day' then 'flower-tulip'
  else 'gift'
end
where art_key is null;
