# DataTable

어드민·내보내기용 표. 사용자 화면에는 쓰지 않음(사용자 화면 목록은 ListRow).

- 소비자가 주는 것: 열 이름, 열마다 숫자 여부, 행.
- 머리 `surface-sunk` + `caption` 600 `slate`, 높이 40px. 행 48px, 구분선 `hairline-soft`, 바깥 `radius-xl` 테두리.
- 숫자 열(`is-num`)은 머리와 칸 모두 오른쪽 정렬, `tabular-nums`. 글자 열은 왼쪽.
- 마우스를 올린 행 `surface-alt`. 색으로 좋고 나쁨을 칠하지 않음.
- 금액은 원 또는 만 원 단위를 열마다 하나로. 모르는 값은 “—”.
- 정렬은 머리 누르기(`aria-sort`), 정렬 중인 머리만 `ink`.
- 펼친 줄(`hg-table__more`, 2026-11-06): 행을 누르면 그 행 바로 아래에 상세(`surface-sunk`, 줄바꿈 허용). 어드민 감사 로그(AD-17).

React 래퍼: `DataTable`(packages/ui, 열 이름·숫자 열·행·행 누르기·펼친 줄 `expanded`·빈 상태). 행을 누를 수 있으면 키보드 Enter도.
- `loading`(2026-11-06): 불러오는 중이고 행이 없으면 0.3초 뒤 뼈대 줄 5개, `tbody aria-busy`.
