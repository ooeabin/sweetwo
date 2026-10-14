# ListRow

목록 한 줄. 설정 항목, 자산 항목, 배우자 활동에 씀.

- 소비자가 주는 것: 앞 요소(아이콘·Avatar·Toggle, 선택), 라벨, 보조 1줄(선택), 값(선택), 이동 표시(선택).
- 높이 56px 이상, 세로 가운데 정렬. 값은 오른쪽 정렬 `tabular-nums`.
- 누르면 이동하는 줄만 화살표(`hg-chevron`)이고 줄 전체가 `button`(또는 `a`). 토글 줄은 화살표 없음.
- 여러 줄은 `hg-list`로 묶음(구분선 `hairline-soft`).

## 설정 줄

- 값 + 화살표: 오른쪽에 현재 값(`hg-listrow__value is-soft`, `slate` 400) + `hg-chevron`. 누르면 고르는 화면·BottomSheet.
- 스위치 줄: 오른쪽 Toggle(`button role="switch"` + `aria-checked`, 라벨을 `aria-labelledby`로). 줄 자체는 누르는 대상 아님, 바로 적용.
- 앞 아이콘은 20px `ink`, 보조 1줄은 지금 설정을 사실로(“월요일 오전 9시”).
