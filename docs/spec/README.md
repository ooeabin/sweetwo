# 기획서

저장소에서 고치는 기획서 정본이에요(2026-10-14부터). 개발 중 바뀐 기획은 코드와 같은 PR에서 이 파일들을 바로 고쳐요.

- 화면 ID(A-02, W-02a 등)로 검색하면 정의를 찾을 수 있어요.
- 계산식과 화면 문구는 이 폴더가 기준이에요. 생김새는 `docs/DESIGN.md`, 코드 규칙은 `docs/DEV_GUIDE.md`.
- 페이지 사본(그림 포함): https://claude.ai/artifact/SScTBJAdLvP7tFJz3RwJWe (2026-10-25 재기획 전 내용)
- 그림(2026-11-08): 3D 그림, 목표 사진, 종류 아이콘을 모두 지우고 2D 플랫으로 다시 만들 때까지 빈 자리. 화면 표에 적힌 그림 설명은 다시 만들 때의 주제로 읽어요(→ `docs/design/assets/Illustrations.md` ‘나중 과제’).
- 줄 앞 종류 칸(2026-11-10): 2D 그림이 들어올 때까지 회색 빈 원(월급 줄, 자산·부채 종류, 자산 요약, 캘린더 일정, 알림. 2026-11-09 ‘C’의 Phosphor 아이콘 + 영역 색 원에서 바꿈). 목표 금액이 있는 체크리스트 저금 줄은 아이콘 대신 진행 원. 종류별 아이콘은 `docs/design/components/ListRow.md` ‘Lead 종류 표’가 기준이에요.
- 2026-10-25 재기획: 목표 중심, 월급 체크리스트, 9화면 온보딩(2026-10-26 출생연도·결혼한 날을 다시 물어 11화면) → `docs/adr/0003-replan-goal-checklist.md`
- 2026-11-08: 목표 탭과 ‘목표’를 없애고 월급 탭 저금 항목(목표 금액·기한, 달성 축하)으로, 온보딩 목표 고르기(O-21)·비상금 없앰 → `docs/adr/0007-goal-into-saving-line.md`
- 2026-11-10: 데스크톱 앱(Electron)을 없애고 모바일 앱(휴대폰·태블릿)만. 태블릿은 넓은 창(768px 이상) 그대로. 데스크톱 전용 화면(트레이 위젯 창, 위젯 설정 S-22, S-19 ‘업데이트 확인’, 홈 ‘PC에서도’ 띠, 웹사이트 L-02 설치 안내)은 지우지 않고 “없앰 2026-11-10, ADR 0008”로 표시 → `docs/adr/0008-drop-desktop-app.md`

- 2026-11-13: 같이 모으기와 둘의 월급 계획(v2.2). 홈 주인공 H-10 같이 모으기, 월급날 확인 한 번 + 자동 줄, 소급 없음, 날짜 없는 사람의 기간, 돈 들어왔어요·바로잡기·잔액 맞추기·쓸 곳 메모, 같이 모으기 묶음, 관리 형태 세 질문, 공개 단계 S-13 한 목록, 예외 둘(관리 형태 합치기, 분담 제안), 해제 때 내 것은 남김, PIN 선택, 위젯 v1, 순위는 두 사람 동의 때만 → `docs/adr/0009-save-together-plan.md`. 여러 탭 맨 위 ‘v2.2’ 장이 정본이고 그 아래 예전 장은 고친 점 말고 그대로

- 용어 v2.2(2026-11-13): 기획서 안 말과 사용자에게 보이는 말을 나눔.

| 기획서·코드 안 말 | 사용자에게 보이는 말 |
| --- | --- |
| 약속(둘이 정한 월급 계획) | ‘월급 계획’(‘약속’ 안 씀) |
| 손 줄(체크리스트에 넣었고 자동이 아닌 줄) | “확인할 것” |
| 자동 줄(`auto_pay`) | “자동으로 나가요”, 알약 “자동 26일”, “자동 확인”(‘이체’ 금지라 ‘자동이체’ 안 씀) |
| 못 함(`skipped` 상태) | ‘건너뜀’, “이번 달은 건너뛸게요”(예전 ‘이번 달은 못 했어요’) |
| 묶음(`saving_bundle`) | ‘같이 모으기’ |
| 관리 형태(엔진 각자/합쳐서 + 관리하는 사람) | 형태 이름 “생활비와 저금을 같이 해요” 등(08 2장) |
| 공개 단계(`plan_share`) | “모두 보여 주기 / 저금만 보여 주기 / 했어요만 보여 주기” |
| 자산 공개 ‘금액만’(DB 값 그대로) | “총액만 보여 주기” |
| 시작할 때 모은 금액(`start_saved`) | “이미 모은 금액” |
| money_in | “돈 들어왔어요” |
| saving_note | “쓸 곳 메모” |
| 바로잡기(adjust) | “모은 금액 바로잡기” |
| 경조사 kind ‘양가 행사’ | “가족 행사” |
| 결혼 상태 | “두 사람 사이”(결혼했어요 / 결혼 준비 중이에요 / 연애 중이에요 / 같이 살아요) |

