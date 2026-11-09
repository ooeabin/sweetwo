# ListRow

목록 한 줄. 설정 항목, 자산 항목, 파트너 활동에 씀.

- 소비자가 주는 것: 앞 요소(아이콘·Avatar·Toggle, 선택), 라벨, 보조 1줄(선택), 값(선택), 이동 표시(선택).
- 높이 56px 이상(위아래 `space-3` 12px, 2026-11-09 밀도: 한 줄 56px, 두 줄 64~68px), 세로 가운데 정렬. 값은 오른쪽 정렬 `tabular-nums`. 이름 16px 400(캘린더 고른 날 줄은 17px 500, 2026-11-09 700에서), 보조 줄 13px `stone`.
- 누르면 이동하는 줄만 화살표(`hg-chevron`)이고 줄 전체가 `button`(또는 `a`). 토글 줄은 화살표 없음.
- 여러 줄은 `hg-list`로 묶음: 흰 바탕, 1px `hairline-soft` 테두리, `radius-xl`, 행 사이 구분선 없음, 행 높이 56px 이상(2026-11-09 60px에서). 앱 틀의 맨 바깥 묶음은 옅은 그림자(`shadow-1`)를 더함(AppFrame).
- 행 앞 아이콘 칸 `Lead`(`hg-lead`, 32px 원, 2026-11-09 밀도로 40px에서): 영역 색 원 + Phosphor 아이콘 18px(2026-11-09, 아래 ‘Lead 종류 표’). 목표 금액이 있는 저금 줄은 아이콘 대신 진행 원(`progress`, 아래 ‘진행 원’). 장식이라 `aria-hidden`(줄 이름과 금액이 뜻을 말함). 사진(`photo`, `hg-lead--photo`)은 지금 쓰는 곳 없음.
- 사진 미리보기 `hg-thumb`(40px, `radius-md`, 잘라 채움): 챙길 날 드린 기록(Y-09)에서 첫 사진. 장식이라 `aria-hidden`, 사진 수는 보조 줄 “사진 3장”.

## 설정 줄

- 값 + 화살표: 오른쪽에 현재 값(`hg-listrow__value is-soft`, `slate` 400) + `hg-chevron`. 누르면 고르는 화면·BottomSheet.
- 스위치 줄: 오른쪽 Toggle(`button role="switch"` + `aria-checked`, 라벨을 `aria-labelledby`로). 줄 자체는 누르는 대상 아님, 바로 적용.
- 앞 아이콘은 20px `ink`, 보조 1줄은 지금 설정을 사실로(“월요일 오전 9시”).
- 줄만 목록(2026-11-04 F-08): `hg-list hg-list--plain`은 테두리·바탕·그림자 없이 줄만. 좌우 여백 0, 줄 높이 56px 이상(2026-11-09 64px에서), 값 17px, 보조 14px `slate`. 토스형 구역(StatBlock 아래)에서만.

- 잠긴 줄(`locked`, 2026-11-09): 고칠 수 없는 줄(각자 모드 파트너 월급 계획 W-01)은 꺾쇠 자리에 Phosphor `lock` 16px(`hg-listrow__lock`, `stone`). 누를 수 없음(div). 왜 잠겼는지는 목록 위 회색 한 줄로 알림(“{파트너}님 월급 계획이에요. 보기만 할 수 있어요”).

## Lead 종류 표 (2026-11-09)

줄 앞 칸은 2D 그림이 아니라 Phosphor 아이콘 + 영역 색 원(`hg-lead--together`·`family`·`goal`·`safety`·`invest`, 원은 틴트 바탕, 아이콘은 짝 `*-ink`). 영역 색이 없는 종류는 회색 원(`surface-alt` + `ink-2`). 한 종류 = 아이콘 하나, 표는 코드 한 곳(`packages/ui/src/components/lead-kinds.ts`, `leadOf(묶음, 종류)`)에만 두고 화면은 그 표로만 그림. 새 종류는 표에 한 줄 더하고 여기도 고침. 모르는 종류는 묶음의 기본(맨 아래 ‘모를 때’).

