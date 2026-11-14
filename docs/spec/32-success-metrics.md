# 성공 지표

2026-11-13부터 핵심 지표는 ‘이번 달 같이 모은 커플 수(월)’(0장). 예전 핵심 지표는 ‘월급 체크를 한 커플 수(월)’. 단계별 지표로 온보딩(8~9화면) → 첫 체크 → 파트너 초대·합류 → 매달 체크리스트 → 저금 항목 진행 → 리텐션 → 유료 전환을 보고, 이벤트는 금액 원값 없이 구간으로만 수집함. 2026-10-25 재기획(`docs/adr/0003-replan-goal-checklist.md`)으로 월말 정리, 제안, 월급 나누기, 첫 주 할 일, 재정 진단 지표는 없앰. 목표치는 모두 출시 전 가설 [확인 필요], 첫 3개 사이클 코호트 확인 후 재설정.

## 0. 지표 v2.2 (2026-11-13, ADR 0009 결정 15)

이 장이 2026-11-13부터 정본. 아래 1~3장의 ‘월급 체크를 한 커플 수’와 그에 기댄 지표는 바꾼 기록이고, 4장 이벤트는 0-4를 더함(이름 규칙, 공통 속성, 금액은 `_band`는 그대로). 대시보드는 북극성, 선행, 가드레일 세 판(PR 14).

### 0-1. 북극성 (2026-11-13)

**이번 달 같이 모은 커플 수(월)**

- 셈 단위: 연결 커플, 달은 그 커플의 ‘대표 사이클’ 월. 대표 사이클 = 같이 계열은 공동 확인 목록, 각자 계열은 먼저 시작한 사람의 확인 목록, 둘 다 날짜 없으면 달력 월.
- 조건 둘을 모두 만족하면 1.
  1. **확인 끝**: 그 달 확인 목록이 있는 사람마다 손 줄이 모두 체크 또는 건너뜀(자동 줄은 나가는 날 자동 확인되므로 따로 요구하지 않음). 손 줄이 하나도 없는 사람은 자동으로 만족. 확인 목록이 없는 사람(날짜 없음, 월급 없음, 월급 없이 합류)은 조건에서 뺀다. 같이 계열은 공동 목록 하나만 본다.
  2. **모음**: 그 달 두 사람 중 누구의 저금(묶음, 공동 포함)이든 모은 금액이 늘었다. 늘어난 것 = 저금 줄 체크(자동 확인 포함) + 날짜 없는 사람의 자동 저금(reason_code auto) + 돈 들어왔어요로 넣은 금액. 이미 모은 금액, 바로잡기 ±(잔액 맞추기 포함), 쓸 곳 메모 ‘냈어요’ −는 셈에서 뺀다.
  - 날짜 없는 사람의 ‘확인 끝’ 대신: 그 달에 걸친 기간에 돈 들어왔어요 1건 이상(G8).
- 따로 보는 숫자: 같은 정의의 혼자 쓰는 사람 수, 그중 ‘사람이 직접 확인한’ 비율(손 줄이 있고 사람이 끝낸 커플 ÷ 북극성 커플. 자동만으로 세어지는 비중을 감시), 묶음 있는 커플 비율.
- 없앰: ‘월급 체크를 한 커플 수(1줄 이상)’.

### 0-2. 선행 지표

| 지표 | 정의 | 처음 목표(가설) |
| --- | --- | --- |
| 첫 저금률 | 온보딩 완료 24시간 안 저금 1개 이상 ÷ 온보딩 완료 | 60% |
| 알림 허용률 | O-55·P-11 ‘알림 받기’ 후 OS 허용 ÷ 표시 | 60% |
| 첫 월급날 확인률 | 손 줄이 있는 첫 확인 목록 중 7일 안 확인 끝 | 60% |
| 자동 줄 설정률 | 첫 월급날 전 자동 줄 1개 이상 ÷ 월급 계획 있는 사람 | 비교만 |
| 돈 들어왔어요 사용 | 월 1회 이상 쓴 사람 ÷ 월급 계획 있는 사람(날짜 있음 / 없음 따로) | 비교만 |
| 자동 줄 질문 응답 | W-11e·W-01d에서 ‘네’ 비율, 첫 월급날 손 줄 수 | 비교만 |
| 잔액 맞추기 | 띠를 본 사람 중 W-10c 완료, 맞춘 차이 금액 구간 | 50% |
| 다음 저금 이어 가기 | W-12b를 본 사람 중 30일 안 새 저금 | 40% |
| 순위 같이 보기 | 연결 커플 중 두 사람 모두 동의 | 비교만 |
| 진행 소식 열람 | 진행 소식 푸시 열람률, 끈 비율 | 열람 15% |
| 월급 변경 예약 | S-11c에서 미래 날짜로 바꾼 사람, 그 달 W-01을 연 비율 | 비교만 |
| 초대율 / 합류율 | 진입점 속성 추가 | 60% / 50% |
| 묶음률 | 각자 계열 연결 커플 중 14일 안 묶음 | 40% |
| 분담 제안 수락률 | 수락 ÷ 제안 | 비교만 |
| M1, M3 | 첫 사이클에 같이 모은 커플 중 다음, 세 번째에도 | 70% / 50% |
| 온보딩 시간 | A-01부터 O-60 중앙값 | 3분 이하 |

### 0-3. 가드레일

어드민 AD-01 8번(서버 `admin_metrics`)은 아래 표 중 DB로 셀 수 있는 넷(요청 거절, 연결 해제, 자동 줄 바꿈, 잔액 차이)을 바로 보여 줌. 나머지는 화면 이벤트라 분석 도구에서(0-5).

| 신호 | 정의 | 경보 기준(가설) |
| --- | --- | --- |
| 공개 좁히기 | 연결 뒤 30일 안 `plan_share`를 좁힌 비율 | 15% 초과 |
| 각자 금액 끄기 | 묶음에서 켰다가 끈 비율 | 비교만 |
| 미리 보기 뒤 좁히기 | S-13p를 본 뒤 7일 안 좁힌 비율 | 비교만 |
| 파트너 알림 끄기 | S-14·P-11에서 ‘같이 쓰는 걸 바꿨을 때’를 끈 비율 | 20% 초과 |
| 되돌리기·이전 값 돌리기 | 같이 쓰는 값 변경 중 7일 안 | 15% 초과 |
| 요청 거절 | 관리 형태·분담 요청 중 거절 + 만료 | 50% 초과 |
| 연결 해제 | 월 요청 ÷ 연결 커플, ‘다시 받지 않기’ 비율 | 월 1% 초과 |
| 자동 줄 바꿈 | 자동 확인 뒤 사람이 건너뜀·다른 금액으로 바꾼 비율 | 10% 초과 |
| 잔액 차이 | 잔액 맞추기에서 −로 맞춘 저금 비율(자동 확인이 실제보다 많았다는 신호, G7) | 20% 초과 |
| 퍼센트만 켜기 | 묶음 중 ‘퍼센트만 보여 주기’ 비율 | 비교만 |
| 바로잡기 숨기기 | 묶음 바로잡기 중 ‘주간 요약에 넣지 않기’ 비율 | 비교만 |
| 관리하는 사람의 용돈 수정 | 한 사람 관리형에서 관리하는 사람이 상대 용돈을 줄인 횟수와 그 뒤 30일 해제·공개 좁히기 | 비교만(관계 신호) |
| 건너뜀 누적 | 연속 2사이클 손 줄 절반 넘게 건너뜀 | 30% 초과 |
| 앱 잠금 꺼짐 | A-06 건너뛴 비율, 그 뒤 분실·새 기기 신고 | 비교만 |
| 광고 | 광고 뒤 7일 안 삭제·알림 끄기, 광고 실패율 | 비교만 |

