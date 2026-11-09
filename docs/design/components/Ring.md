# Ring

묶음 진행 원(2026-10-27, 카카오뱅크 체크리스트 머리처럼). 원 안에 한 개수/전체(“2/4”), 둘레를 한 만큼 채움.

- 소비자가 주는 것: 한 개수, 전체 개수, 화면 읽기 문장(“5개 중 2개 완료”).
- 36px 원, 둘레 3px. 채움 `success`(파랑, 2026-11-03 체크 원과 같은 색), 빈 둘레 `surface-alt`. 글자 12px 600 `tabular-nums`.
- `role="img"` + `aria-label`(문장). 원 안 숫자는 화면 읽기에서 숨김.
- 쓰는 곳: SectionHeader `lead`(W-02 저금·쓰는 돈 묶음 머리, 홈 H-03 월급 카드 머리).
- 줄 앞 진행 원(2026-11-09, 목표 금액이 있는 저금 줄)은 Ring이 아니라 `Lead progress`(`hg-lead--ring`, 숫자 없음, 장식, 저금 영역색) → ListRow ‘진행 원’. 둘을 섞지 않음: Ring은 개수(“2/4”, `success`), 진행 원은 금액 비율.
- React 래퍼 `Ring`(packages/ui): `done`, `total`, `label`.
