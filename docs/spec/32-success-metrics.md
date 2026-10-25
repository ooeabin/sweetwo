# 성공 지표

핵심 지표는 ‘월급 체크를 한 부부 수(월)’. 단계별 지표로 온보딩(9화면) → 첫 체크 → 배우자 초대·합류 → 매달 체크리스트 → 목표 진행 → 리텐션 → 유료 전환을 보고, 이벤트는 금액 원값 없이 구간으로만 수집함. 2026-10-25 재기획(`docs/adr/0003-replan-goal-checklist.md`)으로 월말 정리, 제안, 월급 나누기, 첫 주 할 일, 재정 진단 지표는 없앰. 목표치는 모두 출시 전 가설 [확인 필요], 첫 3개 사이클 코호트 확인 후 재설정.

## 1. 핵심 지표 (North Star)

**월급 체크를 한 부부 수 (월)** [확인 필요]

- 정의: 사이클(기준일 \~ 다음 기준일 전날)마다 `checklist_line_checked`가 1건 이상인 couple\_id 수. 각자 관리면 두 사람 중 한 사람만 체크해도, 합쳐서 관리면 누가 체크해도 셈. 대신 체크 포함
- 월 귀속: 부부마다 기준일이 달라 체크리스트 이름의 월(‘{기준일의 월}월 월급’) 기준으로 묶음. 각자 관리에서 두 사람 기준일이 다르면 먼저 시작한 사람 체크리스트의 월 기준 [확인 필요]
- 포함: 월말 확인(W-05)에서 한 체크. 제외: ‘이번 달은 못 했어요’만 누른 사이클
- 왜: 체크 = 분배표대로 나눴는지 확인 + 저금이 목표에 쌓이는 유일한 지점. 수기 입력 앱에서 데이터가 살아 있는지 + 부부가 매달 정한 대로 돈을 나누는지를 함께 보여줌
- MAU를 쓰지 않는 이유: 매일 기록 없는 설계(월급날 체크 1\~2분, 월말 확인 30초)라 접속 빈도는 가치와 무관
- 보조 분해: 연결 부부 비중, 월급 관리 방식(각자 / 합쳐서), 사이클 끝에 ‘다 했어요’인 비율, 대신 체크 비율

## 2. 단계별 지표