### 0-4. 이벤트 추가·변경

| 이벤트 | 속성 |
| --- | --- |
| `push_permission_asked` / `_answered` | screen_id(O-55, P-11, H-06), result(granted / denied / unavailable(브리지 없음) / later), kinds_on(켠 종류 키 목록, 허용하지 않았으면 빈 목록. H-06은 그 사람 알림 종류 설정에서 켠 것, 2026-11-13 PR 14) |
| `manage_answers_saved` | shared_living, shared_saving, manager(self/partner/both/each), salary_mode(`separate` / `combined`, 4-2와 같은 코드. 엔진 값 joint는 combined로 보냄, 2026-11-13 PR 14), screen_id |
| `plan_share_changed` | from, to, screen_id |
| `share_preview_viewed` | — |
| `split_line_setting_changed` | kind, in_checklist, auto_pay, auto_day_band |
| `auto_line_confirmed`(서버) | kind |
| `payday_confirmed` | method(one_tap/line_by_line/w05), manual_lines, late |
| `pay_line_late_checked` | kind, days_late |
| `auto_line_changed` | to(skipped/other_amount) |
| `saving_adjusted` | sign(`plus`/`minus`), amount_band, reason_code, from(w10b/note_paid). 잔액 맞추기는 `savings_reconciled`로만 |
| `money_in_logged` / `_distributed` | kind, amount_band, saving_count, payday_none |
| `bundle_created` / `_joined` / `_left` / `_achieved` / `bundle_show_each_toggled` | entry(`band` 홈 띠 13번 / `saving` W-10 ⋯·W-11 끝 / `direct` / `notification` 들어가기 / `w15a` / `celebrate` / `s13` 설정 S-13 묶음 줄, 2026-11-13 PR 14), has_target, on |
| `saving_note_saved` / `saving_note_paid` | has_due, subtracted |
| `split_proposed` / `split_answered` | name_code, rule, result |
| `mode_change_requested` / `_answered` / `_cancelled` | phrase(`p04_send` / `s11f_combine` / `s11f_manager`), to_mode(`separate` / `combined`), result(requested: `applied` / `requested`, answered: `accepted` / `declined` / `expired`, cancelled는 없음) |
| `app_lock_answered` | result(on/later) |
| `rank_viewed` | first_free, ad_result(`rewarded` / `closed` / `failed` / `none`), mode(pair/peer_median) |
| `rank_consent_requested` / `_answered` / `_turned_off` | result(requested: `sent` / `failed`, answered: `accepted` / `declined` / `expired`, turned_off는 속성 없음) |
| `rank_badge_toggled` | on(F-08 ‘홈에 보여 주기’) |
| `quick_assets_saved` | count(채운 칸 수), has_debt, total_band, share(`all` / `sum` / `private`) |
| `auto_pay_asked` | screen_id(W-11e, W-01d, W-01 줄 추가), answer |
| `savings_reconciled` | count, diff_sign(`plus`/`minus`/`zero`, 맞춘 차이 합), diff_band(차이 없으면 null) |
| `next_saving_prompt_viewed` / `_chosen` | from(achieved/deadline), chip_code(viewed는 null, chosen은 칩 코드·`redeadline`·`custom`·`later`) |
| `bundle_percent_only_toggled`, `adjust_summary_hidden` | on |
| `salary_change_scheduled` / `_applied` / `_cancelled` | months_ahead, has_until |
| `progress_news_sent`(서버) / `_opened` | — |
| `home_task_dismissed` | task_key |
| `money_in_period_viewed` | state(early/bar/gap), filled_band |
| `invite_code_autofilled` | source(clipboard / referrer), result(join / decline) (2026-11-13 PR 8) |
| `saving_item_created` | entry에 onboarding(O-60 ‘첫 저금 만들기’) 더함 |
| `widget_added` / `widget_tapped`, `partner_code_entered`, `reconnect_requested` / `reconnect_blocked`, `partner_change_reverted` | 위젯은 4-7(v2.2 값은 2026-11-13 PR 14: widget `wg01` / `wg04`, size `small` / `medium`). 코드 입력은 `invite_accepted` channel `code`로 셈(`partner_code_entered`는 따로 보내지 않음, PR 14). 앱의 다시 연결 요청은 `rejoin_requested`, 막힘은 `reconnect_blocked`(reason too\_soon / reconnect\_closed, PR 11). `partner_change_reverted`는 N-01·N-02 ‘이전 값으로 돌리기’(14 R-08) |

### 0-5. 구현 상태 (2026-11-13 PR 14)

앱 이벤트는 `packages/app/src/shared/analytics.ts`(+ `analytics-saving.ts`)의 `AnalyticsEvent` 한 곳(이름 하나 = 정의 하나), 서버 이벤트는 표 `server_event`(DEV_GUIDE ‘지금 있는 테이블과 함수’). PostHog 전송기는 분석 단계에서 붙임(지금 앱은 개발 중에만 콘솔).

| 이벤트(0-4) | 어디서 | 상태 |
| --- | --- | --- |
| `push_permission_asked` / `_answered` | O-55, P-11, H-06 띠 10번 | 됨. H-06 result unavailable·kinds_on 목록 맞춤(PR 14) |
| `manage_answers_saved` | O-30c 끝(온보딩), S-11f | 됨. salary_mode `combined`로 맞춤(PR 14) |
| `plan_share_changed`, `share_preview_viewed` | S-13, S-13p | 됨 |
| `split_line_setting_changed`, `auto_pay_asked` | W-01 줄 설정, W-01d, W-11e | 됨 |
| `auto_line_confirmed` | 서버: 자동 줄 나가는 날 자동 확인(`pay_check_line` 트리거), 날짜 없는 자동 저금(`goal_move` auto 트리거) | 됨(PR 14) |
| `payday_confirmed`, `pay_line_late_checked`, `auto_line_changed` | W-02, W-05 | 됨 |
| `saving_adjusted`, `adjust_summary_hidden`, `savings_reconciled` | W-10b, W-10c, W-14 냈어요 | 됨 |
| `money_in_logged` / `_distributed`, `money_in_period_viewed` | W-20, H-13 | 됨 |
| `bundle_*`, `bundle_percent_only_toggled` | W-15·W-15a, W-12, S-13 | 됨. S-13 entry `s13`로 맞춤(PR 14) |
| `saving_note_saved` / `_paid` | W-14 | 됨 |
| `split_proposed` / `_answered` | W-01b, W-01c | 됨(만료는 연 사람이 볼 때 expired) |
| `mode_change_requested` / `_answered` / `_cancelled` | P-04, S-11f, S-11j | 됨. to_mode `combined`로 맞춤(PR 14) |
| `app_lock_answered` | A-06 | 됨 |
| `rank_viewed`, `rank_consent_*`, `rank_badge_toggled` | F-08, F-08c, S-13 | 됨. turned_off 속성 없앰(PR 14) |
| `quick_assets_saved` | F-03q | 됨 |
| `next_saving_prompt_viewed` / `_chosen` | W-12b | 됨 |
| `salary_change_scheduled` / `_cancelled` | S-11c | 됨 |
| `salary_change_applied` | 서버: 예약 적용(`salary_change.applied_at` 트리거) | 됨(PR 14) |
| `progress_news_sent` / `_opened` | 서버: 진행 소식 알림이 생김(`notification` 트리거) / 알림 열기 | 됨(sent는 PR 14) |
| `home_task_dismissed` | H-06 띠 | 됨 |
| `invite_code_autofilled` | O-01 시트 | 됨 |
| `saving_item_created` entry onboarding | O-60 | 됨 |
| `widget_added` / `widget_tapped` | 앱 시작 때 놓인 위젯 확인(브리지 `widget.installed`, 이 기기에서 처음 본 종류·크기만) / 위젯 링크 `w` | 됨(PR 14) |
| `unlink_resolved` path timeout | 서버: 14일 기한 확정(`couple_unlink` 트리거) | 됨(PR 14). acknowledged·canceled는 앱 |
| `rejoin_requested` / `_responded`, `reconnect_blocked` | S-12, S-12g | 됨 |
| `partner_change_reverted` | N-01·N-02 ‘이전 값으로 돌리기’(속성 hours\_since\_change = 알림이 온 뒤 시간) | 됨(`revert_partner_change`, PR 14 후속) |
| `partner_code_entered` | — | 보내지 않음(`invite_accepted` channel code로 셈) |

