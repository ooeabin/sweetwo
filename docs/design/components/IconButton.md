# IconButton

아이콘만 있는 둥근 버튼. 뒤로, 알림, 더보기, 달력 넘기기, 닫기, 금액 가리기.

## 뒤로(`hg-back`, 2026-11-10)

- 모든 뒤로 꺾쇠를 하나로: 로그인(A-02 `hg-auth__back`), 앱 틀 ‹ 홈으로(`hg-mhead__back`), PageHeader(`hg-pagehead__icon`), 질문 화면(`hg-q__back`, ChapterBar), 좁은 창 알림 화면.
- 40×40px 누르는 자리(테두리·바탕 없음, 누르면 `surface-alt`), Phosphor `chevron-left` 24px `ink`, 포커스 링 `focus-ring`.
- 꺾쇠 선(2026-11-26 사용자 결정 ‘머리 B안’): `hg-back` 안의 `chevron-left`만 Phosphor **Regular**(굵기 16/256, 24px에서 1.5px). 다른 아이콘은 Bold 그대로. `bundle.css` ‘머리 B안’ 묶음.
- 좁은 창에서 아이콘 칸 왼쪽 = 화면 왼쪽 16px(누르는 자리는 8px부터). 넓은 창의 글자 뒤로(“‹ 이전”, “‹ 설정”)는 그대로.

- 소비자가 주는 것: 아이콘, `aria-label`(필수), 크기, 변형.
- 누르는 칸(2026-11-16): 36px·32px 아이콘 버튼도 보이지 않는 44px 칸을 덧댐(`::after`, 어드민 제외, 알림 점 버튼 제외).
- 크기: 기본 36px, `--sm` 32px, `--lg` 44px(좁은 창에서 누르는 대상은 44px).
- 변형: 기본(흰 바탕 + `hairline` 테두리), `--ghost`(테두리 없음, 목록·카드 안), `--ink`(검정). 화면의 떠 있는 추가 버튼은 IconButton이 아니라 `hg-fab`(브랜드 오렌지, AppFrame, 2026-11-09).
- 켜고 끄는 버튼은 `is-on` + `aria-pressed`: 켜지면 `ink` 바탕.
- 새 알림은 `--dot`(`brand` 점). 숫자는 쓰지 않음. 점은 그림이라 화면 읽기가 모름: 점은 버튼 상자가 아니라 아이콘 오른쪽 위 어깨 기준(2026-11-16): 위 1px·아이콘 오른쪽 끝에서 안쪽 7px, 아이콘이 20px이 아니면 `--dot-icon`(머리 22px)을 줌. 테두리 2px은 놓인 바탕색 `--dot-ring`(기본 `surface`, 홈 머리 `surface-alt`). 점이 있으면 `label`에 함께 적음(알림 종 “알림, 새 알림이 있어요”, 2026-11-11 QA 4구간 S4-06).
