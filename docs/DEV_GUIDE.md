# sweeTwo 개발 가이드

> 이 파일이 개발 가이드 정본이에요(2026-10-14부터). 매번 지킬 핵심은 저장소 맨 위 `CLAUDE.md`, 기획서는 `docs/spec/`, 디자인은 `docs/DESIGN.md`.
>
> 문서 고치는 법: 코드를 바꾸며 기획, 디자인, 규칙이 달라지면 같은 PR에서 해당 md를 바로 고쳐요. 따로 변경 목록을 두지 않고 git 기록이 변경 이력이에요.

## 한눈에 보기

MVP는 모바일 앱(iOS, Android, 태블릿 포함)을 React + TypeScript 화면 코드로 만들고 Capacitor로 감싸며, 서버는 Supabase(서울 리전) 하나로 운영함. 웹 앱은 없음(ADR 0001). 데스크톱 앱(Electron)은 없앰(ADR 0008, 2026-11-10). 화면은 좁은 창(휴대폰)과 넓은 창(768px 이상, 태블릿)을 모두 가짐. 홈 화면 위젯은 v1(2026-11-13, WG-01·WG-04, ‘모바일 네이티브 v2.2’).

> 전환 중: 모바일 로그인·잠금·앱 링크, 웹사이트 로그인 복귀 페이지(`apps/site` /auth/callback, 20261104090000), 모바일 푸시(20261104120000)는 코드에 있음. 실제 발송은 APNs·Firebase 키를 넣은 뒤. 이 문서는 바뀐 뒤 모습 기준이고, 아직 안 바뀐 곳은 ‘(전환 전)’으로 표시함.

- 만들 것: 모바일 앱(App Store, Google Play, 태블릿 포함), 웹사이트(sweetwo.kr), 상태 페이지(status.sweetwo.kr), 어드민(웹 전용, ops.sweetwo.kr). 메일은 help@sweetwo.kr, privacy@sweetwo.kr
- 데이터: 모두 직접 입력. 계좌 연동, 마이데이터, 스크래핑 없음
- 사용자: 두 사람 2명이 한 공간을 같이 씀. 한국어, 원(KRW), KST만 지원
- 기준 문서: 기획서 ‘기술·운영’, ‘동기화’, ‘보안·개인정보’ 탭과 디자인 시스템 sweeTwo

| 영역 | 고른 것 |
| --- | --- |
| 앱 껍데기 | Capacitor(iOS, Android). 데스크톱 Electron은 없앰(ADR 0008) |
| 화면 | React 18 + TypeScript, Vite |
| 화면 상태와 서버 데이터 | TanStack Query + Zustand |
| 화면 이동 | React Router |
| 입력 검증 | Zod + React Hook Form |
| 스타일 | 디자인 시스템 tokens.css + 컴포넌트 CSS(hg- 클래스) |
| 서버 | Supabase: Postgres, Auth, Realtime, Edge Functions, Storage, pg\_cron |
| 권한 | Postgres RLS |
| 암호화와 파일 | AWS KMS, S3(서울, 백업) |
| 정적 배포·개발 서버 | Cloudflare Workers 정적 자산 + Access(웹사이트, 어드민, 개발 확인용 앱 화면, ADR 0002) |
| 메일 | 보내기 Amazon SES(서울), 받기 네이버웍스 |
| 분석, 오류, 모니터링 | PostHog(직접 운영), Sentry(직접 운영), Better Stack |
| 업데이트 | 스토어(App Store, Google Play) 단계적 출시 |
| 저장소 | pnpm 워크스페이스 + Turborepo 모노레포 |
| 테스트 | Vitest, Playwright, pgTAP(RLS 검사) |
| CI/CD | GitHub Actions |

- 표의 모든 항목은 확정(10월 12일). 바꿀 때는 docs/adr에 ADR로 남김. 웹사이트(apps/site)는 Astro 정적 사이트(확정).

## 기술 스택 상세

클라이언트는 화면 코드를 모바일 앱(좁은 창·넓은 창)과 개발용 브라우저가 같이 쓰고, 계산과 권한의 기준은 서버(Postgres)에만 둠. 기기는 캐시.

### 클라이언트

- 로그인: 시스템 로그인 창 OAuth(PKCE) → https://sweetwo.kr/auth/callback(웹사이트의 정적 복귀 페이지, (전환 전) app.sweetwo.kr) → sweetwo://로 앱에 복귀. refresh token은 네이티브 브리지가 Keychain·Keystore에 보관(세부는 ‘인증과 세션’)
- 로컬 저장: 오프라인 조회 캐시는 암호화(키는 보안 저장소). 오프라인 입력 큐는 두지 않음(오프라인은 볼 수만)
- Capacitor: 모바일 앱. `apps/mobile`(Vite 빌드 + iOS·Android 프로젝트)이 packages/app을 감쌈. 모바일 전용 기능(로그인, 보안 저장소, 잠금·생체 인증, 푸시, 앱 링크, 공유, 광고, 첫 실행 초대 코드, 홈 화면 위젯)은 브리지(`window.sweetwo`, 타입 `AppBridge`)로만 열어 줌. 플랫폼 값은 `ios` / `android`(브리지가 없으면 `web` = 개발 브라우저). 단축키와 ⌘K 검색 화면은 플랫폼으로 숨기지 않음(키보드를 붙인 태블릿)
- 같은 Vite 화면을 브라우저로 띄우는 건 개발과 e2e(흉내 Supabase)용뿐, 배포하지 않음
- 서버 데이터: TanStack Query 캐시 + Realtime 변경 신호로 무효화. 끊기면 30초 폴링
- 화면 상태: Zustand(잠금, 금액 가리기, 저금 항목·자산 추가 중 입력값 등 기기 안 상태)

### 서버

- Supabase 서울 리전 하나: Postgres, Auth(카카오, 구글, 애플), Realtime, Storage(사진), Edge Functions
- 합계와 배분 계산: Postgres 함수. 클라이언트는 미리보기만 계산하고 저장 값은 서버 값
- 예약 작업: pg\_cron + Edge Functions (기준일 0시 체크리스트 만들기, 알림 발송, 연결 해제 기한, 보관 기간 정리)
- 필드 암호화: 메모와 가족 정보는 Edge Function에서 AES-256-GCM, 키는 AWS KMS
- 알림: 앱 안 알림센터, 이메일(SES), 모바일 푸시(APNs·FCM, Edge Function이 보냄, 기기 토큰은 `push_device`)

### 외부 데이터

- 음력 변환: korean-lunar-calendar(npm, MIT, 한국천문연구원 기준표, 양력 2050년 12월 31일까지). core에 두고 클라이언트와 서버가 같이 씀. 천문연구원 자료와 대조하는 테스트 필수
- 공휴일: 공공데이터포털 ‘한국천문연구원 특일 정보’ API. Edge Function이 매년 12월에 다음 해를, 매주 한 번 다시 받아 holiday 테이블에 저장(임시공휴일 반영). 앱은 테이블만 읽음. 어드민에서 직접 고칠 수 있음
- 환율, 주가, 시세 API: 쓰지 않음(직접 입력)

### 결정된 것

- [x] PG사: MVP 밖, 유료화 때 토스페이먼츠 우선 검토

## 구조

저장소는 모노레포 하나이고, 화면 4개가 공용 패키지를 거쳐 Supabase 하나에만 붙음.

> 화면 그림: 시스템 구성: 화면 4개, 공용 패키지, Supabase, AWS (그림은 기획서 페이지 사본에 있어요. 구현할 때 이 문서의 요소 표가 기준이에요.)

화면은 DB에 직접 쓰지 않고 api 패키지의 쿼리와 함수만 부름. 권한은 항상 RLS가 막음.

### 폴더

```
sweetwo/
  apps/
    mobile/       Capacitor 모바일 앱(iOS, Android) + 개발·e2e용 브라우저 실행
    admin/        어드민 웹
    site/         웹사이트 L-01~L-03, L-05, L-06 (랜딩, 앱 받기, 릴리스 노트, 약관, 고객센터)
    mail-worker/  Cloudflare Email Worker(이메일 문의 받기 → Edge Function inbound-mail)
  packages/
    ui/           디자인 시스템 토큰, 컴포넌트, 그림
    app/          화면(페이지)과 화면 흐름(좁은 창·넓은 창), mobile이 감쌈
    core/         타입, Zod 스키마, 금액과 날짜 포맷, 계산 미리보기
    api/          Supabase 클라이언트, 쿼리 훅, Realtime 구독
  supabase/
    migrations/   스키마, RLS, DB 함수
    functions/    Edge Functions
    tests/        pgTAP (RLS와 계산 함수)
  docs/           개발 문서, ADR
```

### 모듈 경계

- ui는 화면 로직을 모름. props로만 그림
- core는 브라우저와 Node 어디서나 돌아감. 네트워크 없음
- api만 Supabase를 앎. 화면은 api 훅만 부름
- 모바일 전용 기능(보안 저장소, 잠금, 푸시, 공유)은 apps/mobile이 여는 브리지로만 씀

### 데이터 흐름

1. 화면이 api 훅으로 읽음 (TanStack Query 캐시)
2. 쓰기는 테이블 쓰기 또는 DB 함수 호출, version 값으로 충돌 확인
3. 서버가 change\_log에 기록하고 Realtime으로 변경 신호를 보냄
4. 파트너 기기는 마지막으로 받은 변경 번호 이후만 다시 받음(델타 동기화), 목표 1\~2초

## 개발 서버 (develop, Cloudflare Workers 정적 자산)

로컬에서 아무것도 띄우지 않고 브라우저로 확인(ADR 0002). 작업 브랜치 → PR(CI + 미리보기 주소) → develop 합치기 → 개발 서버에서 확인 → 사람이 정하면 main.

| 무엇 | 주소 | 붙는 곳 |
| --- | --- | --- |
| 앱 화면(확인용, 넓은 창·좁은 창) | `https://dev-app.sweetwo.kr` | 스테이징 Supabase, 실제 소셜 로그인 |
| 어드민 | `https://dev-ops.sweetwo.kr` | 스테이징 Supabase |
| 웹사이트 | `https://dev.sweetwo.kr` | — |
| DB | `sweetwo-staging`(Supabase 서울) | develop 합치기 때 마이그레이션 자동 적용 |

- 도메인: `sweetwo.kr`(가비아에서 삼, 네임서버만 Cloudflare로, 2026-10-25). Worker마다 Settings → Domains & Routes → Custom Domain으로 개발 서버 주소를 붙임. `sweetwo.kr`, `ops.sweetwo.kr`은 운영용으로 비워 둠
- 예전 `*.yeabin0909.workers.dev` 주소도 그대로 열림(같은 Access로 잠금)
- PR 브랜치는 `https://{브랜치}-sweetwo-app.yeabin0909.workers.dev` 미리보기 주소가 생김(Custom Domain에는 미리보기 주소가 없음)
- 빌드가 Node 설치 단계에서 실패하면 한 번 더 Retry, 그래도 실패하면 Settings → Build → Build cache → Clear cache 뒤 Retry
- 운영 브랜치를 바꾼 뒤에는 그 브랜치에 새 커밋이 들어와야 그 브랜치로 빌드됨(Retry는 원래 브랜치로 다시 돎)
- 모바일 전용(PIN, 앱 링크, 푸시, Face ID)은 여기서 확인 못 함. 그 부분은 e2e(흉내 브리지)와 기기 빌드로
- 개발 서버 데이터는 실제로 가입해서 만듦. 두 사람 기능은 계정 두 개로 가입 → 초대 코드로 연결

Worker 3개(대시보드 → Workers & Pages → Create → Import a repository → `ooeabin/sweetwo`). 배포 설정은 앱마다 `apps/{web,admin,site}/wrangler.jsonc`(Worker 이름, 정적 파일 폴더 `dist`, 없는 주소 처리). 출시 전까지 셋 다 운영 브랜치 = `develop`, 출시 준비 때 어드민·웹사이트만 `main` + 운영 Supabase 값으로 바꿈.

| 설정 | sweetwo-app | sweetwo-admin | sweetwo-site |
| --- | --- | --- | --- |
| Project(Worker) name | sweetwo-app | sweetwo-admin | sweetwo-site |
| Build command | `pnpm --filter @sweetwo/mobile build` | `pnpm --filter @sweetwo/admin build` | `pnpm --filter @sweetwo/site build` |
| Deploy command | `npx wrangler deploy --config apps/mobile/wrangler.jsonc` | `npx wrangler deploy --config apps/admin/wrangler.jsonc` | `npx wrangler deploy --config apps/site/wrangler.jsonc` |
| Root directory | `/` | `/` | `/` |
| Production branch(Branch control) | develop | develop | develop |
| Non-production branch builds | 켬, deploy command `npx wrangler versions upload --config apps/mobile/wrangler.jsonc` | 켬(같은 방식, admin) | 켬(같은 방식, site) |
| Build watch paths(포함) | `apps/mobile/*`, `packages/*` | `apps/admin/*`, `packages/*` | `apps/site/*`, `packages/core/*` |

- Build variables(세 Worker 공통): `NODE_VERSION=22.20.0`(22만 쓰면 최신판을 골라 설치에 실패할 수 있음), `PNPM_VERSION=10.12.1`, `ELECTRON_SKIP_BINARY_DOWNLOAD=1`, `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`. 화면 값은 빌드 때 들어가므로 Runtime variables가 아니라 Build variables에
- 앱·어드민 Build variables: `VITE_SUPABASE_URL=https://xxofyzgzrjrcrcxvftpn.supabase.co`, `VITE_SUPABASE_ANON_KEY`(스테이징 anon key, 공개 값. Supabase → Project Settings → API). service role은 넣지 않음
- 화면 주소(라우팅): 앱·어드민은 `not_found_handling: single-page-application`(모든 경로에 index.html), 웹사이트는 `404-page`(없는 주소는 404.html, 404 응답). 웹사이트 초대 링크 `/i/{코드}`는 `apps/site/public/_redirects`(`/i/* /i/ 200`)가 초대 페이지를 200으로 줌(2026-11-12). 응답 헤더는 앱마다 dist의 `_headers`(웹사이트 `public/_headers`, 어드민은 빌드가 만듦 → ‘어드민 인증’)
- 접근 보호: Zero Trust(무료) → Access → Applications → Self-hosted, 앱마다 1개(sweetwo-app, sweetwo-admin, sweetwo-site). 도메인 `dev-app.sweetwo.kr`, `sweetwo-app.yeabin0909.workers.dev`(미리보기까지 막으려면 `*-sweetwo-app.yeabin0909.workers.dev`도). 어드민·웹사이트도 같은 식(`dev-ops`, `dev`). 정책 Allow + Include Emails(허용 이메일). Identity 탭에서 ‘Select all’을 지우고 One-time PIN만, Apply instant authentication 켬. One-time PIN이 목록에 없으면 Zero Trust → Settings → Authentication → Login methods에서 먼저 추가. Cloudflare 계정 로그인은 쓰지 않음(동의 단계에서 ‘Application authorization failed’)
- 스테이징 Supabase → Authentication → URL Configuration: Site URL `https://dev-app.sweetwo.kr`, Redirect URLs `https://dev-app.sweetwo.kr/**`, `https://dev-ops.sweetwo.kr/**`, `https://sweetwo-app.yeabin0909.workers.dev/**`, `https://*-sweetwo-app.yeabin0909.workers.dev/**`, `https://sweetwo-admin.yeabin0909.workers.dev/**`, `https://*-sweetwo-admin.yeabin0909.workers.dev/**`, 로컬 실행용 `http://localhost:5173/**`, `http://localhost:5174/**`
- 스테이징 소셜 로그인: Supabase → Authentication → Providers에서 켜고, 각 콘솔 앱에 콜백 `https://xxofyzgzrjrcrcxvftpn.supabase.co/auth/v1/callback` 등록
  - 구글: 켜짐(2026-10-23). Google Cloud 프로젝트 sweetwo-staging, 웹 애플리케이션 클라이언트, 자바스크립트 원본 `https://sweetwo-app.yeabin0909.workers.dev`(Supabase를 거치는 로그인이라 새 주소를 넣지 않아도 됨). 동의 화면이 ‘테스트 중’이라 로그인할 계정은 대상 → 테스트 사용자에 넣어야 함
  - 카카오: 켜짐(2026-10-23). 로컬과 같은 카카오 앱(Redirect URI에 로컬·스테이징 콜백 둘 다), 이메일 선택 동의, Supabase ‘Allow users without an email’ 켬(거부하면 A-04)
  - 애플: 아직. 사업자 등록 → D-U-N-S → Apple Developer 조직 명의 가입 뒤(기획서 34 4장). 그때까지 개발 서버의 ‘Apple로 시작하기’는 오류

## 로컬 개발 환경

필요할 때만. 개발 서버로 확인하면 로컬 실행은 없어도 됨.

- 기본은 스테이징 DB: `pnpm i` → `pnpm dev`만 하면 스테이징 Supabase를 바라봄. Docker와 `pnpm db:start`가 필요 없음
  - 값은 앱마다 커밋된 `.env.development`(apps/mobile, apps/admin). URL과 anon key(공개 값)만 들어 있음. service role, `sb_secret_` 키는 절대 넣지 않음
  - 개발 서버와 같은 DB라 로컬에서 만든 데이터도 개발 서버에 보임. 로그인은 스테이징에 켠 구글, 카카오로
  - 스키마는 `develop`에 합쳐진 마이그레이션까지만 있음. 아직 합치지 않은 마이그레이션을 화면에서 써 보려면 아래 로컬 DB로
- 로컬 DB(선택): 마이그레이션을 만들거나 pgTAP을 돌릴 때만. `pnpm db:start` 뒤 앱 폴더에 `.env.development.local`을 만들어 로컬 URL과 anon key를 넣음(Vite는 `.env.development.local` > `.env.development` > `.env.local` 순서라 `.env.local`로는 덮이지 않음). 다 쓰면 그 파일을 지우면 다시 스테이징
- 로컬 DB에서는 seed.sql의 찬우, 예빈 두 사람 데이터가 든 앱이 뜸. e2e는 어느 쪽도 쓰지 않고 `.env.e2e`의 가짜 Supabase를 씀

### 준비물

- Node: 버전은 `.nvmrc`에 고정, `nvm use`
- pnpm: `corepack enable`로 package.json의 `packageManager` 버전을 씀
- Docker(로컬 DB를 쓸 때만). Supabase CLI는 devDependency라 `pnpm db:*`로 씀

### 실행

