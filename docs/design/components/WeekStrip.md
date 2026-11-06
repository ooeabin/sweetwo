# WeekStrip

이번 주 날짜 띠(2026-10-27, 현대카드 소비 캘린더 느낌). 홈 ‘다가오는 일정’(H-05) 목록 위.

- 소비자가 주는 것: 오늘(KST), 일정이 있는 날 묶음, 공휴일(선택).
- 일요일부터 토요일까지 7칸. 칸마다 위 요일(12px `stone`), 가운데 날짜(16px 600, 34px 원), 아래 5px 점.
- 오늘은 `ink` 원 + `on-ink` 글자. 지난 날은 날짜 `stone`. 일요일·공휴일은 요일과 날짜를 `holiday-ink`. 일정이 있는 날만 점(`ink`).
- 흰 카드(`hairline-soft` 테두리 + `shadow-1`, `radius-xl`). 아래 일정 목록이 같은 내용을 읽어 주므로 띠는 `aria-hidden`.
- React 래퍼 `WeekStrip`(packages/ui): `today`, `marked`, `holidays`.
