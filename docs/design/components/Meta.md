# Meta

한 줄에 정보 여럿을 두는 방법과 작은 표시. 가운데 점(·)으로 잇지 않음.

- `hg-meta` + `hg-pair`: 이름표는 작고 흐리게(`stone`, `i`), 값은 진하게(`ink-2` 600). 묶음 사이 16px. 틴트 카드 위 이름표는 `slate`.
- `hg-tag`: 종류 표시 작은 회색 알약(`surface-alt` + `slate`, `micro`, 20px). 뜻이 영역이면 Badge 영역형을 씀.
- `hg-count`: 개수 숫자 알약(20px, `micro`). 제안 카드 머리(`surface-alt`) 안에서는 흰 바탕 + `ink`. 상단 메뉴 탭의 제안 수는 `ink` 바탕, 현재 메뉴 안에서는 흰 바탕(`hg-nav__count`).
- `hg-masked`: 금액 가리기 켜짐일 때 금액 자리 “•••”(`stone`, 글자 간격 2px). 비율·날짜·이름은 그대로. `aria-label="금액 가림"`.
- 쓰는 곳: 카드 보조 줄, 목록 보조 줄, NetWorth 회색 줄, 제안 카드 머리.
