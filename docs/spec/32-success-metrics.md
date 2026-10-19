# 성공 지표

핵심 지표는 ‘월말 정리를 마친 부부 수(월)’. 단계별 지표로 온보딩 → 배우자 합류 → 첫 사이클 → 습관화 → 유료 전환을 보고, 이벤트는 금액 원값 없이 구간으로만 수집함. 목표치는 모두 출시 전 가설, 첫 3개 사이클 코호트 확인 후 재설정.

## 1. 핵심 지표 (North Star)

**월말 정리를 마친 부부 수 (월)**

- 정의: 사이클(기준일 \~ 다음 기준일 전날)마다 `month_close_completed`가 1건 이상인 couple\_id 수. 혼자 정리·함께 모드 모두 포함, 한 사람이 해도 완료
- 월 귀속: 부부마다 기준일이 달라 플랜 이름의 월(‘{기준일의 월}월 월급 플랜’) 기준으로 묶음
- 포함: 놓친 달 ‘지금 정리하기’(late=true)는 원래 사이클로 집계. 제외: ‘이번 달은 쉬어가기’. 첫 사이클 15일 미만으로 합쳐진 사이클은 1회로 셈
- 왜: 월말 정리 = 지출·저축 확인·목표 보유액 갱신·진단 재계산·다음 달 조정이 한 번에 일어나는 유일한 지점. 수기 입력 앱에서 데이터가 살아 있는지 + 부부가 매달 돈 이야기를 하는지를 동시에 보여줌
- MAU를 쓰지 않는 이유: 매일 기록 없는 설계(사이클당 정리 5\~10분, 통장을 나눠 쓰는 부부는 월급 나누기 2분 추가)라 접속 빈도는 가치와 무관
- 보조 분해: 연결 부부 비중, 함께 모드 비율, 기한 내(기준일 전날까지) 완료 비율, 부부 공간 단계(예비 / 신혼 첫해 / 2\~3년차)

## 2. 단계별 지표

