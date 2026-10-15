# sweeTwo 개발 가이드

> 이 파일이 개발 가이드 정본이에요(2026-10-14부터). 매번 지킬 핵심은 저장소 맨 위 `CLAUDE.md`, 기획서는 `docs/spec/`, 디자인은 `docs/DESIGN.md`.
>
> 문서 고치는 법: 코드를 바꾸며 기획, 디자인, 규칙이 달라지면 같은 PR에서 해당 md를 바로 고쳐요. 따로 변경 목록을 두지 않고 git 기록이 변경 이력이에요.

## 한눈에 보기

MVP는 데스크톱 앱(Windows, macOS)과 반응형 웹을 Electron + React + TypeScript 한 코드로 만들고, 서버는 Supabase(서울 리전) 하나로 운영함. 모바일 앱과 OS 위젯은 2단계.

- 만들 것: 데스크톱 앱, 반응형 웹(온보딩과 핵심 설정 포함 일부 기능, app.sweetwo.kr), 트레이 위젯, 웹사이트(sweetwo.kr), 다운로드(download.sweetwo.kr/latest/mac|win), 상태 페이지(status.sweetwo.kr), 어드민(웹 전용, ops.sweetwo.kr). 메일은 help@sweetwo.kr, privacy@sweetwo.kr
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
| 암호화와 파일 | AWS KMS, S3 + CloudFront (서울) |
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
- 로그인: 시스템 브라우저 OAuth(PKCE) → https://app.sweetwo.kr/auth/callback → 딥링크(sweetwo://)로 복귀. refresh token은 main 프로세스가 safeStorage로 암호화해 보관(세부는 ‘인증과 세션’)
- 로컬 저장: 위젯 캐시와 오프라인 큐는 암호화, 키는 safeStorage
- 웹: 같은 React 앱을 웹 빌드로 배포(S3 + CloudFront). 웹에 없는 기능은 플랫폼 플래그로 숨김
- 서버 데이터: TanStack Query 캐시 + Realtime 변경 신호로 무효화. 끊기면 30초 폴링
- 화면 상태: Zustand(잠금, 금액 가리기, 월말 정리 진행 단계 등 기기 안 상태)

### 서버

- Supabase 서울 리전 하나: Postgres, Auth(카카오, 구글, 애플), Realtime, Storage(사진), Edge Functions
- 합계와 배분 계산: Postgres 함수. 클라이언트는 미리보기만 계산하고 저장 값은 서버 값
- 예약 작업: pg\_cron + Edge Functions (기준일 시작: 제안 적용 → 월 계획 만들기, 알림 발송, 연결 해제 기한, 보관 기간 정리)
- 필드 암호화: 메모와 가족 정보는 Edge Function에서 AES-256-GCM, 키는 AWS KMS
- 알림: 데스크톱 로컬 알림(앱이나 트레이가 켜져 있을 때 Realtime을 받아 Electron Notification으로 표시), 앱 안 알림센터, 이메일(SES). 모바일 푸시는 2단계

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
    web/          웹 빌드 (desktop과 같은 화면 코드)
    admin/        어드민 웹
    site/         웹사이트 L-01~L-03, L-05, L-06 (랜딩, 설치 안내, 릴리스 노트, 약관, 고객센터)
  packages/
    ui/           디자인 시스템 토큰, 컴포넌트, 그림
    app/          화면(페이지)과 화면 흐름, desktop과 web이 같이 씀
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

## 로컬 개발 환경

명령 3개(`supabase start` → `pnpm i` → `pnpm dev`)로 찬우, 예빈 부부 데이터가 든 앱이 뜨게 함.

### 준비물

- Node: 버전은 `.nvmrc`에 고정, `nvm use`
- pnpm: `corepack enable`로 package.json의 `packageManager` 버전을 씀
- Docker. Supabase CLI는 devDependency라 `pnpm db:*`로 씀

### 실행

