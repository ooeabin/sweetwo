# sweeTwo 개발 규칙

이 저장소에서 사람이든 AI(Claude Code, Cursor)든 코드를 쓰기 전에 이 파일을 먼저 읽고 지킨다. 자세한 기준은 `docs/DEV_GUIDE.md`. Cursor는 `.cursor/rules/sweetwo.mdc`가 이 파일을 불러온다.

## 기준 문서 (모두 이 저장소 안, 정본)

| 무엇 | 어디 | 기준인 것 |
| --- | --- | --- |
| 기획서 | `docs/spec/` (목차 `docs/spec/README.md`) | 화면 ID, 요소 표, 문구, 계산·배분 규칙, 예외 |
| 디자인 | `docs/DESIGN.md`, `docs/design/` | 토큰, 컴포넌트(hg- 클래스), 그림, 아이콘 |
| 개발 가이드 | `docs/DEV_GUIDE.md` | 스택, 구조, 개발 규칙, 배포 |
| 이 파일 | `CLAUDE.md` | 매번 지킬 핵심 규칙 |

- 서로 다르면: 계산식과 문구는 `docs/spec`, 생김새는 `docs/DESIGN.md`, 코드 규칙은 `docs/DEV_GUIDE.md`가 이긴다.
- 문서에 없는 동작을 지어내지 않는다. 모르면 멈추고 묻는다.
- 어드민 ‘문서’ 메뉴(AD-20)가 배포할 때 `docs/`를 그대로 보여 준다. 미리보기 페이지(기획서 사본, 디자인 시스템 미리보기)는 참고용 사본이다.

## 문서는 바로 고친다

- 코드를 바꾸면서 기획, 디자인, 규칙이 달라지면 **같은 PR에서** 해당 md를 바로 고친다. 따로 변경 목록을 두지 않는다. git 기록이 변경 이력이다.
  - 화면 동작이나 문구가 바뀜 → `docs/spec/<탭>.md`의 그 화면 ID 부분
  - 생김새나 컴포넌트가 바뀜 → `docs/design/components/<이름>.md`, `docs/design/bundle.css`나 `tokens.css`, 필요하면 `docs/DESIGN.md`
  - 개발 규칙이 바뀜 → `docs/DEV_GUIDE.md`와 이 파일
- 한 곳을 고치면 같은 내용을 말하는 다른 문서도 찾아서 맞춘다(화면 ID, 컴포넌트 이름으로 검색).
- 디자인 CSS를 고쳤으면 `pnpm ds:sync`로 `packages/ui/src/styles/`에 복사한다. 복사본은 손으로 고치지 않는다.
- 커밋 메시지에 문서도 바꿨다는 걸 적는다: `feat(w-04j): 큰 지출 칩에 자동차세 추가 + spec, design 갱신`

## 스택 (확정, 바꾸려면 docs/adr에 ADR)

Electron(데스크톱) + Capacitor(iOS, Android) + React 18 + TypeScript + Vite, TanStack Query + Zustand, React Router, Zod + React Hook Form, Supabase(Postgres, Auth, Realtime, Edge Functions, Storage, pg_cron, RLS), pnpm + Turborepo, Vitest, Playwright, pgTAP, GitHub Actions. 웹사이트는 Astro.

## 구조

- 한 저장소(pnpm + Turborepo 모노레포): `apps/desktop`, `apps/mobile`(전환 전 `apps/web`), `apps/admin`, `apps/site`, `packages/app`, `packages/api`, `packages/core`, `packages/ui`, `supabase/`, `docs/`.
- import 방향은 한쪽만: apps → app → (api, ui, core), api → core, ui → core. 거꾸로 가면 안 된다.
- 기능 폴더끼리는 서로의 `index.ts`로만 부른다.
- `packages/app`은 Electron과 Capacitor를 모른다. 데스크톱, 모바일 전용은 `window.sweetwo` 브리지로만.
- 웹 앱은 없다(ADR 0001). 브라우저 실행은 개발과 e2e용뿐.
- 화면 하나 = 파일 하나, 파일 이름은 기획서 화면 ID로 시작: `w-04j-spend-entry.tsx`.

## 코드

- TypeScript strict, `any` 금지. 서버 응답은 Zod로 검사한다.
- DB 타입은 `supabase gen types` 결과만 쓰고 손대지 않는다.
- 금액은 정수 원 단위만. 부동소수점 금지. 입력 상한 999억 원. 반올림은 기획서 계산·배분 규칙.
- 날짜는 KST 하나. 금액과 날짜 표기는 `packages/core`의 포맷 함수로만.
- 계산 규칙은 `packages/core/rules`에 두고 서버 함수와 같은 결과를 낸다. 계산·배분 탭 예시를 그대로 테스트로 만든다.
- 스키마는 추가만. 이름 바꾸기와 지우기는 2단계로.
- 비밀 값(service role, KMS, SES)은 앱 코드에 넣지 않는다. 앱에는 공개돼도 되는 값만 `VITE_`로.