1. `pnpm i`
2. (로컬 DB를 쓸 때만) `pnpm db:start`: 로컬 Postgres, Auth, Realtime, Storage, Inbucket(Docker). 출력의 API URL과 anon key를 `apps/mobile/.env.development.local`의 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`에
3. `pnpm dev`: 모바일 화면을 브라우저로 5173(개발용), 어드민 5174. 휴대폰·에뮬레이터는 `pnpm --filter @sweetwo/mobile cap:ios` / `cap:android`(Xcode, Android Studio 필요)
4. 데이터 초기화: `pnpm db:reset` (마이그레이션 + seed.sql 다시 실행)
5. 마이그레이션을 바꿨으면 `pnpm db:test`(pgTAP) → `pnpm db:types`(packages/core/src/db.types.ts 다시 만듦, 손으로 고치지 않음)
6. 컴포넌트 모음: 개발 서버에서 `/dev/ui`(배포 빌드에는 없음)

### 스테이징과 운영 Supabase

- 프로젝트 2개(서울 리전 ap-northeast-2): `sweetwo-staging`(ref `xxofyzgzrjrcrcxvftpn`), `sweetwo-prod`(ref `rilhxjozsdcxcfshtvta`). 연결은 `pnpm supabase link --project-ref <ref>`
- DB 타입 파일은 `pnpm db:types`(로컬 Supabase)로 만들고, 생성기 버전에 따라 줄바꿈만 달라지지 않게 prettier 고정 옵션(`--no-config --no-semi --print-width 100`)으로 맞춰 저장한다. CI db 작업이 같은 명령으로 다시 만들어 공백, 줄바꿈, ; , 를 빼고 비교함(다르면 실패, 결과물 db-types를 받아 커밋)
- 공개 값(URL, anon key)만 앱 `.env.development`(스테이징), `.env.development.local`(로컬), GitHub 환경 변수, Cloudflare 빌드 변수로. service role은 GitHub Secrets와 서버에만

### 환경 변수와 대체물

- `.env.example`은 앱마다 하나: apps/mobile, apps/admin, apps/site, supabase/functions
- 로컬 대체물: 메일 → Supabase Inbucket, KMS → 로컬 키 어댑터, 공휴일 → fixture 파일
- seed.sql: auth 사용자 찬우, 예빈, 연결된 우리 둘 공간, 이번 달 월 계획
- 이메일, 비밀번호 테스트 로그인: 로컬과 스테이징에서만 켬(E2E용). 운영은 소셜 로그인만

## 데이터 모델과 권한

모든 데이터는 우리 둘 공간(couple\_space) 하나에 속하고, 누가 무엇을 볼지는 서버 RLS가 정함. 상세 필드는 기획서 ‘기술·운영’ 2장과 ‘데이터 항목’ 탭이 기준.

### 공통 필드

- id(uuid), space\_id, created\_by, updated\_by, created\_at, updated\_at
- version: 동시 수정 충돌 확인용. 쓰기마다 +1
- deleted\_at, deleted\_by: 휴지통. 30일 뒤 영구 삭제
- 금액은 bigint 정수 원 단위(소수점 없음), 입력 상한 999억 원(Zod 입력 검증). 날짜는 KST 기준 date
- goal.photo\_path text: 옛 목표 사진 Storage 경로(2026-11-08 저금 항목에는 사진 없음, 앱이 안 씀)
- app\_user.is\_internal\_tester bool: 내부 테스트 계정 표시, 기본 false. 공개 출시 직전 삭제 대상을 고를 때 씀(→ 운영 절차)
- 함께 모은 달(W-12 축하 문장, 20261101150000 `goal_story`): 그 저금 항목 줄을 체크한 체크리스트 달(‘9월 월급’) 수, 그중 두 사람이 모두 체크한 달 수. 우리 둘 항목이 아니거나 혼자 쓰기면 “n개월 만에 모았어요”(core `celebrationStory`)
- 순자산 기간 탭의 마지막 선택: 기기별 로컬 저장(서버에 저장하지 않음), 값이 없으면 기본 1년(쓴 지 1년 미만이면 전체)

### 테이블 묶음

| 묶음 | 테이블 |
| --- | --- |
| 커플과 사용자 | couple\_space, app\_user, invite, device\_session, consent, couple\_unlink |
| 자산 | account, asset, debt, fixed\_expense, annual\_event, amount\_history |
| 저금 항목과 월급 | goal(저금 항목), goal\_move(안 씀), salary\_split, split\_line, pay\_checklist, pay\_check\_line |
| 경조사 | care\_day, care\_record |
| 기록과 알림 | partner\_change, notification, mail\_outbox, widget\_setting, photo |
| 결제와 문의 | subscription, payment, inquiry(답변 포함), admin\_view\_request |
| 운영과 어드민 | holiday, notice, maintenance, app\_config, admin\_setting, item\_catalog(항목 이름 목록, 어드민에서 수정), admin\_user, audit\_log, job\_run(예약 작업 실행 기록), peer\_stat(출시 후) |

### 권한 규칙

- RLS 기본값은 막힘. 테이블마다 ‘같은 space의 구성원’만 읽고 씀
- 공개 범위 3단계(전체 공개, 합계만, 비공개. 화면 이름 2026-11-13 ‘모두 / 총액만 / 숨기기’, 미리 고른 값 없음)와 각자 계열 월급 계획 공개 3단계(`plan_share`, 2026-11-13)는 RLS와 security\_invoker = true 뷰로 걸러냄(이 옵션 없는 뷰는 소유자 권한으로 RLS를 건너뜀). 클라이언트에서 숨기지 않음
- 목표(20261106090000, 2026-11-08부터 저금 항목 행): 읽기는 우리 목표·내 목표·파트너의 ‘모두 보여 주기’ 내 목표만(‘금액만 보여 주기’는 `space_goals()`가 이름을 가려서 줌), 추가·고치기는 우리 목표 둘 다·내 목표 주인만, 주인은 나 또는 없음(우리)으로만. 앱이 바로 고치는 열만 `grant update`(이름, 형태, 질문 답, 금액, 기한, 이미 모은 금액, 순서, 상태, 주인, 공개 범위, 휴지통). 2026-11-12(20261123090000) 합쳐서 공간은 ‘모두 보여 주기’ 주인 있는 항목도 둘 다 고침(D1), 주인은 나 ↔ 없음만(`goal_owner_guard`), 연결 해제 대기 중 바로 고치기 거절(`goal_unlink_guard`). 상태는 진행·지연·보류 사이만(`goal_client_guard`), 달성·사용 완료·사진·템플릿은 함수로만
- 제안·승인 없음(ADR 0003). 누구나 바로 고치고 상대에게 알림(partner\_change 묶음) + 고친 사람에게 Toast ‘되돌리기’. 2026-11-13 예외 둘(관리 형태 합치기, 분담 제안, ADR 0009 8-1, 아래 ‘v2.2 데이터와 서버’). 각자 계열 파트너 것은 `plan_share` 공개 단계대로
- 토스트와 화면 이동(2026-11-11): `shared/toast` `ToastHost`는 경로(pathname)가 바뀌면 떠 있는 토스트를 닫는다(그 화면의 동작 결과는 그 화면에서만). 결과를 알리고 바로 다른 화면으로 옮기는 동작(저장하고 돌아가기, 지우고 목록으로, 되돌리기 토스트 + 이동)은 `carryToast(문장, 행동?)`로 띄워 다음 화면 하나까지만 남긴다(그다음 이동에서 닫힘). 같은 화면 안 결과는 `toast()`. 쿼리(`?view=`)만 바뀌는 이동은 닫지 않음
- 오프라인은 볼 수만(30 동기화 4장): api `trackedFetch`가 `navigator.onLine`이 거짓이면 서버로 가는 쓰기(POST·PATCH·PUT·DELETE, auth 토큰 갱신 빼고)를 바로 실패시키고 `lastOfflineBlock()`을 남김 → `shared/toast`가 3초 안의 실패 안내를 “인터넷에 연결되면 할 수 있어요”(`shared/copy`)로 바꿈. 입력 대기열은 두지 않음(2026-10-27 결정)
- 오프라인 조회 캐시: `packages/app/src/shared/offline-cache.ts`가 TanStack Query 캐시를 `dehydrate`해 브리지 `cache.save`로(3초 모아서), 켤 때 `cache.load` → `hydrate` 뒤에 그림. 모바일 `native/offline-cache.ts`(보안 저장소의 AES-GCM 키 + Filesystem 데이터 폴더). 로그아웃은 네이티브 `signOut`이 지움, 앱은 `signed_out` 뒤 저장을 멈춤. `me.space_id`가 바뀌면(연결 해제 확정 등) `cache.clear()` + 그 전에 받은 쿼리를 메모리에서도 빼고 새로 받음. 사진 서명 주소·기기 목록은 빼고, 모양이 바뀌면 `VERSION`을 올림
- 사실 값(잔액 등)은 마지막 쓰기가 이김. 파트너가 1분 안에 같은 필드를 바꿨으면 선택 화면: api `updateIfUnchanged(table, id, patch, base)`가 ‘화면을 열 때 값’(base)이 그대로일 때만 고치고, 아니면 지금 행을 돌려줌 → core `conflictDecision`(same / choose: 파트너 `updated_by` + `updated_at` 1분 안 / overwrite) → 디자인 `ConflictChoice`. 지금은 목표 수정(금액·기한·이름)과 자산 금액(F-04). 월급 계획·체크리스트·오프라인 대기열은 다음 단계
- 기록(change\_log, amount\_history)은 추가만. 수정과 삭제 권한 없음
- 어드민은 service role을 쓰지 않고 별도 함수로만 읽음. 문의한 사람의 동의(admin\_view\_request)가 있을 때만, 파트너에게 알림, 열람 기록 1년 보관

### 상태가 있는 것

- couple\_state: 미합류, 연결, 해제 대기, 혼자 쓰기
- 상태는 enum으로 두고, 바꾸는 것은 DB 함수만. 허용되지 않은 전환은 함수가 거부

### 동의와 문의

- consent 종류: 이용약관, 개인정보 처리, 파트너와 우리 둘 공간 공유, 가족 정보, 사진(경조사), 마케팅 수신, 분석 수집, 통계 참여
- consent 행에는 종류, 약관 버전, 동의 여부, 시각. 철회도 새 행으로 추가
- 문의: 모바일 앱에서 inquiry 테이블에 저장 + help@sweetwo.kr로 사본 메일(머리글 `X-Sweetwo-Copy`)
- 이메일 문의: help@로 온 메일은 네이버웍스 자동 전달 → `inbound@in.sweetwo.kr`(Cloudflare Email Routing) → 메일 Worker(`apps/mail-worker`) → Edge Function `inbound-mail` → inquiry(채널 email). 앱 ‘내 문의’에는 앱 문의만 보임(보낸 주소는 꾸밀 수 있어서)
- 답변: 어드민 AD-06에서 작성 → 앱 문의는 앱 ‘내 문의’ + 알림, 이메일 문의는 help@에서 같은 주소로 답장 메일
- 문의 때문에 데이터를 봐야 하면 문의한 사람의 동의(admin\_view\_request)를 받고, 파트너에게 알림. 열람은 audit\_log에 기록

### 지금 있는 테이블과 함수

> 재기획(2026-10-25, `docs/adr/0003-replan-goal-checklist.md`) 반영. 옛 모델 표·함수는 2단계로 지움: 앱이 더는 안 씀(#122, #123) → DB에서 지움(마이그레이션 20261101180000 `drop_legacy`). 지운 표: proposal, monthly\_plan, plan\_line, month\_close, month\_spend, spend\_category, big\_expense, saving\_deposit, close\_balance, goal\_use, emergency\_move, living\_check, income\_event, income\_item, income\_period, wedding\_item, wedding\_payment, todo, family\_member, unlink\_copy와 그 함수·예약 작업. 열거형과 남는 표의 옛 열(`care_day.member_id`, `asset.goal_id`·`pay_from` 등)은 그대로 두고 새로 쓰지 않음

- 재기획 새 테이블(20261029090000): `salary_split`·`split_line`(월급 계획, 쓰기는 `save_split`과 2026-11-09 줄 단위 RPC `split_line_set`·`split_line_add`·`split_line_delete`·`split_reorder`만), `pay_checklist`·`pay_check_line`(이번 달 월급 체크리스트, 만들기는 `start_checklist`만, 사이클은 `cycle_day`·`cycle_date`), `couple_space.salary_mode`·`joint_cycle_day`, `goal.owner_user_id`(null = 우리 목표)·`visibility`
- 목표 돈 움직임(20261029150000, 2026-11-08 ADR 0007로 앱이 안 씀): `goal_move`(넣기·빼기·꺼내 쓰기, 쓰기는 `move_goal`·`undo_goal_move`만), 모은 금액 `goal_saved_sums()`, 목표 ↔ 월급 계획 저금 줄 트리거 `goal_lines`
- 자동 결혼기념일(20261029180000): `care_day.auto`·`auto_moves`, `couple_space` 트리거 → `sync_wedding_care(공간)`
- 파트너 합류(20261030090000): `complete_join`, `set_join_salary_mode`, `discard_prefill`, `joining_space`(내부), `app_user` 트리거 `notify_first_goal`
- 관리 방식(20261030120000): `set_salary_mode`, `set_joint_cycle_day`, `start_checklist`(방식을 바꾼 달은 옛 체크리스트 유지). 휴지통(20261030150000): `trash_rows`, `restore_trash` 제안 없이
- `app_config`, `app_user`(프로필: 호칭, 신랑/신부, 출생연도, 일 형태, `space_id`, 월 실수령, 월급날, 용돈), `consent`, `couple_space`(파트너 추정 수입, 고정지출 합계, 생활비, 대출 상환, 분담 방식. 재기획 뒤로는 옛 열), `fixed_expense`(옛 고정지출 그룹과 세부 항목), `goal`, `invite`, `account`(옛 통장 역할, 남은 옛 읽기), `invite_attempt`(초대 코드 오류 횟수), `asset`·`asset_history`(자산·부채와 금액 이력)
- 공간 소속은 `app_user.space_id`. `is_space_member(space_id)`가 이걸 본다. 공간은 `ensure_my_space()`만 만든다
- 사용자가 직접 못 바꾸는 열(우리 둘 상태, 계정 상태, 로그인 수단)은 열 단위 `grant update`에서 뺀다
- `stamp_actor()` 트리거: created_by, updated_by, 휴지통에 넣을 때 deleted_by를 auth.uid()로. 목표, 고정지출 삭제는 `deleted_at`만(영구 삭제 정책 없음)
- 초대 코드: `create_invite()`(6자리, 0 O 1 I L 제외, 7일). 링크는 `https://sweetwo.kr/i/{코드}`(모바일은 앱 링크로 앱이 바로 엶, (전환 전) app.sweetwo.kr), 앱 스킴 링크는 `sweetwo://i/{코드}`
- 기준일(체크리스트 만드는 날)은 각자면 그 사람 월급날, 합쳐서면 `couple_space.joint_cycle_day`(기본 = 두 월급날 중 늦은 날, → 아래 S-11d). 옛 `base_day`·`base_day_last`·`account_mode` 열은 남겨 두고 새로 쓰지 않음
- 서버 분석 이벤트(20261122090000, 2026-11-12 QA 6구간 S6-02): `server_event`(이름, 가명 `user_id`·`space_id`, `props`, `sent_at`). 앱(anon·authenticated)은 읽지도 쓰지도 못함(RLS 켬 + 권한 회수, `mail_outbox`와 같은 서버 전용 표). 쓰기는 내부 `server_track(이름, 사람, 공간, props)`만: ‘분석 수집’을 끈 사람(`analytics_off`) 것은 남기지 않고, 공동(합쳐서) 것은 한 사람이라도 끄면 안 남김. 지금 남기는 것: `checklist_generated`(`pay_checklist` 미룬 제약 트리거, 트랜잭션 끝이라 줄 수가 들어감), `checklist_closed`(`state` → `closed` 트리거), `notification_sent`(20261126090000, QA 10구간 S10-03, `track_noti_sent`: `notify`가 행을 새로 넣으면 `inapp`, `claim_push`가 꺼내면 `os`(알림마다 1번), `mail_missed_notifications`가 메일을 쌓으면 `email`. props `type`(kind), `channel`, `cap_scope`(`noti_always_mail`이면 `out_of_cap`), pgTAP `s10_noti.test.sql`). 금액 구간은 `amount_band`(core `amountBand`와 같은 이름). PostHog로 보내고 `sent_at`을 채우는 일은 분석 단계에서. pgTAP `s6_checklist.test.sql`(트랜잭션 안에서는 `set constraints all immediate`로 미룬 트리거를 내보내 확인)
- v2.2 지표(20261209090000, 2026-11-13 PR 14, 32 0장): 서버 이벤트 넷을 표 트리거로 더함(함수를 다시 쓰지 않음): `auto_line_confirmed {kind}`(`pay_check_line` 자동 줄 wait → checked이고 `checked_by` 없음, 날짜 없는 자동 저금 `goal_move` reason_code auto), `progress_news_sent`(`notification` kind progress_news), `salary_change_applied {months_ahead, has_until}`(`salary_change.applied_at` 처음 채움), `unlink_resolved {path: timeout}`(`couple_unlink` how deadline 확정). 어드민 지표 `admin_metrics(p_months)`(AD-01 8번, `admin_require` 모든 역할 + aal2, 집계 jsonb만): 북극성 판정은 내부 `metric_couple_month(space, month)` 하나(32 0-1과 같은 말, 바꾸면 둘을 같이), 비율 칸은 `metric_ratio(num, den)` → `{num, den, pct}`. 앱 응답 Zod `AdminMetrics`(core), 훅 없이 `fetchAdminMetrics`(api). `save_split` 새 버전: 보내기 줄은 늘 맨 뒤 + 옛 설정 이어받기(각자 계열에서 트리거가 sort 0으로 넣어 맨 위로 가던 것). pgTAP `v22_metrics.test.sql`
- ‘이전 값으로 돌리기’(20261210090000, 14 N-01·N-02 7a, R-08): `partner_change`에 `before_raw`·`after_raw`(jsonb, 값 없음 = JSON null, 열이 SQL null이면 예전 기록이라 못 돌림)·`reverted_at`·`reverted_by`. 원래 값은 11인자 `log_partner_change(…, p_before_raw, p_after_raw)`로 남김(9인자는 그대로): 공동 저금 목표 금액·기한·이름(`goal_partner_change`), 공동 월급 계획 줄 금액(`log_split_changes`, 같은 열쇠 줄이 하나일 때만 돌림), 경조사 메모(`care_partner_change`). 알림 하나 = flush 한 번의 묶음(dedupe `pc:{첫 id}:now|week` + 같은 `sent_at`), 판정은 내부 `partner_change_group(알림)` 하나(그 뒤 같은 topic·ref·field 기록 없음, 지금 값 = after, 연결, 같이 쓰는 항목). 앱은 `revertible_notifications()` id 목록 → N-01·N-02 줄 아래 글자 버튼, `revert_partner_change(알림)` → 원래 값 + 바꾼 사람에게 알림 한 건(돌리며 남긴 기록은 보낸 것으로). 열을 더해 `flush_partner_changes`도 새 버전(행 모양만). 자산 금액은 돌리지 않음. pgTAP `v22_revert_change.test.sql`
- 분석 이벤트 타입은 `packages/app/src/shared/analytics.ts`(+ `analytics-saving.ts`) `AnalyticsEvent` 한 곳, 이벤트 이름 하나에 정의 하나(같은 이름을 두 번 적으면 속성이 어긋남, PR 14에서 합침). 월급 관리 방식 값은 4-2 코드(`separate` / `combined`)로 보내고 엔진 값 joint는 `salaryModeCode()`로 바꿈. 구현 상태 표는 32 0-5
- 만 18세 미만: 가입 때 A-05 ‘만 18세 이상이에요’ 체크로만 확인하고 가입 뒤 나이로 계정을 지우지 않음. 옛 `delete_minor_account`·`delete_underage_account`는 20261103210000에서 지움
- v2.2 DB(ADR 0009, plan v2.2 9-2 PR 1~5). PR 1 enum 값(20261201080000, 추가만, 값을 쓰는 표·함수는 다음 마이그레이션부터): `split_line_kind` + `send`(한 사람 관리형 ‘보내기’, 서버가 계산), `shared_account`(같이 쓰는 통장 줄), `marriage_status` + `dating`, `living_together`(O-11 4지선다, 옛 `undecided`는 남김), 새 enum `plan_share`(all, saving\_only, done\_only), `money_in_kind`(salary, bonus, family, work, refund, etc), `goal_move_reason`(fix, used, interest, reconcile, note\_paid, custom, auto). 앱은 화면 PR 전까지 새 줄 종류를 저장된 이름으로만 보여 줌. pgTAP `v22_enum_values.test.sql`
- v2.2 PR 2 확인 루프(20261201090000, 계약은 마이그레이션 머리 주석 1~10, core `pay-confirm.ts`가 같은 결과): `split_line.in_checklist`(새 줄 기본 = 생활비·용돈만 false, D2)·`auto_pay`(기본 send·shared\_account만 true)·`auto_day`(1~31, 31 = 말일, null = 월급날, 날짜 없음은 1일), 새 줄 기본값은 BEFORE 트리거 `split_line_defaults`, `save_split`은 같은 줄(kind, goal, user, name) 설정을 이어받음, 줄 설정 저장 `split_lines_configure(p_items)`(W-01d 여러 줄). `pay_check_line.auto`·`auto_due`(`auto_due_date(s, e, day)`)·`late`, `pay_checklist.confirmed_at`·`confirmed_by`, `app_user.payday_none`(기준일 `cycle_day`에서 빠짐)·`push_kinds`(없는 키 = 켬, `push_kind_key`·`push_kind_on`, `claim_push`가 끈 종류는 푸시 안 함), `salary_split.checklist_from`(D1 소급 없음: 이 날 전에 시작한 사이클 목록은 안 만듦, 옛 계획 null), `goal_move.reason_code`·`auto_line_id`·`auto_on`. 모은 금액 `goal_saved` = 시작 금액 + 체크한 저금 줄 + reason\_code가 있는 goal\_move(in +, out −). 자동 확인 `auto_confirm_due_lines()`(pg\_cron `auto-confirm-lines` 00:05 KST, 목록을 만들거나 맞출 때도 바로 `confirm_auto_lines`), 날짜 없는 사람 자동 저금 줄은 나가는 날 `goal_move(in, auto)` 한 번, 서버가 더해 목표 금액에 닿으면 `goal_auto_achieve`(achieved\_seen 빈 배열). 한 번 확인 `confirm_payday(p_checklist)`(각자 주인, 합쳐서 누구나, 남의 용돈 줄은 건너뜀), `check_pay_line` 늦은 확인(`late_check_until` = 다음 사이클 끝, 끝난 목록에서 풀면 skipped), 합쳐서 용돈 줄은 주인만. 월급날·월급 전 확인 알림은 손 줄(auto 아님)이 있을 때만, 손 줄 0이면 `send_progress_news()`(pg\_cron `send-progress-news` 09:00, 날짜 없는 사람은 1일, 대표 저금 `progress_hero` 이름 + %). 옛 pgTAP 중 생활비·용돈 줄을 쓰던 것은 `in_checklist` 켜기 또는 기대값 갱신, 이번 사이클 목록이 필요한 것은 `pg_temp.no_backdate()`. pgTAP `v22_check_loop.test.sql`
- v2.2 PR 3 관리 형태·공개·월급 변경(20261202090000, 계약은 마이그레이션 머리 주석 1~7): `couple_space.shared_living`·`shared_saving`(null = 안 고름)·`manager_user_id`, 2-5 표 `resolve_manage_style(living, saving, manager)`(manager = me·partner·together·each → salary\_mode, manager, style: one\_manager·together·living\_saving·living\_only·saving\_only·separate), 지금 형태 `my_manage_style()`. 바꾸기 `request_mode_change(living, saving, manager, phrase)` → applied·requested(연결된 공간의 각자 → 합쳐서, 관리하는 사람을 상대로 넘기기만 상대 수락, 그 밖은 바로 + 알림), `answer_mode_change(id, accept)` → accepted·declined·expired, `cancel_mode_change(id)`, 표 `mode_change_request`(공간마다 열린 요청 1개, 7일, Realtime). 적용은 내부 `apply_manage_style` → 엔진 `set_salary_mode`(앱 역할 실행 권한은 20261205090000에서 회수, PR 11). 공개 단계 `app_user.plan_share`(기본 saving\_only): 서버 필터 `partner_plan_view(p_viewer)`(S-13p는 주인이 p\_viewer = 상대로 부름), RLS `plan_row_visible`로 `split_line`·`pay_check_line` 상대 행도 같은 규칙(all = 모두, saving\_only = 저금·같이 쓰는 통장 줄, done\_only = 없음, 같이 계열 = 모두, 해제 대기 = 없음), `partner_profile` 수입·용돈은 같이 계열이거나 all일 때만. 한 사람 관리형 보내기 줄 `recalc_send_line(space)`(트리거: 월급·월급날, 용돈 줄, 형태 바꾸기, save\_split 뒤) = 1만 원 내림(월급 − 용돈), 앱 직접 저장 거절 `send_locked`, 합쳐서 용돈 줄은 주인만(`allowance_editable`, 한 사람 관리형은 관리하는 사람도 + `my_allowance` 알림). 월급 변경 `salary_change` + `schedule_salary_change(amount, from, until)`·`cancel_salary_change(id)`·`apply_salary_changes(today, user)`(그 달 사이클 시작일 `salary_change_day`, until 다음 달에 되돌림, `run_cycle_checklists`가 목록 만들기 전에 먼저 부름 + pg\_cron `apply-salary-changes` 00:01 KST), 인앱 알림 `salary_changed`. 홈 띠 닫기 `home_task_state` + `dismiss_home_task(key, state)`. 알림 프라이버시: 각자 계열 월급 계획 변경은 `log_partner_change`가 기록하지 않음, 같이 계열 월급 변경은 금액 없이, 푸시 본문 빼기 `noti_push_body_hidden`, 인앱만 `noti_inapp_only`. 새 열 `app_user.asset_share_default`·`rank_consent`·`rank_badge_home`·`last_reconciled_at`(PR 4·5에서 씀). 2단계 정리 대상: `goal.visibility`, `app_user.default_visibility`. 옛 pgTAP 중 상대 월급 계획 줄을 읽던 것은 `plan_share = 'all'`, 각자 계열 변경 알림 기대값은 없음으로 갱신. pgTAP `v22_manage_style`, `v22_share_filter`, `v22_send_allowance`, `v22_salary_change`
- v2.2 PR 4 같이 모으기와 돈 기록(20261203090000, 계약은 마이그레이션 머리 주석 1~9): 묶음 `saving_bundle`(각자 엔진·연결된 공간만, a = 만든 사람, `show_each_a/b`, `percent_only_a/b`, `achieved_seen`, Realtime) + `goal.bundle_id`, `bundle_create(goal, name, target, deadline)`·`bundle_join(bundle, goal)`(목표 금액 처음 값 = 두 목표 금액 합, Q11)·`bundle_update`·`bundle_leave`(풀기)·`bundle_set_visibility(bundle, show_each, percent_only)`(내 쪽만, 목표 금액 없으면 퍼센트만 못 고름)·`bundle_view()`(합계, 둘 다 켜야 상대 금액, 하나라도 퍼센트만이면 %만, 해제 대기면 상대 몫 빼고 paused)·`achieve_bundle(bundle)`, 합계 기준 달성 `bundle_refresh`(두 사람 푸시 `bundle_achieved`), `goal_saved_sums`는 상대의 묶인 저금 모은 금액을 둘 다 켰을 때만. 바로잡기 `adjust_saving(goal, delta, reason_code, reason, hide_from_summary)`(0원 아래 거절, 같이 모으는 저금이면 상대에게 사람·금액·사유 없는 인앱 `saving_adjusted`, 주간 요약 `weekly_saving`), 사유 글 `goal_move.reason`은 앱 역할이 못 읽음(`goal_move_reasons(goal)` 내 것만, 보기 `goal_move_public`), 잔액 맞추기 `reconcile_savings(items)`(`last_reconciled_at`), 쓸 곳 메모 `saving_note`(열 권한으로 직접 쓰기, `paid`는 `mark_note_paid(note, subtract)`만). 돈 들어왔어요 `money_in` + `log_money_in`·`money_in_set`·`money_in_delete`·`distribute_money_in(id, items)`(goal\_move in, custom, money\_in\_id), 읽기는 주인(공개 ‘모두’면 상대), 기간 `money_in_period(user, today)`(none·early·bar·gap, 필요한 돈 = 지금 월급 계획 모든 줄 합). 분담 `shared_account` + `propose_split(name, total, rule, share_mine)`(half·income\_ratio·custom, 1만 원 반올림, 월급 비율은 두 사람 모두 공개 ‘모두’일 때만, 몫과 비율만 저장)·`answer_split(id, accept)`(수락 = 각자 사람마다 / 합쳐서 공동 한 줄 `shared_account` 줄, `split_line.shared_account_id`). 진행 소식 대표는 묶음 먼저, 링크는 홈. 인앱만 종류에 saving\_adjusted·bundle\_created·bundle\_changed·split\_result·weekly\_saving. Realtime 발행: saving\_bundle, shared\_account, money\_in, saving\_note(읽기 정책대로, goal\_move는 사유 열 때문에 넣지 않음). pgTAP `v22_bundle`, `v22_adjust`, `v22_money_in`, `v22_split_propose`
- v2.2 PR 8 온보딩·합류 보완(20261206090000, 계약은 마이그레이션 머리 주석 1~4): 합류 전 O-30c ‘파트너가 주로 해요’ = `couple_space.manager_pending_partner`(엔진 합쳐서, 관리하는 사람 없음, 이름은 one\_manager), 합류를 마치는 순간(`complete_join`·`finish_join` → 내부 `claim_pending_manager`) 합류한 사람이 관리하는 사람 + 보내기 줄. `join_context()`에 `shared_living`·`shared_saving`·`manager`(starter·joiner·null)·`style`, `has_plan`은 줄이 있는 월급 계획만(관리 형태를 고르며 생긴 빈 공동 월급 계획은 없는 것), 공동 줄에서 send 뺌. `request_mode_change`는 요청한 사람이 아직 온보딩을 마치지 않았으면(O-30 답) 연결돼 있어도 바로 적용. 대기 ‘알려 주기’ `nudge_starter()` → sent·too\_soon·not\_waiting(같이 계열 + 시작한 사람 월급 계획 없음, 24시간 1번, 알림 kind `join_nudge`). 앱: 온보딩은 `request_mode_change`만 부르고 `set_salary_mode`·`set_join_salary_mode`(2단계 정리 대상)는 부르지 않음, P-04 ‘보내요’ 요청은 합류를 마친 뒤 앱이 보냄(`sweetwo.joinSend`). pgTAP `v22_join_style`
- v2.2 PR 10 되돌리기(20261207090000): `undo_saving_adjust(move)`(내가 넣은 바로잡기 한 줄만, 돈 들어왔어요 나눠 넣기·자동 넣기 아님, 상대 한 줄 `saving_adjusted:{move}`도 지움, 냈어요로 뺀 것이면 메모를 안 냄으로, `saving_after_change`), `unpay_saving_note(note)`(냈어요 되돌리기). W-10b·W-10c·W-14 Toast ‘되돌리기’가 씀. pgTAP `v22_saving_undo`. 앱 화면: `features/salary` `together.ts`(묶음·움직임·메모 쿼리, Realtime saving\_bundle·saving\_note·money\_in), `bundle-parts.tsx`(BundleCard·BundleRow·MoneyField), 경로 `togetherPaths`(paths.ts). e2e 가짜 서버는 `apps/mobile/e2e/mocks/saving.ts`(mockOnboarding 뒤에 붙여 v2.2 저금 함수만 맡고 나머지는 넘김, 두 계정이 같은 SavingDb)
- v2.2 후속 고침(20261208090000, 계약은 마이그레이션 머리 주석 1~7, 2026-11-13 사용자 결정 P1 = A·P2 = A): ① ‘했어요만’(`plan_share = done_only`, 각자 계열)이면 상대에게 저금 이름·목표 금액·모은 금액을 어느 길로도 주지 않음. 도우미 `saving_owner_hidden(space, owner)`(주인 아님 + 해제 대기 또는 각자 + done_only), `bundle_each_open(bundle)`(둘 다 켬 + 퍼센트만 아님 + 둘 다 done_only 아님), `goal_amount_visible(goal)`. goal 읽기 정책(Realtime 포함), `goal_move` 읽기 정책(= `goal_move_public`, 묶인 상대 저금은 각자 금액이 열렸을 때만), `space_goals`(가린 상대 저금은 “개인 저금”, 목표 금액·기한·시작 금액 없음, 해제 대기면 행 없음), `goal_saved_sums`, `goal_story`, 쓸 곳 메모(`goal_visible`), `bundle_view`(한 사람이라도 done_only면 `show_each` false, 가린 상대 저금 이름 null), `partner_plan_view`(done_only 줄 이름 null), 달성 알림(상대에게 “개인 저금 …”). core `partnerPlanView`·`bundleView(…, doneOnly)`가 같은 결과, 앱 `SavingItem.private`(W-13 이번 달 확인 여부만, 열지 않음). ② S-11c ‘이번 달부터’는 그 달 월급날 전이어도 `schedule_salary_change`가 바로 적용(내부 `apply_salary_change_row`), 기존 트리거가 보내기 줄·이번 사이클 체크 안 한 줄만 맞춤. core `salaryChangeImmediate`(이번 달이면 true), `salaryChangeAppliedDay`(띠 6번 = 적용한 날). ③ `asset.quick`(F-03q). ④ 첫 자산으로 `asset_share_default`를 정하는 트리거는 연결된 공간에서만(혼자·미합류 기본값은 한 번 비움). ⑤ `networth_summary()` = 앱 `netWorthOf`(숨기기 빼고 + 파트너 총액만). ⑥ 각자 계열 P-04 ‘보내요’: `app_user.send_intent_space` + `mode_change_request` 트리거, `recalc_send_line`이 보낸 사람 각자 계획에 보내기 줄(요청 열림·거절·만료 뒤에도), 취소·형태 적용·공간 이동이면 지움. api `saveSplit`은 보내기 줄을 빼고 보냄. ⑦ `start_after_unlink`는 O-30부터. 홈 띠 2번은 받은 열린 `reconnect_request`. ⑧ `join_context().member`는 늘 boolean(공간 없는 합류자 = false, 예전 null로 P-03이 비던 B1), core Zod도 null → false. v2.2 RPC 응답 26가지(관리 형태, 공개 필터, 묶음, 돈 들어왔어요·기간, 메모, 분담, 순위, 순자산, 월급 변경, 다시 연결, 합류)를 로컬 DB에서 core Zod로 읽어 맞는지 확인함. pgTAP `v22_done_only`, `v22_salary_now`, `v22_send_intent`, `join_reservation`

### v2.2 데이터와 서버 (2026-11-13, ADR 0009)

기획 정본 → `docs/spec/09-data-items.md` 7장(테이블·열), 07(확인 루프·월급 변경·기간), 08(관리 형태·공개·예외 둘·해제), 06(계산). 구현 순서는 PR 1(enum 값) → 2(확인 루프) → 6(core) → 8·9 → 3·4 → 10·11 → 5 → 12 → 13 → 14. 아래는 구현할 때 지킬 규칙만.

- enum은 값 추가만(`ALTER TYPE … ADD VALUE`는 같은 트랜잭션에서 못 써서 따로 먼저 마이그레이션): `split_line_kind` + `send`, `shared_account` / `marriage_state` + `dating`, `living_together` / 새 enum `plan_share`(all, saving_only, done_only), `money_in_kind`(salary, bonus, family, work, refund, etc), `goal_move_reason`(fix, used, interest, reconcile, note_paid, custom, auto). check 제약을 바꿔야 하면 새 열로 피한다
- 새 표: `saving_bundle`, `saving_note`, `money_in`, `shared_account`, `mode_change_request`, `reconnect_request`, `partner_code`, `salary_change`, `rank_consent_request`, `home_task_state`. RLS는 09 7-1 표대로
- 공개 필터는 서버 함수 하나(`partner_plan_view(p_viewer)`, security invoker 뷰·함수). S-13p 미리 보기도 같은 함수를 ‘상대로서’ 부른다. 저금마다 공개 열(`goal` 공개 범위)은 새 코드에서 읽지 않고 2단계로 지운다. 묶음 응답은 `show_each_a and show_each_b`일 때만 상대 금액, `percent_only_a or percent_only_b`면 합계·목표 금액 대신 %만(홈 화면 위젯도 앱이 받은 이 값을 씀, 따로 위젯 피드 없음)
- 바로잡기 사유 `goal_move.reason`은 주인만. 상대는 `goal_move_public` 뷰(reason 뺌)로만 읽는다. 묶음·공동 저금 바로잡기의 상대 활동 기록·주간 요약은 사람·금액·사유 없는 한 줄, `hide_from_summary`면 주간 요약에서 뺀다
- 권한 예외 둘(관리 형태 합치기 `request_mode_change`/`answer_mode_change`/`cancel_mode_change`, 분담 `propose_split`/`answer_split`)만 요청 → 답. 그 밖의 같이 쓰는 값은 지금처럼 바로 고침 + `partner_change` + Toast ‘되돌리기’. 순위 동의(`request_rank_consent`/`answer_rank_consent`)는 동의 기록으로 따로
- 분담 월급 비율은 서버에서만 계산하고 결과 몫과 비율만 돌려준다(월급 원값을 응답·표에 넣지 않음). 두 사람 모두 `plan_share = all`이고 월급이 있을 때만
- `save_split`: 각자 파트너 거절(지금) + 합쳐서 용돈 줄 주인만(한 사람 관리형이면 관리하는 사람도, 주인에게 `my_allowance` 알림) + ‘보내기’ 줄 직접 저장 거절 + `in_checklist`/`auto_pay`/`auto_day` 여러 줄 한 번에(W-01d). ‘보내기’ 금액은 트리거 `recalc_send_line`만
- 확인 루프: `onboarding_reset_plan`은 첫 확인 목록을 만들지 않는다(소급 없음). 생성은 `in_checklist`만, 자동 줄은 `auto`/`auto_due`. `confirm_payday(p_checklist)`는 남은 손 줄만 체크 + confirmed. `check_pay_line`은 지난 사이클 줄을 다음 사이클 끝까지(`late`). `payday_none`이면 확인 목록 없음
- 해제: `request_unlink`는 요청자 개인 데이터를 즉시 가리고 묶음을 멈춘다. `confirm_unlink`는 혼자 공간 둘을 만들고 주인 있는 행을 옮기고 같이 쓰는 행만 지운다(운영 보관 30일). 계정 삭제도 같은 규칙. 30일 재연결 복구(옛 `restore`)는 새 코드에서 부르지 않음, 다시 연결은 `request_reconnect`(7일 1회, 차단 조용히)
- 자산 공개 첫 선택: `asset_share_default`가 null이면 자산 저장에 공개 단계를 명시해야 받음, 첫 저장 값을 기본값으로
- 순위: `networth_rank_pair()`는 연결 + 두 사람 `rank_consent`일 때만 순위(둘의 합, 숨기기 제외, 연령대 = 먼저 태어난 사람), 아니면 `peer_median(birth_year)`. 첫 조회 무료(`rank_view.paid_by_ad`)
- 앱 잠금: PIN 필수 검사 없음(로그인 뒤 PIN 없는 기기 허용)
- core 한 곳(PR 6, `packages/core/src/rules/`): `manage-style.ts`(`resolveManageStyle` 2-5 표 = 서버 `resolve_manage_style`, `manageStyleOf` = `my_manage_style`, `modeChangeNeedsAccept`), `pay-confirm.ts`(`autoDue` = `auto_due_date`, `cycleOf`·`firstChecklistStart` = `make_checklist` 소급 없음, `lateCheckUntil` = `late_check_until`, 손 줄 `manualLeft`·`isConfirmed`·`reviewDue`, `confirmableLines` = `confirm_payday` 권한), `money-in-period.ts`(`moneyInPeriod` = `money_in_period`, 막대 `periodFillPct`), `saving-bundle.ts`(`bundleView` = `bundle_view`, `bundleNextStatus` = `bundle_refresh`), `salary-change.ts`(`salaryChangeDay` = `salary_change_day`), `share-view.ts`(`partnerPlanView` = `partner_plan_view`), `next-saving.ts`(칩 표, 기한 지남), `salary-split.ts`(`sendAmount` = `recalc_send_line`, `equalAllowance` 합쳐서 같은 용돈, `splitLineDefaults` = `split_line_defaults`, `leftover`는 보내기 줄을 셈하지 않음 [확인 필요]), `plan-ratio.ts`(`splitShares` = `propose_split`, 정수(BigInt) 반올림), `networth-rank.ts`(`rankPair` = `networth_rank_pair`, `peerMedian` = `peer_median`), `asset.ts`(`netWorthSummary` = `networth_summary`, 평가금액 기본), `saving-item.ts`(`savedTotal` = `goal_saved`, `savingRemain` G5, `savingMonthGain` ‘이번 달 +’), `home.ts`(`pickHeroes`·`pickHero`, `pickMonthLine`, `pickTopTask` 16순서, `reconcileTask` 90일). 새 RPC 응답 Zod는 `schemas/v22.ts`. 06·07 예시를 Vitest와 pgTAP에 같은 값으로. 예전 `homeTodo`·`salaryState`·`netWorth`(원금 기본)는 화면 PR(9, 12)이 바꿀 때까지 남김
- 분석: 32 0-4 이벤트(금액은 `_band`), 서버 이벤트 `auto_line_confirmed`, `progress_news_sent`, `salary_change_applied`
- v2.2 PR 5 해제·순위·자산 공개(20261204090000, 계약은 마이그레이션 머리 주석 1~9): 해제 확정 `finish_unlink`와 계정 삭제 `account_deletion_for`는 혼자 공간 둘을 만들고 `move_owned_rows(from, user, to)`로 주인 있는 행(내 명의 자산·부채와 이력, money\_in, salary\_change, 각자 엔진이면 내 월급 계획·확인 목록·저금·돈 움직임·쓸 곳 메모)을 옮김, 같이 쓰던 것은 원래 공간째 30일 보관 뒤 지움(복구 없음), 묶음은 닫힘. 해제 대기 중 상대 개인 저금은 goal 읽기 정책에서 가림. 다시 연결은 복구 없는 새 연결: 표 `reconnect_request`, `request_reconnect()`(마지막 해제 상대에게 7일 1번, 상대가 ‘다시 받지 않기’면 조용히 `silenced`), `answer_reconnect(p_accept, p_block)` → 수락이면 요청한 사람 공간 초대 코드(text, 앱이 join\_space). 해제·탈퇴·다시 연결 요청 푸시는 잠금 화면 “sweeTwo” / “확인할 알림이 있어요”(`noti_lock_generic`). 자산 순위: `rank_consent_request`(Realtime 발행) + `request_rank_consent()`·`answer_rank_consent(id, accept)`·`set_rank_consent(false)`(두 사람 배지·저장 순위 지움), `rank_badge_home`은 두 사람 동의일 때만(트리거), `networth_rank_pair()`(둘 다 동의 = 둘의 합(숨기기 제외, 평가금액) + 먼저 태어난 사람 연령대 + `rank_top_pct`(core rankTopPct와 같음, 연령대별 분위 표가 없어 basis all), 아니면 `peer_median(birth_year)`), 첫 조회 무료 `record_rank_view(paid_by_ad)` + 표 `rank_view`. 자산 공개 첫 선택 `set_asset_share_default(vis)`, 아직 null이면 첫 내 명의 자산 공개 단계를 기본값으로(트리거, 거절은 앱 v2.2 뒤 2단계). 순자산 `networth_summary()`(평가금액 + 원금 보기). 대신 입력 정리 `purge_proxy_entries()`(pg\_cron `purge-proxy-entries` 04:40 KST). 2단계 정리 대상: `couple_unlink.reconnect_*`, `reconnect_ok()`. 옛 pgTAP 중 30일 복구·해제 문구를 보던 것(`unlink_replan`, `account_deletion`, `partner_noti_copy`)은 v2.2 기대값으로. pgTAP `v22_unlink_keep`, `v22_reconnect`, `v22_rank_pair`, `v22_asset_first_share`

### 마이그레이션과 RLS 규칙

테이블은 모두 같은 틀로 만들고, 틀에서 빠지면 리뷰에서 되돌림.

- 공통 컬럼(위 ‘공통 필드’) + `space_id` 인덱스 필수
- 트리거: updated\_at과 version 갱신, change\_log 기록
- RLS 켬 + 이름 붙은 정책 4개(`<테이블>_select`, `_insert`, `_update`, `_delete`)
- 정책은 `is_space_member(space_id)`만 씀. 이 함수는 `STABLE SECURITY DEFINER`, `SET search_path = ''`
- 공개 범위 뷰는 반드시 `WITH (security_invoker = true)`
- pgTAP: 테이블마다 본인, 파트너, 다른 커플, 익명 × 읽기, 추가, 수정, 삭제
- pgTAP 파일 안에서 `'ok'`·`'not ok'`로 시작하는 값을 돌려주는 함수를 맨 select로 부르지 않음(TAP 줄로 읽혀 계획 개수가 어긋남). `is(...)`로 감싸서 단언으로
- 스키마 제거는 최소 지원 버전이 예전 앱을 넘어선 뒤에만

### 금액과 날짜

- 금액은 정수 원만. 클라이언트 number는 2^53 미만인지 검사(Zod), 넘으면 저장 거부
- 반올림 함수는 core/money.ts에만: `roundTo10k`, 나머지 배분(`allocateRemainder`) 등. 0에서 멀어지는 쪽 반올림(half away from zero)으로 PG `round()`와 같게
- 테스트 벡터 JSON 하나(`core/rules/vectors/*.json`)를 Vitest와 pgTAP이 같이 읽음
- 주기, 기준일 계산은 항상 Asia/Seoul. 서버 시각은 `now()`, DB timezone도 Asia/Seoul
- pg\_cron은 UTC로 도는 것을 전제로 씀: KST 00:00 = `0 15 * * *`

### 필드 암호화

- KMS 봉투 암호화: space마다 데이터 키, KMS가 감싼 키만 DB에. 풀린 키는 Edge Function 메모리에 잠깐만 캐시
- 암호문 형식: `v1:keyId:iv:ct:tag`
- 쓰기뿐 아니라 읽기도 Edge Function을 거침
- 암호화 필드는 검색, 정렬, 필터 대상이 아님
- 키 교체와 백업 복구에는 KMS 접근이 필요

### 사진 처리

- 클라이언트가 canvas로 줄임: 프로필과 목표 사진 512px 정사각, 경조사 사진 긴 변 1600px
- 다시 인코딩해 EXIF(위치 등) 제거, webp 또는 jpeg로 업로드
- 서버가 MIME과 크기를 다시 확인
- 비공개 버킷, 경로 `space_id/…`, Storage RLS도 `is_space_member`
- 목표 사진: 프로필 사진과 같은 비공개 버킷, 경로 space\_id/goal/{goal\_id}, 커플 단위 접근(Storage RLS is\_space\_member), 크기 상한은 프로필 사진과 같음. 지우면 goal.photo\_path를 null로
- 보기는 서명 URL만(유효 시간 짧게)
- 행을 지우면 파일도 지움. 탈퇴 때 프로필 사진은 30일 유예 없이 즉시 삭제
- 프로필 사진은 공간을 따라감(2026-11-12 QA 11구간 D2, 20261127090000): `app_user.space_id`가 바뀌면(연결 해제 확정, 상대 계정 삭제, 합류, 다시 연결, 계정 삭제 취소 등) 트리거 `avatar_follow_space`가 `storage_move`(서버 전용 표)에 옮길 일을 쌓음. SQL로는 저장소 파일을 옮길 수 없어서(`storage.objects` 이름만 바꾸면 실제 파일과 어긋남) Edge Function `purge-storage`(`kick_purge`, 10분마다)가 `claim_storage_move` → 옮길 곳 지우기 + Storage API `object/copy` → `done_storage_move`(avatar\_path를 새 경로로, 옛 파일은 `storage_purge`). 옮기기 전에도 보이게 avatars 읽기 정책은 내 공간 폴더 + 같은 공간 사람의 지금 avatar\_path. `set_avatar`로 바꾸거나 지우면 옛 파일도 지울 목록에, 지금 누군가의 사진이거나 옮길 곳인 파일은 `claim_storage_purge`가 지우지 않음. pgTAP `s11_settings.test.sql`

## API와 오류 규칙

단순 사실 값만 테이블에 바로 쓰고, 나머지는 모두 RPC(DB 함수)로만 씀.

### 쓰기 경로

| 쓰기 종류 | 경로 |
| --- | --- |
| 사실 값(잔액 등 단순 필드) | 테이블 직접 쓰기 + RLS |
| 상태 전환, 배분, 계산, 여러 테이블 쓰기 | RPC만 |
| 암호화 필드, 사진, 메일, KMS | Edge Function |

- RPC는 `SECURITY DEFINER` + `SET search_path = ''`, 함수 안에서 `is_space_member` 직접 확인
- RPC 인자는 core의 Zod 스키마와 1:1
- 모든 쓰기에 클라이언트가 만든 `mutation_id`(uuid). 고유 제약으로 같은 요청 두 번은 한 번만 반영
- 목록은 keyset 페이지(`created_at, id` 기준), offset 쓰지 않음

### 오류 코드

- DB: `RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = '<code>'` (예: `unlink_pending`)
- api가 `AppError{code, retryable}`로 바꿈 → 화면은 기능 copy.ts의 문구 표에서 찾음
- 오류 코드, 사용자 문구, 재시도 여부는 표 하나(docs/errors.md)로 관리하고 기획서 ‘공통 상태’ 탭과 연결

| 예 코드 | 문구 | 재시도 |
| --- | --- | --- |
| `network_offline` | 공통 상태 탭 ‘오프라인’ 문구 | 자동 |
| `version_conflict` | 충돌 선택 화면 | 사용자 선택 |
| `unlink_pending` | 연결 해제 대기 중 안내 문구 | 없음 |

## 동기화와 오프라인

변경은 space별 변경 번호로 줄을 세우고, 기기는 마지막 번호 이후만 받음.

### 변경 번호와 신호

- change\_log.seq는 space마다 1씩 늘어남: couple\_space 행을 잠그고 +1. bigserial이나 시각을 쓰지 않음(트랜잭션 순서와 어긋남)
- 트리거가 Realtime broadcast로 비공개 채널 `space:{id}`에 보냄(테이블, id, seq만. 값은 안 보냄)
- api/realtime.ts에 테이블/id → TanStack 쿼리 키 표를 두고 그대로 무효화

### 오프라인

