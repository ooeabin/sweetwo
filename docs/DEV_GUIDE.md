# sweeTwo 개발 가이드

> 이 파일이 개발 가이드 정본이에요(2026-10-14부터). 매번 지킬 핵심은 저장소 맨 위 `CLAUDE.md`, 기획서는 `docs/spec/`, 디자인은 `docs/DESIGN.md`.
>
> 문서 고치는 법: 코드를 바꾸며 기획, 디자인, 규칙이 달라지면 같은 PR에서 해당 md를 바로 고쳐요. 따로 변경 목록을 두지 않고 git 기록이 변경 이력이에요.

## 한눈에 보기

MVP는 데스크톱 앱(Windows, macOS)과 모바일 앱(iOS, Android)을 React + TypeScript 한 화면 코드로 만들고(데스크톱은 Electron, 모바일은 Capacitor로 감쌈), 서버는 Supabase(서울 리전) 하나로 운영함. 웹 앱은 없음(ADR 0001). OS 위젯은 2단계.

> 전환 중: 모바일 로그인·잠금·앱 링크, 웹사이트 로그인 복귀 페이지(`apps/site` /auth/callback, 20261104090000), 모바일 푸시(20261104120000)는 코드에 있음. 실제 발송은 APNs·Firebase 키를 넣은 뒤. 이 문서는 바뀐 뒤 모습 기준이고, 아직 안 바뀐 곳은 ‘(전환 전)’으로 표시함.

- 만들 것: 데스크톱 앱, 모바일 앱(App Store, Google Play), 트레이 위젯, 웹사이트(sweetwo.kr), 다운로드(download.sweetwo.kr/latest/mac|win), 상태 페이지(status.sweetwo.kr), 어드민(웹 전용, ops.sweetwo.kr). 메일은 help@sweetwo.kr, privacy@sweetwo.kr
- 데이터: 모두 직접 입력. 계좌 연동, 마이데이터, 스크래핑 없음
- 사용자: 부부 2명이 한 공간을 같이 씀. 한국어, 원(KRW), KST만 지원
- 기준 문서: 기획서 ‘기술·운영’, ‘동기화’, ‘보안·개인정보’ 탭과 디자인 시스템 sweeTwo

| 영역 | 고른 것 |
| --- | --- |
| 앱 껍데기 | Electron (electron-vite로 빌드) |
| 화면 | React 18 + TypeScript, Vite |
| 화면 상태와 서버 데이터 | TanStack Query + Zustand |
| 화면 이동 | React Router |
| 입력 검증 | Zod + React Hook Form |
| 스타일 | 디자인 시스템 tokens.css + 컴포넌트 CSS(hg- 클래스) |
| 서버 | Supabase: Postgres, Auth, Realtime, Edge Functions, Storage, pg\_cron |
| 권한 | Postgres RLS |
| 암호화와 파일 | AWS KMS, S3 + CloudFront (서울, 데스크톱 설치·업데이트 파일) |
| 정적 배포·개발 서버 | Cloudflare Workers 정적 자산 + Access(웹사이트, 어드민, 개발 확인용 앱 화면, ADR 0002) |
| 메일 | 보내기 Amazon SES(서울), 받기 네이버웍스 |
| 분석, 오류, 모니터링 | PostHog(직접 운영), Sentry(직접 운영), Better Stack |
| 업데이트 | electron-updater, 채널 하나 + 단계 배포 |
| 저장소 | pnpm 워크스페이스 + Turborepo 모노레포 |
| 테스트 | Vitest, Playwright, pgTAP(RLS 검사) |
| CI/CD | GitHub Actions |

- 표의 모든 항목은 확정(10월 12일). 바꿀 때는 docs/adr에 ADR로 남김. 웹사이트(apps/site)는 Astro 정적 사이트(확정).

## 기술 스택 상세

클라이언트는 화면 코드를 데스크톱과 웹이 같이 쓰고, 계산과 권한의 기준은 서버(Postgres)에만 둠. 기기는 캐시.

### 클라이언트

- Electron: 데스크톱 앱과 트레이 위젯. 보안 기본값 contextIsolation 켬, nodeIntegration 끔, preload로 필요한 기능만 열어 줌
- 로그인: 시스템 브라우저 OAuth(PKCE) → https://sweetwo.kr/auth/callback(웹사이트의 정적 복귀 페이지, (전환 전) app.sweetwo.kr) → 딥링크(sweetwo://)로 복귀. 모바일은 같은 주소가 앱 링크라 앱이 바로 받음. refresh token은 main 프로세스가 safeStorage로 암호화해 보관(세부는 ‘인증과 세션’)
- 로컬 저장: 위젯 캐시와 오프라인 큐는 암호화, 키는 safeStorage(트레이 위젯 마지막 값은 `widget.json`의 `snapshotEnc`로 암호화, 암호화를 못 쓰면 남기지 않음. 오프라인 큐는 아직 없음). 트레이 값은 앱 창이 30분마다 새로 읽어 고침
- Capacitor: 모바일 앱. `apps/mobile`(Vite 빌드 + iOS·Android 프로젝트)이 packages/app을 감쌈. 모바일 전용 기능(로그인, 보안 저장소, 잠금·생체 인증, 푸시, 앱 링크)은 데스크톱과 같은 모양의 브리지(`window.sweetwo`)로만 열어 줌. 플랫폼 값은 `desktop` / `ios` / `android`, 데스크톱 전용(트레이, 단축키)은 플랫폼 플래그로 숨김
- 같은 Vite 화면을 브라우저로 띄우는 건 개발과 e2e(흉내 Supabase)용뿐, 배포하지 않음
- 서버 데이터: TanStack Query 캐시 + Realtime 변경 신호로 무효화. 끊기면 30초 폴링
- 화면 상태: Zustand(잠금, 금액 가리기, 월말 정리 진행 단계 등 기기 안 상태)

### 서버

- Supabase 서울 리전 하나: Postgres, Auth(카카오, 구글, 애플), Realtime, Storage(사진), Edge Functions
- 합계와 배분 계산: Postgres 함수. 클라이언트는 미리보기만 계산하고 저장 값은 서버 값
- 예약 작업: pg\_cron + Edge Functions (기준일 0시 체크리스트 만들기, 알림 발송, 연결 해제 기한, 보관 기간 정리)
- 필드 암호화: 메모와 가족 정보는 Edge Function에서 AES-256-GCM, 키는 AWS KMS
- 알림: 데스크톱 로컬 알림(앱이나 트레이가 켜져 있을 때 Realtime을 받아 Electron Notification으로 표시), 앱 안 알림센터, 이메일(SES), 모바일 푸시(APNs·FCM, Edge Function이 보냄, 기기 토큰은 `push_device` 테이블 예정)

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
    desktop/      Electron main, preload, 트레이 위젯
    mobile/       Capacitor 모바일 앱(iOS, Android) + 개발·e2e용 브라우저 실행
    admin/        어드민 웹
    site/         웹사이트 L-01~L-03, L-05, L-06 (랜딩, 설치 안내, 릴리스 노트, 약관, 고객센터)
  packages/
    ui/           디자인 시스템 토큰, 컴포넌트, 그림
    app/          화면(페이지)과 화면 흐름, desktop과 mobile이 같이 씀
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
- desktop 전용 기능(safeStorage, 트레이, 알림, 업데이트)은 preload가 열어 주는 브리지로만 씀

### 데이터 흐름

1. 화면이 api 훅으로 읽음 (TanStack Query 캐시)
2. 쓰기는 테이블 쓰기 또는 DB 함수 호출, version 값으로 충돌 확인
3. 서버가 change\_log에 기록하고 Realtime으로 변경 신호를 보냄
4. 배우자 기기는 마지막으로 받은 변경 번호 이후만 다시 받음(델타 동기화), 목표 1\~2초

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
- 데스크톱 전용(트레이, PIN, 딥링크)과 모바일 전용(푸시, Face ID)은 여기서 확인 못 함. 그 부분은 e2e(흉내 브리지)와 기기 빌드로
- 개발 서버 데이터는 실제로 가입해서 만듦. 부부 기능은 계정 두 개로 가입 → 초대 코드로 연결

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
- 화면 주소(라우팅): 앱·어드민은 `not_found_handling: single-page-application`(모든 경로에 index.html), 웹사이트는 `404-page`(404.html이 초대 링크 `/i/{코드}`를 맡음)
- 접근 보호: Zero Trust(무료) → Access → Applications → Self-hosted, 앱마다 1개(sweetwo-app, sweetwo-admin, sweetwo-site). 도메인 `dev-app.sweetwo.kr`, `sweetwo-app.yeabin0909.workers.dev`(미리보기까지 막으려면 `*-sweetwo-app.yeabin0909.workers.dev`도). 어드민·웹사이트도 같은 식(`dev-ops`, `dev`). 정책 Allow + Include Emails(허용 이메일). Identity 탭에서 ‘Select all’을 지우고 One-time PIN만, Apply instant authentication 켬. One-time PIN이 목록에 없으면 Zero Trust → Settings → Authentication → Login methods에서 먼저 추가. Cloudflare 계정 로그인은 쓰지 않음(동의 단계에서 ‘Application authorization failed’)
- 스테이징 Supabase → Authentication → URL Configuration: Site URL `https://dev-app.sweetwo.kr`, Redirect URLs `https://dev-app.sweetwo.kr/**`, `https://dev-ops.sweetwo.kr/**`, `https://sweetwo-app.yeabin0909.workers.dev/**`, `https://*-sweetwo-app.yeabin0909.workers.dev/**`, `https://sweetwo-admin.yeabin0909.workers.dev/**`, `https://*-sweetwo-admin.yeabin0909.workers.dev/**`, 로컬 실행용 `http://localhost:5173/**`, `http://localhost:5174/**`
- 스테이징 소셜 로그인: Supabase → Authentication → Providers에서 켜고, 각 콘솔 앱에 콜백 `https://xxofyzgzrjrcrcxvftpn.supabase.co/auth/v1/callback` 등록
  - 구글: 켜짐(2026-10-23). Google Cloud 프로젝트 sweetwo-staging, 웹 애플리케이션 클라이언트, 자바스크립트 원본 `https://sweetwo-app.yeabin0909.workers.dev`(Supabase를 거치는 로그인이라 새 주소를 넣지 않아도 됨). 동의 화면이 ‘테스트 중’이라 로그인할 계정은 대상 → 테스트 사용자에 넣어야 함
  - 카카오: 켜짐(2026-10-23). 로컬과 같은 카카오 앱(Redirect URI에 로컬·스테이징 콜백 둘 다), 이메일 선택 동의, Supabase ‘Allow users without an email’ 켬(거부하면 A-04)
  - 애플: 아직. 사업자 등록 → D-U-N-S → Apple Developer 조직 명의 가입 뒤(기획서 34 4장). 그때까지 개발 서버의 ‘Apple로 시작하기’는 오류

## 로컬 개발 환경

필요할 때만. 개발 서버로 확인하면 로컬 실행은 없어도 됨.

- 기본은 스테이징 DB: `pnpm i` → `pnpm dev`(또는 `pnpm dev:desktop`)만 하면 스테이징 Supabase를 바라봄. Docker와 `pnpm db:start`가 필요 없음
  - 값은 앱마다 커밋된 `.env.development`(apps/mobile, apps/admin, apps/desktop). URL과 anon key(공개 값)만 들어 있음. service role, `sb_secret_` 키는 절대 넣지 않음
  - 개발 서버와 같은 DB라 로컬에서 만든 데이터도 개발 서버에 보임. 로그인은 스테이징에 켠 구글, 카카오로
  - 스키마는 `develop`에 합쳐진 마이그레이션까지만 있음. 아직 합치지 않은 마이그레이션을 화면에서 써 보려면 아래 로컬 DB로
- 로컬 DB(선택): 마이그레이션을 만들거나 pgTAP을 돌릴 때만. `pnpm db:start` 뒤 앱 폴더에 `.env.development.local`을 만들어 로컬 URL과 anon key를 넣음(Vite는 `.env.development.local` > `.env.development` > `.env.local` 순서라 `.env.local`로는 덮이지 않음). 다 쓰면 그 파일을 지우면 다시 스테이징
- 로컬 DB에서는 seed.sql의 찬우, 예빈 부부 데이터가 든 앱이 뜸. e2e는 어느 쪽도 쓰지 않고 `.env.e2e`의 가짜 Supabase를 씀

### 준비물

- Node: 버전은 `.nvmrc`에 고정, `nvm use`
- pnpm: `corepack enable`로 package.json의 `packageManager` 버전을 씀
- Docker(로컬 DB를 쓸 때만). Supabase CLI는 devDependency라 `pnpm db:*`로 씀

### 실행

