# ProviderButton

A-02 소셜 로그인 버튼. `Button` + `ProviderMark`를 한 줄로 묶는다(기획서 15장).

- 소비자가 주는 것: `provider`(kakao·google·apple), 글자(children), `recent`·`recentLabel`(‘최근 사용’ 말풍선), `disabled`·`onClick`.
- 변형: 카카오는 공식 노란 브랜드 버튼(`hg-btn--kakao`), 구글·애플은 테두리 버튼(`hg-btn--secondary`). 이메일 충돌로 그 제공자를 강조할 때만 `variant="primary"`로 덮어쓴다.
- 마크(`ProviderMark`, `hg-btn__mark`)는 글자 앞. `hg-auth--login` 영역에선 버튼 왼쪽 고정·글자 가운데, 카카오 마크는 24px, 구글·애플은 연한 테두리(`hairline`)로 바뀐다(→ AuthLayout).
- ‘최근 사용’은 버튼 안 배지가 아니라 해당 버튼 위 오른쪽 말풍선 `hg-auth__recent`(꼬리 아래).
- 쓰는 곳: A-02 로그인.
