# ADR 0002: develop 브랜치 개발 서버, 정적 배포는 Cloudflare(Workers 정적 자산)

- 날짜: 2026-10-23
- 상태: 확정

## 맥락

- 확인할 때마다 로컬에서 DB(Docker), 앱, 어드민을 띄우는 게 번거로움. 머지 전후에 서버에서 바로 열어 보고 싶음.
- 기획서 29의 정적 파일 배포는 S3 + CloudFront(서울)였고, 아직 만들지 않음.
- 우리 정적 파일: 웹사이트(Astro), 어드민(Vite), 앱 화면(Vite, 개발 확인용. ADR 0001로 사용자용 웹 앱은 없음). 모두 개인정보를 저장하지 않음. DB, 로그인, 파일은 Supabase 서울.

## 결정

- 브랜치: 작업 브랜치 → PR → CI → `develop`(개발 서버) → 확인 → `main`(출시). `main`으로는 사람이 정할 때만 합침.
- `develop`에 합치면
  - DB: 스테이징 Supabase(`sweetwo-staging`)에 마이그레이션 적용(`deploy-staging.yml`). 로컬 DB 필요 없음
  - 앱 화면, 어드민, 웹사이트: Cloudflare Pages가 GitHub 연결로 빌드해 개발 서버 주소에 올림. 스테이징 Supabase에 붙고, 앱은 실제 소셜 로그인으로 들어감(데모 데이터 없음)
- PR마다 Pages 미리보기 주소가 생김(머지 전 확인용).
- 개발 서버와 미리보기는 Cloudflare Access(Zero Trust 무료, 이메일 일회용 코드)로 우리만 들어감.
- 운영: 웹사이트(sweetwo.kr)와 어드민 운영 주소도 Cloudflare Pages(`main`). 앱 화면 프로젝트는 운영 배포 없음(개발 확인용).
- 이 결정으로 기획서 29의 웹사이트·어드민 정적 배포는 S3 + CloudFront 대신 Cloudflare Pages. 데스크톱 설치 파일과 자동 업데이트 파일은 그대로 S3 + CloudFront(서울).

## 고른 대안

- Vercel Pro: 같은 기능, 사람당 월 20달러. 무료(Hobby)는 상업 이용 불가. 강점(Next.js 서버 렌더링)을 우리는 안 씀.
- AWS S3 + CloudFront: 서울 리전, 쓴 만큼 요금. 브랜치·PR 미리보기와 접근 보호를 직접 만들어야 함.
- Netlify: 무료도 상업 가능, 접근 보호는 유료. Firebase Hosting: 접근 보호 없음.

- 갱신(2026-10-23): Cloudflare 대시보드가 Git 연결을 Workers Builds로 안내해 Pages 대신 Workers 정적 자산으로 배포(`apps/{web,admin,site}/wrangler.jsonc`). 무료, 정적 파일 요청은 요금·횟수 제한 없음. 브랜치 미리보기(`wrangler versions upload`)와 Access 보호도 같음. 아래 ‘Pages’는 이 방식으로 읽음.

## 결과

- 좋은 점: 로컬 실행 없이 브라우저로 확인. 무료(빌드 월 500회, 동시 1개), 트래픽 제한 없음.
- 나쁜 점: 데스크톱 전용(트레이, PIN)과 모바일 전용(푸시, Face ID)은 브라우저 미리보기로 확인 못 함. 빌드 동시 1개라 PR이 몰리면 기다림(빌드 경로 거르기로 줄임).
- 사람이 할 것: Cloudflare 계정, Pages에 GitHub 연결(프로젝트 3개), Zero Trust 켜기, Supabase 스테이징 로그인 허용 주소, 스테이징 소셜 로그인 앱. 값은 DEV_GUIDE ‘개발 서버’.
