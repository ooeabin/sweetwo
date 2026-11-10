# ADR 0008: 데스크톱 앱(Electron)을 없애고 모바일 앱만 냄(태블릿은 넓은 창 그대로)

- 날짜: 2026-11-10
- 상태: 확정(2026-11-10 제품 책임자 결정). ADR 0001의 ‘1차 출시 = 데스크톱 앱 + 모바일 앱’을 고침

## 맥락

- ADR 0001로 1차 출시를 데스크톱 앱(Electron, Windows·macOS) + 모바일 앱(Capacitor, iOS·Android)으로 정했음.
- 데스크톱 앱을 계속 갖고 가는 비용이 큼:
  - 서명과 공증: Apple Developer ID 서명·공증, Windows 코드 서명 인증서, 설치 파일(dmg, exe) 배포와 고정 다운로드 주소(download.sweetwo.kr)
  - 자동 업데이트: electron-updater, 업데이트 채널, 서명 검증, S-19 ‘업데이트 확인’ 화면
  - 데스크톱 e2e: CI `e2e-desktop`(xvfb + Electron 실행 파일 내려받기), 캐시 깨짐 대응
  - 데스크톱 전용 기능: 트레이 아이콘과 트레이 위젯 창(26), 위젯 설정(S-22), OS 알림, 메인 프로세스 토큰·잠금(PIN·Touch ID), 오프라인 캐시, 딥링크, 해시 라우터
- 제품의 핵심 흐름은 휴대폰에서 일어남: 월급날 푸시 알림 → 월급 체크리스트(W-02) → 다음 월급날 3일 전 월급 전 확인(W-05). 초대도 휴대폰으로 받아 휴대폰 앱으로 합류함(ADR 0001 맥락). 데스크톱 앱이 아니면 못 하는 일이 없음.
- 넓은 화면은 태블릿(iPad, Galaxy Tab)이 받아 감. 화면(packages/app)과 디자인 시스템은 이미 넓은 창(768px 이상: 왼쪽 사이드바, 넓은 PageHeader, 넓은 창 패널)과 좁은 창을 모두 가짐.

## 결정

- 데스크톱 앱을 없앰. 출시물은 모바일 앱(Capacitor, iOS·Android)과 소개 웹사이트(sweetwo.kr), 어드민(ops.sweetwo.kr)뿐.
- 태블릿(iPad, Galaxy Tab)을 지원함. 넓은 창(768px 이상) 레이아웃과 그 CSS·컴포넌트(사이드바, 넓은 창 PageHeader, 알림 패널, ⌘K 검색 화면, 단축키)는 그대로 둠. 이제 태블릿(키보드를 붙인 태블릿 포함)을 위한 것.
- 브라우저 실행은 지금처럼 개발과 e2e용만(ADR 0001, 웹 앱 없음).
- 지운 것:
  - `apps/desktop` 전체(Electron main·preload·renderer, electron-builder 설정, 데스크톱 아이콘·트레이 그림, 데스크톱 e2e)
  - `window.sweetwo` 브리지 중 데스크톱만 쓰던 것: `notify`(OS 알림), `update`(자동 업데이트, `UpdateState`), `widget`(트레이 위젯·위젯 설정). 플랫폼 값 `desktop`. 브리지 타입 이름 `DesktopBridge` → `AppBridge`, `platform`은 꼭 있음(`ios` | `android`)
  - 화면: 트레이 위젯 창(`/widget/tray`, 26 ‘트레이 위젯 창’), 위젯 설정 S-22와 S-10 ‘위젯’ 줄, S-19 ‘업데이트 확인’, 홈 ‘PC에서도 같은 계정으로’ 띠(18 ‘합류 뒤’), A-03 데스크톱 복귀(`from=desktop`), 데스크톱 해시 라우터
  - core: 트레이 위젯 값 스키마(`TraySnapshot`, `TrayState`, `WidgetSettings`), 웹사이트 Mac·Windows 판정과 지원 OS 판정(`installOs`, `unsupported`), `findDeepLink`(Windows 실행 인자)
  - 디자인: `hg-wg-tray*`(트레이 위젯), `hg-site__os`, `hg-site__steps--col`(설치 안내), `app-icon-macos.png`(Mac 독 아이콘)
  - 웹사이트: Mac·Windows 다운로드 버튼, ‘다른 OS용 받기’, 지원 OS 안내, 설치 안내(L-02)의 파일 받기·설치 3단계·보안 경고, PC 초대 페이지의 ‘sweeTwo 앱으로 열까요?’. L-02(`/download`)는 기기에 맞는 스토어 버튼 페이지(‘앱 받기’)로 바꿈(앱 A-01 강제 업데이트와 알림 메일 ‘앱 받기’가 이 주소로 옴)
  - 어드민: AD-16 ‘최신 버전(데스크톱)’ ‘최소 지원 버전(데스크톱)’ 칸, AD-10 ‘대상 플랫폼’ 고르기
  - CI: `e2e-desktop` 작업, `ELECTRON_SKIP_BINARY_DOWNLOAD`, pnpm `onlyBuiltDependencies`의 electron, 루트 `dev:desktop`
