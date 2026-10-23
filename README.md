# sweeTwo

함께 구워 더 달콤한 자산파이. 부부 자산관리 앱(데스크톱, 모바일, 어드민, 웹사이트)을 한 저장소에서 만든다.

- 먼저 읽기: `CLAUDE.md`(규칙), `docs/DEV_GUIDE.md`(개발 가이드), `docs/spec/README.md`(기획서), `docs/DESIGN.md`(디자인)
- Cursor는 `CURSOR.md` 참고

## 시작

```bash
corepack enable
pnpm install
pnpm dev            # 모바일 화면(브라우저) 5173, 어드민 5174. 스테이징 DB를 바라봄(.env.development)
pnpm dev:desktop    # 데스크톱 앱
pnpm dev:site       # 웹사이트
pnpm test           # Vitest(core 계산, 딥링크)
pnpm db:start       # 로컬 Supabase(Docker), 마이그레이션 만들 때만. docs/DEV_GUIDE.md ‘로컬 개발 환경’
pnpm check:assets   # 그림, 영상 크기 상한
```

## 구조

| 폴더 | 무엇 |
| --- | --- |
| apps/desktop | Electron 데스크톱 앱 (Windows, macOS) |
| apps/mobile | 모바일 앱 (iOS, Android, Capacitor). 개발·e2e는 브라우저로 |
| apps/admin | 어드민 (ops.sweetwo.kr), AD-20 문서 메뉴 |
| apps/site | 웹사이트 (sweetwo.kr, Astro) |
| packages/app | 화면과 기능 (데스크톱, 모바일 공용) |
| packages/api | Supabase 클라이언트, 쿼리 |
| packages/core | 금액, 날짜, 계산 규칙, 스키마 |
| packages/ui | 디자인 토큰, 컴포넌트, 그림 |
| supabase | 마이그레이션, 함수, RLS 테스트 |
| docs | 기획서, 디자인, 개발 가이드 (정본) |
