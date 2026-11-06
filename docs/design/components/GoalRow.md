# GoalRow

홈 목표 목록 줄(2026-11-03, H-02. 카카오T·카카오페이 진행 막대처럼). 큰 목표 카드 하나 대신 한 카드(`hg-goallist`) 안에 줄 최대 4개.

- 줄(`hg-goalrow`, 버튼): 왼쪽 그림 칸 40px(Lead, 목표 템플릿 아이콘·그림) / 이름 16px 600(내 목표는 작은 Badge “나”) + 아래 금액 줄 13px `stone`(“95만 / 1억 5,000만 원”) / 오른쪽 % 20px 700 / 맨 아래 얇은 막대 6px(`surface-alt` 위 `chart-goal`, 둥근 끝).
- 모은 돈이 있는데 1% 미만이면 막대를 2%만큼 채움(빈 막대가 안 모은 것처럼 보여서). 금액 없는 목표는 % 자리에 “금액 정하기”(`focus` 파랑 글자), 막대 없음.
- 줄 사이 `hairline-soft` 선, 줄 위아래 12px. 누르면 목표 상세.
- 클래스: `hg-goallist`, `hg-goalrow`, `hg-goalrow__name`, `__pct`, `__set`, `__sub`, `__bar`.
- 막대 색(2026-11-03): `success` 파랑, 바탕 `success-soft`(목표 타일·상세 카드와 같음).