| 지표 | 정의(계산식) | 초기 목표치(가설) | 보는 이유 |
| --- | --- | --- | --- |
| 온보딩 완료율 | O-60 ‘시작할게요’ 사용자 ÷ O-10 ‘시작할게요’ 사용자 (초대받은 배우자 제외) | 80% [확인 필요] | 9화면 안에 첫 목표와 분배표까지 가야 가치 체험 시작 |
| 온보딩 소요 시간 | O-10 → O-60 중앙값 (이어하기 포함, 비활성 30분 초과 구간 제외) | 3분 이하 [확인 필요] | 약 2분·9화면 설계 검증 |
| 첫 체크 완료율 | 첫 체크리스트 생성(O-60 직후) 후 7일 안에 1줄 이상 체크한 사용자 ÷ 첫 체크리스트가 생긴 사용자 | 70% [확인 필요] | 분배표가 실제로 보내고 체크하는 행동으로 이어지는지 |
| 첫 체크리스트 다 함 | 첫 사이클이 끝날 때 ‘다 했어요’인 체크리스트 ÷ 첫 체크리스트 | 50% [확인 필요] | 첫 달에 분배표 전체를 따라가는지 |
| 월별 체크리스트 완료율 | 사이클이 끝날 때(다음 기준일 0시) ‘다 했어요’인 체크리스트 ÷ 그 사이클 체크리스트. 줄 기준 보조: 체크한 줄 ÷ 전체 줄(남는 돈 제외) | 60% (줄 기준 80%) [확인 필요] | 습관이 유지되는지. 월말 확인(W-05) 효과는 W-05에서 한 체크 비율로 따로 봄 |
| 저금 줄 체크율 | 사이클이 끝날 때 체크한 저금 줄 ÷ 전체 저금 줄 | 80% [확인 필요] | 목표에 실제로 돈이 쌓이는지(‘못 함’은 목표에 더하지 않음) |
| 목표 진행 | 기한이 있는 1순위 목표 중 예상 달성일이 기한 안인(‘지연’ 아닌) 비율, 사이클마다 1순위 목표 모은 돈이 늘어난 부부 비율 | 지연 아님 60%, 늘어난 부부 70% [확인 필요] | 목표가 주인공인지. 저금 줄 금액이 월 필요액보다 적거나 ‘못 함’이 쌓이면 지연 |
| 목표 달성 | 사이클마다 G-05에 도달한 목표 수, 계획 대비(`early` / `on_time` / `late`) | 비교만(목표치 없음) | 달성 뒤 다음 목표로 이어지는지 |
| 배우자 초대율 | O-06 ‘초대하기’ 또는 온보딩 완료 후 7일 안에 초대 발급(O-07, 홈 H-06, 설정 S-12 ‘부부 정보’)한 사용자 ÷ 온보딩 완료 사용자 | 70% [확인 필요] | 둘이 같이 쓰는 것이 핵심 차별점. O-06에서 바로 초대한 비율은 따로 봄 |
| 배우자 합류율 | 초대 발급 후 7일 안에 합류 완료(→ 배우자 합류) ÷ 초대 발급 (재발급은 첫 발급 기준) | 50% [확인 필요] | 초대 유효기간 7일과 일치. 합류해야 배우자 체크리스트·대신 체크가 작동 |
| 합류 소요 시간 | `invite_sent` → `partner_joined` 중앙값 | 24시간 이내 | 휴대폰 초대 → 앱 설치 → 합류(약 7화면·1\~2분) 동선 검증 |
| M1 유지 | 첫 사이클에 체크한 부부 중 바로 다음 사이클에도 1줄 이상 체크한 비율 | 70% [확인 필요] | 첫 체크가 일회성인지 |
| M3 유지 | 첫 사이클에 체크한 부부 중 3번째 사이클에도 체크한 비율 | 50% [확인 필요] | 첫 분기(3사이클)까지 남는지 |
| 유료 전환율 | 3사이클 이상 체크한 부부 중 프리미엄 구독 부부 비율 (부부 단위, 한 명 구독 = 둘 다 적용) | 5% | 핵심 기능은 무료(→ 사업 계획 6장)라 전환은 체크 습관 이후에 봄 |
| 페이월 전환율 | `paywall_viewed` 후 30일 안에 `subscription_started` ÷ 페이월 본 부부 | 8% | 어느 진입점이 파는지. 진입점은 유료화 시점에 다시 정함 [확인 필요] |
| 위젯 부부 체크 완료율 | 위젯을 둔(widget\_added) 부부의 월별 체크리스트 완료율 vs 위젯 없는 부부, 같은 가입 주차 코호트 | 비교만(목표치 없음) | 위젯이 체크 습관에 도움이 되는지 |
| 비교 참여율 (출시 후, 2단계) | 통계 참여를 두 사람 모두 켠 부부 ÷ 연결 부부 | 30% | 그룹별 100쌍에 닿는 속도(→ 계산·배분 7장). 비교 기준(연령대 등)은 다시 정함 [확인 필요] |

## 3. 위험 신호 지표