지표 판(AD-01 8번, `admin_metrics`, 집계 숫자만):

| 판 | 서버가 세는 것 | 분석 도구에서 볼 것 |
| --- | --- | --- |
| 북극성 | 0-1 정의 그대로 달마다(`metric_couple_month`): 같이 모은 커플 / 연결 커플(지금 연결·해제 대기 공간), 혼자 쓰는 사람, ‘사람이 직접 확인’ 비율, 묶음 커플 비율 | — |
| 선행 | 첫 저금률(최근 30일), 첫 월급날 확인률(7일 안), 자동 줄 설정률(지금), 돈 들어왔어요 사용(이번 달, 날짜 있음·없음), 묶음률(지금), 분담 제안 수락률(최근 90일), 순위 같이 보기 | 알림 허용률, 자동 줄 질문 응답, 잔액 맞추기 완료, 다음 저금 이어 가기, 진행 소식 열람, 월급 변경 예약, 초대·합류율, M1·M3, 온보딩 시간 |
| 가드레일 | 요청 거절(30일, 50%), 연결 해제 요청(30일, 1%), 자동 줄 바꿈(30일, 10%), 잔액 차이 −(90일, 20%). ‘이전 값 돌리기’는 `partner_change.reverted_at`이 생겨 셀 수 있음(판에는 아직 없음) | 공개 좁히기, 각자 금액 끄기, 미리 보기 뒤 좁히기, 파트너 알림 끄기, 되돌리기, 퍼센트만, 바로잡기 숨기기, 관리하는 사람 용돈 수정, 건너뜀 누적, 앱 잠금, 광고 |

- ‘연결 커플’은 지난 달 연결 여부 기록이 없어 지금 상태로 셈(해제된 커플은 지난 달 칸에서도 빠짐) [확인 필요]
- 묶음률·자동 줄 설정률은 ‘14일 안’·‘첫 월급날 전’ 대신 지금 값(시점 기록이 없음) [확인 필요]

## 1. 핵심 지표 (North Star)

**월급 체크를 한 커플 수 (월)** [확인 필요]

- 정의: 사이클(기준일 \~ 다음 기준일 전날)마다 `checklist_line_checked`가 1건 이상인 couple\_id 수. 각자 관리면 두 사람 중 한 사람만 체크해도, 합쳐서 관리면 누가 체크해도 셈(대신 체크는 2026-11-03 없앰)
- 월 귀속: 커플마다 기준일이 달라 체크리스트 이름의 월(‘{기준일의 월}월 월급’) 기준으로 묶음. 각자 관리에서 두 사람 기준일이 다르면 먼저 시작한 사람 체크리스트의 월 기준 [확인 필요]
- 포함: 월급 전 확인(W-05)에서 한 체크. 제외: ‘이번 달은 못 했어요’만 누른 사이클
- 왜: 체크 = 월급 계획대로 나눴는지 확인 + 저금이 저금 항목에 쌓이는 유일한 지점. 수기 입력 앱에서 데이터가 살아 있는지 + 커플이 매달 정한 대로 돈을 나누는지를 함께 보여줌
- MAU를 쓰지 않는 이유: 매일 기록 없는 설계(월급날 체크 1\~2분, 월급 전 확인 30초)라 접속 빈도는 가치와 무관
- 보조 분해: 연결 커플 비중, 월급 관리 방식(각자 / 합쳐서), 사이클 끝에 ‘다 했어요’인 비율(대신 체크 비율은 2026-11-03 없앰)

## 2. 단계별 지표

