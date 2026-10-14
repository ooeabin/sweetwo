# Cursor에서 쓰는 법

- 규칙 본문은 `CLAUDE.md` 하나예요. Claude Code와 Cursor가 같은 규칙을 따르도록 내용을 두 군데 두지 않아요.
- Cursor는 `.cursor/rules/sweetwo.mdc`(항상 적용)가 `CLAUDE.md`를 불러와요. 규칙을 바꿀 때는 `CLAUDE.md`만 고치면 돼요.
- 채팅이나 Agent에서 화면을 만들 때는 화면 ID와 문서를 같이 붙여 주세요.
  - 예: `@docs/spec/21-month-close.md @docs/design/components/SpendItems.md W-04j 지출 입력 화면 만들어 줘`
- 기획, 디자인, 규칙이 바뀌는 변경이면 같은 변경에서 `docs/` md도 고치라고 규칙에 적혀 있어요. Agent가 코드만 바꾸고 끝내면 “문서도 맞춰 줘”라고 한 번 더 말해 주세요.
- 새 폴더별 규칙이 필요하면 `.cursor/rules/`에 mdc를 추가하되, 공통 규칙은 `CLAUDE.md`에 둬요.