| 지표 | 정의(계산식) | 초기 목표치(가설) | 보는 이유 |
| --- | --- | --- | --- |
| 온보딩 완료율 | O-66 ‘시작하기’ 사용자 ÷ O-01 ‘시작하기’ 사용자 (초대받은 배우자 제외) | 60% | 첫 플랜(이번 달 남은 기간 플랜)까지 가야 가치 체험 시작 |
| 온보딩 소요 시간 | O-01 → O-66 중앙값 (이어하기 포함, 비활성 30분 초과 구간 제외) | 10분 이하 | 약 8분·30화면 안팎 설계 검증 |
| 첫 주 할 일 완료율 | 7일 안에 완료한 첫 주 할 일 카드 수 ÷ 해당 부부의 카드 수 | 50% | 미룬 질문(자산·대출·고정지출 세부)이 채워져 ‘추정’이 풀리는지 |
| 배우자 초대율 | 온보딩 완료 후 7일 안에 초대 발급(O-07·설정 S-12 ‘부부 정보’)한 사용자 ÷ 온보딩 완료 사용자 | 70% | 부부 공동 사용이 핵심 차별점 |
| 배우자 합류율 | 초대 발급 후 7일 안에 P-11 도달 ÷ 초대 발급 (재발급은 첫 발급 기준) | 50% | 초대 유효기간 7일과 일치. 합류해야 제안·함께 정리가 작동 |
| 합류 소요 시간 | `invite_sent` → `partner_joined` 중앙값 | 24시간 이내 | 짧은 온보딩(P-01\~11, 2\~3분)·웹 합류 동선 검증 |
| 첫 사이클 월급 나누기 체크율 | 첫 플랜에서 W-02 나누기 줄을 1줄 이상 체크한 부부 ÷ 첫 플랜 생성 부부 중 W-02 대상(배우자 합류 + 통장 역할을 나눈 부부) | 70% | 플랜이 실제 월급 나누기 행동으로 이어지는지 |
| 첫 월말 정리 완료율 | 첫 정리 대상 사이클에서 정리 완료한 부부 ÷ 첫 정리 기간에 도달한 부부 (늦은 정리 포함, 다음 기준일 + 7일까지) | 50% | 습관 형성의 첫 관문 |
| M1 유지 | 첫 정리 완료 부부 중 바로 다음 사이클도 정리 완료 비율 | 60% | 첫 정리가 일회성인지 |
| M3 유지 | 첫 정리 완료 부부 중 3번째 사이클에 정리 완료 비율 | 40% | 첫 분기(3사이클)까지 남는지 |
| 함께 모드 비율 | 정리 완료 중 mode=together 비율 (연결 부부만) | 30% | 데스크톱 넓은 화면·웹 동시 접속으로 둘이 같이 보는지 |
| 제안 응답률 | 적용일 전에 좋아요·반대·다르게 해볼래요 중 응답한 제안 ÷ 생성 제안 (철회 제외) | 70% | 무응답 적용에 기대면 합의가 아니라 통보 |
| 제안 응답 시간 | `proposal_created` → 첫 `proposal_responded` 중앙값 | 24시간 이내 | 72시간 규칙 안에서 실제로 대화하는지 |
| 함께 정하기 비율 | ‘함께 정하기’로 넘어간 제안 ÷ 생성 제안 | 10% 이하 (상한) | 갈등 신호. 높으면 제안 문구·G-08 전·후 비교 점검 |
| 유료 전환율 | 월말 정리 3회 이상 완료 부부 중 프리미엄 구독 부부 비율 (부부 단위, 한 명 구독 = 둘 다 적용) | 5% | 핵심 기능은 무료(→ 사업 계획 6장)라 전환은 정리 습관 이후에 봄 |
| 페이월 전환율 | `paywall_viewed` 후 30일 안에 `subscription_started` ÷ 페이월 본 부부 | 8% | 월말 정리 심화·계획 다시 세우기 비교·수익률 시뮬레이션 중 어느 진입점이 파는지 |
| 위젯 부부 정리 완료율 | 위젯을 둔(widget\_added) 부부의 월말 정리 완료율 vs 위젯 없는 부부, 같은 가입 주차 코호트 | 비교만(목표치 없음) | 위젯이 정리 습관에 도움이 되는지 |
| 비교 참여율 (출시 후, 2단계) | 통계 참여를 두 사람 모두 켠 부부 ÷ 연결 부부 | 30% | 그룹별 100쌍에 닿는 속도(→ 계산·배분 12장) |
| 비교 열람 후 정리 완료율 (출시 후) | F-08을 본 부부의 다음 월말 정리 완료율 vs 안 본 부부, 같은 가입 주차 코호트 | 비교만(목표치 없음) | 비교가 압박이 아닌 동기가 되는지. 낮아지면 F-08 문구 점검 |

## 3. 위험 신호 지표

| 신호 | 정의 | 경보 기준(가설) | 볼 것·대응 |
| --- | --- | --- | --- |
| 온보딩 이탈 화면 | 화면별 `onboarding_step_viewed` 중 다음 화면에 도달 못 한 비율, 상위 5개 | 한 화면 이탈 10% 초과 | 금액 질문(O-31·O-33·O-36·O-39) 우선 점검. 문구·입력 방식 수정 또는 첫 주 할 일로 미루기 |
| 월말 정리 중단 단계 | `month_close_started` 후 미완료 건의 마지막 `month_close_step_completed` 단계 분포 (W-04a2·j·k·h·g, 꼼꼼 모드는 W-04b\~f·i 포함) | 특정 단계 중단 20% 초과 | W-04j 항목 입력 이해도, 꼼꼼 모드 W-04b ‘계획대로라면’ 버튼 사용률·W-04c 차액 질문 이해도 |
| 놓친 달 비율 | 다음 기준일까지 정리 안 한 부부 ÷ 해당 사이클 활성 부부 | 30% 초과 | 정리 기간 알림 열람률, 기준일 위치(월급날 대비) |
| 쉬어가기 비율 | 놓친 달 선택 중 ‘이번 달은 쉬어가기’ 비율 + 2개월 이상 밀린 부부 수 | 쉬어가기 50% 초과 | 이탈 전조. 회복 플랜 문구·지금 정리하기 소요 시간 |
| 제안 만료·보류 | 보류 후 만료된 제안 ÷ 생성 제안, 기준일 재계산으로 적용 멈춘 제안 수 | 만료 15% 초과 | W-04h에서 보류 제안을 다루는지 |
| 연결 해제 | 월 `unlink_requested` 부부 ÷ 연결 부부, 14일 기본안 적용 비율 | 월 1% 초과 | 직전 60일 반대·함께 정하기 횟수와 교차 확인 (사유는 묻지 않음) |
| 미합류 고착 | 온보딩 완료 30일 후에도 미합류인 부부 비율 (초대 리마인드 2회·코드 만료 포함) | 40% 초과 | 혼자 쓰는 가치 vs 초대 동선, 임시 플랜 장기화 |
| 알림 피로 | 알림 종류별 열람률, 월 상한(메일 6회) 도달 사용자 비율, 종류별 알림 끄기 수(S-14) | 열람률 10% 미만 또는 상한 도달 30% 초과 | 급하지 않은 알림 우선순위 조정 |
| 브라우저 로그인 이탈 | 데스크톱 login\_started 중 login\_completed 없이 끝난 비율(취소·시간 초과·앱 종료 포함), method별 | 20% 초과 | 딥링크 복귀 실패(브라우저 앱 열기 확인), 제공자별 동의 화면, A-03 ‘다시 열기’ 사용률, login\_failed reason 분포 |

