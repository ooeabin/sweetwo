# SaveTogether

같이 모으기 상자(2026-11-13, ADR 0009). 홈 주인공 H-10과 W-10 맨 위 묶음 카드, W-13 묶음 줄이 같은 생김새를 씀. 기획 → 19 ‘홈 v2.2’, 20 W-10·W-15, 계산 → 06 5-3b·5-6. 클래스는 PR 9·10에서 `bundle.css`에 더하고 `pnpm ds:sync`.

- 틀(`hg-together`): 흰 상자 `radius-xl`, 안쪽 20px, 바탕 `surface`(홈 회색 바탕 위). 테두리·그림자 없음, 누름 98%, 키보드 포커스 ink 링
- 머리(`hg-together__head`): 왼쪽 “같이 모으기”(13px 600 `slate`) + 오른쪽 D-day 알약(`hg-hubtile__badge`와 같은 알약, “결혼식 D-142”, 결혼 준비 중이고 예정일이 있을 때만). 예정일이 없으면 알약 대신 글자 버튼 “결혼식 날짜 알려 주기”(`hg-btn--link`)
- 사람(`hg-together__people`): 이름 왼쪽 겹친 Avatar 둘(`hg-avatars`, 28px). 미합류면 내 Avatar 하나(빈 원 없음)
- 이름 + 큰 숫자: 저금 이름 15px 600 `ink-2`, 모은 금액 `text-number-lg`(숫자 너비 같게). 금액 가리기면 “•••”
- 막대(`hg-together__bar`): 목표 금액이 있을 때만. 10px 둥근 막대, 바탕 `surface-alt`, 채움 `accent-app`(저금 진행이라 오렌지, CLAUDE.md 색 규칙). 모은 금액이 있으면 최소 2%. 막대 아래 “목표 금액 5,000만 원의 62%”(13px 500 `slate`)
- 보조 줄(13px 500 `slate`, 순서대로, 있을 때만): “이번 달 +190만 원” → 기한 “2027년 5월까지 1,200만 원 더 필요해요” → 각자 금액 “{이름} 2,100만 원, {이름} 1,500만 원”(두 사람 모두 켰을 때만). 줄마다 두 줄까지, 말 단위 줄바꿈
- 퍼센트만 상태(`hg-together--percent`): 큰 숫자 자리에 “62%”, 막대 아래 목표 금액 문장 없음, ‘이번 달 +’ 줄 없음, 각자 금액 줄 없음. 기한 줄은 “2027년 5월까지”만(금액 없음) [확인 필요]
- 멈춤 상태(`hg-together--paused`, 해제 대기): 막대 채움을 `slate`로 낮추고 보조 줄 “같이 모으기를 잠시 멈췄어요”
- 다 모음: 막대 꽉 참 + 기한 줄 없음 + 오른쪽 위 “다 모았어요” 배지(Badge 달성 배지, `brand-soft` + `brand-ink`)
- 여러 개(홈만): 가로 넘김(`scroll-snap`, 최대 3칸 + 점 표시 `hg-together__dots`), 마지막 칸 “저금 모두 보기 ›” 회색 상자. ‘동작 줄이기’면 넘김 움직임 없이 바로
- 맨 아래 글자 버튼(`hg-addrow` 회색, 홈·W-10·W-13): “+ 돈 들어왔어요”
- 빈 상태(미합류·저금 0): “무엇을 같이 모을까요?” + 이름 칩 3개(Chip, 고르면 W-11a) + “+ 저금 만들기”. 그림 자리 없음(상자가 작아서)
- 화면 읽기: 상자 하나를 한 문장 `aria-label`(“같이 모으기, 결혼 비용, 3,100만 원, 목표 금액의 62%, 2027년 5월까지 1,900만 원 더 필요해요”), 막대는 장식(`aria-hidden`)
- 다크: 토큰 그대로
- React(packages/ui `SaveTogether.tsx`): `SaveTogether`(`title`, `people`, `name`, `amount`, `percent`, `target`, `thisMonth`, `deadlineLine`, `eachLine`, `percentOnly`, `paused`, `done`, `dday`, `onMoneyIn`, `label`, `onClick`), `SaveTogetherEmpty`(`chips`, `onPick`, `onAdd`)

쓰는 곳: 홈 H-10, W-10 묶음 카드(머리 없이), W-13 묶음 줄(막대와 합계만), 위젯 WG-01은 네이티브라 같은 규칙만 따름.
