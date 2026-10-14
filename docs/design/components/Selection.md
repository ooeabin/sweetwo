# Selection

켜기·끄기(Toggle), 여러 개 고르기(Checkbox), 하나 고르기(Radio).

- 소비자가 주는 것: 라벨, 상태.
- 켜진·고른 상태는 `ink`. 꺼진 상태 테두리는 `border-control`.
- Toggle: 설정 알림처럼 바로 적용되는 것. Checkbox: 약관 동의. Radio: 한 화면 안 하나 고르기.
- 질문 화면의 하나 고르기(결혼 여부 묻기)는 카드형 `hg-option--card`(고르면 2px `ink` 테두리).
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
