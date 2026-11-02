# ProviderButton

A-02 소셜 로그인 버튼. `Button` + `ProviderMark`를 한 줄로 묶는다(기획서 15장).

- 소비자가 주는 것: `provider`(kakao·google·apple), 글자(children), `recent`·`recentLabel`(‘최근 사용’ 말풍선), `disabled`·`onClick`.
- 변형: 카카오는 공식 노란 브랜드 버튼(`hg-btn--kakao`), 구글·애플은 테두리 버튼(`hg-btn--secondary`). 이메일 충돌로 그 제공자를 알려 줄 때는 버튼 색은 그대로 두고 버튼 위 가운데에 흰 말풍선 `hg-auth__bubble`(13px 500, 안쪽 8px 16px, `hairline-soft` 테두리 + `shadow-2`, 꼬리 아래)로 “이미 {카카오}로 가입한 이메일이에요”(`bubble`)를 띄운다(2026-11-02 지그재그 ‘지금 가입하고…’ 말풍선). 이때 ‘최근 사용’은 숨김. 오렌지 주 버튼으로 바꾸지 않음.
- 마크(`ProviderMark`, `hg-btn__mark`)는 글자 앞. `hg-auth--login` 영역에선 버튼 왼쪽 고정·글자 가운데, 카카오 마크는 24px, 구글·애플은 중간 회색 테두리(바탕 투명)로 바뀐다(→ AuthLayout).
- ‘최근 사용’은 버튼 안 배지가 아니라 해당 버튼 위 오른쪽 말풍선 `hg-auth__recent`(꼬리 아래).
- 쓰는 곳: A-02 로그인.
