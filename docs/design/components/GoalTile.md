# GoalTile, GoalHero (2026-11-03)

> 2026-11-08 없앰(ADR 0007): 목표 탭(G-01)과 목표 상세(G-02)가 없어져 GoalTile과 GoalHero(사진 머리, − + 버튼)는 쓰지 않음. 묶음 카드 `hg-goalbox`(머리 + 막대 + 보조 줄)만 저금 항목 상세(W-10)의 목표 금액 카드·매달 카드로 씀. CSS는 쓰는 곳 0을 확인한 뒤 2단계로 지움.

목표 사진을 크게 보여 주는 목록 타일(G-01)과 상세 머리(G-02). 사진은 목표 지정 사진 또는 올린 사진(→ ArtPick, Illustrations ‘지정 그림’), 파일이 없으면 회색 빈 자리 + 템플릿 아이콘.

## GoalTile (`hg-goaltiles`, `hg-goaltile`)

- 격자: 칸 최소 160px(좁은 창 2열, 넓은 창 3~4열), 사이 `space-3`.
- 타일: `surface` 바탕 + `hairline-soft` 테두리, 모서리 `radius-xl`. 전체가 버튼(→ G-02).
- 위 사진 `hg-goaltile__photo`(4:3, 꽉 채움). 배지는 사진 위 왼쪽 `hg-goaltile__badges`.
- 아래 `hg-goaltile__body`: 이름(15px 600, 한 줄 …) → 금액(12px `slate`) → 막대 `hg-goaltile__bar`(6px, `accent-app` 오렌지 + `surface-alt` 바탕(2026-11-09), 모은 금액이 없으면 “아직 모은 금액이 없어요”) → 보조 줄 하나(12px, 한 줄 …, 늦어요 > 이번 달 > 매달·예상).
- 링크(‘월급 계획에서 저금 늘리기’)와 파트너 변경 안내는 타일 안 아래 칸 `hg-goaltile__foot`. 타일 본문은 `hg-goaltile__main` 버튼(→ G-02).
- 레퍼런스: Vivid, ANZ Plus 목표 고르기.

## GoalHero (`hg-goalhero`) + 묶음 카드(`hg-goalbox`)

- 사진 `hg-goalhero__photo`: 16:10, 최대 320px, 넓은 창 모서리 `radius-2xl`, 좁은 창은 양옆 여백 없이 모서리 없음.
- ‘사진 바꾸기’ `hg-goalhero__change`: 사진 오른쪽 아래 흰 알약(카메라 + 글자).
- 판 `hg-goalhero__sheet`: 사진 위로 24px 올라오는 둥근 판. 배지 → 이름(20px 700) → 금액 줄 `hg-goalhero__amountrow`(2026-11-04: 왼쪽 모은 금액 24px 700, 오른쪽 `hg-goalhero__steps` 안 44px 둥근 버튼 `hg-goalhero__step` − + (`surface-alt`, 테두리 없음, IconButton 이름 ‘빼기’ ‘넣기’)). 금액 위 ‘모은 금액’ 이름표 `hg-goalhero__label`(12px `slate`). 판에 다른 버튼 없음(2026-11-04). 보류면 판 배지에 ‘보류’, 판 아래 보류 카드(머리 글 + 보조 버튼 ‘다시 모으기’). 달성·보류는 매달 카드 없음.
- 묶음 카드 `hg-goalbox`: 머리(15px 600 + 오른쪽 글자 링크) → 막대 8px → 보조 줄(12px `slate`, 기한은 밑줄 버튼 `hg-goalbox__metabtn`). 사람별 줄 `hg-goalbox__person`(Avatar 24px + 이름 + 금액). 2026-11-12(QA 7구간): W-10 모은 금액은 누르는 버튼 `hg-goalbox__jump`(바탕·테두리 없음, 왼쪽 맞춤, 누르면 저금 내역으로, S7-10). `hg-goalbox__metabtn`·`hg-goalbox__jump`·`hg-foldrow`도 다른 버튼과 같은 잉크 포커스 링(2px, 2px 떨어짐, S7-14). 연결 해제 대기 중 `hg-goalbox__metabtn:disabled`는 밑줄 없음.
- 영역 사이 32px.
- 레퍼런스: ANZ Plus(사진 히어로), Monzo(묶음 카드).
- 상태 배지(2026-11-03): 사진 위 왼쪽, 달성 `achieved`(옅은 오렌지 판 + `brand-ink` 글자, 2026-11-09), 보류 `temp`(2026-11-04 사용 완료 없앰). 막대 색은 `accent-app` 오렌지(바탕 `surface-alt`, 2026-11-09, 홈 GoalRow와 W-10 `hg-goalbox__bar`도 같음).
- 접힌 목록 펼치기 줄 `hg-foldrow`: `plate` 바탕 가득 찬 줄(48px) + 화살표.

- 2026-11-08: 그림·아이콘 자리는 2D 플랫으로 다시 만들 때까지 빈 자리(회색 판 `hg-artslot`이나 빈 원·빈 칸). 이 문서의 3D·사진·Phosphor 그림 설명은 다시 만들 때의 주제(→ Illustrations ‘나중 과제’).