| 지표 | 정의(계산식) | 초기 목표치(가설) | 보는 이유 |
| --- | --- | --- | --- |
| 온보딩 완료율 | O-60 ‘홈으로 가기’ 사용자 ÷ O-03 첫 표시 사용자 (초대받은 파트너 제외, 2026-11-10 O-10 없앰) | 80% [확인 필요] | 질문 6~7화면 안에 월급 계획까지 가야 가치 체험 시작 |
| 온보딩 소요 시간 | O-03 → O-60 중앙값 (이어하기 포함, 비활성 30분 초과 구간 제외) | 2분 이하 [확인 필요] | 약 1분·질문 6~7화면 설계 검증(2026-11-10) |
| 첫 체크 완료율 | 첫 체크리스트 생성(O-60 직후) 후 7일 안에 1줄 이상 체크한 사용자 ÷ 첫 체크리스트가 생긴 사용자 | 70% [확인 필요] | 월급 계획이 실제로 보내고 체크하는 행동으로 이어지는지 |
| 첫 체크리스트 다 함 | 첫 사이클이 끝날 때 ‘다 했어요’인 체크리스트 ÷ 첫 체크리스트 | 50% [확인 필요] | 첫 달에 월급 계획 전체를 따라가는지 |
| 월별 체크리스트 완료율 | 사이클이 끝날 때(다음 기준일 0시) ‘다 했어요’인 체크리스트 ÷ 그 사이클 체크리스트. 줄 기준 보조: 체크한 줄 ÷ 전체 줄(여유 자금 제외) | 60% (줄 기준 80%) [확인 필요] | 습관이 유지되는지. 월급 전 확인(W-05) 효과는 W-05에서 한 체크 비율로 따로 봄 |
| 저금 줄 체크율 | 사이클이 끝날 때 체크한 저금 줄 ÷ 전체 저금 줄 | 80% [확인 필요] | 저금 항목에 실제로 돈이 쌓이는지(‘못 함’은 더하지 않음) |
| 저금 항목 만들기 | 온보딩 완료 후 30일 안에 저금 항목을 1개 이상 만든 사용자 ÷ 온보딩 완료 사용자(첫 저금 빈 줄에서 만든 비율은 따로: `saving_item_created` entry home·salary, 이미 모은 금액을 넣은 비율 `has_start`) | 60% [확인 필요] | 온보딩에서 목표 고르기를 뺀 뒤(ADR 0007) 홈 제안이 저금 항목으로 이어지는지 |
| 목표 금액 달성 | 사이클마다 W-12에 도달한 저금 항목 수, W-12a 선택(`keep` / `stop` / 고르지 않음) | 비교만(목표치 없음) | 달성 뒤 계속 모으는지 |
| 파트너 초대율 | O-06 ‘초대하기’ 또는 온보딩 완료 후 7일 안에 초대 발급(O-07, 홈 H-06, 설정 S-12 ‘우리 둘 정보’)한 사용자 ÷ 온보딩 완료 사용자 | 70% [확인 필요] | 둘이 같이 쓰는 것이 핵심 차별점. O-06에서 바로 초대한 비율은 따로 봄 |
| 파트너 합류율 | 초대 발급 후 7일 안에 합류 완료(→ 파트너 합류) ÷ 초대 발급 (재발급은 첫 발급 기준) | 50% [확인 필요] | 초대 유효기간 7일과 일치. 합류해야 파트너 체크리스트 보기, 합쳐서 같이 체크가 작동 |
| 합류 소요 시간 | `invite_sent` → `partner_joined` 중앙값 | 24시간 이내 | 휴대폰 초대 → 앱 설치 → 합류(약 7화면·1\~2분) 동선 검증 |
| M1 유지 | 첫 사이클에 체크한 커플 중 바로 다음 사이클에도 1줄 이상 체크한 비율 | 70% [확인 필요] | 첫 체크가 일회성인지 |
| M3 유지 | 첫 사이클에 체크한 커플 중 3번째 사이클에도 체크한 비율 | 50% [확인 필요] | 첫 분기(3사이클)까지 남는지 |
| 유료 전환율 | 3사이클 이상 체크한 커플 중 프리미엄 구독 커플 비율 (커플 단위, 한 명 구독 = 둘 다 적용) | 5% | 핵심 기능은 무료(→ 사업 계획 6장)라 전환은 체크 습관 이후에 봄 |
| 페이월 전환율 | `paywall_viewed` 후 30일 안에 `subscription_started` ÷ 페이월 본 커플 | 8% | 어느 진입점이 파는지. 진입점은 유료화 시점에 다시 정함 [확인 필요] |
| 위젯 커플 체크 완료율 | 위젯을 둔(widget\_added) 커플의 월별 체크리스트 완료율 vs 위젯 없는 커플, 같은 가입 주차 코호트 | 비교만(목표치 없음) | 위젯이 체크 습관에 도움이 되는지 |
| 비교 참여율 (출시 후, 2단계) | 통계 참여를 두 사람 모두 켠 커플 ÷ 연결 커플 | 30% | 그룹별 100쌍에 닿는 속도(→ 계산·배분 7장). 비교 기준(연령대 등)은 다시 정함 [확인 필요] |

## 3. 위험 신호 지표

| 신호 | 정의 | 경보 기준(가설) | 볼 것·대응 |
| --- | --- | --- | --- |
| 온보딩 이탈 화면 | 화면별 `onboarding_step_viewed` 중 다음 화면에 도달 못 한 비율, 상위 5개 | 한 화면 이탈 10% 초과 | 금액 질문(O-23·O-31·O-50) 우선 점검. 문구·추천값·‘잘 모르겠어요’ 사용률 |
| 첫 체크 없음 | 첫 체크리스트 생성 후 7일 안에 체크 0줄인 사용자 비율 | 40% 초과 [확인 필요] | 월급날 알림 열람률, 첫 체크리스트 기준(지난 월급날로 만듦) 이해도, H-03 카드 노출 |
| 체크리스트 방치 | 사이클이 끝날 때 체크한 줄이 절반 미만인 체크리스트 비율 | 30% 초과 [확인 필요] | 월급 전 확인(W-05) 알림 열람률, 기준일 위치(월급날 대비), 줄 수 |
| 저금 ‘못 함’ | 사이클이 끝날 때 ‘못 함’인 저금 줄 ÷ 전체 저금 줄 | 30% 초과 [확인 필요] | 월급 계획 저금이 과한지(여유 자금 음수 비율과 교차), W-02a 다른 금액 사용률 |
| 월급 계획 모자람 | 여유 자금이 음수인 월급 계획 비율 | 20% 초과 [확인 필요] | O-50 추천값(고정지출·생활비 25%, 용돈 10%) 맞는지, “30만 원이 모자라요” 뒤 행동 |
| 되돌리기 | 상대가 고친 월급 계획·저금 항목 값을 7일 안에 되돌린 비율 | 15% 초과 [확인 필요] | 갈등 신호. 변경 알림 문구, 고친 항목 종류. 연결 해제와 교차 확인 |
| 연결 해제 | 월 `unlink_requested` 커플 ÷ 연결 커플, 14일 기한으로 확정된 비율, 30일 안 다시 연결한 비율 | 월 1% 초과 | 직전 60일 되돌리기 횟수와 교차 확인 (사유는 묻지 않음) |
| 미합류 고착 | 온보딩 완료 30일 후에도 미합류인 커플 비율 (초대 리마인드 2회·코드 만료 포함) | 40% 초과 | 혼자 쓰는 가치 vs 초대 동선(O-06 ‘나중에 할게요’ 비율, 홈 H-06 초대 띠 누름 비율, 2026-11-11 띠 닫기 없앰) |
| 알림 피로 | 알림 종류별 열람률, 월 상한(메일 6회) 도달 사용자 비율, 종류별 알림 끄기 수(S-14) | 열람률 10% 미만 또는 상한 도달 30% 초과 | 급하지 않은 알림 우선순위 조정 |
| 브라우저 로그인 이탈 | 앱 login\_started 중 login\_completed 없이 끝난 비율(취소·시간 초과·앱 종료 포함), method별 | 20% 초과 | 딥링크 복귀 실패(브라우저 앱 열기 확인), 제공자별 동의 화면, A-03 ‘다시 열기’ 사용률, login\_failed reason 분포 |

## 4. 이벤트 정의

### 4-1. 네이밍 규칙

- snake\_case `객체_동작`, 동작은 과거형: `_viewed` `_started` `_completed` `_sent` `_checked` `_saved`
- 화면 ID는 이벤트 이름에 넣지 않고 `screen_id` 속성으로 (예: `onboarding_step_viewed` + `screen_id=O-31`)
- 사용자 행동 1회 = 이벤트 1건. 서버가 확정하는 상태 변화(체크리스트 생성·닫힘, 해제 확정)는 서버 이벤트(`source=server`)
- 선택지 값은 영문 코드로 고정 (예: 각자 `separate` / 합쳐서 `combined`)
- 금액은 `_band` 접미사 구간 속성만 (5장)

### 4-2. 공통 속성