- 남긴 것(모바일이 씀): 앱 잠금(A-06, LockScreen, PIN·Face ID·Touch ID·지문), 오프라인 조회 캐시, 시스템 로그인 창 로그인 대기(A-03), 앱 링크(`onNavigate`, `onInvite`), 앱 접속 신호(`touch_app`, 푸시 기기가 없을 때 월급 전 확인 메일 대신 보내기 판단), 홈 계산 규칙(core `homeTodo`·`homeUpcoming`, 위젯 26 WG-01~05 규칙도 같은 것), ⌘K 검색 화면과 단축키(넓은 창)
- 홈 화면·잠금 화면 위젯(26 WG-01~05)은 지금처럼 ‘모바일 앱 출시 뒤’ 과제. 그때 S-22를 모바일용으로 다시 만듦(트레이 줄 없이)
- 데스크톱 코드는 git 기록에서 되살릴 수 있음: 지우기 직전 `develop` 커밋 `a0c39609730772735e259ef6d4eebd40c111a9ca`(#265)의 `apps/desktop`, `packages/app/src/features/widget`, `packages/app/src/features/frame/tray-sync.ts`, `packages/app/src/features/settings/pages/s-22-widget.tsx`, `packages/core/src/schemas/widget.ts`

## 고른 대안

- 데스크톱 앱 유지(ADR 0001 그대로): 위 유지 비용이 그대로 남고, 핵심 흐름(푸시 → 체크리스트)에 더하는 것이 적음.
- 데스크톱 앱 대신 웹 앱: ADR 0001에서 고르지 않은 길. 휴대폰 사용자가 웹과 앱을 오가야 함.
- 데스크톱을 미루기만(코드는 두고 출시만 안 함): 브리지·CI·문서가 계속 두 플랫폼을 맞춰야 해서 비용이 줄지 않음. 지우고 git 기록으로 되살리는 편이 쌈.

## 결과

- 좋은 점: 서명·공증·자동 업데이트·데스크톱 e2e가 없어짐. 브리지와 화면 분기가 모바일 하나로 줄어듦. CI 작업이 하나 줄어듦(남은 작업: check, e2e-web, mobile-android, db + Supabase Preview).
- 나쁜 점: PC에서 쓰는 길이 없어짐(태블릿은 넓은 창으로 씀). Mac·Windows 사용자에게 알리던 웹사이트 문구와 다운로드 페이지가 바뀜.
- DB는 추가만 규칙(CLAUDE.md ‘스키마는 추가만’)이라 이번에 지우지 않고 앱에서 안 쓰기만 함. 나중에 2단계로 지움:
  - `app_config.min_version_desktop`, `app_config.latest_version_desktop`(AD-16에서 안 보임, `admin_request_app_config` 허용 키와 승인 적용에는 남음)
  - `app_device.platform`의 `'desktop'` 값 허용과 `admin_app_config`의 `below_min.desktop`
  - `notice.platforms`(어드민은 고르지 않고 늘 `['desktop', 'mobile']` = ‘기기 기록과 상관없이 모두’로 저장. `notice_user_match`를 모바일 기준으로 고친 뒤 열을 지움), `my_notices`의 `'desktop'` 허용
  - `send_desktop_link()` RPC와 메일 종류 `desktop_link`(앱에서 부르지 않음)
  - `touch_app()`·`app_user.app_seen_at` 설명의 ‘데스크톱 앱 접속 신호’(모바일 앱도 보내므로 그대로 씀, 이름만 정리)
- 저장소 밖에서 할 일(제품 책임자): GitHub 브랜치 보호의 필수 체크에서 `e2e-desktop` 빼기, Apple Developer ID·Windows 코드 서명 인증서와 공증 설정 정리, download.sweetwo.kr(S3 + CloudFront)와 자동 업데이트 채널 정리, 스토어 설명에서 PC 언급 빼기, iPad·Galaxy Tab 스토어 스크린샷.
- 고친 문서: CLAUDE.md(스택, 구조, 브리지), DEV_GUIDE, DESIGN.md, design 컴포넌트(Widget, CommandPalette, LockScreen, SiteLayout 등), Brand·Illustrations·Icons, 기획서 01, 02, 03, 04, 08, 09, 10, 11, 12, 13, 14, 15, 16, 18, 19, 20, 23, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36과 README(목차), ADR 0001·0002·0006에 고침 줄, apps/site FAQ 원본.
