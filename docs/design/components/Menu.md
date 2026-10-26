# Menu

⋯ 버튼으로 여는 동작 목록. 카드·목록 행의 수정·지우기.

- 소비자가 주는 것: 여는 버튼(IconButton `ellipsis`, 또는 글자 보조 버튼 `button` — 예: 홈 오늘 띠 ‘추가’), 동작 목록(아이콘 + 동사 문구). 밖에서 열기(Ctrl+N 등)는 `open`/`onOpenChange`.
- 너비 200px, `shadow-2`, `z-dropdown`. 열린 동안 여는 버튼은 `is-on`.
- 지우기는 맨 아래, 구분선 뒤, `danger` 글자. 보관·지우기(휴지통)는 묻지 않고 바로 하고 Toast “되돌리기”. 확인 Modal은 영구 삭제·연결 끊기·계정 삭제만.
- 항목은 `button role="menuitem"`.
- 동작은 4개까지. 좁은 창에서는 BottomSheet로 열림.
- 키보드: ↑/↓ 이동, Enter 실행, Esc 닫고 여는 버튼으로 포커스.
- React 래퍼 `Menu`(packages/ui): 여는 버튼 + 동작 목록(`label`, `icon` 선택, `danger`). 아이콘이 없는 동작은 글자만. 좁은 창 BottomSheet는 BottomSheet 래퍼를 만들 때.
