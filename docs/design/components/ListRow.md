# ListRow

목록 한 줄. 설정 항목, 자산 항목, 배우자 활동에 씀.

- 소비자가 주는 것: 앞 요소(아이콘·Avatar·Toggle, 선택), 라벨, 보조 1줄(선택), 값(선택), 이동 표시(선택).
- 높이 56px 이상, 세로 가운데 정렬. 값은 오른쪽 정렬 `tabular-nums`.
- 누르면 이동하는 줄만 화살표(`hg-chevron`)이고 줄 전체가 `button`(또는 `a`). 토글 줄은 화살표 없음.
- 여러 줄은 `hg-list`로 묶음: 흰 바탕, 1px `hairline-soft` 테두리, `radius-xl`, 행 사이 구분선 없음, 행 높이 60px 이상. 좁은 창에서는 테두리 없이 회색 띠(`band`)로 묶음을 나눔.
- 행 앞 아이콘 칸 `Lead`(`hg-lead`, 40px 원): 영역 색 원 + 아이콘(`hg-lead--together` 등, 공동 생활비 = 우리 둘, 목표자금 = 목표, 비상금 = 비상금) 또는 목표 3D 그림. 장식이라 `aria-hidden`.
- 사진 미리보기 `hg-thumb`(40px, `radius-md`, 잘라 채움): 챙길 날 드린 기록(Y-09)에서 첫 사진. 장식이라 `aria-hidden`, 사진 수는 보조 줄 “사진 3장”.

## 설정 줄

- 값 + 화살표: 오른쪽에 현재 값(`hg-listrow__value is-soft`, `slate` 400) + `hg-chevron`. 누르면 고르는 화면·BottomSheet.
- 스위치 줄: 오른쪽 Toggle(`button role="switch"` + `aria-checked`, 라벨을 `aria-labelledby`로). 줄 자체는 누르는 대상 아님, 바로 적용.
- 앞 아이콘은 20px `ink`, 보조 1줄은 지금 설정을 사실로(“월요일 오전 9시”).