| 신호 | 정의 | 경보 기준(가설) | 볼 것·대응 |
| --- | --- | --- | --- |
| 온보딩 이탈 화면 | 화면별 `onboarding_step_viewed` 중 다음 화면에 도달 못 한 비율, 상위 5개 | 한 화면 이탈 10% 초과 | 금액 질문(O-23·O-31·O-50) 우선 점검. 문구·추천값·‘잘 모르겠어요’ 사용률 |
| 첫 체크 없음 | 첫 체크리스트 생성 후 7일 안에 체크 0줄인 사용자 비율 | 40% 초과 [확인 필요] | 월급날 알림 열람률, 첫 체크리스트 기준(지난 월급날로 만듦) 이해도, H-03 카드 노출 |
| 체크리스트 방치 | 사이클이 끝날 때 체크한 줄이 절반 미만인 체크리스트 비율 | 30% 초과 [확인 필요] | 월말 확인(W-05) 알림 열람률, 기준일 위치(월급날 대비), 줄 수 |
| 저금 ‘못 함’ | 사이클이 끝날 때 ‘못 함’인 저금 줄 ÷ 전체 저금 줄 | 30% 초과 [확인 필요] | 분배표 저금이 과한지(남는 돈 음수 비율과 교차), W-02a 다른 금액 사용률 |
| 분배표 모자람 | 남는 돈이 음수인 분배표 비율 | 20% 초과 [확인 필요] | O-50 추천값(고정지출·생활비 25%, 용돈 10%) 맞는지, “30만 원이 모자라요” 뒤 행동 |
| 되돌리기 | 상대가 고친 분배표·목표 값을 7일 안에 되돌린 비율 | 15% 초과 [확인 필요] | 갈등 신호. 변경 알림 문구, 고친 항목 종류. 연결 해제와 교차 확인 |
| 연결 해제 | 월 `unlink_requested` 부부 ÷ 연결 부부, 14일 기본안 적용 비율 | 월 1% 초과 | 직전 60일 되돌리기 횟수와 교차 확인 (사유는 묻지 않음) |
| 미합류 고착 | 온보딩 완료 30일 후에도 미합류인 부부 비율 (초대 리마인드 2회·코드 만료 포함) | 40% 초과 | 혼자 쓰는 가치 vs 초대 동선(O-06 ‘나중에 할게요’ 비율, 홈 H-06 초대 한 줄 닫기 비율) |
| 알림 피로 | 알림 종류별 열람률, 월 상한(메일 6회) 도달 사용자 비율, 종류별 알림 끄기 수(S-14) | 열람률 10% 미만 또는 상한 도달 30% 초과 | 급하지 않은 알림 우선순위 조정 |
| 브라우저 로그인 이탈 | 데스크톱·모바일 login\_started 중 login\_completed 없이 끝난 비율(취소·시간 초과·앱 종료 포함), method별 | 20% 초과 | 딥링크 복귀 실패(브라우저 앱 열기 확인), 제공자별 동의 화면, A-03 ‘다시 열기’ 사용률, login\_failed reason 분포 |

## 4. 이벤트 정의

### 4-1. 네이밍 규칙

- snake\_case `객체_동작`, 동작은 과거형: `_viewed` `_started` `_completed` `_sent` `_checked` `_saved`
- 화면 ID는 이벤트 이름에 넣지 않고 `screen_id` 속성으로 (예: `onboarding_step_viewed` + `screen_id=O-31`)
- 사용자 행동 1회 = 이벤트 1건. 서버가 확정하는 상태 변화(체크리스트 생성·닫힘, 목표 지연, 해제 확정)는 서버 이벤트(`source=server`)
- 선택지 값은 영문 코드로 고정 (예: 각자 `separate` / 합쳐서 `combined`)
- 금액은 `_band` 접미사 구간 속성만 (5장)

### 4-2. 공통 속성