## 4. 이벤트 정의

### 4-1. 네이밍 규칙

- snake\_case `객체_동작`, 동작은 과거형: `_viewed` `_started` `_completed` `_sent` `_responded` `_applied`
- 화면 ID는 이벤트 이름에 넣지 않고 `screen_id` 속성으로 (예: `onboarding_step_viewed` + `screen_id=O-33`)
- 사용자 행동 1회 = 이벤트 1건. 서버가 확정하는 상태 변화(플랜 생성, 제안 적용·만료, 해제 확정)는 서버 이벤트(`source=server`)
- 선택지 값은 영문 코드로 고정 (예: 좋아요 `like` / 반대 `oppose` / 다르게 해볼래요 `different`)
- 금액은 `_band` 접미사 구간 속성만 (5장)

### 4-2. 공통 속성

| 속성 | 값 | 비고 |
| --- | --- | --- |
| user\_id | 가명 내부 ID | 로그인 계정·이메일과 분리 |
| couple\_id | 부부 공간 가명 ID | 해제 후 혼자 쓰기도 기존 couple\_id 유지, 새로 초대하면 새 ID |
| role | `starter`(먼저 시작) / `partner`(초대받아 합류) |  |
| couple\_state | `unjoined` 미합류 / `linked` 연결 / `unlink_pending` 해제 대기 / `solo` 혼자 쓰기 | → 핵심 규칙 › 부부·제안·권한 |
| couple\_stage | `pre_wedding` / `newlywed_y1` / `y2_3` / `after` | 부부 공간 단계 |
| platform | `desktop` / `web` | 모바일 앱 출시 시 `ios` / `android` 추가. 웹사이트 이벤트는 site |
| os | `windows` / `macos` / 웹은 브라우저 계열 |  |
| app\_version | 앱·웹 빌드 버전 |  |
| cycle\_id | 사이클 ID (couple\_id + 기준일) | 첫 사이클은 `cycle_partial=true` |
| plan\_tier | `free` / `premium` | 부부 단위 |
| client\_time / server\_time | 기기 시각 / 수신 시각 | 오프라인 저장 후 동기화 전송 대비 |
| source | `client` / `server` |  |
| utm\_source, utm\_medium, utm\_campaign | 웹사이트 유입 UTM 값 | 웹사이트 이벤트에 붙이고, “웹에서 시작하기”로 app.sweetwo.kr에 넘길 때 주소에 이어 붙여 가입 이벤트까지 남김. 데스크톱 설치 경로는 이어지지 않음. source(client / server)와는 다른 속성 |

### 4-3. 로그인·온보딩·합류

