# Drawer

메뉴 서랍(2026-11-09, GCOO 앱 홈의 ☰ 메뉴처럼, 사용자 승인). 좁은 창(768px 미만)에서 하단 탭 막대 대신 홈 머리 ☰로 여는 오른쪽 판. 넓은 창은 사이드바가 같은 일을 해서 쓰지 않음.

- 소비자가 주는 것: 화면 읽기 이름(“메뉴”, 대화상자), 줄 묶음 nav 이름(“메뉴 목록”, 대화상자와 다르게, 2026-11-11 QA 4구간 S4-20), 닫기 이름, 줄 묶음(줄마다 이름, 지금 화면인지, 누르면 할 일), 머리 도구(알림 종), 맨 아래 작은 글자(버전).
- 모양: 뒤 막(`hg-drawer-scrim`, `scrim`) 위 오른쪽에 붙은 흰 판(`hg-drawer`, `surface`, 화면 폭 80%, 최대 360px, 화면 높이 가득, `shadow-3`, 위·아래 안전 영역 띄움).
  - 머리(`hg-drawer__head`, 44px): 오른쪽 끝에 알림 종(`bell`, 새 알림이면 `brand` 점) + 닫기 ✕(`x`). 둘 다 ghost IconButton 22px `ink`. ✕는 홈 머리 ☰와 같은 자리라 같은 손가락으로 닫음.
  - 본문(`hg-drawer__body`, `nav`, 이름은 `navLabel`): 글자만 있는 줄(`hg-drawer__item`, 높이 48px, 왼쪽 안쪽 24px, 17px 500 `ink-2`). 지금 화면 줄은 `is-current` 700 `ink` + `aria-current="page"`. 아이콘·꺾쇠·배지 없음. 묶음(`hg-drawer__group`, `ul`) 사이 `hairline-soft` 선.
  - 맨 아래(`hg-drawer__foot`): `caption` `stone` “버전 1.2.0”(앱 버전을 알 때만).
- 사용자 앱 줄(19 앱 기본 틀 11번): 홈, 월급, 자산 관리, 캘린더 / 내 정보(S-11), 설정(S-10) / 우리 둘(S-12), 초대하기(파트너 합류 전만, S-12) / 공지(웹사이트 L-03, 앱 안 보기), 문의(S-19a), 도움말(S-20).
- 동작: 열리면 판에 포커스(화면 읽기 “메뉴, 대화상자”), Tab은 판 안에서 돎. 2026-11-11(QA 4구간 S4-09): 판은 body 끝에 그리고(portal), 열린 동안 뒤 화면(body의 다른 자식)은 `inert`(화면 읽기·Tab·누르기 막음) + 문서 스크롤 잠금(html에 `hg-scroll-lock`, 판 안은 `overscroll-behavior: contain`). 열린 채 넓은 창(768px 이상)이 되면 소비자가 닫음(S4-15). Esc, 뒤 막 누르기, ✕, 안드로이드 하드웨어 뒤로로 닫힘. 닫히면 연 버튼(☰)으로 포커스가 돌아감. 줄을 누르면 닫고 그 화면으로(홈에서 열면 뒤로 쌓음, 그래서 뒤로 = 홈).
- 움직임: 오른쪽에서 미끄러져 들어옴(`dur-slow`, `ease-out`) + 막이 옅게 나타남. ‘동작 줄이기’면 둘 다 없이 바로 보임.
- 오렌지는 쓰지 않음(새 알림 점만). 다크는 토큰 그대로.
- React 래퍼 `Drawer`(packages/ui): `label`, `navLabel`, `closeLabel`, `groups`(`DrawerItem[][]`: `key`, `label`, `current`, `onSelect`), `tools`, `foot`, `onClose`. 열린 동안만 그림(소비자가 `open`이면 렌더).