- 볼 수만 있음: 기기 암호화 조회 캐시(→ 위 ‘권한 규칙’ 아래 오프라인 조회 캐시), 쓰기는 api가 바로 막고 “인터넷에 연결되면 할 수 있어요”
- 입력 큐는 두지 않음(2026-10-27 결정, 기획서 30 동기화 4장). 다시 필요해지면 ADR로

### 충돌

- 바뀐 필드만 + 기준 version을 보냄
- 서버 함수가 change\_log에서 그 필드의 마지막 변경(누가, 언제)을 확인
- 파트너가 1분 안에 같은 필드를 바꿨으면 `conflict{field, theirs}` 반환 → 선택 화면. 아니면 마지막 쓰기가 이김
- 삭제와 수정이 부딪히면 삭제가 이기고 항목은 휴지통으로(복구 가능)

- 예전 월말 정리 함께 모드(진행자 잠금 `month_close.locked_by`, Presence)는 월말 정리와 함께 없앰(기획서 30 동기화). 월급 전 확인(W-05)은 체크리스트 줄 체크와 같은 규칙이라 잠금이 없음

## 인증과 세션

모바일 앱은 시스템 로그인 창 OAuth(PKCE) + https 콜백 + sweetwo:// 링크, 토큰은 네이티브 브리지만 다룸(아래 ‘모바일 세션’). 데스크톱 로그인(Electron main, 딥링크, safeStorage)은 ADR 0008로 없앰.

### 로그인 복귀와 링크

- 리다이렉트는 https://sweetwo.kr/auth/callback 하나((전환 전) app.sweetwo.kr). 이 정적 페이지가 code와 state를 sweetwo://auth/callback으로 넘김. 루프백(127.0.0.1)은 쓰지 않음(Apple 로그인이 https 리다이렉트만 허용)
- 링크 허용 목록: `packages/core/src/deep-link.ts`(+ 테스트). `sweetwo://auth/callback`의 code, state만 받고 나머지는 버림. 초대는 `sweetwo://i/{code}`와 앱 링크 `https://sweetwo.kr/i/{code}`, 알림 메일은 /n, /n/settings

### OAuth 앱과 리다이렉트

| 제공자 | 로컬 | 스테이징 | 운영 |
| --- | --- | --- | --- |
| 카카오 | 개발용 앱 | 스테이징 앱 | 운영 앱 |
| 구글 | 개발용 클라이언트 | 스테이징 클라이언트 | 운영 클라이언트 |
| 애플 | 개발용 Services ID | 스테이징 Services ID | 운영 Services ID |

