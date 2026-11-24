# Calendar

‘캘린더’ 메뉴의 달력(Y-04). 경조사(생일·기념일·명절·가족 행사, 한 종류)와 금융 일정(월급날·목표 기한·만기일·월급날 확인 목록)을 함께 보여 줌.

2026-11-24 K안으로 다시 만듦(사용자 결정, 레퍼런스: 한국 금융 앱 달력형: 현대카드 소비 캘린더, 카카오페이 내역·걸음 달력, 카카오톡 캘린더). 그 전 2026-11-04 대형 금융 앱 소비 달력형(칸 안 짧은 이름 글자 + 확인 목록 띠)은 없앰. 카드 없이 화면 폭 전체, 흰 바탕.

- 소비자가 주는 것: 연·월, 달 머리 글자와 ⌄ 동작, 요약 한 줄(없으면 줄 없음), 날짜별 숫자 모양(`tone`)·첫 일정 그림(`art`)·남은 개수(`more`)·공휴일·연휴, 오늘, 고른 날, 접힘(`folded`), 아래 고른 날 일정(children).
- 머리 `hg-cal__head`(높이 44): 왼쪽 큰 “12월 ⌄”(`hg-cal__month`, 22px 700 `ink` + chevron-down 16 `stone`, 누르는 칸 44. 다른 해면 “2027년 2월”. ⌄를 누르면 연·월 휠 시트 `MonthSheet`(DateSheet.md)). 오른쪽 `hg-cal__nav`: ‘오늘’(다른 달일 때만, `hg-cal__today` 높이 32 `surface-alt` 알약 13px 400 `ink-2`)과 ‹ ›(작은 둥근 아이콘 버튼 `surface-alt`).
- 요약 한 줄 `hg-cal__summary`(머리 아래 4px): 15px 400 `slate`, 개수 “3개”만 700 `ink`. “경조사 3개(85만 원 예상)”(금액 메모 합), 금액 메모가 없으면 “경조사 3개”, ‘금융 일정’ 필터는 “금융 일정 4개”, 0개면 줄 없음.
- 요일 13px 400 `stone`. 주말 색은 쓰지 않음(공휴일만 빨강).
- 주 줄 `hg-cal__week`: 그 달 주만 그림(다음 달만 있는 줄은 뺌). 칸 영역은 좌우 12px를 더 써서 칸이 약 48px(고른 판이 숫자 양옆에 여유). 다른 달 날짜 칸은 비워 둠(`is-muted`, 흐린 숫자는 대비가 모자라서).
- 날짜 칸 `hg-cal__day` `button`: **높이 64px 고정**(위 8 + 숫자 24 + 간격 4 + 그림 칸 20 + 아래 여유). 그림이 없어도 높이가 같아 줄이 흐트러지지 않음. 숫자 `hg-cal__num` 15px/24px(고정폭 숫자, 달력 칸 숫자 예외).
  - 숫자 모양(core `dayTone`): 일정 있는 날 `is-event` 700 `ink`, 일정 없는 날 `is-plain` 400 `slate`, 일정 없는 지난 날 `is-past` 400 `stone`. 공휴일 `is-holiday` `holiday-ink`(이름은 칸에 쓰지 않음, 고른 날 목록에만). 오늘 `is-today` 700 `accent-app-text`(오렌지 숫자, 원·판 없음. 대비 예외: 15px 700 짧은 숫자, axe 선택자 예외 `.hg-cal__day.is-today .hg-cal__num`).
  - 고른 날 `is-selected`: 칸 전체(숫자 + 그림 칸)를 덮는 회색 둥근 판(`surface-alt`, radius 14). 숫자는 `ink` 700(오늘이면 오렌지 숫자 그대로). 처음 고른 날은 오늘. 검정 원은 쓰지 않음(아이콘과 겹침, 사용자 결정 2026-11-24).
  - 그림 칸 `hg-cal__art`(20px, 숫자 아래): 그 날 첫 일정(경조사 먼저, 금융 일정 다음)의 그림 20×20(`hg-cal__img`). 여러 개면 그림 옆 “+1”(남은 개수, 13px 700 `stone`, 달력 칸 예외 아님: 글자 단계 13). **그림 파일이 없으면 그림 칸과 “+n”을 그리지 않음**(Illustrations 숨김 규칙. 칸 높이는 그대로). 월급날 확인 목록 안내는 칸에 그리지 않음.
  - 설·추석 연휴 `is-festive`: 칸 바탕 `family`(고른 날 회색 판이 이김).
- 손잡이 `hg-cal__handle`(달력 아래, 높이 44 누르는 칸, 보이는 막대 36×4 `hairline`): 누르기·키보드(Enter·Space)·끌기(위로 24px 이상 = 접기, 아래로 = 펴기). 접으면 고른 날이 든 주만 남고 나머지 주는 위로 접힘(`hg-cal__week.is-hidden`, `grid-template-rows` 1fr → 0fr + 투명도 `dur-base`, 접힌 주는 `visibility: hidden`이라 포커스·화면 읽기에서 빠짐). ‘동작 줄이기’면 전환 없음. `aria-expanded`, 이름 “한 주만 보기” / “한 달 모두 보기”. 접힘은 앱을 쓰는 동안 기억(보던 달과 같은 규칙).
- 달력 아래 8px 회색 띠(Band) → 고른 날 일정 `hg-cal__agenda`: 머리 `hg-cal__date`(“12월 14일 월요일” 17px 700 `ink` + 보조 “음력 10월 25일” 13px `stone`) → 줄만 목록(`hg-list--plain`): 줄 앞 그림 Lead 40px(그림이 있을 때만, 없으면 칸 없음) + 이름 17px 400(앞 칸이 없는 줄은 날짜 머리와 같은 24px) + 회색 보조 줄(금액 메모·D-day, 갈 화면). 없으면 “이 날은 일정이 없어요”. 오늘 이후면 맨 아래 점선 원 + ‘이 날에 경조사 추가’(15px `slate`, `hg-cal__add`).
- 보기 필터(“전체” “경조사·기념일” “금융 일정”)는 달 머리 위 밑줄 탭 `LineTabs`(2026-11-23 바탕 정리 2). 좁은 창 ‘+ 일정 추가’는 ‘다가오는 일정’ 머리 오른쪽 AddRow.
- 구역 간격은 바탕 기준 32/12(달력 → 8px 띠 → 고른 날 → 8px 띠 → 다음 경조사 카드·다가오는 일정).
- 날짜 칸 `aria-label`에 날짜, 공휴일 이름, 일정 수(확인 목록 안내 포함). 고른 날 `aria-pressed`, 오늘 `aria-current="date"`. 달력 구역 이름 “2026년 12월”.
- React 래퍼 `Calendar`(packages/ui): `year`·`month`, `monthText`, `monthMenuLabel`·`onMonthMenu`, `summary`, `days`(`tone`, `art`, `more`, `holiday`, `festive`), `today`, `selected`, 이전·다음, `todayLabel`·`onToday`, `folded`·`onFoldedChange(folded, via)`, `foldLabel`·`unfoldLabel`. 칸 모양을 정하는 계산(그림 키, 요약 합, 숫자 상태, 접을 주)은 core `rules/calendar-view.ts`.
- 달력 아래 ‘다가오는 일정’(Y-04, 예전 Y-01 목록)의 줄은 같은 그림(Lead, 있을 때만)과 오른쪽 D-day `hg-cal__dday`(7일 안 `is-near`). 기록할 날 띠 `hg-recband`.
