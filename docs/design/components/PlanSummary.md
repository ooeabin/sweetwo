# PlanSummary · PlanCard · PlanAdd · PlanStage

W-01 월급 계획 템플릿 틀(2026-11-19 사용자 확정 시안으로 예전 영수증 `ReceiptCard`를 대신함). 시안 참고: 카카오뱅크 아파트관리비(둥근 흰 카드, 굵은 문장 + 강조 숫자, 두꺼운 알약 막대 + ● 범례), 통장 내역(이름 + 회색 보조 + 굵은 금액), 회색 블록 버튼. 코드 `packages/ui/src/components/PlanTemplate.tsx`, 줄은 `ReceiptRows`(ReceiptCard.md).

- 바탕: 화면 틀 `tone="alt"`(`surface-alt`, AppFrame.md). 그 위 `PlanStage`(`hg-planstage`)가 카드를 세로로 쌓음(카드 사이 12px, 최대 480px 가운데, 넓은 창도 같은 열). 카드는 `hg-plancard`: `surface`, radius 24px(확정 시안 값, radius 토큰 20·28 사이), 안쪽 24px 20px. 그림자·테두리 없음.
- `PlanSummary`(요약 카드): 이름표 “월급”(14px 500 `slate`) → 큰 금액(30/38 700, 숫자 너비 같게) + 연필(Phosphor `pencil`, `slate`). `onAmount`를 주면 금액 + 연필이 한 버튼(월급 금액 시트, 44px 이상 누름 영역). → 굵은 한 문장(`title`, 20/30 700, 숫자 `<em>`만 `brand-ink`) → 알약 막대 → ● 범례. 2026-11-19: `titleError`면 굵은 문장을 `danger` 빨강으로(“계획이 월급보다 25만 원 많아요”, 미계획 < 0). `bar`·`legend`를 주지 않으면(저축·투자 줄도 지출 줄도 0개) 막대와 범례 없이 문장만 그림. 화면 바탕 `surface-alt`는 html·body까지 칠해 아래 흰 띠가 없음.
  - 알약 막대(`hg-plansum__bar`): 높이 16px, 칸 사이 3px, 칸마다 `radius-full`, 칸 최소 16px, 0%는 그리지 않음. 저축·투자 `brand`, 지출 `ink-2`, 미계획 `bar-track`. `role="img"` + 문장 이름. 퍼센트는 core `planRatio`(합 100), 문장 퍼센트와 상태는 core `planSummary`.
  - ● 범례(`hg-plansum__legend`): 세 줄, 점 8px(미계획 점만 `bar-track` 채움 + `slate` 1px 테두리, 흰 카드 위에서 안 보여서, 2026-11-19. 막대 칸 색은 그대로) + 이름(`ink-2` 15px 500) + 오른쪽 금액(600, 숫자 너비 같게). 모자람이면 `short`: 금액을 `danger`(“−30만 원”), 막대는 저축·투자·지출로 꽉 채움.
  - `people`(합쳐서 + 파트너 합류): 큰 금액은 합계(버튼 아님), 아래 사람마다 한 줄(이름 + 금액 + 내 줄만 연필, 상대 줄 자물쇠 + 선택 `note`).
  - `empty`(월급 0원): 막대·범례 없이 굵은 문장(두 줄) + `hg-plan__block hg-plan__block--soft` 블록 버튼(`brand-soft` 바탕 + 오렌지 `accent-app-text` 700 글자, 카드 안 보조 버튼과 같은 규칙, 2026-11-19).
- `PlanCard`(묶음 카드, 저축·투자 / 지출): 머리 = 제목(18/26 700) + 제목 바로 오른쪽 `action`(작은 ⋯ `Menu`) + 오른쪽 합계(15px 600 `slate`). `id`는 주소 `#saving` 스크롤 자리. 안에 `ReceiptRows`, 같이 모으기 묶음 줄, 그만 모은 접힌 줄, 끝 `PlanAdd`.
- `PlanAdd`: 카드 끝 블록 버튼(`hg-plan__block`, 52px, `surface-alt` 바탕, `radius-btn`, 15px 600 `ink-2`). 글자 앞 “+”는 Phosphor `plus` 아이콘으로 그리고 화면 읽기 이름(`aria-label`)은 글자 그대로(“+ 저축·투자 추가”).
- 빈 카드(저축·투자, 지출): 합계 “0원” 아래 회색 한 줄(`hg-plancard__hint`, 14px `slate`) + 이름 칩 줄(`hg-receipt__chips`, Chip `sm`, 맨 끝 “직접 정하기”). 이때 `PlanAdd`는 두지 않음.
- 다크 모드는 토큰 그대로(회색 바탕 `surface-alt` 위 `surface` 카드, 막대 `ink-2`는 밝은 회색). ‘동작 줄이기’는 줄 강조 움직임 없음.
- 이미지 공유(‘공유하기’, 2026-11-19 사용자 결정으로 화면의 새 모양을 따라 다시 그림, `features/salary/receipt-image.ts` `renderPlanPng`, 앱이 canvas로 그림): 바탕 `surface-alt`(회색) 위 `surface` 둥근 카드(24px) 셋 — 요약 카드(이름표 “월급” 14 `slate` → 큰 금액 30 700 → 굵은 한 문장 20 700, 퍼센트만 `brand-ink` → 알약 막대 16px → ● 범례 세 줄) + 저축·투자·지출 줄 목록 카드(머리 18 700 + 합계 15 600 `slate`, 줄 이름 16 600 + 오른쪽 금액 16 700, 저축·투자 줄은 이름 아래 `slate` 13 화면과 같은 보조 줄 “모은 금액 1,240만 원, 목표 금액의 62%”(금액 가리기면 금액만 “•••”), 줄 없는 묶음은 카드 없음) → 맨 아래 작은 워드마크(높이 18). 막대 칸 색은 화면과 같음(`brand` / `ink-2` / `bar-track`). **라이트 고정**: 앱이 다크여도 보이지 않는 `data-theme="light"` 요소에서 토큰 값을 읽어 그림(hex를 코드에 두지 않음). 아바타·사람 이름은 그리지 않음. 달 결과 이미지(W-02)는 예전 영수증 모양 그대로이고 같은 라이트 고정.
- 빈 카드 아래 버튼(2026-11-19): 저축·투자도 지출도 0줄이면 맨 아래 ‘편집하기’·‘공유하기’·‘추천값으로 다시 채우기’를 그리지 않음(월급 금액과 상관없이).
- ‘+ 지출 추가’(2026-11-19): 지출 카드 끝 블록 버튼은 이것 하나. 같이 쓰는 통장을 쓸 수 있으면 누를 때 작은 `BottomSheet`(제목 “무엇을 추가할까요?”, `ListRow` “지출” / “같이 쓰는 통장”), 쓸 수 없으면 시트 없이 바로 지출 이름 칩.
