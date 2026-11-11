# CodeCells

초대 코드 6자를 한 글자씩 칸에 보여 주거나(CodeCells) 넣는다(CodeInput). 2026-11-11 사용자 결정(QA 3구간 디자인): 회색 큰 상자 한 줄 글자와 일반 입력 칸 대신, 보내는 쪽과 받는 쪽이 같은 칸을 본다(참고: Shop·Family 인증 코드 칸, Places 초대 코드 칸).

- 칸: 6칸 한 줄, 사이 `space-2`, 칸 넓이는 줄을 나눠 갖되 최대 52px, 높이 60px, `radius-lg`, `plate` 바탕, 글자 26px 700 `ink`.
- 보여 주기 `CodeCells`(`hg-codecells`, `hg-codecell`): O-07 시트·S-12 코드 상자(`hg-invite-code`, 아래 “눌러서 복사”, 묶음 전체가 복사 버튼, 마우스 올리면 칸이 `hairline-soft`), P-01 합류 시작·A-07 합류 불가(`hg-invite-code--static`). 칸은 `aria-hidden`, 읽는 글은 소비자가 따로(“초대 코드 K 7 M 2 Q X”).
- 넣기 `CodeInput`(`hg-codeinput`): P-01 코드 직접 입력. 진짜 입력 칸 하나를 칸 위에 투명하게 겹쳐 붙여넣기·자동 채우기·라벨·화면 읽기를 그대로 쓴다. 빈 칸은 `hairline` 1px 테두리, 포커스가 있으면 넣을 칸만 `surface` 바탕 + `ink` 2px 테두리(이것이 포커스 표시, 다 채웠으면 모든 칸 `ink` 1px), 오류면 모든 칸 `danger` 2px. 커서는 늘 끝, 지우기는 뒤에서부터.
- 코드: `packages/ui/src/components/CodeCells.tsx`.
