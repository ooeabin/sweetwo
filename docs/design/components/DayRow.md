# DayRow

> 2026-11-09 홈 일정 카드(H-05)를 없애 지금 쓰는 화면 없음(홈은 HomeHub 캘린더 타일).

홈 일정 줄(2026-11-03, H-05. 카카오톡 일정처럼). 한 카드(`hg-daylist`) 안에 최대 3줄. 주 날짜 띠(WeekStrip)는 홈에서 없앰.

- 줄(`hg-dayrow`, 버튼): 왼쪽 날짜 칸 48×52(`radius-lg`, 위 “10월” 11px 600, 아래 “22” 20px 700) / 이름 15px 500(2026-11-09 밀도, 600에서) + 요일 13px `stone`. 줄 사이 선 없음(2026-11-09) / 오른쪽 D-day 14px 600 `slate`.
- 날짜 칸 색은 종류별 옅은 영역 색 + 진한 글자: 월급날 `invest`, 월급 전 확인 `safety`, 경조사 `together`, 목표 기한 `goal`, 만기 `family`(`hg-dayrow__date--{tone}`). 색만으로 뜻을 전하지 않음(이름이 있음).
- 화면 읽기 이름은 줄 전체 하나(“월급 전 확인, 10월 22일 목요일, D-15”).
- 클래스: `hg-daylist`, `hg-dayrow`, `__date`(`--invest|safety|together|goal|family`), `__text`, `__dday`.
