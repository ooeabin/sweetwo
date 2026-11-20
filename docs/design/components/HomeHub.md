# HomeHub

2026-11-13 v2.2: 홈 주인공 H-10 같이 모으기(SaveTogether), H-11 이번 달 한 줄, H-12 결혼 준비, 띠 글자 버튼 둘 → 맨 아래 ‘v2.2’ 장. H-02 저금 상자·H-03 큰 상자는 없앰.

홈 허브(2026-11-09, GCOO 앱 홈처럼, 사용자 승인한 그림 기준). 회색 바탕(`surface-alt`, AppFrame `tone="alt"`) 위에 크기가 다른 흰 상자를 쌓아 각 화면으로 잇는 홈(19 H-02~H-09).

- 격자(`hg-hub`): 상자 사이 12px(`space-3`). 좁은 창·중간 창은 2열(`hg-hub__wide`·`hg-hub__full`은 두 칸), 넓은 창(1100px 이상)은 4열(`hg-hub__wide` = 두 칸, `hg-hub__full` = 한 줄, 할 일 띠는 맨 위로 `order`). 상자는 모두 흰색 `radius-xl`, 테두리·그림자 없음(마우스 올림만 `shadow-2`), 누름 98%, 키보드 포커스 ink 링 2px.
- 큰 상자(`hg-hubhero`, HubHero, 두 칸): 안쪽 20px. 위 줄 작은 캡션(13px 500 `slate`, “10월 25일 월급날까지”) + 제목(`title-2` 20px 700) + 오른쪽 겹친 Avatar(`hg-avatars`, 36px). 진행 줄: 굵은 둥근 막대(`hg-hubhero__track`, 10px, 바탕 `surface-alt`, 채움 `accent-app`) + 막대 아래 13px `slate` 이름 + 오른쪽 큰 숫자(`hg-hubhero__count`, `number-lg` 24px 700, “/ 5”는 15px 500 `slate`). 맨 아래 상자 끝까지 닿는 두 칸(`hg-hubhero__split`, 위·사이 `hairline-soft` 선, 14px 500 `slate` 이름 + 700 `ink` 값). 상자 전체가 버튼, 화면 읽기는 문장 하나(`label`).
- 할 일·초대 띠(`hg-hubband`, HubBand, 한 줄, 큰 상자 바로 아래): `radius-lg`, 높이 52px 이상, 코코아 채움(`band-cocoa`, 라이트 #3b2a22, 다크 #4a352b) + 글자 `on-band-cocoa`(라이트 12.5:1, 다크 10.1:1). 2026-11-11 사용자 결정(2026-11-09~11-10은 오렌지 채움). 왼쪽 문장 15px 600(두 줄까지, 넘치면 …, 2026-11-11 QA 4구간 D2) + 오른쪽 이동 글자 15px 500 + 꺾쇠(“확인하기 ›”, 초대는 “초대하기 ›”). 닫기 ✕ 없음(2026-11-11 사용자 결정: 이동 글자만, 할 일은 끝내거나 기간이 지나면 사라지고 초대는 다른 할 일이 없을 때만 맨 끝 순서로 나옴). 띠 전체가 이동 버튼. 마우스 올림은 코코아를 `on-band-cocoa` 쪽으로 10% 밝게. 초대 띠(“함께할 사람을 초대해 주세요”, → S-12)도 같은 띠(앞 점선 + 원은 없앰), 할 일 띠는 두 칸까지(2026-11-13 UX B M5, 19 ‘띠 두 칸’, core `pickTopTasks`): 두 띠는 위아래로 이어서(사이 `space-3`, 격자 간격 그대로), 넓은 창에서도 둘 다 맨 위 한 줄씩. 2026-11-16 4차 검토(R4 6): 코코아 띠는 하나만. 할 일이 둘이면 한 띠 “할 일 2개” + 꺾쇠(이동 글자 없음) → BottomSheet 목록(제목 “할 일”, `hg-list--plain` 줄마다 띠 문장, 8번 줄 아래 `hg-btn--link hg-btn--quiet` “이미 정했어요”). 공지·해제 대기·메일 반송 띠는 Banner·LineBand 그대로(본문 맨 위, 하나만, Banner ‘맨 위 띠 하나’).
- 타일(`hg-hubtile`, HubTile, 한 칸): 안쪽 18px. 제목 `title-3` 17px 700(2026-11-10 목업처럼 700, 2026-11-11 문서를 구현에 맞춤) + 회색 보조 13px 500 `slate`. 큰 타일은 높이 164px 이상 + 오른쪽 아래 72px 그림 자리(`hg-artslot`, `radius-xl`, 2D 그림이 들어올 때까지 회색 빈 자리, Illustrations ‘나중 과제’ 9번). 작은 타일(`--sm`)은 104px 이상 + 값(17px 700, 숫자 너비 같게). 값이 없을 때(자산·부채가 없거나 저금이 없음)는 값 대신 회색 보조 줄 “아직 없어요”(2026-11-11 QA 4구간 D5). (2026-11-15 3차 검토 사용자 결정: 그림이 들어올 때까지 숨김, 자리도 비우지 않음). 2026-11-16 4차 검토: 그림 자리를 숨긴 동안 타일 높이는 내용에 맞춤(`min-height` 없음, 같은 줄 타일은 격자가 같은 높이로 늘림). 그림(`hg-artslot`)이 들어오면 큰 타일 164px 그대로
- 타일 배지(`hg-hubtile__badge`, HubTile `badge`, 2026-11-11): 보조 줄 바로 오른쪽(`hg-hubtile__subrow`, 간격 `space-2`, 보조 줄이 없으면 제목 아래 그 자리에 알약만) 작은 알약, 바탕 `plate`, 글자 `ink-2` 12px 600, 높이 18px, 숫자 너비 같게. 홈 자산 관리 타일의 “상위 38%”만(순위를 본 적이 있을 때). 화면 읽기는 타일 `label`에 함께.
- 포인트 상자(`hg-hubtile--point`, HubTile `point`, 2026-11-11 사용자 결정): 홈 ‘월급 계획’ 타일 하나만 브랜드 오렌지 채움(`accent-app`). 제목 `on-accent-app-text`(라이트 `ink` 6.5:1, 다크 어두운 `on-brand` 7.6:1, 흰 글자 금지), 보조 줄 `on-accent-app-sub`(라이트 4.7:1, 다크 5.3:1), 72px 그림 자리는 반투명 밝은 네모(`accent-app-slot`, 선 없음). 마우스 올림·누름 `brand-pressed`. ‘캘린더’와 다른 상자는 흰색.
- 저금 상자(`hg-hubsave`, HubSaving, 두 칸): 안쪽 20px. 왼쪽 56px 그림 자리(`hg-artslot`, `radius-lg`) + 이름(17px 700, 넘치면 …)과 오른쪽 %. 파트너 저금이면 이름 바로 옆 작은 알약(`hg-hubsave__name` 안 `hg-hubtile__badge`, 타일 배지와 같은 모양, 파트너 이름, HubSaving `badge`, 2026-11-11 D4), 이름이 넘치면 이름만 줄고 알약은 그대로 + 회색 “6,000만 / 1억 5,000만 원” + 얇은 막대(8px, 바탕 `surface-alt`, 채움 오렌지 `accent-app`, 2026-11-12 사용자 결정으로 ink-2에서 바꿈. 저금 진행 막대 규칙과 같음, 내 것·파트너 것 같음). (2026-11-15 3차 검토 사용자 결정: 그림이 들어올 때까지 숨김, 자리도 비우지 않음)
- 다크: 토큰 그대로(회색 바탕 `surface-alt` 다크 #232325, 상자 `surface`).
- React 래퍼(packages/ui `HomeHub.tsx`): `Hub`(`label`), `HubBand`(`text`, `go`, `onClick`, 2026-11-13 `secondary`, 2026-11-20 `more`·`label`. 2026-11-11 `close` 없앰), `HubLine`(2026-11-13), `HubTile`(`title`, `sub`, 2026-11-13 `sub2`, `value`, `art`, `small`, `point`, `badge`, `label`, `onClick`, 2026-11-13 `className`). 2026-11-13 `HubHero`·`HubSaving`과 `hg-hubhero`·`hg-hubsave` 클래스는 지움(PR 9).

- 좁은 화면 글자(2026-11-11): 허브 안 글자는 말 단위로 줄바꿈(`word-break: keep-all`, 아주 긴 말만 `overflow-wrap: anywhere`). 타일 값(`hg-hubtile__value`)은 타일 너비에 맞춰 17px에서 14px까지 줄어듦(`container-type: inline-size`, `clamp(14px, 13cqi, 17px)`), 320px 휴대폰 반 칸에서도 “2억 1,000만 원”이 한 줄. 그보다 큰 값(“987억 6,543만 2,100원”처럼 입력 상한에 가까운 값)은 말 단위로 두 줄까지 허용(2026-11-11 QA 4구간 S4-18, 글자를 더 줄이거나 자르지 않음).

## v2.2 (2026-11-13, ADR 0009)

홈 구성이 바뀜(→ 19 ‘홈 v2.2’). 이 장이 2026-11-13부터 정본이고, 위 큰 상자(`hg-hubhero`, H-03)와 저금 상자(`hg-hubsave`, H-02)는 홈에서 없앰(클래스와 React 래퍼는 PR 9에서 지움). 아래 새 클래스는 PR 9(홈)에서 `bundle.css`에 더하고 `pnpm ds:sync`로 복사함.

- 같이 모으기(H-10, SaveTogether 컴포넌트 `hg-together`, 두 칸, 두 줄 높이. **2026-11-18부터 누를 수 없는 정보 상자이고, 같이 모으기 항목이 0개면 홈이 안 그림**, core `homeOrder({ heroNone })`): 생김새 → [SaveTogether](SaveTogether.md). 허브 안에서는 `hg-hub__wide` 자리, 넓은 창 4열에서는 두 칸 × 두 줄
- (2026-11-17 홈에서는 없앰, 월급 상자 H-15로. HubLine은 월급 탭 W-02의 날짜 없는 사람 기간 한 줄(PeriodLine)이 계속 씀) 이번 달 한 줄(H-11, `hg-hubline`, HubLine, 두 칸, 한 줄): 흰 얇은 상자(`radius-xl`, 안쪽 세로 14px 가로 18px), 왼쪽 문장 15px 600 `ink`(두 줄까지) + 그 아래 회색 보조 13px 500 `slate`(있을 때) + 오른쪽 이동 글자 13px 600 `ink-2`(“확인하기 ›”, “보기 ›”, “수입 적기 ›”). 오렌지 없음. 상자 전체가 버튼, 키보드 포커스 ink 링. 날짜 없는 사람의 막대 상태(H-13)는 문장 자리에 [PeriodBar](PeriodBar.md). 못 불러오면 13 공통 7번 카드
- 결혼 준비 타일(H-12, `hg-hubtile` 그대로, 두 칸 `hg-hub__wide`, HubTile `className`): 제목 “결혼 준비 메모 4개” + 회색 보조 “다음 잔금 12월 3일”. 그림 자리 72px 그대로
- 할 일 띠 글자 버튼 둘(`hg-hubband--two`, HubBand `secondary`): 띠 8번 “같이 쓰는 생활비를 나눠 볼까요?”에서만. 오른쪽에 글자 버튼 두 개(`hg-hubband__btns` > `hg-hubband__btn`): 둘째 버튼 “이미 정했어요”(`hg-hubband__btn--quiet` 13px 500, 같은 `on-band-cocoa` 글자, 새 토큰 없음, 밑줄 없음) + 첫째 이동 글자 “나누기 ›”(15px 500). 띠 전체가 버튼이 아니라 두 버튼이 따로(각각 44px 이상 누름 자리, 묶음 `role=group` 이름 = 띠 문장). 좁은 창에서 문장 칸이 160px보다 좁아지면 버튼 줄이 문장 아래로 내려감(flex-wrap)
- 타일 배지 “상위 38%”(H-04): 두 사람 모두 순위 동의 + “홈에 보여 주기”를 켰을 때만(2026-11-13 기본 끔)
- (2026-11-17 H-07 타일은 없앰. 포인트 상자는 H-04 자산 관리 타일로 옮김: 제목 “자산 관리”, 값 순자산, 보조 `on-accent-app-sub`, 배지 “상위 38%”는 `plate` 알약 그대로. 내 자산이 없으면 값 대신 보조 줄(`hg-hubtile__sub`, `on-accent-app-sub`) 최대 두 줄 “우리 둘 순자산, 또래 중 어디쯤일까요?”(혼자는 “내 순자산, …”), 파트너가 적었으면 “{이름}님이 자산을 적었어요”가 우선(2026-11-18, 배지·값 없음, 흰 글자 금지 그대로. 반 칸 타일 높이는 내용에 맞춤이라 CSS 변경 없음). 둘째 보조 줄 `sub2`는 홈에서 안 씀)
- 넓은 창(1100px 이상 4열, 2026-11-17): 할 일 띠 한 줄 → H-10(두 칸, 두 줄) + 오른쪽 H-12(있으면), 월급 상자 H-15(두 칸) → 그 아래 오른쪽에 반 칸 타일 H-04·H-08 한 칸씩(2026-11-20: 0원이면 월급 상자가 왼쪽으로 가던 예외는 없앰, 순서 고정)
- React 래퍼(packages/ui `HomeHub.tsx`)에 더함: `HubLine`(`text`, `sub`, `go`, `bar`(PeriodBar 요소), `label`, `onClick`), `HubBand`에 `secondary`(`{ text, onClick }`), `HubTile`에 `sub2`(H-07 미계획 금액 둘째 줄)·`className`. `SaveTogether`·`PeriodBar`는 따로 파일
- 좁은 창 순서(DOM, 2026-11-17 새 순서: 할 일 띠 → H-10 → H-12 → 월급 상자 H-15 → 타일 H-04·H-08, 2026-11-20부터 H-10 모은 금액이 0원이어도 순서 그대로(고정), core `homeOrder`. 아래는 2026-11-15 기록, 3차 검토, 기획 19 ‘홈 순서’, core `homeOrder`): 확인할 것이 맨 위. H-11이 확인할 것을 말하면 H-11 → 할 일 띠 → H-14 → H-10, 아니면 할 일 띠 → H-14 → H-10 → H-11. 0원 H-10은 H-07·H-08 아래. 그다음 H-12 → H-04·H-09. 타일 72px 그림 자리는 그림이 들어올 때까지 그리지 않음(HubTile `art`는 남기되 그리지 않음). 예전(2026-11-13): H-10 → H-11 → 할 일 띠 → H-07·H-08 → H-12 → H-04·H-09. H-14 이번 달 우리 둘(`hg-card` + `hg-monthus`): 줄은 `hg-list--plain`(앞 칸 없이 카드 왼쪽 끝), 줄 높이 48px, 줄 이름 한 줄(`nowrap`), 값은 본문 글자 크기로 오른쪽(길면 값이 줄바꿈). 보여 줄 줄이 2개보다 적으면 그리지 않음(2026-11-16). 넓은 창은 띠 `order: -1`, `hg-together` 두 칸 두 줄(`grid-row: span 2`), `hg-hubline` 두 칸이라 격자 자동 배치가 ‘H-10 + 오른쪽 H-11, H-07·H-08’이 됨

## 2026-11-20 홈 점검 (구역 1)

- 자산 관리 타일(H-04)에 이름표 “순자산”(`hg-hubtile__sub`, 배지 “상위 38%”는 그 옆)과 값 아래 작은 줄(`hg-hubtile__foot`, HubTile `foot`, 12px 500, 라이트 `slate`·포인트 상자는 `on-accent-app-sub`, 두 줄까지). 값 색은 포인트 상자 글자 그대로(마이너스도 빨강 쓰지 않음).
- 다가오는 날 상자(H-16, `hg-hubup` + `hg-hub__wide`, React `HubUpcoming`(`title`, `rows[{ key, name, dday }]`, `label`, `onClick`)): 흰 넓은 상자 전체가 버튼(꺾쇠 없음, 누르면 Y-04). 머리 17px 700(높이 44px 이상) + 줄 최대 2개(왼쪽 이름 15px 500, 오른쪽 `D-n` 15px 600 `ink-2`, 줄 높이 44px 이상, 줄 사이 `hairline-soft`). 홈 맨 아래, 일정이 없으면 안 그림. 마우스 올림 `shadow-2`, 포커스 ink 링.
- 캘린더 타일(H-08) 보조 줄은 H-16 ‘다가오는 날’의 첫 항목 기준 “다음 일정 D-8”(당일 “오늘 일정 있어요”, 없으면 “다가오는 일정이 없어요”).
- 할 일 목록 시트 8번 줄: 줄(`hg-listrow`, 꺾쇠 없음) 오른쪽에 회색 알약 버튼(`hg-tasksheet__done`, `plate` 바탕 `ink-2` 13px 600 + 체크 아이콘 16px, 보이는 높이 32px + 누르는 칸 44px 이상). 줄 사이 회색 글자 버튼은 없앰. 줄을 만드는 `hg-tasksheet__row`는 flex.

- 묶음 띠(`hg-hubband--group`, HubBand `more` + `label`, 2026-11-20 사용자 결정): 할 일이 둘 이상일 때 띠 하나. 왼쪽 가장 앞선 할 일 문장(15px 600, **한 줄**, 넘치면 …) + 오른쪽 작은 개수 알약(`hg-hubband__more` “+1”, 나머지 개수, 최소 28×24px, 13px 600, 바탕 `on-band-cocoa` 18%, 새 토큰 없음) + 꺾쇠. 이동 글자(“초대하기”, “확인하기”)는 없음. 개수는 장식(`aria-hidden`)이고 화면 읽기는 띠 button의 `aria-label` “할 일 n개” 전체. 누르면 목록 시트(그대로). 할 일이 하나면 예전 띠 그대로.
- H-12 결혼 준비 타일 제목은 메모 0개일 때 “결혼 준비 메모”(개수 없음).

## 월급 상자 (H-15, HubBox, 2026-11-17, 2026-11-18 줄마다 따로 이동)

메뉴 서랍과 같은 이름·순서로 정리하며 H-07 월급 계획 타일·H-09 저금 타일·H-11 이번 달 한 줄·H-13 기간 한 줄을 이 상자의 줄로 옮김(기획 19 ‘H-15 월급 상자’).

- 상자(`hg-hubbox` + `hg-hub__wide`, 두 칸): 흰 `radius-xl`, 테두리·그림자 없음(마우스 올림만 `shadow-2`), 안쪽 위아래 `space-2`. 오렌지 없음.
- 줄마다 버튼(`button.hg-hubbox__row`, 2026-11-18 사용자 결정, 앞의 ‘상자 전체가 버튼 하나’를 바꿈). 상자(`div role=group`)와 머리는 누를 수 없고 줄 전체가 눌림(높이 56px, 44px 이상). Tab은 줄마다 한 번, 포커스는 줄 둘레 안쪽 ink 링(`outline-offset: -2px`), 누름 `scale(.98)`(동작 줄이기면 없음). 줄 안은 모두 span.
- 머리(`hg-hubbox__title`): “월급” 17px 700 `ink`(`title-3`), 높이 44px 이상, 안쪽 가로 18px. 글자만(꺾쇠 없음, 누를 수 없음).
- 줄(`hg-hubbox__list` > `button.hg-hubbox__row`): 높이 56px 이상, 안쪽 가로 18px. 왼쪽 이름(`hg-hubbox__name` 15px 500 `ink`, 줄 이름은 메뉴 서랍과 같음) + 오른쪽 값 칸(`hg-hubbox__val`, 오른쪽 맞춤): 값(`hg-hubbox__main` 15px 600 `ink-2`, 확인할 게 있으면 `--alert` 700 `ink`) + 그 아래 회색 보조(`hg-hubbox__sub` 13px 500 `slate`). 줄 사이 `hairline-soft` 선. 값 칸 뒤에 꺾쇠 하나(`hg-hubbox__go`, 16px `slate`, 그래픽이라 화면 읽기에서 숨김).
- React 래퍼 `HubBox`(`title`, `rows[{ key, name, value, sub, alert, label, onClick }]`). 줄의 `label`은 “이름, 값 보조” 화면 읽기 이름. 앱 `h-15-salary-box.tsx`가 값과 이동을 만듦. 맨 아래 “자세히 보기 ›”는 없앰.
- 반 칸 타일 둘: H-04 자산 관리가 포인트 상자(`hg-hubtile--point`), H-08 캘린더는 흰색. 둘 다 그림 자리 없음, 높이는 내용에 맞춤(같은 줄은 격자가 같은 높이로).
- H-14 이번 달 우리 둘 카드(`hg-card` + `hg-monthus`)는 홈에서 없앰(2026-11-17). `.hg-monthus` 규칙도 지움.
