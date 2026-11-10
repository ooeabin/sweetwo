# Search

찾기 칸 + 결과 목록 + 결과 없음. 목록 화면 안 거르기에 씀(좁은 창 앱 머리 검색 버튼은 2026-11-09 없앰)(넓은 창 빠른 실행은 CommandPalette).

- 소비자가 주는 것: 검색어, 결과 묶음(경조사·목표·자산 등), 결과마다 아이콘·이름·종류.
- 칸: 높이 44px 알약(`radius-full`), `border-control` 테두리, 왼쪽 `search` 16px, 오른쪽 지우기 IconButton `--sm`(`x`, 글자가 있을 때만). 포커스는 칸 전체 2px `ink` 링(어드민 상단 검색은 `focus`). `role="search"`.
- 자리표시 “찾기”(`stone`). 입력하면 바로 거름, 버튼 없음.
- 결과: 묶음 이름(`micro` `stone`) 아래 48px 줄. 맞은 글자만 굵게(`mark`), 오른쪽 종류는 `hg-tag`. 결과 목록 `role="listbox"`.
- 결과 없음: EmptyState 2줄 “찾는 게 없어요” + “다른 말로 찾아보세요”. 버튼 없음.
- 금액 가리기가 켜져 있으면 결과의 금액도 “•••”.
- React 래퍼: `@sweetwo/ui` `Search`(라벨, 값, onChange). 검색 결과 목록은 화면이 그림.
