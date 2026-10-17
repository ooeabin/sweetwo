# Modal

되돌릴 수 없는 행동 앞의 확인 대화상자. 데스크톱·넓은 창 웹에서 씀(좁은 창은 BottomSheet).

- 소비자가 주는 것: 제목 1줄, 본문 1~2줄, 버튼 2개(취소 + 실행).
- 쓰는 곳: 영구 삭제, 연결 끊기, 계정 삭제만. 보관·지우기(휴지통)는 Modal 없이 Toast “되돌리기”.
- 실행 버튼은 하는 일 그대로(“지울게요”), `hg-btn--danger`(`danger` 바탕 + `on-danger` 글자), 오른쪽 끝. 취소는 `hg-btn--secondary` 그 왼쪽. `danger` 바탕은 영구 삭제·연결 끊기·계정 삭제 확인 버튼에만.
- `role="alertdialog"` + `aria-modal`, 제목을 `aria-labelledby`로.
- 다크에서 보이도록 `hairline` 테두리.
- 뒤 막은 `scrim`. Esc·바깥 누르면 취소. 포커스는 모달 안에 가둠.
- React 래퍼: `@sweetwo/ui` `Modal`(제목, 본문, 실행·취소 글자, onConfirm, onCancel). 바탕은 `hg-scrim`을 화면 전체에 고정(`position: fixed`).