| 속성 | 값 | 비고 |
| --- | --- | --- |
| user\_id | 가명 내부 ID | 로그인 계정·이메일과 분리 |
| couple\_id | 커플 공간 가명 ID | 해제 후 혼자 쓰기도 기존 couple\_id 유지, 새로 초대하면 새 ID |
| role | `starter`(먼저 시작) / `partner`(초대받아 합류) |  |
| couple\_state | `unjoined` 미합류 / `linked` 연결 / `unlink_pending` 해제 대기 / `solo` 혼자 쓰기 | → 핵심 규칙 › 커플·권한 |
| marriage\_state | `married` 했어요 / `preparing` 준비 중이에요 | O-11 답 [확인 필요] |
| salary\_mode | `separate` 각자 / `combined` 합쳐서 | O-30, 설정에서 바뀌면 바뀐 값 [확인 필요] |
| platform | `ios` / `android` | 웹사이트 이벤트는 site. `desktop`은 없앰 2026-11-10, ADR 0008 |
| os | `windows` / `macos` / `ios` / `android` |  |
| app\_version | 앱 빌드 버전 |  |
| cycle\_id | 사이클 ID (체크리스트 주인 + 기준일) | 첫 사이클은 `cycle_first=true` |
| plan\_tier | `free` / `premium` | 커플 단위 |
| client\_time / server\_time | 기기 시각 / 수신 시각 | 오프라인 저장 후 동기화 전송 대비 |
| source | `client` / `server` |  |
| utm\_source, utm\_medium, utm\_campaign | 웹사이트 유입 UTM 값 | 웹사이트 이벤트에만 붙임. 스토어 설치 경로는 가입 이벤트까지 이어지지 않음(스토어 캠페인 값은 각 스토어 콘솔에서 봄). source(client / server)와는 다른 속성 |

### 4-3. 로그인·온보딩·합류

| 이벤트 | 발생 시점(화면 ID) | 주요 속성 |
| --- | --- | --- |
| app\_first\_launch | 설치 후 앱 첫 실행(A-01) | download\_id(늘 null. L-02 발급은 데스크톱 다운로드와 함께 없앰 2026-11-10, ADR 0008), os, app\_version |
| login\_started | A-02 소셜 버튼 | method(kakao / google / apple), entry(first\_run / revisit / invite / session\_expired), flow(browser) |
| login\_completed | 제공자 로그인 후 앱 복귀(A-03 딥링크·앱 링크) (서버) | method, is\_new\_account, wait\_sec(브라우저 로그인 대기 시간), reopened(A-03 ‘다시 열기’ 사용) |
| login\_failed | A-02·A-03 예외 | method, reason(cancelled / timeout / provider\_error / email\_conflict / request\_mismatch / browser\_open\_failed) |
| signup\_cancelled | A-04·A-05 뒤로(가입 취소, 2026-11-10) | screen\_id(A-04 / A-05), via(back / hardware\_back) |
| pin\_forgot\_confirmed | A-06 ‘PIN을 잊었어요’ 확인 Modal ‘로그아웃할게요’(2026-11-10) | — |
| invite\_link\_opened | 초대 앱 링크로 앱이 A-07을 엶(2026-11-10) | signed\_in |
| update\_view\_only | A-01 ‘업데이트 없이 보기만 할게요’(2026-11-10) | app\_version |
| signup\_completed | A-05 ‘동의하고 계속하기’ 계정 생성 (서버) | method, email\_source(provider / manual: A-04 직접 입력), marketing\_opt\_in, role |
| onboarding\_started | O-03 처음 표시(이어하기 기록이 없을 때, 2026-11-10 O-10 없앰) | entry(`direct` / `invite_link`) |
| onboarding\_step\_viewed | O-03\~O-60, 파트너 합류 P 화면 각 화면 표시 | screen\_id, flow(`starter` / `partner`), required(O-07만 false), marriage\_state(`married` / `engaged` / `undecided` / null) |
| onboarding\_step\_completed | 각 화면 ‘다음’(선택지, 시트 닫기 포함) | screen\_id, answer(`input` / `none`: O-06 나중에, O-07 보내지 않고 닫음, O-31 월급 없음. 2026-11-10 ‘잘 모르겠어요’ 추정이 없어 `estimate` 뺌), duration\_sec, changed\_after\_back(이번 실행에서 그 화면을 이미 한 번 넘겼는지) |
| onboarding\_step\_skipped | O-06 ‘나중에 할게요’ | screen\_id |
| onboarding\_resumed | 앱을 다시 열어 멈춘 화면으로 바로 감(실행마다 한 번, 2026-11-10 질문 화면 없앰) | screen\_id, hours\_since\_last |
| onboarding\_completed | O-60 ‘홈으로 가기’ | duration\_sec(O-03 처음 표시부터, 이 기기 기준), salary\_mode(`separate` / `combined`), income\_band(금액 구간, 월급 없으면 `none`), split\_left\_band(여유 자금 구간, 모자라면 `short`), no\_income(‘지금은 월급이 없어요’). 2026-11-10 has\_estimate·goals\_count·first\_goal\_template·split\_edited는 없앤 개념(추정, 목표 고르기, O-50 화면)이라 뺌 |
| invite\_sent | O-07 코드 복사·링크 복사·공유, 설정 S-12 ‘우리 둘 정보’(홈 초대 띠·서랍 ‘초대하기’로 왔으면 entry home, 2026-11-11 D6) | channel(`code` / `link` / `share`: 기기 공유 창, 카카오톡 등), entry(`onboarding` / `home` / `settings`). issue\_seq(재발급 회차)는 서버만 알아 서버 이벤트로 [확인 필요] |
| invite\_accepted | P-01 ‘합류하기’로 코드를 잡음(2026-11-11 D1, 처음 잡을 때만) | hours\_since\_sent(앱은 모름: null, 서버 이벤트로 [확인 필요]), channel(`link` 링크로 연 경우 / `code` 코드 직접 입력) |
| invite\_link\_opened | sweetwo.kr/i/{코드}가 앱이 아닌 웹사이트 초대 페이지로 열림(앱이 없는 기기) | choice(open\_app / store / download), os |
| partner\_joined | 합류 완료(→ 파트너 합류, 앱이 합류를 마친 순간 보냄 2026-11-11) | hours\_since\_invite(앱은 모름: null [확인 필요]), mid\_cycle(시작한 사람 월급 계획이 이미 있음), salary\_mode(`separate` / `combined`), moved\_records(혼자 쓰던 기록을 옮겼는지) |

### 4-4. 월급 체크리스트

