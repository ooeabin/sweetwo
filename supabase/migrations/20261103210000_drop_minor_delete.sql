-- 2단계 지우기(DEV_GUIDE ‘스키마는 추가만’): 나이를 이유로 가입 뒤 계정을 지우던 옛 함수.
-- 1단계(20261101230000, #126)에서 앱이 더는 부르지 않게 했고, 그 앱 말고는 배포된 앱이 없음(출시 전).
drop function if exists public.delete_minor_account(smallint);
drop function if exists public.delete_underage_account(date);
