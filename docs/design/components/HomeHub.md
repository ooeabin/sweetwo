# HomeHub

2026-11-13 v2.2: 홈 주인공 H-10 같이 모으기(SaveTogether), H-11 이번 달 한 줄, H-12 결혼 준비, 띠 글자 버튼 둘 → 맨 아래 ‘v2.2’ 장. H-02 저금 상자·H-03 큰 상자는 없앰.

홈 허브(2026-11-09, GCOO 앱 홈처럼, 사용자 승인한 그림 기준). 회색 바탕(`surface-alt`, AppFrame `tone="alt"`) 위에 크기가 다른 흰 상자를 쌓아 각 화면으로 잇는 홈(19 H-02~H-09).

- 격자(`hg-hub`): 상자 사이 12px(`space-3`). 좁은 창·중간 창은 2열(`hg-hub__wide`·`hg-hub__full`은 두 칸), 넓은 창(1100px 이상)은 4열(`hg-hub__wide` = 두 칸, `hg-hub__full` = 한 줄, 할 일 띠는 맨 위로 `order`). 상자는 모두 흰색 `radius-xl`, 테두리·그림자 없음(마우스 올림만 `shadow-2`), 누름 98%, 키보드 포커스 ink 링 2px.
- 큰 상자(`hg-hubhero`, HubHero, 두 칸): 안쪽 20px. 위 줄 작은 캡션(13px 500 `slate`, “10월 25일 월급날까지”) + 제목(`title-2` 20px 700) + 오른쪽 겹친 Avatar(`hg-avatars`, 36px). 진행 줄: 굵은 둥근 막대(`hg-hubhero__track`, 10px, 바탕 `surface-alt`, 채움 `accent-app`) + 막대 아래 13px `slate` 이름 + 오른쪽 큰 숫자(`hg-hubhero__count`, `number-lg` 24px 700, “/ 5”는 15px 500 `slate`). 맨 아래 상자 끝까지 닿는 두 칸(`hg-hubhero__split`, 위·사이 `hairline-soft` 선, 14px 500 `slate` 이름 + 700 `ink` 값). 상자 전체가 버튼, 화면 읽기는 문장 하나(`label`).
- 할 일·초대 띠(`hg-hubband`, HubBand, 한 줄, 큰 상자 바로 아래): `radius-lg`, 높이 52px 이상, 코코아 채움(`band-cocoa`, 라이트 #3b2a22, 다크 #4a352b) + 글자 `on-band-cocoa`(라이트 12.5:1, 다크 10.1:1). 2026-11-11 사용자 결정(2026-11-09~11-10은 오렌지 채움). 왼쪽 문장 15px 600(두 줄까지, 넘치면 …, 2026-11-11 QA 4구간 D2) + 오른쪽 이동 글자 15px 500 + 꺾쇠(“체크하기 ›”, “확인하기 ›”, 초대는 “초대하기 ›”). 닫기 ✕ 없음(2026-11-11 사용자 결정: 이동 글자만, 할 일은 끝내거나 기간이 지나면 사라지고 초대는 다른 할 일이 없을 때만 맨 끝 순서로 나옴). 띠 전체가 이동 버튼. 마우스 올림은 코코아를 `on-band-cocoa` 쪽으로 10% 밝게. 초대 띠(“함께할 사람을 초대해 주세요”, → S-12)도 같은 띠(앞 점선 + 원은 없앰), 할 일은 한 번에 하나라 둘이 같이 나오지 않음. 공지·해제 대기·메일 반송 띠는 Banner·LineBand 그대로(본문 맨 위, 하나만, Banner ‘맨 위 띠 하나’).
- 타일(`hg-hubtile`, HubTile, 한 칸): 안쪽 18px. 제목 `title-3` 17px 700(2026-11-10 목업처럼 700, 2026-11-11 문서를 구현에 맞춤) + 회색 보조 13px 500 `slate`. 큰 타일은 높이 164px 이상 + 오른쪽 아래 72px 그림 자리(`hg-artslot`, `radius-xl`, 2D 그림이 들어올 때까지 회색 빈 자리, Illustrations ‘나중 과제’ 9번). 작은 타일(`--sm`)은 104px 이상 + 값(17px 700, 숫자 너비 같게). 값이 없을 때(자산·부채가 없거나 저금이 없음)는 값 대신 회색 보조 줄 “아직 없어요”(2026-11-11 QA 4구간 D5).
- 타일 배지(`hg-hubtile__badge`, HubTile `badge`, 2026-11-11): 보조 줄 바로 오른쪽(`hg-hubtile__subrow`, 간격 `space-2`, 보조 줄이 없으면 제목 아래 그 자리에 알약만) 작은 알약, 바탕 `plate`, 글자 `ink-2` 12px 600, 높이 18px, 숫자 너비 같게. 홈 자산 관리 타일의 “상위 38%”만(순위를 본 적이 있을 때). 화면 읽기는 타일 `label`에 함께.
- 포인트 상자(`hg-hubtile--point`, HubTile `point`, 2026-11-11 사용자 결정): 홈 ‘월급 계획’ 타일 하나만 브랜드 오렌지 채움(`accent-app`). 제목 `on-accent-app-text`(라이트 `ink` 6.5:1, 다크 어두운 `on-brand` 7.6:1, 흰 글자 금지), 보조 줄 `on-accent-app-sub`(라이트 4.7:1, 다크 5.3:1), 72px 그림 자리는 반투명 밝은 네모(`accent-app-slot`, 선 없음). 마우스 올림·누름 `brand-pressed`. ‘캘린더’와 다른 상자는 흰색.
- 저금 상자(`hg-hubsave`, HubSaving, 두 칸): 안쪽 20px. 왼쪽 56px 그림 자리(`hg-artslot`, `radius-lg`) + 이름(17px 700, 넘치면 …)과 오른쪽 %. 파트너 저금이면 이름 바로 옆 작은 알약(`hg-hubsave__name` 안 `hg-hubtile__badge`, 타일 배지와 같은 모양, 파트너 이름, HubSaving `badge`, 2026-11-11 D4), 이름이 넘치면 이름만 줄고 알약은 그대로 + 회색 “6,000만 / 1억 5,000만 원” + 얇은 막대(8px, 바탕 `surface-alt`, 채움 오렌지 `accent-app`, 2026-11-12 사용자 결정으로 ink-2에서 바꿈. 저금 진행 막대 규칙과 같음, 내 것·파트너 것 같음).
- 다크: 토큰 그대로(회색 바탕 `surface-alt` 다크 #232325, 상자 `surface`).
- React 래퍼(packages/ui `HomeHub.tsx`): `Hub`(`label`), `HubBand`(`text`, `go`, `onClick`, 2026-11-13 `secondary`. 2026-11-11 `close` 없앰), `HubLine`(2026-11-13), `HubTile`(`title`, `sub`, 2026-11-13 `sub2`, `value`, `art`, `small`, `point`, `badge`, `label`, `onClick`, 2026-11-13 `className`). 2026-11-13 `HubHero`·`HubSaving`과 `hg-hubhero`·`hg-hubsave` 클래스는 지움(PR 9).

- 좁은 화면 글자(2026-11-11): 허브 안 글자는 말 단위로 줄바꿈(`word-break: keep-all`, 아주 긴 말만 `overflow-wrap: anywhere`). 타일 값(`hg-hubtile__value`)은 타일 너비에 맞춰 17px에서 14px까지 줄어듦(`container-type: inline-size`, `clamp(14px, 13cqi, 17px)`), 320px 휴대폰 반 칸에서도 “2억 1,000만 원”이 한 줄. 그보다 큰 값(“987억 6,543만 2,100원”처럼 입력 상한에 가까운 값)은 말 단위로 두 줄까지 허용(2026-11-11 QA 4구간 S4-18, 글자를 더 줄이거나 자르지 않음).

## v2.2 (2026-11-13, ADR 0009)

홈 구성이 바뀜(→ 19 ‘홈 v2.2’). 이 장이 2026-11-13부터 정본이고, 위 큰 상자(`hg-hubhero`, H-03)와 저금 상자(`hg-hubsave`, H-02)는 홈에서 없앰(클래스와 React 래퍼는 PR 9에서 지움). 아래 새 클래스는 PR 9(홈)에서 `bundle.css`에 더하고 `pnpm ds:sync`로 복사함.

- 같이 모으기(H-10, SaveTogether 컴포넌트 `hg-together`, 두 칸, 두 줄 높이): 생김새 → [SaveTogether](SaveTogether.md). 허브 안에서는 `hg-hub__wide` 자리, 넓은 창 4열에서는 두 칸 × 두 줄
- 이번 달 한 줄(H-11, `hg-hubline`, HubLine, 두 칸, 한 줄): 흰 얇은 상자(`radius-xl`, 안쪽 세로 14px 가로 18px), 왼쪽 문장 15px 600 `ink`(두 줄까지) + 그 아래 회색 보조 13px 500 `slate`(있을 때) + 오른쪽 이동 글자 13px 600 `ink-2`(“확인하기 ›”, “보기 ›”, “돈 들어왔어요 ›”). 오렌지 없음. 상자 전체가 버튼, 키보드 포커스 ink 링. 날짜 없는 사람의 막대 상태(H-13)는 문장 자리에 [PeriodBar](PeriodBar.md). 못 불러오면 13 공통 7번 카드
- 결혼 준비 타일(H-12, `hg-hubtile` 그대로, 두 칸 `hg-hub__wide`, HubTile `className`): 제목 “결혼 준비 메모 4개” + 회색 보조 “다음 잔금 12월 3일”. 그림 자리 72px 그대로
- 할 일 띠 글자 버튼 둘(`hg-hubband--two`, HubBand `secondary`): 띠 8번 “같이 쓰는 생활비를 나눠 볼까요?”에서만. 오른쪽에 글자 버튼 두 개(`hg-hubband__btns` > `hg-hubband__btn`): 둘째 버튼 “이미 정했어요”(`hg-hubband__btn--quiet` 13px 500, 같은 `on-band-cocoa` 글자, 새 토큰 없음, 밑줄 없음) + 첫째 이동 글자 “나누기 ›”(15px 500). 띠 전체가 버튼이 아니라 두 버튼이 따로(각각 44px 이상 누름 자리, 묶음 `role=group` 이름 = 띠 문장). 좁은 창에서 문장 칸이 160px보다 좁아지면 버튼 줄이 문장 아래로 내려감(flex-wrap)
- 타일 배지 “상위 38%”(H-04): 두 사람 모두 순위 동의 + “홈에 보여 주기”를 켰을 때만(2026-11-13 기본 끔)
- H-07 월급 계획 포인트 상자 보조 줄 두 줄: “매달 25일” + “여유 자금 20만 원”(같은 `on-accent-app-sub`)
- 넓은 창(1100px 이상 4열): 할 일 띠 한 줄 → H-10(두 칸, 두 줄) + 오른쪽 H-11과 H-07 → H-08, H-12(있으면), H-04, H-09
- React 래퍼(packages/ui `HomeHub.tsx`)에 더함: `HubLine`(`text`, `sub`, `go`, `bar`(PeriodBar 요소), `label`, `onClick`), `HubBand`에 `secondary`(`{ text, onClick }`), `HubTile`에 `sub2`(H-07 여유 자금 둘째 줄)·`className`. `SaveTogether`·`PeriodBar`는 따로 파일
- 좁은 창 순서(DOM): H-10 → H-11 → 할 일 띠 → H-07·H-08 → H-12 → H-04·H-09. 넓은 창은 띠 `order: -1`, `hg-together` 두 칸 두 줄(`grid-row: span 2`), `hg-hubline` 두 칸이라 격자 자동 배치가 ‘H-10 + 오른쪽 H-11, H-07·H-08’이 됨
