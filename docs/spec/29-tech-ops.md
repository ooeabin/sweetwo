# 기술·운영

클라이언트는 Electron + React 데스크톱 앱과 같은 React 코드를 Capacitor로 감싼 모바일 앱(iOS·Android, ADR 0001), 서버는 Supabase(Postgres + Auth + Realtime) 서울 리전 하나로 계정·DB·실시간 동기화를 처리함. 개인정보를 다루는 서버·도구는 모두 서울 리전, 국외 이전 없음. 보안 기준은 → 보안·개인정보, 충돌·오프라인 규칙은 → 동기화.

## 1. 스택

| 영역 | 선택 | 용도 |
| --- | --- | --- |
| 클라이언트 | React + TypeScript 화면 하나를 데스크톱은 Electron, 모바일은 Capacitor로 감쌈 | 화면·계산 패키지 공용 |
| 빌드 | electron-vite, Vite + Capacitor | 데스크톱 앱 개발 서버와 빌드. 모바일은 Vite로 만든 화면 묶음을 Capacitor가 iOS·Android 앱에 넣음(Xcode, Android Studio·Gradle) |
| 상태·데이터 | TanStack Query + Zustand | 서버 데이터 캐시·다시 불러오기는 TanStack Query, 화면 상태는 Zustand |
| 화면 이동 | React Router | 메뉴·화면 이동. 앱 안 경로(데스크톱 해시 주소, 모바일은 앱 링크로 같은 경로를 엶) |
| 입력·검증 | React Hook Form + Zod | 질문 화면 입력과 값 검증 |
| 저장소 구조 | pnpm + Turborepo | 데스크톱 앱, 모바일 앱, 공용 패키지를 한 저장소에서 관리·빌드 |
| 테스트 | Vitest, Playwright, pgTAP | 계산 함수 단위 테스트, 화면 흐름 E2E, DB 함수·RLS 테스트 |
| CI/CD | GitHub Actions | 테스트·빌드·배포 자동 실행 |
| 서버(DB·인증·실시간) | Supabase: Postgres + Auth + Realtime + Edge Functions, 서울 리전(ap-northeast-2) | 부부 공간·항목·제안·이력 저장. 행 단위 보안(RLS)으로 공개 범위 필터를 서버에서 적용, Realtime으로 상대 변경 1\~2초 수신. DB 전체 암호화(저장·백업), 금액 합계·배분은 DB 함수가 계산 |
| 서버 작업 | Postgres 함수(버전 판정·충돌 규칙) + pg\_cron + Edge Functions | 기준일 0시 플랜 생성·제안 적용·알림 예약(→ 동기화 5장), 비교 통계 월 1회 계산(출시 후), 공휴일 받기(매년 12월 다음 해, 매주 1회 다시) |
| 로그인 | Supabase Auth. 카카오·구글·애플 모두 기본 제공 공급자 사용 | 기준 → 보안·개인정보 2장 ‘로그인’ |
| 필드 암호화 | Edge Functions에서 AES-256-GCM, 키 = AWS KMS 서울. 메모·가족 정보만 | 범위 → 보안·개인정보 2장 |
| 사진 | Supabase Storage 서울. 서버 저장·저장 시 암호화, 부부 공간 권한(두 사람만 열람) | 챙길 날 기록, 프로필 사진(→ 설정 S-11e) |
| 메일 발송 | Amazon SES 서울 리전 | 알림·주간 요약·초대 메일 |
| 고객 메일 수신 | 네이버웍스 | help@sweetwo.kr(고객센터, S-19a 문의 포함), privacy@sweetwo.kr(개인정보 보호책임자) 수신, 같은 주소로 답장. 구성원 1명(관리자), help@와 privacy@는 그룹 메일 주소로 받음. SPF는 TXT 한 줄에 네이버웍스와 Amazon SES를 함께 넣음(SPF 레코드는 하나만). DKIM은 네이버웍스와 SES 각각, DMARC는 p=none으로 시작 |
| 웹사이트 | Astro 정적 사이트(확정) | apps/site, S3 + CloudFront 서울(→ 화면 설계 › 웹사이트) |
| 음력 변환 | korean-lunar-calendar(npm, MIT, 한국천문연구원 기준표) | core 패키지에서 클라이언트와 서버가 같은 계산. 양력 2050년 12월 31일까지, 그 뒤는 지원 범위 밖. 천문연구원 자료와 대조 테스트 |
| 공휴일 | 공공데이터포털 ‘한국천문연구원 특일 정보’ API | 서버가 매년 12월에 다음 해를 받고 매주 1회 다시 받아 임시공휴일 반영, holiday 테이블에 저장. 앱은 테이블만 읽음. 어드민 AD-19에서 직접 추가·수정 |
| 결제 | 결제대행사 미정(→ 사업 계획 9장 ‘결정 필요’) | 프리미엄 구독 결제·갱신·해지. 카드 정보는 결제대행사에만 저장 |
| 분석 | PostHog 자체 운영(서울 리전 서버) | 퍼널·코호트(→ 성공 지표). 금액 원값 없음 |
| 에러 수집 | Sentry 자체 운영(서울 리전 서버), Electron·React·Capacitor SDK | 크래시·오류 코드. 금액·메모 제거 후 전송 |
| 모니터링·상태 페이지 | Better Stack | 외부 가동 확인 1분 간격 + 상태 페이지(status.sweetwo.kr). 개인정보 없음 |
| 웹사이트·업데이트 파일 | S3 서울 + CloudFront | 웹사이트 정적 파일, 데스크톱 설치 파일, 자동 업데이트(electron-updater). 개인정보 없음 |
| 모바일 푸시 | APNs(iOS), FCM(Android). 보내는 쪽은 Edge Functions | 알림 제목과 앞부분만(서프라이즈는 본문 숨김 → 알림), 금액 원값은 넣지 않음 [확인 필요]. 기기 토큰은 서버에 기기별 저장 |

