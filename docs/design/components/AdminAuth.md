# AdminAuth

어드민 로그인과 2단계 인증 화면 틀(2026-11-06). 사용자 앱의 AuthLayout과 따로, 업무 도구답게 작고 조용하게.

- 참고: Laravel Cloud 로그인, Stripe·Buffer 인증 앱 숫자, Copilot·MagicPath ‘메일을 확인해 주세요’.
- 바탕 `surface-alt` 꽉 채움, 가운데 흰 카드(`hg-adminauth__card`, 최대 400px, 1px `hairline-soft`, `radius-lg`, 안쪽 32px).
- 카드 위: 워드마크(브랜드 색 그대로, 24px) + 태그 “어드민”. 그 아래 32px 띄움.
- 필요하면 제목 위 작은 아이콘 칸(40px, `surface-alt`, `radius-md`): 링크 보냄 `envelope`, 인증 앱 `lock`.
- 제목 20px 600 + 도움말 14px `stone` → 24px 띄우고 입력, 버튼.
- 입력 40px, 이름표 13px 600 `ink`. 인증 앱 숫자 칸(`inputmode="numeric"`)은 48px 가운데 22px 600, 글자 사이 넓게.
- 주 버튼 꽉 찬 40px, 어드민 주 색(잉크, 아래). 보조 행동은 글자 버튼(“다른 이메일로 받기”).
- 인증 앱 등록: QR(120px)과 비밀 키를 1px 테두리 칸에 나란히(`hg-adminauth__qr`, 다크에서도 흰 바탕으로 `data-theme="light"`).
- 카드 아래 작은 글 12px `stone` 가운데: “관리자만 쓸 수 있어요. 로그인과 조회는 모두 기록돼요” [확인 필요].
- 어드민 안의 주 색: `hg-adminauth`, `hg-admin` 안에서 `--brand`를 `ink`로 바꿈(밝은 화면 검정, 다크 화면 흰색). 브랜드 오렌지는 워드마크에만.

React 래퍼: `AdminAuth`(packages/ui, 아이콘·제목·도움말·본문·아래 글).

쓰는 곳: 어드민 로그인(링크 받기, 링크 보냄), 인증 앱 등록, 인증 앱 숫자, 권한 없음, 오류.
