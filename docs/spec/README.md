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
| [08-couple-proposal-permission.md](08-couple-proposal-permission.md) | 커플·권한 |
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
| [19-this-month.md](19-this-month.md) | 홈 |
| [20-salary-plan.md](20-salary-plan.md) | 월급 탭: 월급 체크리스트와 저금 항목 |
| [21-month-close.md](21-month-close.md) | 월급 전 확인 |
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
