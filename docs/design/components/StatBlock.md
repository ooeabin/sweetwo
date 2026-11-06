# StatBlock

토스형 구역 머리(2026-11-04, 23 F-08). 카드 없이 구역 맨 위에서 그 구역의 요점을 한 문장으로 보여 줌.

- 숫자형: 작은 라벨 `hg-statblock__label`(14px `slate`) → 큰 숫자 문장 `hg-statblock__big`(26px 700, 숫자 고정폭, “3,508만 원 남았어요”) → 보조 한 줄 `hg-statblock__sub`(14px `slate`).
- 제목형: 제목 `hg-statblock__title`(`h2`, 20px 700, “30대 가구와 비교”) → 보조 한 줄. 보조 줄 안 `<b>`는 강조 숫자(600 `invest-ink`, H-04 ‘지난달보다’와 같은 규칙).
- 아래에 목록이 오면 `hg-list hg-list--plain`(테두리·바탕·그림자 없이 왼쪽 이름 + 오른쪽 값 17px, 보조 14px `slate`).
- 목표 상세 숫자 칸 `hg-stat`(회색 판)과는 다른 것.
- React: `StatBlock({ label, big, title, sub, as, ariaLabel })`. 기본은 `section`, 다른 `section` 안이면 `as="div"`.

쓰는 곳: 우리 자산 순위(F-08) 다음 칸까지, 연령대 비교.