| 이벤트 | 발생 시점(화면 ID) | 주요 속성 |
| --- | --- | --- |
| checklist\_generated | 기준일 0시, 첫 사이클은 O-60 직후, 파트너 합류 직후 (서버, 2026-11-12 `server_event`: 체크리스트가 생긴 트랜잭션 끝, 분석 수집을 끈 사람 것은 안 남김) | cycle\_type(`first` / `regular` / `extended`(해제 대기 중)), owner(`self` / `joint`), lines\_count, saving\_lines\_count |
| checklist\_line\_checked | W-02, W-05, W-10 이번 달 줄 체크(체크 칸, 시트 ‘보냈어요’, W-02a 다른 금액. 홈 H-03 줄 체크는 2026-11-09 없앰, 2026-11-12 앱 연결) | line\_kind(`saving` / `fixed` / `living` / `allowance` / `custom`), result(`as_planned` / `different`), diff\_band, checked\_by(`self` / `joint`, `on_behalf`는 2026-11-03 대신 체크 없앰), entry(`w02` / `w05` / `w10` / `home` / `widget`), days\_from\_payday(기간 시작부터 날 수) |
| checklist\_group\_checked | W-02 묶음 ‘모두 보냈어요’ (2026-11-09 round 3) | group(`saving` / `spend`), lines\_count(이번에 체크한 줄 수), all(남은 줄을 모두 체크했는지) |
| checklist\_line\_unchecked | 체크한 줄의 체크 칸을 다시 누름, Toast ‘되돌리기’ | line\_kind, minutes\_since\_checked, entry(`checkbox` / `toast`) |
| checklist\_line\_skipped | W-05 ‘이번 달은 못 했어요’, W-02a 0원, ‘못 함’으로 되돌리기 | line\_kind |
| checklist\_completed | 이 기기에서 마지막 줄을 끝내 여유 자금 줄을 뺀 모든 줄이 체크 또는 ‘못 함’이 됨(W-02·W-05 “…체크를 다 했어요/마쳤어요” Toast, 2026-11-12 D4. 예전 W-02 끝 화면은 없앰) | hours\_since\_generated(체크리스트가 생긴 뒤), checked\_by\_partner\_count(상대가 체크한 줄 수) |
| month\_check\_viewed | W-05 열림 | entry(`notification` / `home` / `other`: 월급 탭·캘린더 등, 2026-11-11), open\_lines\_count(체크 안 한 줄 수) |
| checklist\_closed | 다음 기준일 0시 (서버, 2026-11-12 `server_event`) | done(닫히기 전에 모든 줄이 체크 또는 ‘못 함’으로 끝났는지, 2026-11-12 D4), checked\_ratio\_band(체크한 줄 비율 `<50` / `50-99` / `100`%), missed\_saving\_lines(체크하지 않은 저금 줄 수), missed\_saving\_band(그 줄 계획 금액 합 구간, 없으면 null) |
| split\_saved | W-01 ‘추천값으로 다시 채우기’ 저장(2026-11-09 영수증부터 ‘저장’ 버튼이 없어 추천값으로 채울 때만, O-50은 onboarding\_completed로) | changed\_lines\_count, editor(`self`), left\_band, reset\_to\_recommended(늘 true), entry(`split`) |
| plan\_line\_changed | W-01 금액 시트 ‘확인’으로 줄 금액·이름을 바꿈 (2026-11-09) | line\_kind(`saving` / `fixed` / `living` / `allowance` / `custom`), field(`amount` / `name` / `both`), direction(`up` / `down` / `same`), left\_band(바꾼 뒤 여유 자금 구간, 모자라면 `short`), joint(합쳐서 공동 월급 계획인지), entry(`receipt` / `edit` / `saving_detail`: W-10 ‘매달 금액 바꾸기’로 연 시트, 주소의 `line`을 지운 뒤에도 그 시트는 `saving_detail`, 2026-11-12) |
| plan\_line\_added | W-01 ‘+ 지출 추가’로 줄을 더함 (2026-11-09) | source(`chip` / `text`), chip(칩 이름 영문 코드 `maintenance` / `phone` / `insurance` / `subscription` / `transport` / `parents`, 글자로 넣었으면 null), amount\_band, joint |
| plan\_line\_deleted | W-01 ‘지우기’(시트, 편집 모드 줄) (2026-11-09) | line\_kind, default\_line(고정지출·생활비·용돈인지), entry(`sheet` / `edit`), joint |
| plan\_reordered | W-01 편집 ‘완료’에서 순서가 바뀜 (2026-11-09) | sections(`saving` / `spend` / `both`), lines\_count, joint |
| plan\_shared | W-01 ‘공유하기’ (2026-11-09) | result(`shared` / `downloaded` / `cancelled` / `failed`), masked(금액 가리기였는지), whose(`self` / `partner` / `joint`) |
| plan\_link\_tapped | W-01 머리 아래 ‘이번 달 3/5 체크했어요 ›’를 누름 (2026-11-09) | whose(`self` / `partner` / `joint`), checked(체크한 줄 수), total(줄 수) |
| month\_result\_shared | 다 끝난 달 한 줄 ‘공유하기’(W-02 1c 이번 달, 지난 달) (2026-11-09, 2026-11-12 W-02 끝 없앰) | result(`shared` / `downloaded` / `cancelled` / `failed`), masked, whose(`self` / `partner` / `joint`), screen(`checklist` / `past`, 예전 `done`은 없앰), skipped(‘못 함’ 줄 수) |
| salary\_mode\_changed | 설정 S-11f에서 월급 관리 방식 바꿈, 합류 P-04에서 다른 방식으로 ‘바꿀게요’(2026-11-09 round 3) | from, to(`separate` / `combined`), entry(`s11f` / `p04`) |

### 4-5. 저금 항목·자산 관리·경조사

| 이벤트 | 발생 시점(화면 ID) | 주요 속성 |
| --- | --- | --- |
| saving\_list\_viewed | W-13 저금 목록 열림 (2026-11-09 round 3) | entry(`checklist` / `split` / `home` / `direct`), items\_count |
| saving\_item\_created | W-11 저장 (2026-11-08, 예전 goal\_created) | entry(`home`: 홈 첫 저금 빈 줄 / `salary`: W-02 첫 저금 빈 줄 / `salary_row`: W-02 저금 묶음 ‘+ 저금 추가’ 줄 / `salary_wide`: W-02 넓은 창 제목 줄 버튼 / `split`: W-01 / `list`: W-13 / `add_menu`: 홈 ‘추가’ 메뉴 / `palette`: 검색 ‘바로 하기’ / `shortcut`: Ctrl(⌘)+N / `direct`: 그 밖, 2026-11-12 S7-16 셋이 `salary`로 섞이던 것 나눔), monthly\_band, has\_target, has\_deadline, has\_start, target\_band(목표 금액이 있을 때) |
| saving\_item\_target\_set | W-10a 목표 금액 저장이 된 뒤(2026-11-12 S7-16, 저장 전에 보내던 것 고침. 충돌 선택에서 ‘내 값’으로 저장해도) | had\_target(고치기인지), has\_deadline, target\_band |
| saving\_item\_achieved | W-12 | months\_taken |
| saving\_item\_after\_achieve | W-12a 고름(‘목표 금액을 새로 정할게요’는 새 목표 금액 저장 때) | choice(`keep` / `stop` / `retarget`) |
| saving\_monthly\_changed | W-10a 매달 금액 저장 (2026-11-09 round 3) | monthly\_band, direction(`up` / `down`) |
| (없앰) goal\_created, goal\_amount\_set, goal\_money\_moved, goal\_delayed, goal\_achieved | 2026-11-08 ADR 0007 | — |
| asset\_added | F-03 저장(2026-11-12 QA 8구간 S8-07 앱에 넣음) | kind(`account`: 현금성·예금·적금·청약 / `invest` / `pension` / `insurance` / `real_estate` / `other` / `debt`), entry(`home`: 홈 ‘추가’ 메뉴 / `palette`: 검색 ‘바로 하기’ / `assets`: 자산 관리 화면과 그 밖), is\_first(자산·부채가 하나도 없을 때 추가) |
| rank\_banner\_tapped | F-01 0번 순위 줄 (2026-11-04. 2026-11-11 홈 순위 줄 1a 없앰, 홈은 H-04 타일 배지라 이벤트 없음) | state(`unseen` / `seen` / `stale` / `empty`), entry(`assets`) |
| rank\_ad\_result | F-08 앞 보상형 광고 | result(`rewarded` / `closed` / `failed` / `none`), platform(`ios` / `android` / `web`: 브리지 없음, 2026-11-12 S8-07) |
| rank\_viewed | F-08 순위 레포트 열림 | 2026-11-13 v2.2: first\_free, ad\_result(`rewarded` / `failed` / `none`), mode(`pair` / `peer_median`) → 0-4. 예전 top\_band·basis·age\_band는 없앰 |
| fact\_value\_changed | 설정 S-11c 월급(2026-11-12: 저장된 값이 바뀌면 `income`·`payday`마다, 월급날은 날짜 숫자(말일 31)로 변동률, `source_screen` = `S-11c`), 자산·부채 화면(2026-11-12 S8-07: F-04 금액 고치기·시세 바꾸기 저장, `source_screen` = `F-04`) | field(`income` / `payday` / `asset` / `debt`), change\_band(변동률 `<5` / `5-20` / `20+`%), source\_screen |
| event\_recorded | Y-08 경조사 기록(2026-11-12 S9-05: 기록을 저장한 순간) | event\_type(`birthday` / `holiday` / `anniversary` / `family_event` / `etc`) [확인 필요](이름 칩 kind: 생일 = birthday, 설날·추석·어버이날 = holiday, 결혼기념일 = anniversary, 행사 = family\_event, 그 밖 = etc), amount\_band, vs\_budget(`under` / `on` / `over`, 금액 메모가 없으면 null [확인 필요]), is\_secret(서프라이즈 옛 행이면 event\_type 미전송) |

