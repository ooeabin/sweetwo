# DateSheet, DateField

폼 안 날짜 고르기(2026-11-24 사용자 결정 “달력은 그렇게 진행해”). 폼에는 연·월·일 휠을 펼쳐 두지 않는다. 시안 `work/w02-design/cal.html`.

## DateField (폼 한 줄)

- 회색 판(`surface-alt`, radius 16, 높이 56, 안쪽 16, `hg-dline`) 안에 “2026년 11월 26일 (목)” 17/400 ink + 보조 13(‘양력’, ‘음력’ 등 `slate`) + 오른쪽 ›. 아직 안 정했으면 자리표시 stone(기본 “날짜 고르기” [확인 필요]).
- 날짜 표기는 core `formatDateDow`. 누르면 `DateSheet`. 화면 읽기 이름 “{질문}, {날짜}, {보조}”, `aria-haspopup="dialog"`.
- 질문 섹션이 없는 화면(W-20)은 위에 이름 한 줄(`hg-dfield__named`, 13 slate).
- 줄 아래 오류·안내는 `below`(`hg-form__below`).

## DateSheet (달력 시트)

- 아래에서 올라오는 `BottomSheet`. 제목(질문 그대로) → (양력/음력이 필요한 곳만) `SegChoice` → 월 머리 “‹ 2026년 11월 ⌄ ›”(44px 칸) → 요일 줄(일~토 13 stone, 일요일도 같은 색: 주말 색 없음, 공휴일만 빨강인 Y-04와 같게, 2026-11-24 구역 4) → 날짜 격자 → 아래 주 버튼 “{n}월 {d}일 ({요일}) 선택” [확인 필요](못 고른 때 비활성 “날짜를 골라 주세요” [확인 필요]) + 값을 지울 수 있는 곳은 글자 버튼 “… 지우기”.
- 날짜 칸: 높이 44, 안 원 40, 15/400 고정폭 숫자(`tabular-nums`). 일요일도 `ink`, 오늘은 1px `border-control` 원(`aria-current="date"`), 고른 날은 `brand` 채움 + `on-accent-app-text` 700, 범위 밖은 stone + 못 누름.
- 월 머리 ⌄: 연·월 칸(`YearMonthPanel`: 연도 ‹ › + 12개월, PickSheet.md)로 바뀌어 먼 해로 바로 이동(생일 같은 먼 날짜도 가능, 2026-11-26 휠에서 바꿈). 칸이 열려 있는 동안 주 버튼은 “2029년 3월 보기” [확인 필요], 누르거나 월 머리를 다시 누르면 격자로 돌아옴.
- 달 이동: ‹ › 버튼, 격자를 좌우로 밀기(48px 넘게, 애니메이션 없음 = ‘동작 줄이기’와 같음). 범위 끝에서 비활성.
- 음력(Y-07 경조사만, `calendar` 속성): 격자가 음력 달(1~29 또는 30일)이고 첫 칸은 그날의 양력 요일, 윤달이 있는 달만 ‘윤달’ 칩. 칸 읽기 이름 “음력 2026년 8월 15일”. 값은 음력 연·월·일 그대로. 음력 변환은 core `lunarMonthCells`(korean-lunar-calendar, 2050년까지).
- 접근성: 격자 `role="grid"`(행 `row`, 칸 `gridcell`, 요일 `columnheader`), 칸 읽기 이름 “2026년 11월 26일 목요일”(core `formatDateReadout`), 고른 날 `aria-selected`. 키보드: ←→ 하루, ↑↓ 한 주(달 끝을 넘으면 달이 바뀜), PageUp/PageDown 한 달, Home/End 그 달 처음·끝, Enter·Space 고름, Esc 닫기. 칸마다 롤링 `tabindex`.
- 쓰는 곳: Y-07 경조사 추가(양력/음력), W-14a 쓸 곳 메모 ‘언제 내요?’, W-20 받은 날, F-03 만기일(접힌 줄 시트), F-04 만기일 고치기(고르면 바로 저장), F-04a 새 만기일. S-11h 결혼한 날·예정일도 `DateField`(2026-11-26). 연·월만 고르는 곳(W-11d 기한 등)·나가는 날·출생연도·시각은 `PickSheet`(PickSheet.md).
- 코드: `packages/ui/src/components/DateSheet.tsx`(`DateSheet`, `DateField`, `dateSheetLabels`), 스타일 `bundle.css` ‘폼 날짜 한 줄 + 달력 시트’. 계산은 core `monthCells`, `lunarMonthCells`, `lunarDaySolar`, 표기는 `formatDateDow`, `formatMonthDayDow`, `formatDateReadout`.

## MonthSheet (2026-11-24 K안, 달력 Y-04 머리 “12월 ⌄”)

연·월 칸만 있는 바텀 시트. 제목 “연·월 고르기”, 칸은 DateSheet 연·월 칸(`YearMonthPanel`)을 그대로 씀, 아래 주 버튼 “2029년 3월 보기” → 그 달로 이동하고 닫힘. 범위는 올해 기준 앞뒤 10년. 닫기 ✕·Esc·막 누르기로 닫으면 이동하지 않음. React 래퍼 `MonthSheet`(`year`, `month`, `minYear`, `maxYear`, `onDone(year, month)`, `onClose`).
