# Selection

켜기·끄기(Toggle), 여러 개 고르기(Checkbox), 하나 고르기(Radio).

- 소비자가 주는 것: 라벨, 상태.
- 켜진 Toggle과 고른 카드 테두리는 `ink`. 체크한 Checkbox(`hg-checkbox`)와 고른 표시 원(`hg-option__mark`)은 브랜드 오렌지 `accent-app` + `on-accent-app` 체크(2026-11-09, 체크리스트 `hg-check`와 같음). 꺼진 상태 테두리는 `border-control`.
- Toggle 이름(2026-11-15 3차 검토): 스위치(`role="switch"`)는 `aria-labelledby`로 라벨 글자만 이름, 보조 글은 `aria-describedby`(감싼 label만으로는 이름이 안 잡히는 화면 읽기가 있었음).
- Toggle: 설정 알림처럼 바로 적용되는 것. Checkbox: 약관 동의(ConsentCard), 질문 화면의 켜고 끄는 한 줄. Radio: 한 화면 안 하나 고르기.
- Checkbox 줄(`Checkbox`, `hg-checkrow`, 2026-11-10): 체크 상자 20px(`hg-checkbox`) + 12px + 글자 15px(`text-body`, `ink`), 줄 전체가 누르는 곳(높이 44px 이상), 포커스 링은 `focus-ring`. O-31 ‘매달 금액이 달라요’. 동의 묶음 안 줄은 그대로 `hg-consent__check`.
  - 2026-11-17 어드민: 브라우저 기본 체크 상자 대신 이 줄(AD-06 동의 요청 ‘금액 원값 요청’, AD-14 ‘재동의 요구’·‘법률 검토 확인’, 항목 이름 표의 ‘숨김’). 어드민 안에서는 상자 18px, 줄 32px, 글자 14px, 체크한 상자는 `ink` 채움 + `on-ink` 체크(오렌지·파랑 아님). 꺼지면(`disabled`) 글자 `muted` + 상자 테두리 `hairline`. 표 칸 안처럼 글자가 따로 보일 필요가 없으면 `hideLabel`(글자는 화면 읽기에만).
- 질문 화면의 하나 고르기(결혼 여부 묻기)는 카드형 `hg-option--card`(2026-11-03 지그재그 선택 카드처럼 바꿈. 2026-11-24 F ‘떠 있는 흰 알약’: 회색 판 카드, 고르면 흰 판 + 그림자 + 오른쪽 오렌지 체크 원, 테두리 없음, DESIGN.md).
  - 안 고른 카드(2026-11-23 ‘바탕 정리 2’): `surface-alt` 회색 판 + 테두리 없음(회색 바탕 화면 위는 흰 판), `radius-lg`, 안쪽 16px, 높이 64px 이상. 올리면 `hairline-soft` 판. 예전: `surface` + 1px `hairline` 테두리.
  - 왼쪽 그림 칸(`hg-option__icon`): 문구 앞 36px 2D 선택지 그림(`radius-md`, 바탕 없음, 화면 읽기에서 숨김). 그림 파일이 없으면 칸도 없음(2026-11-15 3차 검토 사용자 결정: 회색 빈 자리를 그리지 않고 자리도 비우지 않음). 그림 크기는 36px 그대로. 그림이 있는 선택지는 모든 화면 ID별로 Illustrations ‘선택지 그림’ 표에 모음(O-11, O-30, O-30b, O-30c, P-04, P-02a, S-11f, S-11g, S-13, S-18, O-31·P-05 공개 시트).
  - 가운데 `hg-option__body`: 라벨(`hg-option__label`, 15px 600) 아래 회색 1줄(`hg-help`)이나 미리보기.
  - 오른쪽 끝: 누르면 바로 다음으로 가는 카드(자동 다음)는 표시 없음(2026-11-17 사용자 결정: › 를 없앰, 문구 앞에 그림이 들어오는 구조. `hg-option__go`와 `ChoiceCards` `go` prop도 없앰, 고른 카드는 `ink` 테두리로 알림). 고른 뒤 ‘다음’을 누르는 카드(O-30, 설정)는 `hg-option__mark`(24px 원): 안 고르면 `border-control` 테두리 빈 원, 고르면 `accent-app` 오렌지 원 + `on-accent-app` 체크(2026-11-09, 체크 목록 `hg-check`와 같은 오렌지 원, 2026-11-04 파랑에서 바꿈. 카드 테두리는 `ink` 그대로). 화면 읽기는 `aria-checked`(표시는 `aria-hidden`).
  - 고른 카드: 1px `ink` 테두리 + 안쪽 1px `ink` 그림자(고른 칩과 같음). 바뀔 때 `dur-fast`(‘동작 줄이기’면 없음).
  - React: `ChoiceCards` 선택지의 `icon`(그림 파일 이름, 타입 `ChoiceArt`). 오른쪽 원은 `autoAdvance` 없이 고른 뒤 ‘다음’을 누르는 카드에만(자동 다음 카드는 없음).
- 카드 안 미리보기(분담 방식의 “{나} n만 원”): 이름은 `hg-help`(작고 흐리게), 금액은 진하게, 두 묶음은 간격으로 구분. ‘추정’은 라벨 옆 `hg-tag`.
- 처음 포커스(첫 카드)는 넓은 창에서만(2026-11-03). 좁은 창은 손가락이라 포커스 테두리가 남으면 이미 고른 것처럼 보임.
- 한 화면에 카드 묶음이 여럿이면 처음 포커스와 1~9 키 고르기는 한 묶음에만.
- 고를 수 없는 카드는 `is-disabled`(`muted` 글자) + `aria-disabled`. 이유는 카드 안 미리보기 자리에 한 줄로.
- 누르는 영역은 라벨 포함 44px 이상.

## Toggle 상태

| 상태 | 모양 |
| --- | --- |
| 꺼짐 | `border-control` 바탕 + 흰 손잡이 |
| 켜짐 | `ink` 바탕 + `on-ink` 손잡이 |
| 비활성 | 꺼짐 `hairline`, 켜짐 `ink` 35%, 라벨 `muted` |
| 포커스 | 2px `focus-ring`(`ink`) 링, 바깥 2px |

- Toggle은 `button role="switch"` + `aria-checked`, 라벨 `label`로 감쌈. Checkbox·Radio는 줄에 `role="checkbox"`/`role="radio"` + `aria-checked`, 카드 묶음은 `role="radiogroup"`.
- 서버에 저장하는 Toggle(2026-11-06): `onChange`가 Promise를 돌려주면 끝날 때까지 누른 쪽으로 바로 보여 주고(`aria-busy`) 다시 누르기를 막음. 실패해서 값이 그대로면 원래대로 돌아감.
- 바뀌면 바로 적용, 저장 버튼 없음. `dur-fast`.
- React 래퍼: `Toggle`(`packages/ui`, 라벨 + 작은 도움말).
- ChoiceCards 처음 포커스(2026-11-04): 넓은 창에서 첫 카드에 주는 처음 포커스는 테두리 없이(`data-autofocus`). 키를 누르거나 포커스가 옮겨지면 보통 포커스 테두리. 들어오자마자 고른 것처럼 보이지 않게.
