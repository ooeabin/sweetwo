# Button

둥근 사각형 버튼(`radius-btn` 14px, 높이 52px, 글자 16px 700. 2026-11-09 글자 단계를 한 단계 줄일 때 버튼은 예외로 그대로: 52px 누르는 칸과 플랫폼 버튼 글자 크기에 맞춤. 작은 버튼 36px `radius-btn-sm`, 글자 14px 600. 글자 링크 14px 600). 2026-11-02 레퍼런스(배민, 카카오뱅크, 현대카드) 맞춰 14px 600에서 키움. 화면당 주 버튼(`hg-btn--primary`, 오렌지)은 1개, 하는 일을 동사로 씀(“다음”, “좋아요”).

- 소비자가 주는 것: 글자, 변형 클래스, `disabled` 여부.
- `hg-btn--primary`: 화면의 주 행동. `brand` 바탕 + `on-brand`, 누름 `brand-pressed`.
- 축하 순간에도 같은 주 버튼. 오렌지는 주 버튼에만, 보조 버튼에는 쓰지 않음.
- `hg-btn--secondary`: 보조 행동. `surface-alt` 바탕, 테두리 없음(카드 안은 옅은 오렌지 `brand-soft` 바탕 + `brand-ink` 글자.)(“다르게 해볼래요”, “나중에 할게요” 버튼형).
- `hg-btn--ghost`(알약, 36px), `hg-btn--link`: 덜 중요한 행동, 글자 버튼(14px 600). 기본은 진한 회색 `ink-2`(고치기, 바꾸기, ‘월급 계획 고치기’, 더 보기). 2026-11-09 글자 버튼은 모두 이 회색(‘모두 보냈어요’, ‘월급 알려 주기’, ‘기한 정하기’, ‘완료’도 같음). 오렌지 글자 변형 `hg-btn--accent`는 없앰(클래스도 지움, 붙여도 아무 일 없음). 로그인·잠금 화면은 `slate`. 어드민·웹사이트는 `--link-sub`로 예전 파랑.
- 건너뛰기·미루기 글자 버튼(‘나중에 할게요’, ‘나중에 보낼게요’, ‘건너뛸게요’, QuestionLayout `later`)은 `hg-btn--quiet`를 더해 `slate` 500(2026-11-03). 눈에 덜 띄게 해서 주 버튼과 경쟁하지 않음. 오렌지가 아니라 `slate`로 둠(2026-11-09). 글 속 링크(띠 안 링크 등)는 오렌지 대신 둘레 글자색 + 밑줄. 파랑은 사용자 앱에 쓰지 않음(어드민 글자 버튼만 `focus`).
- `hg-btn--danger`(`danger` 바탕 + `on-danger` 글자): 확인 Modal의 되돌릴 수 없는 실행 버튼에만. 옆 취소는 `secondary`.
- `hg-btn--link hg-btn--danger-text`(2026-11-09): 채움 없는 `danger` 글자 버튼(600). 되돌리기가 있는 지우기(W-01 금액 시트·편집 줄 ‘지우기’). 빨간 채움 버튼은 쓰지 않음.
- `hg-btn--outline`(2026-11-09): `surface` 바탕 + `hairline` 테두리 + `ink` 글자의 흰 보조 버튼. `surface-alt` 바탕 위에서 보조 행동(W-01 영수증 아래 ‘편집하기’). 마우스 올림 `hairline-soft`.
- 좁은 창 질문 화면의 주 버튼은 `hg-btn--block`으로 하단 고정.
- `hg-btn--kakao`: 카카오 공식 노란 브랜드 버튼(바탕 `#fee500` + 글자 `rgba(0,0,0,.85)`). 제공자 브랜드색 예외로, 라이트·다크 모두 노랑을 유지한다. A-02 카카오 로그인에만.
- 글자 앞에 마크가 필요하면 `hg-btn__mark`(20px)를 글자 앞에 둔다. 지금은 A-02 소셜 버튼(`ProviderMark`)에만. 구글 마크는 4색 고유색(워드마크처럼 토큰 예외), 카카오·애플 마크는 단색 `currentColor`.
- 비활성은 `disabled`: 입력 전 주 버튼. `surface-alt` 바탕 + `muted` 글자(2026-11-02, 보조 버튼보다 진해 보이던 것을 배민·당근처럼 옅게).
- 처리 중은 `is-loading` + `aria-busy`: 글자 자리에 도는 원, 너비 그대로, 두 번 누르기 막음. 0.3초 넘을 때만 보여 줌. 원 색: 주 버튼 `on-brand`, 보조·고스트·링크 `ink`.
  - React(2026-11-06): `Button loading`. 누르는 순간 `aria-busy`와 누르기 막음(제출 포함), 0.3초가 넘으면 `is-loading`(`useLoadingShown`). 처리 중에 `disabled`를 같이 주지 않음(회색으로 바뀌어 도는 원이 안 보임). QuestionLayout `primary`·`later`·`secondary`의 `loading`도 같음(처리 중에는 Enter 제출도 막음). 한 화면에 서버 일을 하는 버튼이 여럿이면 누른 버튼에만 `loading`(나머지는 그대로 두고 부르는 쪽에서 중복 실행만 막음). Modal `busy`, ConflictChoice `busy`도 실행 버튼(누른 쪽)의 `loading`으로.
- 움직임(2026-11-06): 색 바뀜 `dur-fast`. 마우스가 있는 기기에서 마우스 올림: 주 버튼 `brand-pressed`, 보조 `hairline-soft`(카드 안 옅은 오렌지는 조금 진하게), 고스트 `surface-alt`. 누르면 98% 크기(`dur-fast`). ‘동작 줄이기’면 크기 변화와 색 전환 없음.
