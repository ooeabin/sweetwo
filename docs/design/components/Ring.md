# Ring

묶음 진행 원(2026-10-27, 카카오뱅크 체크리스트 머리처럼). 원 안에 한 개수/전체(“2/4”), 둘레를 한 만큼 채움.

- 소비자가 주는 것: 한 개수, 전체 개수, 화면 읽기 문장(“5개 중 2개 했어요”).
- 36px 원, 둘레 3px. 채움 `ink`, 빈 둘레 `surface-alt`. 글자 12px 600 `tabular-nums`.
- `role="img"` + `aria-label`(문장). 원 안 숫자는 화면 읽기에서 숨김.
- 쓰는 곳: SectionHeader `lead`(W-02 저금·쓰는 돈 묶음 머리, 홈 H-03 월급 카드 머리).
- React 래퍼 `Ring`(packages/ui): `done`, `total`, `label`.