## 화면과 디자인

- 디자인 시스템의 토큰과 컴포넌트(hg- 클래스)로만 만든다. hex 색, 임의 px 간격을 쓰지 않는다.
- 컴포넌트 React 래퍼 이름은 디자인 시스템 이름 그대로(`MonthSummary`, `SpendItems`, `BigExpense`, `Button` …). 클래스 이름을 바꾸지 않는다.
- 브랜드 색(분홍)은 워드마크, 주 버튼, 달성 배지, 새 알림 점, 결과 카드 체크, 온보딩 챕터 진행 막대에만. 카드 바탕에 쓰지 않는다. 보조 버튼은 옅은 분홍(`brand-soft`)을 카드 안과 O-01에서만.
- 다크 모드는 토큰이 처리한다. 화면마다 따로 처리하지 않는다.
- 그림은 Illustrations(512px, 무광 3D), 아이콘은 Phosphor. 그림을 다시 그리거나 색을 바꾸지 않는다.
- 다크 모드, 좁은 창(768px 미만), ‘동작 줄이기’, 키보드만으로 쓰기를 화면마다 확인한다.

## 문구

- 화면 문구는 기획서 요소 표의 “ ” 안 문장을 그대로, 해요체. 기능 폴더 `copy.ts`에 모은다.
- 사용자에게 ‘이체’라고 쓰지 않는다. ‘월급 나누기’. 통장은 ‘통장’.
- 연결 해제 때 자산 분할은 ‘자산 정리 안’. 예비부부는 ‘결혼 자금 모으기’.
- 띄운 가운데 점(" · ")을 쓰지 않는다.
- 기획서 예시와 테스트 이름은 찬우(시작한 사람), 예빈(합류한 사람). 사용자에게 보이는 곳(자리표시, 웹사이트·스토어 캡처)에는 쓰지 않는다. 자리표시는 “이름이나 애칭”처럼 사람 이름 없이.
- 오류 문구에 기술 용어나 오류 코드를 보이지 않는다.
- 결제 하나하나 기록, 은행 연동, 마이데이터, 스크래핑은 만들지 않는다.

## 제품 핵심 규칙 (자주 틀리는 것)

- 월말 정리 기본 흐름: W-04j 지출 입력 → W-04k 저축 확인 → (받은 제안이 있으면 W-04h) → W-04g 정산 요약. 잔액 단계는 ‘더 꼼꼼히 정리하기’에서만.
- 정산: 쓴 돈 = 고정 + 변동 + 용돈 + 큰 지출. 남은 돈 = 소득 − 쓴 돈 − 저축. 사용 비율 = 쓴 돈 ÷ 소득. 저축률 = W-04k 저축 ÷ 소득.
- 한 돈은 한 곳에서만 센다. 큰 지출은 변동 합계와 생활비 평균에서 뺀다. 챙길 날 기록은 미리 채움 값일 뿐 더하지 않는다.
- 월급 나누기(W-02)는 배우자가 합류했고 통장 역할을 나눈 부부에게만. 나머지는 홈에 ‘이번 달 남은 생활비’와 ‘지출 적기’.
- 통장 역할은 선택(‘통장 하나로 써요’ 모드). `account.role`, `saving_deposit.asset_id`는 null일 수 있다.

## 작업 순서 (기능 하나)

1. 기획서에서 화면 ID, 요소 표, 문구, 예외 확인
2. 마이그레이션(테이블, RLS, DB 함수) → pgTAP → `supabase gen types`
3. core: Zod 스키마, 계산 규칙 + Vitest
4. api: 쿼리 훅, 쿼리 키, Realtime 무효화
5. app: `copy.ts` → 화면 파일 → `routes.tsx`
6. 분석 이벤트, Playwright 흐름(찬우와 예빈 두 계정), 다크 모드와 좁은 창 확인

## 합치기 전 (Definition of Done)

- [ ] 타입 검사, lint, Vitest, Playwright 통과. RLS를 건드렸으면 pgTAP
- [ ] 문구가 기획서와 같음
- [ ] 다크 모드, 좁은 창, axe 접근성 확인
- [ ] 분석 이벤트 추가
- [ ] 기획이나 디자인을 바꿨으면 `docs/spec`, `docs/design` md도 같은 PR에서 고침
- [ ] PR 리뷰 1명(마이그레이션, RLS는 2명), Conventional Commits