### 4-6. 둘이 같이 고치기

제안·승인은 없음. 누구나 바로 고치고 상대에게 알림, 고친 사람에게 Toast ‘되돌리기’(→ 핵심 규칙 › 커플·권한).

| 이벤트 | 발생 시점(화면 ID) | 주요 속성 |
| --- | --- | --- |
| shared\_item\_changed | 공동 항목을 고쳐 상대에게 알림이 감(2026-11-12 W-01: 합쳐서 공동 월급 계획을 연결된 상대와 쓸 때 줄 금액·이름·추가·지우기·‘추천값으로 다시 채우기’마다 `split`. 순서 바꾸기는 활동 기록만이라 보내지 않음. 2026-11-12 S7-16 저금: 합쳐서 + 연결이면 W-11 추가, W-10a 이름·목표 금액·기한·새 목표 금액, W-10 지우기, W-12a 계속 모을게요·그만할게요마다 `goal`(합쳐서면 각자일 때 만든 저금도, D1). 2026-11-12 S9-05 경조사: 연결이면 Y-07 추가, Y-05 메모마다 `care_day`(서버가 상대 알림을 보내는 동작만)) | item\_type(`split` / `goal` / `goal_priority` / `salary_mode` / `care_day`), linked(연결 커플만 보냄) |
| change\_reverted | Toast ‘되돌리기’, 항목 상세 ‘변경 기록’에서 되돌리기(2026-11-12 W-01: 위 shared\_item\_changed를 보낸 동작의 Toast ‘되돌리기’) | item\_type(2026-11-12 S8-05 F-04 저장 Toast ‘되돌리기’는 `asset`, S9-04 Y-05·Y-07 경조사 고치기 Toast ‘되돌리기’는 `care_day`), entry(`toast` / `history`), reverted\_whose(`self` / `partner`), hours\_since\_change |

### 4-7. 연결 해제·알림·구독·위젯

