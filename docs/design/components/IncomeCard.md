# IncomeCard

W-02 수입 카드(2026-11-19 사용자 결정 “수입카드 시안대로 진행”, 예전 한 줄 상자 `hg-moneybox` 대체). 참고: 카카오뱅크 MMF 박스(이름표 + 큰 금액 + 넓은 회색 버튼 + 최근 내역), Monarch 수입 줄. 기획 → 20 W-02 6번. 앱 `features/salary/money-in-rows.tsx` `IncomeCard`, 클래스는 `bundle.css` `hg-incomecard`.

- 틀(`hg-incomecard`): `surface` 바탕 + 1px `surface-alt` 테두리 + `radius-xl`(시안 24px는 토큰이 없어 기본 카드와 같은 20px), 안쪽 `space-5`. W-02 체크리스트 아래, 다 확인 상태에서도 같은 자리
- 위쪽 줄: 왼쪽 이름표 “이번 달 수입”(날짜 없는 사람 “이번 기간 수입”, `text-label` `slate`), 오른쪽 “전체 ›”(같은 글자, 기록이 1건 이상일 때만, 누르면 W-20b, 누르는 칸 44px 이상)
- 큰 금액: 기록이 있으면 이번 사이클 수입 합(`text-number-lg`, 시안 26/34 700에 가까운 토큰), 없으면 `slate` `text-title-2` “아직 적은 수입이 없어요”. 날짜 없는 사람은 화면 위 큰 금액이 이미 기간 수입이라 합을 숨기고(`hideSum`) 기록이 없을 때 안내 문장만
- 최근 기록: 위 구분선 1px, 최근 2건만(줄 높이 48px): 날짜 “11.27”(`text-body-sm` `slate`) + 종류 이름(`text-body-strong`) + 오른쪽 “+50만 원”(700)
- 자동 월급 기록(2026-11-20): 월급날 확인으로 서버가 넣은 줄(`money_in.source = payday_auto`)은 종류 이름 뒤에 작은 회색 “자동”(`hg-incomecard__auto`, `text-caption` 500 `slate`, 이름과 `space-2`) [확인 필요]. 화면 읽기는 “월급 자동”. 큰 금액·최근 2건 계산은 직접 적은 줄과 같음
- 버튼: 넓은 회색 블록 `Button secondary block`(52px) + Phosphor `plus` “수입 적기” → W-20. 파트너 탭·지난 달은 버튼 없음(`onAdd` 없음)
- 파트너 탭: 파트너의 공개 단계를 서버가 따라 기록이 없으면 카드를 안 그림(`hideEmpty`), “전체 ›”도 없음. 금액 가리기는 기존 규칙(“•••”)
- 오렌지 쓰지 않음. 다크 모드는 토큰이 처리
- + 아이콘 규칙(2026-11-19): ‘+ … 추가’류 글자 앞 +는 문자가 아니라 `AddText`/`PlusIcon` 아이콘 하나(`hg-addtext`): 16px, Phosphor bold(글자 600~700), `currentColor`, 글자와 4px(`--space-1`), inline-flex 세로 가운데. 금액 앞 +50만 원 같은 숫자 부호는 글자 그대로.