| 이벤트 | 발생 시점(화면 ID) | 주요 속성 |
| --- | --- | --- |
| app\_first\_launch | 설치 후 데스크톱 앱 첫 실행(A-01), 첫 로그인 딥링크 도착 때 전송 | download\_id(L-02가 발급해 브라우저 로그인 딥링크로 넘긴 값, 없으면 null), os, app\_version |
| login\_started | A-02 소셜 버튼 | method(kakao / google / apple), entry(first\_run / revisit / invite / session\_expired), flow(browser / popup / redirect) |
| login\_completed | 제공자 로그인 후 앱 복귀(A-03 딥링크 / 웹 팝업·리다이렉트) (서버) | method, is\_new\_account, wait\_sec(데스크톱 브라우저 대기 시간), reopened(A-03 ‘다시 열기’ 사용) |
| login\_failed | A-02·A-03 예외 | method, reason(cancelled / timeout / provider\_error / email\_conflict / request\_mismatch / browser\_open\_failed) |
| signup\_completed | A-05 ‘동의하고 계속하기’ 계정 생성 (서버) | method, email\_source(provider / manual: A-04 직접 입력), marketing\_opt\_in, role |
| onboarding\_started | O-01 ‘시작하기’ | entry(`direct` / `invite_link`) |
| onboarding\_step\_viewed | O-01\~67, P-01\~11 각 화면 표시 | screen\_id, flow(`starter` / `partner`), part(0\~6), required, couple\_type(`newlywed` / `pre_separate` / `pre_combined`) |
| onboarding\_step\_completed | 각 화면 ‘다음’ | screen\_id, answer(`input` / `estimate` / `none`), duration\_sec, changed\_after\_back |
| onboarding\_part\_skipped | ‘나중에 할게요’ | part |
| onboarding\_resumed | “이어서 할까요?” | screen\_id, hours\_since\_last |
| onboarding\_completed | O-66 ‘시작하기’ | duration\_sec, has\_estimate, savable\_band, base\_day\_changed, first\_amount\_adjusted, savable\_zero(지출 점검 카드) |
| first\_mission\_chosen | O-67 | mission(`family_events` / `wedding_items`), choice(`now` / `later`) |
| first\_week\_task\_completed | 이번 달 할 일 카드 | task(`invite` / `assets` / `loans` / `fixed_costs` / `goals_income` / `invest`), day\_index, postponed\_count |
| invite\_sent | O-07, 설정 S-12 ‘부부 정보’ | channel(`code` / `link` / `kakao`), issue\_seq(재발급 회차) |
| invite\_accepted | P-01 코드·링크 확인 | hours\_since\_sent, channel |
| invite\_link\_opened | sweetwo.kr/i/{코드} 열림(웹사이트 ‘초대 링크’) | choice(open\_app / continue\_web / direct\_web), has\_app\_history |
| partner\_joined | P-11 도달 | hours\_since\_invite, mid\_cycle, base\_day\_changed, proposals\_created(P-07·P-08·P-10에서 만든 제안 수) |

### 4-4. 월 사이클·월말 정리

| 이벤트 | 발생 시점(화면 ID) | 주요 속성 |
| --- | --- | --- |
| plan\_generated | 기준일 0시, 첫 사이클은 O-66 직후, 결혼일 전환은 H-T6 (서버) | plan\_type(`first_partial` / `regular` / `wedding_transition` / `extended`), is\_temporary(임시 배지), proposals\_applied\_count, partial\_days |
| transfer\_checked | W-02 ‘옮겼어요’ / ‘다른 금액을 옮겼어요’ | account(`living` / `goal` / `emergency` / `wedding`), result(`as_planned` / `different`), diff\_band, checked\_by(`self` / `on_behalf`), line\_type(`regular` / `goal_to_living` / `emergency_to_living`), days\_from\_payday |
| transfer\_all\_done | W-02 모두 완료 | hours\_since\_plan |
| this\_month\_changed | W-01 ‘이번 달만 바꾸기’ 저장·되돌리기 | target, action(`apply` / `revert`) |
| living\_check\_answered | W-03a\~c | answer(`enough` / `just` / `over`), cover\_from(`goal` / `allowance` / `next_month`), over\_band |
| month\_close\_started | W-04a ‘시작’ | entry(`home_card` / `notification` / `missed_month`), mode(`solo` / `together`), late |
| month\_close\_step\_completed | W-04a2·j·k·h·g, 꼼꼼 모드 W-04b\~f·i 각 단계 완료 | step, duration\_sec, used\_expected\_button(W-04b), skipped(W-04i) |
| month\_close\_detailed\_chosen | W-04g ‘더 꼼꼼히 정리하기’ | mode, late, cycles\_closed |
| month\_close\_completed | W-04 끝 “{월}월 정리를 마쳤어요” | mode, close\_mode(basic / detailed), late, duration\_sec, achievement\_band(계획 대비 `<80` / `80-99` / `100` / `>100`%), shortfall\_choice(`spread_3m` / `extend` / `skip_this_month`), surplus\_allocated, changes\_count, bundle\_created |
| month\_close\_edited | ‘정리 고치기’ (완료 후 7일 안) | days\_after |
| variable\_income\_answered | W-04a2, 또는 H-02 1문항 카드 | vs\_base(`above` / `equal` / `below` / `zero`), answered\_by(`self` / `timeout`) |
| missed\_month\_shown | H-02 ‘지난달 정리’ 카드 표시 | months\_behind |
| missed\_month\_chosen | ‘지금 정리하기’ / ‘이번 달은 쉬어가기’ | choice(`close_now` / `rest`), months\_behind |

