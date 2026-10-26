# TransferRow

이번 달 월급 체크리스트 줄 한 행(W-02, 홈 H-03, W-05, 재기획 ADR 0003). 은행 앱에서 보낸 뒤 체크하면 한 것으로 기록. 앱이 돈을 옮기지는 않음.

- 소비자가 주는 것: 줄 이름(저금 줄은 목표 이름, 쓰는 돈 줄은 고정지출·생활비·용돈·직접 추가 이름), 보조 줄, 금액, 체크 상태, 줄 아래 글자 링크.
- 보조 줄: “예빈님이 10월 26일에 체크했어요” / “이번 달은 못 했어요” / 다른 금액이면 실제 금액.
- 체크는 `success` 원 + 흰 체크. 체크한 줄은 글자를 `stone`으로 낮춤. ‘못 함’ 줄도 체크된 모양 + 보조 줄로 구분.
- 체크는 `button role="checkbox"` + `aria-checked`, `aria-label`은 “{줄 이름} 체크”.
- 줄 아래 글자 링크: ‘다른 금액으로 보냈어요’(W-02a), W-05 ‘이번 달은 못 했어요’.
- React 래퍼 `TransferRow`(packages/ui): `label`, `meta`(보조 줄), `amount`, `done`, `checkLabel`, `onToggle`, `disabled`(볼 수만), `badge`, `actions`(줄 아래 글자 링크).