| 이벤트 | 발생 시점(화면 ID) | 주요 속성 |
| --- | --- | --- |
| unlink\_requested | S-12c 연결 해제 요청 | linked\_months, exported\_data(요청 전 24시간 안에 이 기기에서 S-18 내보내기를 끝냈는지, 2026-11-12) |
| unlink\_resolved | 상대 확인(S-12d) / 14일 기한(서버) / 요청자 취소 | path(`acknowledged` / `timeout` / `canceled`, 2026-11-12 앱이 보내던 `agreed`를 `acknowledged`로 맞춤), days\_pending, exported\_data |
| notification\_sent | 월급날 오전 9시, 다음 월급날 3일 전 오후 8시(월급 전 확인), 파트너가 고침, 경조사, 주간 요약, 초대 리마인드 (서버). 2026-11-12 QA 10구간 S10-03: 알림 종류 모두, 채널마다 1번(알림 센터에 쌓일 때 `inapp`, 푸시를 꺼낼 때 `os`(기기 수와 상관없이 1번), 대신 메일을 쌓을 때 `email`) | type(알림 종류 kind), channel(`os` / `email` / `inapp`), cap\_scope(`in_cap` / `out_of_cap` = 상한 밖 보안·계정 종류), cap\_used(월 누적, 2026-11-04 메일 상한을 없애 지금은 보내지 않음) |
| notification\_opened | 알림 클릭 → 진입(알림 센터 줄, 푸시. 2026-11-12 QA 10구간 S10-03) | type(알림 종류 kind), channel(`inapp` = 알림 센터 / `os` = 푸시), minutes\_to\_open(알림이 생긴 뒤 분, 모르면 null), landing\_screen(간 화면 ID, 예: `W-02`, 대상이 지워졌거나 볼 수 없어 Toast면 `none`, 모르는 경로는 `other`) |
| paywall\_viewed | 프리미엄 기능 진입. 진입점은 유료화 시점에 다시 정함 [확인 필요](예전 진입점 중 월말 정리 심화, 계획 다시 세우기 비교는 없앰). 유료화 시점부터 수집 | entry, cycles\_checked |
| subscription\_started | 설정 › 구독 결제 완료 | entry, cycles\_checked, days\_since\_signup |
| subscription\_canceled | 설정 › 구독 해지, 연결 해제로 상대 무료 전환 | reason\_path(`user` / `unlink`), months\_subscribed |
| widget\_added | 위젯을 처음 놓음(트레이는 없앰 2026-11-10, ADR 0008). 2026-11-13 PR 14: 앱을 열 때 놓인 위젯을 보고 이 기기에서 처음 본 종류·크기만 | widget(v1 `wg01` / `wg04`, 예전 wg01\~wg05), size(v1 small / medium, 예전 large / lock), amounts\_shown(지금 늘 false) |
| widget\_tapped | 위젯 누름 → 딥링크 진입(2026-11-13 PR 14: 링크 `sweetwo://widget?to=…&w=wg01`) | widget, element(위젯 전체가 누르는 곳 하나라 `card`), landing\_screen(H-01 / W-10 / W-14 / Y-01 / Y-05 / other), app\_was\_running |
| peer\_stats\_viewed | F-08 지표 카드 표시 (출시 후) | metric(net\_worth / saving\_rate / saving\_amount / emergency\_months / debt\_ratio), group\_level [확인 필요], source(public / app) |
| peer\_stats\_consent\_changed | F-08 참여 안내, 설정 S-18 통계 참여 토글 (출시 후) | state(on / off), entry(f08 / settings), couple\_both\_on |
| profile\_photo\_changed | S-11e 저장, S-11 ‘사진 지우기’, 소셜 계정 사진을 처음 가져왔을 때(2026-11-05) | action(set / remove / imported) |
| account\_delete\_requested | S-18b 삭제 요청이 받아들여짐(2026-11-12 앱에 넣음) | couple\_state, exported\_before(24시간 안에 이 기기에서 S-18 내보내기를 끝냈는지) |
| account\_restored | 유예 중 재로그인 ‘취소하고 계속 쓰기’ (서버) | days\_pending, was\_linked |
| data\_exported | S-18 내보내기 끝 | format(csv / pdf), scope(mine / joint), result(done / failed / async) |
| trash\_restored | S-21 되살리기(2026-11-12 앱에 넣음, entry `trash`, relinked = 서버가 ‘따로 되살렸어요’가 아님), Toast ‘되돌리기’(2026-11-12 S8-07: F-04 삭제 Toast ‘되돌리기’, item\_type `asset`, days\_in\_trash 0) | item\_type, days\_in\_trash, relinked(연결 대상이 남아 있었는지), entry(trash / toast) |
| rejoin\_requested | S-12 “다시 연결하기”(2026-11-11 앱에 넣음) | days\_since\_unlink |
| rejoin\_responded | S-12g “연결할게요” / “괜찮아요” / “다시 받지 않을게요”(2026-11-13) | response(accept / decline / block), hours\_since\_request |
| home\_box\_tapped | 홈 허브 상자를 누름 (19, 2026-11-09) | box(`hero` / `band` / `plan` / `calendar` / `saving` / `assets` / `savings` / `retry`: 큰 상자 오류 카드 ‘다시 시도’, 2026-11-11), todo(할 일 띠 종류, band일 때만: `unlink` / `reconnect` / `review` / `check` / `saving` / `matured` / `care` / `invite`, 2026-11-11 초대 띠도 같은 띠) |
| home\_banner\_tapped | 홈 맨 위 띠의 버튼을 누름 (19 ‘맨 위 띠’, 2026-11-11) | banner(`unlink` / `must_notice` / `mail_bounced` / `notice`), action(`open`: ‘확인하기’·공지 ‘보기’ / `close`: 일반 공지 ‘닫기’) |
| menu\_item\_tapped | 좁은 창 메뉴 서랍 줄을 누름 (19 앱 기본 틀 11번, 2026-11-09) | item(`home` / `salary` / `assets` / `calendar` / `me` / `settings` / `couple` / `invite` / `notice` / `inquiry` / `help`) |
| amounts\_hidden\_toggled | 눈 아이콘, 단축키, ⌘K 바로 하기 | state(on / off), entry(icon / shortcut / palette) |
| search\_used | 검색 화면(⌘K, 좁은 창 검색) 닫을 때 | result\_count\_band, picked(goal / asset / debt / care\_day / quick\_action / none), quick\_action(salary\_check / add\_goal / add\_asset / hide\_amounts / lock). 검색어는 보내지 않음 |

### 4-8. 웹사이트

화면 → 화면 설계 › 웹사이트. 쿠키 없는 측정이라 방문자 ID를 남기지 않음. UTM은 웹사이트 이벤트에만(4-2). platform = site.

| 이벤트 | 발생 시점(화면 ID) | 주요 속성 |
| --- | --- | --- |
| `site_landing_viewed` | L-01 열림 | os, utm\_source, utm\_medium, utm\_campaign |
| `site_download_clicked` (없앰 2026-11-10, ADR 0008) | L-01 2번, 7번, L-02 “다시 받기” | os(`mac` / `win`), placement(`hero` / `bottom` / `install_guide`) |
| `site_store_clicked` | L-01 상단 바, 2번, 7번, L-02, 초대 페이지 | store(`app_store` / `google_play`), placement(`top` / `hero` / `bottom` / `install` / `invite`), utm |
| `site_install_guide_viewed` (없앰 2026-11-10, ADR 0008) | L-02 열림 | os, entry(`landing` / `app`) |
| `site_faq_opened` | L-01 6번, L-06 질문 펼침 | faq\_no(FAQ 탭 번호), page(`landing` / `help`) |

## 5. 수집 원칙

- 금액 원값은 이벤트에 넣지 않음. 구간만: 월 수입은 → 핵심 규칙 › 데이터 항목 구간, 그 밖의 금액(월급 계획 줄, 여유 자금, 목표 금액) `_band` = `<10만` / `10-50만` / `50-100만` / `100-300만` / `300-1000만` / `1000만+`, 비율·변동률은 %구간
- 자유 텍스트 미수집: 이름(애칭), 자산 이름, 저금 항목 이름, 월급 계획에 직접 추가한 줄 이름, 경조사 이름, 메모, ‘기타’ 사유. 선택지 코드·템플릿 ID만
- 가족 정보는 제3자 정보라 이벤트에 넣지 않음 (event\_type 수준만)
- 서프라이즈·숨기기 항목: 항목 유형도 보내지 않고 is\_secret만. 공개 범위 ‘숨기기’ 항목은 금액 구간도 미전송
- 식별자 최소화: user\_id·couple\_id는 가명 ID, 이메일·소셜 계정 ID·기기 고유 ID 미포함. 계좌·카드 번호는 원래 수집하지 않음
- 오프라인: 기기에 이벤트 큐 저장 후 동기화 때 전송, client\_time 유지
- 분석 목적·보관 기간·계정 삭제·연결 해제 시 삭제 범위 → 기술·운영 › 보안·개인정보

## 6. 대시보드·리뷰 주기

| 주기 | 보는 것 | 결정 |
| --- | --- | --- |
| 상시 (자동 경보) | 3장 경보 기준 초과, 기준일 체크리스트 생성·알림 발송 실패 | 원인 확인, 긴급 수정 여부 |
| 주간 | 핵심 지표 진행 상황(진행 중 사이클의 체크 진행률), 온보딩 완료율·소요 시간, 이탈 화면 상위 5, 첫 체크 완료율, 파트너 초대·합류율 | 문구·화면 수정 우선순위 |
| 월간 (사이클 종료 7일 뒤) | 핵심 지표 월 추이, 가입 주차 코호트별 첫 체크 완료율·M1·M3, 월별 체크리스트 완료율·저금 줄 체크율, 저금 항목 만들기·달성, 되돌리기, 연결 해제, 유료·페이월 전환 | 기능 개선·알림 정책 조정 |
| 분기 | 목표치(가설) 재설정, 지표·이벤트 정의 점검 | 다음 분기 목표 |

- 기본 분해: couple\_state, marriage\_state(결혼했어요 / 준비 중 / 아직 안 정함), salary\_mode(각자 / 합쳐서), platform(ios / android), 변동 수입 여부, 가입 경로(starter / partner)
- 코호트 단위: 온보딩 완료 주차. 유지율은 연결·혼자 쓰기·미합류로 나눠서도 표시