| 속성 | 값 | 비고 |
| --- | --- | --- |
| user\_id | 가명 내부 ID | 로그인 계정·이메일과 분리 |
| couple\_id | 부부 공간 가명 ID | 해제 후 혼자 쓰기도 기존 couple\_id 유지, 새로 초대하면 새 ID |
| role | `starter`(먼저 시작) / `partner`(초대받아 합류) |  |
| couple\_state | `unjoined` 미합류 / `linked` 연결 / `unlink_pending` 해제 대기 / `solo` 혼자 쓰기 | → 핵심 규칙 › 부부·권한 |
| marriage\_state | `married` 했어요 / `preparing` 준비 중이에요 | O-11 답 [확인 필요] |
| salary\_mode | `separate` 각자 / `combined` 합쳐서 | O-30, 설정에서 바뀌면 바뀐 값 [확인 필요] |
| platform | `desktop` / `ios` / `android` | 웹사이트 이벤트는 site |
| os | `windows` / `macos` / `ios` / `android` |  |
| app\_version | 앱 빌드 버전 |  |
| cycle\_id | 사이클 ID (체크리스트 주인 + 기준일) | 첫 사이클은 `cycle_first=true` |
| plan\_tier | `free` / `premium` | 부부 단위 |
| client\_time / server\_time | 기기 시각 / 수신 시각 | 오프라인 저장 후 동기화 전송 대비 |
| source | `client` / `server` |  |
| utm\_source, utm\_medium, utm\_campaign | 웹사이트 유입 UTM 값 | 웹사이트 이벤트에만 붙임. 스토어·데스크톱 설치 경로는 가입 이벤트까지 이어지지 않음(스토어 캠페인 값은 각 스토어 콘솔에서 봄). source(client / server)와는 다른 속성 |

### 4-3. 로그인·온보딩·합류

| 이벤트 | 발생 시점(화면 ID) | 주요 속성 |
| --- | --- | --- |
| app\_first\_launch | 설치 후 앱 첫 실행(A-01). 데스크톱은 첫 로그인 딥링크 도착 때, 모바일은 첫 실행 때 전송 | download\_id(L-02가 발급해 브라우저 로그인 딥링크로 넘긴 값, 없으면 null), os, app\_version |
| login\_started | A-02 소셜 버튼 | method(kakao / google / apple), entry(first\_run / revisit / invite / session\_expired), flow(browser) |
| login\_completed | 제공자 로그인 후 앱 복귀(A-03 딥링크·앱 링크) (서버) | method, is\_new\_account, wait\_sec(브라우저 로그인 대기 시간), reopened(A-03 ‘다시 열기’ 사용) |
| login\_failed | A-02·A-03 예외 | method, reason(cancelled / timeout / provider\_error / email\_conflict / request\_mismatch / browser\_open\_failed) |
| signup\_completed | A-05 ‘동의하고 계속하기’ 계정 생성 (서버) | method, email\_source(provider / manual: A-04 직접 입력), marketing\_opt\_in, role |
| onboarding\_started | O-10 ‘시작할게요’ [확인 필요] | entry(`direct` / `invite_link`) |
| onboarding\_step\_viewed | O-10\~O-60, 배우자 합류 P 화면 각 화면 표시 | screen\_id, flow(`starter` / `partner`), required, marriage\_state |
| onboarding\_step\_completed | 각 화면 ‘다음’ | screen\_id, answer(`input` / `estimate` / `none`), duration\_sec, changed\_after\_back |
| onboarding\_step\_skipped | O-06 ‘나중에 할게요’ | screen\_id |
| onboarding\_resumed | “이어서 할까요?” | screen\_id, hours\_since\_last |
| onboarding\_completed | O-60 ‘시작할게요’ | duration\_sec, has\_estimate, goals\_count, first\_goal\_template, salary\_mode, income\_band, split\_left\_band(남는 돈 구간, 모자라면 `short`), split\_edited(O-50 추천값을 고쳤는지), no\_income(‘지금은 월급이 없어요’) |
| invite\_sent | O-07, 홈 H-06, 설정 S-12 ‘부부 정보’ | channel(`code` / `link` / `kakao`), entry(`onboarding` / `home` / `settings`), issue\_seq(재발급 회차) |
| invite\_accepted | P-01 코드·링크 확인 | hours\_since\_sent, channel |
| invite\_link\_opened | sweetwo.kr/i/{코드}가 앱이 아닌 웹사이트 초대 페이지로 열림(앱이 없는 기기) | choice(open\_app / store / download), os |
| partner\_joined | 합류 완료(→ 배우자 합류) | hours\_since\_invite, mid\_cycle, salary\_mode, moved\_records(혼자 쓰던 기록을 옮겼는지) |

### 4-4. 월급 체크리스트

