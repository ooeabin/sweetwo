# Calendar

‘캘린더’ 메뉴의 달력(Y-04). 경조사(생일·기념일·명절·양가 행사, 한 종류)와 금융 일정(월급날·목표 기한·만기일·월급 전 확인)을 함께 보여 줌.

2026-11-04 토스 소비 달력형으로 바꿈(레퍼런스: 토스 소비 달력, Todoist·Apple 캘린더의 고른 날 목록, 구글 캘린더의 여러 날 띠). 카드 없이 화면 폭 전체, 한 달을 늘 펼쳐 둠(주 단위 접기 없앰).

- 소비자가 주는 것: 연·월, 날짜별 짧은 이름과 종류, 월급 전 확인 띠 자리, 오늘, 고른 날, 아래 고른 날 일정(children).
- 머리 `hg-cal__head`: 가운데 ‘‹ 10월 ›’(월 17px 700, 이전·다음 작은 둥근 버튼 `stone`). 올해가 아니면 월 앞에 연도(`stone`). 오늘이 든 달이 아니면 오른쪽 끝 ‘오늘’(`hg-cal__today`, `surface-alt` 알약 12px).
- 요일 12px 400 `stone`. 주말 색은 쓰지 않음(공휴일만 빨강).
- 그 달 주만 그림(다음 달만 있는 줄은 뺌). 다른 달 날짜 칸은 비워 둠(`is-muted`, 흐린 숫자는 대비가 모자라서).
- 날짜 칸 64px `button`: 숫자 17px 500 `ink`(2026-11-09 18px에서, 줄 높이 22px 그대로, 고정폭). 그 아래 짧은 이름 한 줄 `hg-cal__short`(10px 500 `slate`, 경조사 `together-ink`, 공휴일 `holiday-ink`, 넘치면 말줄임, 여러 개면 “생신 +1”).
  - 짧은 이름: 경조사는 이름의 마지막 낱말(“어머니 생신” → “생신”), 금융 일정은 “월급” “기한” “쓰는 달” “만기”, 공휴일은 이름(“대체공휴일(개천절)” → “대체공휴일”).
- 오늘 `is-today`: 숫자 800. 고른 날 `is-selected`: 떠 있는 흰 칸(`surface` + `shadow-2` + `hairline-soft` 1px 고리, `radius-lg`). 처음 고른 날은 오늘.
- 월급 전 확인 기간(다음 월급날 3일 전 ~ 전날): 칸마다 회색 판이 아니라 칸 아래 이어진 한 줄 띠 `hg-cal__band`(높이 14px `surface-alt`, 시작·끝 둥글게, 시작 칸에 “월급 전 확인” 9px 600 `slate`). 주가 바뀌면 그 줄에서 끊고 다음 줄에서 다시 시작.
- 공휴일 `is-holiday`: 숫자 `holiday-ink`. 설·추석 연휴 `is-festive`: 칸 바탕 `family`(고른 날 흰 칸이 이김).
- 달력 아래 굵은 회색 띠(Band) → 고른 날 일정 `hg-cal__agenda`: 날짜 “10월 20일 화요일”(13px `slate`) → 줄만 목록(`hg-list--plain`): 40px 종류 아이콘(Lead, 2026-11-09 영역 색 원 + Phosphor: ListRow ‘Lead 종류 표’의 `care`(생일 케이크, 기념일 하트, 명절 달과 별 등, 모두 `together`)와 `money`(월급날 지폐, 월급 전 확인 달력 체크, 기한 과녁, 만기 모래시계, 공휴일 깃발)) + 이름 15px 500(2026-11-09 밀도, 700에서. 글자 단계로 17px에서 15px) + 회색 보조 줄(금액 메모·D-day, 갈 화면). 없으면 “이 날은 일정이 없어요”. 오늘 이후면 맨 아래 점선 원 + ‘이 날에 경조사 추가’(15px `slate`, `hg-cal__add`).
- 보기 필터 칩(“전체” “경조사” “금융 일정”)은 회색 알약(`surface-alt` + `slate`), 고르면 검정. 그 위에 자산 관리와 같은 탭 “목록” / “달력”.
- 날짜 칸 `aria-label`에 날짜, 공휴일 이름, 일정 수. 고른 날 `aria-pressed`, 오늘 `aria-current="date"`.
- React 래퍼 `Calendar`(packages/ui): `days`(`short`, `tone`, `band`, `holiday`, `festive`), `today`, `selected`, 이전·다음, `todayLabel`·`onToday`, `bandLabel`, `showYear`.
- 목록(Y-01)의 줄은 같은 종류 아이콘(Lead)과 오른쪽 D-day `hg-cal__dday`(7일 안 `is-near`). 기록할 날 띠 `hg-recband`.
