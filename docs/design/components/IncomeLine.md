# IncomeLine

W-02 수입 한 줄(바탕 기준 2026-11-23 사용자 결정 “훨씬 낫네, 전체적으로 다 적용하고 다시 체크”, 예전 수입 카드 `IncomeCard`(2026-11-19)를 대체). 기획 → 20 W-02 6번, W-20b. 앱 `features/salary/money-in-rows.tsx` `IncomeLine`(`ListRow` 한 줄, 클래스 `hg-incomeline`). 예전 `hg-incomecard*` 클래스는 쓰지 않음(CSS는 기록으로 남김, 다음 정리 때 지움).

- 모양: 목록 아래 `hairline` 구분선 하나 + 한 줄 “이번 달 수입 3,500,000원 ›”. 이름 15px 400 `ink`(2026-11-27 ‘버튼·색 정리’: 줄 이름은 ink, 예전 `slate`), 값 17px 700 `ink`, 오른쪽 › 12px 칸(`ListRow` 값·표시 규칙). 높이 56 이상, 위아래 12, 좌우는 화면 흰색 24
- 이름: “이번 달 수입”, 날짜 없는 사람 “이번 기간 수입”, 지난 달 “{n}월 수입”
- 값: 그 사이클 내 수입 합(합쳐서면 두 사람 합), 기록이 없고 자동 기록 전이면 프로필 월급(`fallback`), 자동 기록 뒤 기록이 모두 지워졌으면 값 없이 이름만
- 줄 전체가 버튼(44px 이상) → W-20b. 파트너 탭·해제 대기는 `onOpen` 없음(누를 수 없음), 파트너 탭은 기록이 없으면 안 그림(`hideEmpty`). 금액 가리기는 기존 규칙(“•••”)
- 옮긴 것: 월급 기본값 연필·`PaydayIncomeSheet`(BottomSheet + `AmountInput`)·“+ 수입 입력하기”·최근 기록은 W-20b 맨 위의 `hg-fdhero`(이름 13 + 큰 금액 34 + `AddRow`)와 목록으로 감
- 오렌지 쓰지 않음. 다크 모드는 토큰이 처리
- + 아이콘 규칙(2026-11-19): ‘+ … 추가’류 글자 앞 +는 문자가 아니라 `AddText`/`PlusIcon` 아이콘 하나(`hg-addtext`): 16px, Phosphor bold, `currentColor`, 글자와 4px(`--space-1`). 금액 앞 +50만 원 같은 숫자 부호는 글자 그대로