1. `pnpm i`
2. `pnpm db:start`: 로컬 Postgres, Auth, Realtime, Storage, Inbucket(Docker). 출력의 API URL과 anon key를 `apps/web/.env.local`, `apps/desktop/.env.local`의 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`에
3. `pnpm dev`: 웹 5173, 어드민 5174. 데스크톱은 `pnpm dev:desktop`
4. 데이터 초기화: `pnpm db:reset` (마이그레이션 + seed.sql 다시 실행)
5. 마이그레이션을 바꿨으면 `pnpm db:test`(pgTAP) → `pnpm db:types`(packages/core/src/db.types.ts 다시 만듦, 손으로 고치지 않음)
6. 컴포넌트 모음: 개발 서버에서 `/dev/ui`(배포 빌드에는 없음)

### 스테이징과 운영 Supabase

- 프로젝트 2개(서울 리전 ap-northeast-2): `sweetwo-staging`(ref `xxofyzgzrjrcrcxvftpn`), `sweetwo-prod`(ref `rilhxjozsdcxcfshtvta`). 연결은 `pnpm supabase link --project-ref <ref>`
- DB 타입 파일은 `pnpm db:types`(로컬 Supabase)로 만들고, 생성기 버전에 따라 줄바꿈만 달라지지 않게 prettier 고정 옵션(`--no-config --no-semi --print-width 100`)으로 맞춰 저장한다. CI db 작업이 같은 명령으로 다시 만들어 공백과 줄바꿈을 빼고 비교함(다르면 실패, 결과물 db-types를 받아 커밋)
- 공개 값(URL, anon key)만 앱 `.env.local`과 GitHub 환경 변수로. service role은 GitHub Secrets와 서버에만

### 환경 변수와 대체물

- `.env.example`은 앱마다 하나: apps/desktop, apps/web, apps/admin, apps/site, supabase/functions
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
- 함께 모은 달(G-05 축하 문장): 목표별로 월말 정리 W-04k에서 확정된 납입 기록(saving\_deposit)만 집계, 그 달에 두 사람 모두 1원 이상 넣은 달만 셈. 모으기 시작 달부터 달성 달까지가 분모
- 순자산 기간 탭의 마지막 선택: 기기별 로컬 저장(서버에 저장하지 않음), 값이 없으면 기본 1년(쓴 지 1년 미만이면 전체)

### 테이블 묶음

| 묶음 | 테이블 |
| --- | --- |
| 부부와 사용자 | couple\_space, app\_user, invite, income\_period, device\_session, consent |
| 자산 | account, asset, debt, fixed\_expense, annual\_event, amount\_history |
| 목표와 계획 | goal, goal\_use, wedding\_cost\_item, monthly\_plan, plan\_line, month\_close, spend\_category, month\_spend, big\_expense, saving\_deposit, conversation\_card\_log, checklist\_item, checklist\_done |
| 가족 | family(암호화), care\_day, care\_round, family\_budget |
| 협업 | proposal, unlink\_request |
| 기록과 알림 | change\_log, notification, todo, widget\_setting, photo |
| 결제와 문의 | subscription, payment, inquiry(답변 포함), admin\_view\_request |
| 운영과 어드민 | holiday, notice, maintenance, app\_config, admin\_setting, item\_catalog(항목 이름 목록, 어드민에서 수정), admin\_user, audit\_log, job\_run(예약 작업 실행 기록), peer\_stat(출시 후) |

### 권한 규칙

- RLS 기본값은 막힘. 테이블마다 ‘같은 space의 구성원’만 읽고 씀
- 공개 범위 3단계(전체 공개, 합계만, 비공개)는 RLS와 security\_invoker = true 뷰로 걸러냄(이 옵션 없는 뷰는 소유자 권한으로 RLS를 건너뜀). 클라이언트에서 숨기지 않음
- 배분 결정(목표 금액, 나눔 방식 등)은 테이블을 바로 못 바꿈. proposal을 만들고 DB 함수가 적용
- 사실 값(잔액 등)은 마지막 쓰기가 이김. 배우자가 1분 안에 같은 필드를 바꿨으면 선택 화면
- 기록(change\_log, amount\_history)은 추가만. 수정과 삭제 권한 없음
- 어드민은 service role을 쓰지 않고 별도 함수로만 읽음. 문의한 사람의 동의(admin\_view\_request)가 있을 때만, 배우자에게 알림, 열람 기록 1년 보관

### 상태가 있는 것

- couple\_state: 미합류, 연결, 해제 대기, 혼자 쓰기
- proposal: 제안 중, 적용, 보류, 철회, 만료, 되돌림. 대상 하나에 열린 제안 1개
- 상태는 enum으로 두고, 바꾸는 것은 DB 함수만. 허용되지 않은 전환은 함수가 거부

### 동의와 문의

- consent 종류: 이용약관, 개인정보 처리, 배우자와 부부 공간 공유, 가족 정보, 사진(챙길 날), 마케팅 수신, 분석 수집, 통계 참여
- consent 행에는 종류, 약관 버전, 동의 여부, 시각. 철회도 새 행으로 추가
- 문의: 앱, 웹에서 inquiry 테이블에 저장 + help@sweetwo.kr로 사본 메일
- 답변: 어드민 AD-06에서 작성 → 앱 ‘내 문의’와 메일로 전달
- 문의 때문에 데이터를 봐야 하면 문의한 사람의 동의(admin\_view\_request)를 받고, 배우자에게 알림. 열람은 audit\_log에 기록

### 지금 있는 테이블과 함수

- `app_config`, `app_user`(프로필: 호칭, 신랑/신부, 출생연도, 일 형태, `space_id`), `consent`, `couple_space`, `goal`, `invite`
- 공간 소속은 `app_user.space_id`. `is_space_member(space_id)`가 이걸 본다. 공간은 `ensure_my_space()`만 만든다
- 사용자가 직접 못 바꾸는 열(부부 상태, 계정 상태, 로그인 수단)은 열 단위 `grant update`에서 뺀다
- `stamp_actor()` 트리거: created_by, updated_by, 휴지통에 넣을 때 deleted_by를 auth.uid()로. 목표 삭제는 `deleted_at`만(영구 삭제 정책 없음)
- 초대 코드: `create_invite()`(6자리, 0 O 1 I L 제외, 7일). 링크는 `https://app.sweetwo.kr/i/{코드}`, 앱은 `sweetwo://i/{코드}`
- 만 18세 미만(O-13): `delete_minor_account(출생연도)`가 서버에서 나이를 다시 확인하고 auth 사용자째 지움