### 4-5. 제안·함께 정하기

| 이벤트 | 발생 시점(화면 ID) | 주요 속성 |
| --- | --- | --- |
| proposal\_created | G-08 보내기, W-04h 혼자 정리 끝, P-07·P-08·P-10, F-07 분담 자동 제안 | proposal\_kind(`single` / `month_close_bundle`), item\_type(`allowance` / `split` / `goal_add` / `goal_delete` / `goal_priority` / `goal_amount` / `goal_deadline` / `goal_pause` / `goal_resume` / `goal_owner` / `base_day` / `living_budget` / `family_budget` / `wedding_budget` / `revert`), origin\_screen, items\_count, is\_counter |
| proposal\_responded | G-08, W-04h, H-04 할 일 | response(`like` / `oppose` / `different`), all\_like(묶음 ‘모두 좋아요’), hours\_since\_created |
| proposal\_applied | 좋아요 즉시, 적용일 기준일, 함께 확정 (서버) | apply\_path(`like` / `no_response` / `together`), hours\_since\_created |
| proposal\_paused | 기준일 직전 재계산에서 저축 가능 금액 부족 (서버) | item\_type |
| proposal\_withdrawn | 제안자 철회 | hours\_since\_created |
| proposal\_expired | 보류 후 미해결로 다음 기준일 0시 작업에서 만료 처리 (서버) | item\_type |
| decide\_together\_entered | 같은 항목 반대 2회 또는 ‘다르게 해볼래요’ 2번 왕복 (서버) | item\_type, trigger(`oppose_twice` / `different_twice`) |
| decide\_together\_resolved | 함께 모드 확정 또는 양쪽 좋아요 | resolve\_path(`together_mode` / `both_like`), days\_open |

### 4-6. 사실값·목표·챙길 날

| 이벤트 | 발생 시점(화면 ID) | 주요 속성 |
| --- | --- | --- |
| fact\_value\_changed | F-05, 자산·부채 화면, P-05, 온보딩 값 수정 | field(`income` / `payday` / `fixed_cost` / `asset` / `debt`), change\_band(변동률 `<5` / `5-20` / `20+`%), has\_period(기간 지정 수입 변경), source\_screen |
| goal\_created | O-21\~24, G-03, H-T(결혼 후 목표 생성) | template\_id, goal\_kind(`once` / `yearly` / `monthly`), via(`direct` / `proposal`), owner(`joint` / `me`), target\_band |
| goal\_used | Y-08·G-07·매년 목표 사용 기록, W-04j 큰 지출, 꼼꼼 모드 W-04c 차액 질문 | goal\_kind, paid\_from(`goal_account` / `living_account_card` / `personal` / `wedding_account`), amount\_band, overflow |
| goal\_achieved | G-05 | template\_id, months\_taken, vs\_plan(`early` / `on_time` / `late`) |
| event\_recorded | Y-08 챙길 날 기록 | event\_type(`birthday` / `holiday` / `parents_day` / `memorial` / `anniversary` / `milestone_birthday` / `etc`), side(`husband` / `wife` / `us`), assignee(`me` / `spouse` / `together`), paid\_from, amount\_band, vs\_budget(`under` / `on` / `over`), is\_secret(서프라이즈면 event\_type 미전송) |
| wedding\_transition\_completed | H-P1 ‘결혼했어요’ 또는 설정 부부 정보 → H-T7 | entry(`hp1_card` / `settings`), months\_vs\_planned, transfers\_carried |
| wedding\_postponed | H-P1 ‘미뤄졌어요’ | months\_moved |