- 용어(2026-11-09, 긴 말 대신 쉬운 이름): ‘쓰는 돈’ → ‘지출’, ‘들어오는 돈’·‘나가는 돈’ → ‘수입’·‘지출’, ‘우리 자산’(탭·화면 제목) → ‘자산 관리’(홈 H-04 타일 제목도 ‘자산 관리’, 2026-11-12 D2 = A, ‘우리 자산 순위’ → ‘자산 순위’, ‘우리 자산 입력하기’ → ‘자산 입력하기’, PDF ‘우리 자산 요약’ → ‘자산 요약’), ‘돈 일정’·‘돈 날짜’ → ‘금융 일정’, ‘다가오는 일정’ → ‘일정’, 자산 하위 탭 ‘한눈에’ → ‘요약’, ‘모은 기록’ → ‘저금 내역’, ‘고친 기록’ → ‘수정 내역’, ‘드린 기록’ → ‘선물 기록’, ‘받을 알림’ → ‘알림 종류’, ‘일하는 방식’ → ‘고용 형태’, ‘우리 상황’·‘우리 상황에 맞는 글’ → ‘맞춤 정보’, ‘각자 돈’ → ‘개인 지출’, ‘남는 돈’ → ‘여유 자금’, ‘모은 돈’ → ‘모은 금액’, ‘챙길 날’ → ‘경조사’, (2026-11-11) 진행 표시 ‘보낸 줄’ → ‘이번 달 체크’, ‘보낸 금액’ → ‘체크한 금액’, “n/m 보냈어요” → “n/m 체크했어요”(줄을 체크하는 행동 말 ‘다른 금액으로 보냈어요’, ‘모두 보냈어요’, ‘얼마를 보냈어요?’는 그대로). 화면 ID, 코드 이름, DB 열·enum, 경로(`/assets` 등), 분석 이벤트 이름은 그대로. DB 알림 제목은 새 마이그레이션(`20261115090000_plain_terms_noti.sql`)으로만. 순위 줄 문장(“우리 자산은 상위 몇 %일까요?”, “우리 자산 상위 n%예요”, “우리 자산은 전체 가구 중”)은 ‘우리 둘의 자산’ 뜻이라 그대로 [확인 필요]

| 파일 | 내용 |
| --- | --- |
| [01-product-overview.md](01-product-overview.md) | sweeTwo 커플 자산관리 앱 기획서 |
| [02-business-plan.md](02-business-plan.md) | 사업 계획 |
| [03-user-flow.md](03-user-flow.md) | 유저 플로우 |
| [04-brand.md](04-brand.md) | 브랜드 |
| [05-core-rules.md](05-core-rules.md) | 핵심 규칙 |
| [06-calc-allocation.md](06-calc-allocation.md) | 계산·배분 |
| [07-month-cycle.md](07-month-cycle.md) | 월 사이클 |
| [08-couple-proposal-permission.md](08-couple-proposal-permission.md) | 커플·권한(관리 형태, 공개 단계, 예외 둘, 해제) |
| [09-data-items.md](09-data-items.md) | 데이터 항목 |
| [10-screen-design.md](10-screen-design.md) | 화면 설계 |
| [11-common.md](11-common.md) | 공통 |
| [12-question-pattern.md](12-question-pattern.md) | 질문 화면 패턴 |
| [13-common-states.md](13-common-states.md) | 공통 상태 |
| [14-notifications.md](14-notifications.md) | 알림 |
| [15-login-signup.md](15-login-signup.md) | 로그인·가입 |
| [16-onboarding-1.md](16-onboarding-1.md) | 온보딩 ① 흐름 |
| [17-onboarding-2.md](17-onboarding-2.md) | 온보딩 ② 월급과 월급 계획 |
| [18-partner-join.md](18-partner-join.md) | 파트너 합류 |
| [19-this-month.md](19-this-month.md) | 홈(H-10 같이 모으기 중심, 2026-11-13) |
| [20-salary-plan.md](20-salary-plan.md) | 월급 탭: 월급 계획, 월급날 확인, 저금, 같이 모으기, 돈 들어왔어요, 분담 |
| [21-month-close.md](21-month-close.md) | 월급 전 확인(손 줄만, 2026-11-13) |
| [22-goals.md](22-goals.md) | 목표 (없앰, 바뀐 곳 표만) |
| [23-assets.md](23-assets.md) | 자산 관리 |
| [24-calendar.md](24-calendar.md) | 캘린더 |
| [25-settings.md](25-settings.md) | 설정 |
| [26-widgets.md](26-widgets.md) | 위젯 |
| [27-admin-screens.md](27-admin-screens.md) | 어드민 화면 |
| [28-website.md](28-website.md) | 웹사이트 |
| [29-tech-ops.md](29-tech-ops.md) | 기술·운영 |
| [30-sync.md](30-sync.md) | 동기화 |
| [31-security-privacy.md](31-security-privacy.md) | 보안·개인정보 |
| [32-success-metrics.md](32-success-metrics.md) | 성공 지표 |
| [33-admin.md](33-admin.md) | 어드민 |
| [34-launch-prep.md](34-launch-prep.md) | 출시 준비 |
| [35-usability-test.md](35-usability-test.md) | 사용성 테스트 |
| [36-faq.md](36-faq.md) | FAQ |
