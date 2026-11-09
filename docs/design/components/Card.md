# Card

정보 묶음. 기본은 흰 카드(`hg-card`), 영역을 알려야 할 때만 틴트 카드(`hg-card--tint` + 영역).

- 생김새: 흰 카드 + 1px `hairline-soft` 테두리, 모서리 `radius-xl`(20px). 대표 금액은 `number-lg`(700). 앱 틀의 맨 바깥 카드는 옅은 그림자(`shadow-1`)를 더함(좁은 창 안쪽 좌우 20px). 카드 안의 카드는 그림자 없이 테두리만.
- 회색 판 카드 `hg-card--fill`(`plate` 바탕, 테두리 없음): 안내, 빈 상태, 요약처럼 가볍게 둘 내용. 주요 내용은 흰 카드. 좁은 창에서도 회색 판 모양 그대로.
- 카드 안 보조 버튼은 옅은 오렌지(`brand-soft` 바탕 + `brand-ink` 글자).

## 구성 (위에서 아래, 순서 고정)

1. 상단 줄 `hg-card__top`(높이 24px): 왼쪽 라벨 `hg-card__label`, 오른쪽 배지·더보기. 배지가 없어도 높이 유지.
2. 값 `hg-card__value`: 카드의 핵심 숫자 1개.
3. 보조 줄 `hg-card__meta`: 1줄. 없으면 비워 둠.

- 칸 사이 `space-2`, 안쪽 여백 위아래 `space-5`(2026-11-09 밀도, 20px), 옆 `space-6`(좁은 창 앱 틀 안 `space-5`). 카드 사이 `space-3`(12px, `hg-cards`). 자식에 margin 쓰지 않음.
- 모두 왼쪽 정렬. 카드 안 금액도 왼쪽.
- 나란히 놓는 카드는 `hg-cards`로 묶고 같은 구성으로 씀: 같은 높이, 값이 같은 높이에서 시작.
- 숫자만 여러 개 보여 줄 때는 카드 대신 숫자 칸 `hg-stat`(라벨 `hg-stat__label`, 값 `hg-stat__value`, 보조 `hg-stat__sub`)을 `hg-stats`로 묶음: 3열, 좁은 창(768px 미만)은 2열 + 값 17px. 값은 줄바꿈 없음. 누르면 고치는 칸은 `button.hg-stat`(hover `hairline-soft`, 포커스 테두리 `focus-ring`).

## 그림 자리 (2026-11-08 목표 카드 없앰, 지금은 쓰는 화면 없음)

- `hg-card--art` + `hg-card__art`: 오른쪽 위 56px(좁은 창 48px) 둥근 칸에 그림 1개. 그림이 있으면 배지는 빼도 됨. 상단 줄과 안에 넣은 Meter 머리는 그림 칸만큼 오른쪽을 비움.
- 사진은 칸을 꽉 채움(`hg-card__art--photo`, `object-fit: cover`), 그림이 없으면 회색 기본 자리 `hg-card__art--custom`(`hairline-soft` 바탕, `stone` 아이콘). 위젯 `hg-wg__art`, 큰 자리 `hg-art`도 같은 이름의 `--custom`, `--photo`.
- 예전 목표 카드(G-01)·목표 사진(올린 사진, 지정 사진 21장)은 2026-11-08 ADR 0007로 없앰. 클래스는 남겨 두고 새로 쓸 때 이 문서를 고침.
- 그림은 장식이라 `alt=""`. 뜻은 라벨이 전함.

## 종류

- 틴트는 뜻대로: `together` 우리 둘, `family` 양가, `goal` 저금 항목, `safety` 월급 전 확인(2026-11-09), `invest` 투자. 한 화면에 틴트 2가지까지. 틴트 위 보조 줄은 `ink-2`.
- 카드 바탕에 브랜드 색을 쓰지 않음. 달성한 저금 항목도 기본 줄에 `hg-badge--achieved`(작은 옅은 오렌지 배지)만 붙임.
- 누를 수 있는 카드는 `hg-card--raised`. `button`이나 `a`로 써도 글자색(`ink`), 글꼴, 왼쪽 정렬은 카드 그대로, 포커스 테두리 `focus-ring`(`ink`).

소비자가 주는 것: 라벨, 배지(선택), 그림(선택), 값, 보조 줄.

- 2026-11-08: 그림·아이콘 자리는 2D 플랫으로 다시 만들 때까지 빈 자리(회색 판 `hg-artslot`이나 빈 원·빈 칸). 이 문서의 3D·사진·Phosphor 그림 설명은 다시 만들 때의 주제(→ Illustrations ‘나중 과제’).
