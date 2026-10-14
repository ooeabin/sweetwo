# Select

목록에서 하나 고르기. 선택지가 6개를 넘거나 화면 공간이 좁을 때(그 밖에는 Selection의 카드형).

- 소비자가 주는 것: 라벨, 선택지, 현재 값.
- 닫힌 모양은 입력 칸과 같은 높이·테두리(48px `button`, `aria-haspopup="listbox"` + `aria-expanded`), 오른쪽 `chevron-down`(열리면 `chevron-up`).
- 열린 메뉴는 `hairline` 테두리 + `shadow-2`, `role="listbox"`. 고른 항목은 `surface-alt` + 굵게 + `aria-selected`.
- 좁은 창에서는 BottomSheet로 열림.
