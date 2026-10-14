# DataTable

어드민·내보내기용 표. 사용자 화면에는 쓰지 않음(사용자 화면 목록은 ListRow).

- 소비자가 주는 것: 열 이름, 열마다 숫자 여부, 행.
- 머리 `surface-sunk` + `caption` 600 `slate`, 높이 40px. 행 48px, 구분선 `hairline-soft`, 바깥 `radius-xl` 테두리.
- 숫자 열(`is-num`)은 머리와 칸 모두 오른쪽 정렬, `tabular-nums`. 글자 열은 왼쪽.
- 마우스를 올린 행 `surface-alt`. 색으로 좋고 나쁨을 칠하지 않음.
- 금액은 원 또는 만 원 단위를 열마다 하나로. 모르는 값은 “—”.
- 정렬은 머리 누르기(`aria-sort`), 정렬 중인 머리만 `ink`.