| 이벤트 | 발생 시점(화면 ID) | 주요 속성 |
| --- | --- | --- |
| checklist\_generated | 기준일 0시, 첫 사이클은 O-60 직후, 배우자 합류 직후 (서버) | cycle\_type(`first` / `regular` / `extended`(해제 대기 중)), owner(`self` / `joint`), lines\_count, saving\_lines\_count |
| checklist\_line\_checked | W-02, W-05, 홈 H-02 목표 이번 달 줄, 홈 H-03 줄 체크 | line\_kind(`saving` / `fixed` / `living` / `allowance` / `custom`), result(`as_planned` / `different`), diff\_band, checked\_by(`self` / `on_behalf` / `joint`), entry(`w02` / `w05` / `home` / `widget`), days\_from\_payday |
| checklist\_line\_unchecked | 체크 칸을 다시 누름, Toast ‘되돌리기’ | line\_kind, minutes\_since\_checked, entry(`checkbox` / `toast`) |
| checklist\_line\_skipped | W-05 ‘이번 달은 못 했어요’, W-02a 0원 | line\_kind |
| checklist\_completed | 남는 돈 줄을 뺀 모든 줄 체크(W-02 끝 “다 보냈어요”) | hours\_since\_generated, checked\_by\_partner\_count |
| month\_check\_viewed | W-05 열림 | entry(`notification` / `home`), open\_lines\_count |
| checklist\_closed | 다음 기준일 0시 (서버) | done(‘다 했어요’였는지), checked\_ratio\_band(`<50` / `50-99` / `100`%), missed\_saving\_lines, missed\_saving\_band |
| split\_saved | W-01 ‘저장’ (O-50은 onboarding\_completed로) | changed\_lines\_count, editor(`self` / `partner`: 각자 관리에서 배우자 분배표를 고침), left\_band, reset\_to\_recommended, entry(`home` / `goal_detail` / `settings`) |
| salary\_mode\_changed | 설정에서 월급 관리 방식 바꿈 | from, to(`separate` / `combined`) |

### 4-5. 목표·우리 자산·챙길 날

| 이벤트 | 발생 시점(화면 ID) | 주요 속성 |
| --- | --- | --- |
| goal\_created | O-21\~O-24, G-03 | template\_id, goal\_kind(`once` / `yearly` / `monthly`), owner(`joint` / `me`), target\_band, has\_amount(금액을 정했는지), recommended(O-11 준비 중 추천으로 고른 결혼 비용) |
| goal\_amount\_set | 목표 카드·H-06 “금액 정하기” → G-03 금액 화면 | template\_id, target\_band, entry(`home` / `goals`) |
| goal\_money\_moved | G-02 직접 넣기·꺼내 쓰기 | direction(`deposit` / `withdraw`), amount\_band, goal\_kind |
| goal\_delayed | 예상 달성일이 기한보다 늦어져 ‘지연’ 배지가 붙음 (서버) | template\_id, months\_late\_band, cause(`short_line` / `missed_line`) |
| goal\_achieved | G-05 | template\_id, months\_taken, vs\_plan(`early` / `on_time` / `late`) |
| asset\_added | F-03 저장 | kind(`account` / `invest` / `real_estate` / `debt` 등), entry(`home` / `assets` / `palette`), is\_first |
| fact\_value\_changed | 설정 S-11 월급, 자산·부채 화면 | field(`income` / `payday` / `asset` / `debt`), change\_band(변동률 `<5` / `5-20` / `20+`%), source\_screen |
| event\_recorded | Y-08 챙길 날 기록 | event\_type(`birthday` / `holiday` / `anniversary` / `family_event` / `etc`) [확인 필요], amount\_band, vs\_budget(`under` / `on` / `over`), is\_secret(서프라이즈면 event\_type 미전송) |

### 4-6. 둘이 같이 고치기

제안·승인은 없음. 누구나 바로 고치고 상대에게 알림, 고친 사람에게 Toast ‘되돌리기’(→ 핵심 규칙 › 부부·권한).

