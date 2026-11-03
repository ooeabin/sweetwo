# GoalTile, GoalHero (2026-11-03)

목표 사진을 크게 보여 주는 목록 타일(G-01)과 상세 머리(G-02). 사진은 목표 지정 사진 또는 올린 사진(→ ArtPick, Illustrations ‘지정 그림’), 파일이 없으면 회색 빈 자리 + 템플릿 아이콘.

## GoalTile (`hg-goaltiles`, `hg-goaltile`)

- 격자: 칸 최소 160px(좁은 창 2열, 넓은 창 3~4열), 사이 `space-3`.
- 타일: `surface` 바탕 + `hairline-soft` 테두리, 모서리 `radius-xl`. 전체가 버튼(→ G-02).
- 위 사진 `hg-goaltile__photo`(4:3, 꽉 채움). 배지는 사진 위 왼쪽 `hg-goaltile__badges`.
- 아래 `hg-goaltile__body`: 이름(15px 600, 한 줄 …) → 금액(13px `slate`) → 막대 `hg-goaltile__bar`(6px, `goal-ink`) → 보조 줄 12px.
- 레퍼런스: Vivid, ANZ Plus 목표 고르기.

## GoalHero (`hg-goalhero`) + 묶음 카드(`hg-goalbox`)

- 사진 `hg-goalhero__photo`: 16:10, 최대 320px, 넓은 창 모서리 `radius-2xl`, 좁은 창은 양옆 여백 없이 모서리 없음.
- ‘사진 바꾸기’ `hg-goalhero__change`: 사진 오른쪽 아래 흰 알약(카메라 + 글자).
- 판 `hg-goalhero__sheet`: 사진 위로 24px 올라오는 둥근 판. 배지 → 이름(22px 700) → 모은 돈(28px 700) → 버튼 2개 `hg-goalhero__actions`(보조 / 주).
- 묶음 카드 `hg-goalbox`: 머리(16px 600 + 오른쪽 글자 링크) → 막대 8px → 보조 줄(13px `slate`, 기한은 밑줄 버튼 `hg-goalbox__metabtn`). 사람별 줄 `hg-goalbox__person`(Avatar 24px + 이름 + 금액).
- 영역 사이 32px.
- 레퍼런스: ANZ Plus(사진 히어로), Monzo(묶음 카드).
