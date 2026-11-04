# Selection

켜기·끄기(Toggle), 여러 개 고르기(Checkbox), 하나 고르기(Radio).

- 소비자가 주는 것: 라벨, 상태.
- 켜진·고른 상태는 `ink`. 꺼진 상태 테두리는 `border-control`.
- Toggle: 설정 알림처럼 바로 적용되는 것. Checkbox: 약관 동의. Radio: 한 화면 안 하나 고르기.
- 질문 화면의 하나 고르기(결혼 여부 묻기)는 카드형 `hg-option--card`(2026-11-03 지그재그 선택 카드처럼 바꿈).
  - 안 고른 카드: `surface` 바탕 + 1px `hairline` 테두리, `radius-lg`, 안쪽 16px, 높이 64px 이상. 올리면 테두리 `border-control`.
  - 왼쪽 아이콘 칸(선택, `hg-option__icon`): 36px `surface-alt` 둥근 사각(`radius-md`) + 20px `ink` Phosphor 아이콘. O-06, O-07 뒤, O-11, O-30에서 씀.
  - 가운데 `hg-option__body`: 라벨(`hg-option__label`, 16px 600) 아래 회색 1줄(`hg-help`)이나 미리보기.
  - 오른쪽 끝: 누르면 바로 다음으로 가는 카드(자동 다음)는 `chevron-right`(`hg-option__go`, `stone`). 고른 뒤 ‘다음’을 누르는 카드(O-30, 설정)는 `hg-option__mark`(24px 원): 안 고르면 `border-control` 테두리 빈 원, 고르면 `success` 원 + `on-success` 체크(2026-11-04, 체크 목록 `hg-check`와 같은 파란 원. 카드 테두리는 `ink` 그대로). 화면 읽기는 `aria-checked`(표시는 `aria-hidden`).
  - 고른 카드: 1px `ink` 테두리 + 안쪽 1px `ink` 그림자(고른 칩과 같음). 바뀔 때 `dur-fast`(‘동작 줄이기’면 없음).
  - React: `ChoiceCards` 선택지의 `icon`, 오른쪽 표시는 `go`(기본은 자동 다음이면 ›).
- 카드 안 미리보기(분담 방식의 “{나} n만 원”): 이름은 `hg-help`(작고 흐리게), 금액은 진하게, 두 묶음은 간격으로 구분. ‘추정’은 라벨 옆 `hg-tag`.
- 처음 포커스(첫 카드)는 넓은 창에서만(2026-11-03). 좁은 창은 손가락이라 포커스 테두리가 남으면 이미 고른 것처럼 보임.
- 한 화면에 카드 묶음이 여럿이면(O-63 통장마다 ‘쓰던 통장 / 새로 만들 통장’) 처음 포커스와 1~9 키 고르기는 한 묶음에만.
- 고를 수 없는 카드는 `is-disabled`(`muted` 글자) + `aria-disabled`. 이유는 카드 안 미리보기 자리에 한 줄로.
- 누르는 영역은 라벨 포함 44px 이상.

## Toggle 상태

| 상태 | 모양 |
| --- | --- |
| 꺼짐 | `border-control` 바탕 + 흰 손잡이 |
| 켜짐 | `ink` 바탕 + `on-ink` 손잡이 |
| 비활성 | 꺼짐 `hairline`, 켜짐 `ink` 35%, 라벨 `muted` |
| 포커스 | 2px `focus` 링, 바깥 2px |

- Toggle은 `button role="switch"` + `aria-checked`, 라벨 `label`로 감쌈. Checkbox·Radio는 줄에 `role="checkbox"`/`role="radio"` + `aria-checked`, 카드 묶음은 `role="radiogroup"`.
- 바뀌면 바로 적용, 저장 버튼 없음. `dur-fast`.
- React 래퍼: `Toggle`(`packages/ui`, 라벨 + 작은 도움말).
- ChoiceCards 처음 포커스(2026-11-04): 넓은 창에서 첫 카드에 주는 처음 포커스는 테두리 없이(`data-autofocus`). 키를 누르거나 포커스가 옮겨지면 보통 포커스 테두리. 들어오자마자 고른 것처럼 보이지 않게.
