# DatePicker

날짜 입력(결혼식 날짜 묻기 등). 입력 칸을 누르면 아래에 달력.

- 소비자가 주는 것: 라벨, 값, 고를 수 있는 범위.
- 칸은 Select와 같은 모양(`button`) + calendar 아이콘. 열린 달력은 Calendar와 같은 칸, `hairline` 테두리 + `shadow-2`.
- 연·월만 고르는 질문은 월 목록(12칸 격자)으로. 좁은 창에서는 BottomSheet.
- 키보드로 직접 입력도 됨(“2026.11.25”).
- 날짜 직접 입력(DateInput, 2026-11-02): 연·월·일 조각을 글자 칸 하나(52px, `hg-datefield`) 안에. 조각 뒤 작은 단위(“년”, “월”, “일”, 15px `slate`), 칸 안 어디를 눌러도 하나의 칸처럼 테두리가 진해짐.

## React 래퍼 `DatePicker`(2026-11-17, 어드민)

브라우저 기본 `type="date"`·`datetime-local`(브라우저마다 다른 “mm/dd/yyyy” 칸과 달력) 대신.

- `packages/ui` `DatePicker`: 라벨(`hideLabel`), 값 `'YYYY-MM-DD'`(`time`이면 `'YYYY-MM-DDTHH:MM'`, 덜 찼거나 없는 날짜면 `''`), `onChange`, `disabled`, 도움말, 버튼 이름(`labels`: 달력 열기, 이전 달, 다음 달, 시각), 너비.
- 칸(`hg-input hg-datepick__box`): 왼쪽 날짜 글자 칸(“2026.11.25”, 자리표시 “0000.00.00”, 숫자만 쳐도 됨 “20261125”, “2026-11-25”도 받음, 칸을 떠나면 점 표기로) → `time`이면 1px 선 뒤 시각 칸(“14:00”, “1400”도 받음) → 오른쪽 끝 `calendar` 16px 버튼(28px, `slate`). 칸 안 어디에 포커스가 있어도 칸 테두리 `ink`. 없는 날짜(“2026.02.30”)는 칸을 떠날 때 `is-error` + `aria-invalid`.
- 달력 판(`hg-datepick__pop`, 칸 바로 아래, `hairline` 테두리 + `shadow-2`, `role="dialog"`): 머리 ‹ “2026년 11월” ›(`formatYm`), 요일 12px `stone`(일요일 시작), 날짜 34px 칸(`hg-datepick__day`, 고정폭 숫자). 오늘(KST `todayKst`)은 굵게 + 1px `hairline` 고리(`aria-current="date"`), 고른 날은 `ink` 채움 + `on-ink` 글자(`aria-pressed`, 어드민·앱 모두 잉크, 오렌지 아님). 다른 달 칸은 비움.
- 달력 키보드: 열면 고른 날(없으면 오늘)에 포커스, ←/→ 하루, ↑/↓ 한 주, PageUp/PageDown 한 달, Home/End 그 달 처음·끝, Enter 고르기, Esc 닫고 달력 버튼으로. 날짜 칸에서 Alt+↓도 달력을 엶. 고르면 닫히고, 시각이 비었으면 시각 칸으로 포커스.
- 날짜 표기·해석은 core(`formatDateDot`, `parseDateDot`, `parseTimeText`, `formatDateFull`은 날짜 칸 화면 읽기 이름).
- 기간(`DateRange`, `hg-daterange`): 같은 칸 둘 + 가운데 “~”(`stone`), 묶음 `role="group"`. 끝이 시작보다 앞이면 아래 `hg-help is-error` 한 줄. 어드민 감사 로그(AD-17).
- 쓰는 곳: 어드민 공지 노출 시작·끝(AD-10, 시각까지), 점검 시작·끝(AD-16, 시각까지), 콘텐츠 시행일·확인일·공휴일·평균 금리 적용일(AD-14), 감사 로그 기간(AD-17). 질문 화면의 연·월·일 조각 칸(DateInput, 위)은 그대로.
