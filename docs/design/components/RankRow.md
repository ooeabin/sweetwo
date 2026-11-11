# RankRow

자산 순위 줄(2026-11-04, 23 F-01 0번. 19 H-01 1a 홈 줄은 2026-11-11 없앰). 혜택 줄처럼 한 줄: 왼쪽 44px 원 + 제목 + 회색 글자 버튼(2026-11-09).

- 원 `hg-rankrow__badge`: `invest` 바탕 + `invest-ink` 13px 800. 안 봄·자산 없음 “?%”, 본 뒤 “38%”.
- 제목 `hg-rankrow__title`: 15px 600 `ink`, 줄바꿈 keep-all.
- 글자 `hg-rankrow__action`: 14px 600 `ink-2`(글자 버튼 `hg-btn--link`와 같음. 2026-11-09 500 `focus` 파랑 → 오렌지 → 회색)(“확인하기”, “10월 기준, 자세히 보기”, “새로 확인하기”). 자산이 없으면 F-01에서는 없음, 홈에서는 “자산 입력하기”(2026-11-04).
- 광고 표시 `hg-rankrow__ad`: 광고가 나오는 상태(안 봄, 지난번)에만 글자 버튼 앞 작은 회색 ‘광고’(`surface-alt` 바탕, 11px 600 `slate`). AdMob 보상형 광고 정책상 누르기 전에 광고를 알림(ADR 0006).
- 누를 수 있으면 `button`(포커스 링 2px `focus-ring`), 누를 수 없으면(자산 관리 빈 상태) `div`.
- React: `RankRow({ badge, title, action, ad, adLabel, onClick })`. 앱은 `RankBanner`(frame)가 상태(7-7)와 광고 흐름을 맡음.