### 4-7. 연결 해제·알림·구독·위젯

| 이벤트 | 발생 시점(화면 ID) | 주요 속성 |
| --- | --- | --- |
| unlink\_requested | S-12 자산 정리 안 전송 | split\_plan(`default` / `custom`), linked\_months |
| unlink\_countered | S-12 상대 ‘다르게 정리하기’ | — |
| unlink\_resolved | 상대 동의 / 다르게 정리하기 합의 / 14일 기본안(서버) / 요청자 취소 | path(`agreed` / `counter_agreed` / `timeout` / `canceled`), days\_pending, exported\_data |
| notification\_sent | 기준일 9시, 정리 기간 3일 전·전날 20시, 제안 도착, 제안 적용 예정, 챙길 날, 주간 요약, 수입 변경, 초대 리마인드 (서버) | type, channel(`os` / `email` / inapp), cap\_scope(`in_cap` / `out_of_cap`), cap\_used(월 누적) |
| notification\_opened | 알림 클릭 → 진입 | type, channel, minutes\_to\_open, landing\_screen |
| paywall\_viewed | 프리미엄 기능 진입: 월말 정리 심화(W-04g 정산 요약 이후), 계획 다시 세우기 비교(F-07), 목표 수익률 시뮬레이션(목표 상세 G-02), 설정 › 구독. 유료화 시점부터 수집(그 전에는 진입점 없음) | entry, cycles\_closed |
| subscription\_started | 설정 › 구독 결제 완료 | entry, cycles\_closed, days\_since\_signup |
| subscription\_canceled | 설정 › 구독 해지, 연결 해제로 상대 무료 전환 | reason\_path(`user` / `unlink`), months\_subscribed |
| widget\_added | 위젯을 처음 놓음(트레이 아이콘 켜짐 포함) | widget(tray / wg01\~wg05), size(small / medium / large / lock), amounts\_shown |
| widget\_tapped | 위젯 누름 → 딥링크 진입 | widget, element, landing\_screen, app\_was\_running |
| peer\_stats\_viewed | F-08 지표 카드 표시 (출시 후) | metric(net\_worth / saving\_rate / saving\_amount / emergency\_months / debt\_ratio), group\_level(filter / age\_stage / age / all), source(public / app) |
| peer\_stats\_consent\_changed | F-08 참여 안내, 설정 S-18 통계 참여 토글 (출시 후) | state(on / off), entry(f08 / settings), couple\_both\_on |
| profile\_photo\_changed | S-11e 저장, S-11 ‘사진 지우기’ | action(set / remove) |
| account\_delete\_requested | S-18b 삭제 확인 | couple\_state, exported\_before |
| account\_restored | 유예 중 재로그인 ‘취소하고 계속 쓰기’ (서버) | days\_pending, was\_linked |
| data\_exported | S-18 내보내기 끝 | format(csv / pdf\_diagnosis / pdf\_yearly / pdf\_wedding), scope(mine / joint), result(done / failed / async) |
| trash\_restored | S-21 되살리기, 되돌리기 토스트 | item\_type, days\_in\_trash, relinked(연결 대상이 남아 있었는지), entry(trash / toast) |
| rejoin\_requested | S-12 “다시 연결하기” | days\_since\_unlink |
| rejoin\_responded | S-12g “다시 연결할게요” / “괜찮아요” | response(accept / decline), hours\_since\_request |
| amounts\_hidden\_toggled | 눈 아이콘, 단축키, ⌘K 바로 하기 | state(on / off), entry(icon / shortcut / palette) |
| search\_used | 검색 화면(⌘K, 좁은 창 검색) 닫을 때 | result\_count\_band, picked(goal / asset / debt / care\_day / family / quick\_action / none), quick\_action(transfer\_check / spend\_entry / add\_asset / add\_goal / hide\_amounts / lock). 검색어는 보내지 않음 |

