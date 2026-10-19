# Button

둥근 사각형 버튼(`radius-btn` 14px, 높이 52px, 작은 버튼 36px `radius-btn-sm`). 화면당 주 버튼(`hg-btn--primary`, 분홍)은 1개, 하는 일을 동사로 씀(“다음”, “좋아요”).

- 소비자가 주는 것: 글자, 변형 클래스, `disabled` 여부.
- `hg-btn--primary`: 화면의 주 행동. `brand` 바탕 + `on-brand`, 누름 `brand-pressed`.
- 축하 순간에도 같은 주 버튼. 분홍은 주 버튼에만, 보조 버튼에는 쓰지 않음.
- `hg-btn--secondary`: 보조 행동. `surface-alt` 바탕, 테두리 없음(회색 카드 안에서는 `surface`)(“다르게 해볼래요”, “나중에 할게요” 버튼형).
- `hg-btn--ghost`(알약, 36px), `hg-btn--link`: 덜 중요한 행동, 글자 링크.
- `hg-btn--danger`(`danger` 바탕 + `on-danger` 글자): 확인 Modal의 되돌릴 수 없는 실행 버튼에만. 옆 취소는 `secondary`.
- 좁은 창 질문 화면의 주 버튼은 `hg-btn--block`으로 하단 고정.
- `hg-btn--kakao`: 카카오 공식 노란 브랜드 버튼(바탕 `#fee500` + 글자 `rgba(0,0,0,.85)`). 제공자 브랜드색 예외로, 라이트·다크 모두 노랑을 유지한다. A-02 카카오 로그인에만.
- 글자 앞에 마크가 필요하면 `hg-btn__mark`(20px)를 글자 앞에 둔다. 지금은 A-02 소셜 버튼(`ProviderMark`)에만. 구글 마크는 4색 고유색(워드마크처럼 토큰 예외), 카카오·애플 마크는 단색 `currentColor`.
- 비활성은 `disabled`: 입력 전 주 버튼. `hairline` 바탕 + `stone` 글자.
- 처리 중은 `is-loading` + `aria-busy`: 글자 자리에 도는 원, 너비 그대로, 두 번 누르기 막음. 0.3초 넘을 때만 보여 줌. 원 색: 주 버튼 `on-brand`, 보조·고스트·링크 `ink`.
