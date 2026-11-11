# 컴포넌트

| 이름 | 묶음 | 한 줄 |
| --- | --- | --- |
| [Button](Button.md) | Actions | 둥근 사각형 버튼 |
| [ProviderButton](ProviderButton.md) | Actions | 소셜 로그인 버튼(마크 + 문구 + 최근 사용) |
| [IconButton](IconButton.md) | Actions | 아이콘만 있는 둥근 버튼 |
| [Menu](Menu.md) | Actions | ⋯ 버튼으로 여는 동작 목록 |
| [AddRow](AddRow.md) | Actions | 목록 끝·묶음 머리의 회색 ‘+ … 추가’ 줄(2026-11-09 + 버튼 대신) |
| [Drawer](Drawer.md) | Navigation | 좁은 창 홈 머리 ☰ 메뉴 서랍(2026-11-09 하단 탭 막대 대신) |
| [HomeHub](HomeHub.md) | Layout | 홈 허브: 회색 바탕 위 큰 상자, 할 일 띠, 타일, 저금 상자(2026-11-09) |
| [BarChart](BarChart.md) | Charts | 월별 저축이 계획보다 얼마나 많거나 적었는지 |
| [GoalTile](GoalTile.md) | Cards | 없앰(2026-11-08 목표 탭 없음). 묶음 카드 `hg-goalbox`만 저금 항목 상세(W-10)에서 씀 |
| [GoalRow](GoalRow.md) | Charts | 저금 줄(아이콘 + 금액 + 얇은 막대, W-13. 홈 H-02 줄 목록은 2026-11-09 없앰) |
| [DayRow](DayRow.md) | Lists | 홈 일정 줄(색 날짜 칸 + D-day). 2026-11-09 홈 일정 카드 없앰, 지금 쓰는 화면 없음 |
| [MonthBars](MonthBars.md) | Charts | 달마다 값(F-01 순자산 6달), 이번 달만 진하게 |
| [Breakdown](Breakdown.md) | Charts | 전체를 나눈 구성(월급 플랜 배분, 자산 구성) |
| [Distribution](Distribution.md) | Charts | F-08 분포 그림 |
| [RankRow](RankRow.md) | Content | 자산 순위 줄(F-01 0번, 2026-11-04) |
| [Band](Band.md) | Layout | 구역을 나누는 굵은 회색 띠(F-08, 2026-11-04) |
| [StatBlock](StatBlock.md) | Content | 토스형 구역 머리: 라벨 + 큰 숫자 문장 + 보조 줄(F-08, 2026-11-04) |
| [LineChart](LineChart.md) | Charts | 시간에 따른 금액 변화(순자산 추이) |
| [Meter](Meter.md) | Charts | 칸 진행 막대(지금 쓰는 화면 없음) |
| [Accordion](Accordion.md) | Containers | 가이드·자주 묻는 질문을 접었다 폈다 |
| [Card](Card.md) | Containers | 정보 묶음 |
| [ActivityFeed](ActivityFeed.md) | Data | 파트너 활동과 변경 이력 |
| [ArtPick](ArtPick.md) | Data | 지정 그림 고르기(프로필 사진. 목표 사진은 2026-11-08 없앰) |
| [Avatar](Avatar.md) | Data | 사람 표시 |
| [Calendar](Calendar.md) | Data | ‘캘린더’ 메뉴의 달력 |
| [Checklist](Checklist.md) | Data | 첫 주 할 일처럼 끝내야 할 일 목록 카드 |
| [DataTable](DataTable.md) | Data | 어드민·내보내기용 표 |
| [Meta](Meta.md) | Data | 한 줄에 정보 여럿을 두는 방법과 작은 표시 |
| [NetWorth](NetWorth.md) | Data | 순자산 2줄 표시 |
| [Banner](Banner.md) | Feedback | 화면 위 안내 띠 |
| [ConflictChoice](ConflictChoice.md) | Feedback | 같은 칸 충돌 때 “어느 쪽으로 할까요?” |
| [Celebration](Celebration.md) | Feedback | 목표 금액 달성 화면(W-12) |
| [EmptyState](EmptyState.md) | Feedback | 내용이 없을 때의 화면 |
| [SceneMedia](SceneMedia.md) | Feedback | 비워 둔 장면 자리 |
| [Skeleton](Skeleton.md) | Feedback | 불러오는 동안 자리를 잡는 회색 틀, 질문 화면 뼈대(QuestionSkeleton), 처리 중(ProcessingState) |
| [Toast](Toast.md) | Feedback | 잠깐 떴다 사라지는 알림 |
| [Tooltip](Tooltip.md) | Feedback | 용어·아이콘 짧은 설명 |
| [AmountInput](AmountInput.md) | Inputs | 금액 넣기 |
| [Chip](Chip.md) | Inputs | 선택 칩 |
| [GoalPick](GoalPick.md) | Inputs | 그림 카드 고르기(묶음 타일 `hg-pick--tiles`, F-03a. O-21 목표 고르기는 2026-11-08 없앰) |
| [ResultCard](ResultCard.md) | Data | 결과 요약 카드(큰 금액 + 체크 줄) |
| [InfoPlate](InfoPlate.md) | Data | 조건 요약 판(이름–값 두 열), 완료 표시 DoneMark |
| [ConsentCard](ConsentCard.md) | Inputs | 동의 받기 |
| [CopyField](CopyField.md) | Inputs | 초대 코드·링크를 보여 주고 복사 |
| [DatePicker](DatePicker.md) | Inputs | 날짜 입력(결혼식 날짜 묻기 등) |
| [DateWheel](DateWheel.md) | Inputs | 날짜·연도 휠(연도만 S-11i / 연·월·일 S-11h. `commitInitial`) |
| [DayChips](DayChips.md) | Inputs | 월급날 숫자 판(1~31 + 말일). 지금은 안 씀, 월급날은 DayWheel |
| [FileAttach](FileAttach.md) | Inputs | 파일 첨부 칸 |
| [ImageCrop](ImageCrop.md) | Inputs | 프로필 사진 올리기와 자르기(S-11e) |
| [Input](Input.md) | Inputs | 글자 입력 칸과 금액 입력 |
| [Search](Search.md) | Inputs | 찾기 칸 + 결과 목록 + 결과 없음 |
| [Select](Select.md) | Inputs | 목록에서 하나 고르기 |
| [Selection](Selection.md) | Inputs | 켜기·끄기(Toggle), 여러 개 고르기(Checkbox), 하나 고르기(Radio) |
| [Slider](Slider.md) | Inputs | 둘 사이 비율 나누기(분담, 자동차 현금 비율) |
| [AdminFrame](AdminFrame.md) | Layout | 어드민 틀 |
| [AdminAuth](AdminAuth.md) | Layout | 어드민 로그인·2단계 인증 |
| [AppFrame](AppFrame.md) | Layout | 앱 화면 틀 |
| [AuthLayout](AuthLayout.md) | Layout | 로그인, 가입 화면 틀 |
| [LockScreen](LockScreen.md) | Layout | 앱 잠금 화면 |
| [PageHeader](PageHeader.md) | Layout | 상세 화면 머리 |
| [QuestionLayout](QuestionLayout.md) | Layout | 한 화면 한 질문 틀 |
| [SectionHeader](SectionHeader.md) | Layout | 본문 안 묶음 제목 |
| [Status](Status.md) | Display | 어드민 표 상태 값(점 + 글자) |
| [Ring](Ring.md) | Data | 묶음 진행 원(“2/4”) |
| [WeekStrip](WeekStrip.md) | Data | 이번 주 날짜 띠 |
| [SiteLayout](SiteLayout.md) | Layout | 웹사이트 틀(L 화면) |
| [ListRow](ListRow.md) | Lists | 목록 한 줄 |
| [ReorderList](ReorderList.md) | Lists | 순서 바꾸기 목록 |
| [ReceiptCard](ReceiptCard.md) | Cards | 영수증 카드(W-01 월급 계획, 달 결과 카드, 톱니 아래 가장자리, 비율 막대 PlanBar(진행 모드), 편집 모드) |
| [TransferRow](TransferRow.md) | Lists | 월급 체크리스트 줄 한 행 |
| [ProgressSteps](ProgressSteps.md) | Navigation | 질문 흐름의 진행 막대 |
| [ChapterBar](ChapterBar.md) | Navigation | 온보딩 챕터 진행(챕터 이름 + 챕터 안 막대), 첫 화면 챕터 목록(ChapterList) |
| [Tabs](Tabs.md) | Navigation | 같은 화면 안에서 묶음을 바꾸는 알약 탭(hg-tabs)과, 보기 방식을 바꾸는 세그먼트(hg-seg) |
| [BottomSheet](BottomSheet.md) | Overlays | 좁은 창(768px 미만)에서 아래에서 올라오는 시트 |
| [ListInput](ListInput.md) | Inputs | Q6 목록 입력(이름 + 월 + 금액 여러 줄) |
| [CommandPalette](CommandPalette.md) | Overlays | Ctrl/⌘+K로 여는 검색, 빠른 실행 |
| [Modal](Modal.md) | Overlays | 되돌릴 수 없는 행동 앞의 확인 대화상자 |
| [NotificationPanel](NotificationPanel.md) | Overlays | 알림 패널(N-01) |
| [Badge](Badge.md) | Status | 상태·영역을 짧게 알리는 알약 |
| [Widget](Widget.md) | Widgets | 앱 밖에서 보는 요약 |