폴더 구조, 코드 규칙, 테스트·배포 절차 → 개발 가이드(별도 문서)

- 코드 관리: 모노레포(데스크톱·모바일·공용 패키지·DB 마이그레이션·Edge Functions, 웹사이트는 apps/site Astro 정적 사이트)

**주소 구조**

| 주소 | 용도 |
| --- | --- |
| sweetwo.kr | 웹사이트(→ 화면 설계 › 웹사이트 L-01\~L-03, L-05, L-06). Astro 정적 사이트, S3 + CloudFront(서울) |
| sweetwo.kr/i/{코드} | 초대 링크. 앱이 있으면 앱이 바로 엶(유니버설 링크·앱 링크, 데스크톱은 sweetwo://), 없으면 웹사이트 초대 페이지(코드 + 스토어·다운로드) → 화면 설계 › 웹사이트 |
| sweetwo.kr/.well-known/apple-app-site-association, /.well-known/assetlinks.json | iOS 유니버설 링크·Android 앱 링크 확인 파일(/i/*, 로그인 복귀, 알림 메일 링크 경로만) |
| download.sweetwo.kr/latest/mac, /latest/win | 다운로드 고정 주소. CloudFront가 최신 정식 파일로 보냄(Mac universal dmg 1개, Windows x64) |
| status.sweetwo.kr | 상태 페이지(Better Stack) |
| 어드민 | 별도 도메인(→ 어드민) |
| sweetwo:// | 데스크톱 앱 딥링크(초대 코드 전달, 로그인 복귀, 위젯 화면 이동) |
| sweetwo.co.kr, 스위투.kr | 선택: 나중에 등록하면 sweetwo.kr로 연결(사칭 방지) |

## 2. 데이터 모델

→ 핵심 규칙 › 데이터 항목의 엔티티를 테이블로 옮긴 것. 필드 뜻·값 범위는 그 탭 기준.

- 공통 필드: id uuid, space\_id uuid(FK), created\_by·updated\_by uuid, created\_at·updated\_at timestamptz, version int(충돌 판정), deleted\_at timestamptz·deleted\_by uuid(휴지통, 30일 뒤 자동 영구 삭제)
- 타입: 금액 bigint(원, 평문 컬럼. DB 전체 암호화 + RLS로 보호, 합계·배분은 DB가 계산), 날짜 date(한국 시간), 선택지 enum, 필드 암호화 값 bytea(메모·가족 정보만, 아래 표에서 ‘암호’), 명의 = owner\_user\_id(null이면 공동)
- 공개 범위: RLS + 배우자용 뷰(합계만 = 합계 한 줄, 비공개 = 제외)

| 테이블 | 핵심 필드·타입 | 관계 |
| --- | --- | --- |
| couple\_space 부부 공간 | stage enum, wedding\_date date, wedding\_estimated bool, cycle\_day smallint, split\_mode enum, split\_ratio numeric(5,2), emergency\_months smallint(null이면 고용 형태로 자동 3/6), surplus\_goal\_id uuid(남는 돈 넣을 목표, null이면 주거 목표), holiday\_shift bool(주말·공휴일 앞당겨 표시, 기본 true), living\_check bool, account\_mode enum(하나로/역할별, O-63), couple\_state enum(미합류/연결/해제 대기/혼자 쓰기), subscription\_state enum, housing enum(전세/반전세·월세/자가/부모님 집/아직 안 구함, O-15), child\_plan enum(1년 안/1\~3년/3년 뒤/없음/모름, O-18) | 1 : user 1\~2, 모든 테이블의 부모 |
| app\_user 사용자 | auth\_provider enum, provider\_uid text, notify\_email text, nickname text, avatar\_path text(프로필 사진 Storage 경로, 없으면 null), side enum(신랑/신부), birth\_year smallint, employment enum, net\_income bigint, variable\_income bool, base\_income bigint, payday smallint, allowance bigint, credit\_card\_main bool(O-38b), invest\_profile enum, notify\_settings jsonb, analytics\_off bool(분석 수집 끔), peer\_stats\_on bool(통계 참여, 기본 false), account\_state enum(사용 중/삭제 요청/삭제), delete\_requested\_at timestamptz(30일 유예), email\_bounced\_at timestamptz(알림 메일 반송), is\_internal\_tester bool(내부 테스트 계정 표시, 기본 false, 공개 출시 직전 삭제 대상 고르기), onboarding\_stop\_screen text(멈춘 화면 ID), onboarding\_done\_at | N : 1 부부 공간 |
| income\_period 수입 기간 변경 | user\_id, start\_month date, end\_month date, amount bigint | N : 1 사용자 |
| invite 초대 코드 | code text(unique), inviter\_id, expires\_at(7일), used\_at(P-11 합류 완료), reminded\_at timestamptz\[\](만료 3일 전·1일 전). 잘못된 코드 5회면 사용자·IP 기준 10분 제한 | N : 1 부부 공간 |
| asset 자산 | kind enum, name text, amount bigint, owner\_user\_id, visibility enum, maturity\_date, monthly\_payment bigint, principal bigint, status enum(보유/매도 완료), realized\_pl bigint, estimated bool, entered\_by uuid(대신 입력) | 1 : 0\~1 통장, 1 : N 금액 이력 |
| account 통장 | asset\_id(FK, unique), name, role enum(공동 생활비/목표자금/비상금/개인/결혼 준비, null이면 통장 하나 모드), start\_balance bigint(null이면 O-63 건너뜀, 기준선 없음) | 1 : 1 자산 |
| debt 부채 | kind enum, name, balance bigint, rate numeric(5,3), monthly\_payment bigint, maturity\_date, owner\_user\_id, entered\_by uuid, visibility enum | 1 : N 금액 이력, 1 : 0\~1 고정지출 |
| fixed\_expense 고정지출 | name, monthly\_amount bigint, source enum, debt\_id(null) | N : 0\~1 부채 |
| annual\_event 연간 이벤트 | name, amount bigint, month smallint, repeat bool | N : 1 부부 공간 |
| goal 목표 | category enum, template\_id, name, shape enum(한 번/매년/매달), target\_amount bigint, due date, priority smallint, owner enum, vehicle\_asset\_id(null), status enum, round smallint, carryover bigint, other\_holding bigint, post\_wedding bool(플래그), photo\_path text(직접 만든 목표의 사진 Storage 경로, null이면 회색 기본 그림 goal-custom, 기본 목표 21종은 항상 null) | 1 : N 목표 사용, 1 : N 결혼 비용 항목, N : 0\~1 자산 |
| wedding\_cost\_item 결혼 비용 항목 | goal\_id, item text, budget bigint, deposit\_amount·deposit\_date, balance\_amount·balance\_date, payer\_user\_id, pay\_state enum, actual\_amount bigint, paid\_from enum | N : 1 목표, 1 : N 챙길 날(자동) |
| monthly\_plan 월 플랜 | year\_month date, cycle\_start·cycle\_end date, state enum, is\_partial bool, first\_adjust bigint, merged\_close bool, is\_temp bool, snapshot jsonb | 1 : N 플랜 줄, N : 0\~1 월말 정리 |
| plan\_line 플랜 줄 | plan\_id, target\_type enum(통장/목표), target\_id, line\_kind enum, planned bigint, shares jsonb(사용자별), assignee enum, added\_cycle date, due\_date, transfer\_state enum, actual bigint | N : 1 월 플랜 |
| month\_close 월말 정리 | fixed\_total bigint, variable\_total bigint, big\_total bigint, deposit\_total bigint(W-04k 납입 합계 = 저축), income\_total bigint, spent\_ratio numeric(4,1), balances jsonb(통장별, 선택), actual\_income bigint, emergency\_used jsonb, invest\_value bigint, balance\_saving bigint(꼼꼼 모드 잔액 변화로 본 저축, 기본 모드는 null), overflow\_handling jsonb, status enum(초안/완료, 미리 적은 값은 초안으로 저장), step text(진행 중 단계 화면 ID), mode enum(기본/꼼꼼), party enum(함께/혼자), locked\_by uuid(null, 진행 중인 사람), late bool, closer\_user\_id, closed\_at, skipped bool | 1 : 1\~2 월 플랜, 1 : N 목표 사용 |
| spend\_category 변동 지출 항목 | catalog\_key(null이면 직접 추가), name, enabled bool, sort smallint, budget bigint(null, 선택) | 부부 공간 N |
| month\_spend 변동 항목별 합계 | month\_close\_id, category\_id, amount bigint | 월말 정리 1 : N |
| big\_expense 큰 지출 | month\_close\_id, kind text(기본 칩 또는 직접), amount bigint, handling enum(연간 목표에서/이번 달 예외), goal\_id(null) | 월말 정리 1 : N, 목표 0\~1 |
| saving\_deposit 이번 달 넣은 돈 | month\_close\_id, asset\_id(null이면 통장 하나 모드·기타 저축), goal\_id(null, 연결 자산이 목표에 묶이면 그 목표), amount bigint, source enum(월 납입액 그대로/수정) | 월말 정리 1 : N, 자산 0\~1, 목표 0\~1 |
| item\_catalog 항목 이름 목록 | kind enum(고정/변동/큰 지출/저축·투자), group text, key, name, sort, hidden bool. 어드민 AD-19에서 수정, 앱 배포 없이 반영 | 전체 공통(부부 공간 없음) |
| goal\_use 목표 사용 | goal\_id, amount bigint, used\_on date, paid\_from enum, account\_id, overflow bigint, linked\_line\_id(null), source enum | N : 1 목표, N : 0\~1 월말 정리, 0\~1 플랜 줄 |
| family 가족 | side enum, relation enum, nickname 암호, birthday\_md 암호, lunar bool, leap bool, birth\_year 암호, age\_rule enum(세는 나이/만 나이, 환갑·칠순 계산), memo 암호 | 1 : N 챙길 날 |
| care\_day 챙길 날 | kind enum(우리 둘/양가/결혼 준비), family\_id(null), wedding\_item\_id(null), date\_rule enum, budget bigint, owner enum, notify\_rule jsonb(기본 D-30·D-7), private bool | 1 : N 회차 |
| care\_round 챙길 날 회차 | care\_day\_id, year smallint, solar\_date date, prep\_state enum, actual bigint, paid\_from enum, gift text, memo 암호 | N : 1 챙길 날, 1 : 0\~1 목표 사용 |
| family\_budget 양가 예산 | holiday·birthday·parents\_day·etc 단가 bigint, round\_year smallint, goal\_id(null) | 1 : 1 부부 공간, 0\~1 목표 |
| holiday 공휴일 | date date(unique), name text, kind enum(공휴일/대체공휴일/임시공휴일), source enum(특일 API/어드민), fetched\_at timestamptz | 관계 없음. 앱은 읽기만, 쓰기는 서버 작업과 어드민 |
| proposal 제안 | kind enum, requester\_id, target\_key text, bundle\_id(null), before·after jsonb, source enum, response enum, state enum, oppose\_count·round\_count smallint, decide\_together bool, apply\_on date, original\_id·replaced\_id(null) | 대상당 열린 제안 0\~1(target\_key 부분 unique) |
| checklist\_done 체크리스트 완료 | item\_id(운영자 본문), done\_by, done\_at | N : 1 부부 공간 |
| notification 알림 | user\_id(받는 사람), kind enum, capped bool, digest bool, scheduled\_at, channels enum\[\](os/email/inapp), sent\_at, read\_at, target\_screen text, target\_id uuid, text\_snapshot text, expires\_at(생성 + 90일) | N : 1 사용자 |
| change\_log 변경 이력 | seq bigint(space마다 1씩 늘어나는 변경 번호, 델타 동기화 기준), mutation\_id uuid(unique, 같은 요청은 한 번만 반영), table\_name, row\_id, field, before·after jsonb(메모·가족 정보 필드는 암호 값 그대로), actor\_id, server\_at, device\_at, device enum, source enum | 13개월 보관 |
| amount\_history 금액 이력 | row\_id, amount bigint, at timestamptz, source enum | 계정 유지 동안 |
| device\_session 로그인 기기 | user\_id, device\_name, os, last\_seen, refresh\_token\_hash | N : 1 사용자 |
| widget\_setting 위젯 설정 | 기기별: device\_session\_id, tray\_enabled bool, show\_amounts bool(기본 false). 계정별: user\_id, wg02\_goal\_id uuid(null 가능) | 기기별 1 : 1 로그인 기기, 계정별 1 : 1 사용자 |
| todo 할 일(H-04) | user\_id(null이면 둘 다), source\_screen text(출처 화면 ID), target\_id uuid, state enum(대기/미룸/완료), sort\_order int, snoozed\_until date(‘내일 할게요’), done\_by, done\_at | N : 1 부부 공간 |
| photo 사진 | care\_round\_id, storage\_path text, uploader\_id, mime enum(JPG/PNG/HEIC/WebP), size\_bytes int(줄인 뒤), taken\_on date. 원본 10MB 이하, 긴 변 1600px로 줄여 저장, 회차당 10장 | N : 1 챙길 날 회차. 파일은 Storage(서버 저장·암호화), 부부 공간 권한 |
| subscription 구독 | plan enum(월/연), state enum(무료/프리미엄/해지 예정/만료), payer\_user\_id, started\_at, next\_billing\_on date, canceled\_at | 1 : 1 부부 공간, 1 : N 결제 |
| payment 결제 | subscription\_id, payer\_user\_id, amount bigint, paid\_at, result enum, pg\_tx\_id text | N : 1 구독 |
| consent 동의 기록 | user\_id, kind enum(이용약관/개인정보 처리/배우자와 부부 공간 공유/가족 정보/사진(챙길 날)/마케팅 수신/분석 수집/통계 참여, 8종), terms\_version text, agreed bool, at timestamptz, via enum(가입/P-02b/설정/F-08) | N : 1 사용자 |
| unlink\_request 연결 해제 | requester\_id, requested\_at, split\_plan jsonb, response enum, agree\_by timestamptz(요청 + 14일), state enum(대기/취소/확정), confirmed\_at, restore\_until timestamptz(확정 + 30일), snapshot\_id uuid, rejoin\_requester\_id, rejoin\_requested\_at, rejoin\_state enum(요청/수락/거절/만료), rejoin\_responded\_at | N : 1 부부 공간 |
| inquiry 문의 | inquiry\_no text(unique, 서버 발급 문의 번호), user\_id, kind enum, body text, attachment\_ids uuid\[\], auto\_info jsonb(앱 버전·OS 등), state enum(접수/처리 중/사용자 답변 대기/완료), answer text, answered\_by(admin\_user), answered\_at, mail\_copied\_at(help@ 사본 메일). AD-01 미처리 문의 수는 이 테이블에서 집계 | N : 1 사용자 |
| admin\_view\_request 관리자 열람 요청 | inquiry\_id, admin\_id, reason text, scope jsonb, consent\_at timestamptz(문의한 본인 동의), spouse\_notified\_at timestamptz(배우자 열람 알림), expires\_at, view\_log jsonb, state enum(요청/동의/거절/만료/완료) | N : 1 문의 (S-19b·AD-04) |
| peer\_stat 비교 통계 (출시 후) | stat\_month date, source enum(공공 통계/앱), group\_level enum(필터/연령대×단계/연령대/전체), age\_band enum, stage enum, housing enum(null), dual\_income bool(null), income\_band enum(null), metric enum(순자산/저축률/저축액/비상금 개월/부채 비율), couple\_count int, p10\~p90 numeric(10% 단위), median numeric | 관계 없음. 개별 부부 값·ID 없음, pg\_cron 월 1회 갱신(→ 핵심 규칙 › 계산·배분 12장) |
| checklist\_item 체크리스트 항목 | item\_key text, stage enum(예비/신혼 첫해/2\~3년차/이후), version text, checked\_on date(출처 확인일), sort\_order int, active bool. 제목·본문·출처는 저장소 마크다운(코드 배포) | 1 : N checklist\_done. 버전·확인일은 어드민 AD-14 |
| conversation\_card\_log 대화 카드 기록 | month\_close\_id, card\_key text(질문 본문은 코드 배포로 관리), shown\_at, answered\_by(null), answer text(선택) | N : 1 월말 정리 |
| notice 공지 | title text, body text, audience jsonb(대상 조건), starts\_at, ends\_at, must\_read bool(필독), kind enum(공지/장애 고지/광고), created\_by | 관계 없음(AD-10·11) |
| maintenance 점검 | starts\_at, ends\_at, message text, state enum(예정/진행/끝), notice\_id(null) | 0\~1 공지(AD-16) |
| app\_config 앱 설정 | min\_version\_desktop text, min\_version\_web text, flags jsonb(기능 플래그: 이름·켜짐·대상), updated\_by, updated\_at | 한 줄. 앱이 시작할 때 읽음(A-01) |
| job\_run 예약 작업 실행 | job text(함수 이름), started\_at, ended\_at, space\_count int, failures jsonb(실패한 space와 오류 코드) | 관계 없음. 실패 1건이면 개발 채널 경보 |
| admin\_setting 계산·기준 데이터 | key text(대출 유형별 평균 금리, 공공 통계 연도·연령대·지표 등), value jsonb, valid\_from date, updated\_by, updated\_at | 관계 없음(AD-19) |
| admin\_user 관리자 | email text, role enum, mfa\_on bool, last\_login\_at, active bool | 1 : N audit\_log |
| audit\_log 감사 기록 | admin\_id, action text, target\_table text, target\_id uuid, before·after jsonb, at timestamptz, ip inet | N : 1 관리자. 수정·삭제 불가 |
| guide\_content 가이드 콘텐츠 | 테이블 없음. 연말정산 가이드·대화 카드 질문·FAQ·릴리스 노트·연간 고정 지출 그림은 저장소에 두고 코드 배포로 관리 | — |

## 3. 비기능 요구

| 항목 | 기준 | 측정 |
| --- | --- | --- |
| 앱 시작 | 아이콘 누름 → 이번 달 표시 2초 안(잠금 해제 제외) | 앱 시작 이벤트 p90 |
| 화면 전환 | 0.3초 안 | 화면 전환 p90 |
| 동기화 반영 | 상대 저장 → 내 화면 3초 안(온라인) | 서버 도착\~상대 수신 p95 |
| 가용성 | 월 99.5%(월 약 3.6시간 이하 중단, 계획 점검 제외) | 외부 가동 확인 1분 간격 |
| 백업 | → 보안·개인정보 2장 ‘백업’ | 백업 성공 경보 |
| RPO / RTO | 24시간 / 4시간 | 복구 훈련 결과 |

## 4. 모니터링·장애 대응

- 대상: API·Realtime 응답·오류율, 기준일 0시 작업 성공, 메일 발송 실패, 앱 크래시율, 백업
- 경보: API 오류율 2% 5분 지속, p95 응답 1초 초과 10분, 0시 작업 실패 1회, 크래시 없는 세션 99% 미만 → 당번 전화·메신저

| 등급 | 예 | 대응 시작 | 상태 공지 |
| --- | --- | --- | --- |
| 1 | 로그인·동기화 전체 불가, 데이터 손상, 공개 범위 노출 | 15분 안 | 15분 안 상태 페이지 + 앱 공지 띠 |
| 2 | 일부 기능 오류, 메일 지연 | 1시간 안 | 상태 페이지 |
| 3 | 화면 오류, 우회 가능 | 다음 영업일 | 없음 |

1. 감지(경보·문의) → 등급 판정·담당 지정
2. 상태 공지(위 표), 앱 안 문구는 → 화면 설계 › 공통 상태
3. 복구: 배포 되돌리기 → 설정 변경 → 백업 복구 순서. 서버 작업 재실행·백업 복원은 어드민이 아닌 콘솔 런북(개발 가이드)으로
4. 복구 공지 + 1등급은 영향 부부에 메일(서비스 메일, 메일 상한 밖)
5. 사후 보고서 5영업일 안(원인·영향·재발 방지)

- 계획 점검: 화\~목 새벽 2\~5시, 3일 전 공지. 기준일 0시 전후 점검 금지

## 5. 배포

| 항목 | 기준 |
| --- | --- |
| 다운로드 채널 | 데스크톱: 공식 웹사이트(L-01, L-02) 직접 배포, 고정 주소 download.sweetwo.kr/latest/mac, /latest/win. Mac App Store·Microsoft Store는 출시 뒤 검토. 모바일: App Store, Google Play |
| 최소 OS | macOS 12 이상(Apple Silicon·Intel 유니버설 빌드), Windows 10 64비트 이상, iOS 16 이상, Android 8(API 26) 이상 [확인 필요] |
| 설치 파일 | macOS universal dmg 1개, Windows x64 설치 프로그램(NSIS). Windows ARM은 이후 |
| 코드 서명·공증 | macOS Developer ID 서명 + Apple 공증, Windows 코드 서명 인증서(SmartScreen 경고 줄이려 EV 검토). iOS·Android는 스토어 서명(Apple 개발자 계정, Google Play 앱 서명) |
| 스토어 심사 | 출시 2주 전 첫 제출(금융 범주 심사 지연 대비). 심사용 데모 계정은 흉내 데이터 공간으로 [확인 필요]. 개인정보 라벨(App Store), 데이터 보안 양식(Google Play) |
| 자동 업데이트 | 모바일은 스토어 업데이트(코드 바꿔 넣기 업데이트는 쓰지 않음). 데스크톱은 electron-updater. 백그라운드 다운로드 → 서명 검증 → 다음 실행 때 적용. 최소 지원 버전 미만은 업데이트 화면만(→ 동기화 6장) |
| 단계 배포 | 업데이트 채널은 하나. 첫 출시는 바로 전체 공개, 단계 배포는 업데이트부터: 10% → 50% → 100%(24시간 간격, 크래시 없는 세션 99% 이상일 때 다음 단계). 출시 승인 기준 99.5%(출시 준비 3장)보다 낮은 것은 의도된 차이: 승인은 출시 품질 기준, 단계 배포는 멈추는 선 |
| 롤백 | 데스크톱: 단계 배포 중지 + 이전 코드를 더 높은 버전 번호로 재배포(앱은 아래 버전으로 내리지 않음). 모바일: 스토어 단계 출시 중지(App Store 단계적 출시, Google Play 비율 출시) + 고친 버전 긴급 심사. 서버: DB 변경은 추가형이라 코드만 되돌림 |
| 버전 표기 | 주.부.수(예: 1.2.3), S-19에 표시 |
| 릴리스 노트 | 버전마다 웹사이트 L-03에 ‘새 기능’ ‘고친 것’ 게시. 이전 버전 다운로드는 두지 않음 |
| 웹사이트 지원 브라우저 | Chrome·Edge·Safari·Firefox 최신 2개 버전, iOS Safari 16 이상, Android Chrome·삼성 인터넷 최신 2개 버전 |

## 6. 위젯

화면·문구·금액 표시 규칙 → 화면 설계 › 위젯.

| 항목 | 기준 |
| --- | --- |
| 트레이 위젯 창 (출시) | Electron Tray + 작은 BrowserWindow(폭 340px, 테두리 없음, 포커스를 잃으면 숨김). 앱 창을 닫아도 프로세스는 트레이에 남음(S-22에서 끔) |
| 딥링크 | 위젯을 누르면 앱 딥링크(화면 ID + 대상 ID)로 해당 화면. 앱이 꺼져 있으면 실행 → 앱 잠금 해제 뒤 이동 |
| 갱신 | 앱에서 값이 바뀌거나 Realtime으로 상대 변경을 받으면 즉시, 그 밖에는 30분마다. 오프라인이면 마지막 값 + 저장 시각 |
| 위젯 캐시 | 위젯에 필요한 값만 모은 작은 스냅샷을 기기에 암호화 저장(키는 OS 키 저장소). 공개 범위를 거친 값만 담음. 로그아웃·세션 만료 시 삭제 |
| 위젯 설정 저장 | 트레이 아이콘 켜기·위젯에 금액 보이기는 기기별, WG-02 목표는 계정별(모든 기기 공통). 필드 → 2장 widget\_setting, 핵심 규칙 › 데이터 항목 ‘위젯 설정’ |
| 네이티브 위젯 (이후) | macOS·iOS: WidgetKit 확장 + App Group으로 앱과 캐시 공유. Android: Glance(AppWidget). Windows 11 위젯 보드: Adaptive Cards 기반 위젯 공급자. Electron 밖 네이티브 코드라 출시 범위 밖 |
