# MonthBars

달마다 값 막대(2026-11-03, F-01 “달마다 순자산”). 선 그래프보다 한 달씩 비교하기 쉽고, 첫 화면에서 색이 있어 덜 심심하게.

- 최근 6달, 0에서 위로만. 칸은 늘 6개(달이 적으면 왼쪽을 비움), 최근 달이 오른쪽 끝.
- 색은 영역 색 한 가지(기본 `invest`): 지난 달 막대는 옅은 색(`--invest`), 이번 달 막대와 x축 글자, 막대 위 값은 진한 색(`--invest-ink`). `tone`으로 safety, goal, family, together. 다크 모드는 토큰이 처리.
- 막대 너비 최대 28px, 위 모서리 `radius-sm`, 아래 `radius-xs`. 가장 큰 값이 96px, 0이나 음수는 4px.
- 값 글자는 이번 달 막대 위에만(“1,600만”). 다른 달은 툴팁(`title`, “2026년 9월 1,420만 원”).
- 화면 읽기: 전체가 `role="img"`, 이름은 “달마다 순자산, 2026년 10월 1,600만 원”.
- React 래퍼 `MonthBars`(packages/ui): `bars`(key, label, value, tip, now), `label`, `nowText`, `tone`.
- 클래스: `hg-mbars`, `hg-mbars--{tone}`, `hg-mbars__col`(`is-now`), `hg-mbars__v`.
