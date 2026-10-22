# PageHeader

상세 화면 머리. 뒤로 + 제목 + 동작 1개(선택). 목표 상세, 월급 플랜 상세, 알림, 설정 하위 화면.

- 소비자가 주는 것: 제목, 보조 1줄(선택), 동작(선택: 더보기 IconButton 또는 고스트 버튼 1개).
- 높이 56px 이상, 세로 가운데 정렬. 좁은 창(모바일 앱): 왼쪽 뒤로 IconButton `--ghost` + `chevron-left`(`aria-label="뒤로"`, `hg-pagehead__icon`).
- 넓은 창(데스크톱 앱): 꺾쇠 아이콘 대신 제목 위에 돌아갈 화면 이름 “‹ 설정”(`hg-pagehead__crumb`, 13px 600 `slate`, 마우스 올리면 `ink`). 화면 읽기는 “뒤로, 설정”. 돌아갈 곳이 정해지지 않은 화면(브라우저 기록으로 돌아감)은 “‹ 이전”.
- 제목 `title-3`(18px 600) 왼쪽 정렬, 한 줄 말줄임, `h1`. 보조 줄은 `caption` `stone`.
- 오른쪽 동작은 1개만: ⋯(Menu로 수정·지우기) 또는 “수정”. 주 버튼은 두지 않음.
- AppFrame 상단 줄(날짜 + 큰 제목)은 메뉴 첫 화면용, PageHeader는 그 아래 단계 화면용. 질문 흐름은 QuestionLayout.
- Esc = 뒤로.
- React 래퍼 `PageHeader`(packages/ui): `title`, `sub`, `backLabel`(화면 읽기 “뒤로”), `backTo`(넓은 창에 보이는 돌아갈 화면 이름: 설정, 도움말, 내 문의, 데이터, 내 정보, 가이드 모아보기, 목표, 우리 자산, 월급 플랜, 이번 달), `onBack`, `action`(⋯ `Menu` 등).
