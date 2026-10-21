// H 화면 문구 (docs/spec/19-this-month.md). 기획서 “ ” 안 문장을 그대로.
// [확인 필요] 표시는 기획서에 문구가 없어 임시로 둔 것.
export const copy = {
  tabMonth: '이번 달',
  tabGoals: '목표',
  tabAssets: '우리 자산',
  tabCalendar: '캘린더',
  search: '검색',
  mask: '금액 가리기',
  noti: '알림',
  settings: '설정',
  add: '추가',
  me: '설정 열기', // [확인 필요] 아바타 버튼 이름(화면 읽기용)
  saved: '모두 저장됨',
  stats: '이번 달 숫자', // [확인 필요] 숫자 타일 묶음 이름(화면 읽기용)

  // H-01 인사
  greetingSplit: (name: string, month: number, n: number) =>
    `${name}님, ${month}월 월급 나누기가 ${n}곳 남았어요`,
  greetingNoSplit: (name: string, amount: string) =>
    `${name}님, 이번 달 생활비가 ${amount} 남았어요`,
  greetingOver: (name: string, amount: string) => `${name}님, 생활비를 ${amount} 넘게 썼어요`,

  // H-02 오늘 띠 버튼과 타일
  splitNow: '월급 나누기',
  seePlan: '월급 플랜 보기', // [확인 필요] H-03 → W-01
  spendEntry: '지출 적기',
  closeStart: '정리 시작',
  // 해제 대기 띠
  unlinkBand: '연결 해제를 기다리고 있어요',
  unlinkBandSub: (md: string) => `${md}에 분담 비율대로 정리돼요`,
  unlinkBandGo: '확인하기',
  unlinkTodo: (name: string) => `${name}님이 연결 해제를 요청했어요`,
  accessTodo: '문의를 확인하려면 동의가 필요해요',
  noticeOpen: '보기', // [확인 필요]
  noticeFold: '접기', // [확인 필요]
  noticeClose: '닫기', // [확인 필요]
  missedTodo: '지난달 정리',
  missedTodoSub: (m: string) => `${m} 정리가 아직 남았어요`,
  livingTodo: '이번 달 생활비, 지금까지 어때요?',
  reconnectTodo: (name: string) => `${name}님이 다시 연결하자고 해요`,
  unlinkTodoSub: (md: string) => `${md}까지`, // [확인 필요] 기한 표시
  livingLeft: '이번 달 남은 생활비',
  livingOver: (amount: string) => `${amount} 넘었어요`,
  unsplit: '안 나눈 돈',
  closeTile: '월말 정리',
  netWorth: '순자산',
  checklistTodo: '체크리스트', // [확인 필요] 할 일 보조 줄
  // H-06 순자산(F-01과 같은 표기)
  netWorthExpected: (amount: string) => `예상 ${amount}`,
  netWorthExpectedName: '예상 순자산',
  netWorthGain: (amount: string) => `안 판 수익 ${amount}`,
  netWorthChange: (amount: string) => `지난달보다 ${amount}`,
  netWorthGraph: '최근 6개월 순자산', // [확인 필요] 화면 읽기용
  netWorthEmpty: '자산을 적으면 여기에 보여요', // [확인 필요]
  netWorthSee: '우리 자산 보기', // [확인 필요]
  // H-08 배우자 활동
  activity: (partner: string) => `${partner}님 활동`, // [확인 필요] 카드 제목
  activityEmpty: '아직 활동이 없어요', // [확인 필요]
  activitySplit: (partner: string, line: string) => `${partner}님이 ${line} 나누기를 끝냈어요`,
  activitySplitAny: (partner: string) => `${partner}님이 월급 나누기를 끝냈어요`, // [확인 필요]
  activityAdded: (partner: string, name: string) => `${partner}님이 ${name} 항목을 추가했어요`, // [확인 필요]
  activityChanged: (partner: string, name: string) => `${partner}님이 ${name} 금액을 바꿨어요`, // [확인 필요]
  activitySum: '개인 자산 금액이 바뀌었어요',
  activityEmergency: (partner: string, isIn: boolean, amount: string) =>
    isIn
      ? `${partner}님이 비상금에 ${amount}을 넣었어요`
      : `${partner}님이 비상금에서 ${amount}을 꺼냈어요`,
  unknown: '아직 몰라요',
  nextEvent: '다음 일정',
  dday: (n: number) => (n === 0 ? 'D-day' : `D-${n}`), // [확인 필요] 당일 표기

  // H-03 월급 플랜
  planName: (month: number) => `${month}월 월급 플랜`,
  temp: '임시',
  splitLeft: (n: number) => `월급 나누기 ${n}곳 남았어요`,
  livingLeftLine: (amount: string) => `이번 달 남은 생활비 ${amount}`,
  roles: { living: '공동 생활비', goalFund: '목표자금', emergency: '비상금', allowance: '용돈' },

  // 월말 정리 카드
  closeTitle: (month: number) => `${month}월 월급 플랜 정리할 때예요`,
  closeSub: '5~10분이면 돼요',

  // H-05 목표
  goals: '목표',
  delayed: '지연',
  more: '더보기',
  goalAmount: (held: string, target: string) => `${held} / ${target}`,
  noGoalAmount: '금액을 정하면 계산돼요', // [확인 필요] O-64와 같은 문구

  // H-07 다가오는 일정
  upcoming: '다가오는 일정',
  payday: (who: string) => `${who}님 월급날`, // [확인 필요]
  wedding: '결혼식', // [확인 필요]
  noUpcoming: '30일 안에 일정이 없어요', // [확인 필요]

  // 예비부부 H-P1, H-P3, H-P4
  ddayWedding: (n: number) => `결혼까지 D-${n}`,
  weddingPlanned: (ym: string) => `${ym} 예정`,
  estimated: '추정',
  gather: '이번 달 모으기', // [확인 필요] 카드 제목
  weddingStatus: '결혼 비용 현황', // [확인 필요] 카드 제목
  paid: '결제 완료',
  toPay: '남은 결제',
  budget: '총예산',
  support: '양가 지원',
  savedMoney: '모아둔 돈',
  toSave: '예식 전까지 모을 돈',
  shortfall: (amount: string) => `예식 전까지 ${amount}이 부족해요`,
  surplus: (amount: string) => `여유 ${amount}`,

  // 불러오기 실패
  loadFailed: '잠시 문제가 생겼어요. 다시 시도해 주세요',
  // 합류했는데 시작한 사람이 첫 플랜 전(18 P-11 대기)
  waitPlan: (starter: string) => `${starter}님이 플랜을 만들고 있어요`,
  waitPlanTitle: '아직 이번 달 플랜이 없어요',
  waitPlanBody: (starter: string) => `${starter}님이 플랜을 마치면 알려 드릴게요`,
  retry: '다시 시도',

  // H-04 할 일
  editMoney: '월 수입·지출 수정',
  todos: '할 일',
  todosLeft: (n: number) => `${n}개 남았어요`,
  todoLeftState: '남음',
  minutes: (n: number) => `${n}분`,
  tomorrow: '내일 할게요',
  copyCode: '코드 복사',
  copied: '복사했어요', // [확인 필요] 온보딩 O-07과 같은 문구
  inviteFailed: '지금은 코드를 만들 수 없어요',
  todoLabels: {
    spend_check: '지출 점검',
    invite: (partner: string) => `${partner}님을 초대해 주세요`,
    exact_values: '정확한 값 입력',
    wedding_date: '예식일 정하기',
    split_rule: '분담 방식 정하기', // [확인 필요] O-52 ‘나중에 할게요’ 할 일
    assets: '자산 정리하기',
    loans: '대출 정리하기',
    fixed_card: '고정지출 나누기·생활비 카드',
    rest: '나머지 목표·상여금·다른 수입',
    invest: '투자 원칙 정하기',
  },
};
