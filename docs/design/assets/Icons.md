# Icons

Phosphor 아이콘(MIT 라이선스) 49개. 굵은 둥근 선(bold)과 채운 모양(fill)이 짝으로 있음. 256 격자, 둥근 끝. 파일 색은 `ink`(#1c1b19) 한 가지.

- 기본은 굵은 선(`<이름>.svg`). 채운 모양(`<이름>-fill.svg`)은 지금 선택된 자리에만: 사이드바 현재 메뉴, 하단 독 현재 칸, 켜진 상태를 보여 줄 때(`is-filled`).
- 화면에서는 `hg-ico`(CSS mask, bundle.css에 SVG를 data URI로 넣어 둠)로 써서 글자 색을 따라가게 함. 현재 메뉴, 독 칸 안에서는 자동으로 채운 모양으로 바뀜. 파일은 원본 보관용.
- 크기 16(표 안, 배지 옆), 20(목록, 버튼 안), 24(사이드바, 하단 독, 떠 있는 추가 버튼).
- 색은 글자색 그대로(`ink`, `slate`, `stone`). 브랜드 오렌지, 영역색으로 칠하지 않음.
- 아이콘만으로 뜻을 전하지 않음: 라벨 또는 `aria-label`을 같이 둠.
- 필요한 아이콘이 여기 없으면 같은 Phosphor 세트에서 bold와 fill을 함께 추가. 새 아이콘은 클래스 이름을 Phosphor 이름 그대로 씀.
- 클래스 이름은 지금 것을 그대로 씀(바꾸지 않음). 아래 표가 클래스와 Phosphor 원래 이름의 짝.
- 뒤로는 모든 화면 `chevron-left`(꺾쇠 <). `arrow-left`는 뒤로에 쓰지 않음. 화면 모드는 `sun`, `moon`.
- `apple-logo`, `windows-logo`는 웹사이트 다운로드 버튼과 OS 표시에만. 브랜드 로고라 모양을 바꾸지 않음.
- 빈 상태, 카테고리, 축하 같은 큰 자리 그림은 이 아이콘이 아니라 실사 제품 사진(README ‘그림’ 장).

## 클래스와 Phosphor 이름

| 클래스 | Phosphor 이름 | 새로 쓰는 곳 |
| --- | --- | --- |
| `hg-ico--apple-logo` | `apple-logo` | 웹사이트 Mac용 다운로드 |
| `hg-ico--arrow-left` | `arrow-left` |  |
| `hg-ico--arrow-right` | `arrow-right` |  |
| `hg-ico--bell` | `bell` |  |
| `hg-ico--calendar` | `calendar-blank` |  |
| `hg-ico--camera` | `camera` |  |
| `hg-ico--check` | `check` |  |
| `hg-ico--chevron-down` | `caret-down` |  |
| `hg-ico--chevron-left` | `caret-left` |  |
| `hg-ico--chevron-right` | `caret-right` |  |
| `hg-ico--chevron-up` | `caret-up` |  |
| `hg-ico--circle-alert` | `warning-circle` |  |
| `hg-ico--circle-help` | `question` |  |
| `hg-ico--copy` | `copy` |  |
| `hg-ico--delete` | `backspace` |  |
| `hg-ico--dots-six-vertical` | `dots-six-vertical` | 순서 바꾸기 손잡이(ReorderList) |
| `hg-ico--download` | `download` | 웹사이트 다운로드 버튼 |
| `hg-ico--ellipsis` | `dots-three` |  |
| `hg-ico--envelope` | `envelope` | 문의 메일, 이메일 |
| `hg-ico--eye` | `eye` |  |
| `hg-ico--eye-off` | `eye-slash` |  |
| `hg-ico--fingerprint` | `fingerprint` | Touch ID로 풀기 |
| `hg-ico--flag-pennant` | `flag-pennant` | 직접 만든 목표의 회색 기본 그림 |
| `hg-ico--gift` | `gift` |  |
| `hg-ico--house` | `house` |  |
| `hg-ico--image` | `image` |  |
| `hg-ico--info` | `info` |  |
| `hg-ico--link` | `link` | 초대 링크, 링크 복사 |
| `hg-ico--list-filter` | `funnel-simple` |  |
| `hg-ico--loader-circle` | `circle-notch` |  |
| `hg-ico--lock` | `lock` |  |
| `hg-ico--minus` | `minus` |  |
| `hg-ico--moon` | `moon` |  |
| `hg-ico--paperclip` | `paperclip` | 파일 첨부(FileAttach) |
| `hg-ico--pencil` | `pencil-simple` |  |
| `hg-ico--piggy-bank` | `piggy-bank` |  |
| `hg-ico--plus` | `plus` |  |
| `hg-ico--search` | `magnifying-glass` |  |
| `hg-ico--settings` | `gear-six` |  |
| `hg-ico--shield-check` | `shield-check` | 웹사이트 안심 4가지, 보안 안내 |
| `hg-ico--sun` | `sun` |  |
| `hg-ico--target` | `target` |  |
| `hg-ico--trash-2` | `trash` |  |
| `hg-ico--trending-up` | `trend-up` |  |
| `hg-ico--undo-2` | `arrow-u-up-left` |  |
| `hg-ico--user` | `user` |  |
| `hg-ico--wallet` | `wallet` |  |
| `hg-ico--windows-logo` | `windows-logo` | 웹사이트 Windows용 다운로드 |
| `hg-ico--x` | `x` |  |