### 마이그레이션과 RLS 규칙

테이블은 모두 같은 틀로 만들고, 틀에서 빠지면 리뷰에서 되돌림.

- 공통 컬럼(위 ‘공통 필드’) + `space_id` 인덱스 필수
- 트리거: updated\_at과 version 갱신, change\_log 기록
- RLS 켬 + 이름 붙은 정책 4개(`<테이블>_select`, `_insert`, `_update`, `_delete`)
- 정책은 `is_space_member(space_id)`만 씀. 이 함수는 `STABLE SECURITY DEFINER`, `SET search_path = ''`
- 공개 범위 뷰는 반드시 `WITH (security_invoker = true)`
- pgTAP: 테이블마다 본인, 배우자, 다른 부부, 익명 × 읽기, 추가, 수정, 삭제
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
- 웹: 탭 안 메모리 큐만. 탭을 닫으면 사라짐을 안내
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
- 리다이렉트는 https://app.sweetwo.kr/auth/callback 하나. 이 페이지가 code와 state를 sweetwo://auth/callback 딥링크로 넘김. 루프백(127.0.0.1)은 쓰지 않음(Apple 로그인이 https 리다이렉트만 허용)
- 토큰 갱신은 main 프로세스만. 렌더러(메인 창, 트레이)는 IPC로 access token만 받음
- refresh token은 safeStorage로 암호화해 파일에, 30일 슬라이딩

### OAuth 앱과 리다이렉트

| 제공자 | 로컬 | 스테이징 | 운영 |
| --- | --- | --- | --- |
| 카카오 | 개발용 앱 | 스테이징 앱 | 운영 앱 |
| 구글 | 개발용 클라이언트 | 스테이징 클라이언트 | 운영 클라이언트 |
| 애플 | 개발용 Services ID | 스테이징 Services ID | 운영 Services ID |

- 카카오: 이메일은 선택 동의 항목. Supabase 카카오 설정에서 ‘이메일 없는 사용자 허용’을 켜야 거부한 사람이 A-04로 감(로컬은 config.toml `email_optional = true`)
- Supabase Auth 리다이렉트 허용 목록: 환경마다 그 환경의 웹 콜백 주소 하나. 데스크톱은 쿼리(`?from=desktop&state=…`)를 붙여 같은 주소를 거치므로 끝에 `**`를 붙인다
  - 운영 `https://app.sweetwo.kr/auth/callback**`, 로컬 `http://localhost:5173/auth/callback**`(스테이징 웹 주소는 정해지면 추가)
