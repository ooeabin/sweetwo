# Select

목록에서 하나 고르기. 선택지가 6개를 넘거나 화면 공간이 좁을 때(그 밖에는 Selection의 카드형).

- 소비자가 주는 것: 라벨, 선택지, 현재 값.
- 닫힌 모양은 입력 칸과 같은 높이·테두리(48px `button`, `aria-haspopup="listbox"` + `aria-expanded`), 오른쪽 `chevron-down`(열리면 `chevron-up`).
- 열린 메뉴는 `hairline` 테두리 + `shadow-2`, `role="listbox"`. 고른 항목은 `surface-alt` + 굵게 + `aria-selected`.
- 좁은 창에서는 BottomSheet로 열림.

## React 래퍼 `Select`(2026-11-17, 어드민에서 먼저 씀)

브라우저 기본 `select`를 감싸지 않고 버튼 + 펼친 목록(listbox)으로 만든다(위 모양 그대로, 브라우저마다 다른 기본 화살표·목록을 쓰지 않으려고).

- `packages/ui` `Select`: 라벨(`hideLabel`이면 화면 읽기에만, 필터 줄처럼 칸이 나란할 때), 값, 선택지(`{ value, label }`), `onChange`, `disabled`, 너비(`width`), 도움말.
- 닫힌 칸: `button.hg-select` + `role="combobox"` + `aria-haspopup="listbox"` + `aria-expanded`, 이름은 라벨(`aria-labelledby`), 값은 칸 글자. 열리면 칸 테두리 `ink`(입력 칸 포커스와 같음). 꺼지면 `surface-sunk` 바탕 + `muted` 글자.
- 펼친 목록: `hg-menu hg-select__list`(`role="listbox"`, 칸 바로 아래, 칸보다 좁지 않게, 최대 280px 뒤로 스크롤). 항목 `hg-menu__item hg-select__opt`(`role="option"`): 고른 항목은 굵게 + 오른쪽 `check`(색만으로 말하지 않음, `aria-selected`), 마우스·키보드로 가리킨 항목은 `surface-alt`(`is-active`).
- 키보드: ↓/↑ 열기와 옮기기, Home/End 처음·끝, Enter·Space 고르기, Esc 닫기(값 그대로), Tab 닫기, 글자를 치면 그 글자로 시작하는 항목. 포커스는 칸에 두고 가리킨 항목은 `aria-activedescendant`. 바깥을 누르면 닫힘.
- 어드민 밀도: 칸 36px, 항목 32px 14px(`hg-admin` 안).
- 좁은 창 BottomSheet는 아직 없음(어드민은 넓은 창만). 사용자 앱에서 쓸 때 더함.
