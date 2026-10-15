// 우리 자산 문구(docs/spec/23-assets.md F-01~F-04). 기획서 “ ” 안 문장을 그대로.
// [확인 필요] 표시는 기획서에 문구가 없어 임시로 둔 것.
export const copy = {
  title: '우리 자산',
  add: '+ 추가',
  retry: '다시 시도',
  loadFailed: '잠시 문제가 생겼어요. 다시 시도해 주세요',
  back: '뒤로',
  tabs: { overview: '한눈에', items: '자산·부채', diagnosis: '재정 진단' },
  tabsLabel: '우리 자산 보기', // [확인 필요] 화면 읽기용

  // F-01
  netWorth: '순자산',
  netWorthValue: (amount: string) => `순자산 ${amount}`,
  expected: (amount: string) => `예상 순자산 ${amount}`,
  gain: (amount: string) => `안 판 수익 ${amount}`,
  up: (amount: string) => `지난달보다 ${amount} 늘었어요`,
  down: (amount: string) => `지난달보다 ${amount} 줄었어요`,
  assets: (amount: string) => `자산 ${amount}`,
  debts: (amount: string) => `부채 ${amount}`,
  assetsLabel: '자산',
  debtsLabel: '부채',
  monthSplit: (month: number, n: number) => `${month}월 월급 플랜, 월급 나누기 ${n}곳 남았어요`,
  monthSplitDone: '이번 달 월급을 다 나눴어요',
  monthLiving: (month: number, amount: string) => `${month}월 월급 플랜, 생활비 ${amount} 남았어요`,
  monthCard: '이번 달', // [확인 필요] 카드 이름
  planCard: '이번 달 계획', // [확인 필요] 카드 이름
  planIncome: '월 수입',
  planSpend: '지출',
  planSaveable: (amount: string) => `저축 가능 금액 월 ${amount}`,
  empty: '자산을 하나씩 적어볼까요?',
  addAsset: '자산 추가',

  // F-02
  noDebt: '갚을 돈이 없어요',
  addDebt: '+ 부채 추가',
  joint: '공동',
  proxy: '대신 입력',
  vis: { all: '전체 공개', sum: '합계만', private: '비공개' },
  partnerSum: (name: string, side: string, n: number) => `${name}님 ${side} ${n}개`,
  checkAmount: '금액이 맞나요?',
  updated: (date: string) => `${date} 수정`, // [확인 필요]
  goalBadge: (name: string) => `${name} 목표`, // [확인 필요]

  // F-03
  addTitle: '무엇을 추가할까요?', // [확인 필요] 화면 목록의 이름
  sideLabel: '자산·부채', // [확인 필요] 화면 읽기용
  groupLabel: '묶음', // [확인 필요] 화면 읽기용
  nameTitle: '이름을 정해주세요',
  nameRequired: '이름을 넣어 주세요',
  amountAsset: '현재 금액은 얼마예요?',
  amountDebt: '남은 대출금은 얼마예요?',
  ownerTitle: '누구 명의예요?',
  ownerMe: '나',
  visTitle: '배우자에게 공개할까요?',
  visOptions: { all: '전체 공개', sum: '합계만 공개', private: '비공개' },
  next: '다음',
  save: '추가하기', // [확인 필요]
  sameName: '같은 이름이 있어요. 그래도 추가할까요?',
  addedUp: (amount: string) => `추가했어요. 순자산이 ${amount} 늘었어요`,
  addedDown: (amount: string) => `추가했어요. 순자산이 ${amount} 줄었어요`, // [확인 필요] 부채
  added: '추가했어요', // [확인 필요] 비공개는 합계에 없음
  highInterest: '금리가 높은 대출이에요. 이 대출부터 갚는 목표를 만들까요?',
  makeGoal: '목표 만들기', // [확인 필요]

  // F-03f~i
  later: '나중에 할게요',
  maturity: '만기일은 언제예요?',
  contractEnd: '계약 만기일은요?',
  paidCount: '납입 회차는요?',
  paidCountUnit: '회', // [확인 필요]
  payment: '월 납입액은요?',
  repayment: '월 상환액은요?',
  payFrom: '어느 통장에서 빠져나가요?',
  payFromOptions: { goal_fund: '목표자금 통장', personal: '각자 통장' },
  rate: '금리는 몇 %예요?',
  rateError: '0~100 사이로 넣어 주세요', // [확인 필요]
  goal: '어떤 목표를 위한 돈인가요?',
  noGoal: '없음',

  // F-04
  amountLabel: '금액', // [확인 필요]
  visLabel: '공개 범위', // [확인 필요]
  edit: '수정',
  cancel: '취소',
  saveEdit: '저장',
  remove: '삭제',
  removed: '휴지통으로 옮겼어요',
  undo: '되돌리기',
  saved: '저장했어요', // [확인 필요]
  readOnly: (name: string) => `${name}님 항목이라 볼 수만 있어요`,
  history: '월별 기록', // [확인 필요] 요소 이름
  fromClose: '월말 정리',
  fromManual: '직접 수정',
  principal: (amount: string) => `원금 ${amount}`,
  owner: '명의', // [확인 필요]
  goalLink: '목표', // [확인 필요]
  maturityLabel: '만기일', // [확인 필요]
  paymentLabel: '월 납입액', // [확인 필요]
  repaymentLabel: '월 상환액', // [확인 필요]
  rateLabel: '금리', // [확인 필요]
  countLabel: '납입 회차', // [확인 필요]
};
