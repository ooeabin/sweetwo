-- 금액 표기 토스식(2026-11-26 사용자 결정, docs/spec/11-common.md 6장 ‘금액 표기’): 서버가 만드는 알림·활동 기록·메일 문구의
-- 금액을 앱 화면과 같은 꼴로. 300000 → “300,000원”, 3205000 → “3,205,000원”, 음수 “−1,200,000원”.
-- 이름은 그대로 read_won(부르는 함수 27곳을 고치지 않으려고). core formatWon과 같은 결과. 이미 쌓인 알림 글은 그대로 둔다.
create or replace function public.read_won(v bigint)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when v is null then null
    when v < 0 then '−' || to_char(-v, 'FM999,999,999,999,999') || '원'
    else to_char(v, 'FM999,999,999,999,999') || '원'
  end;
$$;
