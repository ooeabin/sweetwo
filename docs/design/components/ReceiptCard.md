# ReceiptCard

월급 계획을 영수증 한 장으로 보여 주는 카드(2026-11-09, W-01 월급 계획). 같은 모양으로 달 결과 공유 이미지도 그림(2026-11-09 화면의 달 결과 카드는 2026-11-12 W-02 끝과 함께 없앰, 지금은 W-02 다 끝난 달 한 줄의 ‘공유하기’ 이미지만). 사용자에게는 ‘영수증’이라고 쓰지 않음(제목은 ‘계획’, “11월 월급” 같은 달 이름). 바탕 `ReceiptStage`(`hg-receipt-stage`, `surface-alt`) 위에 `surface` 카드(`hg-receipt`). 위 모서리는 `radius-xl`, 아래 가장자리는 뜯은 종이처럼 톱니(CSS `mask` conic-gradient, 한 칸 14px = 깊이 7px, `--hg-receipt-tooth`). 그림자·테두리 없음. 숫자·문구·퍼센트·금액 가리기·공개 범위는 쓰는 쪽이 줌.

- 바탕: `hg-receipt-stage` 안쪽 16px(아래 24px), 넓은 창은 `radius-xl` 판, 좁은 창은 좌우 끝까지(모서리 없음). 바탕 안 카드와 아래 버튼 줄은 최대 480px 가운데.
- 카드 안쪽 24px(좁은 창 좌우 20px), 아래는 톱니 깊이만큼 더.
- 머리(`ReceiptHead`, `hg-receipt__head`): 가운데 정렬. Avatar 40px(`hg-avatar--lg`, 둘이면 `hg-avatars`로 겹침) → 큰 금액(`text-number-lg` 700 24px, 숫자 너비 같게) → 아래 한 줄 13px `stone`. `onAmount`를 주면 금액이 버튼(눌러서 내 월급). `title`을 주면 Avatar 아래 금액 위에 제목(`hg-receipt__headtitle`, 15px 600 `ink`, 달 결과 “11월 월급”: 지금은 공유 이미지가 같은 모양을 따름). `extra`는 아래 줄 다음(W-01 ‘이번 달 3/5 체크했어요 ›’ = `hg-receipt__link`, 14px 500 `slate` + 아이콘 `chevron-right` 16px, 머리 이동 링크처럼 회색).
- 비율 막대(`PlanBar`, 감싸개 `hg-planbar`, 막대 `hg-receipt__bar`, 2026-11-09 `ReceiptBar`에서 이름 바꿈): 높이 12px, 칸 사이 3px, 칸마다 `radius-full`, 칸 최소 12px. 저금 `accent-app`(`--saving`), 지출 `spend` 토큰(라이트는 `hairline`과 같은 #E1E2E4, 다크는 2026-11-12 QA 5구간 S5-15로 한 단계 밝은 #45464A: 다크 바탕에서 지출 칸이 거의 안 보이던 것. 공유 이미지·진행 모드 테두리도 같은 토큰), 미계획 금액 `stone`(`--free`). 0%인 칸은 그리지 않음. 막대는 `role="img"` + 문장 이름. 아래 가운데 범례(13px 500 `slate`, 작은 네모 10px). 모자람이면 범례 그 칸에 `is-short`(`danger` 글자). 퍼센트 계산은 core `planRatio`(가장 큰 나머지 방식, 계산·배분 3-5). 범례는 `legend`를 줄 때만.
- `PlanBar` 확인 막대(칸 `check`, 2026-11-15 3차 검토 W-02 머리): 칸 하나(`percent` 100) 안을 확인한 줄 수 ÷ 줄 수만큼 채움. 바탕 `bar-track`, 채움 `accent-app`, 범례 없음. W-02 머리는 이것만 쓰고 아래 3색 진행 모드는 달 결과 공유 이미지에만.
- `PlanBar` 진행 모드(`progress`, 2026-11-09 W-02 머리·달 결과 이미지, 2026-11-15부터 이미지만): 칸 너비는 계획 그대로, 저금·지출 칸(`is-progress`) 안을 `fill`(0~100)만큼 채움(`hg-receipt__fill`, 최소 12px, `radius-full`). 저금: 채움 `accent-app`, 남은 부분 `accent-app-soft`. 지출: 채움 `hairline`, 남은 부분은 바탕 없이 `hairline` 1px 안쪽 테두리. 미계획 금액은 늘 `stone`. 모두 100이면 계획 막대와 똑같음(색도 같게, 그래서 지출 채움은 진한 회색이 아니라 `hairline`). 막대 아래 한 줄 `caption`(`hg-receipt__caption`, 13px 500 `slate`, 숫자 너비 같게: “계획한 342만 원 중 132만 원 확인했어요”). 다 끝난 달(2026-11-12, W-02 1c): `title`을 주면 막대 아래 줄이 왼쪽 굵은 한 줄(`hg-planbar__title`, 15px 600 `ink`, “10월 25일 월급, 계획대로 됐어요”) + 그 아래 `caption`, `action`을 주면 오른쪽 글자 버튼(‘공유하기’ `hg-btn--link`). 감싸개 `hg-planbar__foot`(가로 배치, 막대 아래 12px). 카드 밖(W-02 머리 아래)은 `flat`(`hg-planbar--flat`, 막대 위 12px). 진행 원·막대처럼 그래픽, 뜻은 막대 이름(“5개 중 2개 완료”)과 아래 글자로 전함.
- 묶음(`ReceiptSection`, `hg-receipt__sec`): 위 `hairline-soft` 선, 머리 = 왼쪽 묶음(`hg-receipt__headl`: 제목 15px 600 `ink` + `action` ⋯ 메뉴) + 오른쪽 소계(12px 500 `stone`). 소계는 ⋯가 있어도 줄 금액 열 오른쪽 끝(2026-11-18).
- 줄(`ReceiptRows`, `hg-receipt__row`): 두 칸. 왼쪽 이름 15px 500 `slate`(2026-11-09 400에서), 오른쪽 금액 15px 500 `ink`(오른쪽 정렬, 숫자 너비 같게). 줄 앞 아이콘·줄 사이 선 없음, 줄 높이 최소 40px. `onOpen`이 있으면 줄 전체가 버튼(금액 시트). 보기만이면 오른쪽 자물쇠(Phosphor `lock`, `stone`). 줄 `sub`가 있으면 금액 아래 조용한 한 줄(`hg-receipt__amtcol` + `hg-receipt__plan`, 13px `stone`: 달 결과 카드 “계획 80만 원”), `muted`면 금액 자리 `stone` 400(‘못 함’).
- 묶음 끝 글자 버튼(`ReceiptAdd`, `hg-receipt__add`): 14px 500 `stone`(“+ 저축·투자 추가”, “+ 지출 추가”, “+ 같이 쓰는 통장 추가”). 글자 버튼이 둘 이상이면 한 줄에 하나씩(블록, 글자 너비만 누름 영역, 2026-11-13 UX B 붙어 보이던 것). 그 아래 이름 칩 줄은 `hg-receipt__chips`(Chip `sm` + 글자 칸).
- 합계(`ReceiptTotal`): 같은 두 칸 줄. `strong`이면 금액 15px 700, `short`면 이름·금액 모두 `danger`(모자람, W-01 확정 2026-11-09).
- 편집 모드(`ReceiptRows edit`): 줄 왼쪽 손잡이(Phosphor `dots-six-vertical`, 24px 칸, `stone`, 끌면 같은 목록 안에서 자리 바꿈, 끄는 줄은 `surface` + `shadow-1`). 키보드는 줄 안에 포커스가 오면 보이는 위·아래 IconButton(작은 고스트), 옮기면 숨은 `aria-live` 한 줄. 지우기는 `danger` 글자 버튼(`hg-btn--link hg-btn--danger-text`, 채움 없음): 편집 모드에서 늘 보임(마우스·터치 모두, 2026-11-14 재테스트 R7: 터치에서 밀어야만 보여 폭 1px로 숨어 있던 것). 터치에서 줄을 왼쪽으로 미는 것(`is-open`)은 그대로 둠.
- 카드 아래(`hg-receipt-actions`): 꽉 찬 `hg-btn--outline`(흰 테두리 보조 버튼, ‘편집하기’) 한 줄 + 가운데 글자 버튼 줄(‘공유하기’ `hg-btn--link`, ‘추천값으로 다시 채우기’ `hg-btn--quiet`).
- 다크 모드는 토큰 그대로(바탕 `surface-alt`가 카드보다 밝음). ‘동작 줄이기’면 줄 배경 전환 없음.
- 이미지 공유(W-01 ‘공유하기’, W-02 다 끝난 달 ‘공유하기’)는 앱이 같은 숫자와 같은 토큰 색(그때 테마)으로 canvas에 다시 그림(`features/salary/receipt-image.ts`). 이 카드 모양(톱니, 막대, 범례, 묶음 선)을 그대로 따름. 달 결과 이미지는 제목(`title`), 진행 막대(`progress`, 범례 없음), 줄 `sub`·`muted`도 같게.

## 저축·투자 줄과 새 줄 강조 (2026-11-18, W-01 ‘저축·투자’ 묶음, 옛 W-13 합침)

- `ReceiptLine`에 `note`(이름 아래 `stone` 한 줄 “모은 금액 1,240만 원”), `progress`(`{ percent, label }`: 이름 아래 진행 막대 `hg-receipt__progbar`(6px, `bar-track` 바탕 위 `accent-app` 오렌지 — 저금 목록 줄 `hg-goalrow__bar`와 같은 규칙) + 글자 `hg-receipt__proglabel`(`text-caption` `stone`, “목표 금액의 62%”)), `fresh`(새로 만든 줄 강조)를 씀. 막대는 그래픽이라 뜻은 늘 글자로도 전함. 큰 금액은 “매달 30만 원”. 진행 막대가 있는 줄은 오른쪽 금액(자동 알약 + 금액)이 이름 줄 높이로 위쪽 맞춤(`hg-receipt__main:has(.hg-receipt__prog)`).
- `fresh`: 줄에 `is-new`. 배경 `brand-soft` → 투명, `dur-slow` × 6(약 1.5초) 한 번, ‘동작 줄이기’면 움직임 없음.
- `ReceiptSection`은 `id`(주소 `#saving` 스크롤 자리)와 `action`(머리 제목 바로 오른쪽 ⋯ 메뉴)을 받음.
- 머리 `extra`(예전 “이번 달 3/5 확인했어요 ›” `hg-receipt__link`)는 2026-11-18부터 W-01이 쓰지 않음(맨 위 머리 이동 링크로 옮김).

## 미리 보기 변형 (2026-11-18, W-11f ‘월급 계획 템플릿에 이렇게 들어가요’)

- 저장 전에 새 줄이 W-01 ‘저축·투자’ 묶음에 어떻게 들어가는지 보이는 작은 영수증. `ReceiptStage` > `ReceiptCard` 하나, 머리는 아바타·금액 없이 제목 한 줄(`hg-receipt__head hg-receipt__head--plain` + `hg-receipt__headtitle`, “월급 계획 템플릿”), 묶음 `ReceiptSection` “저축·투자” 하나, 합계 `ReceiptTotal` 한 줄. 비율 막대·범례·공유·편집 없음. 앱 `SavingPreview`(`features/salary/saving-preview.tsx`)가 그림.
- `ReceiptLine.badge`(2026-11-18): 이름 뒤 `Badge` `brand`(`hg-badge--brand`, 옅은 오렌지 판 + `brand-ink`, 예 “새로”). 이름과 `space-2` 띄움(`.hg-receipt__name .hg-badge`). 새 줄은 `fresh`도 같이 줘서 `is-new` 강조(한 번, ‘동작 줄이기’면 없음).
- 기존 줄은 최대 2개 + 회색 “외 n개”(금액 없음, `muted`). 새 줄은 맨 아래. 매달 0원이면 금액 자리 “매달 금액 없음”(`muted`).
- 합계 “미계획 금액 555만 원 → 525만 원”(`strong`), 모자라면 `short`(`danger`) “… → 30만 원이 모자라요”. 화살표는 글자(‘→’)라 뜻을 글자로 전함.

## 저축·투자 빈 묶음 (2026-11-18, W-01 5g)

- 저축·투자 줄도 같이 모으기 묶음도 없고 고칠 수 있는 화면이면, 묶음 줄 자리에 회색 한 줄(`hg-receipt__empty`, 14px `stone`) + 작은 이름 칩 줄(`hg-receipt__chips`, `Chip` `sm`, 줄바꿈 허용, 칩 6개 + 맨 끝 “직접 정하기”)을 보임. 아래 ‘+ 저축·투자 추가’(`ReceiptAdd`)는 그대로. 홈 H-10 빈 상태(2026-11-18 없앰)에서 옮겨 온 것.
