# ADR 0010: 분석 도구 PostHog → GA4(Firebase Analytics) 하나로

- 날짜: 2026-11-17
- 상태: 확정(2026-11-17 제품 책임자 결정 “GA 하나로 가고 어드민에도 확인할 수 있게”). 29 기술 스택 ‘분석’ 줄(PostHog 자체 운영)을 고침

## 맥락

- 분석 도구는 PostHog 자체 운영(서울 서버)으로 정해 두었지만 연결하지 않았음. 앱 이벤트(32 4장, `packages/app/src/shared/analytics.ts`)와 웹사이트 이벤트(`apps/site/src/lib/client.ts`)는 개발 중 콘솔에만 남았고, 서버 이벤트는 표 `server_event`에 쌓이기만 함.
- PostHog를 직접 운영하려면 서버(ClickHouse 포함)를 띄우고 지키는 일이 따로 생김. 1인 운영에 부담이 큼.
- 출시 뒤 스토어 광고·웹사이트 유입을 같은 도구로 보고, 나중에 광고 연동(앱 설치 캠페인)도 할 수 있어야 함.

## 결정

- 분석은 GA4 하나로. 모바일 앱은 Firebase Analytics(GA4 앱 스트림), 웹사이트는 gtag.js(GA4 웹 스트림). 같은 GA4 속성.
- 앱: 네이티브 플러그인 `@capacitor-firebase/analytics`(8.6.0, 버전 고정)는 `apps/mobile`에서만. `packages/app`은 `window.sweetwo.analytics` 브리지로만 보냄(CLAUDE.md 구조 규칙). 브리지가 없으면(브라우저 개발·e2e) 지금처럼 개발 중 콘솔만.
  - 이벤트 이름과 속성은 32장 표 그대로. 보내기 전에 `toGaParams`가 참·거짓을 글자로, 배열을 쉼표로 바꾸고, 금액처럼 보이는 숫자 속성·이메일처럼 보이는 글은 버림(이벤트 정의가 이미 구간만이라 한 번 더 거르는 것).
  - 화면 이동은 `screen_view`(화면 ID만, `W-02`). 주소 안의 id·초대 코드는 보내지 않음(`screen-id.ts`). Firebase 자동 화면 기록은 끔.
  - `user_id` = SHA-256(공개 salt `sweetwo-ga-v1` + 내부 사용자 id) 앞 32자. 사용자 속성 `couple_hash` = 같은 방식의 커플 공간 id. 이메일·소셜 계정 id·기기 고유 id는 보내지 않음.
  - S-18 ‘분석 수집’을 끈 사람(`analytics_off`)은 Firebase 수집을 끄고(setEnabled false) 앱도 이벤트를 버림. 로그아웃하면 사용자 id·속성을 지움.
  - 광고 ID: Android `google_analytics_adid_collection_enabled`·SSAID 끔, 광고 맞춤 신호 기본 끔(AndroidManifest). iOS는 IDFA 없는 빌드(SwiftPM 트레잇 `AnalyticsWithoutAdIdSupport`), ATT를 묻지 않음, 광고 맞춤 신호 끔(Info.plist).
  - 설정 파일(Android `google-services.json`, iOS `GoogleService-Info.plist`)은 운영자가 넣음. 없으면 빌드는 그대로이고 아무것도 보내지 않음.
- 웹사이트: 운영 빌드에 `PUBLIC_GA_MEASUREMENT_ID`가 있을 때만 gtag.js를 붙임(인라인 스크립트 없이 `client.ts`가 붙임). `allow_google_signals=false`, `allow_ad_personalization_signals=false`. 초대(/i/), 로그인 복귀(/auth/), 앱 열기 안내(/n/)는 측정하지 않고, 보내는 페이지 주소는 쿼리 중 `utm_*`만 남김. `_headers`에 CSP를 두고 GA 출처만 외부로 허용.
- 서버 이벤트(`server_event`)는 그대로 DB에 쌓아 둠. GA로 보내는 일(Measurement Protocol)은 나중 과제.
- 어드민에서 결과를 봄: 새 화면 AD-21 ‘분석’(27·33). Edge Function이 GA4 Data API를 서비스 계정으로 불러 집계값만 보여 줌. 서비스 계정 키·속성 id는 Supabase 비밀에만.
- 쿠키 동의 배너는 이번에 만들지 않고 개인정보 처리방침 고지로 감 [확인 필요](법무).

## 고른 대안

- PostHog 자체 운영(기존 결정): 코호트·퍼널이 강하고 국외 이전이 없음. 서버 운영 부담과 비용 때문에 뺌.
- PostHog Cloud(EU): 운영 부담은 없지만 도구가 둘(광고 연동은 따로)이 되고 유료 구간이 빨리 옴.
- 앱은 Firebase, 웹은 다른 도구: 유입 → 설치 → 가입을 한 곳에서 못 봄.

## 결과

- 좋은 점: 무료, 도구 하나(앱 + 웹사이트 + 나중 광고 연동), 서버 운영 없음.
- 대가:
  - 국외 이전: GA4 데이터는 Google(미국 등) 서버에 저장됨. 31장 ‘국외 이전 없음’과 처리방침을 고쳐야 함 [확인 필요](법무). 데이터 보관 기간은 GA 설정에서 14개월.
  - 쿠키: 웹사이트에 GA 쿠키(`_ga`)가 생김. 28 ‘측정과 쿠키’의 ‘쿠키 없는 측정’이 더는 맞지 않음. 동의 배너 없이 고지로 감 [확인 필요].
  - 코호트·리텐션 분석이 PostHog보다 약함. 가입 주 코호트 리텐션은 Data API로 바로 안 나와 어드민 AD-21은 대체 지표를 보여 줌(27 AD-21).
  - 앱 첫 실행부터 ‘me’를 받기 전까지(오프라인 캐시가 없을 때) 몇 개 이벤트는 ‘분석 수집’을 끈 사람 것도 익명으로 나갈 수 있음. 받은 뒤로는 끔.
- 문서: DEV_GUIDE 스택 표·관측·비밀, 28 ‘측정과 쿠키’, 29 기술 스택, 31 1장·5장·6장, 32 0-5·4-2, 27·33 AD-21.
