# GoalPick

그림 카드로 목표를 여러 개 고르는 질문(O-21 목표 고르기). 고른 순서가 우선순위.

- 소비자가 주는 것: 카드 목록(이름, 그림 키, 추천 여부), 고른 순서, 누를 때 동작.
- 틀 `hg-pick`: 3열(좁은 창 768px 미만 2열), 칸 사이 12px.
- 카드 `hg-pick__item`(`button`, `aria-pressed`): 흰 바탕 `hairline` 1px 테두리, 모서리 `radius-xl`, 가운데에 그림 64px(`hg-pick__art`, Illustrations 512px 무광 3D 그대로) → 이름(14px 600).
- 고른 카드(`is-on`): 테두리 `ink` 2px(안쪽 그림자로 두께를 더해 칸 크기가 변하지 않게) + 오른쪽 위 순번 원(`hg-pick__order`, `ink` 바탕 22px, 1, 2, 3). 해제하면 뒤 순번이 당겨짐. 브랜드 색은 쓰지 않음.
- 추천: 왼쪽 위 `hg-tag` “추천”.
- 직접 만들기(2026-11-04): 점선 테두리 카드(`hairline`, 바탕 없음, 글자 `slate`) + 48px `surface-alt` 원 안 `plus` 아이콘, 이름 “직접 만들기”(+ 기호는 아이콘이 대신). 아이콘 카드 사이에서는 같은 모양(40px 원 위 왼쪽, 이름 아래 왼쪽). 마우스를 올리면 `surface-alt` 바탕.
- 화면 읽기: 이름, 추천, 순번을 글자로 읽음(순번 원은 글자 그대로). 키보드 Tab·Space·Enter.
- React 래퍼 `GoalPick`(packages/ui): `items`(key, name, photo, recommended), `order(key)`, `onToggle(key)`, `customLabel`, `recommendedLabel`.

- 2026-11-05 목표 지정 사진 21장 들어옴(`goal-photos/{템플릿}-01.webp`). 직접 만들기는 사진이 없어 아이콘 원.
- 그림이 아직 없으면 아이콘 원(2026-11-02, `hg-pick__art--icon`): 48px `surface-alt` 원 + 24px `ink` Phosphor 아이콘(템플릿마다 `goal-icons.ts`), 카드 높이 104px. 쿠팡플레이 장르 고르기처럼. 목표 지정 사진(실사, 2026-11-04)이 생기면 같은 자리 40px 둥근 네모(`hg-pick__art--photo`, `radius-md`, 꽉 채움)에 사진.
- 아이콘 카드는 왼쪽 정렬(2026-11-03, Strava 활동 고르기처럼): 아이콘 원 40px이 위 왼쪽, 이름이 아래 왼쪽, 안쪽 16px. 순번 원과 ‘추천’은 오른쪽 위(12px). 고르면 같은 자리라 ‘추천’은 숨고 순번이 보임(화면 읽기 이름에는 그대로).

- 묶음 타일 `hg-pick--tiles`(2026-11-04, 자산 추가 F-03a와 우리 자산 빈 상태): 좁은 창도 3열, 넓은 창(768px 이상) 4열, 칸 92px, 가운데 Phosphor 아이콘 26px(`assetIcon`, 부동산은 buildings) + 이름 14px 600. 고르면 `is-on`(ink 2px).

- 2026-11-08: 그림·아이콘 자리는 2D 플랫으로 다시 만들 때까지 빈 자리(회색 판 `hg-artslot`이나 빈 원·빈 칸). 이 문서의 3D·사진·Phosphor 그림 설명은 다시 만들 때의 주제(→ Illustrations ‘나중 과제’).
