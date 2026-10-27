# Banner

화면 위 안내 띠. 지금 상태 때문에 할 수 있는 일이 달라질 때만.

- 소비자가 주는 것: 문장 1줄, 행동 링크 1개(선택).
- `hg-banner--info`(`surface-alt`): 오프라인, 연결 해제 대기, 혼자 쓰기, 월말 확인할 때(“10월 월급, 빠진 게 있는지 확인할 때예요”). 띠에는 브랜드 색을 쓰지 않음.
- 화면당 1개. 닫기는 상태가 풀리면 저절로.

## 할 일 카드 (`hg-banner--todo`, 2026-10-27, 카카오뱅크 알림 카드 느낌)

- 홈 할 일 한 줄(H-06)만. 흰 카드(`hairline-soft` 테두리 + `shadow-1`, `radius-xl`, 안쪽 16px 20px, 좁은 창 16px), 글자 15px 600.
- 맨 앞 그림 원(`hg-banner__icon`, 40px `surface-alt` 원 + `ink` 아이콘): 연결 해제·다시 연결 `link`, 월말 확인 `check`, 초대 `user`, 금액 정하기 `pencil`, 만기 `piggy-bank`, 챙길 날 `gift`. 그림은 `aria-hidden`.
- 오른쪽 보조 버튼 1개(‘열기’, 초대는 ‘코드 복사’) → 닫을 수 있는 것만 끝에 X 아이콘 버튼(`IconButton` ghost small, 이름 “닫기”).

## 공지 한 줄 (`hg-banner--line`, 현대카드 공지 띠 느낌)

- 어드민 공지(AD-10) 띠. `surface-alt` 바탕, `radius-xl`, 맨 앞 `info` 16px(`slate`).
- 제목은 한 줄, 넘치면 말줄임(`hg-banner__one`). ‘보기’로 펼치면 줄바꿈해서 다 보임.