1. `pnpm i`
2. (로컬 DB를 쓸 때만) `pnpm db:start`: 로컬 Postgres, Auth, Realtime, Storage, Inbucket(Docker). 출력의 API URL과 anon key를 `apps/mobile/.env.development.local`, `apps/desktop/.env.development.local`의 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`에
3. `pnpm dev`: 모바일 화면을 브라우저로 5173(개발용), 어드민 5174. 데스크톱은 `pnpm dev:desktop`. 휴대폰·에뮬레이터는 `pnpm --filter @sweetwo/mobile cap:ios` / `cap:android`(Xcode, Android Studio 필요)
4. 데이터 초기화: `pnpm db:reset` (마이그레이션 + seed.sql 다시 실행)
5. 마이그레이션을 바꿨으면 `pnpm db:test`(pgTAP) → `pnpm db:types`(packages/core/src/db.types.ts 다시 만듦, 손으로 고치지 않음)
6. 컴포넌트 모음: 개발 서버에서 `/dev/ui`(배포 빌드에는 없음)

### 스테이징과 운영 Supabase

- 프로젝트 2개(서울 리전 ap-northeast-2): `sweetwo-staging`(ref `xxofyzgzrjrcrcxvftpn`), `sweetwo-prod`(ref `rilhxjozsdcxcfshtvta`). 연결은 `pnpm supabase link --project-ref <ref>`
- DB 타입 파일은 `pnpm db:types`(로컬 Supabase)로 만들고, 생성기 버전에 따라 줄바꿈만 달라지지 않게 prettier 고정 옵션(`--no-config --no-semi --print-width 100`)으로 맞춰 저장한다. CI db 작업이 같은 명령으로 다시 만들어 공백, 줄바꿈, ; , 를 빼고 비교함(다르면 실패, 결과물 db-types를 받아 커밋)
- 공개 값(URL, anon key)만 앱 `.env.development`(스테이징), `.env.development.local`(로컬), GitHub 환경 변수, Cloudflare 빌드 변수로. service role은 GitHub Secrets와 서버에만

### 환경 변수와 대체물

- `.env.example`은 앱마다 하나: apps/desktop, apps/mobile, apps/admin, apps/site, supabase/functions
- 로컬 대체물: 메일 → Supabase Inbucket, KMS → 로컬 키 어댑터, 공휴일 → fixture 파일
- seed.sql: auth 사용자 찬우, 예빈, 연결된 부부 공간, 이번 달 월 계획
- 이메일, 비밀번호 테스트 로그인: 로컬과 스테이징에서만 켬(E2E용). 운영은 소셜 로그인만

## 데이터 모델과 권한

모든 데이터는 부부 공간(couple\_space) 하나에 속하고, 누가 무엇을 볼지는 서버 RLS가 정함. 상세 필드는 기획서 ‘기술·운영’ 2장과 ‘데이터 항목’ 탭이 기준.

### 공통 필드

- id(uuid), space\_id, created\_by, updated\_by, created\_at, updated\_at
- version: 동시 수정 충돌 확인용. 쓰기마다 +1
- deleted\_at, deleted\_by: 휴지통. 30일 뒤 영구 삭제
- 금액은 bigint 정수 원 단위(소수점 없음), 입력 상한 999억 원(Zod 입력 검증). 날짜는 KST 기준 date
- goal.photo\_path text: 직접 만든 목표의 사진 Storage 경로. null이면 회색 기본 그림(goal-custom), 기본 목표 21종은 항상 null
- app\_user.is\_internal\_tester bool: 내부 테스트 계정 표시, 기본 false. 공개 출시 직전 삭제 대상을 고를 때 씀(→ 운영 절차)
- 통장 하나 모드(couple\_space.account\_mode): account.role과 saving\_deposit.asset\_id는 null 가능. saving\_deposit.goal\_id uuid(null), 연결 자산이 목표에 묶이면 그 목표로 셈
- month\_close.status(초안/완료), step, mode(기본/꼼꼼), party(함께/혼자), locked\_by: 미리 적은 값은 초안으로 저장, 진행 잠금은 locked\_by. 저축 합계는 deposit\_total(W-04k), 꼼꼼 모드 잔액 기준 저축은 balance\_saving
- 함께 모은 달(G-05 축하 문장, 20261101150000 `goal_story`): 그 목표 저금 줄을 체크한 체크리스트 달(‘9월 월급’) 수, 그중 각자 모드 우리 목표에서 두 사람 체크리스트 모두 체크한 달 수. 합쳐서·혼자 쓰기·내 목표는 “n개월 만에 모았어요”
- 순자산 기간 탭의 마지막 선택: 기기별 로컬 저장(서버에 저장하지 않음), 값이 없으면 기본 1년(쓴 지 1년 미만이면 전체)

### 테이블 묶음

| 묶음 | 테이블 |
| --- | --- |
| 부부와 사용자 | couple\_space, app\_user, invite, device\_session, consent, couple\_unlink |
| 자산 | account, asset, debt, fixed\_expense, annual\_event, amount\_history |
| 목표와 월급 | goal, goal\_move, salary\_split, split\_line, pay\_checklist, pay\_check\_line |
| 챙길 날 | care\_day, care\_record |
| 기록과 알림 | partner\_change, notification, mail\_outbox, widget\_setting, photo |
| 결제와 문의 | subscription, payment, inquiry(답변 포함), admin\_view\_request |
| 운영과 어드민 | holiday, notice, maintenance, app\_config, admin\_setting, item\_catalog(항목 이름 목록, 어드민에서 수정), admin\_user, audit\_log, job\_run(예약 작업 실행 기록), peer\_stat(출시 후) |

### 권한 규칙

- RLS 기본값은 막힘. 테이블마다 ‘같은 space의 구성원’만 읽고 씀
- 공개 범위 3단계(전체 공개, 합계만, 비공개)는 RLS와 security\_invoker = true 뷰로 걸러냄(이 옵션 없는 뷰는 소유자 권한으로 RLS를 건너뜀). 클라이언트에서 숨기지 않음
- 목표(20261106090000): 읽기는 우리 목표·내 목표·배우자의 ‘모두 보여 주기’ 내 목표만(‘금액만 보여 주기’는 `space_goals()`가 이름을 가려서 줌), 추가·고치기는 우리 목표 둘 다·내 목표 주인만, 주인은 나 또는 없음(우리)으로만. 앱이 바로 고치는 열만 `grant update`(이름, 형태, 질문 답, 금액, 기한, 이미 모은 돈, 순서, 상태, 주인, 공개 범위, 휴지통). 상태는 진행·지연·보류 사이만(`goal_client_guard`), 달성·사용 완료·사진·템플릿은 함수로만
- 제안·승인 없음(ADR 0003). 누구나 바로 고치고 상대에게 알림(partner\_change 묶음) + 고친 사람에게 Toast ‘되돌리기’
- 오프라인 입력 대기열: `packages/app/src/shared/outbox.ts`(zustand). 입력하는 곳에서 `navigator.onLine`이 거짓이거나 네트워크 오류면 `enqueue` + 쿼리 캐시를 바로 고침(지금: `useCheck`, 목표 `useGoalChange`, F-04 금액). 기기 캐시 파일에 `outbox`로 같이 저장(0.5초 모아서). `MainFrame`의 `useOutboxSync`가 켤 때·online·30초마다 순서대로 보냄: 체크는 `check_pay_line`(closed면 거절), 목표·자산은 `updateIfUnchanged` + `conflictDecision(..., { queued: true })`(배우자가 그 뒤 바꿨으면 시간과 상관없이 고르기). 거절은 ‘보내지 못한 입력’(다시 하기 / 버리기), 7일 넘은 입력이 있으면 자동으로 안 보내고 ‘한 번에 보내기’
- 오프라인 조회 캐시: `packages/app/src/shared/offline-cache.ts`가 TanStack Query 캐시를 `dehydrate`해 브리지 `cache.save`로(3초 모아서), 켤 때 `cache.load` → `hydrate` 뒤에 그림. 데스크톱 `main/offline-cache.ts`(safeStorage로 파일 암호화), 모바일 `native/offline-cache.ts`(보안 저장소의 AES-GCM 키 + Filesystem 데이터 폴더). 로그아웃은 main·네이티브 `signOut`이 지움, 앱은 `signed_out` 뒤 저장을 멈춤. 사진 서명 주소·기기 목록은 빼고, 모양이 바뀌면 `VERSION`을 올림
- 사실 값(잔액 등)은 마지막 쓰기가 이김. 배우자가 1분 안에 같은 필드를 바꿨으면 선택 화면: api `updateIfUnchanged(table, id, patch, base)`가 ‘화면을 열 때 값’(base)이 그대로일 때만 고치고, 아니면 지금 행을 돌려줌 → core `conflictDecision`(same / choose: 배우자 `updated_by` + `updated_at` 1분 안 / overwrite) → 디자인 `ConflictChoice`. 지금은 목표 수정(금액·기한·이름)과 자산 금액(F-04). 분배표·체크리스트·오프라인 대기열은 다음 단계
- 기록(change\_log, amount\_history)은 추가만. 수정과 삭제 권한 없음
- 어드민은 service role을 쓰지 않고 별도 함수로만 읽음. 문의한 사람의 동의(admin\_view\_request)가 있을 때만, 배우자에게 알림, 열람 기록 1년 보관

### 상태가 있는 것

- couple\_state: 미합류, 연결, 해제 대기, 혼자 쓰기
- 상태는 enum으로 두고, 바꾸는 것은 DB 함수만. 허용되지 않은 전환은 함수가 거부

### 동의와 문의

- consent 종류: 이용약관, 개인정보 처리, 배우자와 부부 공간 공유, 가족 정보, 사진(챙길 날), 마케팅 수신, 분석 수집, 통계 참여
- consent 행에는 종류, 약관 버전, 동의 여부, 시각. 철회도 새 행으로 추가
- 문의: 데스크톱·모바일 앱에서 inquiry 테이블에 저장 + help@sweetwo.kr로 사본 메일
- 답변: 어드민 AD-06에서 작성 → 앱 ‘내 문의’와 메일로 전달
- 문의 때문에 데이터를 봐야 하면 문의한 사람의 동의(admin\_view\_request)를 받고, 배우자에게 알림. 열람은 audit\_log에 기록

### 지금 있는 테이블과 함수

> 재기획(2026-10-25, `docs/adr/0003-replan-goal-checklist.md`) 반영. 옛 모델 표·함수는 2단계로 지움: 앱이 더는 안 씀(#122, #123) → DB에서 지움(마이그레이션 20261101180000 `drop_legacy`). 지운 표: proposal, monthly\_plan, plan\_line, month\_close, month\_spend, spend\_category, big\_expense, saving\_deposit, close\_balance, goal\_use, emergency\_move, living\_check, income\_event, income\_item, income\_period, wedding\_item, wedding\_payment, todo, family\_member, unlink\_copy와 그 함수·예약 작업. 열거형과 남는 표의 옛 열(`care_day.member_id`, `asset.goal_id`·`pay_from` 등)은 그대로 두고 새로 쓰지 않음

- 재기획 새 테이블(20261029090000): `salary_split`·`split_line`(월급 분배표, 쓰기는 `save_split`만), `pay_checklist`·`pay_check_line`(이번 달 월급 체크리스트, 만들기는 `start_checklist`만, 사이클은 `cycle_day`·`cycle_date`), `couple_space.salary_mode`·`joint_cycle_day`, `goal.owner_user_id`(null = 우리 목표)·`visibility`
- 목표 돈 움직임(20261029150000): `goal_move`(넣기·빼기·꺼내 쓰기, 쓰기는 `move_goal`·`undo_goal_move`만), 모은 돈 `goal_saved_sums()`, 목표 ↔ 분배표 저금 줄 트리거 `goal_lines`
- 자동 결혼기념일(20261029180000): `care_day.auto`·`auto_moves`, `couple_space` 트리거 → `sync_wedding_care(공간)`
- 배우자 합류(20261030090000): `complete_join`, `set_join_salary_mode`, `discard_prefill`, `joining_space`(내부), `app_user` 트리거 `notify_first_goal`
- 관리 방식(20261030120000): `set_salary_mode`, `set_joint_cycle_day`, `start_checklist`(방식을 바꾼 달은 옛 체크리스트 유지). 휴지통(20261030150000): `trash_rows`, `restore_trash` 제안 없이
- `app_config`, `app_user`(프로필: 호칭, 신랑/신부, 출생연도, 일 형태, `space_id`, 월 실수령, 월급날, 용돈), `consent`, `couple_space`(배우자 추정 수입, 고정지출 합계, 생활비, 대출 상환, 분담 방식), `fixed_expense`(O-36 그룹과 세부 항목), `goal`, `invite`, `account`(O-63 통장 역할), `invite_attempt`(초대 코드 오류 횟수), `asset`·`asset_history`(자산·부채와 금액 이력)
- 공간 소속은 `app_user.space_id`. `is_space_member(space_id)`가 이걸 본다. 공간은 `ensure_my_space()`만 만든다
- 사용자가 직접 못 바꾸는 열(부부 상태, 계정 상태, 로그인 수단)은 열 단위 `grant update`에서 뺀다
- `stamp_actor()` 트리거: created_by, updated_by, 휴지통에 넣을 때 deleted_by를 auth.uid()로. 목표, 고정지출 삭제는 `deleted_at`만(영구 삭제 정책 없음)
- 초대 코드: `create_invite()`(6자리, 0 O 1 I L 제외, 7일). 링크는 `https://sweetwo.kr/i/{코드}`(모바일은 앱 링크로 앱이 바로 엶, (전환 전) app.sweetwo.kr), 데스크톱 딥링크는 `sweetwo://i/{코드}`
- 월 플랜과 플랜 줄은 앱이 직접 못 만들고 못 고친다(읽기만). 첫 플랜은 `start_first_plan()`(O-66, 같은 사이클이면 있는 플랜 id), 이후 플랜은 기준일 작업이 만든다. 줄의 분담액은 신랑, 신부 쪽(`amount_groom`, `amount_bride`)으로 저장
- 기준일은 `couple_space.base_day`(말일은 `base_day_last`), 없으면 두 월급날 중 늦은 날. 통장 방식은 `couple_space.account_mode`
- 만 18세 미만: 가입 때 A-05 ‘만 18세 이상이에요’ 체크로만 확인하고 가입 뒤 나이로 계정을 지우지 않음. 옛 `delete_minor_account`·`delete_underage_account`는 20261103210000에서 지움

### 마이그레이션과 RLS 규칙

테이블은 모두 같은 틀로 만들고, 틀에서 빠지면 리뷰에서 되돌림.

- 공통 컬럼(위 ‘공통 필드’) + `space_id` 인덱스 필수
- 트리거: updated\_at과 version 갱신, change\_log 기록
- RLS 켬 + 이름 붙은 정책 4개(`<테이블>_select`, `_insert`, `_update`, `_delete`)
- 정책은 `is_space_member(space_id)`만 씀. 이 함수는 `STABLE SECURITY DEFINER`, `SET search_path = ''`
- 공개 범위 뷰는 반드시 `WITH (security_invoker = true)`
- pgTAP: 테이블마다 본인, 배우자, 다른 부부, 익명 × 읽기, 추가, 수정, 삭제
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

- 클라이언트가 canvas로 줄임: 프로필과 목표 사진 512px 정사각, 챙길 날 사진 긴 변 1600px
- 다시 인코딩해 EXIF(위치 등) 제거, webp 또는 jpeg로 업로드
- 서버가 MIME과 크기를 다시 확인
- 비공개 버킷, 경로 `space_id/…`, Storage RLS도 `is_space_member`
- 목표 사진: 프로필 사진과 같은 비공개 버킷, 경로 space\_id/goal/{goal\_id}, 커플 단위 접근(Storage RLS is\_space\_member), 크기 상한은 프로필 사진과 같음. 지우면 goal.photo\_path를 null로
- 보기는 서명 URL만(유효 시간 짧게)
- 행을 지우면 파일도 지움. 탈퇴 때 프로필 사진은 30일 유예 없이 즉시 삭제

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

- DB: `RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = '<code>'` (예: `proposal_already_open`)
- api가 `AppError{code, retryable}`로 바꿈 → 화면은 기능 copy.ts의 문구 표에서 찾음
- 오류 코드, 사용자 문구, 재시도 여부는 표 하나(docs/errors.md)로 관리하고 기획서 ‘공통 상태’ 탭과 연결

| 예 코드 | 문구 | 재시도 |
| --- | --- | --- |
| `network_offline` | 공통 상태 탭 ‘오프라인’ 문구 | 자동 |
| `version_conflict` | 충돌 선택 화면 | 사용자 선택 |
| `proposal_already_open` | 제안 화면 문구 | 없음 |

## 동기화와 오프라인

변경은 space별 변경 번호로 줄을 세우고, 기기는 마지막 번호 이후만 받음.

### 변경 번호와 신호

- change\_log.seq는 space마다 1씩 늘어남: couple\_space 행을 잠그고 +1. bigserial이나 시각을 쓰지 않음(트랜잭션 순서와 어긋남)
- 트리거가 Realtime broadcast로 비공개 채널 `space:{id}`에 보냄(테이블, id, seq만. 값은 안 보냄)
- api/realtime.ts에 테이블/id → TanStack 쿼리 키 표를 두고 그대로 무효화
- 트레이 위젯은 서버를 직접 부르지 않고 main 프로세스 캐시를 IPC로 읽음

### 오프라인 큐

- 데스크톱: main 프로세스에 큐. safeStorage로 암호화한 파일 또는 SQLite
- 입력 순서대로 보내고, 실패하면 지수 백오프로 재시도. 같은 `mutation_id`라 중복 반영 없음
- 계속 실패하거나 서버가 거부하면 ‘보내지 못한 입력’ 상태로 보여 주고 다시 보내기, 버리기 선택
- 모바일: 데스크톱과 같은 규칙. SQLite(암호화) 큐, 키는 Keychain·Keystore
- 로컬 캐시 스키마가 바뀌어 옮기기가 실패하면 큐는 남기고 캐시만 비운 뒤 서버에서 다시 받음

### 충돌

- 바뀐 필드만 + 기준 version을 보냄
- 서버 함수가 change\_log에서 그 필드의 마지막 변경(누가, 언제)을 확인
- 배우자가 1분 안에 같은 필드를 바꿨으면 `conflict{field, theirs}` 반환 → 선택 화면. 아니면 마지막 쓰기가 이김
- 삭제와 수정이 부딪히면 삭제가 이기고 항목은 휴지통으로(복구 가능)
- 월말 정리 초안(W-04j·k): 두 사람이 같은 항목을 동시에 적으면 항목별로 나중 저장이 이기고 Toast

### 함께 모드

- Realtime Presence와 Broadcast 채널로 서로의 단계와 커서를 맞춤
- 진행자 잠금 = month\_close.locked\_by(30분 뒤 만료). 끊기면 5분 안에 이어서 하기
- 함께 모드 안에서는 충돌 화면 없이 마지막 저장이 이김

## 인증과 세션

데스크톱은 시스템 브라우저 OAuth(PKCE) + https 콜백 + 딥링크, 토큰은 main 프로세스만 다룸.

### 데스크톱 로그인과 딥링크

- code\_verifier는 main 프로세스 메모리에만, 돌아온 state가 보낸 값과 같은지 확인
- 딥링크 수신: macOS는 `open-url`, Windows는 `requestSingleInstanceLock` + `second-instance`의 argv
- 개발 빌드 등록: `setAsDefaultProtocolClient('sweetwo', process.execPath, [path.resolve(process.argv[1])])`
- 딥링크 허용 목록: `sweetwo://auth/callback`의 code, state만 받고 나머지는 버림. 초대는 `sweetwo://i/{code}`
  - 구현: `apps/desktop/src/main/deep-link-parse.ts`(허용 목록), `deep-link.ts`(받기). 로그인 콜백은 main에만 남고, 렌더러에는 초대 코드만 `window.sweetwo.onInvite`로 감
  - 보안 저장소: `apps/desktop/src/main/secure-store.ts`(main 전용, 렌더러에 노출 안 함)
- 리다이렉트는 https://sweetwo.kr/auth/callback 하나((전환 전) app.sweetwo.kr). 데스크톱은 이 정적 페이지가 code와 state를 sweetwo://auth/callback 딥링크로 넘기고, 모바일은 같은 주소를 앱 링크로 앱이 바로 받음. 루프백(127.0.0.1)은 쓰지 않음(Apple 로그인이 https 리다이렉트만 허용)
- 토큰 갱신은 main 프로세스만. 렌더러(메인 창, 트레이)는 IPC로 access token만 받음
- refresh token은 safeStorage로 암호화해 파일에, 30일 슬라이딩

### OAuth 앱과 리다이렉트

| 제공자 | 로컬 | 스테이징 | 운영 |
| --- | --- | --- | --- |
| 카카오 | 개발용 앱 | 스테이징 앱 | 운영 앱 |
| 구글 | 개발용 클라이언트 | 스테이징 클라이언트 | 운영 클라이언트 |
| 애플 | 개발용 Services ID | 스테이징 Services ID | 운영 Services ID |

