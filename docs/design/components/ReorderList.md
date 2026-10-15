# ReorderList

순서 바꾸기 목록. 손잡이로 끌어서 옮기고, 키보드와 화면 읽기 프로그램은 위, 아래 버튼으로 옮김.

- 소비자가 주는 것: 항목(이름, 보조 1줄), 지금 순서, 바뀐 순서를 받는 곳.
- 줄(`hg-reorder__row`, 56px 이상): 왼쪽 손잡이(`hg-reorder__handle`, `dots-six-vertical` 아이콘 `stone`) → 이름 + 보조 1줄 → 오른쪽 위, 아래 버튼(IconButton `hg-iconbtn--ghost hg-iconbtn--sm`, `chevron-up`, `chevron-down`).
- 여러 줄은 `hg-list` 안 `ol.hg-reorder`로 묶음(구분선 `hairline-soft`).
- 끄는 동안: 잡은 줄은 `is-dragging`(`shadow-2` + `hairline` 테두리, 살짝 뜸), 놓일 자리 위에 2px `ink` 선(`is-drop-before`). 다른 줄은 `dur-base` `ease-out`으로 비켜 감. `prefers-reduced-motion`이면 비켜 가는 움직임 없이 바로.
- 손잡이 말고 줄 전체를 잡지 않음(줄 안 다른 버튼과 스크롤을 지키려고). 터치는 손잡이를 0.3초 눌러서 잡음.
- 위, 아래 버튼: 첫 줄의 위, 마지막 줄의 아래는 `disabled`. `aria-label` “내 집 마련 위로”, “내 집 마련 아래로”. 옮긴 뒤 포커스는 옮겨 간 줄의 같은 버튼에 남음.
- 알림: 숨은 `aria-live="polite"` 줄(`hg-sr`)로 “내 집 마련, 4개 중 2번째로 옮겼어요”.
- 저장: 놓는 즉시 저장, 묻지 않음. Toast “순서를 바꿨어요” + “되돌리기”(6초).
- 순서 숫자 글자를 줄에 붙이지 않음(순서는 목록이 보여 줌).

쓰는 곳: 목표 우선순위(G-01 순서 바꾸기), 월급 플랜 나누기 줄 순서, 상단 메뉴 탭이나 독 메뉴 순서(출시 뒤).
- React 래퍼 `ReorderList`(packages/ui): `items`(id, 이름, 보조 줄), `onChange(새 순서)`, `labels`(위로, 아래로, 옮겼어요 알림, 손잡이). 끝에 닿아 꺼진 버튼이면 포커스는 반대 버튼으로. 저장 시점은 쓰는 화면이 정함(G-06은 ‘이 순서로 할게요’ 또는 제안).
