# ReceiptCard

월급 계획을 영수증 한 장으로 보여 주는 카드(2026-11-09, W-01 월급 계획). 바탕 `ReceiptStage`(`hg-receipt-stage`, `surface-alt`) 위에 `surface` 카드(`hg-receipt`). 위 모서리는 `radius-xl`, 아래 가장자리는 뜯은 종이처럼 톱니(CSS `mask` conic-gradient, 한 칸 14px = 깊이 7px, `--hg-receipt-tooth`). 그림자·테두리 없음. 숫자·문구·퍼센트·금액 가리기·공개 범위는 쓰는 쪽이 줌.

- 바탕: `hg-receipt-stage` 안쪽 16px(아래 24px), 넓은 창은 `radius-xl` 판, 좁은 창은 좌우 끝까지(모서리 없음). 바탕 안 카드와 아래 버튼 줄은 최대 480px 가운데.
- 카드 안쪽 24px(좁은 창 좌우 20px), 아래는 톱니 깊이만큼 더.
- 머리(`ReceiptHead`, `hg-receipt__head`): 가운데 정렬. Avatar 40px(`hg-avatar--lg`, 둘이면 `hg-avatars`로 겹침) → 큰 금액(`text-number-lg` 700 24px, 숫자 너비 같게) → 아래 한 줄 13px `stone`. `onAmount`를 주면 금액이 버튼(눌러서 내 월급).
- 비율 막대(`ReceiptBar`, `hg-receipt__bar`): 높이 12px, 칸 사이 3px, 칸마다 `radius-full`, 칸 최소 12px. 저금 `accent-app`(`--saving`), 지출 `hairline`(`--spend`), 여유 자금 `stone`(`--free`). 0%인 칸은 그리지 않음. 막대는 `role="img"` + 문장 이름. 아래 가운데 범례(12px 500 `slate`, 작은 네모 10px). 모자람이면 범례 그 칸에 `is-short`(`danger` 글자). 퍼센트 계산은 core `planRatio`(가장 큰 나머지 방식, 계산·배분 3-5).
- 묶음(`ReceiptSection`, `hg-receipt__sec`): 위 `hairline-soft` 선, 머리 = 제목(15px 600 `ink`) + 오른쪽 소계(12px 500 `stone`).
- 줄(`ReceiptRows`, `hg-receipt__row`): 두 칸. 왼쪽 이름 15px 500 `slate`(2026-11-09 400에서), 오른쪽 금액 15px 500 `ink`(오른쪽 정렬, 숫자 너비 같게). 줄 앞 아이콘·줄 사이 선 없음, 줄 높이 최소 40px. `onOpen`이 있으면 줄 전체가 버튼(금액 시트). 보기만이면 오른쪽 자물쇠(Phosphor `lock`, `stone`).
- 묶음 끝 글자 버튼(`ReceiptAdd`, `hg-receipt__add`): 14px 500 `stone`(“+ 저금 추가”, “+ 지출 추가”). 그 아래 이름 칩 줄은 `hg-receipt__chips`(Chip `sm` + 글자 칸).
- 합계(`ReceiptTotal`): 같은 두 칸 줄. `strong`이면 금액 15px 700, `short`면 이름·금액 모두 `danger`(모자람, W-01 확정 2026-11-09).
- 편집 모드(`ReceiptRows edit`): 줄 왼쪽 손잡이(Phosphor `dots-six-vertical`, 24px 칸, `stone`, 끌면 같은 목록 안에서 자리 바꿈, 끄는 줄은 `surface` + `shadow-1`). 키보드는 줄 안에 포커스가 오면 보이는 위·아래 IconButton(작은 고스트), 옮기면 숨은 `aria-live` 한 줄. 지우기는 `danger` 글자 버튼(`hg-btn--link hg-btn--danger-text`, 채움 없음): 마우스 기기는 편집 모드에서 늘 보이고, 터치(`pointer: coarse`)는 줄을 왼쪽으로 밀면(`is-open`) 보임. 포커스가 오면 터치에서도 보임.
- 카드 아래(`hg-receipt-actions`): 꽉 찬 `hg-btn--outline`(흰 테두리 보조 버튼, ‘편집하기’) 한 줄 + 가운데 글자 버튼 줄(‘공유하기’ `hg-btn--link`, ‘추천값으로 다시 채우기’ `hg-btn--quiet`).
- 다크 모드는 토큰 그대로(바탕 `surface-alt`가 카드보다 밝음). ‘동작 줄이기’면 줄 배경 전환 없음.
- 이미지 공유(W-01 ‘공유하기’)는 앱이 같은 숫자와 같은 토큰 색(그때 테마)으로 canvas에 다시 그림(`features/salary/receipt-image.ts`). 이 카드 모양(톱니, 막대, 범례, 묶음 선)을 그대로 따름.
