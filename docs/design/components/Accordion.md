# Accordion

가이드·자주 묻는 질문을 접었다 폈다.

- 소비자가 주는 것: 질문(1줄), 답(2~4줄).
- 질문 줄 56px `button` + `aria-expanded`·`aria-controls`, 오른쪽 chevron(열리면 위로). 한 번에 여러 개 열 수 있음.
- 답은 `slate` 본문. 긴 설명은 링크로 가이드 화면에.
- React 래퍼: `@sweetwo/ui` `Accordion`(items: id·질문·답, onOpen).
- 2026-11-16 N-04 공지: 항목에 보조 줄 `sub`(날짜, `hg-acc__sub`, `stone` 13px)와 안 읽음 `unread`(새 알림 점 `hg-acc__dot` + 화면 읽기 글자 `unreadLabel`)를 줄 수 있음. `initialOpen`으로 처음부터 펼쳐 둘 항목 하나(홈 공지 띠 ‘보기’로 들어온 공지).
