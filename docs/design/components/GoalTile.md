# GoalTile, GoalHero (2026-11-03)

목표 사진을 크게 보여 주는 목록 타일(G-01)과 상세 머리(G-02). 사진은 목표 지정 사진 또는 올린 사진(→ ArtPick, Illustrations ‘지정 그림’), 파일이 없으면 회색 빈 자리 + 템플릿 아이콘.

## GoalTile (`hg-goaltiles`, `hg-goaltile`)

- 격자: 칸 최소 160px(좁은 창 2열, 넓은 창 3~4열), 사이 `space-3`.
- 타일: `surface` 바탕 + `hairline-soft` 테두리, 모서리 `radius-xl`. 전체가 버튼(→ G-02).
- 위 사진 `hg-goaltile__photo`(4:3, 꽉 채움). 배지는 사진 위 왼쪽 `hg-goaltile__badges`.
- 아래 `hg-goaltile__body`: 이름(15px 600, 한 줄 …) → 금액(13px `slate`) → 막대 `hg-goaltile__bar`(6px, `progress`, 모은 돈이 없으면 “아직 모은 돈이 없어요”) → 보조 줄 하나(12px, 한 줄 …, 늦어요 > 이번 달 > 매달·예상).
- 링크(‘이 돈을 썼나요?’, ‘월급 계획에서 저금 늘리기’)와 배우자 변경 안내는 타일 안 아래 칸 `hg-goaltile__foot`. 타일 본문은 `hg-goaltile__main` 버튼(→ G-02).
- 레퍼런스: Vivid, ANZ Plus 목표 고르기.

## GoalHero (`hg-goalhero`) + 묶음 카드(`hg-goalbox`)

- 사진 `hg-goalhero__photo`: 16:10, 최대 320px, 넓은 창 모서리 `radius-2xl`, 좁은 창은 양옆 여백 없이 모서리 없음.
- ‘사진 바꾸기’ `hg-goalhero__change`: 사진 오른쪽 아래 흰 알약(카메라 + 글자).
- 판 `hg-goalhero__sheet`: 사진 위로 24px 올라오는 둥근 판. 배지 → 이름(22px 700) → 금액 줄 `hg-goalhero__amountrow`(2026-11-04: 왼쪽 모은 돈 28px 700, 오른쪽 `hg-goalhero__steps` 안 44px 둥근 버튼 `hg-goalhero__step` − + (`surface-alt`, 테두리 없음, IconButton 이름 ‘빼기’ ‘넣기’)). 금액 위 ‘모은 돈’ 이름표 `hg-goalhero__label`(13px `slate`). 판에 다른 버튼 없음(2026-11-04).
- 묶음 카드 `hg-goalbox`: 머리(16px 600 + 오른쪽 글자 링크) → 막대 8px → 보조 줄(13px `slate`, 기한은 밑줄 버튼 `hg-goalbox__metabtn`). 사람별 줄 `hg-goalbox__person`(Avatar 24px + 이름 + 금액).
- 영역 사이 32px.
- 레퍼런스: ANZ Plus(사진 히어로), Monzo(묶음 카드).
- 상태 배지(2026-11-03): 사진 위 왼쪽, 달성 `achieved`(연한 파랑 바탕 + 파랑 글자, 2026-11-04), 보류·사용 완료 `temp`. 막대 색은 `progress`(채도를 낮춘 파랑, 2026-11-04. 바탕 `success-soft`, 2026-11-03, 홈 목표 줄 GoalRow도 같음).
- 접힌 목록 펼치기 줄 `hg-foldrow`: `plate` 바탕 가득 찬 줄(48px) + 화살표.
