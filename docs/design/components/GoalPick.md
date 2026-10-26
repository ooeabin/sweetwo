# GoalPick

그림 카드로 목표를 여러 개 고르는 질문(O-21 목표 고르기). 고른 순서가 우선순위.

- 소비자가 주는 것: 카드 목록(이름, 그림 키, 추천 여부), 고른 순서, 누를 때 동작.
- 틀 `hg-pick`: 3열(좁은 창 768px 미만 2열), 칸 사이 12px.
- 카드 `hg-pick__item`(`button`, `aria-pressed`): 흰 바탕 `hairline` 1px 테두리, 모서리 `radius-xl`, 가운데에 그림 64px(`hg-pick__art`, Illustrations 512px 무광 3D 그대로) → 이름(14px 600).
- 고른 카드(`is-on`): 테두리 `ink` 2px(안쪽 그림자로 두께를 더해 칸 크기가 변하지 않게) + 오른쪽 위 순번 원(`hg-pick__order`, `ink` 바탕 22px, 1, 2, 3). 해제하면 뒤 순번이 당겨짐. 브랜드 색은 쓰지 않음.
- 추천: 왼쪽 위 `hg-tag` “추천”.
- 직접 만들기: 그림 대신 회색 판(`hg-pick__art--custom`, `hairline-soft`) + `plus` 아이콘, 이름 “+ 직접 만들기”.
- 화면 읽기: 이름, 추천, 순번을 글자로 읽음(순번 원은 글자 그대로). 키보드 Tab·Space·Enter.
- React 래퍼 `GoalPick`(packages/ui): `items`(key, name, illustration, recommended), `order(key)`, `onToggle(key)`, `customLabel`, `recommendedLabel`.
