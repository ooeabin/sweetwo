# PickSheet

**칸 고르기 시트**(2026-11-26 사용자 결정 “남은 휠을 시안으로 통일”, 시안 `work/w02-design/wheelalt.png`). 예전 `DateWheel`·`DayWheel`·`NumberWheel`(휠, `hg-wheel`)을 모두 대신함(→ DateWheel.md ‘없앰’). 폼에는 한 줄 필드(`hg-dline`, DateField와 같은 모양: 회색 판 `surface-alt`, radius 16, 높이 56, 값 17/400 + 오른쪽 ›, 안 정했으면 자리표시 `stone`) 하나만 두고, 누르면 아래에서 시트(`BottomSheet`)가 올라옴. 고른 칸은 시트 안에서 바뀌고 **아래 주 버튼을 눌러야 값이 바뀜**(닫기 ✕·Esc·막 누르기는 안 바꿈). 다른 시트 위(W-01 줄 설정, W-11 기한)에서도 열리게 `body`로 올려 그림(`createPortal`). 그 위에서 Esc는 위 시트만 닫음.

## 칸 격자(`hg-picksheet__grid`, 라디오 줄)

- 칸(`hg-picksheet__cell`): 높이 48(누르는 칸 44 이상), radius 12, 17/400 `ink`, 고정폭 숫자(`tabular-nums`, 줄을 맞추는 숫자). 고른 칸은 `accent-app` 채움 + `on-accent-app-text` 700(달력 시트 `hg-calsheet__day.is-on`과 같음, 오렌지 채움은 고른 표시라 규칙 안). 칸 사이 `space-1`. 테두리 없음.
- 키보드: `role="radiogroup"` + `role="radio"`, Tab은 고른 칸(없으면 처음 칸)으로 한 번, ←→ 한 칸, ↑↓ 한 줄(열 수만큼), Home/End 처음·끝. 화살표로 옮기면 바로 고름(라디오), Enter·Space도 고름. 포커스 링 ink 2px.

## 종류

| 이름 | 한 줄 | 시트 | 쓰는 곳 |
| --- | --- | --- | --- |
| `DayField` / `DaySheet` | “매달 25일” / “매달 말일” | 7열 1~31 + 말일(3칸 너비, 회색 판, 고르면 채움). 주 버튼 “매달 25일로 하기” | W-01 줄 설정·W-01d·W-11·W-01e ‘나가는 날’(칩 ‘월급날’ ‘다음 날’은 줄 위에 그대로). 월급날은 `PaydayPicker` |
| `YearMonthField` / `YearMonthSheet` / `YearMonthPanel` | “2026년 12월”, 값 `YYYY-MM` | 머리 ‹ 2026년 ›(넘기기 꺾쇠 `hg-chevnav`: 회색 원 없는 선 꺾쇠 `ink-2` 24, 누르는 칸 44, 범위 끝에서 `stone` + 꺼짐, 2026-11-27 ‘달 넘기기 C안’) + 4열 12개월. 주 버튼 “2026년 12월 선택”. 값이 없으면 다음 달을 바로 알림(휠 때와 같음) | W-11d·W-10a 기한, W-15·W-15a 같이 모으기 기한, S-11c 언제부터·끝나는 달, S-11h 예정 연·월 |
| `YearMonthPanel`(시트 안 조각) | — | 위와 같은 머리 + 12개월을 시트 안에 그대로 | 달력 시트 `DateSheet` 월 머리 ⌄(주 버튼 “2029년 3월 보기”), 달력 머리 `MonthSheet` “12월 ⌄”(Y-04) |
| `YearField` / `YearSheet` | “1993년” / 자리표시 “연도 고르기” | 4열 연도 칸, 한 번에 5줄쯤(264px) 보이고 스크롤, 열릴 때 고른 해(없으면 `initial`)가 가운데에 오게 스크롤. 주 버튼 “1993년 선택”(안 골랐으면 “골라 주세요”, 꺼짐) | S-11i 출생연도(범위 1950~올해−18, 처음 위치 올해−30. 처음 입력할 때도 그 해가 골라진 채로 저장 가능, 2026-11-13 실구동 규칙 그대로) |
| `HourField` / `HourSheet` | “밤 10시” | 4열 0~23시(칸 글자 = `hourLabel`: 새벽·아침·낮·오후·저녁·밤). 주 버튼 “밤 11시 선택” | S-14a 방해 금지 시작·끝(한 줄 둘을 나란히) |

- 날짜 전체(연·월·일)는 달력 시트(`DateSheet.md`, `DateField`). S-11h 결혼한 날·예정일도 `DateField`(처음 입력할 때는 자리표시, 직접 골라야 저장).
- 글자·문구는 `pickLabels`(ui 기본값)로 한국어를 갖고 있고 `labels`로 바꿀 수 있음. 이름은 한 줄 필드의 `label`(질문 그대로) = 시트 제목 = 화면 읽기 이름(질문 문장이 화면 제목에 이미 있으면 짧은 이름: 출생연도). 한 줄 화면 읽기 이름은 “{질문}, {값}”.
- 다크 모드·좁은 창(768px 미만, 시트는 아래에 붙음, 넓은 창은 가운데 카드)·동작 줄이기(전환 없음)는 `BottomSheet`·토큰이 처리.
- React: `DayField({ label, value, onChange, lastLabel? })`, `YearMonthField({ label, value, onChange, error?, minYear?, maxYear? })`, `YearField({ label, value, onChange, minYear, maxYear, initial? })`, `HourField({ label, value, onChange, format })`.
- CSS: `hg-picksheet`, `__grid`(`.is-scroll`), `__cell`(`.is-on`), `__yearhead`, `__year`. 연도 ‹ ›는 공통 넘기기 꺾쇠 `hg-chevnav`(DESIGN.md ‘넘기기 꺾쇠’, 예전 `__nav`는 2026-11-27 없앰). 안 쓰게 된 `hg-wheel*`·휠 글자 예외 줄은 지움.