| 묶음 | 종류 | 아이콘 | 영역 색 | 쓰는 곳 |
| --- | --- | --- | --- | --- |
| 월급 줄 `line` | 저금(`saving`) | `piggy-bank` | `goal` | W-02, 홈 H-03, W-05(목표 금액이 있으면 진행 원), 홈 H-02·W-13 GoalRow |
| | 고정지출(`fixed`) | `receipt` | `safety` | W-02, H-03, W-05 |
| | 생활비(`living`) | `shopping-cart` | `together` | 〃 |
| | 용돈(`allowance`) | `coins` | 회색 | 〃 |
| | 직접 추가(`custom`, 모를 때) | `wallet` | 회색 | 〃 |
| 자산 `asset` | 현금성(`cash`) | `wallet` | `safety` | F-03a 묶음 타일, F-01 빈 상태 타일 |
| | 예금·적금(`deposit`) | `vault` | `safety` | 〃 |
| | 청약(`subscription`) | `house` | `invest` | 〃 |
| | 투자(`invest`) | `chart-line-up` | `invest` | 〃 |
| | 연금(`pension`) | `umbrella` | `safety` | 〃 |
| | 저축성 보험(`insurance`) | `shield-check` | `safety` | 〃 |
| | 부동산(`real_estate`) | `buildings` | `invest` | 〃 |
| | 기타(`etc`, 모를 때) | `car` | 회색 | 〃 |
| 부채 `asset`(부채는 모두 회색) | 주택(`housing_loan`) | `house` | 회색 | 〃 |
| | 신용(`credit`) | `credit-card` | 회색 | 〃 |
| | 할부(`installment`) | `shopping-bag` | 회색 | 〃 |
| | 학자금(`student`) | `graduation-cap` | 회색 | 〃 |
| | 기타 대출(`other_loan`) | `hand-coins` | 회색 | 〃 |
| | 개인 간(`personal`) | `handshake` | 회색 | 〃 |
| 우리 자산 요약 `summary` | 자산(`assets`) | `wallet` | `invest` | F-01 한눈에 아래 줄 |
| | 부채(`debts`) | `bank` | 회색 | 〃 |
| | 예상 순자산(`expected`) | `chart-line-up` | `invest` | 〃 |
| 돈 일정 `money` | 월급날(`payday`) | `money` | `invest` | Y-01 다가오는 일정, Y-04 고른 날(영역 색은 홈 H-05 날짜 칸과 같음) |
| | 월급 전 확인(`review`) | `calendar-check` | `safety` | 〃 |
| | 저금 기한(`deadline`), 쓰는 달(`goal`) | `target` | `goal` | 〃 |
| | 만기(`maturity`) | `hourglass` | `family` | 〃 |
| | 공휴일(`holiday`, 모를 때) | `flag-pennant` | 회색 | Y-04 고른 날 |
| 챙길 날 `care`(한 종류라 모두 `together`) | 생일(`birthday`) | `cake` | `together` | Y-01, Y-04 |
| | 기념일(`anniversary`) | `heart` | `together` | 〃 |
| | 명절(`seollal`, `chuseok`) | `moon-stars` | `together` | 〃 |
| | 어버이날(`parents_day`) | `flower-tulip` | `together` | 〃 |
| | 양가 행사(`event`) | `confetti` | `together` | 〃 |
| | 그 밖의 날(`custom`, 모를 때) | `gift` | `together` | 〃 |
| 알림 `noti`(기획서 14 ‘아이콘’ 이름) | `gift`, `heart` | `gift`, `heart` | `together` | N-01, N-02(32px 원 `hg-noti__icon`, 16px 아이콘) |
| | `calendar-check`, `clipboard-text` | `calendar-check` | `safety` | 〃 |
| | `receipt` | `receipt` | `safety` | 〃 |
| | `wallet` | `money` | `invest` | 〃 |
| | `house` | `house` | `invest` | 〃 |
| | `piggy-bank`, `trophy` | `piggy-bank`, `trophy` | `goal` | 〃 |
| | `shield-check`, `shield-warning`, `user-plus`, `user-minus`, `envelope-simple`(→ `envelope`), `chat-circle-text`, `megaphone`, `bell`(모를 때) | 같은 이름 | 회색 | 〃 |

- ‘+ 추가’ 같은 동작 줄은 `Lead icon="plus"`(회색 원, Y-04는 점선 원 `hg-cal__add`). 종류 표에 넣지 않음.
- 묶음 타일(`hg-pick--tiles`) 안의 Lead는 48px 원 + 24px 아이콘(타일이라 밀도 대상 아님). Meter 머리 Lead도 48px 그대로.

## 진행 원 (2026-11-09)

- `Lead progress={0~100}`: 목표 금액이 있는 저금 줄(체크리스트 W-02, 홈 H-03, W-05)의 앞 칸. 저금 아이콘 대신 앞 칸과 같은 32px 고리(`hg-lead--ring`, 2026-11-09 밀도): 굵기 `space-1`, 빈 둘레 `goal`, 채움 `goal-ink`, 가운데는 비움(다크 모드는 토큰이 바꿈).
- 값 = core `savingBar`(모은 돈 × 100 ÷ 목표 금액, 내림 정수 %, 100 상한, 모은 돈이 있으면 최소 2%). 정수만 받고 0~100으로 자름.
- 장식(`aria-hidden`). 진행은 보조 줄 “2,700만 / 1억 5,000만 원”이 글자로 말함. 그래서 이 줄들에는 이름 아래 얇은 막대를 두지 않음(줄 높이가 다른 줄과 같음).
- 목표 금액이 없는 저금 줄은 저금통 아이콘(`goal` 원).
- 진행 원을 쓰지 않는 곳: % 숫자와 막대가 줄의 주인공인 GoalRow(홈 H-02, W-13)는 저금통 아이콘 + 막대 그대로, 저금 항목 상세(W-10)는 큰 막대 그대로. 묶음 머리의 “2/4” 원은 Ring(따로).