| 이벤트 | 발생 시점(화면 ID) | 주요 속성 |
| --- | --- | --- |
| shared\_item\_changed | 공동 항목을 고쳐 상대에게 알림이 감 | item\_type(`split` / `goal` / `goal_priority` / `salary_mode` / `care_day`), linked(연결 부부만 보냄) |
| change\_reverted | Toast ‘되돌리기’, 항목 상세 ‘변경 기록’에서 되돌리기 | item\_type, entry(`toast` / `history`), reverted\_whose(`self` / `partner`), hours\_since\_change |

### 4-7. 연결 해제·알림·구독·위젯

| 이벤트 | 발생 시점(화면 ID) | 주요 속성 |
| --- | --- | --- |
| unlink\_requested | S-12 자산 정리 안 전송 | split\_plan(`default` / `custom`), linked\_months |
| unlink\_countered | S-12 상대 ‘다르게 정리하기’ | — |
| unlink\_resolved | 상대 동의 / 다르게 정리하기 합의 / 14일 기본안(서버) / 요청자 취소 | path(`agreed` / `counter_agreed` / `timeout` / `canceled`), days\_pending, exported\_data |
| notification\_sent | 월급날 오전 9시, 다음 월급날 3일 전 오후 8시(월말 확인), 배우자가 고침, 챙길 날, 주간 요약, 초대 리마인드 (서버) | type, channel(`os` / `email` / inapp), cap\_scope(`in_cap` / `out_of_cap`), cap\_used(월 누적) |
| notification\_opened | 알림 클릭 → 진입 | type, channel, minutes\_to\_open, landing\_screen |
| paywall\_viewed | 프리미엄 기능 진입. 진입점은 유료화 시점에 다시 정함 [확인 필요](예전 진입점 중 월말 정리 심화, 계획 다시 세우기 비교는 없앰). 유료화 시점부터 수집 | entry, cycles\_checked |
| subscription\_started | 설정 › 구독 결제 완료 | entry, cycles\_checked, days\_since\_signup |
| subscription\_canceled | 설정 › 구독 해지, 연결 해제로 상대 무료 전환 | reason\_path(`user` / `unlink`), months\_subscribed |
| widget\_added | 위젯을 처음 놓음(트레이 아이콘 켜짐 포함) | widget(tray / wg01\~wg05), size(small / medium / large / lock), amounts\_shown |
| widget\_tapped | 위젯 누름 → 딥링크 진입 | widget, element, landing\_screen, app\_was\_running |
| peer\_stats\_viewed | F-08 지표 카드 표시 (출시 후) | metric(net\_worth / saving\_rate / saving\_amount / emergency\_months / debt\_ratio), group\_level [확인 필요], source(public / app) |
| peer\_stats\_consent\_changed | F-08 참여 안내, 설정 S-18 통계 참여 토글 (출시 후) | state(on / off), entry(f08 / settings), couple\_both\_on |
| profile\_photo\_changed | S-11e 저장, S-11 ‘사진 지우기’ | action(set / remove) |
| account\_delete\_requested | S-18b 삭제 확인 | couple\_state, exported\_before |
| account\_restored | 유예 중 재로그인 ‘취소하고 계속 쓰기’ (서버) | days\_pending, was\_linked |
| data\_exported | S-18 내보내기 끝 | format(csv / pdf\_yearly) [확인 필요], scope(mine / joint), result(done / failed / async) |
| trash\_restored | S-21 되살리기, 되돌리기 토스트 | item\_type, days\_in\_trash, relinked(연결 대상이 남아 있었는지), entry(trash / toast) |
| rejoin\_requested | S-12 “다시 연결하기” | days\_since\_unlink |
| rejoin\_responded | S-12g “다시 연결할게요” / “괜찮아요” | response(accept / decline), hours\_since\_request |
| amounts\_hidden\_toggled | 눈 아이콘, 단축키, ⌘K 바로 하기 | state(on / off), entry(icon / shortcut / palette) |
| search\_used | 검색 화면(⌘K, 좁은 창 검색) 닫을 때 | result\_count\_band, picked(goal / asset / debt / care\_day / quick\_action / none), quick\_action(salary\_check / add\_goal / add\_asset / hide\_amounts / lock). 검색어는 보내지 않음 |

