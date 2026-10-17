import { topic } from '@sweetwo/core';

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
  graphLabel: '순자산 그래프', // [확인 필요] 화면 읽기용
  periodsLabel: '기간', // [확인 필요] 화면 읽기용
  periods: ['6개월', '1년', '3년', '전체'],
  expectedName: '예상 순자산',
  expectedShort: (amount: string) => `예상 ${amount}`,
  summaryEmpty: '첫 월말 정리 뒤에 보여드려요',
  summaryName: '월 정산 요약', // [확인 필요] 화면 읽기용
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
  roles: {
    living: '공동 생활비',
    goal_fund: '목표자금',
    emergency: '비상금',
    wedding: '결혼 준비',
    personal: '개인',
  },
  sortLabel: '정렬', // [확인 필요] 화면 읽기용
  sorts: { name: '이름', owner: '명의', amount: '금액', updated: '수정일' },
  sortDir: (name: string, asc: boolean) => `${name}, ${asc ? '오름차순' : '내림차순'}`, // [확인 필요] 화면 읽기용
  investShare: (pct: number, limit: number | null) =>
    limit === null ? `공동자금 투자 비중 ${pct}%` : `공동자금 투자 비중 ${pct}% / 허용 ${limit}%`,
  investGain: (amount: string, pct: number | null) =>
    pct === null ? amount : `${amount}(${pct > 0 ? '+' : pct < 0 ? '−' : ''}${Math.abs(pct)}%)`,

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

  // F-05 월 수입·지출
  moneyTitle: '월 수입·지출', // [확인 필요] 화면 이름
  incomeSection: '월 수입',
  spendSection: '지출',
  person: (name: string, amount: string) => `${name} ${amount}`,
  payday: (day: string) => `월급날 ${day}`,
  baseIncome: '기준 수입',
  estimatedTag: '추정',
  allowance: '용돈',
  allowanceEach: (a: string, b: string) => `${a}, ${b}`,
  fixed: '고정지출',
  loan: '대출 상환', // [확인 필요]
  living: '생활비',
  saveable: '저축 가능 금액',
  short: (amount: string) => `${amount} 모자라요`,
  shortAsk: '어느 항목을 줄여볼까요?',
  periodChange: '기간 정해서 바꾸기',
  savedRecalc: '저장했어요. 안 나눈 돈을 다시 계산했어요',
  savedNoPending: '안 나눈 돈이 없어 월말 정리에서 맞춰요',
  previewUp: (amount: string) => `저축 가능 금액이 월 ${amount} 늘어요`, // [확인 필요] 기획서는 줄어요만
  previewDown: (amount: string) => `저축 가능 금액이 월 ${amount} 줄어요`,
  proposeTo: (name: string) => `${name}님께 제안하기`,
  proposed: (name: string) => `${name}님에게 제안했어요`,
  editMoney: '월 수입·지출 수정',

  // F-06 재정 진단
  diagTitle: '재정 진단',
  diagSummary: (good: number, total: number) => `${total}개 중 ${good}개 양호`,
  diagLine: (good: number, total: number) => `재정 진단 ${total}개 중 ${good}개 양호`,
  diagSaving: (pct: number) => `월 수입의 ${pct}%를 저축하고 있어요`,
  diagSavingUnknown: '월말 정리를 하면 계산해요', // [확인 필요]
  diagEmergency: (months: number) => `비상금으로 ${months}개월 생활할 수 있어요`,
  diagEmergencyMore: (months: number) => `${months}개월분까지 모아봐요`,
  diagEmergencyUnknown: '비상금 목표에 모아둔 돈을 적으면 계산해요', // [확인 필요]
  diagLoan: (pct: number) => `월 수입의 ${pct}%를 대출 상환에 쓰고 있어요`,
  diagNoLoan: '대출이 없어요',
  diagFixed: (pct: number) => `월 수입의 ${pct}%가 고정지출이에요`,
  diagInvestNone: '아직 정하지 않았어요',
  diagInvestWait: (partner: string) => `${partner}님 답을 기다려요`,
  diagInvestMine: '내 답을 기다려요', // [확인 필요] 배우자만 답했을 때
  diagInvestBoth: (limit: number) =>
    limit === 0
      ? '공동자금은 원금을 지키기로 했어요'
      : `공동자금은 ${limit}%까지 투자하기로 했어요`, // [확인 필요]

  // 첫 주 자산·대출 정리(17 O-41~47)
  weekAssets: '지금 가진 돈을 골라주세요',
  weekAccountsIn: (n: number) => `쓰던 통장 ${n}개는 이미 넣어뒀어요`,
  weekAssetAmount: (name: string) => `${topic(name)} 얼마예요?`,
  weekLumpGoal: '이 돈을 어느 목표에 넣을까요?',
  weekLumpNone: '아직 정하지 않았어요',
  weekRecommend: '추천',
  weekLoans: '갚고 있는 대출이 있나요?',
  weekNoLoan: '없어요',
  weekNoLoanCheck: (amount: string) =>
    `처음에 대출 상환이 월 ${amount}이라고 했어요. 대출이 정말 없나요?`, // [확인 필요] O-39 확인 1회
  weekLoanAmount: (name: string) => `${name} 남은 돈은요?`,
  weekRateUnknown: '잘 모르겠어요',
  weekRateAvg: (rate: number) => `평균 금리 ${rate}%로 셀게요`, // [확인 필요]
  weekPayment: '한 달에 얼마씩 갚아요?',
  weekCount: (name: string, i: number, n: number) => `${name} ${i}/${n}`,
  weekClose: '닫기',
  weekOwner: '누구 돈이에요?', // [확인 필요] 소유자 토글 이름(화면 읽기용)
  weekTogether: '같이',
  weekAssetsDone: '자산을 정리했어요', // [확인 필요]
  weekLoansDone: '대출을 정리했어요', // [확인 필요]

  // 첫 주 고정지출 나누기·생활비 카드(17 O-37, O-38b)
  weekFixedPick: '어디에 나가는 돈이에요?', // [확인 필요] O-37 세부 항목 고르기
  weekFixedPickHelp: '고른 항목마다 금액을 물어요', // [확인 필요]
  weekFixedAmount: (name: string) => `${name}에 한 달에 얼마 나가요?`,
  weekFixedNone: '같이 내는 고정지출이 없어요', // [확인 필요] 물을 항목이 없을 때
  weekCard: '생활비는 주로 신용카드로 쓰나요?',
  weekCardYes: '네',
  weekCardNo: '아니요',
  weekFixedDone: '고정지출을 정리했어요', // [확인 필요]

  // 첫 주 상여금·다른 수입(17 O-34, O-35, O-35b)
  weekBonus: '상여금이나 성과급도 있나요?',
  weekBonusYes: '있어요',
  weekBonusNo: '없어요',
  weekBonusList: '보통 몇 월에 얼마쯤 받아요?',
  weekBonusTotal: (man: string) => `1년에 ${man} 원 받아요`,
  weekBonusName: '상여금',
  weekIncome: '월급 말고 들어오는 돈이 또 있나요?',
  weekIncomeKinds: { side_job: '부업·N잡', rent: '월세·임대 수입', support: '정부 지원금' },
  weekIncomeAmount: (name: string) => `${topic(name)} 한 달에 얼마쯤이에요?`, // [확인 필요] 항목별 월 금액
  weekIncomeLow: '들쭉날쭉하면 적게 벌 때 기준으로 적어 주세요', // [확인 필요] 변동 수입 기준
  weekRestDone: '들어오는 돈을 정리했어요', // [확인 필요]
  incomeEvents: '들어오는 돈', // W-07
  otherIncomeIn: (amount: string) => `다른 수입 ${amount} 포함`, // [확인 필요] F-05 내 수입 보조 줄

  // O-53 투자 원칙
  principleTitle: '같이 모은 돈, 투자는 어느 정도까지 괜찮아요?',
  principleOptions: {
    keep: '원금은 지켜야 해요',
    some: '조금은 괜찮아요',
    active: '일부는 적극적으로',
    unsure: '잘 모르겠어요',
  },
  principleLimit: (limit: number) => (limit === 0 ? '투자하지 않아요' : `공동자금의 ${limit}%까지`), // [확인 필요] 선택지 보조 줄
  principlePartner: (partner: string, answer: string) =>
    `${partner}님은 ‘${answer}’를 골랐어요. 다르면 더 조심스러운 쪽으로 정해요`, // [확인 필요]
  principleSaved: '투자 원칙을 정했어요', // [확인 필요]
  diagPrivate: '비공개 항목은 계산에서 빠졌어요',
  diagGoEmergency: '비상금 목표',
  diagGoDebt: '부채 목록',
  diagGoMoney: '월 수입·지출',
  diagGoInvest: '지금 정하기',
  diagIncomeUnknown: '월 수입을 적으면 계산해요', // [확인 필요]

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