### 4-8. 웹사이트

화면 → 화면 설계 › 웹사이트. 쿠키 없는 측정이라 방문자 ID를 남기지 않고, 가입과 이어지는 값은 UTM뿐(4-2). platform = site.

| 이벤트 | 발생 시점(화면 ID) | 주요 속성 |
| --- | --- | --- |
| `site_landing_viewed` | L-01 열림 | os, utm\_source, utm\_medium, utm\_campaign |
| `site_download_clicked` | L-01 2번, 7번, L-02 “다시 받기” | os(`mac` / `win`), placement(`hero` / `bottom` / `install_guide`) |
| `site_web_start_clicked` | L-01 상단 바, 2번(휴대폰과 기타), 7번, L-02 5번 | placement(`topbar` / `hero` / bottom / `install_guide`), os |
| `site_install_guide_viewed` | L-02 열림 | os, entry(`landing` / `web_app`) |
| `site_faq_opened` | L-01 6번, L-06 질문 펼침 | faq\_no(FAQ 탭 번호), page(`landing` / `help`) |

## 5. 수집 원칙

- 금액 원값은 이벤트에 넣지 않음. 구간만: 월 수입·생활비·고정지출·결혼 총예산·목표 금액·여행 경비는 → 핵심 규칙 › 데이터 항목 구간, 그 밖의 금액 `_band` = `<10만` / `10-50만` / `50-100만` / `100-300만` / `300-1000만` / `1000만+`, 비율·변동률은 %구간
- 자유 텍스트 미수집: 호칭, 통장 이름, 목표 이름, 가족 이름·생일, 메모, ‘기타’ 사유. 선택지 코드·템플릿 ID만
- 양가 가족 정보는 제3자 정보라 이벤트에 넣지 않음 (side·event\_type 수준만)
- 서프라이즈·비공개 항목: 항목 유형도 보내지 않고 is\_secret만. 공개 범위 ‘비공개’ 항목은 금액 구간도 미전송
- 식별자 최소화: user\_id·couple\_id는 가명 ID, 이메일·소셜 계정 ID·기기 고유 ID 미포함. 계좌·카드 번호는 원래 수집하지 않음
- 오프라인: 기기에 이벤트 큐 저장 후 동기화 때 전송, client\_time 유지
- 분석 목적·보관 기간·계정 삭제·연결 해제 시 삭제 범위 → 기술·운영 › 보안·개인정보

## 6. 대시보드·리뷰 주기

| 주기 | 보는 것 | 결정 |
| --- | --- | --- |
| 상시 (자동 경보) | 3장 경보 기준 초과, 기준일 플랜 생성·알림 발송 실패 | 원인 확인, 긴급 수정 여부 |
| 주간 | 핵심 지표 진행 상황(정리 기간 중인 사이클의 완료 진행률), 온보딩 완료율·소요 시간, 이탈 화면 상위 5, 배우자 초대·합류율, 첫 사이클 월급 나누기 체크율, 제안 응답률·응답 시간 | 문구·화면 수정 우선순위 |
| 월간 (사이클 종료 7일 뒤, 늦은 정리 반영 후) | 핵심 지표 월 추이, 가입 주차 코호트별 첫 월말 정리 완료율·M1·M3, 함께 모드 비율, 놓친 달·쉬어가기, 함께 정하기, 연결 해제, 유료·페이월 전환 | 기능 개선·알림 정책 조정 |
| 분기 | 목표치(가설) 재설정, 지표·이벤트 정의 점검 | 다음 분기 목표 |

- 기본 분해: couple\_state, couple\_stage(예비 / 신혼), platform(desktop / web), 변동 수입 여부, 가입 경로(starter / partner)
- 코호트 단위: 온보딩 완료 주차. 유지율은 연결·혼자 쓰기·미합류로 나눠서도 표시
