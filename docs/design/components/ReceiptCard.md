# ReceiptCard (줄 목록 ReceiptRows)

2026-11-19: W-01의 카드 틀(바탕·요약·묶음 카드·블록 버튼)은 `PlanSummary.md`로 옮김. 예전 톱니 영수증 카드(`ReceiptCard`, `ReceiptHead`, `ReceiptStage`, `ReceiptTotal`, `PlanBar`, `ReceiptSection`, `ReceiptAdd`)와 `hg-receipt`, `hg-receipt-stage`, `hg-receipt__bar`·`__legend`·`__sec`·`__add` 같은 CSS는 없앰. 이 문서는 카드 안 줄(`ReceiptRows`, `ReceiptLine`)만 다룸. 달 결과 공유 이미지(`receipt-image.ts`)는 앱이 canvas로 그리는 예전 영수증 모양 그대로.

## 줄 (`ReceiptRows`, `hg-receipt__row`)

- 두 칸: 왼쪽 이름(`hg-receipt__name`, 16/22 600 `ink`) + 이름 아래 회색 보조 한 줄(`note`, `hg-receipt__note`, 13/18 `slate`, 위 3px), 오른쪽 금액(`hg-receipt__amt`, 16/22 700, 오른쪽 정렬, 숫자 너비 같게). 보조 줄이 있으면 금액은 이름 줄 높이(위쪽 맞춤), 없으면 줄 가운데. 줄 높이 64px 이상, 줄 앞 아이콘·줄 사이 선 없음.
- `note` 이음(2026-11-19 짧게): 자동 정보가 맨 앞 “25일 자동, 모은 금액 2,200,000원, 목표 금액의 22%”(core `joinLineNote`, 모은 금액 0원이면 “모은 금액 0원”을 빼고 목표만 “목표 금액 3,000,000원”, core `savingLineNote`). 보조 줄은 한 줄(`white-space: nowrap` + 말줄임)이라 넘치면 뒤가 `…`. 지출 줄은 “1일 자동” / “월급날 자동”.
- `progress`(`{ percent }`): 보조 줄 아래 4px 진행 막대(`hg-receipt__progbar`, 140px, `bar-track` 바탕 위 `accent-app`). 그래픽이라 `aria-hidden`, 뜻은 `note`의 “목표 금액의 23%”.
- `go`(2026-11-26 사용자 결정): 누르면 다른 화면으로 가는 줄(W-01 저축·투자 줄 → W-10)은 금액 오른쪽 ›(`hg-receipt__go`, Phosphor `chevron-right` 16 `stone`, 금액과 4, 보조 줄이 있으면 이름 줄 높이). 금액 시트만 여는 줄(지출 줄)은 › 없음 → 두 묶음의 금액 끝선이 20 다름(지출 줄에도 › 를 둘지는 [확인 필요]). 편집 모드에서는 숨김. `progress`는 0%면 앱이 주지 않음(W-01, 막대 안 그림).
- W-01 묶음(`hg-plancard`) 안 줄은 이름과 보조 줄 사이 2(2026-11-26, 위아래 안쪽 12 그대로). W-02 줄은 그대로.
- `onOpen`이 있으면 줄 전체가 버튼(금액 시트, 저축·투자 줄은 W-10). 보기만이면 오른쪽 자물쇠(Phosphor `lock`, `stone`). `fresh`: 줄에 `is-new`, 이름·금액 글자만 `accent-app-text` → 원래 색(바탕·여백 변화 없음), ‘동작 줄이기’면 전환 없음.
- 편집 모드(`edit`): 줄 왼쪽 손잡이(Phosphor `dots-six-vertical`, 끌면 같은 목록 안에서 자리 바꿈, 끄는 줄은 `surface` + `shadow-1`), 줄에 포커스가 오면 보이는 위·아래 IconButton, 옮기면 숨은 `aria-live` 한 줄, 지우기는 Phosphor `minus-circle` IconButton(`hg-receipt__del`, `ink-2`, 44px, 화면 읽기 “{이름} 지우기”, 늘 보임, 오른쪽 끝은 다른 금액 끝과 맞춤, 터치에서 줄을 왼쪽으로 미는 것도 그대로). 편집 중에는 보조 줄·막대를 숨김.
- 카드 아래(`hg-receipt-actions`): 가운데 글자 버튼 줄(2026-11-26 꽉 찬 ‘편집하기’는 없애고 머리 오른쪽 ‘편집’, AppFrame.md)(‘공유하기’ `hg-btn--link`, ‘추천값으로 다시 채우기’ `hg-btn--quiet`).
- 새 줄 강조(2026-11-23): `is-new` 줄은 바탕·안쪽 여백이 바뀌지 않고 이름·금액 글자만 2초간 `accent-app-text`로 보였다가 0.5초 동안 원래 색으로 돌아옴(화면이 2.5초 뒤 클래스를 뗌, 사용자 결정으로 옅은 오렌지 바탕을 없앰). ‘동작 줄이기’면 전환 없이 2초 뒤 원래대로. 줄마다 `data-row-id`가 있어 화면이 그 줄로 스크롤함. 편집 모드 지우기는 글자 버튼이 아니라 아이콘 버튼(2026-11-23).
