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
  spendEntry: '지출 적기',
  closeStart: '정리 시작',
  livingLeft: '이번 달 남은 생활비',
  livingOver: (amount: string) => `${amount} 넘었어요`,
  unsplit: '안 나눈 돈',
  closeTile: '월말 정리',
  netWorth: '순자산',
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
  retry: '다시 시도',
};
