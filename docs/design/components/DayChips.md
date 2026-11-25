# DayChips

월급날 날짜 칸(`hg-daygrid`, 코드 `DayChips`, 온보딩·합류용 래퍼 `DayGrid`). 2026-11-03에 휠로 바꿨다가 2026-11-25 구역 6에서 O-32 월급날과 P-05b 월급날만 다시 화면에 펼친 날짜 칸으로 씀(시안 `work/w02-design/wheelalt.png`). 설정 S-11c는 그대로 휠(`DayWheel`, DateWheel.md).

- 소비자가 주는 것: 이름, 값(1~31 또는 ‘말일’), 말일 글자(기본 “말일”). `DayGrid`는 값이 없으면 처음 값 25일을 바로 알려 주고, 안내 줄(`hint`, 29~31일 “그날이 없는 달은 말일로 계산해요”)과 `disabled`(‘날짜가 정해져 있지 않아요’, 흐리게 0.4 + `inert`)를 가짐.
- 판 없이 흰 바탕 위에 1~31을 7칸씩(칸 사이 4). 칸은 높이 48(44 이상), 너비는 열 폭, `radius-lg`, 17/400 고정폭 숫자(줄 맞춤 숫자 예외). 올리면 `surface-alt`.
- 고른 칸은 `brand`(`accent-app`) 채움 + `on-accent-app-text` 700(라이트 ink·다크 어두운 글자, 흰 글자 금지).
- ‘말일’은 31 바로 옆 두 칸(29 30 31 말일)을 차지하는 회색 칸(`choice-plate`, 글자 `ink-2`). 고르면 같은 `brand` 채움.
- 묶음 `role="radiogroup"`, 칸 `role="radio"` + `aria-checked`, 이름은 “25일”, “말일”. 고른 칸만 탭 순서(없으면 1일). ←→ 하루, ↑↓ 일주일, Home/End 1일/말일.