- 데스크톱 흐름(구현): main이 code_verifier와 state를 만들고 `{SUPABASE}/auth/v1/authorize?provider=…&redirect_to={웹}/auth/callback?from=desktop%26state=…&code_challenge=…&code_challenge_method=s256`을 기본 브라우저로 엶 → 웹 콜백 페이지(`packages/app` `auth-callback.tsx`)가 code(취소면 error)와 state를 `sweetwo://auth/callback`으로 넘김 → main이 state를 확인하고 `/auth/v1/token?grant_type=pkce`로 교환
  - 파일: `apps/desktop/src/main/auth.ts`(로그인, 갱신, 로그아웃), `pkce.ts`(+ 테스트), `ipc.ts`(보낸 창 확인 + Zod), `lock.ts`(A-06)
  - 렌더러의 supabase-js는 `accessToken` 옵션으로 브리지에서 access token만 받는다(`supabase.auth`는 데스크톱에서 쓰지 않음)
  - main이 읽는 값: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_WEB_ORIGIN`(apps/desktop/.env.local, 공개 값만)
- 같은 이메일, 다른 소셜(A-02 ‘자동 합치기 없음’): Supabase는 확인된 같은 이메일의 소셜 계정을 한 사용자로 자동 연결한다. 그래서 로그인 직후 `login_state(누른 제공자)`가 가입한 제공자와 다르면 `provider_conflict`를 돌려주고, 앱은 바로 로그아웃한 뒤 “이미 {카카오}로 가입한 이메일이에요”를 보여 준다. 계정 식별은 가입 때 제공자(`app_user.provider`)
- 가입: 소셜 로그인만으로는 계정이 아니다. A-05 ‘동의하고 계속하기’의 `complete_signup()`이 `app_user`와 동의 기록(필수 3종 + 마케팅)을 한 번에 만든다. 그 전에 그만두면 auth 사용자만 남음(정리 작업은 예약 작업 단계에서)

### 웹 세션

- supabase-js 브라우저 저장소 + 엄격한 CSP(인라인 스크립트 금지, 연결 대상은 Supabase, PostHog, Sentry만)
- ‘로그인 유지’ 끄면 sessionStorage(탭을 닫으면 로그아웃), 켜면 localStorage 최대 14일(로그인 시각 `sweetwo.login-at`, 실행 때 A-01이 확인 → A-08). 구현은 `packages/api` `client.ts`의 저장소
- 30분 동안 입력이 없으면 로그아웃하고 A-08(‘오래 자리를 비워서 잠갔어요’), 다시 로그인하면 하던 화면으로(`sweetwo.return-to`)
- 웹 로그인은 지금 리다이렉트만. 넓은 창 팝업은 아직

### 잠금

- MVP: PIN 6자리 + macOS Touch ID(`systemPreferences.promptTouchID`)
- PIN은 main에서 scrypt 해시로 safeStorage 저장소에(`app-lock`), 틀린 횟수도 main이 셈. 5회면 PIN 지우고 로그아웃
- 자동 잠금: 시스템 입력이 5분 없을 때, 화면 잠금, 절전. Ctrl(⌘)+L. 잠금 화면은 앱 전체를 덮어 금액이 보이지 않음
- safeStorage를 못 쓰는 환경(키체인 없는 Linux 등)에서는 PIN과 refresh token을 저장하지 않는다(다음 실행 때 다시 로그인)
- Windows Hello는 네이티브 모듈이 필요해 출시 후

## 예약 작업과 알림

예약 작업은 pg\_cron(UTC)이 Edge Function을 부르고, 실행마다 job\_run에 기록함. 시각은 초안.

### 예약 작업

| 작업 | KST | cron(UTC) | 함수 |
| --- | --- | --- | --- |
| 기준일 시작: 적용일이 된 제안 적용·만료 → 월 계획 만들기를 한 작업으로(그날 주기가 시작하는 space만) | 매일 00:00 | `0 15 * * *` | `create-monthly-plans` |
| 날짜 알림(챙길 날, 만기, 결혼 준비 결제일, 지원금·전세 만기, 초대 코드, 제안 적용 예정, 연결 해제 기본안 적용 예정, 연말정산 등 오전 9시 알림) | 매일 09:00 | `0 0 * * *` | `send-due-notifications` |
| 기준일·월급날 알림(알림을 켜 둔 사람만): 월급 나누기를 쓰면 월급날 “오늘은 월급 나누는 날이에요”, 안 쓰면 기준일 “이번 달 월급 플랜이 나왔어요”, 예비부부(H-P3)는 월급날 “오늘은 결혼 자금 모으는 날이에요” | 매일 09:00 | `0 0 * * *` | `send-payday-reminders` |
| 저녁 알림: 생활비 체크(중간일, 켠 부부만), 월말 정리(기준일 3일 전), 리마인드(전날, 정리 전일 때만), 예비부부 월말 확인 | 매일 20:00 | 0 11 \* \* \* | send-evening-reminders |
| 연결 해제 기본안 적용(요청 + 14일이 지나도 동의·합의가 없을 때) | 매일 00:00 | 0 15 \* \* \* | apply-unlink-defaults |
| 주간 요약 메일 | 월 09:00 | `0 0 * * 1` | `send-weekly-summary` |
| 공휴일 받기 | 월 03:00 | `0 18 * * 0` | `sync-holidays` |
| 보관 기간 정리 | 매일 04:00 | `0 19 * * *` | `purge-expired` |

- 재시도: 함수 안에서 space 단위로 3회 지수 백오프. 끝내 실패하면 job\_run에 남기고 알림(‘운영 절차’)
- space마다 `pg_try_advisory_xact_lock`으로 중복 실행 막음. 작업은 멱등하게(두 번 돌아도 결과 같음)
- job\_run: 작업, 시작, 끝, 처리한 space 수, 실패 목록
- 다시 실행: 어드민 또는 `supabase functions invoke <이름> --body '{"date":"YYYY-MM-DD","spaceId":"…"}'`

### 알림

- 데스크톱 알림은 로컬: 앱이나 트레이가 켜져 있으면 Realtime을 받아 OS 알림으로 표시. 서버 푸시 없음
- ‘앱 꺼짐’ = 최근 10분간 데스크톱 presence 신호 없음 → 규칙에 따라 메일로 대신
- 앱 안 알림센터에는 항상 기록
- 상한은 메일만 계정마다 월 6회. 데스크톱 로컬 알림과 알림센터는 상한 없음. 주간 요약 메일과 웹만 쓰는 사람의 핵심 알림 메일은 상한 밖
- 마케팅 메일은 월 1회, 수신 동의한 사람만
- 방해 금지 22\~08시(KST): 끝나는 08시에 보냄
- 상한이나 방해 금지에 걸려 못 보낸 것은 알림센터에만
- 깜짝 선물 등 비밀 항목은 알림 본문을 가림
- SES 템플릿은 supabase/functions/\_shared/mail-templates/에. 모든 메일에 수신 거부 링크(필수 안내 메일 제외)
- 반송과 수신 거부 신고는 SNS → Edge Function이 받아 발송 중단 + 앱 배너 “이메일을 확인해 주세요”

## 디자인 시스템 쓰는 법

화면은 디자인 시스템 sweeTwo의 토큰과 컴포넌트로만 만들고, 색과 간격을 값으로 직접 쓰지 않음. 디자인 시스템 README가 규칙의 기준.

### 가져오는 법

- packages/ui에 tokens.css와 컴포넌트 CSS(components/bundle.css)를 그대로 두고, 컴포넌트마다 React 래퍼를 만듦 (예: `<Button variant="primary">` → `hg-btn hg-btn--primary`)
- 원본은 저장소 `docs/design/tokens.css`, `docs/design/bundle.css`. 바꾸면 `pnpm ds:sync`로 packages/ui에 다시 복사. 화면 코드에서 클래스 이름을 바꾸지 않음
- 색은 `var(--surface)`, `var(--ink)`처럼 토큰만. hex 값이 코드에 보이면 리뷰에서 되돌림
- 다크 모드는 기기 설정을 따름. 토큰이 바꾸므로 화면에서 따로 처리하지 않음

### 지킬 것

- 브랜드 체리색은 워드마크, 달성 배지, 새 알림 점에만(순자산 차트 끝점은 없음). 버튼과 카드 바탕에 쓰지 않음
- 아이콘은 Phosphor(굵은 선). 켜진 메뉴와 독 칸만 채운 모양
- 금액과 날짜 표기는 core의 포맷 함수 하나로만 (디자인 시스템 ‘금액 표기’, ‘날짜·시간 표기’ 장)

### 그림과 장면 영상

- 목표 그림 21장, 빈 상태 그림 1장, 장면 그림 5장: Illustrations 묶음, 배경을 지운 512px. 앱에는 webp(투명, 품질 90)로 넣음(`packages/ui/src/assets/illustrations`). 디자인 시스템 원본은 PNG. 모두 앱 아이콘(케이크 조각)과 같은 무광 3D 그림체. `object-fit: contain`
- 앱 아이콘(체리를 얹은 케이크 조각, 디자인 시스템 Brand 최종 확정): app-icon.png(1024), app-icon-macos.png, symbol.png(바탕 없음 512, 트레이·공유 이미지·랜딩), favicon-32/48.png, apple-touch-icon.png(180). 설치 파일용 .icns와 .ico, macOS 트레이 템플릿(한 색 실루엣)은 개발할 때 만듦. 체리 타르트는 A-02 장면 그림 scene-tart.webp(Illustrations, 영상 motion-a02-tart.mp4) 전용
- 장면 영상 5개: Motion 묶음, 480px MP4. W-04, P-11, P-01, H-T1, A-02에만. 영상은 예전 실사 그대로, 3D로 다시 만들기와 P-01, H-T1 잘림 수정은 보류(→ 기획서 출시 준비 4장 체크리스트)
- 재생: `<video muted playsinline autoplay>`, `loop` 없음, 정지 그림을 `poster`로
- 다크 모드, ‘동작 줄이기’, 로딩 전과 실패 때는 영상 대신 정지 그림
- 그림과 영상은 앱에 포함해 배포(네트워크 없이도 보이게). 웹은 CloudFront에서 오래 캐시

### 자산 파일 규칙

- 파일 이름: `<종류>-<이름>.webp|mp4` (예: `goal-04-home.webp`, `motion-w04-pie.mp4`)
- 크기 상한: 그림 150KB, 영상 1MB. `pnpm check:assets`(scripts/check-assets.mjs), CI가 넘으면 멈춤
- 그림은 `<Illustration name>`, 빈 상태는 `<EmptyState>`로만 씀. 파일을 직접 import하지 않음
- 장면 영상은 `<SceneMedia>` 컴포넌트 하나로만: 다크 모드, ‘동작 줄이기’, 로딩 실패 때 정지 그림으로 바꿈
- 웹 빌드는 파일 이름에 해시(Vite 기본)를 붙여 오래 캐시

### 디자인 시스템 갱신 절차

1. `docs/design/`(tokens.css, bundle.css, 컴포넌트 md)를 고친 뒤 `pnpm ds:sync`가 packages/ui로 복사하고 파일 머리에 커밋 번호를 주석으로 남김
2. `pnpm --filter @sweetwo/web e2e`로 컴포넌트 모음(/dev/ui)을 라이트, 다크, 좁은 창에서 돌리고 스크린샷(test-results)으로 바뀐 곳 확인
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

apps/web/
  src/main.tsx            packages/app의 <App platform="web"/>
  vite.config.ts

apps/site/                Astro 정적 사이트, S3 + CloudFront
  src/pages/
    index.astro           L-01 랜딩
    download.astro        L-02 설치 안내 (?os=mac|win)
    releases.astro        L-03 릴리스 노트
    terms.astro, privacy.astro   L-05 약관과 처리방침
    help.astro            L-06 고객센터
    i/[code].astro        초대 링크 (앱 열기 또는 웹 앱 P-01)
  src/lib/os.ts           OS 인식, 다운로드 주소
  src/content/            릴리스 노트, 약관, FAQ 원본 (마크다운)

packages/app/src/
  app.tsx                 라우터, 쿼리 클라이언트, 테마
  routes.tsx              경로 표 (화면 ID 주석)
  platform.ts             desktop/web 차이 (브리지 있으면 desktop)
  features/
    auth/                 A 화면
    onboarding/           O 화면
    pairing/              P 화면 (초대, 합류, 해제)
    month/                H 화면, W-01~03 (이번 달, 월급 나누기)
    month-close/          W-04~, W-07 (월말 정리)
    goals/                G 화면
    assets/               F 화면
    calendar/             Y 화면
    proposals/            제안
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
  assets/illustrations/   목표, 빈 상태, 장면 그림
  assets/motion/          장면 영상

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
| 화면 파일 | 화면 ID + 이름 | `w-04-month-close-done.tsx` |
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

- `packages/app/src/features/onboarding`: `flow.ts`(답에 따라 화면 목록), `step.tsx`(진행 막대, 뒤로, 저장 뒤 다음, 멈춘 화면 기록), `pages/o-xx-*.tsx`(화면 하나 = 파일 하나), `onboarding-route.tsx`(경로 `/onboarding/o-03` → 화면, 이어하기 `OnboardingGate`)
- 화면을 넘길 때마다 서버에 저장하고, `app_user.onboarding_step`에 멈춘 화면 ID. 다시 열면 그 화면부터(‘이어서 할까요?’ 확인은 아직 없음)
- 목표 템플릿, 질문 순서, 기본 기한, 월 필요액, ‘잘 모르겠어요’ 구간값은 `packages/core/src/onboarding`(Vitest). 화면은 이 정의만 읽는다
- 질문 입력 부품은 `packages/ui/src/components/question`(Q1 ChoiceCards, Q3 AmountInput, Q4 YearInput/DateInput/YearMonthInput, Q5 ShortText, 비율 PercentSlider, Q6 ListInput)
- e2e는 `apps/web/e2e/onboarding-mock.ts`의 메모리 DB로 흐름을 끝까지 돌리고 저장된 값을 확인

### 기능 하나 만드는 순서

1. 기획서에서 화면 ID, 요소 표, 문구, 예외를 확인
2. 마이그레이션: 테이블, RLS, 필요하면 DB 함수 → pgTAP 테스트 → `supabase gen types`
3. core: Zod 스키마와 계산 규칙 + Vitest
4. api: 쿼리 훅과 쿼리 키, Realtime 무효화 연결
5. app: copy.ts 문구 → 화면 파일 → routes.tsx에 등록
6. 분석 이벤트와 Playwright 흐름 추가, 다크 모드와 좁은 창 확인

### 환경 변수

- `.env.example`만 저장소에. 실제 값은 `.env.local`(커밋 금지)
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
- 화면 흐름: Playwright E2E. 두 계정(찬우, 예빈)으로 합류, 제안, 월말 정리
- 웹 e2e는 `vite --mode e2e`(apps/web/.env.e2e, 가짜 Supabase 주소)로 띄우고 `e2e/supabase-mock.ts`가 응답을 흉내 낸다. 실제 DB 규칙은 pgTAP이 맡음
- 테스트 데이터의 예시 이름은 찬우(시작한 사람), 예빈(합류한 사람)

### 테스트 세부

- 두 사람 흐름(합류, 충돌, 함께 모드): Playwright 브라우저 컨텍스트 2개로 찬우, 예빈을 동시에
- 데스크톱: Playwright `_electron`으로 실제 앱 실행(딥링크, 트레이, 잠금)
- 테스트마다 DB 초기화(seed 다시 넣기). 테스트끼리 데이터를 나눠 쓰지 않음
- 음력: fixture를 천문연구원 표와 대조
- 접근성: 화면마다 axe 검사, ‘동작 줄이기’ 켜고 한 번
- 디자인 시스템 컴포넌트: `/dev/ui` 컴포넌트 모음을 라이트, 다크, 좁은 창(375px)에서 열어 오류 없음, axe 위반 없음, 스크린샷(apps/web/e2e). 기준 이미지 비교는 화면이 안정되면 추가
- 데스크톱 실행: `apps/desktop/e2e`(빌드 뒤 `xvfb-run -a pnpm --filter @sweetwo/desktop e2e`). 딥링크 허용 목록은 Vitest(`deep-link-parse.test.ts`)

### 문구

- 화면 문구는 기획서 화면 요소 표의 “ ” 안 문장을 그대로. 해요체
- 문구는 기능 폴더마다 copy.ts에 모음. 한국어만 지원, 다국어 프레임워크 없음
- 오류 문구에 기술 용어와 오류 코드를 보이지 않음

### 단축키

기준은 기획서 공통 4장(아래 표와 다르면 기획서가 우선). 웹은 브라우저 단축키(Ctrl+L, Ctrl+N, Ctrl+1\~4)와 겹치지 않게 따로 둠.

| 동작 | 데스크톱 | 웹 |
| --- | --- | --- |
| 명령 창(검색 + ‘바로 하기’) | ⌘K / Ctrl+K | ⌘K / Ctrl+K |
| 탭 이동 | ⌘1\~4 / Ctrl+1\~4 | Alt+1\~4 |
| 새로 입력 | ⌘N / Ctrl+N | N(입력 칸 밖에서) |
| 잠그기 | ⌘L / Ctrl+L | 명령 창에서 |
| 금액 가리기 | ⌘⇧H / Ctrl+Shift+H | 명령 창에서 |

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
- 토큰: access token은 짧게, refresh token은 기기별. 데스크톱은 main 프로세스의 safeStorage, 웹은 supabase-js 브라우저 저장소 + 엄격한 CSP(‘인증과 세션’)
- 잠금: 데스크톱 PIN 6자리 또는 macOS Touch ID(Windows Hello는 출시 후), 5분 뒤 자동 잠금. 웹은 30분
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
- PostHog 공통 속성: platform(desktop, web), app\_version, os, couple\_state. 사람은 익명 id로만
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
| S3 버킷 | 없음 | web, site, 업데이트 | web, site, 다운로드, 업데이트 |
| Sentry 프로젝트 | 끔 | 환경 태그 staging | 환경 태그 production |

- GitHub Environments: staging, production. production은 승인자 1명이 승인해야 배포
- 비밀 값마다 담당자와 교체 주기를 docs/secrets.md에(값은 적지 않음). 사람이 나가면 그날 교체
- Edge Function의 AWS 접근은 최소 권한 IAM 사용자(KMS Encrypt/Decrypt, SES Send만), 키는 90일마다 교체

### CI/CD (GitHub Actions)

1. PR(`.github/workflows/ci.yml`): check(lint, 타입 검사, Vitest, 빌드, 에셋 크기, 비밀 값 검사), e2e-web(Playwright), e2e-desktop(Electron, xvfb), db(로컬 Supabase + pgTAP + DB 타입 비교)
2. main 합치기: 마이그레이션과 Edge Functions를 스테이징에 배포, 웹을 스테이징 S3에
   - 지금 있는 것: `.github/workflows/deploy-staging.yml`(마이그레이션만). `supabase/migrations`가 바뀐 채로 main에 합쳐지면 돌고, Actions 탭에서 손으로도 돌릴 수 있음
   - 필요한 비밀 값(GitHub Environments → staging): `SUPABASE_ACCESS_TOKEN`(배포 전용 토큰), `SUPABASE_DB_PASSWORD`(staging DB 비밀번호)
   - staging에 손으로 SQL을 넣지 않는다. 모든 변경은 마이그레이션 파일 → main → 이 작업으로
3. 태그(v1.2.0): 운영 마이그레이션 → Edge Functions → 웹 → 데스크톱 빌드, 서명, 업데이트 파일 업로드(‘업데이트와 릴리스’)

### 데스크톱 출시

- macOS 12 이상 universal 빌드(dmg), Apple Developer ID 서명과 공증
- Windows 10 64bit 이상(NSIS), 클라우드 HSM OV 서명(SSL.com eSigner 우선, 대안 DigiCert KeyLocker, ‘서명과 CI’)
- electron-updater: 채널 하나. 첫 출시는 전체 공개, 이후 업데이트만 단계 배포(‘업데이트와 릴리스’)
- 최소 지원 버전을 서버에 두고, 낮은 버전은 업데이트 안내
- Mac App Store, Microsoft Store는 출시 후 검토

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

태그 배포 순서

1. DB 마이그레이션(추가만이라 예전 앱이 그대로 동작)
2. Edge Functions
3. 웹(app.sweetwo.kr)
4. 데스크톱 빌드, 서명, 업데이트 파일 업로드

- 되돌림: 함수와 웹은 이전 버전 재배포, 데스크톱은 `stagingPercentage`를 0으로 두고 고친 버전을 새로 냄. 마이그레이션은 되돌리지 않고 고침 마이그레이션을 앞으로
- 되돌릴 때: 크래시 없는 세션 99% 미만, 동기화 p95 3초 초과가 30분 이상, 데이터 손상 의심

릴리스 노트와 약관

- 릴리스 노트: Conventional Commits로 초안 → 사람이 다듬은 한국어를 apps/site/src/content에 → L-03
- 약관, FAQ의 원본은 apps/site/src/content의 마크다운. 앱은 L-05, L-06 페이지를 앱 안 보기로 엶
- 어드민 AD-14, AD-15는 버전, 시행일, 다시 동의 여부만 관리(본문은 다루지 않음)

### 기능 플래그와 최소 버전

- app\_config 테이블 하나: `min_version`\_desktop, min\_version\_web, `flags`(jsonb), 기능별 끄기 스위치(kill switch)
- 앱 시작과 재연결 때 확인
- 최소 버전보다 낮으면 동기화를 멈추고 업데이트 안내. 오프라인 큐는 지우지 않고 업데이트 후 보냄
- 웹은 `version.json`을 주기적으로 읽어 새 버전이면 ‘새로고침’ 안내, min\_version\_web보다 낮으면 동기화를 멈추고 새로고침

### 모니터링

- 오류: Sentry (앱, 웹, Edge Functions)
- 가용성과 상태 페이지: Better Stack. 목표 99.5%
- 제품 지표: PostHog. North Star는 월말 정리를 마친 부부 수
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

### 어드민 인증

- 주소 ops.sweetwo.kr. CloudFront WAF IP 허용 목록과 2단계 인증 필수
- 어드민 권한: 같은 Supabase 프로젝트, 관리자 role claim + RLS
- 열람과 변경은 모두 audit\_log에
- 문서 메뉴(AD-20): 어드민을 배포할 때 저장소 docs/(기획서 docs/spec, 디자인 docs/design과 DESIGN.md, 개발 가이드 docs/DEV\_GUIDE.md)를 함께 빌드해 읽기 전용으로 보여 줌. 어드민에 로그인한 사람 모두 읽기

## MVP 순서

두 사람이 같이 쓰는 흐름이 핵심이라, 부부 연결과 동기화를 먼저 만들고 그 위에 기능을 올림. 단계별 기간은 인원이 정해지면 채움.

1. 기반: 모노레포, CI, 디자인 시스템 패키지, Electron 껍데기와 웹 빌드, Supabase 환경 3개
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

- [ ] GitHub 조직과 저장소, pnpm 워크스페이스 + Turborepo 골격(apps/desktop·web·admin·site, packages/ui·app·core·api, supabase/)
- [ ] .nvmrc, packageManager 버전, lint-staged, eslint-plugin-boundaries import 규칙
- [ ] PR 템플릿, ADR 템플릿(docs/adr), CODEOWNERS(supabase/ 리뷰 2명, packages/ui는 디자인 시스템 오너)
- [ ] .env.example 5개(apps/desktop, apps/web, apps/admin, apps/site, supabase/functions), 비밀 값 담당자와 교체 주기(docs/secrets.md)
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
- [ ] app\_config: min\_version\_desktop, min\_version\_web, flags

### 디자인 연결

- 디자인 시스템(v125): https://claude.ai/artifact/5KKC9HnqXVWEja5sif5JjF
- tokens.css와 components/bundle.css를 packages/ui에 그대로 복사(pnpm ds:sync), 컴포넌트마다 React 래퍼(hg- 클래스). 색과 간격은 토큰만, 화면 코드에서 클래스 이름을 바꾸지 않음(→ ‘디자인 시스템 쓰는 법’)

| 화면 | 컴포넌트 |
| --- | --- |
| W-04g 맨 위, F-01 17번 | MonthSummary(hg-sum) |
| W-04j, 이번 달 ‘지출 적기’ | SpendItems(hg-spend) |
| W-04j 맨 아래 | BigExpense(hg-big) |
| F-01 16번, W-01 6번, O-63 통장 목록 | ListRow |
| 검색(⌘K, 좁은 창 검색) | CommandPalette |
| 알림 센터 N-01·N-02 항목 | Avatar |
| 월말 정리 동시 저장 알림 등 | Toast |

### 착수 전 남은 일

- [x] 구현 기준 화면 그림 갱신: W-04 j·k·g, 보정 카드, 지출 적기 홈, W-01 6번, F-01 16·17, 앱 기본 틀(기획서 출시 준비 4장)
- [x] 놓친 달 와이어프레임 문구를 기본 모드(j·k) 기준으로 갱신
- [x] W-04h 와이어프레임의 생활비 예산 줄 갱신(지금은 W-04g 보정 제안)
- [ ] 장면 영상 3D 재제작과 P-01, H-T1 잘림 수정(보류)

### 확정된 결정(10월 14일)

- 결제 회사: MVP 밖, 유료화 때 토스페이먼츠 우선 검토
- 데스크톱 로그인: 시스템 브라우저 → https://app.sweetwo.kr/auth/callback → sweetwo:// 딥링크. 루프백은 쓰지 않음(Apple 로그인이 https 리다이렉트만 허용)
- 어드민 권한: 같은 Supabase 프로젝트, 관리자 role claim + RLS, 2단계 인증과 WAF IP 허용 필수
- 어드민 도메인: ops.sweetwo.kr
- Windows 서명: 클라우드 HSM OV 서명(SSL.com eSigner 우선, 대안 DigiCert KeyLocker). Azure Trusted Signing은 신규 가입이 미국·캐나다 법인만이라 제외. 법인 확인 1\~2주라 기반 단계에서 신청
- 백업: Supabase Pro 기본 일일 백업 + 매일 pg\_dump → S3(30일 보관). PITR은 사용자가 늘면
- 초안 값: Supabase 프로젝트 sweetwo-staging, sweetwo-prod / 파일 크기 상한 그림 150KB, 영상 1MB / 번들 예산은 첫 빌드에서 측정해 정함

열린 결정: 없음