### 4-8. 웹사이트

화면 → 화면 설계 › 웹사이트. 쿠키 없는 측정이라 방문자 ID를 남기지 않음. UTM은 웹사이트 이벤트에만(4-2). platform = site.

| 이벤트 | 발생 시점(화면 ID) | 주요 속성 |
| --- | --- | --- |
| `site_landing_viewed` | L-01 열림 | os, utm\_source, utm\_medium, utm\_campaign |
| `site_download_clicked` | L-01 2번, 7번, L-02 “다시 받기” | os(`mac` / `win`), placement(`hero` / `bottom` / `install_guide`) |
| `site_store_clicked` | L-01 상단 바, 2번(휴대폰), 7번, L-02 5번 | store(`app_store` / `google_play`), placement(`topbar` / `hero` / `bottom` / `install_guide`), os |
| `site_install_guide_viewed` | L-02 열림 | os, entry(`landing` / `app`) |
| `site_faq_opened` | L-01 6번, L-06 질문 펼침 | faq\_no(FAQ 탭 번호), page(`landing` / `help`) |

## 5. 수집 원칙

- 금액 원값은 이벤트에 넣지 않음. 구간만: 월 수입·목표 금액은 → 핵심 규칙 › 데이터 항목 구간, 그 밖의 금액(분배표 줄, 남는 돈, 넣기·꺼내 쓰기) `_band` = `<10만` / `10-50만` / `50-100만` / `100-300만` / `300-1000만` / `1000만+`, 비율·변동률은 %구간
- 자유 텍스트 미수집: 이름(애칭), 자산 이름, 목표 이름, 분배표에 직접 추가한 줄 이름, 챙길 날 이름, 메모, ‘기타’ 사유. 선택지 코드·템플릿 ID만
- 가족 정보는 제3자 정보라 이벤트에 넣지 않음 (event\_type 수준만)
- 서프라이즈·비공개 항목: 항목 유형도 보내지 않고 is\_secret만. 공개 범위 ‘비공개’ 항목은 금액 구간도 미전송
- 식별자 최소화: user\_id·couple\_id는 가명 ID, 이메일·소셜 계정 ID·기기 고유 ID 미포함. 계좌·카드 번호는 원래 수집하지 않음
- 오프라인: 기기에 이벤트 큐 저장 후 동기화 때 전송, client\_time 유지
- 분석 목적·보관 기간·계정 삭제·연결 해제 시 삭제 범위 → 기술·운영 › 보안·개인정보

## 6. 대시보드·리뷰 주기

| 주기 | 보는 것 | 결정 |
| --- | --- | --- |
| 상시 (자동 경보) | 3장 경보 기준 초과, 기준일 체크리스트 생성·알림 발송 실패 | 원인 확인, 긴급 수정 여부 |
| 주간 | 핵심 지표 진행 상황(진행 중 사이클의 체크 진행률), 온보딩 완료율·소요 시간, 이탈 화면 상위 5, 첫 체크 완료율, 배우자 초대·합류율 | 문구·화면 수정 우선순위 |
| 월간 (사이클 종료 7일 뒤) | 핵심 지표 월 추이, 가입 주차 코호트별 첫 체크 완료율·M1·M3, 월별 체크리스트 완료율·저금 줄 체크율, 목표 진행·지연, 되돌리기, 연결 해제, 유료·페이월 전환 | 기능 개선·알림 정책 조정 |
| 분기 | 목표치(가설) 재설정, 지표·이벤트 정의 점검 | 다음 분기 목표 |

- 기본 분해: couple\_state, marriage\_state(했어요 / 준비 중이에요), salary\_mode(각자 / 합쳐서), platform(desktop / ios / android), 변동 수입 여부, 가입 경로(starter / partner)
- 코호트 단위: 온보딩 완료 주차. 유지율은 연결·혼자 쓰기·미합류로 나눠서도 표시