- 카카오: 이메일은 선택 동의 항목. Supabase 카카오 설정에서 ‘이메일 없는 사용자 허용’을 켜야 거부한 사람이 A-04로 감(로컬은 config.toml `email_optional = true`)
- Supabase Auth 리다이렉트 허용 목록: 환경마다 그 환경의 콜백 주소 하나. 쿼리(`?from=app&state=…`)를 붙여 같은 주소를 거치므로 끝에 `**`를 붙인다
  - 운영 `https://sweetwo.kr/auth/callback**`(웹사이트 `apps/site/src/pages/auth/callback.astro`, from=app만 sweetwo://로 넘김), 스테이징 `https://dev-app.sweetwo.kr/**`(앱 묶음의 같은 복귀 화면), 로컬 `http://localhost:5173/auth/callback**`
- 같은 이메일, 다른 소셜(A-02 ‘자동 합치기 없음’): Supabase는 확인된 같은 이메일의 소셜 계정을 한 사용자로 자동 연결한다. 그래서 로그인 직후 `login_state(누른 제공자)`가 가입한 제공자와 다르면 `provider_conflict`를 돌려주고, 앱은 바로 로그아웃한 뒤 “이미 {카카오}로 가입한 이메일이에요”를 보여 준다. 계정 식별은 가입 때 제공자(`app_user.provider`)
- 가입: 소셜 로그인만으로는 계정이 아니다. A-05 ‘동의하고 계속하기’의 `complete_signup()`이 `app_user`와 동의 기록(필수 3종 + 마케팅)을 한 번에 만든다. 필수 ‘만 18세 이상이에요’ 체크는 동의 종류가 아니라 확인 기록 `app_user.adult_confirmed_at`(가입 시각, 20261101230000). 나이로 가입 뒤 계정을 지우지 않음(옛 `delete_underage_account`·`delete_minor_account`는 20261103210000에서 지움). 웹(개발·e2e)도 앱처럼 로그인을 유지(localStorage, ‘이 기기에서 로그인 유지’·14일·30분 잠금 없음). 그 전에 그만두면(A-04·A-05 뒤로, 하드웨어 뒤로, 앱 종료) 앱은 로그아웃하고 다음 실행은 A-02부터(실행 때 `login_state`가 `new`이고 누른 제공자가 없으면 로그아웃), 서버는 24시간 지난 미가입 소셜 계정을 지움(`purge_abandoned_signups`, pg_cron `purge-abandoned-signups` 매일 KST 04:20, 20261117090000. 관리자·소셜 외 로그인은 건드리지 않음)
- 동의 기록 버전(20261117090000): 앱은 `complete_signup_v2(p_versions)`로 보여 준 문서 버전(core `CONSENT_VERSIONS`: 이용약관·개인정보 = 웹사이트 L-05 원본 frontmatter, 공간 공유·마케팅 = `apps/site/src/content/consents/*.md`)을 보내고, 서버는 이용약관·개인정보를 AD-15에서 승인돼 시행 중인 버전(`in_force_terms_version`)이 있으면 그것으로 기록. 예전 `complete_signup(p_terms_version)`은 옛 앱용으로 같은 규칙. 문서를 바꾸면 frontmatter version과 `CONSENT_VERSIONS`를 같이 올림
- 마케팅 수신 결과 통지(20261117090000): 마케팅 동의 기록이 생기면(가입 때 ‘받기’, S-14, A-05r) 트리거 `consent_marketing_result`가 알림 센터에 `marketing_result`(“마케팅 정보 받기에 동의했어요”/“…거부했어요” + “{날짜} sweeTwo가 처리했어요”), 앱은 같은 내용을 토스트로

### 모바일 세션

- 흐름: 시스템 로그인 창으로 authorize(redirect_to = `{VITE_WEB_ORIGIN}/auth/callback?from=app&state=…`) → 웹 콜백 페이지가 code와 state만 `sweetwo://auth/callback`으로 넘김 → state 확인 → `grant_type=pkce` 교환
  - iOS: ASWebAuthenticationSession(앱 안 플러그인 `WebAuthPlugin`, `ios/App/App/SceneDelegate.swift`의 `MainViewController`가 붙임). 창이 sweetwo://를 받자마자 닫히며 결과를 줌
  - Android: Custom Tabs(`@capacitor/browser`) + `sweetwo` 스킴 intent-filter(`appUrlOpen`). 창을 그냥 닫으면 1.5초 뒤 취소로
  - 파일: `apps/mobile/src/native/`(`bridge.ts` 브리지 조립, `auth.ts` 로그인·토큰, `pkce.ts`, `lock.ts`, `store.ts` 보안 저장소). 화면 코드(packages/app)는 `window.sweetwo`만 봄(플랫폼 `ios`·`android`, 타입 `AppBridge` in `packages/app/src/platform.ts`)
  - 링크 허용 목록은 `packages/core/src/deep-link.ts`(sweetwo://와 모바일 앱 링크 https://sweetwo.kr/i/*, /n, /n/settings. 홈 화면 위젯 `sweetwo://widget?to=…&w=…`는 정한 화면 모양과 위젯 번호 wg01·wg04만, 2026-11-13)
  - 초대 링크 받기(2026-11-10): 브리지가 링크를 `onInvite`로 넘기고(처음 실행 때 온 것은 구독할 때), 앱은 A-01 판단이 끝난 뒤 구독해 `/i/{코드}`(A-07)로 감. 잠겨 있으면 LockGate가 가려서 풀면 A-07이 보임. 가입·로그인 대기 중이면 돌아갈 화면(returnTo)으로만 기억. 코드가 6자 형식(I, O, 0, 1 없음)이 아니면 서버에 묻지 않고 ‘잘못된 코드’
  - iOS 앱 링크: `ios/App/App/App.entitlements` `com.apple.developer.associated-domains` = `applinks:sweetwo.kr`(빌드 설정 `CODE_SIGN_ENTITLEMENTS`). Android: `AndroidManifest.xml` `autoVerify` intent-filter(/i/, /n, /n/settings)
- refresh token은 Keychain(iOS)·Keystore(Android)에(`@aparajita/capacitor-secure-storage`, 이 기기에만), 30일 슬라이딩. 렌더러(웹뷰)의 supabase-js는 `accessToken` 옵션(api `configureSupabase({ kind: 'bridge' })`)으로 브리지에서 access token만 받음
- 로그인된 기기 이름: 웹뷰 User-Agent에 `sweeTwo`(capacitor.config `appendUserAgent`) → S-15 “휴대폰 앱(iOS)”
- 웹뷰 안 CSP(2026-11-10, `apps/mobile/vite.config.ts` 플러그인 `sweetwo-csp`가 빌드 때 `index.html`에 meta로 넣음. 개발 서버는 Vite HMR 인라인 스크립트 때문에 넣지 않음): `default-src 'self'`, `script-src 'self'`(인라인·eval 금지), `style-src 'self' 'unsafe-inline'`(React style 속성), `img-src 'self' data: blob: {Supabase}`(Storage 서명 주소), `connect-src 'self' {Supabase} {Supabase wss}`(REST, Auth, Realtime), `font-src 'self' data:`, `frame-src 'none'`, `object-src 'none'`, `base-uri 'none'`. Supabase 주소는 빌드 때 `VITE_SUPABASE_URL`에서. Capacitor 브리지는 네이티브가 넣는 스크립트라 막히지 않음. 분석(PostHog)·오류(Sentry)를 붙이면 그 주소를 `connect-src`에 더함. 원격 화면 코드를 내려받지 않음(코드 바꿔 넣기 업데이트 안 씀)
- 안전 영역(2026-11-10): `index.html` viewport `viewport-fit=cover`. 앱 틀(`hg-frame`), AuthLayout, QuestionLayout(`hg-qmain`, 아래 주 버튼 바), LockScreen, BottomSheet, Toast, Drawer가 `env(safe-area-inset-*)`를 더함(디자인 DESIGN.md ‘안전 영역’)
- 앱 링크 확인 파일: sweetwo.kr/.well-known/apple-app-site-association, assetlinks.json(`apps/site/src/pages/.well-known/`, 값은 사이트 빌드 환경 변수 `PUBLIC_APPLE_TEAM_ID`, `PUBLIC_ANDROID_CERT_SHA256`(쉼표로 여러 개), 없으면 빈 목록 = 링크는 웹사이트로 열림). 이 값들은 비밀이 아니라 공개 값(누구나 확인 파일에서 봄). 아직 애플 개발자 계정·플레이 콘솔 앱이 없어 비어 있음 → 넣는 절차는 기획서 출시 준비(`docs/spec/34-launch-prep.md`) ‘앱 링크 값 넣기’ 할 일. 확장자 없는 AASA는 `apps/site/public/_headers`가 `Content-Type: application/json`으로(Cloudflare Workers 정적 자산). 경로는 /i/*와 알림 메일 링크(/n, /n/settings)만. 로그인 복귀는 sweetwo://로만
- 최소 지원 버전: `app_config.min_version_ios`·`min_version_android`(AD-16 승인 시 반영). 미만이면 A-01 ‘지금 업데이트’ → 웹사이트 /download(스토어 안내). 공지는 플랫폼을 고르지 않음(AD-10, ADR 0008)
- 개발: `pnpm --filter @sweetwo/mobile cap:sync` 뒤 Xcode·Android Studio. `.env.development`의 `VITE_WEB_ORIGIN`(스테이징 dev-app.sweetwo.kr, Cloudflare Access 뒤라 로그인 창 브라우저에서 Access를 먼저 통과해야 함)

### 로그아웃(2026-11-10)

- 모든 로그아웃은 `packages/app/src/features/auth/sign-out.ts` `signOut(options)` 하나로: S-11 로그아웃, S-15 모든 기기 로그아웃, S-18b 계정 삭제, A-06 PIN 잊음·5번 틀림, A-08 다른 계정, A-02 계정 삭제 그대로 두기, A-04·A-05 가입 취소, A-03 로그인 상태를 못 읽음, P-01 다른 계정, 이메일 충돌.
  - 서버: 이 기기 푸시 토큰 해제 → 브리지 `auth.signOut`(모바일, 갱신 토큰 폐기·기기 캐시 지움) 또는 supabase-js(웹). 실패해도 아래는 함
  - 이 기기: `resetSessionState()`(쿼리 캐시 `queryClient.clear()`, 가입 중 값, 온보딩·자산 입력 상점, 저금 추가 입력값 `sweetwo.savingDraft`(2026-11-12), 경조사 추가·기록 입력 중 값(Y-07·Y-08), 소셜 사진 확인 1회 표시(`shared/person.tsx`), 계정 값을 담은 기기 저장소 키(`session-reset.ts` `clearAccountStorage`: `sweetwo.exportedAt`, `onboardingSeenAt`, `onboardingStartedAt`, `pushAsked`, `split-notice.*`, `made-notice.*`, 2026-11-12 QA 11구간 S11-08), 메뉴·알림 패널 닫기, 오프라인 띠 시각), 리다이렉트 중 제공자, 돌아갈 화면(returnTo), 브리지 기기 캐시
  - `forgetPin`(PIN 잊음): 브리지 `lock.reset()`으로 이 기기 PIN·생체 인증 지우고 ‘PIN 물어봄’ 표시도 지움 → 로그인 뒤 A-06 설정
  - `accountChange`(다른 계정, 계정 삭제): 위 + ‘최근 사용’ 방법, 마지막 계정 ID
  - `keepReturnTo`(만료): 같은 계정이 다시 로그인하면 하던 화면으로
- 브리지가 스스로 로그아웃하면(갱신 토큰 거절 = 만료, 다른 기기, PIN 5번 틀림) A-01이 `signed_out` 이벤트를 받아 `clearLocalSession()`으로 이 기기 데이터만 비우고 A-08(만료 사유 “로그인이 만료됐어요”)
- 다른 계정이 로그인하면(`routeAfterLogin`이 토큰의 사용자 ID를 이 기기 마지막 계정과 비교) 앞 계정 PIN을 지우고 PIN을 새로 정하게 함
- 계정 데이터를 쥔 새 상점·캐시를 만들면 `shared/session-reset.ts` `onSessionReset`에 지우는 함수를 등록(Vitest `sign-out.test.ts`). 계정 값을 담은 localStorage 키는 화면 파일이 안 불렸어도 지워지게 `session-reset.ts`의 `ACCOUNT_KEYS`·`ACCOUNT_PREFIXES`에 더함(Vitest `session-reset.test.ts`). 기기 설정(‘최근 사용’ 방법, 마지막 계정, PIN 물어봄, 첫 실행, 설치 ID, 초대 기기 표시, 금액 가리기, 닫은 공지, 보기 선택)은 계정과 상관없는 이 기기 값이라 남김

### 잠금

- 2026-11-13(ADR 0009 결정 12): 앱 잠금은 선택. 신규 가입은 O-60 흐름 뒤, 재로그인·새 기기는 로그인 직후 A-06 “앱 잠금을 켤까요?” 한 번(‘나중에 할게요’ 가능). 앱·서버 어디에도 PIN 필수 검사를 두지 않는다. 꺼져 있으면 S-15 맨 위 권장 한 줄

- MVP: PIN 6자리 + 생체 인증(iPhone Face ID·Touch ID, Android 지문). 5회 틀리면 PIN 지우고 로그아웃. 잠금 화면은 앱 전체를 덮어 금액이 보이지 않음. 잠긴 동안(상태를 읽는 동안 포함) 뒤 화면은 `visibility: hidden` + `inert` + `aria-hidden`(LockGate가 화면을 감쌈). 약한 PIN(core `isWeakPin`): 같은 숫자 6개, 오름·내림 연속(9→0 도는 것 포함), 두 개씩 3번(112233), 두 숫자 번갈아(121212). PIN 저장 실패면 처음부터. ‘PIN을 잊었어요’는 확인 Modal 뒤 `signOut({ forgetPin: true })`. 브리지 `lock.reset()`은 PIN 잊음·다른 계정 로그인 때만 앱이 부름(잠금 해제 대신 쓰지 않음). 데스크톱 잠금(Electron main, Touch ID, Windows Hello)은 ADR 0008로 없앰
- 모바일(`apps/mobile/src/native/lock.ts`): PIN은 PBKDF2(SHA-256, 21만 번) 해시로 Keychain·Keystore에, 틀린 횟수도 같이(5회면 PIN 지우고 로그아웃). 생체 인증은 `@aparajita/capacitor-biometric-auth`(iPhone Face ID·Touch ID, Android BiometricPrompt, 문구는 `LockStatus.bioKind`로 “Face ID로 풀기”, “지문으로 풀기”). 자동 잠금은 앱이 뒤로 간 지 N분(S-15, 기본 5분). 최근 앱 화면에는 가림 화면(`@capacitor/privacy-screen`: iOS 흐림, Android 스플래시)

### 모바일 네이티브 v2.2(2026-11-13, PR 13)

웹뷰 화면(packages/app)은 Capacitor를 모르고 브리지(`window.sweetwo`)만 부른다. 네이티브 코드는 `apps/mobile`에만.

- 첫 실행 초대 코드(15 O-01, 18 P-01, 31 2장): 브리지 `inviteCode.firstRun()` → `apps/mobile/src/native/invite-code.ts`, 앱 안 플러그인 `InviteCode`.
  - Android: Google Play 설치 리퍼러(`com.android.installreferrer:installreferrer`, `InviteCodePlugin.java`)의 `invite_{코드}`만. 클립보드는 읽지 않음(31 2장). 웹사이트 L-07(`apps/site/src/components/Invite.astro`)이 Play 링크에 `referrer=invite_{코드}`를 붙이고, 스토어 버튼을 누르면 코드를 클립보드에 복사
  - iOS: 클립보드를 그 호출 때 한 번만 읽음(`SceneDelegate.swift` `InviteCodePlugin`, 글이 있을 때만 읽어 iOS가 ‘붙여넣기 허용’을 물음 = 사용자 동의). 저장·전송하지 않음
  - 코드 모양(6자, I·O·0·1 없음) 확인은 웹뷰(`codeFromReferrer`, `codeFromClipboard`, Vitest). 이 기기에서 한 번만은 앱 `prefs.inviteAutofillChecked`
- 알림 허용(O-55, P-11, S-14, H-06 띠 10번): 브리지 `push.status()`·`request()`·`token()`·`openSettings()`(`push.ts`, 바뀐 것 없음)
- 홈 화면 위젯(26 ‘위젯 v2.2’): WG-01 같이 모으기(소·중), WG-04 다가오는 날(소).
  - 데이터 흐름: 홈(H-01)이 값을 받을 때마다 home `widget-sync.ts`(`widgetSave`·`widgetNext`, Vitest)가 보여 줄 글(이름, “62%”·“모으는 중”, 막대 %, “2027년 5월까지”, 달성 배지 글, 날짜, 누르면 갈 경로)을 만들어 브리지 `widget.update()` → `native/widget.ts`가 길이·경로를 확인해 앱 안 플러그인 `HomeWidget`(`write`·`setLock`·`clear`)으로 기기 공유 저장소에 둠. 위젯은 서버를 부르지 않음(Edge Function `widget-feed` 없음, 토큰·세션을 위젯 저장소에 두지 않음). 금액은 넘기지 않음(S-22 ‘위젯에 금액 보이기’ 화면이 생기면 그때 더함)
  - 저장소: iOS App Group `group.kr.sweetwo.app` UserDefaults(키 `data`, `lockAt`), Android 앱 전용 SharedPreferences `sweetwo_widget`(백업 제외 `xml/backup_rules.xml`, `data_extraction_rules.xml`). 로그아웃(브리지 `signOut`)이면 지움 → “sweeTwo를 열어 로그인해 주세요”
  - 잠금: `lock.ts`가 잠글 때 `lockAt` = 지금, 앱이 뒤로 가면 `lockAt` = 지금 + 자동 잠금 분(PIN이 있을 때만), 풀리면 지움. 위젯은 그 시각부터 값 없이 “잠겨 있어요” + “앱 열기”(iOS는 그 시각에 타임라인 항목, Android는 `WidgetLockReceiver` 알람)
  - 갱신: 앱이 값을 쓰면 바로(iOS `WidgetCenter.reloadAllTimelines`, Android `WidgetStore.refreshAll`), 그 밖에 30분마다와 KST 자정(D-n). 마지막 저장이 30분보다 오래면 오른쪽 아래 “오전 10:30 기준”
  - 누르면 `sweetwo://widget?to={경로}&w={wg01|wg04}` → core `deep-link.ts`가 정한 화면 모양(홈, W-10, W-14 저금·묶음, Y-01, Y-05)만 `open`으로 → 브리지 `onNavigate(path, from)`(from = 위젯과 앱이 켜져 있었는지, 앱이 `widget_tapped`를 보냄. `w` 없는 옛 링크도 받음, 2026-11-13 PR 14)
  - 분석 `widget_added`(2026-11-13 PR 14): 홈이 준비되면 실행마다 한 번 브리지 `widget.installed()`(플러그인 `HomeWidget.installed`: iOS `WidgetCenter.getCurrentConfigurations`, Android `AppWidgetManager.getAppWidgetIds` + 최소 너비 200dp 이상이면 medium) → 종류·크기만, 이 기기에서 처음 본 것만(localStorage `sw.widgets.seen`)
  - Android: `SaveTogetherWidget.java`·`UpcomingWidget.java`(RemoteViews, Java. Glance(Kotlin·Compose)는 빌드 설정이 커서 쓰지 않음), `res/layout/widget_*.xml`, `res/xml/widget_*_info.xml`, 문구 `res/values/widget_strings.xml`, 색 `res/values(-night)/widget_colors.xml`(tokens.css 값 그대로 옮김, 바꾸면 같이)
  - iOS: 위젯 확장 `ios/App/SweetwoWidget/`(`SweetwoWidget.swift` SwiftUI WidgetKit, `Info.plist`, `SweetwoWidget.entitlements`, Phosphor lock·eye-slash `Assets.xcassets`). 이 저장소에서 Xcode 타깃은 만들지 않음 → 아래 순서로 사람이 한 번 만듦
  - 글꼴은 기기 기본 글꼴(SUIT를 위젯에 넣지 않음) [확인 필요]
- 보상형 광고(23 F-08 ‘새로 확인하기’만): 브리지 `ads.rewarded()` → `native/ads.ts`(`@capacitor-community/admob` 8.2.1). 요청마다 `npa: true`(비맞춤형), ATT·UMP 동의 창은 띄우지 않음(`requestTrackingAuthorization`을 부르지 않고 Info.plist에 `NSUserTrackingUsageDescription` 없음). 보상 받고 닫으면 'rewarded', 보상 전 닫으면 'closed', 못 불러오거나 못 띄우면 'failed'
  - 광고 단위 ID: 개발 빌드(`import.meta.env.DEV`)는 Google 테스트 단위, 운영은 `VITE_ADMOB_REWARDED_IOS`·`VITE_ADMOB_REWARDED_ANDROID`(공개 값) [확인 필요]. 없으면 'failed'(광고 없이 바로 결과)
  - 앱 ID: Android `app/build.gradle` `manifestPlaceholders.admobAppId`(gradle 속성 `ADMOB_APP_ID_ANDROID`, 없으면 Google 테스트 앱 ID), iOS `Info.plist` `GADApplicationIdentifier`(지금 테스트 앱 ID) [확인 필요]
  - 금융 카테고리 차단은 AdMob 콘솔(차단 관리 › 민감한 카테고리·일반 카테고리)에서 사람이. 광고는 네이티브 화면이라 웹뷰 CSP에 출처를 더하지 않음
- iOS Xcode 순서(사람, 한 번. 이 저장소 CI는 iOS를 빌드하지 않음):
  1. Apple Developer › Identifiers › App Groups에 `group.kr.sweetwo.app`을 만들고, App ID `kr.sweetwo.app`과 새 `kr.sweetwo.app.widget`에 App Groups를 켜 이 그룹을 고름
  2. `pnpm --filter @sweetwo/mobile cap:sync` → `cap:ios`로 Xcode를 엶(AdMob 패키지를 SPM이 받음)
  3. App 타깃 › Signing & Capabilities › + App Groups › `group.kr.sweetwo.app`(이미 `App.entitlements`에 있음, 체크만)
  4. File › New › Target › Widget Extension, 이름 `SweetwoWidget`, Include Configuration App Intent·Live Activity 끔, 번들 ID `kr.sweetwo.app.widget`, Embed in `App`. Xcode가 만든 swift·Info.plist·Assets는 지우고 `ios/App/SweetwoWidget/`의 파일(`SweetwoWidget.swift`, `Info.plist`, `Assets.xcassets`, `SweetwoWidget.entitlements`)을 타깃에 넣음
  5. 위젯 타깃 › Build Settings: `CODE_SIGN_ENTITLEMENTS = SweetwoWidget/SweetwoWidget.entitlements`, `INFOPLIST_FILE = SweetwoWidget/Info.plist`, iOS Deployment Target 15.0(앱과 같게), Signing & Capabilities에 App Groups `group.kr.sweetwo.app`
  6. 빌드해 기기에서 위젯 두 개(소·중, 소)를 더하고 34 ‘기기 수동 점검’을 확인한 뒤 `project.pbxproj` 바뀐 것을 커밋


예약 작업은 pg\_cron(UTC)이 부름. DB 안에서 끝나는 작업(알림 만들기, 보관 기간 정리)은 SQL 함수를 바로 부르고, 바깥 서비스(메일 SES, 특일 API)가 필요한 작업만 Edge Function. 시각은 초안.

### 예약 작업

> 재기획(ADR 0003) 반영(마이그레이션 20261031090000). 모두 pg\_cron이 SQL 함수를 부름(pg\_cron이 없는 로컬·CI에서는 예약만 건너뜀). 옛 월 계획 만들기, 생활비 체크 예약은 없앰.

| 작업(cron 이름) | KST | cron(UTC) | 함수 |
| --- | --- | --- | --- |
| 기준일 체크리스트(`cycle-checklists`): 지금 관리 방식의 월급 계획마다(각자 = 주인 것, 합쳐서 = 공동 것) 이번 사이클 체크리스트, 지난 사이클은 닫고 체크 안 한 줄은 ‘못 함’ | 매일 00:00 | `0 15 * * *` | `run_cycle_checklists()` → `make_checklist(공간, 주인)` |
| 오전 알림(`send-morning-notifications`): 경조사 D-30·D-14·D-7·당일(두 사람), 월급날(그날 시작한 체크리스트 주인, 합쳐서 = 둘 다), 만기 D-60(명의자, 자산만), 만기일 당일 만기된 돈 정리(→ F-04a), 전세 계약 만기 6개월 전(둘 다), 연말정산 준비(1월 둘째 주 월요일, 결혼한 두 사람 모두 → 가이드 체크리스트 `year-end-tax`), 초대 코드 만료 3일·1일 전과 만료 다음 날(합류 전 공간, 가장 최근 코드) | 매일 09:00 | `0 0 * * *` | `send_morning_notifications()` |
| 저녁 알림(`send-evening-notifications`): 월급 전 확인(사이클 끝 2일 전 = 다음 기준일 3일 전, 체크 안 한 줄이 있는 체크리스트 주인) | 매일 20:00 | `0 11 * * *` | `send_evening_notifications()` |
| 연결 해제 확정(`unlink-deadlines`, 요청 + 14일) | 매일 09:00 | `0 0 * * *` | `run_unlink_deadlines()` |
| 보관 기간 정리: 알림 90일, 해제한 원래 공간 30일, 삭제 계정 30일, 휴지통 30일 | 매일 04:00~04:45 | `0 19 * * *`부터 15분 간격 | `purge_notifications()`, `purge_unlinked_spaces()`, `purge_deleted_accounts()`, `purge_old_trash()` |
| 앱 기기 기록 정리(`purge-app-devices`): 180일 안 켠 기기 | 매일 04:55 | `55 19 * * *` | `purge_app_devices()` |
| 어드민 잠금, 열람 기간 끝 | 매일 04:50, 매시 5분 | `50 19 * * *`, `5 * * * *` | `lock_idle_admins()`, `run_access_expiry()` |
| 파트너 변경 묶어 보내기(`flush-partner-changes`) | 매분 | `* * * * *` | `flush_partner_changes()` |
| 파트너 변경 주간 요약(`send-weekly-summary`) | 월 09:00 | `0 0 * * 1` | `send_weekly_summary()` |
| 공지 메일(`send-notice-mails`) | 5분마다 | `*/5 * * * *` | `send_notice_mails()` |
| 메일 깨우기(`kick-mail`): 보낼 메일이 있으면 pg_net으로 `send-mail` | 매분 | `* * * * *` | `kick_mail()` |
| 공휴일 받기(`kick-holidays`): pg_net으로 Edge Function `fetch-holidays` → 특일 정보 API 올해·다음 해 → `save_api_holidays`(어드민 날은 안 덮음, 빠진 API 날은 지움) | 월 03:00 | `0 18 * * 0` | `kick_holidays()` |

- 2026-11-13 v2.2에서 더하는 작업(ADR 0009, 시각 초안): 월급 변경 적용 `apply_salary_changes()` 매일 00:01 KST(기준일 체크리스트보다 먼저, 순서 고정), 자동 확인 `auto_confirm_due_lines()` 매일 00:05 KST(`auto_due` = 오늘인 대기 자동 줄 → 체크, 날짜 없는 사람의 자동 저금은 `goal_move(in, reason_code auto)`), 진행 소식 `send_progress_news()` 09:00(월급날, 날짜 없음은 매달 1일, 손 줄 0개 + `push_kinds.progress_news`), 대신 입력 정리(초대 만료 + 30일, 7일 전 알림). 오전 알림의 월급날과 저녁 알림의 월급 전 확인은 손 줄이 1개 이상일 때만, `payday_none`은 없음. 기준일 체크리스트는 ‘못 함’으로 닫되 다음 사이클 끝까지 늦은 확인을 받음
- (다음 단계) 재시도: 함수 안에서 space 단위로 3회 지수 백오프. 끝내 실패하면 job\_run에 남기고 알림(‘운영 절차’)
- space마다 `pg_try_advisory_xact_lock`으로 중복 실행 막음. 작업은 멱등하게(두 번 돌아도 결과 같음)
- (다음 단계) job\_run: 작업, 시작, 끝, 처리한 space 수, 실패 목록
- 다시 실행: `select public.run_cycle_checklists('YYYY-MM-DD')`, `select public.send_morning_notifications('YYYY-MM-DD')`(체크리스트는 사이클마다 하나, 같은 알림은 `dedupe` 키로 한 번만이라 다시 돌려도 됨). 한 공간이 실패해도 다른 공간은 계속(경고만 남김)

### 알림

- 테이블 `notification`(받는 사람, 종류, 문구, OS 알림 문구·숨김, 갈 화면, 아이콘, 한 사람, dedupe, 읽음). 앱은 내 것만 읽고 `mark_notifications_read`로 읽음만. 쓰기는 서버(트리거·예약 작업)만
- 바로 만드는 알림: 파트너 합류(`couple_space` not_joined → connected 트리거), 첫 월급 계획(`notify_first_goal`), 관리 방식(`set_salary_mode`), 목표 금액 달성(`achieve_goal`, 볼 수 있는 사람), 연결 해제·다시 연결. `check_pay_line`: 각자 체크리스트는 주인만 체크(2026-11-03 대신 체크 없앰, `behalf_checked` 알림도 없앰), 각자 체크리스트를 주인이 다 하면 → 상대(`partner_done`, 인앱만, `/salary?who=주인` = W-02 그 사람 탭)
- 파트너 변경(20261031120000): 바로 알리지 않고 `partner_change`(고친 사람, 받는 사람, 항목, 전 → 후 문구 값, 바로/주간)에 쌓음. 기록은 `log_partner_change`(연결·해제 대기, 고친 사람 = auth.uid(), 같은 값이면 안 남김). 쌓는 곳: 우리 목표 트리거(금액·기한·삭제 = 바로, 이름·순서·형태·보류·추가·되살리기 = 주간), 목표 넣기·빼기·꺼내 쓰기(`goal_move`, 되돌리기 = 빈 값), 자산 트리거(주간, 비공개 개인 항목 빼고, 합계만 보여 주는 개인 항목은 “개인 자산 금액이 바뀌었어요”), 경조사 추가·메모(주간), 월급 금액(바로), `save_split`(줄마다 전·후 비교 `log_split_changes`, 처음 만들 때는 빼고), `set_joint_cycle_day`(주간). 내 목표는 남기지 않음
- 묶어 보내기 `flush_partner_changes()`(pg_cron `flush-partner-changes` 매분): (고친 사람, 받는 사람)마다 첫 변경부터 10분 지난 묶음을 같은 항목끼리 처음 전 값 → 마지막 후 값으로 합치고 같으면(되돌리기) 버림. 바로 알림은 `partner_change` 하나(여럿이면 “{이름}님이 n가지를 바꿨어요”), 주간은 `partner_activity`(silent) 하나. 월요일 09:00 `send_weekly_summary()`(`send-weekly-summary`): 지난 7일 합친 변경 수 “이번 주 {이름}님이 바꾼 게 n개 있어요” → `/notifications`. 같은 내용을 주간 요약 메일로도 쌓음(`enqueue_mail`, 20261101120000). 다른 묶음 메일·보안·문의 메일은 다음 단계
- 알림 묶음 `notification.topic`(생성 열, S-14 토글과 맞춤): plan(월급날, 월급 전 확인, 첫 월급 계획), partner_change(파트너 변경 묶음, 관리 방식, 주간 요약), silent에는 파트너 활동 기록(`partner_activity`)도, money(만기, 만기된 돈 정리, 전세 만기, 연말정산), goal(달성), invite(합류, 초대 리마인드·만료), care_n(경조사), silent(인앱만, core `pushAllowed`가 늘 false: 파트너 체크 다 함, 활동 기록), 그 밖 other(끌 수 없음). 앱 아이콘은 `features/notifications/view.tsx` ICON(Phosphor 이름 → 디자인 시스템 아이콘, 없으면 종)
- 경조사 날짜는 서버도 앱과 같게: 음력은 `lunar_date` 표(2025~2050년, korean-lunar-calendar로 만든 행, 윤달 행이 없으면 평달), `care_date_in_year`·`care_next_date`. 월급날 앞당기기는 `business_day_on_or_before`(holiday 표)
- 문구는 기획서 14 표 그대로, 조사는 `ko_subj`·`ko_obj`·`ko_is`, 금액은 `read_won`(core readWon과 같음). 사람 이름은 호칭, 없으면 `coalesce(nullif(호칭, '') || '님이', '파트너가')`(‘님이 …’ 금지, `partner_change_title`·묶음·주간 요약·열람 알림까지, 2026-11-12 S10-01, pgTAP `partner_noti_copy`). 목표 금액 달성은 주인이 ‘금액만 보여 주기’로 둔 저금이면 파트너에게 이름 없이 “개인 저금 목표 금액을 다 모았어요!” + W-02(`achieve_goal`, 2026-11-12 D1). 서프라이즈는 만든 사람에게만 + OS 알림 제목 “경조사 알림이 있어요”, 본문 숨김(`push_hidden`)
- 앱: 종 점(`fetchHasUnread`), 넓은 창 N-01 패널(ui `NotificationPanel` 시트), 좁은 창 N-02 `/notifications`, 묶음·시간은 core `notiGroup`·`notiTime`, 금액 가리기는 `maskMoney`. 누르면 읽음 + 그 화면. Realtime으로 새 알림을 받아 목록·점을 고치고, 종류별로 같이 다시 읽을 캐시는 `notifications/noti-keys.ts` `notiKeys`(합류·해제·첫 월급 계획·체크·월급 계획 바뀜 → 우리 둘 상태·파트너·나·월급 계획·체크리스트·저금, 2026-11-11 QA 4구간 S4-02, Vitest). 종 이름은 점이 있으면 “알림, 새 알림 있음”. 알림을 눌러 옮길 때 `state.from = 'notification'`(분석 entry) + 분석 `notification_opened`(화면 ID는 `notifications/landing.ts` `landingScreen`, Vitest). 2026-11-12 QA 10구간: 서버 응답은 core `NotiRow`(Zod)로 검사(이상한 행은 버림, S10-13), 더 불러오기는 (`created_at`, `id`) 커서 + id 정렬(같은 시각 알림이 빠지지 않게), 읽음은 `markRead`가 목록 캐시에 바로 표시하고 오프라인·실패면 모아 두었다가 `online`에 보냄(S10-14). OS 알림은 모바일 푸시만(아래, 데스크톱 OS 알림은 ADR 0008로 없앰)
- 메일(20261101120000): DB가 `mail_outbox`에 쌓고(`enqueue_mail(사람, 종류, 묶음, 제목, 글, HTML, 상한에 셈, dedupe)`: 받는 방법 이메일·그 묶음 이메일이 켜져 있고 월 6회 상한 안일 때만) → 1분마다 `kick_mail()`이 보낼 메일이 있으면 pg_net으로 Edge Function `send-mail` 호출 → 함수가 `claim_mail`로 꺼내 SES API v2 SendEmail(서명 v4는 `_shared/sigv4.ts`, AWS 서명 시험 get-vanilla로 확인)로 보내고 `finish_mail`(실패는 3번까지 다시). 지금 보내는 메일은 파트너 변경 주간 요약(상한 밖, 본문 `weekly_mail_body`: 바뀐 것 전 → 후 최대 20줄, 이번 달 월급 “n개 중 m개 완료” [확인 필요](2026-11-03 20261110100000), 남은 할 일(월급 전 확인), 앱에서 보기 `https://sweetwo.kr/n`, 알림 설정 `https://sweetwo.kr/n/settings`)
- 알림 메일 링크: 웹사이트 `/n`, `/n/settings`가 `sweetwo://n`, `sweetwo://n/settings`로 앱을 열고(core `deep-link.ts` 허용 목록, 알림 센터·S-14만), 앱이 없으면 “sweeTwo 앱에서 열어 주세요” + ‘앱 받기’(→ /download)
- 함수 드라이버 `MAIL_DRIVER`: `ses`면 보냄, 그 밖(기본)은 보내지 않고 보낸 것으로만 표시(로컬·스테이징에서 실수로 보내지 않게). 시험은 `deno test --no-config --no-lock supabase/functions/`(CI check)
- 이메일 문의 받기(20261111180000): help@sweetwo.kr(네이버웍스)이 받은 메일을 `inbound@in.sweetwo.kr`로 자동 전달 → Cloudflare Email Routing(하위 도메인 in.sweetwo.kr만, sweetwo.kr MX는 네이버웍스 그대로) 규칙 → Email Worker `apps/mail-worker`(`email()`: `rawSize` 1MB 넘으면 `setReject`, 원본 MIME을 `INBOUND_URL`로 POST, 머리글 `x-inbound-secret` = Worker 비밀 값 `INBOUND_MAIL_SECRET`, `content-type: message/rfc822`. 함수가 4xx면 `setReject`, 5xx·네트워크 오류면 throw. Cloudflare 문서에 throw 뒤 다시 보내는지는 적혀 있지 않음, 원본은 네이버웍스 받은편지함에 남음) → Edge Function `inbound-mail`(`x-inbound-secret`을 함수 비밀 값 `INBOUND_MAIL_SECRET`과 같은 시간 비교, 1MB 넘으면 413). 함수는 스팸 표시(`X-Spam-Flag: YES`), 인증 실패(`Authentication-Results`·`ARC-Authentication-Results`에 `dmarc=fail`이 있고 `dkim=pass`·`dmarc=pass`가 하나도 없을 때. 전달하면 SPF는 깨지므로 SPF 실패만으로는 버리지 않음), `X-Sweetwo-Copy`(앱 문의 사본), 자동 응답(`Auto-Submitted`, `Precedence: bulk` 등), 반송 알림(MAILER-DAEMON, `multipart/report`)을 버림(200). MIME에서 From 주소, Subject, Message-ID, In-Reply-To·References, text/plain 본문(없으면 HTML을 글자로, quoted-printable·base64, charset은 TextDecoder)만 꺼내고 이전 대화(`>` 인용, ‘…님이 작성:’, ‘-----Original Message-----’ 아래)는 best-effort로 뺌. 본문 4,000자, 첨부는 받지 않고 개수만. 본문·주소는 로그에 남기지 않음 → `ingest_inquiry_mail`(service_role만): sweetwo.kr 주소에서 온 메일은 무시, 같은 Message-ID는 한 번만, 같은 대화(In-Reply-To·References가 이 문의에서 받은 메일 ID나 보낸 답장의 SES MessageId와 같음, 또는 제목에 `[A-10001]`, 둘 다 보낸 주소가 같을 때만)면 덧붙이고 완료 7일 안이면 다시 열림(7일 넘으면 새 문의), 아니면 새 문의(분류 기타, 회원 연결은 auth.users 이메일 정확히 일치 1명일 때만). 같은 주소 하루 새 문의 10건 넘으면 무시. 받은·보낸 메일 ID는 `inquiry_mail`. 비용: Email Routing 받기 무료, Workers 무료 요금제 안
- 이메일 문의 답변: `admin_answer_inquiry`가 이메일 문의면 `mail_outbox`에 답장(보내는 주소 `from_email` = `sweeTwo <help@sweetwo.kr>`, `headers` = In-Reply-To·References(가장 최근 받은 메일 기준, 최근 10개), 제목 “Re: 원래 제목 [A-10001]”, 본문은 관리자가 쓴 그대로)을 쌓고 `send-mail`이 SES Simple 메일 `Headers`로 보냄. 앱 알림은 보내지 않음. 앱 문의는 그대로 앱 알림. AWS 계정이 아직 없어 `MAIL_DRIVER`가 `ses`가 아니면 답장은 대화에만 남고 메일은 나가지 않음(보낸 것으로 꾸미지 않음, log 드라이버 그대로). 그래서 AD-06 이메일 문의에는 늘 안내 띠 “답장 메일은 메일 발송을 연결한 뒤부터 자동으로 가요. 그 전에는 네이버웍스 help@에서 직접 답장해 주세요” [확인 필요]. 앱 문의 사본(help@)도 SES 연결 뒤부터 나감
- 앱 문의 사본(20261111180000): 앱 문의의 사용자 메시지가 쌓이면 트리거 `inquiry_copy_mail`이 help@sweetwo.kr로 사본(`kind` = `inquiry_copy`, 제목 “[A-10001] 앱 문의 사본”·“앱 문의 덧붙임” [확인 필요], 머리글 `X-Sweetwo-Copy: A-10001`, 보내는 주소 `MAIL_FROM`)을 쌓고 `inquiry.mail_copied_at`. 전달돼 돌아와도 위 규칙으로 무시
- 반송·수신 거부(20261103180000): SES 구성 세트(`SES_CONFIGURATION_SET`) 이벤트 Bounce·Complaint → SNS 주제 → Edge Function `mail-events`(HTTPS 구독, 주소 `?token=` = `MAIL_EVENTS_SECRET`, `TopicArn` = `MAIL_EVENTS_TOPIC_ARN`, 구독 확인은 sns.*.amazonaws.com 주소만 엶). 영구 반송·신고만 `note_mail_event` → `mail_suppress`(주소마다 반송 수, 신고). 2번 반송이거나 신고면 `mail_outbox`에 넣지 않음(트리거). 반송마다 그 주소를 쓰는 사람에게 인앱 알림 `mail_bounced`(메일로 다시 보내지 않음, 누르면 S-11b `/settings/me/email`, 2026-11-12 S10-06) + 홈 띠(`my_mail_bounced()`, 주소를 바꾸면 사라짐)
- 아직: 핵심 알림 메일(연결 해제 등)과 ‘푸시를 받을 수 없는 사람’ 판단, 방해 금지 끝나는 시각에 다시 보내기, 묶음 알림의 바뀐 것 목록 화면. 모바일 앱 링크는 코드(앱 구독, 확인 파일, associated-domains, intent-filter)가 있고 Apple Team ID·Play 서명 SHA-256 값만 남음(34 출시 준비)
- 모바일 푸시는 서버(20261104120000): 기기 토큰은 `push_device`(앱이 `register_push_device`로 등록, 로그아웃 때 `unregister_push_device`, 같은 토큰은 마지막 등록한 사람 것). `kick_push()`(pg_cron `kick-push` 1분마다, 보낼 것이 있을 때만 pg_net, Vault `push_function_url`·`push_cron_secret`) → Edge Function `send-push`가 `claim_push`(만든 지 `noti_send_window` 안 = 12시간, 방해 금지가 그보다 길면 방해 금지 길이 + 1시간(2026-11-12 QA 10구간 S10-04, 19~9시 같은 긴 방해 금지도 끝나면 나감, 대신 메일 `mail_missed_notifications`도 같음), `push_wanted` = S-14 받는 방법·묶음, 인앱만(silent) 빼고, 방해 금지는 끝날 때까지 미룸, 보안·계정은 바로, 꺼낼 때 `notification.pushed_at`) → iOS APNs HTTP/2(.p8 토큰, `_shared/push.ts`), Android FCM HTTP v1(서비스 계정 OAuth) → 410·UNREGISTERED 토큰은 `drop_push_tokens`. `PUSH_DRIVER`=`send`일 때만 보냄(그 밖은 로그만). 서프라이즈는 `push_title`과 본문 숨김 그대로
- 사진(20261105090000): 저장소 `photos` 버킷(비공개, JPEG, 3MB). 경로는 무작위 `g/{uuid}.jpg`(목표, 정사각 512px)·`r/{uuid}.jpg`(경조사 기록, 긴 변 1600px). 앱이 줄이고 다시 그려 올린 뒤(`packages/app/src/shared/photo.ts`, EXIF 위치 정보 없음) `set_goal_photo`·`add_care_photo`로 붙임(내가 올린 파일만). 읽기는 `photo` 행을 볼 수 있을 때만(목표 공개 범위, 비밀 경조사 그대로), 보여 줄 때 1시간 서명 주소. 지우기: `photo` 행이 지워지면(목표·기록·우리 둘 공간과 함께) `storage_purge`에 쌓고, 계정 삭제 요청 때 프로필 사진도 쌓음 → `kick_purge()`(pg_cron `kick-purge` 10분마다, 지울 것이 있을 때만, Vault `purge_function_url`·`purge_cron_secret`) → Edge Function `purge-storage`가 Storage API로 지움(하루 넘게 붙지 않은 파일 포함)
- 소셜 프로필 사진(20261110160000, 2026-11-05 지정 아바타 없앰): 앱이 우리 둘 공간이 생긴 뒤 `avatar_path`·`avatar_social_checked_at`이 비어 있으면 한 번만 Edge Function `social-avatar`(앱 사용자 JWT)를 부름. 함수는 `/auth/v1/user`의 identities `identity_data`(사용자가 고칠 수 있는 user_metadata가 아님)에서 카카오·구글 사진 주소를 꺼내 `*.googleusercontent.com`·`*.kakaocdn.net`(https)에서만 받고(그림만, 5MB 이하, 카카오 기본 프로필은 없음으로) 그대로 돌려줌. 앱이 `squarePhoto`로 가운데 정사각 512px JPEG로 다시 그려(EXIF 없음) `uploadAvatar`로 저장한 뒤 `mark_social_avatar_checked()`. 함수가 204(사진 없음)여도 남김, 함수 호출 자체가 실패하면 다음에 다시. 서버는 주소와 그림을 남기지 않음. `avatar_preset` 열과 `set_avatar_preset`·`space_people_art` 함수는 2단계로 지움(20261110170000)
  - 앱: 브리지 `push`(`apps/mobile/src/native/push.ts`, `@capacitor/push-notifications`). 로그인한 뒤 허용돼 있으면 토큰 등록(`usePushRegistration`), 허용 묻기는 합류 직후 1회(P-11)와 S-14 ‘푸시 알림’ 켤 때. 앱이 화면에 떠 있으면 OS 알림 없이(capacitor.config `presentationOptions: []`) 앱 안 토스트, 누르면 그 알림 읽음 + 그 화면
- 메일로 대신: 모바일 푸시 기기가 없고 앱 접속 신호(`touch_app`)도 최근 10분간 없을 때(`mail_missed_notifications`가 `push_device`를 봄)
- 앱 안 알림센터에는 항상 기록
- 상한은 메일만 계정마다 월 6회. 푸시(모바일 푸시)와 알림센터는 상한 없음. 주간 요약 메일과 푸시를 받을 수 없는 사람의 핵심 알림 메일은 상한 밖
- 마케팅 메일은 월 1회, 수신 동의한 사람만
- 방해 금지 22\~08시(KST): 끝나는 08시에 보냄. 상한 밖(`noti_always_mail`: 보안·계정) 종류는 방해 금지 없이 바로
- 상한이나 방해 금지에 걸려 못 보낸 것은 알림센터에만
- 깜짝 선물 등 비밀 항목은 알림 본문을 가림
- 메일 본문은 DB 함수가 만듦(`weekly_mail_body`). 모든 메일 맨 아래 알림 설정 링크(수신 거부, 필수 안내 메일 제외)
- 반송과 수신 거부 신고는 SNS → Edge Function이 받아 발송 중단 + 앱 배너 “이메일을 확인해 주세요”

## 디자인 시스템 쓰는 법

화면은 디자인 시스템 sweeTwo의 토큰과 컴포넌트로만 만들고, 색과 간격을 값으로 직접 쓰지 않음. 디자인 시스템 README가 규칙의 기준.

### 가져오는 법

- packages/ui에 tokens.css와 컴포넌트 CSS(components/bundle.css)를 그대로 두고, 컴포넌트마다 React 래퍼를 만듦 (예: `<Button variant="primary">` → `hg-btn hg-btn--primary`)
- 원본은 저장소 `docs/design/tokens.css`, `docs/design/bundle.css`. 바꾸면 `pnpm ds:sync`로 packages/ui에 다시 복사. 화면 코드에서 클래스 이름을 바꾸지 않음
- 색은 `var(--surface)`, `var(--ink)`처럼 토큰만. hex 값이 코드에 보이면 리뷰에서 되돌림
- 다크 모드는 기기 설정을 따름. 토큰이 바꾸므로 화면에서 따로 처리하지 않음

### 지킬 것

- 브랜드 색(오렌지)은 2026-11-09부터 사용자 앱의 하나뿐인 포인트 색(당근처럼): 주 버튼, 홈 ‘월급 계획’ 포인트 상자 채움(`hg-hubtile--point`, 2026-11-11 사용자 결정, 글자는 `on-accent-app-text`. 홈 할 일·초대 띠는 2026-11-11부터 코코아 `band-cocoa`. + 버튼 FAB는 없앰), 체크한 원과 고른 표시, 저금 진행 원·막대, 짧은 강조 숫자, 띠와 안 읽은 알림의 옅은 판(띠 아이콘, 띠 안 흰 작은 버튼 글자), 새 알림 점, 워드마크, 온보딩 챕터 막대. 화면 규칙은 `accent-app` 계열 토큰으로(어드민은 `hg-admin`이 예전 색으로 되돌림). 글자 버튼은 모두 회색(`hg-btn--link` 기본 `ink-2` 600, 2026-11-09 `hg-btn--accent` 없앰). 대비 예외와 axe 예외는 DESIGN.md ‘색’과 CLAUDE.md. 카드 바탕에 쓰지 않음. 보조 버튼의 옅은 오렌지(`brand-soft`)는 카드 안에만(목표 ‘매달’·‘매년’ 배지도 `brand-soft` + `brand-ink`, 2026-11-04)
- 아이콘은 Phosphor(굵은 선). 켜진 메뉴와 독 칸만 채운 모양
- 금액과 날짜 표기는 core의 포맷 함수 하나로만 (디자인 시스템 ‘금액 표기’, ‘날짜·시간 표기’ 장)

### 그림과 장면 자리

- 목표 사진 21장(2026-11-04 실사, `assets/goal-photos/{템플릿}-01.webp`, 정사각 512px), 빈 상태 그림 1장: Illustrations 묶음, 배경을 지운 512px. 앱에는 webp(투명, 품질 90)로 넣음(`packages/ui/src/assets/illustrations`). 디자인 시스템 원본은 PNG. 모두 같은 무광 3D 그림체(심볼은 평면 오렌지 바탕 흰 ‘Two’라 그림체가 다름). `object-fit: contain`
- 앱 아이콘(2026-11-06 오렌지 바탕 흰 워드마크 ‘Two’로 교체): `python3 scripts/brand-icons/two.py`가 워드마크 벡터(logo-cherry.svg 뒤 세 글자)에서 app-icon.png, apple-touch-icon.png, favicon-32/48.png, iOS AppIcon, Android 런처(적응형 전경 48% + 바탕 #FF7716, 예전 방식 정사각·원형), 사이트·모바일 파비콘을 다시 만듦(node + playwright로 흰 Two 원본 two-master.png를 그림, `--render`면 다시). symbol.png·symbol.svg, 사이트 공유 이미지 og.png도 같이 만듦. 카카오·구글 로그인 콘솔 앱 아이콘은 손으로 바꿈. 예전 파이 차트 생성기(build.py, Blender)는 지움
- 장면 그림 5장과 장면 영상 5개는 없앰(2026-10-19). 그중 W-04 끝, H-T1은 재기획으로 화면도 없앰. P-11 `scene-clap`, P-01 `scene-invite`는 2026-11-05 새 3D 그림, A-02는 영어 워드마크
- 그림은 앱에 포함해 배포(네트워크 없이도 보이게). 모바일 앱 묶음 안에

### 자산 파일 규칙

- 파일 이름: `<종류>-<이름>.webp` (예: `goal-04-home.webp`)
- 크기 상한: 그림 150KB. `pnpm check:assets`(scripts/check-assets.mjs), CI가 넘으면 멈춤
- 그림은 `<Illustration name>`, 빈 상태는 `<EmptyState>`로만 씀. 파일을 직접 import하지 않음
- 장면 자리는 `<SceneMedia>` 컴포넌트 하나로만: 그림이 없는 화면은 영역만 잡아 비워 둠. 그림이 있는 P-01·P-11은 `Illustration`(`scene-invite`, `scene-clap`)을 QuestionLayout `hero`에(2026-11-05). 그림 파일: `packages/ui/src/assets/illustrations`(3D 이모지), `goal-photos`(목표 사진)(작은 3D 아이콘 `icons3d`·`icon3d`는 2026-11-09 지움). 줄 앞 칸(Lead)은 그림이 아니라 `packages/ui/src/components/lead-kinds.ts`의 종류 표(`leadOf(묶음, 종류)`, 2026-11-10부터 회색 빈 원 `hg-lead--slot` + `data-art` 그림 이름, 그림이 들어오면 `art`로 채움)로만 그리고, 목표 금액이 있는 저금 줄은 `Lead progress`(core `savingBar`)

### 디자인 시스템 갱신 절차

1. `docs/design/`(tokens.css, bundle.css, 컴포넌트 md)를 고친 뒤 `pnpm ds:sync`가 packages/ui로 복사하고 파일 머리에 커밋 번호를 주석으로 남김
2. `pnpm --filter @sweetwo/mobile e2e`로 컴포넌트 모음(/dev/ui)을 라이트, 다크, 좁은 창에서 돌리고 스크린샷(test-results)으로 바뀐 곳 확인
3. 담당자(디자인 시스템 오너) 승인 후 합침

## 개발 규칙

모든 변경은 PR로 들어가고, 타입 검사와 테스트를 통과해야 합쳐짐.

### 폴더와 파일 구조

화면 코드는 기능(feature) 단위로 묶고, 한 기능의 화면, 쿼리, 문구는 같은 폴더에 둠. 기획서 화면 ID(A-02, P-11 등)가 파일 이름에 들어가 기획서와 코드를 바로 잇을 수 있게 함.

```
apps/mobile/
  src/main.tsx            packages/app의 <App platform="ios"|"android"/>, 브라우저 개발·e2e는 흉내 브리지
  vite.config.ts
  capacitor.config.ts
  ios/, android/          Capacitor 네이티브 프로젝트(Xcode, Gradle)
  e2e/                    Playwright(흉내 Supabase), /dev/ui 스크린샷

apps/site/                Astro 정적 사이트, Cloudflare Workers 정적 자산(wrangler.jsonc)
  src/pages/
    index.astro           L-01 랜딩
    download.astro        L-02 앱 받기 (기기에 맞는 스토어 버튼)
    releases.astro        L-03 릴리스 노트
    terms.astro, privacy.astro   L-05 약관과 처리방침
    help.astro            L-06 고객센터
    i/[code].astro        초대 링크 (앱이 없으면 코드 + 스토어 버튼)
    auth/callback.astro   로그인 복귀 페이지(code, state → sweetwo:// 딥링크)
  public/.well-known/     apple-app-site-association, assetlinks.json
  src/lib/client.ts       기기 인식(core detectSiteOs), 스토어 버튼, 측정
  src/content/            릴리스 노트, 약관, FAQ 원본 (마크다운)

apps/mail-worker/         Cloudflare Email Worker(Email Routing inbound@in.sweetwo.kr → inbound-mail, wrangler.jsonc, 손으로 배포)
  src/index.ts            email(): 1MB 넘으면 거절, 원본 MIME을 INBOUND_URL로(x-inbound-secret)

packages/app/src/
  app.tsx                 라우터, 쿼리 클라이언트, 테마
  routes.tsx              경로 표 (화면 ID 주석)
  platform.ts             ios/android/web 차이와 브리지 타입 AppBridge
  features/
    auth/                 A 화면
    onboarding/           O 화면
    pairing/              P 화면 (초대, 합류, 해제)
    frame/                앱 기본 틀(MainFrame), 순자산 카드, 공지 띠, 홈 할 일·일정 재료
    home/                 H 화면 (홈)
    salary/               W 화면 (월급 계획, 체크리스트, 월급 전 확인)
    salary/               W 화면(저금 항목 W-10~W-12 포함)
    assets/               F 화면
    calendar/             Y 화면
    notifications/        N 화면
    settings/             S 화면 (프로필 사진 S-11e 포함)
  shared/                 여러 기능이 쓰는 훅, 레이아웃

packages/app/src/features/salary/    한 기능 폴더의 생김새
  pages/
    g-01-goal-list.tsx    화면 하나 = 파일 하나, 화면 ID로 시작
    g-02-goal-detail.tsx
  components/             이 기능에서만 쓰는 조각
  hooks/                  use-goal-form.ts 등 화면 로직
  copy.ts                 이 기능의 화면 문구 전부
  index.ts                밖으로 내보낼 것만

packages/api/src/
  client.ts               Supabase 클라이언트 하나
  keys.ts                 TanStack Query 키 모음
  realtime.ts             변경 신호 구독, 쿼리 무효화
  saving.ts               addSavingItem, keepSavingItem 등 (테이블 묶음마다 파일 하나)
  storage.ts              프로필 사진, 경조사 사진 올리기

packages/core/src/
  db.types.ts             supabase gen types 결과 (손대지 않음)
  schemas/                Zod 스키마, 테이블 묶음마다 파일 하나
  money.ts                금액 포맷, 반올림, 배분 미리보기
  date.ts                 KST 날짜, 기준일, 음력
  rules/                  계산·배분 탭 규칙 (서버 함수와 같은 결과)

packages/ui/src/
  styles/tokens.css       디자인 시스템에서 복사 (손대지 않음)
  styles/bundle.css       디자인 시스템에서 복사 (손대지 않음)
  components/Button.tsx   컴포넌트마다 파일 하나, 디자인 시스템 이름 그대로
  assets/illustrations/   목표, 빈 상태 그림

supabase/
  migrations/20261020093000_create_goal.sql
  functions/<이름>/index.ts
  functions/_shared/      함수끼리 같이 쓰는 코드
  tests/rls_goal.test.sql
  seed.sql                찬우, 예빈 두 사람 테스트 데이터
```

### 이름 규칙

| 대상 | 규칙 | 예 |
| --- | --- | --- |
| 파일, 폴더 | kebab-case | `use-goal-form.ts` |
| 화면 파일 | 화면 ID + 이름 | `w-02-checklist.tsx` |
| React 컴포넌트 | PascalCase, 화면은 ID 붙임 | `GoalListPage`, `W04MonthCloseDone` |
| 훅 | use + 동사나 명사 | `useGoals`, `useApplyProposal` |
| DB 테이블, 컬럼 | snake\_case, 단수 | `pay_check_line.goal_id` |
| DB 함수 | 동사\_대상 | `apply_proposal`, `close_month` |
| 마이그레이션 | 시각\_동사\_대상 | `20261020093000_add_avatar_path.sql` |
| Edge Function | kebab-case 동사 | `send-weekly-summary` |
| 분석 이벤트 | 대상\_동사 과거형 | `proposal_applied` |
| 환경 변수 | 대문자, 앱에 보이는 것만 VITE\_ | `VITE_SUPABASE_URL` |

### import 규칙

- 방향은 한쪽만: apps → app; app → api, ui, core; api → core; ui → core(ui는 app, api를 모름). 거꾸로 가면 lint 오류(eslint-plugin-boundaries)
- 기능 폴더끼리는 서로의 index.ts로만. 다른 기능의 안쪽 파일을 직접 부르지 않음
- 패키지는 `@sweetwo/app`, `@sweetwo/api`, `@sweetwo/ui`, `@sweetwo/core` 이름으로
- packages/app은 Capacitor를 모름. 모바일 전용 기능은 platform.ts의 `window.sweetwo` 브리지로만

### 온보딩 구조

재기획(ADR 0003, 0004, 0005, 0007) 온보딩(2026-11-10 QA 2구간에서 O-10·O-12·O-13·이어하기 질문을 뺌): O-03 → O-06 (→ O-07) → O-11 → O-30 → O-31 → O-32 → O-60 → 홈. 파트너가 이미 합류했으면 O-06·O-07 없음. O-32 다음 `onboarding/auto-split.ts`가 추천 월급 계획(저금 줄 없음)과 첫 체크리스트를 만듦. 홈 할 일 닫은 목록은 `shared/home-todo.ts`(기기 기록, 할 일 ‘월급 계획 확인’은 2026-11-03 없앰). 뺀 화면에 멈춘 사람은 `flow.ts` `current`로 옮김: O-10 → O-03, O-12·O-13·O-21·O-23·O-24 → O-30, O-50 → O-31.

- `packages/app/src/features/onboarding`: `flow.ts`(답에 따라 화면 목록, 진행 막대 하나 `progressOf`: O-03~O-32 질문 중 지금까지, O-60 없음. `ORDER` 전체 순서로 목록에 없는 화면(이어하기로 연 O-07)의 앞뒤를 셈, O-11 뒤로는 O-07을 건너뜀), `step.tsx`(진행, 뒤로, 저장 뒤 다음, 가장 멀리 간 화면 기록 `isAhead`, `replan`, 분석 이벤트 32 4-3, `finish`), `pages/o-xx-*.tsx`(화면 하나 = 파일 하나), `onboarding-route.tsx`(경로 `/onboarding/o-03` → 화면, 마친 뒤 오면 홈, 이어하기 `OnboardingGate`)
- 목표 고르기(O-21)와 비상금 자동 항목은 없앰(2026-11-08 ADR 0007). 저금 항목은 체크리스트 첫 저금 빈 줄(salary `FirstSavingRow`, `useFirstSaving`, 2026-11-09)·월급 탭(W-11)에서 직접 만듦
- O-30 월급 관리 방식 `couple_space.salary_mode`(각자 `separate` / 합쳐서 `joint`), O-31 월급 `app_user.monthly_income`·`income_variable`·`payday`·`payday_last`
- O-50 월급 계획(온보딩에서는 안 보이고 추천값으로 자동 저장, 고치는 화면은 W-01): 추천값은 core `rules/salary-split.ts` `recommendSplit`(앱 쪽 순서·변환은 `split-draft.ts`). O-50 틀(`SplitEditor`)에서 줄을 누르면 같은 화면이 금액 입력(Q3)으로 바뀜, ‘+ 줄 추가’는 이름 + 금액. 저장은 RPC `save_split(p_lines, p_owner)`(각자면 내 id, 합쳐서면 생략). W-01은 2026-11-09부터 영수증(줄 RPC)
- O-32 ‘다음’(월급 없음이면 O-31 확인 대화상자) → `auto-split.ts`(RPC `onboarding_reset_plan`으로 내 것·공동 것을 지우고(온보딩 중, 체크 기록 없을 때만) 추천 월급 계획 `save_split`, RPC `start_checklist`: 지금이 든 사이클, 월급날이 없으면 만들지 않음. 2026-11-10 뒤로 가서 답을 바꿔도 다시 만듦) → O-60 준비 끝 ‘홈으로 가기’ → `useStep().finish`(onboarding_done_at) → 홈
- 화면을 넘길 때마다 서버에 저장하고, `app_user.onboarding_step`에 가장 멀리 간 화면 ID(뒤로 가도 되돌리지 않음, 관리 방식·월급을 바꾸면 그다음 화면으로 되돌림). 다시 열면 `OnboardingGate`가 묻지 않고 그 화면으로(2026-11-10, 분석 `onboarding_resumed` 실행마다 한 번). 파트너가 이미 합류했는데 O-06·O-07에 멈췄으면 O-11로
- 결혼기념일 경조사는 `couple_space` 트리거 `sync_wedding_care`가 자동 등록(20261029180000). 연결 해제 뒤에는 S-12h → O-11부터(`start_after_unlink`)
- 옛 결과·진단·플랜 계산(`result.ts`, core `plan`·`expenses`·배분 조정·진단)은 지움
- 구간값·월 계산·출생연도 범위는 `packages/core/src/onboarding`(Vitest). 목표 템플릿·질문(옛 `goals.ts`)과 배분(`allocation.ts`)은 2026-11-08 지움
- 질문 입력 부품은 `packages/ui/src/components/question`(Q1 ChoiceCards, Q3 AmountInput, Q4 YearInput/DateInput/YearMonthInput/DayChips/DateWheel(`yearOnly`)/DayWheel(월급날), Q5 ShortText, 비율 PercentSlider, Q6 ListInput)
- e2e는 `apps/mobile/e2e/mocks/app-db.ts`의 메모리 DB(`save_split`, `start_checklist` 흉내 포함)로 흐름을 끝까지 돌리고 저장된 값을 확인. 날짜는 `page.clock.setFixedTime`으로 10월 7일에 고정

### 홈과 월급 체크리스트 구조

> 2026-11-13(ADR 0009): 홈은 H-10 같이 모으기(`h-10-save-together.tsx`) + H-11 이번 달 한 줄(`h-11-month-line.tsx`, 날짜 없음 기간 막대 H-13 포함) + H-12(`h-12-wedding.tsx`) + 할 일 띠 16순서(core `pickTopTask`, 닫기·끝냄은 서버 `home_task_state`, 기기 저장 아님) + 타일. H-03 큰 상자·H-02 저금 상자는 없앰(아래는 그 전 구조 기록). W-02는 `w-02-payday-confirm.tsx`(자동 묶음 + “모두 계획대로 됐어요” = `confirm_payday`), 지난 달 늦은 확인 `w-02-last-month.tsx`, W-05는 손 줄만. 새 W 화면 파일 → 20 ‘월급 탭 v2.2’.
>
> 2026-11-13 PR 9 구현: 홈 `h-01-home.tsx`가 재료를 모아 core `pickHeroes`(H-10)·`pickMonthLine`(H-11)·`pickTopTask`(H-06)를 부름. 홈 쿼리 훅은 `features/home/data.ts`(묶음 `bundle_view`, 기간 `money_in_period`, 띠 닫기 `home_task_state`, 관리 형태 요청, 분담, 순위 요청, 월급 변경, 쓸 곳 메모, 대표 저금 돈 움직임 `goal_move_public`, 지난 확인 목록) + `useHomeRealtime`(묶음·돈 들어왔어요·메모·분담·관리 형태 요청·월급 변경·순위 요청 구독 → api `*Keys` 무효화). 경조사·만기·해제 기록은 예전 frame `useHomeInput` 그대로. H-13 기간 한 줄은 홈과 월급 탭이 salary `period-line.tsx` `PeriodLine` 하나로. 확인 루프 화면 값은 salary `cycle.ts`(`baseDayOf` 기준일, `firstPaydayOf` 첫 월급날, `salaryChangedDay` 띠 6번 날, 자동 알약 글자). W-01 줄 설정은 `receipt-parts.tsx` `LineSettingsFields`·`AutoDayPick`(W-01d도 씀) → api `configureSplitLines`. W-01d는 `/salary/auto-lines`(W-01 위 BottomSheet). 체크 결과 `finish`는 손 줄만 셈(자동 줄 빼고), 분석 `payday_confirmed`·`pay_line_late_checked`·`auto_line_changed`는 salary `data.ts` `useCheck`. ui: `SaveTogether`·`SaveTogetherSlide`·`SaveTogetherEmpty`, `PeriodBar`, `HubLine`, `HubBand secondary`, `AutoPill`(TransferRow·ReceiptLine `auto`). `HubHero`·`HubSaving`은 지움. e2e 가짜 서버의 v2.2 표·RPC는 `apps/mobile/e2e/mocks/v22-pay.ts`(`db.v22`, app-db가 먼저 부름)

재기획(ADR 0003) 홈과 W 화면. 기획 → 19 홈, 20 월급 체크리스트, 07 월 사이클.

- `packages/app/src/features/home`: `pages/h-01-home.tsx`(2026-11-09 홈 허브, ui `Hub`·`HubHero`·`HubBand`·`HubTile`·`HubSaving`, `MainFrame tone="alt"`): 큰 상자 H-03(다음 월급날 = 체크리스트 `cycle_end` 다음 날, core `monthProgress`로 보낸 줄·보낸 금액, 모은 금액 = 내(합쳐서면 공동) 저금 합) → 할 일 띠 H-06(core `homeTodo` 맨 앞 하나: 연결 해제 요청 받음 → 다시 연결 요청 받음 → 월급 전 확인 → 월급날 체크(core `checkTodo`, 월급날부터 7일 안 + 체크 안 한 줄) → 첫 저금 추가(`firstSavingTodo`) → 만기·경조사 → 초대(같은 코코아 띠 “초대하기 ›” → S-12, 맨 끝). 2026-11-11 띠 닫기 ✕와 기기 저장(닫은 할 일·초대 닫은 날 키)을 없앰: 할 일은 끝내거나 기간이 지나야 사라짐. 예전 키는 `home-input`이 한 번 지움) → 타일 H-07 월급 계획·H-08 캘린더(가장 가까운 경조사, `homeUpcoming(i, 365)`) → 저금 상자 H-02(목표 금액에 가장 가까운 달성 전 저금) → 작은 타일 H-04 자산 관리(`useNetWorth`)·H-09 저금(W-13 범위) (H-04 제목 아래 순위 배지 `useRank`, 2026-11-11 홈 순위 줄 1a 없앰). 분석 `home_box_tapped`. 예전 `parts.tsx`(체크 목록·저금 줄·일정 카드)는 지움. 순자산은 month의 `useNetWorth`·`H06NetWorth`를 그대로 씀
- `packages/app/src/features/salary`: `split-editor.tsx`(O-50·W-01 같은 목록 틀 `SplitEditor`, 줄을 누르면 같은 틀이 금액 입력, 여유 자금은 QuestionLayout `summary`), `split-draft.ts`(추천값 순서·변환), `check-line.tsx`(체크 줄 `CheckLine` = ui `TransferRow`, 체크하면 `checkToast`: 줄 Toast 또는 마지막 줄이면 “{월}월 월급 체크를 다 했어요/마쳤어요” 하나 + 되돌리기), `pages/w-01-receipt.tsx`(영수증, 아래 ‘W-01 영수증 앱’), `w-02-checklist.tsx`, `w-02a-other-amount.tsx`(W-02a, W-02·W-05가 기록 상태 `{ other: 줄 id }`로 엶, 뒤로 = 기록 한 칸 뒤로), `w-05-review.tsx`(2026-11-12 W-02 끝 `w-02-done.tsx`는 지움), 저금 항목 `w-10`~`w-12a`(아래 ‘저금 항목 구조’). 경로 `/salary`(월급 탭 첫 화면 ‘이번 달’, `?view=plan` = ‘계획’ W-01, `?cycle={체크리스트 id}` = 그 지난 달), `/salary/split`(→ `?view=plan`), `/salary/done`(옛 W-02 끝 → `/salary`, `DoneRedirect`), `/salary/review`(`?checklist={id}`, 없으면 지금 내 것), `/salary/items/…`
- 체크리스트는 `useChecklists`가 읽을 때 월급 계획마다 `start_checklist`를 불러 이번 사이클 것을 만듦(같은 사이클이면 서버가 그대로, 새 사이클이면 지난 것은 끝남 + 체크 안 한 줄 ‘못 함’). 앱을 안 열어도 기준일 0시 예약 작업 `run_cycle_checklists`가 같은 함수(`make_checklist`)로 만듦
- 체크는 RPC `check_pay_line(줄, checked|wait|skipped, 다른 금액)`. 먼저 저장된 체크 유지(`already_checked`), 지난 사이클은 읽기 전용(`closed`). 줄이 모두 체크 또는 ‘못 함’이면 체크리스트 `done`(2026-11-12 D4), 각자 모드 파트너 알림은 모두 체크면 “다 했어요”, ‘못 함’이 섞이면 “마쳤어요”(20261122090000, 쓰이지 않던 대신 체크 알림 부분은 지움). 월급 전 확인 알림 링크는 `/salary/review?checklist={id}`, 달성 알림 링크는 고칠 수 있는 사람 W-12(`/salary/items/{id}/achieved`)·파트너 W-10
- 저금 항목 모은 금액 = 시작할 때 모은 금액(`goal.start_saved`, 만들 때만, 20261113120000) + 그 항목을 체크한 저금 줄 합(`goal_saved_sums()`. 넣기·빼기·꺼내 쓰기·예전 `other_held`는 없음)
- 월급 계획 저장(`save_split`)은 서버 `sync_checklist`로 이번 사이클 체크 안 한 줄만 새 금액(체크한 줄, 못 함 줄은 그대로)
- W-01 영수증 DB(20261116090000): 줄마다 바로 저장하는 RPC. `split_line_set(p_line, p_amount?, p_name?)`(이름은 직접 추가 줄만), `split_line_add(p_split, p_kind, p_amount, p_name?, p_user?, p_sort?)`(직접 추가 줄 최대 10·같은 이름 없음, 고정지출·생활비·용돈은 되돌리기용으로 하나씩, `p_sort` 자리에 끼움), `split_line_delete(p_line)`(저금 줄 = `saving_item_stop`, 합쳐서 용돈 줄 = `keep_allowance`), `split_reorder(p_split, p_ids)`(모든 줄 id, 저금 줄이 앞). 권한은 내부 `split_editable`(각자 = 주인만 `not_owner`, 합쳐서 = 공동 월급 계획을 두 사람, 대기 중 `unlink_pending`). 모두 `split_touch`(updated_by·version, Realtime `salary_split` 신호) → `log_split_changes`(파트너 변경 기록, 링크 `/salary?view=plan`) → `sync_checklist`. 순서 열은 처음부터 있던 `split_line.sort`(새 열 없음, 마이그레이션이 저금 줄(만든 순서) → 지출 줄로 정리). `sync_checklist`는 줄 id로도 맞추고(이름 바꾼 줄이 이번 달에 또 생기지 않게) 체크한 줄도 월급 계획 순서로. pgTAP `w01_receipt.test.sql`
- 저금 줄 신호·관리 방식(20261121090000, 2026-11-12 QA 5구간): `goal_lines_sync`가 저금 줄이 있는 월급 계획의 `version`을 올림(저금 추가, 그만 모음·되돌리기, W-12a 고름 → Realtime `salary_split` 신호). 줄이 생기거나 빠질 때만 `updated_by`·`updated_at`도(W-02 상대 변경 안내). 그만 모을 때 `goal.freed_lines`에 금액(키 = 월급 계획 id)과 자리(키 = `sort:` + 월급 계획 id)를 두고 되돌리면 원래 자리로. `set_salary_mode` 각자 → 합쳐서는 직접 추가 줄을 같은 이름끼리 더해 한 줄(10줄이 넘어도 두고 추가만 막힘), 알림 링크 `/salary?view=plan`. pgTAP `s5_salary_sync.test.sql`
- 체크리스트 줄 Realtime(20261120090000, 2026-11-11 QA 4구간 S4-02): `pay_check_line`을 Realtime 발행에 더함(정책은 그대로, 같은 공간만 읽음). api `subscribeCheckLines(spaceId)`, 앱 `salary/data.ts` `useCheckRealtime`(홈과 월급 탭에서 구독, 체크리스트·모은 금액 다시 읽음). 합쳐서 모드에서 상대 체크가 바로 보임. pgTAP `realtime_pay_check_line.test.sql`
- 홈 허브 규칙(2026-11-11 QA 4구간): 내 이번 달 체크리스트는 core `pickMyChecklist`(내 것 → 공동) 하나로 홈·W-02·W-05·S-11f가 같이 씀(앱 `salary` `myChecklist`가 감쌈). 본문 맨 위 띠는 core `pickTopBanner`로 하나만(오프라인 > 해제 대기 > 필독 공지 > 메일 반송 > 일반 공지, 오프라인은 `MainFrame`이 먼저 두고 화면 띠를 숨김). 홈은 `useSplitRealtime`·`useCheckRealtime`으로 상대 변경을 바로 받음. 할 일 재료(`useHomeInput`)는 켜진 쿼리가 다 온 뒤에만 계산. 서랍(`Drawer`)은 body 끝에 그리고 뒤 화면 `inert` + `hg-scroll-lock`
- W-01 영수증 core·api: 비율은 core `rules/plan-ratio.ts` `planRatio`(가장 큰 나머지 방식, 06 3-5 예시가 Vitest). api `salary.ts` `setSplitLine`·`addSplitLine`·`deleteSplitLine`·`reorderSplit`(막히면 `SplitBlocked` 이유: `duplicate_line`·`not_owner`·`unlink_pending`·`keep_allowance`·`too_many_custom`), `subscribeSplits`(Realtime `salary_split`). 다시 읽을 키는 `splitKeys`(월급 계획, 체크리스트, 저금 항목, 모은 금액). 앱 `salary/data.ts` `useSplitWrite`(쓰고 다시 읽기), `useSplitRealtime`(월급 탭에서 구독)
- W-01 영수증 앱(2026-11-09): 월급 탭 `/salary` = `salary-tab.tsx` `SalaryTab`(`?view=plan`이면 `pages/w-01-receipt.tsx` `W01Receipt`, 아니면 W-02. 구간 탭 `SalarySeg`, Realtime `useSplitRealtime`), 옛 `/salary/split`은 `SplitRedirect`(`who` 그대로). 주소는 `paths.ts` `salaryPaths.plan`·`planPath({ who, line })`(`line` = 처음에 열 저금 줄 시트, W-10 ‘매달 금액 바꾸기’). 화면은 ui `ReceiptStage`·`ReceiptCard`·`ReceiptHead`·`ReceiptBar`·`ReceiptSection`·`ReceiptRows`·`ReceiptTotal`, 금액 시트·이름 칩은 `receipt-parts.tsx`(`PlanSheet`, `SpendChips`). 고치기는 줄마다 api RPC → `useSplitWrite` → Toast ‘되돌리기’(금액·이름 = 예전 값으로 `setSplitLine`, 추가 = `deleteSplitLine`, 지우기 = 같은 `sort` 자리로 `addSplitLine`, 저금 줄 지우기 = 확인 Modal 뒤 `deleteSplitLine`(서버 그만 모음) → 되돌리기 `reopenSavingItem`). 편집 모드 순서는 화면에만 두었다가 ‘완료’에서 `reorderSplit` 한 번. ‘추천값으로 다시 채우기’는 `saveSplit`(줄 순서는 `keepOrder`). O-50·합류 P-06은 예전 목록 틀 `SplitEditor` 그대로
- W-01 QA 5구간(2026-11-12): 불러오는 중·실패는 `salary-tab.tsx` `SalaryLoading`(구간 탭 + 본문 뼈대)·`SalaryLoadError`(구간 탭 + 13 공통 7번 카드 + ‘다시 시도’, W-01·W-02 같이). 금액 가리기 화면 읽기는 `shared/masked-text.tsx`(`spoken`: aria-label 글자의 •••를 “가려진 금액”으로, `speakMasked`: 보이는 글자는 •••, 화면 읽기는 “가려진 금액”, `ToastHost`도 씀). ‘추천값으로 다시 채우기’는 core `recommendSplit`의 `custom`(직접 추가 줄 금액 그대로, 고정지출·생활비는 그만큼 뺀 수입에서, 06 3-2 예시가 Vitest). Toast 행동 버튼은 누르면 닫힘(`ToastHost`). 분석 `shared_item_changed`·`change_reverted`(합쳐서 + 연결)
- 영수증 이미지 공유: `receipt-image.ts`(`renderReceiptPng`: 화면과 같은 문구·숫자, 지금 테마 토큰을 `getComputedStyle`로 읽어 canvas에 그림, 3배, 의존성 없음. 사진 Avatar는 다른 출처라 canvas가 막혀서 사람 색 원으로), `shareReceipt`: 브리지 `shareImage({ name, base64 })`가 있으면 그것(모바일 `apps/mobile/src/native/bridge.ts`: Filesystem 캐시 + `Share.share` 공유 창 → 'shared'·'cancelled'), 없으면(브라우저) 내려받기. 금액 가리기면 이미지 금액도 “•••”(화면 그대로). 분석 `plan_shared`
- W-01 ↔ W-02 잇기(2026-11-09): 계산은 core `rules/month-progress.ts`(`monthProgress`: 칸 너비 = 계획 금액 비율(planRatio), 칸 안 채움 = 보낸 금액 ÷ 계획, 보낸 금액·여유 자금 / `planChangeTouchesMonth`: W-01 금액 바꾸기가 이번 달 체크 안 한 줄도 바꾸는지, 서버 `sync_checklist` 맞춤과 같음, 06 3-6 예시가 Vitest). 앱 `features/salary/month-parts.tsx`: `MonthBar`(W-02 머리 ui `PlanBar` 진행 모드 + “체크한 금액 …”), 다 끝난 달(2026-11-12, W-02 끝 화면·달 결과 카드 대신): `MonthBar`가 core `checklistFinish`로 막대 아래 굵은 한 줄 + ‘공유하기’(ui `PlanBar` `title`·`action`, 공유는 `receipt-image.ts` 같은 canvas에 `title`·`progress`·줄 `sub`·`muted`, 분석 `month_result_shared` screen `checklist`·`past`), `incomeOf`(체크리스트 주인 수입). W-01 머리 아래 ‘이번 달 3/5 보냈어요 ›’(`plan_link_tapped`). W-02 새 사이클 한 줄은 localStorage `sweetwo.made-notice.{체크리스트 id}`(기기마다, 서버 없음)
- 할 일 한 줄·일정·이번 달 월급 상태는 core `rules/home.ts`(`homeTodo`, `homeUpcoming`, `salaryState`)가 계산하고, 재료는 frame `useHomeInput()`(같은 qk 캐시, 닫은 할 일은 기기 저장), 문구는 frame `todoText`·`upcomingName`. 홈 화면 위젯(26 v2.2)은 H-10 첫 칸(`pickHeroes`)과 H-08 다가오는 날을 home `widget-sync.ts`로 넘김(‘모바일 네이티브 v2.2’)
- 앱 기본 틀은 `features/frame`(ui `AppFrame`, 금액 가리기 `shared/mask.ts`). `command.tsx`: ⌘K(Apple 밖 Ctrl+K, 키보드를 붙인 태블릿 등) 검색 화면(ui `CommandPalette`, ‘바로 하기’ + 저금 항목·자산·부채·경조사 최대 5개씩), Ctrl(⌘)+1~4 탭, Ctrl(⌘)+N(홈 = 오늘 띠 ‘추가’ 메뉴 `AddMenu`, 다른 메뉴 = 그 화면에 맞는 추가 `addFor`). 좁은 창(2026-11-09): 하단 탭 막대·+ 버튼 없음, `MainFrame`이 홈 머리 ☰ 메뉴 서랍(ui `Drawer`, 분석 `menu_item_tapped`)과 홈 밖 메뉴 첫 화면 ‹(홈으로, 바꿔치기 이동)을 그림. 안드로이드 하드웨어 뒤로는 브리지 `window.sweetwo.onBack`(모바일 `CapApp` `backButton`, 앱이 처리하지 않으면 웹뷰 뒤로 / 앱 닫기)로 서랍 닫기·홈으로. 추가는 화면 안 ui `AddRow`. 오프라인이면 본문 맨 위 “연결이 끊겼어요” 띠(`shared/online.ts`, 입력 대기열은 아직 없음). 불러오는 중 0.3초 넘으면 스켈레톤(`LoadingFrame`). 홈 연결 해제 대기 띠(요청한 사람 → S-12, 받은 사람 → S-12d, 닫기 없음). ‘저장 중’ 표시와 충돌 선택은 아직 없음
- W-01(20261102090000, 2026-11-09 영수증으로 다시 만듦): 각자 + 파트너 합류면 사람 탭(`?who=`), 파트너 탭은 보기만(영수증 줄마다 자물쇠 `hg-receipt__lock`, 회색 한 줄 `partnerSplitView`, 서버 `save_split`·줄 RPC가 파트너 월급 계획이면 `not_owner`). 큰 금액 → S-11(내 탭). 합쳐서면 각자일 때 만든 저금 줄 이름 앞에 주인 이름(`goalLineName`, 체크리스트·홈도 같음). 저금 줄 금액 시트 아래 ‘저금 보기’ → W-10, 그만 모은 항목은 접힌 묶음, ‘+ 저금 추가’ → W-11a. 직접 추가 줄은 시트에서 이름·금액 바꾸기. ‘추천값으로 다시 채우기’는 core `recommendSplit`(`items` 저금 항목: 목표 금액·기한이 있으면 월 필요액, 없으면 지금 금액 `current`, `keep` 줄 그대로), 합쳐서는 두 사람 수입·사람마다 용돈. 연결 해제 대기면 보기만
- W-02: ‹ › 지난 달 보기(`fetchPastChecklists`, 읽기 전용), 기간 시작은 월급날이 주말·공휴일이면 직전 영업일로 표시(`holiday_shift`), 상대가 이번 사이클에 월급 계획을 바꿨으면 맨 위 안내(× 누르면 이 기기에서 숨김), 파트너 탭은 ‘다른 금액’ 없음. 묶음 머리 오른쪽 ‘모두 보냈어요’(2026-11-09 round 3, ui `SectionHeader action`): 남은 줄을 차례로 `checkPayLine`(줄마다 서버 `check_pay_line`, 일괄 RPC 없음), 끝난 뒤 한 번만 무효화해 `AchieveWatch`가 한 번에 봄, Toast 한 번 + 되돌리기(이번에 체크한 줄만 `wait`). 파트너 탭(각자)은 ‘모두 보냈어요’와 ‘월급 계획 고치기’ 없음. 저금 묶음 머리 제목(`SectionHeader onTitle`) → W-13
- 체크리스트 QA 6구간(2026-11-12): 체크는 `salary/data.ts` `useCheck(entry)` 하나(결과 `{ r, finish }`: 캐시의 그 체크리스트로 core `finishAfter`, 분석 `checklist_line_checked`·`_unchecked`·`_skipped`·`checklist_completed`, 끝나면 체크리스트·모은 금액·저금 항목(`qk.goals`)을 다시 읽음 = `refreshChecks`, Realtime도 같음). 묶음 ‘모두 보냈어요’는 `finishOfMany`. 상대가 바꾼 줄 2초 강조는 `useChangedLines`(이 기기가 5초 안에 쓴 줄 `markLocalWrite`는 빼고) → `CheckLine changed` → ui `TransferRow changed`. ‘못 함’ 줄은 빈 원 + “이번 달은 못 했어요”(누르면 체크). W-05는 core `inReviewWindow`(기간 끝 2일 전 ~ 끝)와 `?checklist=`로 그 체크리스트만, 기간 밖은 `/salary`, 끝난 사이클은 `/salary?cycle={id}`, 처음 열 때 체크 안 한 줄을 기억해 체크해도 남김. `AchieveWatch from="checklist"`(W-02·W-05) → W-12 `?from=checklist` → W-12a 고른 뒤 `/salary`. W-12는 달성이 아니면 W-10으로. 상대 변경 안내 날짜는 core `kstDateOf`. 좁은 창만 보이는 것은 `hg-narrow-only`(W-02 저금 묶음 끝 ‘+ 저금 추가’). 오프라인 띠는 기기 저장이 없어도 받아 둔 쿼리가 있으면 13-9 “오프라인 / 마지막 저장 {마지막으로 받은 때}”
- 월급날 바꾸기: `app_user` 트리거 `payday_cut_cycle` → `cut_cycle`로 이번 사이클 끝 = 새 기준일 전날(각자 = 내 체크리스트, 합쳐서 + 만드는 날 자동 = 공동)

### 캘린더 구조

- 기획: 24(재기획 2026-10-25). features/calendar: `/calendar`(마지막 보기로, 기기에 기억), Y-01 `/calendar/list`, Y-04 `/calendar/month`. 보기 필터 “전체” “경조사” “금융 일정”은 목록·달력 공통, 기기에 기억
- 금융 일정(읽기 전용, 누르면 해당 화면)은 core `rules/calendar.ts` `moneyDates(연, 월, 재료)`: 월급날(각자 = 사람마다 “찬우 월급날”, 합쳐서 = `joint_cycle_day` 하나 “월급날”, 주말·공휴일이면 직전 영업일) → W-02, 월급 전 확인 띠(다음 월급날 3일 전 ~ 전날, 각자 = 내 월급날 기준, 첫날 “월급 전 확인”) → W-05, 저금 항목 기한(목표 금액과 기한이 있고 모으는 중만) → W-10, 자산·대출 만기(서버가 공개 범위로 거른 행) → F-04
- 달력 칸은 ui `Calendar`(일요일 시작 6주, `monthGrid`). 금융 일정 = 검정 점, 월급 전 확인 = `is-band`, 경조사 = `together` 점 한 가지. 고른 날이 띠 안이면 “{n}월 월급, 빠진 게 있는지 확인할 때예요” 줄(→ W-05). 목록 맨 위 띠는 2026-11-12 D1로 없앰(일정 줄 하나)
- 목록: 기록 없이 7일 지난 날(맨 위 ‘기록하기’) → 다음 경조사 카드(D-day, 날짜, 금액 메모 “30만 원 생각해 뒀어요”, ‘준비하기’) → 60일 안 경조사 → 금융 일정 작은 줄 → 선물 기록. 경조사가 없으면 빈 상태 + ‘경조사 추가’(금융 일정은 그대로)
- QA 9구간(2026-11-12): `useCalendarData`가 `failed`·`retry`를 주고 Y-01·Y-04·Y-05(+ 금액 메모)는 frame `CalendarLoadError`(13-7 카드 + ‘다시 시도’, S9-02). Realtime은 api `subscribeCares`(care_day + care_record) → `useCareRealtime`(경조사·기록·사진 키 다시 읽음, S9-03). 고치기 Toast ‘되돌리기’는 `careUndo`(고치기 전 값으로 `updateCareDay` + `change_reverted` care_day, S9-04), 상대 알림이 가는 동작(추가, 메모)은 `trackCareShared`(S9-05). 경조사 응답은 core `CareDaySchema`·`CareRecordSchema`·`RecordCareResultSchema`(S9-15). 금융 일정 월급날은 `who`(파트너 id)를 실어 `/salary?who=`(S9-10). 이번 주 띠 `WeekStrip holidays`(S9-07)
- 경조사는 한 종류(`care_day`, 새로 만드는 것은 category `couple`). 금액(`budget`)은 메모일 뿐 계산에 안 들어감. 가족 목록, 양가·우리 둘 구분, 챙길 사람, 서프라이즈(`secret`), 양가 비용(Y-06)·낸 곳은 재기획으로 없앰(열은 남기고 새로 안 씀)
- 날짜 계산은 core `rules/care.ts`(`careDateInYear`, `nextCareDate`, `careDatesInMonth`, `dday`). 음력은 `rules/lunar.ts`(`lunarToSolar`: 윤달이 없으면 평달, 30일이 없으면 29일)
- Y-07 `/calendar/add/:step`: a 이름(최대 20자) + 이름 칩(생일, 결혼기념일, 설날, 추석, 어버이날, 행사, 직접 쓰기 = 이름·날짜·반복 기본값만, `kind`로 저장) → c 날짜 + 양력/음력(+ 윤달) + “매년 돌아와요”(행사만 기본 꺼짐, 설날·추석·어버이날은 건너뜀) → d 금액 메모(건너뛰기) → ‘추가하기’(알림 D-30 + D-7). 한 번인 지난 날은 ‘기록으로 남기기’ → Y-08. 같은 이름·날짜면 한 번 확인. ‘+ 추가’, 달력 고른 날(날짜 채움)에서 시작. 수정(Y-05 ⋯ ‘수정’, `startCareEdit`)은 같은 a → c에서 이름·날짜만 ‘저장’
- Y-05 `/calendar/day/:id`(+ `/budget` 금액 메모 Q3): 제목·날짜(음력이면 음력 함께)·D-day, 금액 메모, 반복, 준비 상황(그 해 날짜에만), 알림 일수, 작년에는, 메모, ⋯ 수정·지우기(휴지통 `trashCareDay` + ‘되돌리기’ = `restore_trash`)
- Y-08 `/calendar/day/:id/record/:step?on=`(a 쓴 돈 → b 드린 것 → c 메모, 모두 건너뛸 수 있음. ‘목표에서 꺼내 쓰기’는 2026-11-08 없앰). 저장은 RPC `record_care`(낸 곳 = `personal`, 줄 0)로 기록만. api `recordCare`는 낸 곳·옮길 금액을 받지 않고 서버 옛 인자(`p_paid_from`, `p_move`, 기본값 없음)에 고정값만 보냄(2026-11-12 S9-15). 저장하면 `event_recorded`
- 기록할 회차는 core `recordDate`(지난 60일 안 기록 없는 날, 만든 날 이후. 한 번인 날을 기록했으면 null, 2026-11-12 S9-01), 7일 지나면 `overdueDate`. 다음 경조사는 오늘 이후만
- Y-09 `/calendar/gifts`: 경조사별 / 연도별(기기에 기억), 같은 경조사에 2년 안 같은 선물이면 “작년에도 드렸어요”(core `giftRepeated`, Y-08b도 같은 규칙)
- 자동 결혼기념일(마이그레이션 20261029180000): `couple_space` 트리거가 결혼했고(married) 결혼한 날이 있으면 `sync_wedding_care`로 경조사 “결혼기념일”(매년 양력, `auto = 'wedding'`) 하나를 만듦. 공간마다 하나(지운 것도 셈, 지우면 다시 안 만듦). 결혼한 날이 바뀌면 날짜를 옮기되 사람이 날짜를 고쳤으면(`auto_moves = false`, 트리거가 표시) 그대로. 예정일(engaged)은 만들지 않음
- 공휴일: `holiday` 테이블, 앱은 읽기만(`fetchHolidays`, 하루 캐시). 달력 칸 `holiday`(빨간 숫자 + 짧은 이름), 설날·추석은 `festive` 띠(core `isFestive`). 특일 API 받기는 Edge Function `fetch-holidays` + pg_cron `kick-holidays`(20261107120000, 키는 사람이 할 일)
- 월급날 앞당기기: core `businessDayOnOrBefore`, `couple_space.holiday_shift`(기본 켜짐)가 false면 그대로
- 서버 막기(20261125090000, 2026-11-12 QA 9구간 D2): `care_day_client_guard`가 앱이 바로 쓸 때 새 서프라이즈(`secret = true`, 넣기나 켜기)와 21자 넘는 이름(앞뒤 공백 빼고, 넣을 때와 이름을 바꿀 때만)을 거절(`23514` `care_secret_removed`·`care_name_too_long`). 지금 있는 옛 서프라이즈·긴 이름 행은 그대로라 CHECK가 아닌 트리거(서프라이즈 끄기, 메모·준비 상황, 기록은 됨). 함수 안(security definer)은 걸리지 않음. care_day·care_record는 Realtime 발행(S9-03, 읽기 권한은 select 정책 그대로). pgTAP `s9_calendar.test.sql`
- 미리 알림(D-30·14·7·당일)과 상대 알림(`care_partner_change`)은 있음. 옛 `family_member`·`apply_family_budget`는 20261101180000에서 지움. 다녀온 뒤 기록 `record_care`는 기록만

### 설정 구조

> 재기획(2026-10-25, `docs/adr/0003-replan-goal-checklist.md`) 반영. 연결 해제는 ADR 0003 11장(나누지 않고 모두 지움, 30일 보관 뒤 영구 삭제)대로 다시 씀(마이그레이션 20261030180000). 계정 삭제(S-18b, 20261101210000 `request_account_deletion`): 탈퇴 = 데이터 모두 지움. 연결·해제 대기면 연결 해제 확정과 같게 두 사람 모두 빈 새 공간(`unlinked_from` = 원래 공간, `onboarding_step` S-12H), 원래 공간은 30일 보관, `couple_unlink` `how = 'deleted'` 확정 행. 취소하면(`cancel_account_deletion`) 그때부터 30일 안 다시 연결 가능(해제와 같은 `answer_reconnect`). 2026-11-13 ADR 0009로 바뀜: 같이 쓰던 것만 지우고 내 것은 혼자 공간으로 옮김, 30일 재연결 복구는 미룸(위 ‘v2.2 데이터와 서버’, 08 7·8장). 아래는 지금 코드 기록

- v2.2 설정(PR 11, 2026-11-13, 25 ‘설정 v2.2’): S-11f 관리 형태 `s-11f-manage-style.tsx` `/settings/couple/style`(서버 알림 링크와 같음, 옛 `/settings/me/salary-mode`는 이리로)는 세 질문(O-30·30b·30c) → api `requestModeChange`(바로 적용이면 Toast ‘되돌리기’ + W-01, 요청이면 S-11). 진행 중 내 요청 + ‘요청 취소’(`cancelModeChange`), 상대 요청은 S-11j로. 앱 역할의 옛 `set_salary_mode` 실행 권한은 회수(20261205090000, 서버 안 `apply_manage_style`만 씀, api `setSalaryMode` 지움). S-11j `s-11j-style-request.tsx` `/settings/couple/style/request/:id`(`answerModeChange`). S-11c `s-11c-salary.tsx`: 금액이 바뀌면 2단계 “언제부터”(+ 선택 “언제까지”) → `scheduleSalaryChange`(이번 달이면 서버가 바로 적용), 예약은 S-11 월급 줄 아래 + ‘취소’(`cancelSalaryChange`), 공개 고지 한 줄 + ‘바꾸기’ = settings `PlanShareSheet`(index에서 내보냄, O-31·P-05도 같은 시트를 쓸 수 있음). S-13 `s-13-sharing.tsx` `/settings/visibility` 한 목록 ①~④(`setPlanShare`, `setBundleVisibility`, `setAssetShareDefault`, `requestRankConsent`·`turnOffRankConsent`), S-13p `s-13p-preview.tsx` `/settings/visibility/preview`(월급 계획은 `fetchPartnerPlanView(상대 id)`, 저금·자산은 상대가 실제로 받는 규칙대로 화면이 다시 계산: 저금 이름·목표 금액·모은 금액은 공개 단계와 상관없이 보임). S-12 다시 연결은 api `fetchReconnectRequests`(`reconnect_request`, 키 `qk.reconnectRequests`) + `requestReconnect`(`too_soon`·`reconnect_closed` Toast), S-12g ‘연결할게요’ → `answerReconnect(true)`가 돌려준 초대 코드로 `/i/{코드}` 합류 흐름, “다시 받지 않을게요” = `answerReconnect(false, true)`. S-12h: 내 월급 계획이 남았으면 `onboarding_step = 'O-60'` → 홈, 없으면 `start_after_unlink` + O-30. S-14 알림 종류 = `app_user.push_kinds`(`setPushKinds`), payday·shared_change·achieved는 옛 `noti_prefs` 묶음(plan·partner_change·goal)도 같은 값으로, 관리하지 않는 쪽은 처음 열 때 `shared_change: false`를 적어 둠. S-15 PIN이 없으면 맨 위 권장 한 줄 + ‘켜기’. S-20 1366 항목은 `HELP_ABUSE_ENABLED`(false). 분담 W-01b `features/salary/pages/w-01b-split-propose.tsx` `/salary/split/new`, W-01c `w-01c-split-answer.tsx` `/salary/split/:id`(`proposeSplit`·`answerSplit`, 미리 보기 core `splitShares`·`incomeRatioAllowed`). ui `QuestionLayout` `secondary.disabled`(오프라인)
- features/settings: S-10 `/settings`(상단 아바타, 좁은 창 설정 버튼), S-11 `/settings/me`, S-11a `/settings/me/nickname`, S-11c·d·f·g·h·i `/settings/me/…`, S-12 `/settings/couple`, S-12a·c·d `/settings/couple/unlink`(`/confirm`, `/review`), S-12h `/settings/couple/unlinked`, S-12g `/settings/couple/reconnect`, S-14 `/settings/notifications`, S-14a `/settings/notifications/quiet`. 메뉴가 아니라 `MainFrame current={null}` (재기획으로 S-10a 통장 방식, S-11b 신랑·신부, S-17 내 답 다시 보기, 연결 해제 S-12b 자산 정리·S-12e 다르게 정리하기·S-12f 다른 안은 지움)
- 공개 범위 줄은 합류한 두 사람만. 위젯 줄(S-22)은 없앰(2026-11-10, ADR 0008). 2026-11-13 모바일 위젯 설정으로 다시 쓰기로 했으나 화면은 아직 없음(위젯은 기본값: 대표 저금, 금액 가림)
- 알림 이메일은 S-11에서 그 자리에서 고침(core `NotifyEmail`: 공백 제거·소문자·형식만). 주말·공휴일 앞당기기는 `couple_space.holiday_shift`(두 사람 공통, 바로)
- S-11 내 정보와 월급(재기획): 이름 S-11a, 결혼 상태 S-11g `/settings/me/marriage`(바꾸면 S-11h에서 상태와 날짜를 함께 저장), 결혼한 날·예정일 S-11h `/settings/me/wedding`(날짜 규칙, 처음 적을 때는 휠을 움직여야 저장 `commitInitial`, 결혼기념일 경조사는 서버 `sync_wedding_care`), 출생연도 S-11i `/settings/me/birth-year`. 월급 묶음: 내 월급 S-11c `/settings/me/salary`(합류 뒤 파트너 값 보기만, Toast ‘되돌리기’), 관리 방식 S-11f `/settings/me/salary-mode`(혼자 쓰기면 숨김, 다른 방식을 고르면 `note`로 미리보기 “{다음 시작일}부터 체크리스트가 …”, 날짜는 salary `myChecklist` 기간 끝 다음 날, 2026-11-09 round 3), 체크리스트 만드는 날 S-11d `/settings/me/plan-day`(합쳐서 + 합류만), 앞당기기 토글, ‘월급 계획 열기’ → W-01. 연결 해제 대기 중엔 관리 방식·만드는 날 비활성
- 관리 방식 바꾸기 `set_salary_mode(mode)`(마이그레이션 20261030120000): 각자 → 합쳐서 = 두 사람 저금 항목 줄 그대로 모음, 고정지출·생활비 더해 1줄씩, 용돈은 사람마다, 직접 추가 줄 그대로. 합쳐서 → 각자 = 고정지출·생활비·직접 추가 줄을 두 사람 수입 비율로(1만 원 단위, 남는 차이는 기준일 사람), 용돈은 주인에게, 저금 항목 줄은 통째로 주인(없으면 만든 사람)에게(20261112090000). 체크리스트는 다음 월급날부터 새 방식(`start_checklist`가 옛 방식 체크리스트가 이번 사이클이면 새로 안 만들고, 끝나면 닫음). 파트너 알림 `salary_mode`, 해제 대기면 `unlink_pending`
- 체크리스트 만드는 날 `set_joint_cycle_day(일)`: 두 사람 월급날 중 하나(말일 = 31)만, 이번 공동 체크리스트 끝 = 새 기준일 전날, 파트너에게는 주간 요약(활동 기록)만(20261031120000)
- S-14 휴대폰 알림 권한(2026-11-12 QA 11구간 S11-04): 브리지 `push.status()`가 `denied`면 “휴대폰 설정에서 알림을 켜 주세요” + ‘설정 열기’(브리지 `push.openSettings`, 앱 안 플러그인 `AppSettings`: iOS `SceneDelegate.swift` `AppSettingsPlugin`(16+ 알림 설정), Android `AppSettingsPlugin.java`(`ACTION_APP_NOTIFICATION_SETTINGS`)), 푸시 토글은 꺼짐으로. 앱이 다시 보이면 다시 읽음. 푸시가 꺼져 있으면 묶음 토글·경조사 체크도 꺼짐으로 보이고 누를 수 없음(저장값은 그대로)
- S-11 로그인 줄: 제공자 배지 + `my_login_email()`(가입 소셜 계정 이메일, 20261127090000)
- 알림 설정은 `app_user.noti_prefs`(받는 방법 + 묶음별 OS 알림·이메일, core `notiPrefs`가 기본값: 경조사 D-14·당일만 꺼짐)와 `quiet_start`·`quiet_end`(한국 시간 시). 토글은 바로 저장. 센터 기록은 설정과 상관없이 남고, 모바일 푸시는 `pushAllowed(설정, notification.topic, 방해 금지)`(서버 `push_wanted`와 같은 규칙)가 참일 때만. `notification.topic`은 kind와 dedupe로 만드는 생성 열(plan, proposal, invite, care_30 …). 웹은 이메일 토글만 묶음은 plan(“월급 체크리스트”), partner_change, care_30/14/7/0, money, goal, invite(제안·생활비 체크 토글은 재기획으로 없앰)
- 약관 재동의(A-05r, 20261103150000): `pending_terms()`(terms·privacy는 재동의 필요 승인 버전이 KST로 시행됐고 그 버전 동의가 없을 때, marketing은 마지막 기록이 받기이고 2년 지남), `agree_terms(p_marketing)`(consent_source `reconsent`). 앱은 `RequireAccount`가 남은 게 있으면 `/terms/update`로 보냄(못 읽으면 막지 않음).
- 파트너가 고친 목표 안내(옛 G-01, `recent_goal_changes()`)는 G-01과 함께 앱에서 안 씀(2026-11-08).
- 알림 채널(20261102180000): 앱이 켜져 있는 동안 5분마다 `touch_app()`(`app_user.app_seen_at`). `mail_missed_notifications()`(pg_cron `mail-missed-notifications` 10분마다): 푸시로 갈 알림인데 만들어진 뒤 10분 안에 접속 신호가 없으면 메일 한 통(`noti_mail_body`, 상한 6회, 월급 전 확인은 상한 밖), 보안·계정·문의(`noti_always_mail`: 연결 해제 요청·완료, 상대 계정 삭제·복구, 관리자 열람, 문의 답변, 새 기기 로그인)는 접속과 상관없이 바로(상한 밖). 방해 금지 시간에는 미뤘다가 끝나면. 보낸 알림은 `notification.mailed_at`.
- 계정 삭제 접수 메일(트리거 `deletion_mail`)·완료 메일(`purge_deleted_accounts`가 지우기 직전, `user_id` 없이) 상한 밖. 새 기기 로그인: 로그인 뒤 `note_login()`이 다른 세션이 있으면 본인에게 ‘새 기기에서 로그인했어요’ → S-15(메일도). A-08 ‘나예요 / 내가 아니에요’ 화면은 아직 없음 알림 링크는 `/new-device/{새 세션 id}`(A-08 `a-08-new-device.tsx`, 20261103090000): ‘나예요’ → 홈, ‘내가 아니에요’ → `end_sessions(그 세션)` → S-15 + Toast “{제공자} 계정 보안도 확인해 주세요”.
- 아직 없는 알림: 약관 개정 고지(AD-10 필독 공지와 메일), 마케팅 수신 동의 재확인 알림(재확인 화면은 A-05r)
- S-12 우리 둘 정보: 이름(시작한 사람 먼저) + 상태(연결됨, 초대 전·초대 중·합류하는 중·초대 만료(settings `invite-state.ts`), 연결 해제 대기 중, 혼자 쓰는 중), 결혼 예정일(예비부부, D-day 알약)·결혼일(신혼, 보기만). 미합류면 가장 최근 초대 코드(api `fetchLatestInvite`, `invite` 테이블을 우리 둘 공간 사람만 읽음, `reservedUntil`)로 초대 전(“초대하기” → `create_invite`, `?invite=1`이면 바로) / 초대 중(O-07과 같은 `shared/invite-share.tsx` 코드 상자 + 링크 복사 + 카톡으로 보내기, “10월 22일까지”, 새 코드 받기) / 합류하는 중(‘초대 취소’ → Modal → `cancel_invite`) / 만료를 나눔. ‘받은 초대 코드가 있어요’ → `/i`(state `from`). 다시 연결하기는 `my_reconnect_ok()`가 true일 때만. 새 코드 받기 `renew_invite`는 쓸 수 있는 코드를 모두 지금 만료로 바꾸고 새로 만듦
- 연결 해제 요청(S-12a → S-12c): `couple_unlink`(공간당 대기 1개, 쓰기는 함수로만). S-12a는 지울 것 목록과 ‘먼저 내보내기’(S-18), S-12c는 “연결 해제” 입력이 맞아야 버튼이 켜짐. `request_unlink('연결 해제')`가 기한(오늘 + 14일)과 함께 저장하고 해제 대기로 바꾼 뒤 상대 알림 `unlink_requested`(→ S-12d). 자산 몫·정리 안 없음(`plan` = `[]`). `cancel_unlink`는 요청한 사람만. 대기 중엔 `save_split`·`set_salary_mode`·`set_joint_cycle_day`가 `unlink_pending`으로 거절, S-12 대기 묶음(“{날짜}에 해제돼요”, 요청 보기)
- 연결 해제 확정 `finish_unlink(id, how)`(내부): S-12d 받은 사람 ‘확인했어요’ → `agree_unlink`(how `agreed`), 또는 매일 오전 9시 `run_unlink_deadlines`가 기한 날 대기 요청을(how `deadline`, 2일 전 알림은 없앰). 같이 쓰던 데이터는 나누지 않음: 두 사람이 각자 빈 새 공간(혼자 쓰기, `unlinked_from` = 원래 공간)으로, `onboarding_step = 'S-12H'`, 원래 공간은 지운 표시로 30일 보관(구성원이 없어 아무도 못 봄), 원래 공간의 알림 기록은 지움. 알림 `unlink_confirmed`. 홈은 S-12H면 S-12h `/settings/couple/unlinked`로, ‘시작하기’ `start_after_unlink()` → 온보딩 O-11부터(이름·로그인은 남김). 분석 `unlink_requested`(`linked_months`), `unlink_resolved`(agreed, canceled. deadline은 서버)
- 다시 연결(S-12g): 확정 뒤 30일 안, 두 사람이 모두 해제로 만든 공간에 혼자 있을 때(`reconnect_ok`). `request_reconnect` → 상대 알림 → `answer_reconnect(true)`면 원래 공간으로 돌아가고(`onboarding_step = 'O-60'`) 해제 뒤 새 공간에 만든 데이터는 버림(새 공간 지움), `false`면 요청만 닫힘. 혼자 쓰기 ‘새로 초대하기’ `start_new_invite`. 매일 `purge_unlinked_spaces`가 30일 지난 원래 공간을 지움. 해제 뒤 상대 호칭은 `unlink_partner_name()`. 행 타입 하나만 받는 SQL 함수는 PostgREST가 계산 열로 보여서 타입이 깨지므로 id로 받음
- 공개 범위(S-13 `/settings/visibility`): `app_user.default_visibility`(내 자산·부채 새 항목 기본값, 기본 금액만 보여 주기)를 F-03·첫 주 자산 입력이 씀. 바꿀 때 기본값과 다른 내 명의 항목이 있으면 “이미 있는 항목 n개도 바꿀까요?”. 다시 연결하면 `?next=/`로 한 번 열고 ‘확인’ 이름은 “모두 보여 주기 / 금액만 보여 주기 / 숨기기”(값 all / sum / private), 고정 줄 “월급과 월급 계획은 늘 같이 봐요” 등
- 휴지통(S-21 `/settings/trash`, 지금은 S-10 ‘데이터’ 줄에서): `trash_rows()`(자산·부채, 저금 항목, 경조사.(가족은 20261101180000에서 지움) 30일 안, 파트너 명의·남의 서프라이즈 빼고), `restore_trash`(같이 지워진 것도 함께: 부모와 10초 안에 지운 자식), 연결된 두 사람의 목표는 `needs_proposal` → 제안 `goal_restore`. `purge_trash`(하나 또는 비우기), 매일 `purge_old_trash`. 확인은 ui `Modal`(영구 삭제만), Button `danger` 재기획(20261030150000): 연결된 두 사람의 목표도 제안 없이 바로 되살림, 파트너의 저금 항목은 휴지통에 안 보임. `restore_trash`는 저금 항목인데 공간의 월급 계획 중 넣을 것이 없어 저금 줄 없이 되살렸으면 `'unlinked'`(앱 Toast “연결된 항목이 없어 따로 되살렸어요”, 20261127090000)
- 데이터(S-18 `/settings/data`): 내보내기는 앱에서 만듦(api `fetchExportData` → `features/settings/export.ts` → core `toCsv`(BOM, CRLF), `makeZip`(압축 없는 zip)). 범위 내 데이터 / 공동 데이터, 파트너 항목은 RLS가 거른 뒤 ‘합계만’은 합계 한 줄. 파일 이름은 영문(`sweetwo-joint-20261018.zip`). 형식 엑셀(CSV) / PDF 요약: PDF는 `features/settings/export-pdf.ts`(`buildPdfModel` → `renderPdf`, pdf-lib + @pdf-lib/fontkit, 처음 쓸 때만 불러옴). 한 파일에 자산 요약 + 연간 요약 두 쪽, 계산은 core `netWorth`·`netWorthSeries`·`yearlySavings`·`savingEta`. 글꼴은 가변 글꼴·woff2를 못 넣어서 `packages/app/src/assets/pdf-fonts/SUIT-{Regular,Bold}.ttf`(SUIT에서 400·700만 뽑음, `python3 scripts/pdf-fonts.py`, OFL), 색은 tokens.css 라이트 값을 화면에서 읽음. PDF는 글꼴을 통째로 넣어 0.5MB쯤(pdf-lib 부분 넣기가 이 글꼴에서 글자를 빠뜨림). 저장: 브라우저(개발·e2e)는 내려받기, 모바일 앱은 브리지 `saveFile` → @capacitor/filesystem 캐시 + @capacitor/share 공유 창. 본인 확인: 모바일 앱 PIN(있으면, 5번 틀리면 `signOut({ forgetPin })` → A-02 `lockedOutState` 안내, S-15·A-06과 같음), 웹과 앱 잠금이 꺼진 모바일 앱은 `reauthenticate(returnTo)`로 가입 소셜 다시 로그인 → `?export=범위&format=형식`으로 돌아와 이어서(2026-11-12 QA 11구간 S11-02·07). S-18b ‘먼저 내보내기’는 `?from=delete`(다시 로그인을 거쳐도 남게 주소에): 뒤로와 내보내기 끝 = S-18b. 분석 `data_exported`. 사용 기록 보내기 = `app_user.analytics_off`
- 계정 삭제(S-18b `/settings/data/delete`): `request_account_deletion`은 다시 로그인한 지 10분 안에만(`reauth_required`면 `reauthenticate('/settings/data/delete?go=1')`). 바로 이용 중지(status). 연결·해제 대기면 연결 해제 확정처럼 같이 쓰던 데이터를 모두 지움(위 참고, 상대 알림 `partner_deleted`). 30일 안 다시 로그인하면 A-02 `/account/restore` “계정 삭제를 취소할까요?” → `cancel_account_deletion`(빈 혼자 쓰기, 그때부터 30일 다시 연결, 상대 알림 `partner_restored`). 매일 `purge_deleted_accounts`. 접수하면 그 사람의 로그인 세션을 모두 지움(`auth.sessions`, 갱신 토큰은 세션과 함께, 2026-11-12 QA 11구간 S11-05: 다른 기기도 바로 로그아웃)
- 문의·도움말(S-19 `/settings/about`, S-20 `/settings/help`, S-19a `/settings/help/inquiry`·`/inquiries/:id`, S-19b `/settings/help/access/:id`): `inquiry`(번호 `A-10001`부터 서버 발급, 자동 첨부 키는 서버가 거름), `inquiry_message`(사용자·운영자 대화), `access_request`(L2 열람: 본인만 동의, 24시간, 파트너 알림 `access_partner`, 끝나면 `access_done`, 매시간 `run_access_expiry`). 운영자 쪽 답변·요청 만들기는 어드민 단계. FAQ 원본은 `apps/site/src/content/faq.md`(웹사이트와 같이 씀), `pnpm content:sync`로 `packages/app/src/content`에 복사, core `parseFaq`·`searchFaq`. ui `Accordion`, `Search`
- 보안(S-15 `/settings/security`): 앱 잠금(브리지 lock: `clear`는 1분 안에 `verify`가 통과했을 때만, `setAutoLock` 0·1·5·15분, 기본 5분), PIN 바꾸기 = 현재 PIN 확인 → A-06 `?next=/settings/security`. 로그인된 기기 = `my_sessions()`(auth.sessions, 지금 기기 = 토큰의 session_id), `end_sessions(id)` / `end_sessions()`(이 기기 빼고 모두). 기기 이름은 core `deviceLabel(user_agent)`(모바일 웹뷰 User-Agent의 `sweeTwo`, iPad 웹뷰는 Mac처럼 알려 줘 iOS로 봄)
- 트레이 위젯(26)과 위젯 설정(S-22)은 데스크톱과 함께 없앰(2026-11-10, ADR 0008). 홈 화면 위젯 v1(WG-01 같이 모으기, WG-04 다가오는 날)은 2026-11-13 PR 13(‘모바일 네이티브 v2.2’), WG-02·03·05는 출시 뒤

### 파트너 합류 구조

- 기획: 18(재기획 2026-10-25). features/pairing
- 초대 링크 `/i/:code`(P-01, features/pairing)는 로그인 전에도 열림(A-01 공개 경로). `invite_preview(code, device)`(익명 가능)로 초대한 사람 호칭만 보여 줌. 2026-11-11 시도 제한(D2): 접속 주소(PostgREST `request.headers` cf-connecting-ip → x-forwarded-for → x-real-ip)와 기기 값(api가 localStorage `sweetwo.inviteDevice`에 한 번 만든 임의 값)을 sha256으로 `invite_guard_attempt`에 남기고 10분 상한(미리보기 접속 주소 40, 기기 20 / 합류하기 사람 10(`invite_attempt`, 모든 시도), 접속 주소 30)을 넘으면 ‘locked’. 함수 `invite_guard_hit`, `client_ip_key`(20261119100000)
- ‘합류하기’: 로그인 전이면 `prefs.returnTo = /i/{코드}?go=1`을 남기고 A-02로. 로그인(기존 계정) 또는 가입(A-05) 뒤 그 주소로 돌아와 바로 `join_space()`
- `join_space()`(2026-11-11 D1, 20261119090000): 공간에 넣지 않고 코드를 이 사람 몫으로 24시간 잡아 둠(`invite.reserved_by`, `reserved_until`, 다시 열면 ‘resume’). 내 줄만 미리 채움(반대쪽, 시작한 사람이 적은 호칭·월급). 잡아 둔 동안 공간 데이터는 RLS로 못 읽고, 합류 화면은 `join_context()`(jsonb: 시작한 사람 호칭, 관리 방식, 월급 계획 있는지, 대신 입력한 내 명의 항목, 합쳐서면 공동 월급 계획 줄·버전·저금 항목) + api `fetchJoinContext`(core `JoinContextSchema`)만 씀. `joining_space()`는 구성원(예전 방식, 대기 뒤 이어서) 또는 잡아 둔 코드의 공간. 공간 2명 상한: RPC 검사 + `app_user` 트리거 `app_user_space_cap`. 시작한 사람 ‘초대 취소’ = `cancel_invite()`, 새 코드 `renew_invite()`도 잡은 것을 풂(`_release_invite`, 예전 방식 미완료 구성원은 `_detach_pending_member`로 내 명의 항목과 함께 혼자 공간으로). 연결 해제 대기 중이면 ‘already_connected’. 혼자 시작한 기록이 있으면 ‘has_records’ → “이미 시작한 기록이 있어요” 합류하기 / 취소 → P-02a(`p-02a-move-records.tsx`, P-01 안 단계): 월급·월급날과 내 명의 자산·부채(공개 범위 고르기, 기본 금액만)만 `join_moving_records(code, vis)`로 잡아 두며 고른 공개 범위는 `invite.reserved_vis`에 기억, 옮기기는 합류를 마칠 때 `_accept_join`(2026-11-11). 저금 항목·월급 계획·체크리스트는 안 옮김, 원래 공간은 `deleted_at` 표시 뒤 30일 지나 `purge_left_spaces`(매일)가 지움. ‘사본 내려받기’ → S-18
- 두 사람 기준은 core `rules/couple.ts`(`coupleOf`): 합류 전 파트너 = 시작한 사람이 적은 호칭만(수입은 모름, 추정·분담 비율 없음, 08 9장), 합류 뒤 = `partner_profile()`. 기본 기준일 = 두 월급날 중 늦은 날. 아바타 색은 시작한 사람 1, 합류한 사람 2
- `join_space()`가 정하는 첫 화면: 시작한 사람이 대신 입력한 내 명의 자산·부채(owner person + 주인 없음)가 있으면 P-02b, 아니면 P-03
- 합류 화면 `/join/:screen`(진행 막대는 그 흐름 화면 수, ‘나중에 할게요’ 없음): (P-02b) → P-03 이름 → P-04 관리 방식 확인 → P-05 월급 → P-05b 월급날 → P-10 합류 축하(`QuestionLayout celebrate`) → (P-11 푸시) → 홈. 잡아 둔 코드가 풀렸으면 `JoinRoute`가 ‘합류가 끝난 초대’ 안내. 멈춘 화면은 `app_user.onboarding_step`(OnboardingGate가 이어서 엶). 뺀 화면(P-03a 출생연도, 2026-11-11)은 pairing `JOIN_REMOVED`·`movedJoinScreen`이 그 흐름의 다음 화면으로 옮김(기본 P-04, 시작한 사람이 온보딩 중이면 P-05). 출생연도는 F-08 ‘출생연도 알려 주기’ → S-11i
- P-02b: ‘확인하고 이어 쓸게요’ = 동의 기록(소유는 합류를 마칠 때 넘어감), ‘지우고 새로 입력할게요’ = `discard_prefill()`(그 항목 휴지통)
- P-04: 바꾸면 `set_join_salary_mode(mode)`가 바로 적용(각자 → 합쳐서 = 시작한 사람 월급 계획·체크리스트가 공동 것, 반대는 시작한 사람 것) + 시작한 사람 알림 `salary_mode`. 다른 방식을 고르면 `QuestionLayout note`로 결과 한 줄, ‘다음’은 ui `Modal tone="primary"` 확인 뒤 적용(2026-11-09 round 3)
- P-06(salary `SplitEditor`, `steps`·`noteOf`·`incomeSub`): 각자 = core `joinerSplit`(고정·생활 25%, 용돈 10%, 저금 줄 없음: 저금 항목은 그 사람이 월급 탭에서 직접, ADR 0007). 합쳐서 = core `jointRefill`(있던 줄은 그대로, 내 용돈 10% + 늘어난 수입을 목표 금액이 있는 저금 줄 순서대로 월 필요액까지), 바뀐 줄 “95만 원 → 246만 원”
- 합류 완료 = `complete_join(줄, 버전)`: 먼저 `_accept_join`으로 공간에 넣음(2명 검사, 혼자 쓰던 공간의 내 명의 항목 옮김·원래 공간 정리). 각자 = 내 월급 계획 + 첫 체크리스트, 합쳐서 = 공동 월급 계획 저장(열 때 버전과 다르면 `split_changed` → “찬우님이 방금 월급 계획을 바꿨어요” 후 다시 계산) + 이번 체크리스트 맞춤. 우리 둘 연결, 코드 사용됨, 대신 입력 항목 소유 넘김, 시작한 사람에게 “예빈님이 합류했어요 / 이제 월급을 같이 봐요”
- 시작한 사람이 아직 온보딩 중(공간에 월급 계획 없음): P-03 → P-05 저장 = `complete_join()`(줄 없음, `onboarding_step = 'P-WAIT'`) → 홈 대기(“{찬우}님이 시작하고 있어요”). 시작한 사람이 온보딩을 마치면 트리거가 “월급 계획을 만들었어요”(`first_goal`, → `/join/p-04`, 2026-11-08 문구), 홈은 월급 계획이 생기면 P-04 → P-06으로(합쳐서면 확인만)
- 재기획 전 코드: `update_pending_shares`, `notify_first_plan`은 20261101180000에서 지움. `finish_join`은 앱이 안 쓰지만(합류는 `complete_join`) pgTAP 준비용으로 남김

### 저금 항목 구조

목표 탭과 ‘목표’ 개념은 없앰(2026-11-08, `docs/adr/0007-goal-into-saving-line.md`). 목표는 월급 계획 저금 줄(저금 항목)의 선택 ‘목표 금액’(+ 선택 기한)으로만 씀. 기획: 20 W-10~W-12, 계산은 06 4~5장.

- 행은 그대로 `goal` 테이블(이름 바꾸기 없음, 스키마는 추가만). 20261112090000에서 `goal.closed_at`(그만 모음) 추가. 템플릿·우선순위·이미 모은 금액(`other_held`)·`goal_move`·`kind`(매년·매달)·사진은 열만 남고 앱이 안 씀. 새 항목은 `template = 'custom'`, `kind = 'once'`
- 주인: 각자 모드 = 그 사람(`owner_user_id`, 그 사람 월급 계획에만 줄, 파트너는 보기만), 합쳐서 모드 = 우리 둘(`owner_user_id` null, 공동 월급 계획). 관리 방식을 바꾸면 `set_salary_mode`가 줄과 주인을 옮김(합쳐서 → 각자: 저금 항목 줄은 통째로 주인, 없으면 만든 사람)
- 경로(salary `paths.ts` `savingPaths`): W-10 `/salary/items/:id`, W-10a `/salary/items/:id/edit/name|amount|deadline|monthly`(`?first=1`이면 목표 금액 뒤 기한으로, `monthly` = 이 줄 매달 금액만 바꿔 `saveSplit`(그 항목이 있는 월급 계획 초안에서 이 줄만) + 되돌리기 2026-11-09 round 3, `amount?retarget=1` = W-12a 새 목표 금액 `retargetSavingItem` → 기한), W-11a~d `/salary/items/new/:step?`(`?from=home|salary|salary_row|salary_wide|split|palette|list|add_menu|shortcut`, 없으면 direct, 2026-11-12 S7-16. 입력값은 기기 `sweetwo.savingDraft`, salary `saving-draft.ts`가 `onSessionReset`으로 로그아웃 때 지움, S7-06. 월급 계획이 없거나 해제 대기 중이면 W-02 + Toast, S7-15), W-12 `/salary/items/:id/achieved`, W-12a `/salary/items/:id/after`, W-13 저금 목록 `/salary/items`(`?from=checklist|split|home`, 2026-11-09 round 3, 줄은 `SavingGoalRow`를 홈 H-02와 같이 씀). 옛 `/goals` → `/salary`, `/goals/:id…`(uuid) → W-10
- Realtime(2026-11-12 S7-02): 월급 탭은 `useGoalRealtime`, W-10·W-13은 `useSavingRealtime`(goal + pay_check_line + salary_split). 체크 뒤 `refreshChecks`는 저금 내역 키(`['pay_check_line']`)도 다시 읽음(S7-03). 못 불러오면 W-10·W-13 `SavingLoadError`, W-10a·W-12·W-12a `SavingQuestionError`(salary `saving-parts.tsx`, S7-04)
- 화면 값은 salary `saving.ts`(`useSavingItems`) 한 곳: 모은 금액(서버 `goal_saved_sums()` = 시작할 때 모은 금액 + 그 항목 체크한 저금 줄 합), 매달 금액(보이는 월급 계획의 그 항목 줄 합), 진행·막대·월 필요액·예상·늦어짐(core `rules/saving-item.ts` `savingPct`·`savingBar`·`savingNeed`·`savingEta`·`savingLate`), 상태(`savingState`: saving / achieved / closed), 주인(mine / partner / ours), 고칠 수 있는지(`mayEdit` = 각자 내 것, 합쳐서 모두(‘금액만 보여 주기’ 파트너 것 빼고, D1) / `canEdit` = mayEdit + 해제 대기 아님), 이번 달 줄. 합쳐서 + 연결이면 저금 고치기마다 `trackSharedGoal`(shared_item_changed goal) 순서 내 것 → 파트너 것 → 우리 둘 것
- 추가 = RPC `add_saving_item(이름, 매달, 목표 금액?, 기한?, 시작값?)`(1만 원 단위, 시작값은 목표 금액보다 적게 `bad_start`, 해제 대기 `unlink_pending`, 월급 계획 없음 `no_split`. 20261113120000에서 시작값 인자를 더해 4개짜리는 지움). 시작값은 W-11c ‘이미 모은 금액이 있어요’ 체크로 켜는 두 번째 `AmountInput`(embedded), `grant update` 열에 없어 앱이 나중에 못 고침, W-10 저금 내역 맨 아래 ‘시작할 때 모은 금액’: 행 + 내(합쳐서면 공동) 월급 계획 저금 묶음 맨 아래 줄 + 이번 사이클 체크리스트 줄(`sync_checklist`). 이름·목표 금액·기한·휴지통은 api `updateGoal`/`trashGoals`로 바로(Toast ‘되돌리기’, 합쳐서면 파트너가 1분 안에 같은 칸을 바꿨을 때 `ConflictChoice`). 매달 금액은 W-01에서만
- 저금 줄 맞추기: DB 트리거 `goal_lines` → `goal_lines_sync`(안 지웠고 그만 모으지 않은 항목만 줄, 빼면 금액을 `freed_lines`에 두고 다시 모으면 그 금액으로). 달성해도 줄은 그대로
- 달성: `AchieveWatch`(salary `saving-parts.tsx`, 홈·W-02·W-10)가 고칠 수 있는 항목의 모은 금액 ≥ 목표 금액이면 `achieve_goal`(목표 금액이 있고 닿았을 때만, 알림 “{이름} 목표 금액을 다 모았어요!” → W-10) 후 사람마다 한 번 W-12(한 번에 한 항목만: 축하로 넘어가는 동안 다른 항목은 서버에 ‘봄’으로 남기지 않고, 홈·월급 탭을 다시 열 때 한 번씩, 2026-11-09 round 3). W-12a = `saving_item_keep`(목표 금액·기한만 지움, 되돌리기 `saving_item_unkeep`) / `saving_item_stop`(`closed_at`, 줄 빠짐, 되돌리기 `saving_item_reopen`) / ‘목표 금액을 새로 정할게요’ → W-10a `saving_item_retarget`(20261114090000: 달성·고르기 전만, 모은 금액보다 큰 새 목표 금액, 기한 지움, 모으는 중, 지난 달성 알림은 dedupe 키만 바꿔 남김 → 새로 닿으면 알림 한 번 더, 되돌리기 `saving_item_unkeep`). W-12 ‘다음’은 `hideToast()`로 1.5초 막기를 풂. 고르기 전에는 W-10에 같은 질문 카드. 축하로 넘어갈 때 `hideToast(1500)`(shared/toast)로 체크 ‘되돌리기’ 토스트를 닫고 1.5초 동안 늦게 오는 토스트도 막음. 고르기 전에 체크를 풀거나 못 함으로 바꿔 모은 금액이 목표 금액 아래로 내려가면 `check_pay_line`이 `saving_unachieve`로 ‘모으는 중’ + 달성 알림 지움(20261113090000), 앱은 다시 닿으면 한 번 더 축하
- 기한은 그 달(저장은 1일), 뜻은 그 달 말일(core `deadlineDay`, 캘린더·홈 일정). 남은 개월은 기한 달 포함(`monthsLeft`), 예상 달성은 이번 달이 1개월째(`savingEta`), 월 필요액 > 매달 금액이면 `savingLate` 개월(W-10·W-11d 사실 한 줄, 2026-11-09). W-11b 매달 금액은 빈 칸 + ui `AmountInput quickSet` 칩(core `quickChips.monthly`), W-11d 처음 값 `defaultDeadline`(1년 뒤)
- 파트너 알림·활동 기록(`goal_partner_change`, 20261112090000): 우리 둘 항목(합쳐서) 바꾸면 상대 알림, 각자 모드 내 항목은 알리지 않음(달성만). 제목 “{이름} 저금을 바꿨어요”(2026-11-09 사용자에게는 ‘저금’, 20261113120000)
- 첫 저금 빈 줄(2026-11-09): salary `useFirstSaving()`(내 저금이 없을 때: 각자 = 내가 주인인 살아 있는 항목, 합쳐서 = 아무 항목. 여유 자금은 내·공동 월급 계획 기준, 파트너에게 저금이 있으면 `partnerName`) + `FirstSavingRow`(W-02 저금 묶음, 홈 H-03 카드 맨 위 `SalaryCard firstSaving`) → W-11a
- 각자 모드 파트너 것 보기만(2026-11-09): W-01 파트너 탭(위), W-02 파트너 탭 회색 한 줄 `partnerChecklistView` + ui `TransferRow viewOnly`(`is-view`, 체크한 줄 취소선 없음), W-10 `partnerItem`. 서버는 `save_split`·`check_pay_line`(not_owner)·goal RLS·`saving_item_editable`
- 합쳐서 모드 주인 있는 저금(2026-11-12 D1, 20261123090000 `s7_saving`): 두 사람 모두 고치고 체크·축하. 주인 이름은 줄 이름 앞 표시만. `saving_item_editable`·goal `goal_update` 정책은 합쳐서 공간이면 ‘모두 보여 주기’ 주인 있는 항목도 허락(‘금액만 보여 주기’ 파트너 것은 표를 못 읽어 보기만), `goal_owner_guard`(앱이 바로 바꿀 때 주인은 나 ↔ 없음만), `achieve_goal` 링크는 두 사람 모두 W-12, `goal_partner_change`는 같이 쓰는 저금이라 상대 알림·활동 기록. 앱 `saving.ts` `canEdit`
- 연결 해제 대기 중 goal 바로 고치기·지우기 거절(S7-05 `goal_unlink_guard`, 공개 범위만 허락, 함수 안은 그대로). goal은 Realtime 발행(S7-02, api `subscribeGoals`)
- 공개(20261101233000, 20261112090000): 앱은 `space_goals()`로 읽음. 파트너 항목이 ‘금액만 보여 주기’면 이름 “개인 저금”으로 가려 줌. 설정은 S-13 ‘내 저금 항목’
- 데이터 옮기기(20261112090000): 비상금은 체크한 기록이 있으면 목표 금액 없는 항목, 없으면 지움. 매달 목표는 목표 금액을 지움, 모두 `kind = 'once'`, 지연 → 진행, 보류·다 씀·달성 → 그만 모음. 각자 모드의 우리 목표는 시작한 사람 것 + 다른 사람 몫 복제(줄·체크 줄 다시 연결)
- 지운 화면(2026-11-08, 번호 다시 쓰지 않음): G-01, G-02, G-02a·b·p, G-03a~g, G-05, G-06, O-21, O-23, O-24. 옛 G-04·G-07·G-08은 2026-10-26에 지움
- 자산 순위(20261110140000, ADR 0006): 계산은 core `rankTopPct`·`rankState`(계산·배분 7-7, 2025 가계금융복지조사 순자산 분위 경계값 `RANK_BASIS.points`, 0원 아래만 2024 구간 분포). 연령대 비교는 core `rankAgeBand`(두 사람 출생연도 평균) + `RANK_AGE_MEDIAN`(연령대별 중앙값, 순위 없음), 파트너 출생연도는 DB 함수 `partner_birth_year()`(api `fetchPartnerBirthYear`, 키 `qk.partnerBirthYear`), 앱 훅 frame `useRankAge`(2026-11-13 PR 12에서 없앰, 연령대 비교 문장을 없앰). 그 밖에 core `rankNextStep`(다음 10% 칸까지), `rankChange`(지난달 월말 순자산으로 다시 계산), `debtRatioPct`, `financialPct` + `RANK_AGE_STATS`(연령대 부채 비율, 금융자산 비율). frame `useNetWorth`가 `prev`, `financialPct`도 돌려줌. 본 값은 사람마다 `app_user.rank_month`(그 달 1일)·`rank_pct`·`rank_net`에 저장(본인 행만, `updateMe`). 줄은 frame `RankBanner`(F-01 맨 위, 홈 자산 관리 H-04 바로 위), 레포트는 `/assets/rank`(F-08, ui `Distribution`). 광고는 브리지 `window.sweetwo.ads.rewarded()`(모바일 AdMob 보상형, 'rewarded'·'closed'·'failed'). 브리지가 없으면(개발 브라우저) 광고 없이 바로, 'closed'면 Toast만, 'failed'면 광고 없이 바로. 모바일 AdMob 플러그인은 PR 13(`@capacitor-community/admob`, ‘모바일 네이티브 v2.2’). 운영 앱 ID·광고 단위 ID는 아직 없음(사람이 AdMob 계정을 만들어 넣음, 그때까지 개발은 테스트 광고, 운영은 광고 없이 바로). 분석 이벤트 `rank_banner_tapped`, `rank_ad_result`, `rank_viewed`
- 자산 v2.2 앱(PR 12, 23 ‘자산 관리 v2.2’): 순자산은 frame `netWorthOf`(core `netWorthSummary`에 보이는 행 중 숨기기를 빼고 파트너 ‘총액만’ 합계를 더함, 평가금액 기본 `net` + ‘원금으로 보기’ `principalNet`)와 `netWorthTrend`(월말 기록 `expected`/`net`에서 고른 기준). 서버 `networth_summary()`는 숨기기를 빼지 않고 파트너 합계도 더하지 않아 화면은 아직 쓰지 않음. 순위는 frame `useRank`(api `fetchRankPair` `qk.rankPair` pair/peer, `fetchRankViewed` `qk.rankViewed`, 저장 순위 `rank_month`·`rank_pct`·`rank_net`은 서버 `record_rank_view`만 씀, 앱이 `updateMe`로 쓰지 않음), `homeBadge`(pair + `rank_badge_home`, 기본 끔). 첫 결과는 F-08이 `recordFirstRank`(광고 없음), ‘새로 확인하기’는 `refreshRankWithAd`(rewarded → `record_rank_view(true)`, failed·브리지 없음 → 기록 없이 `networth_rank_pair` 값만, closed → Toast). 서버 `basis = 'all'`이면 “전체 가구 기준이에요”(연령대라고 쓰지 않음). F-08c `/assets/rank/consent`(보내기)·`/assets/rank/consent/:id`(받기, 서버 알림 링크). F-03q `/assets/quick`, F-03e 공용 `features/assets/pages/f-03e-share.tsx`(`asset_share_default`가 null이면 미리 고른 값 없음, 고르면 `setAssetShareDefault`). e2e 흉내: mocks/app-db `db.rank`(pair, topPct, views, requests), fake-bridge `ad`(rewarded / closed / failed / throw). 남은 것: `asset.quick` 열 없음(DB), 운영 AdMob ID(사람)

### 자산 관리 구조

- 기획: 23 F-01~F-04, 09 6-5·6-6(분류, core `assetGroups`), 08 2·4장(명의, 공개 범위). 화면 features/assets: F-01 `/assets`, F-02 `/assets/items?side=asset|debt`, F-03 `/assets/new/:step?`, F-04 `/assets/:id`, F-04a `/assets/:id/matured/:step?`. 하위 탭은 “요약” “자산·부채” 2개, 기기에 기억
- `asset`: 자산과 부채를 한 표(`side`). 명의 = `owner` 공동(joint) / 사람(person + `owner_user_id`). 합류 전 파트너 명의 대신 입력 = person + `owner_user_id` null(모두 보여 주기만), `finish_join()`이 합류한 사람에게 넘김. 합류 뒤 상대 명의 새로 만들기는 RLS가 거절
- 공개 범위(`visibility` all / sum / private = “모두 보여 주기” / “금액만 보여 주기” / “숨기기”, 새 내 항목 기본 = 금액만)는 서버에서 거름(31 보안): 행은 `asset_visible()`(공동, 모두 보여 주기, 내 명의, 내가 대신 입력한 것)만. 파트너 ‘금액만’은 `partner_asset_sums()`가 묶음별 개수와 합계만, ‘숨기기’는 아무것도 안 줌. 고치기는 `asset_editable()`
- 금액 이력 `asset_history`: 금액·원금이 바뀔 때 트리거가 기록(앱은 못 씀). `source`(2026-11-12 QA 8구간 D3, 20261124090000): 처음 적은 값 `created`, 직접 고친 것 `manual`, 팔았어요 `sell`(`sell_asset`), 만기 정리 `matured`(`settle_matured`), 옛 월말 정리 `close`. 함수는 `sweetwo.asset_source` 설정으로 정하고 끝나면 비움. 수정 내역(F-04 5번)은 `manual`만
- 명의 잠금(S8-03, `asset_client_guard`): 앱이 바로 고칠 때 `owner`·`owner_user_id`·`created_by`·`space_id`는 못 바꿈(`not_owner`). RLS update는 새 행만 봐서 공동 자산을 내 명의로 가져갈 수 있었음. 합류 넘김(`finish_join`), 연결 해제·다시 연결 같은 함수 안(security definer)은 그대로
- Realtime(S8-06): asset은 발행에 있음(읽기 권한은 `asset_select` 그대로라 상대 ‘금액만’·‘숨기기’ 행은 신호도 안 감).
- 순자산: core `netWorth`(원금 기준, 예상 = 평가금액 기준, 숨기기·판 항목 빼고 파트너 금액만 더함). 저금 항목 모은 금액은 더하지 않음. 월말 순자산 `net_worth_history(개월)`
- 하위 탭 기억(2026-11-12 S8-10): frame `assets-tab.ts` `rememberAssetsTab`(AssetsFrame)·`lastAssetsTab`(사이드바 탭, 메뉴 서랍, 홈 H-04 타일, Ctrl(⌘)+3, F-04에서 항목이 없을 때)
- 앱 Realtime(2026-11-12 S8-06): frame `useAssetRealtime`(api `subscribeAssets`)이 `qk.assets`·`partnerAssetSums`·`netWorthHistory`를 다시 읽음. assets `useAssetsData`(F-01~F-04)와 홈에서
- 응답 검사(2026-11-12 S8-19): api `fetchAssets`·`fetchPartnerAssetSums`·`fetchNetWorthHistory`·`fetchAssetHistory`는 core `schemas/asset.ts` Zod로. `updateAsset`은 `.select('id')`로 고친 행을 받고 0행이면(RLS가 거름) `AssetForbiddenError`, 서버 `not_owner`(42501)도 같음 → 화면은 13-8 “{파트너}님 항목이라 볼 수만 있어요”, 그 밖 실패는 13-10 “저장하지 못했어요”(S8-16)
- 금리·회차 입력(D5 = A, S8-12): core `parseRate`(0~30%, 소수 1자리)·`parsePaidCount`(0~999) 하나를 F-03·F-04가 같이 씀. 서버 check는 그대로
- 합계 표기(S8-02): `shared/mask.ts` `money`가 core `readWonCap`(999억 원 넘으면 “999억+”)
- F-01: 순자산 그래프(ui `LineChart`, 서버 `net_worth_history(120)` + 이번 달 지금 값, core `netWorthSeries`. 기간 탭 6개월·1년·3년·전체, 데이터보다 긴 기간 비활성, 고른 탭 기억 `sweetwo.networth-period`) + 자산·부채 합계(→ F-02)
- F-02: 묶음(F-03a 그룹) 안 정렬 칩(이름, 명의, 금액, 수정일, 기억 `sweetwo.asset-sort`), 줄 배지는 공개 범위(내 항목)와 ‘대신 입력’만, 파트너 금액만 줄(알약 ‘금액만’), 투자 묶음 줄 core `investSummary`
- F-03 유형별 질문(F-03f~h, 모두 ‘나중에 할게요’ 가능): 적금 = 만기일 → 월 납입액, 청약 = 납입 회차(`paid_count`) → 월 납입액, 보증금 = 계약 만기일, 부채 = 금리 → 월 상환액. 월 납입·상환액은 기록만(월급 계획과 연결 없음). 카드론·현금서비스·리볼빙은 끝나고 ‘목표 만들기’ Toast
- F-04: 금액 수정(만기일·월 납입액 등은 보기만, 아래 F-04 참고), 공개 범위(내 명의만), 삭제는 휴지통 + 되돌리기. 파트너 명의는 보기만. 저장마다 Toast ‘되돌리기’(고치기 전 값으로 `updateAsset`, `change_reverted` asset, 2026-11-12 S8-05). 분석 `fact_value_changed`(금액), `trash_restored`(삭제 되돌리기), F-03 `asset_added`(`?from=home|palette`, S8-07)
- F-04a 만기된 돈 정리(20261101090000): 만기일이 지난(오늘 포함) 내가 고칠 수 있는 자산(전세 보증금 빼고). a “만기된 돈은 어디로 옮겼어요?” 다른 통장으로 → 통장 고르기(현금성·예금·적금 중 내가 고칠 수 있는 것, 고르면 바로) / 다시 가입했어요 → 새 만기일(오늘 뒤). 서버 `settle_matured(항목, 통장 | 새 만기일)`: 통장 금액 + 만기 금액, 항목은 `asset_status` ‘matured’(만기 완료, `fetchAssets`·core `netWorth`에서 빠지고 지난 순자산 기록은 그대로)
- 재기획으로 화면에서 뺀 것: 통장 역할 배지, 목표 연결(F-03f2 빠지는 통장 `pay_from`, F-03i·F-04 `goal_id`), F-01 비상금 카드·이번 달 카드·이번 달 계획·월 정산 요약, F-06 재정 진단 탭. `asset.pay_from`·`goal_id` 열은 남겨 두고(스키마는 2단계로 지움) 새로 쓰지 않음
- 재기획으로 지운 화면(2026-10-26): F-05 월 수입·지출, F-05f 기간 수입, F-07 계획 다시 세우기, F-09 비상금 넣기·꺼내기, O-53 투자 원칙, 첫 주 O-34~47. 남은 옛 읽기: 통장(`account`)
- F-03 금액 ‘잘 모르겠어요’: 구간 칩(core `bands.goalAmount`, 중간값) → `asset.estimated`, 목록·상세에 ‘추정’ 알약, 금액을 고치면 사라짐
- F-04(20261102210000): 금액 그래프(달마다 마지막 기록, `LineChart`), 투자·부동산은 ‘시세 바꾸기’(금액 그 자리 수정)·‘팔았어요’ → F-04b~d `/assets/:id/sold`(받은 금액, ‘일부만 팔았어요’ 남은 평가금액, 받은 통장, 결과: 통장 +금액, 실현 손익 = 받은 금액 − 판 비율만큼 원금). 서버 `sell_asset`(다 팔면 `sold`, 전·월세 보증금은 거절 S8-15). 수정 내역은 직접 고친 것만 + 고친 사람(`asset_history.recorded_by`)
- 다음 단계: F-08(출시 후)

### 기능 하나 만드는 순서

1. 기획서에서 화면 ID, 요소 표, 문구, 예외를 확인
2. 마이그레이션: 테이블, RLS, 필요하면 DB 함수 → pgTAP 테스트 → `supabase gen types`
3. core: Zod 스키마와 계산 규칙 + Vitest
4. api: 쿼리 훅과 쿼리 키, Realtime 무효화 연결
5. app: copy.ts 문구 → 화면 파일 → routes.tsx에 등록
6. 분석 이벤트와 Playwright 흐름 추가, 다크 모드와 좁은 창 확인

### 환경 변수

- 저장소에는 `.env.example`(형식), `.env.development`(스테이징 공개 값), `.env.e2e`(가짜 값)만. 그 밖의 값은 `.env.local`, `.env.development.local`(커밋 금지). 비밀 값은 어떤 .env에도 넣지 않음
- 앱에 들어가는 값은 공개돼도 되는 것만(Supabase URL, anon key, PostHog 주소)
- service role, KMS, SES 키는 Supabase 비밀 값에만. 앱 코드에 들어가면 빌드가 멈춤(CI 검사)

### 코드

- TypeScript strict. `any` 금지, 서버 응답은 Zod로 검사
- DB 타입은 `supabase gen types`로 만들어 core에 둠. 손으로 고치지 않음
- ESLint + Prettier, 커밋 전 자동 실행(lint-staged)
- 이름은 위 ‘이름 규칙’ 표를 따름
- 금액 계산은 정수(원)만. 부동소수점 연산 금지, 나눠 떨어지지 않으면 계산·배분 탭의 반올림 규칙을 따름

### 브랜치와 리뷰

- main은 항상 배포 가능. 기능 브랜치는 `feat/`, `fix/`, `chore/`
- 커밋 메시지는 Conventional Commits (`feat: 월급 체크리스트 줄 동기화`)
- PR은 리뷰 1명 이상. DB 마이그레이션과 RLS를 바꾸는 PR도 같음(2026-11-04 2명 규칙 없앰, 대신 pgTAP 필수)
- 스키마는 추가만. 이름 바꾸기와 지우기는 2단계(새 컬럼 추가 → 최소 지원 버전이 예전 앱을 넘어선 뒤 예전 컬럼 제거)
- 큰 기술 결정은 docs/adr에 ADR 한 장으로 남김

### 테스트

- core 계산과 포맷: Vitest 단위 테스트. 계산·배분 탭의 예시를 그대로 테스트 케이스로
- DB 함수와 RLS: pgTAP. ‘파트너가 비공개 항목을 못 본다’ 같은 권한 테스트는 필수
- 화면 흐름: Playwright E2E. 두 계정(찬우, 예빈)으로 합류, 월급 체크, 파트너 체크리스트는 보기만(체크 칸은 누를 수 없음, 2026-11-03 대신 체크 없앰)
- 화면 e2e는 `vite --mode e2e`(apps/mobile/.env.e2e, 가짜 Supabase 주소)로 브라우저에 띄우고 `e2e/mocks/`(스펙은 `mocks/index.ts`에서만 가져옴, 파일마다 맡는 RPC 표는 그 파일 머리, 2026-11-13 PR 14 한 폴더로 모음)가 응답을 흉내 낸다. 앱이 Zod로 검사하는 흉내 응답은 `e2e/mock-shapes.spec.ts`가 core 스키마로 다시 확인(B1: 흉내가 서버와 다른 모양을 돌려 테스트만 통과하던 것). 실제 DB 규칙은 pgTAP이 맡음
- 테스트 데이터의 예시 이름은 찬우(시작한 사람), 예빈(합류한 사람)

### 테스트 세부

- 두 사람 흐름(합류, 충돌, 같은 줄 동시 체크): Playwright 브라우저 컨텍스트 2개로 찬우, 예빈을 동시에
- 모바일 네이티브 부분(로그인 창, 보안 저장소, 잠금, 푸시)은 e2e가 흉내 브리지(`mobile-app.spec.ts`)로, 실제 동작은 기기 빌드로
- 테스트마다 DB 초기화(seed 다시 넣기). 테스트끼리 데이터를 나눠 쓰지 않음
- 음력: fixture를 천문연구원 표와 대조
- 접근성: 화면마다 axe 검사(`e2e/axe.ts`(mobile, admin, site)의 `axe(page)`로. 브랜드 오렌지 위 흰 글자의 color-contrast만 예외), ‘동작 줄이기’ 켜고 한 번
- 디자인 시스템 컴포넌트: `/dev/ui` 컴포넌트 모음을 라이트, 다크, 좁은 창(375px)에서 열어 오류 없음, axe 위반 없음, 스크린샷(apps/mobile/e2e). 기준 이미지 비교는 화면이 안정되면 추가
- 링크 허용 목록은 Vitest(`packages/core/src/deep-link.test.ts`), 모바일 PKCE는 Vitest(`apps/mobile/src/native/pkce.test.ts`)

### 문구

- 버튼 말투(2026-11-03): 화면 맨 아래 주 버튼은 할 일을 ‘~하기’나 짧은 말로(“다음”, “시작하기”, “홈으로 가기”, “월급 체크하기”). 사용자의 대답이나 선택(보조 버튼, 선택지, 확인 대화상자 답)은 해요체(“나중에 할게요”, “나중에 고를게요”, “다시 연결할게요”).
- 화면 문구는 기획서 화면 요소 표의 “ ” 안 문장을 그대로. 해요체
- 쉬운 이름(2026-11-09): 사용자에게는 ‘지출’, ‘수입’, ‘자산 관리’(탭, 홈 H-04 타일도 ‘자산 관리’, 2026-11-12), ‘금융 일정’, ‘여유 자금’, ‘모은 금액’, ‘경조사’ 등. 옛 말(‘쓰는 돈’, ‘남는 돈’, ‘챙길 날’ …)은 쓰지 않음. 코드 이름·DB 열·경로·분석 이벤트 이름은 그대로. 표는 `docs/spec/README.md` ‘용어’
- 어드민은 해요체 대신 짧게(2026-11-06): 설명은 꼭 필요한 것만, 명사형·‘~됨’·‘~불가’. 사용자에게 가는 글(공지, 답변, 메일)은 해요체
- 문구는 기능 폴더마다 copy.ts에 모음. 한국어만 지원, 다국어 프레임워크 없음
- 오류 문구에 기술 용어와 오류 코드를 보이지 않음
- 사용자에게 ‘배우자’, ‘부부’라고 쓰지 않음(결혼하지 않은 커플도 씀). 상대는 애칭, 없으면 ‘파트너’. 두 사람은 앱 ‘우리 둘’, 어드민 ‘커플’(2026-11-06). 서버 알림도 애칭이 없으면 “파트너가 합류했어요”처럼(‘파트너님이’ 아님). 결혼 상태 선택지(예비부부, 신혼)와 결혼 준비 내용은 그대로

### 단축키

기준은 기획서 공통 4장(아래 표와 다르면 기획서가 우선). 넓은 창에서 키보드가 있을 때(키보드를 붙인 태블릿, 개발 브라우저). 휴대폰은 키보드가 없어 쓰지 않음.

| 동작 | 키 |
| --- | --- |
| 명령 창(검색 + ‘바로 하기’) | ⌘K / Ctrl+K |
| 탭 이동 | ⌘1\~4 / Ctrl+1\~4 |
| 새로 입력 | ⌘N / Ctrl+N |
| 잠그기 | ⌘L / Ctrl+L |
| 금액 가리기 | ⌘⇧H / Ctrl+Shift+H |

- 단축키 표는 packages/app/src/shared/shortcuts.ts 한 곳에, platform으로 나눔

### 개발 절차

완료 기준(Definition of Done): 아래를 모두 만족해야 PR을 합침.

- 테스트(Vitest, Playwright), RLS를 건드렸으면 pgTAP
- 문구는 기획서와 같음(copy.ts)
- 다크 모드, 좁은 창 확인
- 분석 이벤트 추가
- 접근성(axe, 키보드만으로 쓰기)
- 스테이징에서 Sentry에 새 오류 없음

템플릿과 리뷰

- PR 템플릿(.github/pull\_request\_template.md): 무엇, 왜, 마이그레이션 있음?, RLS 바뀜?, 스크린샷(라이트, 다크)
- ADR 템플릿(docs/adr/0000-template.md): 맥락, 결정, 고른 대안, 결과
- CODEOWNERS: supabase/는 DB 오너, packages/ui는 디자인 시스템 오너

새 개발자 첫날

- [ ] GitHub, Supabase(스테이징만), Sentry, PostHog 접근 받기
- [ ] ‘로컬 개발 환경’대로 앱 띄우고 찬우, 예빈으로 로그인
- [ ] 이 문서, 기획서 ‘기술·운영’, 디자인 시스템 README 읽기
- [ ] 작은 PR 하나로 리뷰와 배포 흐름 경험

## 보안과 개인정보

금융 정보를 다루므로 ‘모으지 않기, 국내에 두기, 두 번 잠그기’가 기본. 기준은 기획서 ‘보안·개인정보’ 탭.

- 모으지 않음: 계좌번호, 카드번호, 주민등록번호. 입력 칸에 들어오면 저장 전에 막음
- 국내 보관: Supabase, Storage, SES, S3 모두 서울. PostHog와 Sentry는 직접 운영
- 암호화: DB 전체 암호화 + 메모와 가족 정보는 Edge Function에서 AES-256-GCM, 키는 AWS KMS
- 토큰: access token은 짧게, refresh token은 기기별. 모바일은 Keychain·Keystore. 웹뷰는 엄격한 CSP(‘인증과 세션’)
- 잠금: PIN 6자리 + 생체 인증(iPhone Face ID·Touch ID, Android 지문), 5분 뒤 자동 잠금
- 로그: 금액, 메모, 이름을 남기지 않음. Sentry는 보내기 전에 걸러내기(beforeSend), PostHog는 금액을 구간으로만
- 비밀 값: 코드와 저장소에 두지 않음. Supabase 비밀 값과 GitHub Actions secrets만. service role 키는 서버 밖으로 나가지 않음
- 보관 기간: 휴지통 30일, 알림 90일, 변경 이력 13개월, 결제 기록 5년, 접속 기록 3개월. pg\_cron이 정리
- 탈퇴: 30일 유예 후 삭제. 우리 둘 상태에 따른 처리는 기획서 규칙 그대로

### 출시 전 확인

- [ ] RLS 테스트 전체 통과, service role을 쓰는 코드 목록 점검
- [ ] 모바일 웹뷰: 원격 화면 코드 없음, CSP, 앱 링크 확인 파일, 최근 앱 화면 가림(‘모바일 세션’, ‘잠금’)
- [ ] 마이데이터 사업 해당 여부, 금융소비자보호법 해당 여부 법률 검토 결과

### 로그와 분석

- Sentry: `beforeSend`, `beforeBreadcrumb`에서 키 이름으로 지움(amount, memo, name, email, token 들어간 키 전부), URL 쿼리도 지움
- Edge Functions 로그: 함수 이름, space\_id, 오류 코드, 걸린 시간만. 요청 본문과 복호화 값은 남기지 않음
- PostHog 공통 속성: platform(ios, android), app\_version, os, couple\_state. 사람은 익명 id로만
- 서버 이벤트(32 4-1 `source=server`)는 DB 표 `server_event`에 쌓아 두고(위 ‘지금 있는 테이블과 함수’), 분석 단계에서 PostHog로 보냄. ‘분석 수집’을 끈 사람 것은 처음부터 남기지 않음
- 금액은 구간으로만: 월 수입·생활비·고정지출·결혼 총예산·목표 금액·여행 경비는 기획서 데이터 항목 구간, 그 밖의 금액은 10만 미만 / 10\~50만 / 50\~100만 / 100\~300만 / 300\~1000만 / 1000만 이상(기획서 성공 지표 5장)
- ‘분석 수집’ 동의를 끄면 `analytics_off`: 기기에서 이벤트를 만들지도 보내지도 않음

## 배포와 운영

환경은 3개(로컬, 스테이징, 운영)이고, 앱은 스토어(App Store, Google Play)로만 배포함(데스크톱 직접 다운로드는 ADR 0008로 없앰).

| 환경 | 서버 | 용도 |
| --- | --- | --- |
| 로컬 | Supabase CLI(도커) | 개발, 테스트 |
| 스테이징 | Supabase 프로젝트 (서울) | PR 합치면 자동 배포, QA용 빌드 |
| 운영 | Supabase 프로젝트 (서울) | 태그로 배포, 업데이트는 단계 배포, 내부 테스트도 운영 사용 |

### 환경과 비밀 값

| 항목 | 로컬 | 스테이징 | 운영 |
| --- | --- | --- | --- |
| Supabase | CLI(도커) | sweetwo-staging(만들 예정) | sweetwo-prod(만들 예정) |
| OAuth 앱 | 개발용 | 스테이징용 | 운영용 |
| KMS 키 | 로컬 키 어댑터 | staging 키 | prod 키 |
| SES | Inbucket | 샌드박스, 허용 주소만 | 발송 제한 해제 |
| 정적 배포 | 없음 | Cloudflare Workers 정적 자산(develop): 앱 화면, 어드민, 웹사이트 | Cloudflare Workers 정적 자산(main): 어드민, 웹사이트 |
| 스토어 | 없음 | TestFlight, Google Play 내부 테스트 | App Store, Google Play |
| 푸시 | 없음 | APNs 개발 환경, FCM 스테이징 프로젝트 | APNs 운영, FCM 운영 프로젝트 |
| Sentry 프로젝트 | 끔 | 환경 태그 staging | 환경 태그 production |

- GitHub Environments: staging, production. production은 승인자 1명이 승인해야 배포
- 비밀 값마다 담당자와 교체 주기를 docs/secrets.md에(값은 적지 않음). 사람이 나가면 그날 교체
- Edge Function의 AWS 접근은 최소 권한 IAM 사용자(KMS Encrypt/Decrypt, SES Send만), 키는 90일마다 교체

### CI/CD (GitHub Actions)

- 러너는 `ubuntu-latest`(지금 26.04). Playwright를 Ubuntu 26.04를 지원하는 1.64.1로 올림(2026-11, 1.56은 chromium 설치를 거부했음). Playwright 버전은 세 앱(`admin`, `site`, `mobile`) 모두 같게

1. PR(`.github/workflows/ci.yml`): check(lint, 타입 검사, Vitest, 빌드, 에셋 크기, 비밀 값 검사), e2e-web(Playwright. apps/mobile 화면은 `e2e-app` 4대로 나눠(`--shard=n/4`), admin + site는 `e2e-admin-site`, 둘 다 통과하면 묶음 작업 `e2e-web`이 통과. 2026-11-13 사용자 요청으로 CI 대기를 줄이려고 나눔), mobile-android(`cap sync android` + Gradle 디버그 빌드. iOS 시뮬레이터 빌드는 macos 러너로 나중에 추가), db(로컬 Supabase + pgTAP + DB 타입 비교. pgTAP이 실패하면 실패한 줄을 주석(annotation)으로도 남겨 `gh api .../check-runs/{id}/annotations`로 볼 수 있음)
2. develop 합치기(개발 서버, ADR 0002): 마이그레이션과 Edge Functions를 스테이징 Supabase에, 앱 화면·어드민·웹사이트는 Cloudflare Workers Builds가 GitHub 연결로 빌드해 개발 서버 주소에(→ ‘개발 서버’)
   - 지금 있는 것: `.github/workflows/deploy-staging.yml`(마이그레이션 + Edge Function `send-mail`). `supabase/migrations`, `supabase/functions`, `supabase/config.toml`이 바뀐 채로 develop에 합쳐지면 돌고, Actions 탭에서 손으로도 돌릴 수 있음
   - 메일을 실제로 보내려면 사람이 대시보드에서 넣는 값(코드·채팅에 넣지 않음):
     - Edge Function 비밀 값(공식 문서 ‘Environment Variables’: 대시보드 Edge Function Secrets 화면, `SUPABASE_`로 시작하는 이름은 못 씀): `MAIL_CRON_SECRET`(긴 무작위 값), `MAIL_DRIVER`(`ses`일 때만 보냄), `MAIL_FROM`(SES에서 확인된 주소), `AWS_REGION`(`ap-northeast-2`), `AWS_ACCESS_KEY_ID`·`AWS_SECRET_ACCESS_KEY`(SES Send만 되는 IAM 사용자), 필요하면 `SES_CONFIGURATION_SET`. 서버 키는 함수 기본 값(`SUPABASE_SECRET_KEYS`의 `default`, 없으면 옛 `SUPABASE_SERVICE_ROLE_KEY`)을 씀
     - Vault 비밀 값 2개(공식 문서 ‘Vault’: 대시보드에서 이름과 값을 넣고 저장): `mail_function_url` = `https://{project-ref}.supabase.co/functions/v1/send-mail`, `mail_cron_secret` = 위 `MAIL_CRON_SECRET`과 같은 값. 둘 중 하나라도 없으면 `kick_mail`은 아무것도 안 함
     - pg_net은 요청이 끝날 때까지 헤더를 `net.http_request_queue`에 남기므로(공식 문서 ‘Scheduling Edge Functions’) 서버 키가 아니라 메일 전용 `MAIL_CRON_SECRET`만 보냄
   - GitHub Environments → staging에 배포 브랜치 제한이 있으면 develop을 허용해야 함
   - 필요한 비밀 값(GitHub Environments → staging): `SUPABASE_ACCESS_TOKEN`(배포 전용 토큰), `SUPABASE_DB_PASSWORD`(staging DB 비밀번호)
   - staging에 손으로 SQL을 넣지 않는다. 모든 변경은 마이그레이션 파일 → develop → 이 작업으로
   - main 합치기: 개발 서버에서 확인한 것만 사람이 정해서 develop → main. 출시 전까지 main은 배포 없음(태그 배포는 아래 3)
3. 태그(v1.2.0): 운영 마이그레이션 → Edge Functions → 웹사이트 → 모바일 빌드를 TestFlight·Google Play 내부 테스트로(심사 제출은 사람이)(‘업데이트와 릴리스’)

### 모바일 출시

- iOS 16 이상, Android 8(API 26) 이상 [확인 필요]. 지금 뼈대는 Capacitor 기본값(iOS 15, Android API 24, compile·target 36)이라 정하면 `ios/App` 배포 대상과 `android/variables.gradle`을 맞춤. Capacitor가 Vite 빌드(`dist`)를 앱에 넣음(`npx cap sync`)
- iOS: Apple 개발자 계정(법인), App Store Connect API 키로 CI가 TestFlight 업로드. 서명은 Xcode 자동 관리 대신 CI용 인증서·프로비저닝(Environments production에만)
- Android: Google Play 앱 서명, 업로드 키는 Environments production에만. AAB로 올림
- 업데이트는 스토어만. 코드 바꿔 넣기(라이브 업데이트) 쓰지 않음(심사 규정, 보안)
- 실행 화면(스플래시, 2026-11-05, 04 브랜드): 흰 바탕(다크는 surface 다크 `#121315`) 가운데 영어 워드마크(logo-cherry) 높이 40pt(dp), 2026-11-05 심볼에서 바꿈. 플러그인 없이 네이티브만, 최소 표시 시간 없음(A-01).
  - iOS: `LaunchScreen.storyboard`가 워드마크(`Splash.imageset`, 149×40pt 1x·2x·3x)를 가운데 그대로(`contentMode=center`), 바탕은 색 에셋 `SplashBackground`(라이트·다크).
  - Android 12 이상: 시스템 스플래시(`windowSplashScreenBackground` = `@color/splash_background`, `values-night`에 다크, `windowSplashScreenAnimatedIcon` = `drawable-*dpi/splash_icon`(288dp 캔버스 가운데 워드마크 149×40dp, 192dp 원 안에 들어감)). 그 아래 버전: `drawable-port|land(-night)-*dpi/splash.png`.
  - 다시 만들 때: 워드마크(`packages/ui/src/assets/brand/logo-cherry.svg`)를 높이 40pt 기준 배율로 PNG로 다시 뽑음. 색 값은 tokens.css surface와 맞춤(네이티브 리소스라 토큰을 못 읽음)
- 단계 출시: App Store 단계적 출시(7일), Google Play 비율 출시 10% → 50% → 100%
- 심사: 첫 제출은 출시 2주 전. 심사용 계정과 흉내 데이터 공간, 개인정보 라벨·데이터 보안 양식

### 서명과 CI

- iOS: Apple 개발자 계정의 배포 인증서·프로비저닝, App Store Connect API 키. Android: 업로드 키. 모두 GitHub Environments production에만
- 데스크톱 서명(Developer ID 공증, Windows 클라우드 HSM OV)은 ADR 0008로 없앰

### 업데이트와 릴리스

- 첫 출시는 전체 공개. 단계 배포는 그 뒤 업데이트부터(‘모바일 출시’ 단계 출시). 올리는 사람은 릴리스 담당자
- 다음 단계 조건: Sentry release health의 크래시 없는 세션 99% 이상. 출시 승인 기준은 99.5%
- 앱 안 자동 업데이트는 없음(스토어만). 최소 지원 버전 미만이면 A-01 ‘지금 업데이트’ → 웹사이트 /download(스토어 버튼)

태그 배포 순서

1. DB 마이그레이션(추가만이라 예전 앱이 그대로 동작)
2. Edge Functions
3. 웹사이트(sweetwo.kr)
4. 모바일 빌드 업로드 → 심사 → 출시(스토어 일정과 단계 출시 때문에 서버·데이터는 늘 두 버전 호환)

- 되돌림: 함수와 웹사이트는 이전 버전 재배포, 모바일은 단계 출시 중지 + 고친 버전 긴급 심사. 마이그레이션은 되돌리지 않고 고침 마이그레이션을 앞으로
- 되돌릴 때: 크래시 없는 세션 99% 미만, 동기화 p95 3초 초과가 30분 이상, 데이터 손상 의심

릴리스 노트와 약관

- 릴리스 노트: Conventional Commits로 초안 → 사람이 다듬은 한국어를 apps/site/src/content에 → L-03
- 약관, FAQ의 원본은 apps/site/src/content의 마크다운. 앱은 L-05, L-06 페이지를 앱 안 보기로 엶
- 어드민 AD-14, AD-15는 버전, 시행일, 다시 동의 여부만 관리(본문은 다루지 않음)

### 기능 플래그와 최소 버전

- app\_config 테이블 하나: min\_version\_ios·android(min\_version\_web은 쓰지 않음, min\_version\_desktop·latest\_version\_desktop은 ADR 0008로 안 씀, 나중에 2단계로 지움. 2026-11-12부터 `admin_request_app_config`가 이 세 키를 새 요청에서 거절, 20261130090000), `flags`(jsonb), 기능별 끄기 스위치(kill switch)
- 앱 시작과 재연결 때 확인
- 최소 버전보다 낮으면 동기화를 멈추고 업데이트 안내. 오프라인 큐는 지우지 않고 업데이트 후 보냄
- 모바일은 최소 버전보다 낮으면 업데이트 안내 → 스토어. 최소 버전은 새 버전이 스토어에 공개된 뒤에만 올림

### 모니터링

- 오류: Sentry (모바일, Edge Functions)
- 가용성과 상태 페이지: Better Stack. 목표 99.5%
- 제품 지표: PostHog. North Star는 월급 체크를 한 커플 수(→ 기획서 성공 지표)
- 백업: 매일, 30일 보관, 분기마다 복구 훈련. RPO 24시간, RTO 4시간
- 성능 목표: 앱 시작 2초, 화면 전환 0.3초, 동기화 p95 3초

### 성능 측정

| 목표 | 이벤트 | 재는 구간 |
| --- | --- | --- |
| 앱 시작 2초 | `perf_app_started` | 앱 실행(네이티브 시작) → 첫 화면에 캐시 데이터 표시 |
| 화면 전환 0.3초 | `perf_route_changed` | 메뉴 클릭 → 새 화면 첫 그림 |
| 동기화 p95 3초 | `perf_sync_applied` | 찬우 기기 저장 시각(서버) → 예빈 기기 화면 반영 |

- 기준 기기: 저사양 기기 한 대(사양은 docs에 고정). 2026-11-10 데스크톱을 없애(ADR 0008) 예전 기준(저사양 Windows 노트북) 대신 휴대폰 기준 기기를 새로 정해야 함 [확인 필요]. 목표는 이 기기에서 판단
- 번들 크기 예산: CI가 첫 화면 JS 크기를 재고 예산을 넘으면 멈춤(예산 값은 첫 빌드에서 측정해 정함)

## 운영 절차(나중)

내부 테스트 전까지 채우는 목록. 지금은 항목과 기준만 정해 둠.

### 알림 기준

| 지표 | 기준(초안) | 채널 |
| --- | --- | --- |
| 오류율 | Sentry 새 오류 급증 | 개발 채널 |
| 동기화 지연 | p95 3초 초과 15분 | 당번 전화(Better Stack) |
| 예약 작업 실패 | job\_run 실패 1건 | 개발 채널 |
| 백업 실패 | 1회 | 당번 전화 |

### 런북(docs/runbooks/)

- Supabase 장애: status.sweetwo.kr 공지, 앱은 오프라인 큐로 버틸
- KMS 장애: 암호화 필드만 ‘잠시 볼 수 없음’, 나머지는 그대로
- 키 유출: 해당 키 즉시 교체, 영향 범위 확인, 필요하면 신고와 사용자 안내
- 예약 작업 다시 실행: ‘예약 작업’의 명령
- 백업 복구: 아래 절차
- 내부 테스트 데이터 삭제(공개 출시 직전): 내부 테스트 계정 표시로 골라 지움, 저장소 사진과 로그 포함, 지운 뒤 남은 개수 확인

### 백업

- Supabase Pro 기본 일일 백업 + 매일 pg\_dump → S3(30일 보관). PITR은 사용자가 늘면 추가
- 분기마다 별도 프로젝트에 복구 훈련. 암호화 필드가 풀리는지(KMS 접근) 같이 확인
- 가용성 99.5%는 Supabase 플랜의 SLA가 밑바닥

### 웹사이트(apps/site)

- Astro 정적 사이트(L-01·02·03·05·06, 28). 틀 `src/layouts/Site.astro`(SiteLayout: 상단 바, 하단, 사업자 정보, 페이지 머리의 canonical·og·파비콘), 문구·주소 `src/lib/site.ts`, 브라우저 동작 `src/lib/client.ts`(기기별 스토어 버튼, 접기, 측정 이벤트 `site_*`는 PostHog 연결 전까지 개발 중 콘솔만). 기기 판정은 core `detectSiteOs`(Vitest)
- 다크 모드(2026-11-12): `Site.astro` 머리의 인라인 스크립트가 그리기 전에 기기 설정(`prefers-color-scheme`)으로 `<html data-theme>`을 붙이고 바뀌면 따라감(어드민 `main.tsx`와 같은 방식, 토큰이 `[data-theme]`로 바꿈). 첫 화면 그림 카드는 `data-theme="light"`로 다크에서도 흰 카드
- L-02 `/download`: 제목 + 기기별 스토어 버튼(예전 `?os=` 주소도 같은 화면, 데스크톱 다운로드는 ADR 0008로 없앰)
- 원본 마크다운: FAQ `src/content/faq.md`(앱 S-20은 `pnpm content:sync`로 복사), 릴리스 노트 `src/content/releases.md`, 약관·처리방침 `src/content/{terms,privacy}/{시행일}.md`(frontmatter version·effective `YYYY-MM-DD`, `?v=YYYY-MM-DD`로 이전 버전). 약관·처리방침은 법률 검토 전 초안
- 지금 시행 중인 판(2026-11-12): 시행일이 오늘(KST) 이전 중 가장 최근. 빌드 때 한 번 고르고(`components/Policy.astro`), 브라우저가 KST 오늘로 다시 골라 시행일 전에 빌드한 페이지도 시행일부터 새 판을 보여 줌. 그래도 새 판의 시행일 당일에 웹사이트를 다시 빌드함(develop·main에 커밋이 들어가면 Workers Builds가 빌드. 커밋이 없으면 대시보드 Deployments에서 다시 빌드): 스크립트가 없는 검색·공유 미리보기는 빌드 때 판을 봄
- 초대 링크 `/i/{코드}`(2026-11-12): `public/_redirects`의 `/i/* /i/ 200`이 `/i/` 초대 페이지(`pages/i/index.astro`, 제목·og:title “sweeTwo에 초대받았어요”)를 200으로 줌. 주소는 그대로라 `components/Invite.astro`가 주소에서 코드를 읽음, 코드 없이 `/i/`면 코드 줄 없이 안내. 404 페이지도 `/i/`로 시작하면 같은 화면(`_redirects`를 모르는 `astro preview` 등). 앱이 깔린 휴대폰은 앱 링크로 이 페이지까지 오지 않음. PC·앱이 없는 기기는 코드 + 스토어 버튼(2026-11-10 ‘sweeTwo 앱으로 열까요?’와 다운로드 버튼 없앰, ADR 0008)
- 검색·공유(2026-11-12): 페이지마다 canonical·og:url(`astro.config.mjs` `site` + 경로), og:type·site_name·locale, 메타 설명(`t.desc`). 초대·404·로그인 복귀·알림 메일 링크는 `noindex`(Site `noindex`). 파비콘 32·48·apple-touch-icon 180(`public/`, 원본 `packages/ui/src/assets/brand`, `scripts/brand-icons/two.py`가 같이 복사)
- 사업자 정보는 `t.foot.business`에서 값이 빈 줄은 하단에 안 보임(출시 준비 34 4장에서 값을 넣음)
- 공유 이미지 `public/og.png`(1200×630, 흰 바탕 + 심볼 + 워드마크). 앱 화면 캡처(라이트, 캡처용 흔한 이름 한 쌍, 기획서 28)는 화면 디자인을 다듬은 뒤로 미룸(2026-10-27), 지금은 심볼과 워드마크
- e2e `apps/site/e2e`(빌드 + `astro preview`, PC·휴대폰 UA, 라이트·다크·좁은 창), CI e2e-web 잡에서 같이. `astro preview`는 `_redirects`를 모르므로 `/i/{코드}`의 200 응답은 e2e가 `dist/_redirects` 규칙을 확인하고, 실제 응답은 배포 뒤 개발 서버에서 확인

### 어드민 인증

- 주소 ops.sweetwo.kr(개발 서버 dev-ops.sweetwo.kr). Cloudflare Workers 정적 자산(Worker `sweetwo-admin`) + IP 허용 목록 + 2단계 인증 필수(2026-11-12 CloudFront에서 고침)
- 보안 헤더(2026-11-12): 빌드가 `dist/_headers`를 만듦(`apps/admin/vite.config.ts` `adminHeaders`, Supabase 주소가 빌드 값 `VITE_SUPABASE_URL`이라 public/에 두지 않음). CSP(어드민 자신 + Supabase https·wss, 인증 앱 QR `data:`, 내려받기 `blob:`, 인라인 스크립트·eval 금지, `frame-ancestors 'none'`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, `Cross-Origin-Opener-Policy: same-origin`, `X-Robots-Tag: noindex`. 새 외부 출처(이미지, API)를 쓰면 `adminHeaders`에 더함
- IP 허용 목록은 저장소 밖 Cloudflare 대시보드 설정이라 담당자가 확인함(코드·이 문서에 IP 값은 적지 않음) [확인 필요]:
  - Zero Trust → Access → Applications의 sweetwo-admin 앱이 `dev-ops.sweetwo.kr`, `sweetwo-admin.yeabin0909.workers.dev`, 미리보기 `*-sweetwo-admin.yeabin0909.workers.dev`, 운영 때 `ops.sweetwo.kr`을 모두 덮는지
  - 그 정책에 허용 이메일(Include Emails)과 함께 사무실·회사 VPN IP(Require 또는 Include IP ranges)가 들어 있는지, 아니면 Security → WAF 사용자 지정 규칙으로 위 주소의 목록 밖 IP를 막는지(33 3장 ‘접속 위치’: 로그인 화면 전에 차단)
  - Workers & Pages → sweetwo-admin → Settings → Domains & Routes에서 `workers.dev`·미리보기 주소를 끄지 않았다면 그 주소도 같은 Access·WAF 아래인지
  - 배포 뒤 개발 서버 응답에 위 보안 헤더가 붙는지(브라우저 개발자 도구 Network → 응답 헤더)
- 어드민 권한: 같은 Supabase 프로젝트, 관리자 role claim + RLS
- 열람과 변경은 모두 audit\_log에
- 관리자 계정: `admin_user`(회사 이메일, 역할 `super/ops/cs/analyst` 여러 개, 잠금). 최고 관리자가 이메일을 넣으면 그 사람이 매직 링크(PKCE, `?code=` → `exchangeCodeForSession`)로 처음 로그인할 때 `admin_me`가 연결. 인증 앱(TOTP) 등록·확인으로 aal2가 돼야 어드민 함수가 열림(`admin_require`: 관리자 + 잠금 아님 + `aal2` + 역할). 30분 무활동·최대 8시간은 어드민 앱(`apps/admin/src/session.ts`), 세션은 localStorage(매직 링크가 새 탭에서 열려서). 무활동 시각도 localStorage에 남겨 브라우저를 닫았다 열어도 이어서 셈. 로그인 링크는 보낸 뒤 60초 동안 다시 못 보냄, Supabase 오류 코드(`over_email_send_rate_limit`, `email_address_not_authorized`)는 화면 문구로 바꿈
- 어드민은 테이블을 직접 읽지 않고 `admin_*` security definer 함수로만(`admin_user`, `admin_audit`, `job_run`은 anon·authenticated 권한 없음). 함수마다 `admin_log`로 `admin_audit`에 같은 트랜잭션으로 남김(기록이 실패하면 조치도 안 됨). 화면 ID별 함수: AD-01 `admin_dashboard`, AD-02 `admin_search`(정확히 일치), AD-03 `admin_user_detail`(L0, 금액 없음), AD-04 L1 `admin_reveal`(사유 + 문의 번호, 앱이 30분 보여 주고 가림. 문의 번호는 그 회원 또는 지금 같은 공간의 파트너가 한 문의만, `inquiry_is_about`, 아니면 `reason_required`, 2026-11-12 20261130090000), L2 `admin_request_access`(CS만, 문의 상세 AD-06에서) → 사용자 S-19b 동의 → `admin_access_data`(동의 범위·24시간, 금액은 `won_band` 구간), AD-05 `admin_account_action`(전체 기기 로그아웃, 삭제 대리 접수, 권리 요구 기록. 문의 번호 규칙은 L1과 같음), AD-06 `admin_inquiries`·`admin_inquiry`·`admin_answer_inquiry`(답변 → 사용자 답변 대기 + ‘문의 답변 도착’ 알림)·`admin_set_inquiry_status`, AD-17 `admin_audit_rows`(최고 관리자만 전체)
- 어드민 앱: `apps/admin`(React, react-router, react-query), 틀은 ui `AdminFrame`·`DataTable`, 문구는 `apps/admin/src/copy.ts`. e2e는 `apps/admin/e2e`(가짜 Supabase, 1440 폭 라이트·다크), CI e2e-web 잡에서 같이. AD-20 문서는 작은 마크다운 렌더러(`apps/admin/src/markdown.tsx`, HTML 문자열 안 씀)와 빌드 때 docs/ 마지막 커밋(`__DOCS_COMMIT__`)
- 승인(`admin_approval`): 공지 게시(AD-10), 약관 버전(AD-15), 앱 버전·점검(AD-16), 관리자 추가·역할(AD-18)은 요청 → `admin_decide`(최고 관리자 + 재인증, 2026-11-06부터 요청자 본인도 승인 가능. 최고 관리자는 `admin_require`에서 운영 권한도 통과) → 적용. 요청자는 취소. 시스템 메뉴 `/system/approvals`
- 첫 최고 관리자: 관리자가 한 명도 없을 때 회사 도메인(@sweetwo.kr) 이메일로 처음 로그인한 사람(`admin_bootstrap`, 어드민 앱이 `not_admin`일 때 한 번 부름). 그 뒤 추가는 AD-18 승인으로. 90일 미접속 자동 잠금 `lock_idle_admins`(매일)
- 개발 서버 어드민 로그인 준비(2026-10-25)
  - 회사 메일: 네이버웍스(`@sweetwo.kr`). 메일 받는 서버(MX)와 SPF, 도메인 인증 TXT가 Cloudflare DNS에 있어야 함(가비아 DNS 값을 옮김). Cloudflare Email Routing은 켜지 않음(MX를 덮어씀)
  - 스테이징 Supabase 기본 메일은 조직 팀원 주소로만, 한 시간에 2통까지 보냄. 어드민으로 들어올 회사 메일 주소를 Supabase 조직 → Team에 초대하고 수락해 둠. 운영자가 늘거나 출시 전에는 메일 발송 서비스(SES)를 Supabase SMTP에 붙임
  - `dev-ops.sweetwo.kr` → 회사 메일 입력 → 메일의 링크 → 인증 앱 QR 등록 → 6자리 숫자. 처음 들어온 `@sweetwo.kr`이 최고 관리자
- 공지(AD-10 `notice`): 초안 → 승인 요청 → 게시. 밤 10시~아침 8시 시작 불가(`quiet_hours`). 앱은 RLS로 게시·노출 기간 안의 것만 읽고 이번 달 상단 띠(`month/notice-band.tsx`, 필독 먼저, 일반은 닫으면 이 기기에서 안 보임)
- 콘텐츠: AD-14 `content_version`(확인일 6개월 지나면 ‘재검토’), AD-15 `terms_version`(법률 검토 체크 없으면 `legal_check_required`, 버전별 동의 수, 앱은 승인된 버전만 읽음. 재동의 화면은 다음 단계), AD-19 `loan_rate`(0.01% 단위 정수, 누구나 읽음)·공휴일 직접 추가·지우기(AD-19는 금리·공휴일·항목 이름 모두 운영이 바로 저장 + 감사 로그, 승인 없음. 승인은 AD-15 약관 버전만)
- 앱 버전·점검(AD-16): `app_config.min_version_ios`·`min_version_android`, `maintenance_starts_at/ends_at/message`(데스크톱 칸은 ADR 0008로 없앰). A-01이 점검 시간 안이면 ‘지금 점검 중이에요’ / ‘{시각}에 끝나요’(`fetchLaunchConfig`)
- AD-02 내려받기(20261107150000 `admin_note_export`): 결과 표 그대로(L0), 사유 필수 + 감사 로그 `download`, 파일 첫 줄에 관리자 ID와 시각
- 공지 메일(20261107180000): 약관 개정·장애 고지(`notice.kind` terms, incident)만 ‘이메일로도 보내기’(`notice.email`, `admin_set_notice_email`). `send_notice_mails()`(pg_cron `send-notice-mails` 5분마다)가 게시됐고 노출 기간 안이며 아직 안 보낸 공지를 이메일 알림을 켠 사용 중 회원 모두에게 `mail_outbox`로 쌓고(`notice_{kind}`, 메일 상한 밖, 사람마다 한 번) `mailed_at`을 적음. 보내기는 다른 메일과 같은 `send-mail`
- AD-05 계정 조치(20261107210000): 삭제 대리 접수 `delete_request`는 고객 지원이 문의 번호로 바로 실행, 본인 삭제와 같은 `account_deletion_for`(30일 유예). 로그인 수단 이전은 `admin_request_login_move(기존, 새 계정 이메일 또는 사용자 ID, 문의 번호)` → 승인 요청 `login_move` → 최고 관리자 승인 때 `login_move_apply`: 기존 계정의 로그인 수단을 지우고 새 계정의 것을 옮김, `app_user.provider` 바꿈, 새 계정(가입 전이거나 혼자 쓰는 공간뿐)은 지움, 전체 기기 로그아웃, 가입 이메일로 완료 메일(`login_moved`, 상한 밖). 새 계정이 다른 사람과 연결돼 있으면 안 됨
- AD-04 금액 원값(20261108090000): 고객 지원이 ‘금액 원값 요청’(화면 1개)을 체크하면 사용자에게 바로 가지 않고 승인 요청 `access_raw`. 최고 관리자 승인 = 원값으로, 거절 = 같은 범위를 구간으로만 사용자에게 요청(`access_send`, 요청자는 고객 지원 그대로). 그사이 문의가 끝났으면 보내지 않음
- AD-16 미만 기기 수(20261108120000 `app_device`): 앱(iOS, Android)이 로그인된 채 켜질 때(`routeAfterLogin`) `note_device(설치 ID, 플랫폼, 앱 버전)`. 설치 ID는 기기 localStorage `sweetwo.install-id`(임의 UUID). 웹은 기록 안 함. `admin_app_config().below_min`이 90일 안에 켠 기기 중 최소 지원 버전 미만을 플랫폼별로 셈(`version_below`). AD-01 대시보드 앱 버전 칸은 iOS·Android 기기만 셈(예전 데스크톱 기기 줄은 뺌, 2026-11-12). 180일 안 켠 기기는 `purge_app_devices()`가 지움
- AD-19 항목 이름 목록(20261108150000 `asset_kind_name`): 예금·적금, 청약, 투자, 연금의 F-03a 세부 항목 칩. 기본 항목은 한 줄(`added = false`)로 이름 바꾸기·숨기기, 새 칩(`added = true`)은 `base` 기본 항목의 key로 저장돼 같은 질문. 운영이 `admin_save_kind_name`·`admin_delete_kind_name`으로 바로 저장(감사 로그 전·후), 앱은 읽기만(`useAssetGroups` → core `withKindNames`, 못 받으면 기본 칩)
- 문서 메뉴(AD-20): 어드민을 배포할 때 저장소 docs/(기획서 docs/spec, 디자인 docs/design과 DESIGN.md, 개발 가이드 docs/DEV\_GUIDE.md)를 함께 빌드해 읽기 전용으로 보여 줌. 어드민에 로그인한 사람 모두 읽기

## MVP 순서

두 사람이 같이 쓰는 흐름이 핵심이라, 우리 둘 연결과 동기화를 먼저 만들고 그 위에 기능을 올림. 단계별 기간은 인원이 정해지면 채움.

1. 기반: 모노레포, CI, 디자인 시스템 패키지, Capacitor 껍데기(Electron 껍데기는 ADR 0008로 없앰), Supabase 환경 3개
2. 로그인과 우리 둘 연결: 소셜 로그인 3종, 딥링크, 잠금, 초대 링크와 6자리 코드, 합류 (A, P 화면)
3. 동기화 뼈대: change\_log, Realtime 구독, 델타 동기화, 충돌 규칙, 휴지통
4. 자산과 저금 항목: 자산, 부채, 저금 항목(목표 금액·기한), 공개 범위
5. 한 달 흐름: 월급 계획(W-01), 월급날 체크리스트(W-02, 기준일 0시 예약 작업 포함), 월급 전 확인(W-05), 관리 방식 각자·합쳐서
6. 두 사람 권한: 바로 고치기 + 상대 알림·활동 기록 + 되돌리기(제안·승인 없음, ADR 0003), 연결 해제
7. 알림과 캘린더: 모바일 푸시, 이메일, 방해 금지 시간, 양가 캘린더와 음력
8. 어드민과 출시 준비: 어드민 필수 메뉴(AD-19 항목 이름 목록·계산 설정값 포함), 문서 메뉴(AD-20, 저장소 docs/ 읽기 전용), 내보내기(CSV, PDF), 웹사이트 L-01\~L-03, L-05, L-06, 스토어 출시, 보안 점검
9. 내부 테스트와 정식 출시: 지인 20\~30쌍 내부 테스트(운영 환경), 출시 준비 탭의 QA 매트릭스와 출시 승인 기준을 넘으면 전체 공개로 출시(단계 배포는 이후 업데이트부터)

### 개발 시작 전 준비물

- [ ] GitHub 조직과 저장소, 기획서와 디자인 시스템 링크를 docs에
- [ ] Supabase 조직
- [ ] Supabase 프로젝트 2개 만들기: sweetwo-staging, sweetwo-prod, 서울 리전, Pro 플랜
- [ ] AWS 계정: KMS, SES(발송 도메인 인증, 발송 제한 해제 신청), S3, CloudFront. SPF는 TXT 한 줄에 네이버웍스와 SES를 함께 넣음(SPF 레코드는 하나만)
- [x] 도메인: 서비스(sweetwo.kr, app, download, status)와 메일
- [ ] 어드민 도메인 ops.sweetwo.kr
- [ ] 카카오 디벨로퍼스 앱, 구글 OAuth 클라이언트, Apple 로그인 설정
- [ ] Apple Developer 계정(iOS 서명, 애플 로그인), Google Play 개발자 계정
- [ ] Sentry, PostHog 자체 운영 서버, Better Stack
- [ ] 네이버웍스 help@sweetwo.kr과 privacy@sweetwo.kr 그룹 메일 만들기 (도메인 등록과 메일 DNS 연결은 10월 12일 완료: MX, SPF(TXT 한 줄에 include:worksmobile, SES는 나중에 같은 줄에), DKIM(선택자 naverworks), DMARC p=none)

## 개발 착수 체크리스트

착수 전에 범위, 기술 준비, 디자인 연결, 남은 일, 열린 결정을 한곳에서 확인함. 모든 항목은 이 문서와 기획서에 이미 있는 내용 기준.

### 확정된 범위 (MVP 1차)

순서는 위 ‘MVP 순서’를 따르고, 화면 ID는 기획서 ‘화면 설계’ 탭 기준.

| 순서 | 단계 | 화면 |
| --- | --- | --- |
| 1 | 기반 | 앱 기본 틀(이번 달 탭의 공통 틀), 공통 상태 |
| 2 | 로그인과 우리 둘 연결 | A-01\~08, O-01, P-01\~11, S-12(초대·연결 해제) |
| 3 | 동기화 뼈대 | 화면 없음(휴지통 S-21만) |
| 4 | 자산과 저금 항목 | O-03\~O-32·O-60(온보딩), F-(자산 관리, F-08b 제외), W-10\~W-12(저금 항목) |
| 5 | 한 달 흐름 | H-(홈, 검색 포함), W-01, W-02, W-05 |
| 6 | 두 사람 권한 | N-(활동 기록), S-12 해제 대기 |
| 7 | 알림과 캘린더 | N-01\~03, Y-(캘린더), (WG-01\~05 위젯은 모바일 앱 출시 뒤, 트레이 위젯은 ADR 0008로 없앰) |
| 8 | 어드민과 출시 준비 | AD-(필수 메뉴, AD-19·AD-20 포함), S-01\~22 나머지, L-01\~03·L-05·L-06 |

- 1차 밖: 비슷한 커플과 비교(F-08b), 수익률 시뮬레이션, 양가 균형 리포트, 결제·체험(S-16·AD-08·AD-09), OS 기본 위젯

### 기술 준비

- [ ] GitHub 조직과 저장소, pnpm 워크스페이스 + Turborepo 골격(apps/mobile·admin·site, packages/ui·app·core·api, supabase/)
- [ ] .nvmrc, packageManager 버전, lint-staged, eslint-plugin-boundaries import 규칙
- [ ] PR 템플릿, ADR 템플릿(docs/adr), CODEOWNERS(supabase/는 DB 오너, packages/ui는 디자인 시스템 오너)
- [ ] .env.example 4개(apps/mobile, apps/admin, apps/site, supabase/functions), 비밀 값 담당자와 교체 주기(docs/secrets.md)
- [ ] Supabase 프로젝트 sweetwo-staging, sweetwo-prod(서울, Pro 플랜), GitHub Environments staging, production(승인자 1명)
- [ ] AWS: KMS 키(staging, prod), SES 발송 도메인 인증과 발송 제한 해제, S3 + CloudFront, 최소 권한 IAM 사용자
- [ ] OAuth 앱 3종 × 3환경(카카오, 구글, 애플), Supabase Auth 리다이렉트 허용 목록
- [ ] 서명: Apple Developer(iOS 서명, 애플 로그인), Google Play 업로드 키
- [ ] 관측: Sentry, PostHog 자체 운영 서버, Better Stack(상태 페이지)
- [ ] 메일: 네이버웍스 help@, privacy@ 그룹 메일, SPF는 TXT 한 줄에 네이버웍스와 SES
- [ ] DB 마이그레이션 순서(테이블마다 공통 컬럼 + RLS 정책 4개 + pgTAP): ① 공통 틀(is\_space\_member, updated\_at·version·change\_log 트리거) ② couple\_space, app\_user, invite, device\_session, consent ③ change\_log(seq, mutation\_id), amount\_history ④ account, asset, debt, fixed\_expense, annual\_event ⑤ goal, goal\_move, salary\_split, split\_line, pay\_checklist, pay\_check\_line, checklist\_done ⑥ couple\_unlink, partner\_change ⑦ care\_day, care\_record, photo ⑧ notification, widget\_setting ⑨ inquiry, admin\_view\_request, holiday, notice, maintenance, app\_config, admin\_setting, item\_catalog, admin\_user, audit\_log, job\_run
- [ ] seed.sql: 찬우, 예빈, 연결된 우리 둘 공간, 월급 계획과 이번 달 체크리스트
- [ ] 예약 작업 8개와 job\_run 기록, space별 advisory lock: cycle-checklists, send-due-notifications, send-payday-reminders, send-evening-reminders, unlink-deadlines, send-weekly-summary, sync-holidays, purge-expired
- [ ] 알림 키: notification.kind를 기획서 ‘알림’ 탭 표의 종류와 1:1로, SES 템플릿(supabase/functions/\_shared/mail-templates/), 메일 상한 월 6회
- [ ] 분석 이벤트: 기획서 ‘성공 지표’ 4장 이벤트 이름과 속성, 공통 속성, 금액은 \_band 구간만, analytics\_off
- [ ] 테스트 벡터: core/rules/vectors/\*.json에 계산·배분 예시를 넣어 Vitest와 pgTAP이 같이 읽음
- [ ] 오류 코드 표(docs/errors.md)와 기획서 ‘공통 상태’ 문구 연결
- [ ] 음력 fixture(천문연구원 표 대조), 공휴일 fixture
- [ ] app\_config: min\_version\_ios·android, flags

### 디자인 연결

- 디자인 시스템(v125): https://claude.ai/artifact/5KKC9HnqXVWEja5sif5JjF
- tokens.css와 components/bundle.css를 packages/ui에 그대로 복사(pnpm ds:sync), 컴포넌트마다 React 래퍼(hg- 클래스). 색과 간격은 토큰만, 화면 코드에서 클래스 이름을 바꾸지 않음(→ ‘디자인 시스템 쓰는 법’)

| 화면 | 컴포넌트 |
| --- | --- |
| W-02, W-05 체크리스트 줄 | TransferRow(hg-transfer) |
| 홈 H-02·H-03·H-04·H-06~H-09 (2026-11-09) | HomeHub(hg-hub, hg-hubhero, hg-hubband, hg-hubtile, hg-hubsave) |
| 좁은 창 홈 머리 ☰ 메뉴 (2026-11-09) | Drawer(hg-drawer) |
| W-02·F-02·Y-01 ‘+ … 추가’ 줄 (2026-11-09) | AddRow(hg-addrow) |
| F-01 16번, W-01 6번 | ListRow |
| 검색(⌘K, 좁은 창 검색) | CommandPalette |
| 알림 센터 N-01·N-02 항목 | Avatar |
| 바로 저장 뒤 ‘되돌리기’, 동시 저장 알림 등 | Toast |

### 착수 전 남은 일

- [x] 구현 기준 화면 그림 갱신: W-04 j·k·g, 보정 카드, 지출 적기 홈, W-01 6번, F-01 16·17, 앱 기본 틀(기획서 출시 준비 4장)
- [x] 놓친 달 와이어프레임 문구를 기본 모드(j·k) 기준으로 갱신
- [x] W-04h 와이어프레임의 생활비 예산 줄 갱신(지금은 W-04g 보정 제안)
- [x] 장면 그림·영상 제거, 장면 자리는 비워 둠(2026-10-19)

### 사람이 할 일(대시보드, 값은 코드·채팅에 넣지 않음)

- [ ] 메일 1단계(스테이징, AWS 없이 연결만): `openssl rand -hex 32`로 값 하나 → Edge Function Secrets `MAIL_CRON_SECRET`, Vault `mail_function_url`(`https://xxofyzgzrjrcrcxvftpn.supabase.co/functions/v1/send-mail`)·`mail_cron_secret`(같은 값). `MAIL_DRIVER`는 비워 둠(로그만). 확인: Edge Functions → send-mail → Logs (→ ‘CI/CD’ 2)
- [ ] 메일 2단계(실제 발송): AWS SES 서울 리전 sweetwo.kr 도메인 인증, 샌드박스 해제, SES Send만 되는 IAM 사용자 → `MAIL_DRIVER`=`ses`, `MAIL_FROM`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- [ ] 배포 토큰 만료 전 교체: Supabase 토큰 `github-actions-sweetwo-staging`(2026-10-26 새로 만듦) → GitHub Environments staging `SUPABASE_ACCESS_TOKEN`. 토큰이 무효면 Deploy staging이 ‘staging 연결’에서 “Invalid access token”으로 멈춤(2026-10-25~26에 그랬음)
- [ ] 메일 3단계(반송·수신 거부): `openssl rand -hex 32`로 값 하나 → Edge Function Secrets `MAIL_EVENTS_SECRET`. SNS 주제(서울) 만들기 → ARN을 `MAIL_EVENTS_TOPIC_ARN`. SES 구성 세트 만들기 → 이벤트 대상 SNS(그 주제, Bounce·Complaint) → 이름을 `SES_CONFIGURATION_SET`. SNS 구독 HTTPS `https://<프로젝트>.supabase.co/functions/v1/mail-events?token=<같은 값>`(구독 확인은 함수가 자동). 메일 2단계 뒤에
- [ ] 메일 4단계(이메일 문의 받기, AWS 없이 Cloudflare로): ① Cloudflare 대시보드 → sweetwo.kr → Email → Email Routing → 하위 도메인 `in.sweetwo.kr`에 켜기(Cloudflare가 in.sweetwo.kr MX·TXT를 넣음. sweetwo.kr 루트 MX는 네이버웍스 그대로, 루트에는 Email Routing을 켜지 않음) ② `openssl rand -hex 32`로 값 하나 ③ Workers → `apps/mail-worker`로 Worker 만들기(이름 `sweetwo-mail-worker`, 저장소 루트에서 `npx wrangler deploy --config apps/mail-worker/wrangler.jsonc`), 변수 `INBOUND_URL`(wrangler.jsonc에 있음, `https://<프로젝트>.supabase.co/functions/v1/inbound-mail`), 비밀 값 `INBOUND_MAIL_SECRET`(②의 값, `npx wrangler secret put INBOUND_MAIL_SECRET --config apps/mail-worker/wrangler.jsonc` 또는 대시보드) ④ Email Routing → 라우팅 규칙: `inbound@in.sweetwo.kr` → 동작 ‘Worker로 보내기’ → `sweetwo-mail-worker` ⑤ Supabase Edge Function Secrets `INBOUND_MAIL_SECRET`(②와 같은 값) ⑥ 네이버웍스 관리자 → help@ 그룹 메일 자동 전달에 `inbound@in.sweetwo.kr` 추가(원본은 받은편지함에도 남김) ⑦ 확인: 개인 메일로 help@에 보내면 AD-06 ‘접수’에 이메일 문의, 그 메일에 다시 답장하면 같은 문의에 덧붙음. 안 되면 Workers → sweetwo-mail-worker → Logs와 Edge Functions → inbound-mail → Logs. 비용: Email Routing 받기 무료, Workers 무료 요금제(하루 10만 요청) 안. 답장 자동 발송은 메일 2단계(SES) 뒤부터
- [ ] 모바일 앱 링크·로그인(기기 빌드 전): Apple Developer 팀 ID → 웹사이트 빌드 환경 변수 `PUBLIC_APPLE_TEAM_ID`(공개 값), Xcode → App 타깃 → Signing & Capabilities → Associated Domains `applinks:sweetwo.kr`. Android 서명 인증서 SHA-256(Play Console 앱 서명 키, 업로드 키) → `PUBLIC_ANDROID_CERT_SHA256`(쉼표로). appId `kr.sweetwo.app`은 스토어 등록 전에 확정
- [ ] 모바일 푸시: Apple Developer → Keys에서 APNs 키(.p8) → Edge Function Secrets `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY`, `APNS_TOPIC`(kr.sweetwo.app), 개발 설치면 `APNS_ENV`=`sandbox`. Xcode → Signing & Capabilities → Push Notifications. Firebase 프로젝트에 Android 앱(kr.sweetwo.app) 추가 → `google-services.json`을 `apps/mobile/android/app/`에(커밋하지 않음, CI 빌드는 없어도 됨), 서비스 계정 키 JSON → `FCM_SERVICE_ACCOUNT`. `openssl rand -hex 32` → `PUSH_CRON_SECRET`, Vault `push_function_url`(…/functions/v1/send-push)·`push_cron_secret`(같은 값). 다 넣은 뒤 `PUSH_DRIVER`=`send`
- [ ] 공휴일 받기: 공공데이터포털(data.go.kr)에서 ‘한국천문연구원_특일 정보’ 활용신청 → 마이페이지의 일반 인증키(Decoding) → Edge Function Secrets `HOLIDAY_API_KEY`. `openssl rand -hex 32` → `HOLIDAY_CRON_SECRET`, Vault `holiday_function_url`(…/functions/v1/fetch-holidays)·`holiday_cron_secret`(같은 값). 넣기 전에는 마이그레이션으로 넣은 2026·2027년과 어드민 AD-19 입력만 씀. 응답 모양(item 하나면 객체)은 키를 받은 뒤 실제 응답으로 한 번 확인
- [ ] 사진 지우기: `openssl rand -hex 32` → Edge Function Secrets `PURGE_CRON_SECRET`, Vault `purge_function_url`(…/functions/v1/purge-storage)·`purge_cron_secret`(같은 값). 넣기 전에는 지울 목록에 쌓이기만 함
- [ ] 웹사이트 스토어: 앱 등록 뒤 App Store 주소 → 웹사이트 빌드 환경 변수 `PUBLIC_APP_STORE_URL`(Google Play는 `kr.sweetwo.app`으로 정해져 있음, 바꾸면 `PUBLIC_PLAY_STORE_URL`). 공식 배지 이미지(Apple 마케팅 리소스, Google Play 배지)를 받아 `docs/design/assets`에 넣으면 `StoreBadges.astro`를 이미지로 바꿈
- [ ] 운영 준비 때: Supabase 토큰 `github-actions-sweetwo-prod`(sweetwo-prod만) → GitHub Environments production(승인자 1명), `deploy-prod.yml`

### 확정된 결정(10월 14일)

- 결제 회사: MVP 밖, 유료화 때 토스페이먼츠 우선 검토
- 로그인: 시스템 브라우저(모바일은 시스템 로그인 창) → https://sweetwo.kr/auth/callback → sweetwo://로 앱에 복귀(2026-11-10 데스크톱은 ADR 0008로 없앰). 루프백은 쓰지 않음(Apple 로그인이 https 리다이렉트만 허용)
- 어드민 권한: 같은 Supabase 프로젝트, 관리자 role claim + RLS, 2단계 인증과 WAF IP 허용 필수
- 어드민 도메인: ops.sweetwo.kr
- 백업: Supabase Pro 기본 일일 백업 + 매일 pg\_dump → S3(30일 보관). PITR은 사용자가 늘면
- 초안 값: Supabase 프로젝트 sweetwo-staging, sweetwo-prod / 파일 크기 상한 그림 150KB, 영상 1MB / 번들 예산은 첫 빌드에서 측정해 정함

열린 결정: 없음