- 카카오: 이메일은 선택 동의 항목. Supabase 카카오 설정에서 ‘이메일 없는 사용자 허용’을 켜야 거부한 사람이 A-04로 감(로컬은 config.toml `email_optional = true`)
- Supabase Auth 리다이렉트 허용 목록: 환경마다 그 환경의 콜백 주소 하나. 쿼리(`?from=desktop&state=…`)를 붙여 같은 주소를 거치므로 끝에 `**`를 붙인다
  - 운영 `https://sweetwo.kr/auth/callback**`(웹사이트 `apps/site/src/pages/auth/callback.astro`, from=desktop·app만 sweetwo://로 넘김), 스테이징 `https://dev-app.sweetwo.kr/**`(앱 묶음의 같은 복귀 화면), 로컬 `http://localhost:5173/auth/callback**`
- 데스크톱 흐름(구현): main이 code_verifier와 state를 만들고 `{SUPABASE}/auth/v1/authorize?provider=…&redirect_to={사이트}/auth/callback?from=desktop%26state=…&code_challenge=…&code_challenge_method=s256`을 기본 브라우저로 엶 → 콜백 페이지(웹사이트 `apps/site`, (전환 전) `packages/app` `auth-callback.tsx`)가 code(취소면 error)와 state를 `sweetwo://auth/callback`으로 넘김 → main이 state를 확인하고 `/auth/v1/token?grant_type=pkce`로 교환
  - 파일: `apps/desktop/src/main/auth.ts`(로그인, 갱신, 로그아웃), `pkce.ts`(+ 테스트), `ipc.ts`(보낸 창 확인 + Zod), `lock.ts`(A-06)
  - 렌더러의 supabase-js는 `accessToken` 옵션으로 브리지에서 access token만 받는다(`supabase.auth`는 데스크톱에서 쓰지 않음)
  - main이 읽는 값: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_WEB_ORIGIN`(콜백 페이지 주소의 출처, apps/desktop/.env.development, 공개 값만)
- 같은 이메일, 다른 소셜(A-02 ‘자동 합치기 없음’): Supabase는 확인된 같은 이메일의 소셜 계정을 한 사용자로 자동 연결한다. 그래서 로그인 직후 `login_state(누른 제공자)`가 가입한 제공자와 다르면 `provider_conflict`를 돌려주고, 앱은 바로 로그아웃한 뒤 “이미 {카카오}로 가입한 이메일이에요”를 보여 준다. 계정 식별은 가입 때 제공자(`app_user.provider`)
- 가입: 소셜 로그인만으로는 계정이 아니다. A-05 ‘동의하고 계속하기’의 `complete_signup()`이 `app_user`와 동의 기록(필수 3종 + 마케팅)을 한 번에 만든다. 필수 ‘만 18세 이상이에요’ 체크는 동의 종류가 아니라 확인 기록 `app_user.adult_confirmed_at`(가입 시각, 20261101230000). 나이로 가입 뒤 계정을 지우지 않음(옛 `delete_underage_account`·`delete_minor_account`는 20261103210000에서 지움). 웹(개발·e2e)도 앱처럼 로그인을 유지(localStorage, ‘이 기기에서 로그인 유지’·14일·30분 잠금 없음) 그 전에 그만두면 auth 사용자만 남음(정리 작업은 예약 작업 단계에서)

### 모바일 세션

- 데스크톱과 같은 흐름: 시스템 로그인 창으로 authorize(redirect_to = `{VITE_WEB_ORIGIN}/auth/callback?from=app&state=…`) → 웹 콜백 페이지가 code와 state만 `sweetwo://auth/callback`으로 넘김 → state 확인 → `grant_type=pkce` 교환
  - iOS: ASWebAuthenticationSession(앱 안 플러그인 `WebAuthPlugin`, `ios/App/App/SceneDelegate.swift`의 `MainViewController`가 붙임). 창이 sweetwo://를 받자마자 닫히며 결과를 줌
  - Android: Custom Tabs(`@capacitor/browser`) + `sweetwo` 스킴 intent-filter(`appUrlOpen`). 창을 그냥 닫으면 1.5초 뒤 취소로
  - 파일: `apps/mobile/src/native/`(`bridge.ts` 브리지 조립, `auth.ts` 로그인·토큰, `pkce.ts`, `lock.ts`, `store.ts` 보안 저장소). 화면 코드(packages/app)는 `window.sweetwo`만 봄(플랫폼 `ios`·`android`, 데스크톱과 같은 모양에 위젯·OS 알림만 없음)
  - 링크 허용 목록은 데스크톱과 같은 `packages/core/src/deep-link.ts`(sweetwo://와 모바일 앱 링크 https://sweetwo.kr/i/*, /n, /n/settings)
- refresh token은 Keychain(iOS)·Keystore(Android)에(`@aparajita/capacitor-secure-storage`, 이 기기에만), 30일 슬라이딩. 렌더러(웹뷰)의 supabase-js는 데스크톱처럼 `accessToken` 옵션으로 브리지에서 access token만 받음
- 로그인된 기기 이름: 웹뷰 User-Agent에 `sweeTwo`(capacitor.config `appendUserAgent`) → S-15 “휴대폰 앱(iOS)”
- 웹뷰 안 CSP는 데스크톱과 같음(인라인 스크립트 금지, 연결 대상은 Supabase, PostHog, Sentry만). 원격 화면 코드를 내려받지 않음(코드 바꿔 넣기 업데이트 안 씀)
- 앱 링크 확인 파일: sweetwo.kr/.well-known/apple-app-site-association, assetlinks.json(`apps/site/src/pages/.well-known/`, 값은 빌드 환경 변수 `PUBLIC_APPLE_TEAM_ID`, `PUBLIC_ANDROID_CERT_SHA256`, 없으면 빈 목록). 경로는 /i/*와 알림 메일 링크(/n, /n/settings)만. 로그인 복귀는 sweetwo://로만
- 최소 지원 버전: `app_config.min_version_ios`·`min_version_android`(AD-16 승인 시 반영). 미만이면 A-01 ‘지금 업데이트’ → 웹사이트 /download(스토어 안내). 공지 대상 플랫폼 `mobile`(AD-10)
- 개발: `pnpm --filter @sweetwo/mobile cap:sync` 뒤 Xcode·Android Studio. `.env.development`의 `VITE_WEB_ORIGIN`(스테이징 dev-app.sweetwo.kr, Cloudflare Access 뒤라 로그인 창 브라우저에서 Access를 먼저 통과해야 함)

### 잠금

- MVP: PIN 6자리 + macOS Touch ID(`systemPreferences.promptTouchID`)
- PIN은 main에서 scrypt 해시로 safeStorage 저장소에(`app-lock`), 틀린 횟수도 main이 셈. 5회면 PIN 지우고 로그아웃
- 자동 잠금: 시스템 입력이 5분 없을 때, 화면 잠금, 절전. Ctrl(⌘)+L. 잠금 화면은 앱 전체를 덮어 금액이 보이지 않음
- safeStorage를 못 쓰는 환경(키체인 없는 Linux 등)에서는 PIN과 refresh token을 저장하지 않는다(다음 실행 때 다시 로그인)
- Windows Hello는 네이티브 모듈이 필요해 출시 후
- 모바일(`apps/mobile/src/native/lock.ts`): PIN은 PBKDF2(SHA-256, 21만 번) 해시로 Keychain·Keystore에, 틀린 횟수도 같이(5회면 PIN 지우고 로그아웃). 생체 인증은 `@aparajita/capacitor-biometric-auth`(iPhone Face ID·Touch ID, Android BiometricPrompt, 문구는 `LockStatus.bioKind`로 “Face ID로 풀기”, “지문으로 풀기”). 자동 잠금은 앱이 뒤로 간 지 N분(S-15, 기본 5분). 최근 앱 화면에는 가림 화면(`@capacitor/privacy-screen`: iOS 흐림, Android 스플래시)

## 예약 작업과 알림

예약 작업은 pg\_cron(UTC)이 부름. DB 안에서 끝나는 작업(알림 만들기, 보관 기간 정리)은 SQL 함수를 바로 부르고, 바깥 서비스(메일 SES, 특일 API)가 필요한 작업만 Edge Function. 시각은 초안.

### 예약 작업

> 재기획(ADR 0003) 반영(마이그레이션 20261031090000). 모두 pg\_cron이 SQL 함수를 부름(pg\_cron이 없는 로컬·CI에서는 예약만 건너뜀). 옛 월 계획 만들기, 생활비 체크 예약은 없앰.

| 작업(cron 이름) | KST | cron(UTC) | 함수 |
| --- | --- | --- | --- |
| 기준일 체크리스트(`cycle-checklists`): 지금 관리 방식의 분배표마다(각자 = 주인 것, 합쳐서 = 공동 것) 이번 사이클 체크리스트, 지난 사이클은 닫고 체크 안 한 줄은 ‘못 함’ | 매일 00:00 | `0 15 * * *` | `run_cycle_checklists()` → `make_checklist(공간, 주인)` |
| 오전 알림(`send-morning-notifications`): 챙길 날 D-30·D-14·D-7·당일(두 사람), 월급날(그날 시작한 체크리스트 주인, 합쳐서 = 둘 다), 만기 D-60(명의자, 자산만), 만기일 당일 만기된 돈 정리(→ F-04a), 전세 계약 만기 6개월 전(둘 다), 연말정산 준비(1월 둘째 주 월요일, 결혼한 부부 둘 다 → 가이드 체크리스트 `year-end-tax`), 초대 코드 만료 3일·1일 전과 만료 다음 날(합류 전 공간, 가장 최근 코드) | 매일 09:00 | `0 0 * * *` | `send_morning_notifications()` |
| 저녁 알림(`send-evening-notifications`): 월말 확인(사이클 끝 2일 전 = 다음 기준일 3일 전, 체크 안 한 줄이 있는 체크리스트 주인) | 매일 20:00 | `0 11 * * *` | `send_evening_notifications()` |
| 연결 해제 확정(`unlink-deadlines`, 요청 + 14일) | 매일 09:00 | `0 0 * * *` | `run_unlink_deadlines()` |
| 보관 기간 정리: 알림 90일, 해제한 원래 공간 30일, 삭제 계정 30일, 휴지통 30일 | 매일 04:00~04:45 | `0 19 * * *`부터 15분 간격 | `purge_notifications()`, `purge_unlinked_spaces()`, `purge_deleted_accounts()`, `purge_old_trash()` |
| 어드민 잠금, 열람 기간 끝 | 매일 04:50, 매시 5분 | `50 19 * * *`, `5 * * * *` | `lock_idle_admins()`, `run_access_expiry()` |
| 배우자 변경 묶어 보내기(`flush-partner-changes`) | 매분 | `* * * * *` | `flush_partner_changes()` |
| 배우자 변경 주간 요약(`send-weekly-summary`) | 월 09:00 | `0 0 * * 1` | `send_weekly_summary()` |
| 메일 깨우기(`kick-mail`): 보낼 메일이 있으면 pg_net으로 `send-mail` | 매분 | `* * * * *` | `kick_mail()` |
| 다음 단계: 공휴일 받기(월 03:00) | | | |

- (다음 단계) 재시도: 함수 안에서 space 단위로 3회 지수 백오프. 끝내 실패하면 job\_run에 남기고 알림(‘운영 절차’)
- space마다 `pg_try_advisory_xact_lock`으로 중복 실행 막음. 작업은 멱등하게(두 번 돌아도 결과 같음)
- (다음 단계) job\_run: 작업, 시작, 끝, 처리한 space 수, 실패 목록
- 다시 실행: `select public.run_cycle_checklists('YYYY-MM-DD')`, `select public.send_morning_notifications('YYYY-MM-DD')`(체크리스트는 사이클마다 하나, 같은 알림은 `dedupe` 키로 한 번만이라 다시 돌려도 됨). 한 공간이 실패해도 다른 공간은 계속(경고만 남김)

### 알림

- 테이블 `notification`(받는 사람, 종류, 문구, OS 알림 문구·숨김, 갈 화면, 아이콘, 한 사람, dedupe, 읽음). 앱은 내 것만 읽고 `mark_notifications_read`로 읽음만. 쓰기는 서버(트리거·예약 작업)만
- 바로 만드는 알림: 배우자 합류(`couple_space` not_joined → connected 트리거), 첫 목표(`notify_first_goal`), 관리 방식(`set_salary_mode`), 목표 달성(`achieve_goal`, 두 사람), 연결 해제·다시 연결. `check_pay_line`: 배우자 대신 체크 → 주인(`behalf_checked`, 줄마다 한 번, “{줄}에 {금액}”, 줄 이름은 `pay_line_noun`), 각자 체크리스트를 주인이 다 하면 → 상대(`partner_done`, 인앱만, `/salary?who=주인` = W-02 그 사람 탭)
- 배우자 변경(20261031120000): 바로 알리지 않고 `partner_change`(고친 사람, 받는 사람, 항목, 전 → 후 문구 값, 바로/주간)에 쌓음. 기록은 `log_partner_change`(연결·해제 대기, 고친 사람 = auth.uid(), 같은 값이면 안 남김). 쌓는 곳: 우리 목표 트리거(금액·기한·삭제 = 바로, 이름·순서·형태·보류·추가·되살리기 = 주간), 목표 넣기·빼기·꺼내 쓰기(`goal_move`, 되돌리기 = 빈 값), 자산 트리거(주간, 비공개 개인 항목 빼고, 합계만 보여 주는 개인 항목은 “개인 자산 금액이 바뀌었어요”), 챙길 날 추가·메모(주간), 월급 금액(바로), `save_split`(줄마다 전·후 비교 `log_split_changes`, 처음 만들 때는 빼고), `set_joint_cycle_day`(주간). 내 목표는 남기지 않음
- 묶어 보내기 `flush_partner_changes()`(pg_cron `flush-partner-changes` 매분): (고친 사람, 받는 사람)마다 첫 변경부터 10분 지난 묶음을 같은 항목끼리 처음 전 값 → 마지막 후 값으로 합치고 같으면(되돌리기) 버림. 바로 알림은 `partner_change` 하나(여럿이면 “{이름}님이 n가지를 바꿨어요”), 주간은 `partner_activity`(silent) 하나. 월요일 09:00 `send_weekly_summary()`(`send-weekly-summary`): 지난 7일 합친 변경 수 “이번 주 {이름}님이 바꾼 게 n개 있어요” → `/notifications`. 같은 내용을 주간 요약 메일로도 쌓음(`enqueue_mail`, 20261101120000). 다른 묶음 메일·보안·문의 메일은 다음 단계
- 알림 묶음 `notification.topic`(생성 열, S-14 토글과 맞춤): plan(월급날, 월말 확인, 첫 목표), partner_change(대신 체크, 배우자 변경 묶음, 관리 방식, 주간 요약), silent에는 배우자 활동 기록(`partner_activity`)도, money(만기, 만기된 돈 정리, 전세 만기, 연말정산), goal(달성), invite(합류, 초대 리마인드·만료), care_n(챙길 날), silent(인앱만, core `pushAllowed`가 늘 false: 배우자 체크 다 함, 활동 기록), 그 밖 other(끌 수 없음). 앱 아이콘은 `features/notifications/view.tsx` ICON(Phosphor 이름 → 디자인 시스템 아이콘, 없으면 종)
- 챙길 날 날짜는 서버도 앱과 같게: 음력은 `lunar_date` 표(2025~2050년, korean-lunar-calendar로 만든 행, 윤달 행이 없으면 평달), `care_date_in_year`·`care_next_date`. 월급날 앞당기기는 `business_day_on_or_before`(holiday 표)
- 문구는 기획서 14 표 그대로, 조사는 `ko_subj`·`ko_obj`·`ko_is`, 금액은 `read_won`(core readWon과 같음). 서프라이즈는 만든 사람에게만 + OS 알림 제목 “챙길 날 알림이 있어요”, 본문 숨김(`push_hidden`)
- 앱: 종 점(`fetchHasUnread`), 넓은 창 N-01 패널(ui `NotificationPanel` 시트), 좁은 창 N-02 `/notifications`, 묶음·시간은 core `notiGroup`·`notiTime`, 금액 가리기는 `maskMoney`. 누르면 읽음 + 그 화면. Realtime으로 새 알림을 받아 목록·점을 고치고, 데스크톱이면 브리지 `notify.show`로 OS 알림(방해 금지 22~08시엔 센터에만). OS 알림을 누르면 main이 id만 렌더러로 보내고 렌더러가 갈 화면을 찾음
- 메일(20261101120000): DB가 `mail_outbox`에 쌓고(`enqueue_mail(사람, 종류, 묶음, 제목, 글, HTML, 상한에 셈, dedupe)`: 받는 방법 이메일·그 묶음 이메일이 켜져 있고 월 6회 상한 안일 때만) → 1분마다 `kick_mail()`이 보낼 메일이 있으면 pg_net으로 Edge Function `send-mail` 호출 → 함수가 `claim_mail`로 꺼내 SES API v2 SendEmail(서명 v4는 `_shared/sigv4.ts`, AWS 서명 시험 get-vanilla로 확인)로 보내고 `finish_mail`(실패는 3번까지 다시). 지금 보내는 메일은 배우자 변경 주간 요약(상한 밖, 본문 `weekly_mail_body`: 바뀐 것 전 → 후 최대 20줄, 이번 달 월급 “n개 중 m개 했어요” [확인 필요], 남은 할 일(월말 확인), 앱에서 보기 `https://sweetwo.kr/n`, 알림 설정 `https://sweetwo.kr/n/settings`)
- 알림 메일 링크: 웹사이트 `/n`, `/n/settings`가 `sweetwo://n`, `sweetwo://n/settings`로 앱을 열고(데스크톱 `deep-link-parse.ts` 허용 목록, 알림 센터·S-14만), 앱이 없으면 “sweeTwo 앱에서 열어 주세요” + ‘앱 받기’(→ /download)
- 함수 드라이버 `MAIL_DRIVER`: `ses`면 보냄, 그 밖(기본)은 보내지 않고 보낸 것으로만 표시(로컬·스테이징에서 실수로 보내지 않게). 시험은 `deno test --no-config --no-lock supabase/functions/`(CI check)
- 반송·수신 거부(20261103180000): SES 구성 세트(`SES_CONFIGURATION_SET`) 이벤트 Bounce·Complaint → SNS 주제 → Edge Function `mail-events`(HTTPS 구독, 주소 `?token=` = `MAIL_EVENTS_SECRET`, `TopicArn` = `MAIL_EVENTS_TOPIC_ARN`, 구독 확인은 sns.*.amazonaws.com 주소만 엶). 영구 반송·신고만 `note_mail_event` → `mail_suppress`(주소마다 반송 수, 신고). 2번 반송이거나 신고면 `mail_outbox`에 넣지 않음(트리거). 반송마다 그 주소를 쓰는 사람에게 인앱 알림 `mail_bounced`(메일로 다시 보내지 않음) + 홈 띠(`my_mail_bounced()`, 주소를 바꾸면 사라짐)
- 아직: 핵심 알림 메일(연결 해제 등)과 ‘푸시를 받을 수 없는 사람’ 판단, 방해 금지 끝나는 시각에 다시 보내기, 묶음 알림의 바뀐 것 목록 화면, 모바일 앱 링크(AASA·assetlinks)
- 데스크톱 알림은 로컬: 앱이나 트레이가 켜져 있으면 Realtime을 받아 OS 알림으로 표시
- 모바일 푸시는 서버(20261104120000): 기기 토큰은 `push_device`(앱이 `register_push_device`로 등록, 로그아웃 때 `unregister_push_device`, 같은 토큰은 마지막 등록한 사람 것). `kick_push()`(pg_cron `kick-push` 1분마다, 보낼 것이 있을 때만 pg_net, Vault `push_function_url`·`push_cron_secret`) → Edge Function `send-push`가 `claim_push`(12시간 안, `push_wanted` = S-14 받는 방법·묶음, 인앱만(silent) 빼고, 방해 금지는 끝날 때까지 미룸, 보안·계정은 바로, 꺼낼 때 `notification.pushed_at`) → iOS APNs HTTP/2(.p8 토큰, `_shared/push.ts`), Android FCM HTTP v1(서비스 계정 OAuth) → 410·UNREGISTERED 토큰은 `drop_push_tokens`. `PUSH_DRIVER`=`send`일 때만 보냄(그 밖은 로그만). 서프라이즈는 `push_title`과 본문 숨김 그대로
- 사진(20261105090000): 저장소 `photos` 버킷(비공개, JPEG, 3MB). 경로는 무작위 `g/{uuid}.jpg`(목표, 정사각 512px)·`r/{uuid}.jpg`(챙길 날 기록, 긴 변 1600px). 앱이 줄이고 다시 그려 올린 뒤(`packages/app/src/shared/photo.ts`, EXIF 위치 정보 없음) `set_goal_photo`·`add_care_photo`로 붙임(내가 올린 파일만). 읽기는 `photo` 행을 볼 수 있을 때만(목표 공개 범위, 비밀 챙길 날 그대로), 보여 줄 때 1시간 서명 주소. 지우기: `photo` 행이 지워지면(목표·기록·부부 공간과 함께) `storage_purge`에 쌓고, 계정 삭제 요청 때 프로필 사진도 쌓음 → `kick_purge()`(pg_cron `kick-purge` 10분마다, 지울 것이 있을 때만, Vault `purge_function_url`·`purge_cron_secret`) → Edge Function `purge-storage`가 Storage API로 지움(하루 넘게 붙지 않은 파일 포함)
  - 앱: 브리지 `push`(`apps/mobile/src/native/push.ts`, `@capacitor/push-notifications`). 로그인한 뒤 허용돼 있으면 토큰 등록(`usePushRegistration`), 허용 묻기는 합류 직후 1회(P-11)와 S-14 ‘푸시 알림’ 켤 때. 앱이 화면에 떠 있으면 OS 알림 없이(capacitor.config `presentationOptions: []`) 앱 안 토스트, 누르면 그 알림 읽음 + 그 화면
- 메일로 대신: 모바일 푸시 기기가 없고 데스크톱 presence 신호도 최근 10분간 없을 때(`mail_missed_notifications`가 `push_device`를 봄)
- 앱 안 알림센터에는 항상 기록
- 상한은 메일만 계정마다 월 6회. 푸시(모바일 푸시, 데스크톱 로컬 알림)와 알림센터는 상한 없음. 주간 요약 메일과 푸시를 받을 수 없는 사람의 핵심 알림 메일은 상한 밖
- 마케팅 메일은 월 1회, 수신 동의한 사람만
- 방해 금지 22\~08시(KST): 끝나는 08시에 보냄
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

- 브랜드 색(오렌지)은 워드마크, 주 버튼, 달성 배지, 새 알림 점, 결과 카드(ResultCard) 체크, 온보딩 챕터 진행 막대(ChapterBar)에만(순자산 차트 끝점은 없음). 카드 바탕에 쓰지 않음. 보조 버튼의 옅은 오렌지(`brand-soft`)는 카드 안과 O-01 ‘초대받았어요’에만
- 아이콘은 Phosphor(굵은 선). 켜진 메뉴와 독 칸만 채운 모양
- 금액과 날짜 표기는 core의 포맷 함수 하나로만 (디자인 시스템 ‘금액 표기’, ‘날짜·시간 표기’ 장)

### 그림과 장면 자리

- 목표 그림 21장, 빈 상태 그림 1장: Illustrations 묶음, 배경을 지운 512px. 앱에는 webp(투명, 품질 90)로 넣음(`packages/ui/src/assets/illustrations`). 디자인 시스템 원본은 PNG. 모두 같은 무광 3D 그림체(심볼은 평면 파이 차트라 그림체가 다름). `object-fit: contain`
- 앱 아이콘(평면 파이 차트, 2026-10-18 교체): app-icon.png(1024), app-icon-macos.png, symbol.png(바탕 없음 512, 트레이·공유 이미지·랜딩), favicon-32/48.png, apple-touch-icon.png(180). 설치 파일용 .icns와 .ico, macOS 트레이 템플릿(한 색 실루엣)은 개발할 때 만듦
- 장면 그림 5장과 장면 영상 5개는 없앰(2026-10-19). W-04, P-11, P-01, H-T1, A-02의 장면 자리는 그림 없이 비워 둠
- 그림은 앱에 포함해 배포(네트워크 없이도 보이게). 데스크톱·모바일 모두 앱 묶음 안에

### 자산 파일 규칙

- 파일 이름: `<종류>-<이름>.webp` (예: `goal-04-home.webp`)
- 크기 상한: 그림 150KB. `pnpm check:assets`(scripts/check-assets.mjs), CI가 넘으면 멈춤
- 그림은 `<Illustration name>`, 빈 상태는 `<EmptyState>`로만 씀. 파일을 직접 import하지 않음
- 장면 자리는 `<SceneMedia>` 컴포넌트 하나로만: 지금은 그림 없이 영역만 잡아 비워 둠

### 디자인 시스템 갱신 절차

1. `docs/design/`(tokens.css, bundle.css, 컴포넌트 md)를 고친 뒤 `pnpm ds:sync`가 packages/ui로 복사하고 파일 머리에 커밋 번호를 주석으로 남김
2. `pnpm --filter @sweetwo/mobile e2e`로 컴포넌트 모음(/dev/ui)을 라이트, 다크, 좁은 창에서 돌리고 스크린샷(test-results)으로 바뀐 곳 확인
3. 담당자(디자인 시스템 오너) 승인 후 합침

## 개발 규칙

모든 변경은 PR로 들어가고, 타입 검사와 테스트를 통과해야 합쳐짐.

### 폴더와 파일 구조

화면 코드는 기능(feature) 단위로 묶고, 한 기능의 화면, 쿼리, 문구는 같은 폴더에 둠. 기획서 화면 ID(A-02, P-11 등)가 파일 이름에 들어가 기획서와 코드를 바로 잇을 수 있게 함.

```
apps/desktop/
  src/
    main/                 Electron 메인 프로세스
      index.ts            창, 딥링크(sweetwo://), 단일 인스턴스
      tray.ts             트레이 위젯 창
      secure-store.ts     refresh token, 캐시 키 (safeStorage)
      notifications.ts    OS 로컬 알림
      updater.ts          electron-updater
      ipc/                IPC 핸들러, 채널 하나에 파일 하나
    preload/
      index.ts            contextBridge로 window.sweetwo 노출
    renderer/
      main.tsx            packages/app의 <App platform="desktop"/>
  electron.vite.config.ts
  electron-builder.yml

apps/mobile/
  src/main.tsx            packages/app의 <App platform="ios"|"android"/>, 브라우저 개발·e2e는 흉내 브리지
  vite.config.ts
  capacitor.config.ts
  ios/, android/          Capacitor 네이티브 프로젝트(Xcode, Gradle)
  e2e/                    Playwright(흉내 Supabase), /dev/ui 스크린샷

apps/site/                Astro 정적 사이트, Cloudflare Workers 정적 자산(wrangler.jsonc)
  src/pages/
    index.astro           L-01 랜딩
    download.astro        L-02 설치 안내 (?os=mac|win)
    releases.astro        L-03 릴리스 노트
    terms.astro, privacy.astro   L-05 약관과 처리방침
    help.astro            L-06 고객센터
    i/[code].astro        초대 링크 (앱 열기, 앱이 없으면 코드 + 스토어·다운로드)
    auth/callback.astro   로그인 복귀 페이지(code, state → sweetwo:// 딥링크)
  public/.well-known/     apple-app-site-association, assetlinks.json
  src/lib/os.ts           OS 인식, 다운로드 주소
  src/content/            릴리스 노트, 약관, FAQ 원본 (마크다운)

packages/app/src/
  app.tsx                 라우터, 쿼리 클라이언트, 테마
  routes.tsx              경로 표 (화면 ID 주석)
  platform.ts             desktop/ios/android 차이 (브리지가 알려 줌)
  features/
    auth/                 A 화면
    onboarding/           O 화면
    pairing/              P 화면 (초대, 합류, 해제)
    frame/                앱 기본 틀(MainFrame), 순자산 카드, 공지 띠, 트레이 위젯 값, 홈·트레이 공통 할 일·일정 재료
    home/                 H 화면 (홈)
    salary/               W 화면 (월급 분배표, 체크리스트, 월말 확인)
    goals/                G 화면
    assets/               F 화면
    calendar/             Y 화면
    notifications/        N 화면
    settings/             S 화면 (프로필 사진 S-11e 포함)
    widget/               WG 화면 (트레이 위젯)
  shared/                 여러 기능이 쓰는 훅, 레이아웃

packages/app/src/features/goals/     한 기능 폴더의 생김새
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
  goals.ts                useGoals, useCreateGoal 등 (테이블 묶음마다 파일 하나)
  storage.ts              프로필 사진, 목표 사진, 챙길 날 사진 올리기

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
  seed.sql                찬우, 예빈 부부 테스트 데이터
```

### 이름 규칙

| 대상 | 규칙 | 예 |
| --- | --- | --- |
| 파일, 폴더 | kebab-case | `use-goal-form.ts` |
| 화면 파일 | 화면 ID + 이름 | `w-02-checklist.tsx` |
| React 컴포넌트 | PascalCase, 화면은 ID 붙임 | `GoalListPage`, `W04MonthCloseDone` |
| 훅 | use + 동사나 명사 | `useGoals`, `useApplyProposal` |
| DB 테이블, 컬럼 | snake\_case, 단수 | `monthly_plan.apply_on` |
| DB 함수 | 동사\_대상 | `apply_proposal`, `close_month` |
| 마이그레이션 | 시각\_동사\_대상 | `20261020093000_add_avatar_path.sql` |
| Edge Function | kebab-case 동사 | `send-weekly-summary` |
| 분석 이벤트 | 대상\_동사 과거형 | `proposal_applied` |
| 환경 변수 | 대문자, 앱에 보이는 것만 VITE\_ | `VITE_SUPABASE_URL` |

### import 규칙

- 방향은 한쪽만: apps → app; app → api, ui, core; api → core; ui → core(ui는 app, api를 모름). 거꾸로 가면 lint 오류(eslint-plugin-boundaries)
- 기능 폴더끼리는 서로의 index.ts로만. 다른 기능의 안쪽 파일을 직접 부르지 않음
- 패키지는 `@sweetwo/app`, `@sweetwo/api`, `@sweetwo/ui`, `@sweetwo/core` 이름으로
- packages/app은 Electron을 모름. desktop 전용 기능은 platform.ts의 `window.sweetwo` 브리지로만

### 온보딩 구조

재기획(ADR 0003) 온보딩 11화면: O-10 → O-03 → O-06 (→ O-07) → O-11 → O-12 → O-13 → O-21 → O-23 → O-24 → O-30 → O-31 → O-50 → O-60 → 홈.

- `packages/app/src/features/onboarding`: `flow.ts`(답에 따라 화면 목록, 진행 막대 하나 `progressOf`: O-03~O-50 질문 중 지금까지, O-10·O-60 없음), `step.tsx`(진행, 뒤로, 저장 뒤 다음, 멈춘 화면 기록, `finish`), `pages/o-xx-*.tsx`(화면 하나 = 파일 하나), `onboarding-route.tsx`(경로 `/onboarding/o-10` → 화면, 이어하기 `OnboardingGate`)
- O-21에서 고른 목표는 모두 우리 목표(`goal.owner_user_id` null). 비상금은 자동으로 만들고 금액은 O-50 저장 때 (고정지출 + 생활비) × 3, 기한 1년 뒤
- 결혼 비용은 보통 템플릿(가족 탭, 결혼 준비 중이면 ‘자주 고르는’ 맨 앞 + 추천). 질문 ② 모아둔 돈은 템플릿 `held` → `goal.other_held`, 기한 기본값은 O-12 예정일(없으면 1년 뒤 추정)
- O-30 월급 관리 방식 `couple_space.salary_mode`(각자 `separate` / 합쳐서 `joint`), O-31 월급 `app_user.monthly_income`·`income_variable`·`payday`·`payday_last`
- O-50 분배표: 추천값은 core `rules/salary-split.ts` `recommendSplit`(앱 쪽 순서·변환은 `split-draft.ts`). 줄을 누르면 같은 화면이 금액 입력(Q3)으로 바뀜, ‘+ 줄 추가’는 이름 + 금액. 저장은 RPC `save_split(p_lines, p_owner)`(각자면 내 id, 합쳐서면 생략)
- O-60 결과: core `goalEta`(오늘 + 남은 금액 ÷ 저금 줄 금액, 올림). ‘시작할게요’ → RPC `start_checklist`(지금이 든 사이클 체크리스트, 월급날이 없으면 만들지 않음) → `useStep().finish`(onboarding_done_at) → 홈
- 다른 화면에서 고치러 온 길(`?return=`)은 멈춘 화면으로 기록하지 않는다
- 화면을 넘길 때마다 서버에 저장하고, `app_user.onboarding_step`에 멈춘 화면 ID. 다시 열면 그 화면부터(‘이어서 할까요?’ 확인은 아직 없음)
- 결혼기념일 챙길 날은 `couple_space` 트리거 `sync_wedding_care`가 자동 등록(20261029180000). 연결 해제 뒤에는 S-12h → O-11부터(`start_after_unlink`)
- 아직 없는 것: ‘이어서 할까요?’, 해제 뒤 O-13 건너뛰기, 오프라인 저장. 옛 결과·진단·플랜 계산(`result.ts`, core `plan`·`expenses`·배분 조정·진단)은 지움
- 목표 템플릿, 질문 순서, 기본 기한, 월 필요액, ‘잘 모르겠어요’ 구간값은 `packages/core/src/onboarding`(Vitest). 화면은 이 정의만 읽는다
- 질문 입력 부품은 `packages/ui/src/components/question`(Q1 ChoiceCards, Q3 AmountInput, Q4 YearInput/DateInput/YearMonthInput/DayChips/DateWheel(`yearOnly`), Q5 ShortText, 비율 PercentSlider, Q6 ListInput)
- e2e는 `apps/mobile/e2e/onboarding-mock.ts`의 메모리 DB(`save_split`, `start_checklist` 흉내 포함)로 흐름을 끝까지 돌리고 저장된 값을 확인. 날짜는 `page.clock.setFixedTime`으로 10월 7일에 고정

### 홈과 월급 체크리스트 구조

재기획(ADR 0003) 홈과 W 화면. 기획 → 19 홈, 20 월급 체크리스트, 07 월 사이클.

- `packages/app/src/features/home`: `pages/h-01-home.tsx`(앱 틀 `MainFrame` + 오늘 띠(인사 H-01, ‘월급 체크하기’) + 할 일 한 줄 H-06(연결 해제 요청 받음 → 다시 연결 요청 받음 → 월말 확인 → 초대(7일 닫기, 기기 저장) → 목표 금액 정하기 → 만기(F-04a)·챙길 날(7일 안). 만기·챙길 날 닫기는 항목 + 날짜로 기기 저장) + 두 단(목표 H-02, 이번 달 월급 H-03 / 우리 자산 H-04, 다가오는 일정 H-05)), `parts.tsx`(카드들). 순자산은 month의 `useNetWorth`·`H06NetWorth`를 그대로 씀
- `packages/app/src/features/salary`: `split-editor.tsx`(O-50·W-01 같은 목록 틀 `SplitEditor`, 줄을 누르면 같은 틀이 금액 입력, 남는 돈은 QuestionLayout `summary`), `split-draft.ts`(추천값 순서·변환), `check-line.tsx`(체크 줄 `CheckLine` = ui `TransferRow`, 체크하면 Toast + 되돌리기), `pages/w-01-split.tsx`, `w-02-checklist.tsx`(W-02a 다른 금액은 같은 화면 모드), `w-02-done.tsx`, `w-05-review.tsx`. 경로 `/salary`, `/salary/split`, `/salary/done`, `/salary/review`
- 체크리스트는 `useChecklists`가 읽을 때 분배표마다 `start_checklist`를 불러 이번 사이클 것을 만듦(같은 사이클이면 서버가 그대로, 새 사이클이면 지난 것은 끝남 + 체크 안 한 줄 ‘못 함’). 앱을 안 열어도 기준일 0시 예약 작업 `run_cycle_checklists`가 같은 함수(`make_checklist`)로 만듦
- 체크는 RPC `check_pay_line(줄, checked|wait|skipped, 다른 금액)`. 먼저 저장된 체크 유지(`already_checked`), 지난 사이클은 읽기 전용(`closed`)
- 목표 모은 돈 = `goal.other_held`(이미 모은 돈) + `goal_checked_sums()`(체크한 저금 줄 합). 직접 넣기·빼기·꺼내 쓰기는 `goal_move`(`goal_saved_sums()`가 함께 셈)
- 분배표 저장(`save_split`)은 서버 `sync_checklist`로 이번 사이클 체크 안 한 줄만 새 금액(체크한 줄, 못 함 줄은 그대로)
- 할 일 한 줄·다가오는 일정·이번 달 월급 상태는 core `rules/home.ts`(`homeTodo`, `homeUpcoming`, `salaryState`)가 계산하고, 재료는 frame `useHomeInput()`(같은 qk 캐시, 닫은 할 일은 기기 저장), 문구는 frame `todoText`·`upcomingName`. 홈과 트레이 위젯이 같은 결과를 씀
- 앱 기본 틀은 `features/frame`(ui `AppFrame`, 금액 가리기 `shared/mask.ts`). `command.tsx`: ⌘K(Windows Ctrl+K) 검색 화면(ui `CommandPalette`, ‘바로 하기’ + 목표·가진 돈·대출·챙길 날 최대 5개씩), Ctrl(⌘)+1~4 탭, Ctrl(⌘)+N(홈 = 오늘 띠 ‘추가’ 메뉴 `AddMenu`, 다른 메뉴 = 그 화면에 맞는 추가), 좁은 창 + 버튼(`addFor`). 오프라인이면 본문 맨 위 “연결이 끊겼어요” 띠(`shared/online.ts`, 입력 대기열은 아직 없음). 불러오는 중 0.3초 넘으면 스켈레톤(`LoadingFrame`). 홈 연결 해제 대기 띠(요청한 사람 → S-12, 받은 사람 → S-12d, 닫기 없음). ‘저장 중’ 표시와 충돌 선택은 아직 없음 트레이 위젯 값(26 트레이 위젯 창 = WG-01 이번 달 월급 + 다음 할 일 + 다가오는 날)은 데스크톱에서만 `useTraySync`가 만들어 브리지로 보냄(core `TraySnapshot`)
- W-01(20261102090000): 각자 + 배우자 합류면 사람 탭(`?who=`), 배우자 분배표도 고칠 수 있고 배우자 내 목표 줄 금액은 잠금(`save_split`이 `locked_line`으로도 막음). 수입 줄 → S-11(내 탭). 합쳐서면 내 목표 줄 이름 앞에 주인 이름(`goalLineName`, 체크리스트·홈도 같음). 직접 추가 줄은 눌러서 이름·금액 바꾸기. ‘추천값으로 다시 채우기’는 core `recommendSplit`의 `others`(각자: 우리 목표는 상대 줄만큼 빼고)·`keep`(배우자 탭: 배우자 내 목표 줄 그대로), 합쳐서는 두 사람 수입·사람마다 용돈. 연결 해제 대기면 보기만
- W-02: ‹ › 지난 달 보기(`fetchPastChecklists`, 읽기 전용), 기간 시작은 월급날이 주말·공휴일이면 직전 영업일로 표시(`holiday_shift`), 상대가 이번 사이클에 분배표를 바꿨으면 맨 위 안내(× 누르면 이 기기에서 숨김), 배우자 탭은 ‘다른 금액’ 없음
- 월급날 바꾸기: `app_user` 트리거 `payday_cut_cycle` → `cut_cycle`로 이번 사이클 끝 = 새 기준일 전날(각자 = 내 체크리스트, 합쳐서 + 만드는 날 자동 = 공동)
- 아직 없는 것: W-02 끝 배우자 진행, 체크 오프라인 저장

### 캘린더 구조

- 기획: 24(재기획 2026-10-25). features/calendar: `/calendar`(마지막 보기로, 기기에 기억), Y-01 `/calendar/list`, Y-04 `/calendar/month`. 보기 필터 “전체” “챙길 날” “돈 일정”은 목록·달력 공통, 기기에 기억
- 돈 일정(읽기 전용, 누르면 해당 화면)은 core `rules/calendar.ts` `moneyDates(연, 월, 재료)`: 월급날(각자 = 사람마다 “찬우 월급날”, 합쳐서 = `joint_cycle_day` 하나 “월급날”, 주말·공휴일이면 직전 영업일) → W-02, 월말 확인 띠(다음 월급날 3일 전 ~ 전날, 각자 = 내 월급날 기준, 첫날 “월급 확인”) → W-05, 목표 기한(한 번 목표, 진행 중만) → G-02, 매년 목표 쓰는 달 → G-02, 자산·대출 만기(서버가 공개 범위로 거른 행) → F-04
- 달력 칸은 ui `Calendar`(일요일 시작 6주, `monthGrid`). 돈 일정 = 검정 점, 월말 확인 = `is-band`, 챙길 날 = `together` 점 한 가지. 고른 날이 띠 안이면 “{n}월 월급, 빠진 게 있는지 확인할 때예요” 줄(→ W-05, 목록은 오늘이 띠 안일 때 맨 위)
- 목록: 기록 없이 7일 지난 날(맨 위 ‘기록하기’) → 다음 챙길 날 카드(D-day, 날짜, 금액 메모 “30만 원 생각해 뒀어요”, ‘준비하기’) → 60일 안 챙길 날 → 돈 일정 작은 줄 → 드린 기록. 챙길 날이 없으면 빈 상태 + ‘챙길 날 추가’(돈 일정은 그대로)
- 챙길 날은 한 종류(`care_day`, 새로 만드는 것은 category `couple`). 금액(`budget`)은 메모일 뿐 계산에 안 들어감. 가족 목록, 양가·우리 둘 구분, 챙길 사람, 서프라이즈(`secret`), 양가 비용(Y-06)·낸 곳은 재기획으로 없앰(열은 남기고 새로 안 씀)
- 날짜 계산은 core `rules/care.ts`(`careDateInYear`, `nextCareDate`, `careDatesInMonth`, `dday`). 음력은 `rules/lunar.ts`(`lunarToSolar`: 윤달이 없으면 평달, 30일이 없으면 29일)
- Y-07 `/calendar/add/:step`: a 이름(최대 20자) + 이름 칩(생일, 결혼기념일, 설날, 추석, 어버이날, 행사, 직접 쓰기 = 이름·날짜·반복 기본값만, `kind`로 저장) → c 날짜 + 양력/음력(+ 윤달) + “매년 돌아와요”(행사만 기본 꺼짐, 설날·추석·어버이날은 건너뜀) → d 금액 메모(건너뛰기) → ‘추가하기’(알림 D-30 + D-7). 한 번인 지난 날은 ‘기록으로 남기기’ → Y-08. 같은 이름·날짜면 한 번 확인. ‘+ 추가’, 달력 고른 날(날짜 채움)에서 시작. 수정(Y-05 ⋯ ‘수정’, `startCareEdit`)은 같은 a → c에서 이름·날짜만 ‘저장’
- Y-05 `/calendar/day/:id`(+ `/budget` 금액 메모 Q3): 제목·날짜(음력이면 음력 함께)·D-day, 금액 메모, 반복, 준비 상황(그 해 날짜에만), 알림 일수, 작년에는, 메모, ⋯ 수정·지우기(휴지통 `trashCareDay` + ‘되돌리기’ = `restore_trash`)
- Y-08 `/calendar/day/:id/record/:step?on=`(a 쓴 돈 + 목표 돈을 썼다면 ‘목표 고르기’ → b 드린 것 → c 메모, 모두 건너뛸 수 있음). 저장은 RPC `record_care`(낸 곳 = `personal`, 줄 0)로 기록만. 목표를 골랐으면 저장 뒤 G-02b `/goals/:id/spend?amount=`(금액 채움)
- 기록할 회차는 core `recordDate`(지난 60일 안 기록 없는 날, 만든 날 이후), 7일 지나면 `overdueDate`. 다음 챙길 날은 오늘 이후만
- Y-09 `/calendar/gifts`: 챙길 날별 / 연도별(기기에 기억), 같은 챙길 날에 2년 안 같은 선물이면 “작년에도 드렸어요”(core `giftRepeated`, Y-08b도 같은 규칙)
- 자동 결혼기념일(마이그레이션 20261029180000): `couple_space` 트리거가 결혼했고(married) 결혼한 날이 있으면 `sync_wedding_care`로 챙길 날 “결혼기념일”(매년 양력, `auto = 'wedding'`) 하나를 만듦. 공간마다 하나(지운 것도 셈, 지우면 다시 안 만듦). 결혼한 날이 바뀌면 날짜를 옮기되 사람이 날짜를 고쳤으면(`auto_moves = false`, 트리거가 표시) 그대로. 예정일(engaged)은 만들지 않음
- 공휴일: `holiday` 테이블, 앱은 읽기만(`fetchHolidays`, 하루 캐시). 달력 칸 `holiday`(빨간 숫자 + 짧은 이름), 설날·추석은 `festive` 띠(core `isFestive`). 특일 API 받기는 Edge Function + pg_cron으로 나중에
- 월급날 앞당기기: core `businessDayOnOrBefore`, `couple_space.holiday_shift`(기본 켜짐)가 false면 그대로
- 미리 알림(D-30·14·7·당일)과 상대 알림(`care_partner_change`)은 있음. 다음 단계: 기록 사진(Y-08c·Y-09), 목록·달력에서 바로 ‘다녀왔어요’, 특일 API(옛 `family_member`·`apply_family_budget`는 20261101180000에서 지움). 다녀온 뒤 기록 `record_care`는 기록만(목표 돈을 썼으면 G-02b 꺼내 쓰기)

### 설정 구조

> 재기획(2026-10-25, `docs/adr/0003-replan-goal-checklist.md`) 반영. 연결 해제는 ADR 0003 11장(나누지 않고 모두 지움, 30일 보관 뒤 영구 삭제)대로 다시 씀(마이그레이션 20261030180000). 계정 삭제(S-18b, 20261101210000 `request_account_deletion`): 탈퇴 = 데이터 모두 지움. 연결·해제 대기면 연결 해제 확정과 같게 두 사람 모두 빈 새 공간(`unlinked_from` = 원래 공간, `onboarding_step` S-12H), 원래 공간은 30일 보관, `couple_unlink` `how = 'deleted'` 확정 행. 취소하면(`cancel_account_deletion`) 그때부터 30일 안 다시 연결 가능(해제와 같은 `answer_reconnect`).

- features/settings: S-10 `/settings`(상단 아바타, 좁은 창 설정 버튼), S-11 `/settings/me`, S-11a `/settings/me/nickname`, S-11c·d·f·g·h·i `/settings/me/…`, S-12 `/settings/couple`, S-12a·c·d `/settings/couple/unlink`(`/confirm`, `/review`), S-12h `/settings/couple/unlinked`, S-12g `/settings/couple/reconnect`, S-14 `/settings/notifications`, S-14a `/settings/notifications/quiet`. 메뉴가 아니라 `MainFrame current={null}` (재기획으로 S-10a 통장 방식, S-11b 신랑·신부, S-17 내 답 다시 보기, 연결 해제 S-12b 자산 정리·S-12e 다르게 정리하기·S-12f 다른 안은 지움)
- 공개 범위 줄은 합류한 부부만, 위젯 줄은 데스크톱만
- 알림 이메일은 S-11에서 그 자리에서 고침(core `NotifyEmail`: 공백 제거·소문자·형식만). 주말·공휴일 앞당기기는 `couple_space.holiday_shift`(부부 공통, 바로)
- S-11 내 정보와 월급(재기획): 이름 S-11a, 결혼 상태 S-11g `/settings/me/marriage`(바꾸면 S-11h에서 상태와 날짜를 함께 저장), 결혼한 날·예정일 S-11h `/settings/me/wedding`(O-12 규칙, 결혼기념일 챙길 날은 서버 `sync_wedding_care`), 출생연도 S-11i `/settings/me/birth-year`. 월급 묶음: 내 월급 S-11c `/settings/me/salary`(합류 뒤 배우자 값 보기만, Toast ‘되돌리기’), 관리 방식 S-11f `/settings/me/salary-mode`(혼자 쓰기면 숨김), 체크리스트 만드는 날 S-11d `/settings/me/plan-day`(합쳐서 + 합류만), 앞당기기 토글, ‘월급 분배표 열기’ → W-01. 연결 해제 대기 중엔 관리 방식·만드는 날 비활성
- 관리 방식 바꾸기 `set_salary_mode(mode)`(마이그레이션 20261030120000): 각자 → 합쳐서 = 같은 우리 목표 줄 더함, 고정지출·생활비 더해 1줄씩, 용돈은 사람마다, 내 목표·직접 추가 줄 그대로. 합쳐서 → 각자 = 우리 목표·고정지출·생활비·직접 추가 줄을 두 사람 수입 비율로(1만 원 단위, 남는 차이는 기준일 사람), 용돈·내 목표 줄은 주인에게. 체크리스트는 다음 월급날부터 새 방식(`start_checklist`가 옛 방식 체크리스트가 이번 사이클이면 새로 안 만들고, 끝나면 닫음). 배우자 알림 `salary_mode`, 해제 대기면 `unlink_pending`
- 체크리스트 만드는 날 `set_joint_cycle_day(일)`: 두 사람 월급날 중 하나(말일 = 31)만, 이번 공동 체크리스트 끝 = 새 기준일 전날, 배우자에게는 주간 요약(활동 기록)만(20261031120000)
- 알림 설정은 `app_user.noti_prefs`(받는 방법 + 묶음별 OS 알림·이메일, core `notiPrefs`가 기본값: 챙길 날 D-14·당일만 꺼짐)와 `quiet_start`·`quiet_end`(한국 시간 시). 토글은 바로 저장. 센터 기록은 설정과 상관없이 남고, 데스크톱 OS 알림은 `pushAllowed(설정, notification.topic, 방해 금지)`가 참일 때만. `notification.topic`은 kind와 dedupe로 만드는 생성 열(plan, proposal, invite, care_30 …). 웹은 이메일 토글만 묶음은 plan(“월급 체크리스트”), partner_change, care_30/14/7/0, money, goal, invite(제안·생활비 체크 토글은 재기획으로 없앰)
- 약관 재동의(A-05r, 20261103150000): `pending_terms()`(terms·privacy는 재동의 필요 승인 버전이 KST로 시행됐고 그 버전 동의가 없을 때, marketing은 마지막 기록이 받기이고 2년 지남), `agree_terms(p_marketing)`(consent_source `reconsent`). 앱은 `RequireAccount`가 남은 게 있으면 `/terms/update`로 보냄(못 읽으면 막지 않음).
- 배우자가 고친 목표(G-01, 20261103120000): `recent_goal_changes()`가 나에게 온 partner_change(goal, goal_meta, 30일 안) 중 목표마다 마지막 하나. 본 시각은 localStorage `sweetwo.goalsSeenAt`.
- 알림 채널(20261102180000): 앱(데스크톱, 모바일)이 켜져 있는 동안 5분마다 `touch_app()`(`app_user.app_seen_at`). `mail_missed_notifications()`(pg_cron `mail-missed-notifications` 10분마다): 푸시로 갈 알림인데 만들어진 뒤 10분 안에 접속 신호가 없으면 메일 한 통(`noti_mail_body`, 상한 6회, 월말 확인은 상한 밖), 보안·계정·문의(`noti_always_mail`: 연결 해제 요청·완료, 상대 계정 삭제·복구, 관리자 열람, 문의 답변, 새 기기 로그인)는 접속과 상관없이 바로(상한 밖). 방해 금지 시간에는 미뤘다가 끝나면. 보낸 알림은 `notification.mailed_at`.
- 데스크톱 OS 알림: 방해 금지 시간에 온 알림은 미뤄 두고 끝나면 띄움(1분마다 확인, 앱이 켜져 있는 동안)
- 계정 삭제 접수 메일(트리거 `deletion_mail`)·완료 메일(`purge_deleted_accounts`가 지우기 직전, `user_id` 없이) 상한 밖. 새 기기 로그인: 로그인 뒤 `note_login()`이 다른 세션이 있으면 본인에게 ‘새 기기에서 로그인했어요’ → S-15(메일도). A-08 ‘나예요 / 내가 아니에요’ 화면은 아직 없음 알림 링크는 `/new-device/{새 세션 id}`(A-08 `a-08-new-device.tsx`, 20261103090000): ‘나예요’ → 홈, ‘내가 아니에요’ → `end_sessions(그 세션)` → S-15 + Toast “{제공자} 계정 보안도 확인해 주세요”.
- 아직 없는 알림: 약관 개정 고지(AD-10 필독 공지와 메일), 마케팅 수신 동의 재확인 알림(재확인 화면은 A-05r)
- S-12 부부 정보: 이름 + 상태(연결됨, 초대 중, 연결 해제 대기 중, 혼자 쓰는 중), 결혼 예정일(예비부부, D-day 알약)·결혼일(신혼, 보기만). 미합류면 가장 최근 초대 코드(api `fetchLatestInvite`, `invite` 테이블을 부부 공간 사람만 읽음)로 초대 전(“초대 코드 만들기” → `create_invite`) / 초대 중(코드 3+3자리, “10월 22일까지”, 코드 복사, 링크 복사, 새 코드 받기) / 만료를 나눔. 새 코드 받기 `renew_invite`는 쓸 수 있는 코드를 모두 지금 만료로 바꾸고 새로 만듦
- 연결 해제 요청(S-12a → S-12c): `couple_unlink`(공간당 대기 1개, 쓰기는 함수로만). S-12a는 지울 것 목록과 ‘먼저 내보내기’(S-18), S-12c는 “연결 해제” 입력이 맞아야 버튼이 켜짐. `request_unlink('연결 해제')`가 기한(오늘 + 14일)과 함께 저장하고 해제 대기로 바꾼 뒤 상대 알림 `unlink_requested`(→ S-12d). 자산 몫·정리 안 없음(`plan` = `[]`). `cancel_unlink`는 요청한 사람만. 대기 중엔 `save_split`·`set_salary_mode`·`set_joint_cycle_day`가 `unlink_pending`으로 거절, S-12 대기 묶음(“{날짜}에 해제돼요”, 요청 보기)
- 연결 해제 확정 `finish_unlink(id, how)`(내부): S-12d 받은 사람 ‘확인했어요’ → `agree_unlink`(how `agreed`), 또는 매일 오전 9시 `run_unlink_deadlines`가 기한 날 대기 요청을(how `deadline`, 2일 전 알림은 없앰). 같이 쓰던 데이터는 나누지 않음: 두 사람이 각자 빈 새 공간(혼자 쓰기, `unlinked_from` = 원래 공간)으로, `onboarding_step = 'S-12H'`, 원래 공간은 지운 표시로 30일 보관(구성원이 없어 아무도 못 봄), 원래 공간의 알림 기록은 지움. 알림 `unlink_confirmed`. 홈은 S-12H면 S-12h `/settings/couple/unlinked`로, ‘시작하기’ `start_after_unlink()` → 온보딩 O-11부터(이름·로그인은 남김). 분석 `unlink_requested`(`linked_months`), `unlink_resolved`(agreed, canceled. deadline은 서버)
- 다시 연결(S-12g): 확정 뒤 30일 안, 두 사람이 모두 해제로 만든 공간에 혼자 있을 때(`reconnect_ok`). `request_reconnect` → 상대 알림 → `answer_reconnect(true)`면 원래 공간으로 돌아가고(`onboarding_step = 'O-60'`) 해제 뒤 새 공간에 만든 데이터는 버림(새 공간 지움), `false`면 요청만 닫힘. 혼자 쓰기 ‘새로 초대하기’ `start_new_invite`. 매일 `purge_unlinked_spaces`가 30일 지난 원래 공간을 지움. 해제 뒤 상대 호칭은 `unlink_partner_name()`. 행 타입 하나만 받는 SQL 함수는 PostgREST가 계산 열로 보여서 타입이 깨지므로 id로 받음
- 공개 범위(S-13 `/settings/visibility`): `app_user.default_visibility`(내 자산·부채 새 항목 기본값, 기본 금액만 보여 주기)를 F-03·첫 주 자산 입력이 씀. 바꿀 때 기본값과 다른 내 명의 항목이 있으면 “이미 있는 항목 n개도 바꿀까요?”. 다시 연결하면 `?next=/`로 한 번 열고 ‘확인’ 이름은 “모두 보여 주기 / 금액만 보여 주기 / 숨기기”(값 all / sum / private), 고정 줄 “월급과 분배표는 늘 같이 봐요” 등
- 휴지통(S-21 `/settings/trash`, 지금은 S-10 ‘데이터’ 줄에서): `trash_rows()`(자산·부채, 목표, 챙길 날.(가족은 20261101180000에서 지움) 30일 안, 배우자 명의·남의 서프라이즈 빼고), `restore_trash`(같이 지워진 것도 함께: 부모와 10초 안에 지운 자식), 연결된 부부의 목표는 `needs_proposal` → 제안 `goal_restore`. `purge_trash`(하나 또는 비우기), 매일 `purge_old_trash`. 확인은 ui `Modal`(영구 삭제만), Button `danger` 재기획(20261030150000): 연결된 부부의 목표도 제안 없이 바로 되살림, 배우자의 내 목표는 휴지통에 안 보임
- 데이터(S-18 `/settings/data`): 내보내기는 앱에서 만듦(api `fetchExportData` → `features/settings/export.ts` → core `toCsv`(BOM, CRLF), `makeZip`(압축 없는 zip)). 범위 내 데이터 / 공동 데이터, 배우자 항목은 RLS가 거른 뒤 ‘합계만’은 합계 한 줄. 파일 이름은 영문(`sweetwo-joint-20261018.zip`). 형식 엑셀(CSV) / PDF 요약: PDF는 `features/settings/export-pdf.ts`(`buildPdfModel` → `renderPdf`, pdf-lib + @pdf-lib/fontkit, 처음 쓸 때만 불러옴). 한 파일에 자산 요약 + 연간 요약 두 쪽, 계산은 core `netWorth`·`netWorthSeries`·`yearlySavings`·`goalEta`. 글꼴은 가변 글꼴·woff2를 못 넣어서 `packages/app/src/assets/pdf-fonts/SUIT-{Regular,Bold}.ttf`(SUIT에서 400·700만 뽑음, `python3 scripts/pdf-fonts.py`, OFL), 색은 tokens.css 라이트 값을 화면에서 읽음. PDF는 글꼴을 통째로 넣어 0.5MB쯤(pdf-lib 부분 넣기가 이 글꼴에서 글자를 빠뜨림). 저장: 데스크톱·브라우저는 내려받기, 휴대폰 앱은 브리지 `saveFile` → @capacitor/filesystem 캐시 + @capacitor/share 공유 창. 본인 확인: 데스크톱·휴대폰 앱 PIN(있으면), 웹은 `reauthenticate(returnTo)`로 가입 소셜 다시 로그인 → `?export=범위&format=형식`으로 돌아와 이어서. 분석 `data_exported`. 사용 기록 보내기 = `app_user.analytics_off`
- 계정 삭제(S-18b `/settings/data/delete`): `request_account_deletion`은 다시 로그인한 지 10분 안에만(`reauth_required`면 `reauthenticate('/settings/data/delete?go=1')`). 바로 이용 중지(status). 연결·해제 대기면 연결 해제 확정처럼 같이 쓰던 데이터를 모두 지움(위 참고, 상대 알림 `partner_deleted`). 30일 안 다시 로그인하면 A-02 `/account/restore` “계정 삭제를 취소할까요?” → `cancel_account_deletion`(빈 혼자 쓰기, 그때부터 30일 다시 연결, 상대 알림 `partner_restored`). 매일 `purge_deleted_accounts`
- 문의·도움말(S-19 `/settings/about`, S-20 `/settings/help`, S-19a `/settings/help/inquiry`·`/inquiries/:id`, S-19b `/settings/help/access/:id`): `inquiry`(번호 `A-10001`부터 서버 발급, 자동 첨부 키는 서버가 거름), `inquiry_message`(사용자·운영자 대화), `access_request`(L2 열람: 본인만 동의, 24시간, 배우자 알림 `access_partner`, 끝나면 `access_done`, 매시간 `run_access_expiry`). 운영자 쪽 답변·요청 만들기는 어드민 단계. FAQ 원본은 `apps/site/src/content/faq.md`(웹사이트와 같이 씀), `pnpm content:sync`로 `packages/app/src/content`에 복사, core `parseFaq`·`searchFaq`. ui `Accordion`, `Search`
- 보안(S-15 `/settings/security`): 데스크톱 앱 잠금(브리지 lock: `clear`는 1분 안에 `verify`가 통과했을 때만, `setAutoLock` 0·1·5·15분, 기본 5분), PIN 바꾸기 = 현재 PIN 확인 → A-06 `?next=/settings/security`. 로그인된 기기 = `my_sessions()`(auth.sessions, 지금 기기 = 토큰의 session_id), `end_sessions(id)` / `end_sessions()`(이 기기 빼고 모두). 기기 이름은 core `deviceLabel(user_agent)`, 데스크톱 main은 토큰 요청에 `sweeTwo/버전 Electron` User-Agent
- 트레이 위젯(26, S-22): 앱 창의 `useTraySync`(frame)가 홈과 같은 계산(core `homeTodo`·`homeUpcoming`·`salaryState`)으로 core `TraySnapshot`(이번 달 월급 상태·체크 개수·다음 월급날, 다음 할 일, 다가오는 날 3개)을 만들어 브리지 `widget.update`로 보냄. 위젯 창 `/widget/tray`(features/widget)는 WG-01 “9월 월급” / “2개” / “5개 중 2개 했어요”, 월말 확인 기간이면 “체크 안 한 게 n개 있어요” → W-05. 트레이 창에는 금액이 없어 가림과 상관없음. 설정(트레이 켜기, 금액 보이기, 목표)은 S-22
- 다음 단계: 예식일 수정(H-P1)·결혼했어요(H-T1), 마케팅 정보 받기 토글, 결혼 상태·예식일 바꿈 상대 알림

### 배우자 합류 구조

- 기획: 18(재기획 2026-10-25). features/pairing
- 초대 링크 `/i/:code`(P-01, features/pairing)는 로그인 전에도 열림(A-01 공개 경로). `invite_preview()`(익명 가능)로 초대한 사람 호칭만 보여 줌
- ‘합류하기’: 로그인 전이면 `prefs.returnTo = /i/{코드}?go=1`을 남기고 A-02로. 로그인(기존 계정) 또는 가입(A-05) 뒤 그 주소로 돌아와 바로 `join_space()`
- `join_space()`: 초대 공간에 들어가고 코드를 이 사람 몫으로 잡아 둠(완료 전 이탈하면 같은 코드로 ‘resume’). 시작한 사람이 적은 호칭이 초기값. 5회 오류면 10분 제한(`invite_attempt`). 혼자 시작한 기록이 있으면 ‘has_records’ → “이미 시작한 기록이 있어요” 합류하기 / 취소 → P-02a(`p-02a-move-records.tsx`, P-01 안 단계): 월급·월급날과 내 명의 자산·부채(공개 범위 고르기, 기본 금액만)만 `join_moving_records(code, vis)`로 옮기고 합류(20261102150000). 목표·분배표·체크리스트는 안 옮김, 원래 공간은 `deleted_at` 표시 뒤 30일 지나 `purge_left_spaces`(매일)가 지움. ‘사본 내려받기’ → S-18
- 두 사람 기준은 core `rules/couple.ts`(`coupleOf`): 합류 전 배우자 = 시작한 사람이 적은 호칭만(수입은 모름, 추정·분담 비율 없음, 08 9장), 합류 뒤 = `partner_profile()`. 기본 기준일 = 두 월급날 중 늦은 날. 아바타 색은 시작한 사람 1, 합류한 사람 2
- `join_space()`가 정하는 첫 화면: 시작한 사람이 대신 입력한 내 명의 자산·부채(owner person + 주인 없음)가 있으면 P-02b, 아니면 P-03
- 합류 화면 `/join/:screen`(진행 막대 5칸, ‘나중에 할게요’ 없음): (P-02b) → P-03 이름 → P-03a 출생연도 → P-04 관리 방식 확인 → P-05 월급(금액·매달 달라요·월급날) → P-06 분배표 → 홈. 멈춘 화면은 `app_user.onboarding_step`(OnboardingGate가 이어서 엶)
- P-02b: ‘확인하고 이어 쓸게요’ = 동의 기록(소유는 합류를 마칠 때 넘어감), ‘지우고 새로 입력할게요’ = `discard_prefill()`(그 항목 휴지통)
- P-04: 바꾸면 `set_join_salary_mode(mode)`가 바로 적용(각자 → 합쳐서 = 시작한 사람 분배표·체크리스트가 공동 것, 반대는 시작한 사람 것) + 시작한 사람 알림 `salary_mode`
- P-06(salary `SplitEditor`, `steps`·`noteOf`·`incomeSub`): 각자 = core `joinerSplit`(고정·생활 25%, 용돈 10%, 우리 목표에 아직 안 채운 월 필요액 = 필요액 − 시작한 사람 줄), 줄 옆 “찬우님이 매달 95만 원 넣어요”. 합쳐서 = core `jointRefill`(있던 줄은 그대로, 내 용돈 10% + 늘어난 수입을 저금 줄 순서대로 필요액까지), 바뀐 줄 “95만 원 → 250만 원”
- 합류 완료 = `complete_join(줄, 버전)`: 각자 = 내 분배표 + 첫 체크리스트, 합쳐서 = 공동 분배표 저장(열 때 버전과 다르면 `split_changed` → “찬우님이 방금 분배표를 바꿨어요” 후 다시 계산) + 이번 체크리스트 맞춤. 부부 연결, 코드 사용됨, 대신 입력 항목 소유 넘김, 시작한 사람에게 “예빈님이 합류했어요 / 이제 목표와 월급을 같이 봐요”
- 시작한 사람이 아직 온보딩 중(공간에 분배표 없음): P-03 → P-03a → P-05 저장 = `complete_join()`(줄 없음, `onboarding_step = 'P-WAIT'`) → 홈 대기(“{찬우}님이 시작하고 있어요”). 시작한 사람이 온보딩을 마치면 트리거가 “{찬우}님이 첫 목표를 정했어요”(`first_goal`, → `/join/p-04`), 홈은 분배표가 생기면 P-04 → P-06으로(합쳐서면 확인만)
- 다음 단계: 합류 직후 푸시 허용 묻기(모바일 푸시와 함께), ‘PC에서도’ 띠
- 재기획 전 코드: `update_pending_shares`, `notify_first_plan`은 20261101180000에서 지움. `finish_join`은 앱이 안 쓰지만(합류는 `complete_join`) pgTAP 준비용으로 남김

### 목표 구조

- 기획: 22 G-01~G-06, 계산은 06. 화면 features/goals: G-01 `/goals`, G-02 `/goals/:id`. 메뉴 첫 화면 틀은 month `MainFrame`, 상세는 `PageHeader`
- 목표 종류: 우리 목표(`goal.owner_user_id` null, 둘 다 고침) / 내 목표(주인 user id, 주인만 고침, 배우자는 보기만). RLS `goal_update`가 주인만 허용. 혼자 쓰기는 종류 없이 한 목록
- 화면 값은 goals `model.ts`(`useGoalsModel`) 한 곳: 모은 돈(서버 `goal_saved_sums()`), 매달 넣는 돈(보이는 분배표의 이 목표 저금 줄 합, 각자 + 합류면 사람별), 예상 달성·늦어지는 달(core `goalEta`), 이번 달(이번 사이클 체크 줄), 묶음(우리 목표 / 내 목표 / 배우자 목표, 비상금은 우리 목표 맨 위), 접힌 목록(보류, 달성, 다 쓴 목표)
- 모은 돈 = 이미 모은 돈(`other_held`) + 체크한 저금 줄 + 넣기 − 빼기 − 꺼내 쓰기, 0 아래로 안 감. 서버 `goal_saved(목표)`가 정본, 두 사람이 같은 값
- 넣기·빼기·꺼내 쓰기(`goal_move` 표, 쓰기는 `move_goal(목표, in|out|use, 금액)`만, 모은 돈보다 많으면 `too_much`, 배우자 내 목표면 `not_owner`). G-02a `/goals/:id/move/:kind?`(넣을게요·뺄게요, `held`면 이미 모은 돈 고치기), G-02b `/goals/:id/spend`(꺼내 쓰기). 저장하면 Toast + ‘되돌리기’(`undo_goal_move`)
- 목표와 분배표 저금 줄은 DB 트리거(`goal_lines` → `goal_lines_sync`)가 맞춤: 진행 중 목표를 만들면 보이는 분배표마다 저금 묶음 맨 아래 0원 줄, 보류·달성·삭제하면 줄을 뺌, 다시 모으면 0원 줄. 우리 목표는 각자면 두 사람 분배표 모두, 내 목표는 주인 분배표만. 매달 넣는 돈은 분배표(W-01)에서만 고침
- G-02: 종류 이름표, ⋯(이름 변경, 보류·다시 모으기, 우리 목표 ↔ 내 목표, 삭제. 비상금은 보류·삭제·종류 없음), 숫자 카드(목표 금액·기한은 `/goals/:id/edit/amount|deadline`), 이번 달 저금 줄(salary `CheckLine`), 넣기·빼기 / 꺼내 쓰기 / 매달 넣을 돈 바꾸기, 기한 비교, 모은 돈 기록(체크 줄 + `goal_move` + 이미 모은 돈)
  - 우리 → 내 목표는 배우자가 넣은 돈(체크 줄, `goal_move`)이 있으면 막음(지금은 앱에서만 확인)
- 바꾸기(`goal-change.ts`): 제안 없이 모두 바로 저장 + Toast(금액 “목표 금액을 바꿨어요”, 기한 “기한을 바꿨어요”, 이름 “이름을 바꿨어요”, 보류·다시 모으기, 모두 ‘되돌리기’). 연결된 부부도 버튼은 ‘저장’. 삭제는 휴지통(`deleted_at`)
- 목표 수정 `/goals/:id/edit/amount|deadline|name`: 기한은 늘리기·줄이기 모두(이번 달 이전만 안 됨), 영향 미리보기는 이 목표만(예상 달성, 상태, 월 필요액 전 → 후), 배우자의 내 목표는 G-02로 돌려보냄
- 목표 추가 `/goals/new/:step?`(goals `add/`): G-03a 템플릿 → G-03e 누구 목표(혼자 쓰기 빼고) → G-03b 질문 → G-03c 기한 → G-03d 이미 모은 돈(매달·고금리 대출·템플릿이 묻는 것 빼고) → G-03f 확인 → 만든 목표 상세. 입력 중 값은 기기에 저장(`sweetwo.goal-add`)
- G-06 `/goals/order`: 우리 목표와 내 목표 각각 `ReorderList`, 저장하면 우선순위 + 내 분배표 저금 줄 순서를 같이 바꿈
- G-05 달성(20261101150000): `AchieveWatch`가 model의 모은 돈(서버 `goal_saved_sums`) ≥ 목표 금액이면 `achieve_goal` 후 축하 `/goals/:id/achieved`(사람마다 한 번)를 엶. 달성하면 `goal_lines_sync`가 저금 줄을 빼며 그 금액을 `goal.freed_lines`(분배표마다)에 남김 → 내 분배표 금액이 있으면 “매달 넣던 25만 원은 어디로 보낼까요?” `/goals/:id/achieved/send`(다른 목표 / 새 목표 만들기 / 분배표에서 정할게요) → 사용 기록 `/goals/:id/use`(아직이에요 / 썼어요 → 얼마 → `finish_goal_use`(꺼내 쓰기 + 사용 완료, 남은 돈) → 남은 돈 비상금·다른 목표 `move_goal_saved` / 그대로) → 고른 곳: 다른 목표면 목표 고르기 후 내 분배표 그 저금 줄 + 금액(`save_split`, Toast ‘되돌리기’), 새 목표면 G-03a `?freed=`(추가하면 그 줄에), 분배표면 W-01. 옛 `use_goal`·`move_goal_rest`·`goal_use`는 20261101180000에서 지움
- 우리 목표 상대 알림·활동 기록은 `goal_partner_change`·`goal_move_partner_change`(20261031120000). 우리 ↔ 내 바꾸기도 상대 알림(20261102120000, 필드 `owner`). G-02: 달성했으면 “n원 모았어요” + ‘이 돈을 썼나요?’, 매년 목표는 다음에 쓰는 달·회차, 월별 기록 표(최근 12개월 + 더보기), 모은 돈 기록에 누가, 정보(만든 날·만든 사람·주인), 도움말(유형별 1개), 삭제 Toast ‘되돌리기’, ‘매달 넣을 돈 바꾸기’는 주인 탭으로(해제 대기면 꺼짐). 매년 목표 쓰는 달에 꺼내 쓰면 한 번 내년 금액을 물음(G-02a 안, 이 기기에서 한 해 한 번). G-01: 금액 없는 목표는 G-03b로, 늦으면 카드 아래 ‘분배표에서 저금 늘리기’, 접힌 목록은 보류 → 달성 → 사용 완료. G-03f 우선순위 위치 고르기. G-06은 두 사람 분배표 저금 줄 순서도 바꿈
- 다음 단계: 우리 → 내 목표 막기 서버 확인, 진행 그래프·월별 막대, 목표 사진, 카드 아래 “예빈님이 기한을 바꿨어요”
- 내 목표 공개(20261101233000): 앱은 목표를 `space_goals()`로 읽음. 배우자 내 목표가 `visibility = 'amount'`(금액만 보여 주기)면 서버가 이름 “개인 목표”, 종류 `custom`, 답 `{}`로 가려서 줌. 설정은 S-13 ‘내 목표’(모두 보여 주기 / 금액만 보여 주기). 테이블 직접 읽기(`goal_select`)는 아직 같은 공간이면 열려 있음 → 다음 단계에서 막기
- 재기획으로 지운 화면(2026-10-26): G-04 충돌 조정, G-07 결혼 비용 전용 화면(결혼 비용은 보통 목표), G-08 제안, 첫 주 나머지 목표 `/goals/week`.

### 우리 자산 구조

- 기획: 23 F-01~F-04, 09 6-5·6-6(분류, core `assetGroups`), 08 2·4장(명의, 공개 범위). 화면 features/assets: F-01 `/assets`, F-02 `/assets/items?side=asset|debt`, F-03 `/assets/new/:step?`, F-04 `/assets/:id`, F-04a `/assets/:id/matured/:step?`. 하위 탭은 “한눈에” “자산·부채” 2개, 기기에 기억
- `asset`: 자산과 부채를 한 표(`side`). 명의 = `owner` 공동(joint) / 사람(person + `owner_user_id`). 합류 전 배우자 명의 대신 입력 = person + `owner_user_id` null(모두 보여 주기만), `finish_join()`이 합류한 사람에게 넘김. 합류 뒤 상대 명의 새로 만들기는 RLS가 거절
- 공개 범위(`visibility` all / sum / private = “모두 보여 주기” / “금액만 보여 주기” / “숨기기”, 새 내 항목 기본 = 금액만)는 서버에서 거름(31 보안): 행은 `asset_visible()`(공동, 모두 보여 주기, 내 명의, 내가 대신 입력한 것)만. 배우자 ‘금액만’은 `partner_asset_sums()`가 묶음별 개수와 합계만, ‘숨기기’는 아무것도 안 줌. 고치기는 `asset_editable()`
- 금액 이력 `asset_history`: 금액·원금이 바뀔 때 트리거가 기록(앱은 못 씀)
- 순자산: core `netWorth`(원금 기준, 예상 = 평가금액 기준, 숨기기·판 항목 빼고 배우자 금액만 더함). 목표 모은 돈은 더하지 않음. 월말 순자산 `net_worth_history(개월)`
- F-01: 순자산 그래프(ui `LineChart`, 서버 `net_worth_history(120)` + 이번 달 지금 값, core `netWorthSeries`. 기간 탭 6개월·1년·3년·전체, 데이터보다 긴 기간 비활성, 고른 탭 기억 `sweetwo.networth-period`) + 자산·부채 합계(→ F-02)
- F-02: 묶음(F-03a 그룹) 안 정렬 칩(이름, 명의, 금액, 수정일, 기억 `sweetwo.asset-sort`), 줄 배지는 공개 범위(내 항목)와 ‘대신 입력’만, 배우자 금액만 줄(알약 ‘금액만’), 투자 묶음 줄 core `investSummary`
- F-03 유형별 질문(F-03f~h, 모두 ‘나중에 할게요’ 가능): 적금 = 만기일 → 월 납입액, 청약 = 납입 회차(`paid_count`) → 월 납입액, 보증금 = 계약 만기일, 부채 = 금리 → 월 상환액. 월 납입·상환액은 기록만(분배표와 연결 없음). 카드론·현금서비스·리볼빙은 끝나고 ‘목표 만들기’ Toast
- F-04: 금액 수정(만기일·월 납입액 등은 보기만, 아래 F-04 참고), 공개 범위(내 명의만), 삭제는 휴지통 + 되돌리기. 배우자 명의는 보기만
- F-04a 만기된 돈 정리(20261101090000): 만기일이 지난(오늘 포함) 내가 고칠 수 있는 자산(전세 보증금 빼고). a “만기된 돈은 어디로 옮겼어요?” 다른 통장으로 → 통장 고르기(현금성·예금·적금 중 내가 고칠 수 있는 것, 고르면 바로) / 다시 가입했어요 → 새 만기일(오늘 뒤). 서버 `settle_matured(항목, 통장 | 새 만기일)`: 통장 금액 + 만기 금액, 항목은 `asset_status` ‘matured’(만기 완료, `fetchAssets`·core `netWorth`에서 빠지고 지난 순자산 기록은 그대로)
- 재기획으로 화면에서 뺀 것: 통장 역할 배지, 목표 연결(F-03f2 빠지는 통장 `pay_from`, F-03i·F-04 `goal_id`), F-01 비상금 카드·이번 달 카드·이번 달 계획·월 정산 요약, F-06 재정 진단 탭. `asset.pay_from`·`goal_id` 열은 남겨 두고(스키마는 2단계로 지움) 새로 쓰지 않음
- 재기획으로 지운 화면(2026-10-26): F-05 월 수입·지출, F-05f 기간 수입, F-07 계획 다시 세우기, F-09 비상금 넣기·꺼내기, O-53 투자 원칙, 첫 주 O-34~47. 남은 옛 읽기: 통장(`account`)
- F-03 금액 ‘잘 모르겠어요’: 구간 칩(core `bands.goalAmount`, 중간값) → `asset.estimated`, 목록·상세에 ‘추정’ 알약, 금액을 고치면 사라짐
- F-04(20261102210000): 금액 그래프(달마다 마지막 기록, `LineChart`), 투자·부동산은 ‘시세 바꾸기’(금액 그 자리 수정)·‘팔았어요’ → F-04b~d `/assets/:id/sold`(받은 금액, ‘일부만 팔았어요’ 남은 평가금액, 받은 통장, 결과: 통장 +금액, 실현 손익 = 받은 금액 − 판 비율만큼 원금). 서버 `sell_asset`(다 팔면 `sold`). 고친 기록은 직접 고친 것만 + 고친 사람(`asset_history.recorded_by`)
- 다음 단계: 유형별 값(만기일·월 납입액·금리) 그 자리 수정, 주택 대출 금리 유형·상환 방식, F-08(출시 후)

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
- 커밋 메시지는 Conventional Commits (`feat: 월말 정리 단계 동기화`)
- PR은 리뷰 1명 이상. DB 마이그레이션과 RLS를 바꾸는 PR은 2명
- 스키마는 추가만. 이름 바꾸기와 지우기는 2단계(새 컬럼 추가 → 최소 지원 버전이 예전 앱을 넘어선 뒤 예전 컬럼 제거)
- 큰 기술 결정은 docs/adr에 ADR 한 장으로 남김

### 테스트

- core 계산과 포맷: Vitest 단위 테스트. 계산·배분 탭의 예시를 그대로 테스트 케이스로
- DB 함수와 RLS: pgTAP. ‘배우자가 비공개 항목을 못 본다’ 같은 권한 테스트는 필수
- 화면 흐름: Playwright E2E. 두 계정(찬우, 예빈)으로 합류, 월급 체크, 대신 체크
- 화면 e2e는 `vite --mode e2e`(apps/mobile/.env.e2e, 가짜 Supabase 주소)로 브라우저에 띄우고 `e2e/supabase-mock.ts`가 응답을 흉내 낸다. 실제 DB 규칙은 pgTAP이 맡음
- 테스트 데이터의 예시 이름은 찬우(시작한 사람), 예빈(합류한 사람)

### 테스트 세부

- 두 사람 흐름(합류, 충돌, 함께 모드): Playwright 브라우저 컨텍스트 2개로 찬우, 예빈을 동시에
- 데스크톱: Playwright `_electron`으로 실제 앱 실행(딥링크, 트레이, 잠금)
- 테스트마다 DB 초기화(seed 다시 넣기). 테스트끼리 데이터를 나눠 쓰지 않음
- 음력: fixture를 천문연구원 표와 대조
- 접근성: 화면마다 axe 검사(`e2e/axe.ts`(mobile, admin, site)의 `axe(page)`로. 브랜드 오렌지 위 흰 글자의 color-contrast만 예외), ‘동작 줄이기’ 켜고 한 번
- 디자인 시스템 컴포넌트: `/dev/ui` 컴포넌트 모음을 라이트, 다크, 좁은 창(375px)에서 열어 오류 없음, axe 위반 없음, 스크린샷(apps/mobile/e2e). 기준 이미지 비교는 화면이 안정되면 추가
- 데스크톱 실행: `apps/desktop/e2e`(빌드 뒤 `xvfb-run -a pnpm --filter @sweetwo/desktop e2e`). 딥링크 허용 목록은 Vitest(`deep-link-parse.test.ts`)

### 문구

- 화면 문구는 기획서 화면 요소 표의 “ ” 안 문장을 그대로. 해요체
- 문구는 기능 폴더마다 copy.ts에 모음. 한국어만 지원, 다국어 프레임워크 없음
- 오류 문구에 기술 용어와 오류 코드를 보이지 않음

### 단축키

기준은 기획서 공통 4장(아래 표와 다르면 기획서가 우선). 모바일 앱은 단축키 없음(외부 키보드는 Esc와 질문 화면 키만).

| 동작 | 데스크톱 |
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
- CODEOWNERS: supabase/는 리뷰 2명, packages/ui는 디자인 시스템 오너

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
- 토큰: access token은 짧게, refresh token은 기기별. 데스크톱은 main 프로세스의 safeStorage, 모바일은 Keychain·Keystore. 두 앱 모두 엄격한 CSP(‘인증과 세션’)
- 잠금: PIN 6자리 + 생체 인증(macOS Touch ID, iPhone Face ID·Touch ID, Android 지문. Windows Hello는 출시 후), 5분 뒤 자동 잠금
- 로그: 금액, 메모, 이름을 남기지 않음. Sentry는 보내기 전에 걸러내기(beforeSend), PostHog는 금액을 구간으로만
- 비밀 값: 코드와 저장소에 두지 않음. Supabase 비밀 값과 GitHub Actions secrets만. service role 키는 서버 밖으로 나가지 않음
- 보관 기간: 휴지통 30일, 알림 90일, 변경 이력 13개월, 결제 기록 5년, 접속 기록 3개월. pg\_cron이 정리
- 탈퇴: 30일 유예 후 삭제. 부부 상태에 따른 처리는 기획서 규칙 그대로

### 출시 전 확인

- [ ] RLS 테스트 전체 통과, service role을 쓰는 코드 목록 점검
- [ ] 아래 ‘Electron 보안 체크리스트’ 전체 통과
- [ ] 마이데이터 사업 해당 여부, 금융소비자보호법 해당 여부 법률 검토 결과

### 로그와 분석

- Sentry: `beforeSend`, `beforeBreadcrumb`에서 키 이름으로 지움(amount, memo, name, email, token 들어간 키 전부), URL 쿼리도 지움
- Edge Functions 로그: 함수 이름, space\_id, 오류 코드, 걸린 시간만. 요청 본문과 복호화 값은 남기지 않음
- PostHog 공통 속성: platform(desktop, ios, android), app\_version, os, couple\_state. 사람은 익명 id로만
- 금액은 구간으로만: 월 수입·생활비·고정지출·결혼 총예산·목표 금액·여행 경비는 기획서 데이터 항목 구간, 그 밖의 금액은 10만 미만 / 10\~50만 / 50\~100만 / 100\~300만 / 300\~1000만 / 1000만 이상(기획서 성공 지표 5장)
- ‘분석 수집’ 동의를 끄면 `analytics_off`: 기기에서 이벤트를 만들지도 보내지도 않음

### Electron 보안 체크리스트

- [ ] 모든 창 `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`
- [x] `setWindowOpenHandler`는 막고 허용한 외부 링크만 `shell.openExternal`, `will-navigate` 막음
- [ ] CSP 헤더, 화면은 `app://` 프로토콜로 불러옴(file:// 안 씀)
- [x] IPC 핸들러마다 보낸 창(`event.senderFrame`) 확인, 인자는 Zod로 검사
- [ ] Electron Fuses: RunAsNode 끔, asar 무결성 검사 켬, NODE\_OPTIONS 끔
- [ ] 의존성 감사(`pnpm audit`, Dependabot), Electron은 지원 버전 유지

## 배포와 운영

환경은 3개(로컬, 스테이징, 운영)이고, 데스크톱 앱은 웹사이트 직접 다운로드로만 배포함.

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
| S3 버킷 | 없음 | 업데이트 | 다운로드, 업데이트 |
| 스토어 | 없음 | TestFlight, Google Play 내부 테스트 | App Store, Google Play |
| 푸시 | 없음 | APNs 개발 환경, FCM 스테이징 프로젝트 | APNs 운영, FCM 운영 프로젝트 |
| Sentry 프로젝트 | 끔 | 환경 태그 staging | 환경 태그 production |

- GitHub Environments: staging, production. production은 승인자 1명이 승인해야 배포
- 비밀 값마다 담당자와 교체 주기를 docs/secrets.md에(값은 적지 않음). 사람이 나가면 그날 교체
- Edge Function의 AWS 접근은 최소 권한 IAM 사용자(KMS Encrypt/Decrypt, SES Send만), 키는 90일마다 교체

### CI/CD (GitHub Actions)

1. PR(`.github/workflows/ci.yml`): check(lint, 타입 검사, Vitest, 빌드, 에셋 크기, 비밀 값 검사), e2e-web(Playwright, apps/mobile 화면을 브라우저로), e2e-desktop(Electron, xvfb), mobile-android(`cap sync android` + Gradle 디버그 빌드. iOS 시뮬레이터 빌드는 macos 러너로 나중에 추가), db(로컬 Supabase + pgTAP + DB 타입 비교. pgTAP이 실패하면 실패한 줄을 주석(annotation)으로도 남겨 `gh api .../check-runs/{id}/annotations`로 볼 수 있음)
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
3. 태그(v1.2.0): 운영 마이그레이션 → Edge Functions → 웹사이트 → 데스크톱 빌드, 서명, 업데이트 파일 업로드 → 모바일 빌드를 TestFlight·Google Play 내부 테스트로(심사 제출은 사람이)(‘업데이트와 릴리스’)

### 데스크톱 출시

- macOS 12 이상 universal 빌드(dmg), Apple Developer ID 서명과 공증
- Windows 10 64bit 이상(NSIS), 클라우드 HSM OV 서명(SSL.com eSigner 우선, 대안 DigiCert KeyLocker, ‘서명과 CI’)
- electron-updater: 채널 하나. 첫 출시는 전체 공개, 이후 업데이트만 단계 배포(‘업데이트와 릴리스’)
- 최소 지원 버전을 서버에 두고, 낮은 버전은 업데이트 안내
- Mac App Store, Microsoft Store는 출시 후 검토

### 모바일 출시

- iOS 16 이상, Android 8(API 26) 이상 [확인 필요]. 지금 뼈대는 Capacitor 기본값(iOS 15, Android API 24, compile·target 36)이라 정하면 `ios/App` 배포 대상과 `android/variables.gradle`을 맞춤. Capacitor가 Vite 빌드(`dist`)를 앱에 넣음(`npx cap sync`)
- iOS: Apple 개발자 계정(법인), App Store Connect API 키로 CI가 TestFlight 업로드. 서명은 Xcode 자동 관리 대신 CI용 인증서·프로비저닝(Environments production에만)
- Android: Google Play 앱 서명, 업로드 키는 Environments production에만. AAB로 올림
- 업데이트는 스토어만. 코드 바꿔 넣기(라이브 업데이트) 쓰지 않음(심사 규정, 보안)
- 단계 출시: App Store 단계적 출시(7일), Google Play 비율 출시 10% → 50% → 100%
- 심사: 첫 제출은 출시 2주 전. 심사용 계정과 흉내 데이터 공간, 개인정보 라벨·데이터 보안 양식

### 서명과 CI

| OS | 러너 | 서명 |
| --- | --- | --- |
| macOS | macos-latest | Developer ID, hardened runtime, entitlements 파일, notarytool(App Store Connect API 키)로 공증 |
| Windows | windows-latest | 클라우드 HSM OV 서명: SSL.com eSigner 우선, 대안 DigiCert KeyLocker. Azure Trusted Signing은 신규 가입이 미국·캐나다 법인만이라 제외 |

- 2023년 6월부터 OV 인증서도 키를 HSM에 두어야 해서, 파일 인증서를 CI에 넣는 방식은 쓸 수 없음
- EV 인증서도 이제 SmartScreen 평판을 바로 주지 않음. 평판은 서명 주체와 다운로드 수로 쌓이므로 EV를 살 이유 없음
- 서명 키와 API 키는 GitHub Environments production에만

### 업데이트와 릴리스

- 첫 출시는 전체 공개. 단계 배포는 그 뒤 업데이트부터
- 단계 배포: latest.yml의 `stagingPercentage`를 10 → 50 → 100으로 올림(24시간 간격). 올리는 사람은 릴리스 담당자
- 다음 단계 조건: Sentry release health의 크래시 없는 세션 99% 이상. 출시 승인 기준은 99.5%
- 주소: 업데이트 피드는 S3 `updates/{mac|win}/latest*.yml`, 다운로드는 고정 주소 `download.sweetwo.kr/latest/mac|win`(최신 파일로 리다이렉트)
- 앱(`apps/desktop/src/main/updater.ts`): 설치한 앱만(`app.isPackaged`, `SWEETWO_NO_UPDATE=1`이면 끔). 켤 때 10초 뒤와 6시간마다 확인 → 자동으로 받음 → 끌 때 설치(다음 실행 때 적용). 서명 검증은 electron-updater가 함(mac 코드 서명, win `publisherName`). 상태는 IPC `update-*`로 렌더러에(브리지 `update`), S-19 ‘업데이트 확인’은 바로 확인, 다 받았으면 “다시 시작” = `quitAndInstall`. 피드 `https://download.sweetwo.kr/updates/{mac|win}`(electron-builder `publish` `${os}`)

태그 배포 순서

1. DB 마이그레이션(추가만이라 예전 앱이 그대로 동작)
2. Edge Functions
3. 웹사이트(sweetwo.kr)
4. 데스크톱 빌드, 서명, 업데이트 파일 업로드
5. 모바일 빌드 업로드 → 심사 → 출시(스토어 일정에 따라 데스크톱보다 늦을 수 있어 서버·데이터는 늘 두 버전 호환)

- 되돌림: 함수와 웹사이트는 이전 버전 재배포, 모바일은 단계 출시 중지 + 고친 버전 긴급 심사, 데스크톱은 `stagingPercentage`를 0으로 두고 고친 버전을 새로 냄. 마이그레이션은 되돌리지 않고 고침 마이그레이션을 앞으로
- 되돌릴 때: 크래시 없는 세션 99% 미만, 동기화 p95 3초 초과가 30분 이상, 데이터 손상 의심

릴리스 노트와 약관

- 릴리스 노트: Conventional Commits로 초안 → 사람이 다듬은 한국어를 apps/site/src/content에 → L-03
- 약관, FAQ의 원본은 apps/site/src/content의 마크다운. 앱은 L-05, L-06 페이지를 앱 안 보기로 엶
- 어드민 AD-14, AD-15는 버전, 시행일, 다시 동의 여부만 관리(본문은 다루지 않음)

### 기능 플래그와 최소 버전

- app\_config 테이블 하나: `min_version`\_desktop, min\_version\_ios·android(추가 예정, min\_version\_web은 쓰지 않음), `flags`(jsonb), 기능별 끄기 스위치(kill switch)
- 앱 시작과 재연결 때 확인
- 최소 버전보다 낮으면 동기화를 멈추고 업데이트 안내. 오프라인 큐는 지우지 않고 업데이트 후 보냄
- 모바일은 최소 버전보다 낮으면 업데이트 안내 → 스토어. 최소 버전은 새 버전이 스토어에 공개된 뒤에만 올림

### 모니터링

- 오류: Sentry (데스크톱, 모바일, Edge Functions)
- 가용성과 상태 페이지: Better Stack. 목표 99.5%
- 제품 지표: PostHog. North Star는 월급 체크를 한 부부 수(→ 기획서 성공 지표)
- 백업: 매일, 30일 보관, 분기마다 복구 훈련. RPO 24시간, RTO 4시간
- 성능 목표: 앱 시작 2초, 화면 전환 0.3초, 동기화 p95 3초

### 성능 측정

| 목표 | 이벤트 | 재는 구간 |
| --- | --- | --- |
| 앱 시작 2초 | `perf_app_started` | main 프로세스 시작 → 첫 화면에 캐시 데이터 표시 |
| 화면 전환 0.3초 | `perf_route_changed` | 메뉴 클릭 → 새 화면 첫 그림 |
| 동기화 p95 3초 | `perf_sync_applied` | 찬우 기기 저장 시각(서버) → 예빈 기기 화면 반영 |

- 기준 기기: 저사양 Windows 노트북 한 대(사양은 docs에 고정). 목표는 이 기기에서 판단
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

- Astro 정적 사이트(L-01·02·03·05·06, 28). 틀 `src/layouts/Site.astro`(SiteLayout: 상단 바, 하단, 사업자 정보), 문구·주소 `src/lib/site.ts`, 브라우저 동작 `src/lib/client.ts`(OS별 다운로드·스토어 버튼, 다른 OS용 받기, 접기, 측정 이벤트 `site_*`는 PostHog 연결 전까지 개발 중 콘솔만). OS 판정은 core `detectSiteOs`·`installOs`(Vitest)
- L-02 `/download?os=`: 보이지 않는 iframe으로 고정 주소(download.sweetwo.kr/latest/mac|win)를 받음(페이지를 떠나지 않음), 한 번 받은 뒤 주소에 `started=1`(새로고침해도 다시 받지 않음), 이 브라우저에 `sweetwo-app-seen`·`sweetwo-download-id` 저장. download_id를 앱 첫 실행으로 넘기는 방법(다른 도메인)은 기획 확인 뒤
- 원본 마크다운: FAQ `src/content/faq.md`(앱 S-20은 `pnpm content:sync`로 복사), 릴리스 노트 `src/content/releases.md`, 약관·처리방침 `src/content/{terms,privacy}/{시행일}.md`(frontmatter version·effective, 지금 시행 중 = 시행일이 오늘 이전 중 최근, `?v={시행일}`로 이전 버전). 약관·처리방침은 법률 검토 전 초안
- 초대 링크 `/i/{코드}`: 정적 파일이 없어 404 페이지(Cloudflare가 404.html을 줌, wrangler.jsonc `404-page`)가 초대 화면(`components/Invite.astro`)을 보여 줌. 앱이 깔린 휴대폰은 앱 링크로 이 페이지까지 오지 않음. 데스크톱 앱 기록이 있으면 “sweeTwo 앱으로 열까요?”, 없으면 코드 + 스토어·다운로드 버튼((전환 전) 웹 앱 P-01로 보냄)
- 공유 이미지 `public/og.png`(1200×630, 흰 바탕 + 심볼 + 워드마크). 앱 화면 캡처(라이트, 캡처용 흔한 이름 한 쌍, 기획서 28)는 모바일 e2e 흉내로 찍어 넣는 것이 다음 단계, 지금은 심볼과 워드마크
- e2e `apps/site/e2e`(빌드 + 미리보기, Mac·Windows·Windows 7·휴대폰 UA, 라이트·다크·좁은 창), CI e2e-web 잡에서 같이

### 어드민 인증

- 주소 ops.sweetwo.kr. CloudFront WAF IP 허용 목록과 2단계 인증 필수
- 어드민 권한: 같은 Supabase 프로젝트, 관리자 role claim + RLS
- 열람과 변경은 모두 audit\_log에
- 관리자 계정: `admin_user`(회사 이메일, 역할 `super/ops/cs/analyst` 여러 개, 잠금). 최고 관리자가 이메일을 넣으면 그 사람이 매직 링크(PKCE, `?code=` → `exchangeCodeForSession`)로 처음 로그인할 때 `admin_me`가 연결. 인증 앱(TOTP) 등록·확인으로 aal2가 돼야 어드민 함수가 열림(`admin_require`: 관리자 + 잠금 아님 + `aal2` + 역할). 30분 무활동·최대 8시간은 어드민 앱(`apps/admin/src/session.ts`), 세션은 localStorage(매직 링크가 새 탭에서 열려서). 무활동 시각도 localStorage에 남겨 브라우저를 닫았다 열어도 이어서 셈. 로그인 링크는 보낸 뒤 60초 동안 다시 못 보냄, Supabase 오류 코드(`over_email_send_rate_limit`, `email_address_not_authorized`)는 화면 문구로 바꿈
- 어드민은 테이블을 직접 읽지 않고 `admin_*` security definer 함수로만(`admin_user`, `admin_audit`, `job_run`은 anon·authenticated 권한 없음). 함수마다 `admin_log`로 `admin_audit`에 같은 트랜잭션으로 남김(기록이 실패하면 조치도 안 됨). 화면 ID별 함수: AD-01 `admin_dashboard`, AD-02 `admin_search`(정확히 일치), AD-03 `admin_user_detail`(L0, 금액 없음), AD-04 L1 `admin_reveal`(사유 + 문의 번호, 앱이 30분 보여 주고 가림), L2 `admin_request_access`(CS만, 문의 상세 AD-06에서) → 사용자 S-19b 동의 → `admin_access_data`(동의 범위·24시간, 금액은 `won_band` 구간), AD-05 `admin_account_action`(전체 기기 로그아웃, 권리 요구 기록), AD-06 `admin_inquiries`·`admin_inquiry`·`admin_answer_inquiry`(답변 → 사용자 답변 대기 + ‘문의 답변 도착’ 알림)·`admin_set_inquiry_status`, AD-17 `admin_audit_rows`(최고 관리자만 전체)
- 어드민 앱: `apps/admin`(React, react-router, react-query), 틀은 ui `AdminFrame`·`DataTable`, 문구는 `apps/admin/src/copy.ts`. e2e는 `apps/admin/e2e`(가짜 Supabase, 1440 폭 라이트·다크), CI e2e-web 잡에서 같이. AD-20 문서는 작은 마크다운 렌더러(`apps/admin/src/markdown.tsx`, HTML 문자열 안 씀)와 빌드 때 docs/ 마지막 커밋(`__DOCS_COMMIT__`)
- 2인 승인(`admin_approval`): 공지 게시(AD-10), 약관 버전(AD-15), 앱 버전·점검(AD-16), 관리자 추가·역할(AD-18)은 요청 → `admin_decide`(최고 관리자, 요청자 본인 불가 `self_approval`) → 적용. 요청자는 취소. 시스템 메뉴 `/system/approvals`
- 첫 최고 관리자: 관리자가 한 명도 없을 때 회사 도메인(@sweetwo.kr) 이메일로 처음 로그인한 사람(`admin_bootstrap`, 어드민 앱이 `not_admin`일 때 한 번 부름). 그 뒤 추가는 AD-18 승인으로. 90일 미접속 자동 잠금 `lock_idle_admins`(매일)
- 개발 서버 어드민 로그인 준비(2026-10-25)
  - 회사 메일: 네이버웍스(`@sweetwo.kr`). 메일 받는 서버(MX)와 SPF, 도메인 인증 TXT가 Cloudflare DNS에 있어야 함(가비아 DNS 값을 옮김). Cloudflare Email Routing은 켜지 않음(MX를 덮어씀)
  - 스테이징 Supabase 기본 메일은 조직 팀원 주소로만, 한 시간에 2통까지 보냄. 어드민으로 들어올 회사 메일 주소를 Supabase 조직 → Team에 초대하고 수락해 둠. 운영자가 늘거나 출시 전에는 메일 발송 서비스(SES)를 Supabase SMTP에 붙임
  - `dev-ops.sweetwo.kr` → 회사 메일 입력 → 메일의 링크 → 인증 앱 QR 등록 → 6자리 숫자. 처음 들어온 `@sweetwo.kr`이 최고 관리자
- 공지(AD-10 `notice`): 초안 → 승인 요청 → 게시. 밤 10시~아침 8시 시작 불가(`quiet_hours`). 앱은 RLS로 게시·노출 기간 안의 것만 읽고 이번 달 상단 띠(`month/notice-band.tsx`, 필독 먼저, 일반은 닫으면 이 기기에서 안 보임)
- 콘텐츠: AD-14 `content_version`(확인일 6개월 지나면 ‘재검토’), AD-15 `terms_version`(법률 검토 체크 없으면 `legal_check_required`, 버전별 동의 수, 앱은 승인된 버전만 읽음. 재동의 화면은 다음 단계), AD-19 `loan_rate`(0.01% 단위 정수, 누구나 읽음)·공휴일 직접 추가·지우기
- 앱 버전·점검(AD-16): `app_config.latest_version_desktop`, `maintenance_starts_at/ends_at/message`. A-01이 점검 시간 안이면 ‘지금 점검 중이에요’ / ‘{시각}에 끝나요’(`fetchLaunchConfig`)
- 다음 단계(어드민): 약관 재동의 화면(앱), 공지·장애 고지 메일(SES), 회원 목록 내려받기, 로그인 수단 이전·삭제 대리 접수, 금액 원값 최고 관리자 승인, 최소 지원 버전 미만 기기 수, AD-19 항목 이름 목록
- 문서 메뉴(AD-20): 어드민을 배포할 때 저장소 docs/(기획서 docs/spec, 디자인 docs/design과 DESIGN.md, 개발 가이드 docs/DEV\_GUIDE.md)를 함께 빌드해 읽기 전용으로 보여 줌. 어드민에 로그인한 사람 모두 읽기

## MVP 순서

두 사람이 같이 쓰는 흐름이 핵심이라, 부부 연결과 동기화를 먼저 만들고 그 위에 기능을 올림. 단계별 기간은 인원이 정해지면 채움.

1. 기반: 모노레포, CI, 디자인 시스템 패키지, Electron 껍데기와 Capacitor 껍데기, Supabase 환경 3개
2. 로그인과 부부 연결: 소셜 로그인 3종, 딥링크, 잠금, 초대 링크와 6자리 코드, 합류 (A, P 화면)
3. 동기화 뼈대: change\_log, Realtime 구독, 델타 동기화, 충돌 규칙, 휴지통
4. 자산과 목표: 자산, 부채, 통장 역할(통장 하나 모드 포함), 목표 21종과 그림, 공개 범위
5. 한 달 흐름: 월 계획 만들기(pg\_cron), 월급 나누기, 월말 정리(W-04j 지출 입력, W-04k 저축 확인, W-04g 정산 요약, spend\_category·item\_catalog, 꼼꼼 모드·함께 모드 포함)
6. 제안: 제안 상태 6가지, 자동 적용, 함께 정하기, 연결 해제
7. 알림과 캘린더: 데스크톱 로컬 알림, 이메일, 방해 금지 시간, 양가 캘린더와 음력, 트레이 위젯
8. 어드민과 출시 준비: 어드민 필수 메뉴(AD-19 항목 이름 목록·계산 설정값 포함), 문서 메뉴(AD-20, 저장소 docs/ 읽기 전용), 내보내기(CSV, PDF), 웹사이트 L-01\~L-03, L-05, L-06과 다운로드 고정 주소, 서명과 업데이트, 보안 점검
9. 내부 테스트와 정식 출시: 지인 20\~30쌍 내부 테스트(운영 환경), 출시 준비 탭의 QA 매트릭스와 출시 승인 기준을 넘으면 전체 공개로 출시(단계 배포는 이후 업데이트부터)

### 개발 시작 전 준비물

- [ ] GitHub 조직과 저장소, 기획서와 디자인 시스템 링크를 docs에
- [ ] Supabase 조직
- [ ] Supabase 프로젝트 2개 만들기: sweetwo-staging, sweetwo-prod, 서울 리전, Pro 플랜
- [ ] AWS 계정: KMS, SES(발송 도메인 인증, 발송 제한 해제 신청), S3, CloudFront. SPF는 TXT 한 줄에 네이버웍스와 SES를 함께 넣음(SPF 레코드는 하나만)
- [x] 도메인: 서비스(sweetwo.kr, app, download, status)와 메일
- [ ] 어드민 도메인 ops.sweetwo.kr
- [ ] 카카오 디벨로퍼스 앱, 구글 OAuth 클라이언트, Apple 로그인 설정
- [ ] Apple Developer 계정(서명, 공증, 애플 로그인), Windows 클라우드 HSM OV 서명 계정(SSL.com eSigner, 법인 확인 1\~2주라 기반 단계에서 신청)
- [ ] Sentry, PostHog 자체 운영 서버, Better Stack
- [ ] 네이버웍스 help@sweetwo.kr과 privacy@sweetwo.kr 그룹 메일 만들기 (도메인 등록과 메일 DNS 연결은 10월 12일 완료: MX, SPF(TXT 한 줄에 include:worksmobile, SES는 나중에 같은 줄에), DKIM(선택자 naverworks), DMARC p=none)

## 개발 착수 체크리스트

착수 전에 범위, 기술 준비, 디자인 연결, 남은 일, 열린 결정을 한곳에서 확인함. 모든 항목은 이 문서와 기획서에 이미 있는 내용 기준.

### 확정된 범위 (MVP 1차)

순서는 위 ‘MVP 순서’를 따르고, 화면 ID는 기획서 ‘화면 설계’ 탭 기준.

| 순서 | 단계 | 화면 |
| --- | --- | --- |
| 1 | 기반 | 앱 기본 틀(이번 달 탭의 공통 틀), 공통 상태 |
| 2 | 로그인과 부부 연결 | A-01\~08, O-01, P-01\~11, S-12(초대·연결 해제) |
| 3 | 동기화 뼈대 | 화면 없음(휴지통 S-21만) |
| 4 | 자산과 목표 | O-03\~O-67(온보딩 ①②), F-(우리 자산, F-08 제외), G-(목표) |
| 5 | 한 달 흐름 | H-(이번 달, 검색 포함), W-01\~03, W-04\~(기본 j·k·(h)·g, 꼼꼼 모드 b\~f·i, W-04p), W-07 |
| 6 | 제안 | G-08, W-04p, 함께 정하기, S-12 해제 대기 |
| 7 | 알림과 캘린더 | N-01\~03, Y-(캘린더), WG-01\~05(데스크톱 트레이 위젯 창만) |
| 8 | 어드민과 출시 준비 | AD-(필수 메뉴, AD-19·AD-20 포함), S-01\~22 나머지, L-01\~03·L-05·L-06 |

- 1차 밖: 비슷한 부부와 비교(F-08), 수익률 시뮬레이션, 계획 다시 세우기 비교, 월말 정리 심화, 양가 균형 리포트, 결제·체험(S-16·AD-08·AD-09), OS 기본 위젯, 모바일 앱, Windows Hello

### 기술 준비

- [ ] GitHub 조직과 저장소, pnpm 워크스페이스 + Turborepo 골격(apps/desktop·mobile·admin·site, packages/ui·app·core·api, supabase/)
- [ ] .nvmrc, packageManager 버전, lint-staged, eslint-plugin-boundaries import 규칙
- [ ] PR 템플릿, ADR 템플릿(docs/adr), CODEOWNERS(supabase/ 리뷰 2명, packages/ui는 디자인 시스템 오너)
- [ ] .env.example 5개(apps/desktop, apps/mobile, apps/admin, apps/site, supabase/functions), 비밀 값 담당자와 교체 주기(docs/secrets.md)
- [ ] Supabase 프로젝트 sweetwo-staging, sweetwo-prod(서울, Pro 플랜), GitHub Environments staging, production(승인자 1명)
- [ ] AWS: KMS 키(staging, prod), SES 발송 도메인 인증과 발송 제한 해제, S3 + CloudFront, 최소 권한 IAM 사용자
- [ ] OAuth 앱 3종 × 3환경(카카오, 구글, 애플), Supabase Auth 리다이렉트 허용 목록
- [ ] 서명: Apple Developer(서명, 공증, 애플 로그인), Windows 클라우드 HSM OV 서명 계정(SSL.com eSigner, 기반 단계에서 신청)
- [ ] 관측: Sentry, PostHog 자체 운영 서버, Better Stack(상태 페이지)
- [ ] 메일: 네이버웍스 help@, privacy@ 그룹 메일, SPF는 TXT 한 줄에 네이버웍스와 SES
- [ ] DB 마이그레이션 순서(테이블마다 공통 컬럼 + RLS 정책 4개 + pgTAP): ① 공통 틀(is\_space\_member, updated\_at·version·change\_log 트리거) ② couple\_space, app\_user, invite, income\_period, device\_session, consent ③ change\_log(seq, mutation\_id), amount\_history ④ account, asset, debt, fixed\_expense, annual\_event ⑤ goal, goal\_use, wedding\_cost\_item, monthly\_plan, plan\_line, month\_close, spend\_category, month\_spend, big\_expense, saving\_deposit, conversation\_card\_log, checklist\_item, checklist\_done ⑥ proposal, unlink\_request ⑦ family(암호화), care\_day, care\_round, family\_budget, photo ⑧ notification, todo, widget\_setting ⑨ inquiry, admin\_view\_request, holiday, notice, maintenance, app\_config, admin\_setting, item\_catalog, admin\_user, audit\_log, job\_run
- [ ] seed.sql: 찬우, 예빈, 연결된 부부 공간, 이번 달 월 계획
- [ ] 예약 작업 8개와 job\_run 기록, space별 advisory lock: create-monthly-plans, send-due-notifications, send-payday-reminders, send-evening-reminders, apply-unlink-defaults, send-weekly-summary, sync-holidays, purge-expired
- [ ] 알림 키: notification.kind를 기획서 ‘알림’ 탭 표의 종류와 1:1로, SES 템플릿(supabase/functions/\_shared/mail-templates/), 메일 상한 월 6회
- [ ] 분석 이벤트: 기획서 ‘성공 지표’ 4장 이벤트 이름과 속성, 공통 속성, 금액은 \_band 구간만, analytics\_off
- [ ] 테스트 벡터: core/rules/vectors/\*.json에 계산·배분 예시(W-04g 정산 요약 예시 포함)를 넣어 Vitest와 pgTAP이 같이 읽음
- [ ] 오류 코드 표(docs/errors.md)와 기획서 ‘공통 상태’ 문구 연결
- [ ] 음력 fixture(천문연구원 표 대조), 공휴일 fixture
- [ ] app\_config: min\_version\_desktop, min\_version\_ios·android, flags

### 디자인 연결

- 디자인 시스템(v125): https://claude.ai/artifact/5KKC9HnqXVWEja5sif5JjF
- tokens.css와 components/bundle.css를 packages/ui에 그대로 복사(pnpm ds:sync), 컴포넌트마다 React 래퍼(hg- 클래스). 색과 간격은 토큰만, 화면 코드에서 클래스 이름을 바꾸지 않음(→ ‘디자인 시스템 쓰는 법’)

| 화면 | 컴포넌트 |
| --- | --- |
| W-02, H-03, W-05 체크리스트 줄 | TransferRow(hg-transfer) |
| F-01 16번, W-01 6번, O-63 통장 목록 | ListRow |
| 검색(⌘K, 좁은 창 검색) | CommandPalette |
| 알림 센터 N-01·N-02 항목 | Avatar |
| 월말 정리 동시 저장 알림 등 | Toast |

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
- [ ] 모바일 앱 링크·로그인(기기 빌드 전): Apple Developer 팀 ID → 웹사이트 빌드 환경 변수 `PUBLIC_APPLE_TEAM_ID`(공개 값), Xcode → App 타깃 → Signing & Capabilities → Associated Domains `applinks:sweetwo.kr`. Android 서명 인증서 SHA-256(Play Console 앱 서명 키, 업로드 키) → `PUBLIC_ANDROID_CERT_SHA256`(쉼표로). appId `kr.sweetwo.app`은 스토어 등록 전에 확정
- [ ] 모바일 푸시: Apple Developer → Keys에서 APNs 키(.p8) → Edge Function Secrets `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY`, `APNS_TOPIC`(kr.sweetwo.app), 개발 설치면 `APNS_ENV`=`sandbox`. Xcode → Signing & Capabilities → Push Notifications. Firebase 프로젝트에 Android 앱(kr.sweetwo.app) 추가 → `google-services.json`을 `apps/mobile/android/app/`에(커밋하지 않음, CI 빌드는 없어도 됨), 서비스 계정 키 JSON → `FCM_SERVICE_ACCOUNT`. `openssl rand -hex 32` → `PUSH_CRON_SECRET`, Vault `push_function_url`(…/functions/v1/send-push)·`push_cron_secret`(같은 값). 다 넣은 뒤 `PUSH_DRIVER`=`send`
- [ ] 사진 지우기: `openssl rand -hex 32` → Edge Function Secrets `PURGE_CRON_SECRET`, Vault `purge_function_url`(…/functions/v1/purge-storage)·`purge_cron_secret`(같은 값). 넣기 전에는 지울 목록에 쌓이기만 함
- [ ] 웹사이트 스토어: 앱 등록 뒤 App Store 주소 → 웹사이트 빌드 환경 변수 `PUBLIC_APP_STORE_URL`(Google Play는 `kr.sweetwo.app`으로 정해져 있음, 바꾸면 `PUBLIC_PLAY_STORE_URL`). 공식 배지 이미지(Apple 마케팅 리소스, Google Play 배지)를 받아 `docs/design/assets`에 넣으면 `StoreBadges.astro`를 이미지로 바꿈
- [ ] 운영 준비 때: Supabase 토큰 `github-actions-sweetwo-prod`(sweetwo-prod만) → GitHub Environments production(승인자 1명), `deploy-prod.yml`

### 확정된 결정(10월 14일)

- 결제 회사: MVP 밖, 유료화 때 토스페이먼츠 우선 검토
- 로그인: 시스템 브라우저(모바일은 시스템 로그인 창) → https://sweetwo.kr/auth/callback → 데스크톱은 sweetwo:// 딥링크, 모바일은 앱 링크. 루프백은 쓰지 않음(Apple 로그인이 https 리다이렉트만 허용)
- 어드민 권한: 같은 Supabase 프로젝트, 관리자 role claim + RLS, 2단계 인증과 WAF IP 허용 필수
- 어드민 도메인: ops.sweetwo.kr
- Windows 서명: 클라우드 HSM OV 서명(SSL.com eSigner 우선, 대안 DigiCert KeyLocker). Azure Trusted Signing은 신규 가입이 미국·캐나다 법인만이라 제외. 법인 확인 1\~2주라 기반 단계에서 신청
- 백업: Supabase Pro 기본 일일 백업 + 매일 pg\_dump → S3(30일 보관). PITR은 사용자가 늘면
- 초안 값: Supabase 프로젝트 sweetwo-staging, sweetwo-prod / 파일 크기 상한 그림 150KB, 영상 1MB / 번들 예산은 첫 빌드에서 측정해 정함

열린 결정: 없음
