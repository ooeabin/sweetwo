import { topic } from '@sweetwo/core';

// 온보딩 문구(① docs/spec/16-onboarding-1.md, ② 17-onboarding-2.md, 질문 패턴 docs/spec/12-question-pattern.md). 기획서 “ ” 안 문장 그대로.
// [확인 필요] 표시는 기획서에 문구가 없어 임시로 둔 것.
export const copy = {
  next: '다음',
  unsure: '잘 모르겠어요',
  checkValue: '입력한 값이 맞나요?',
  saveFailed: '잠시 문제가 생겼어요. 다시 시도해 주세요',
  retry: '다시 시도',
  estimated: '추정',

  // O-03, O-05 (Q5)
  myNickname: '뭐라고 부르면 될까요?',
  myNicknameHelp: '배우자에게도 이 이름으로 보여요',
  partnerNickname: '배우자는 뭐라고 부를까요?',
  nicknamePlaceholder: '예: 찬우',
  partnerPlaceholder: '예: 예빈',
  nameRequired: '이름을 넣어 주세요',
  sameNickname: '두 분 호칭이 같아요. 그대로 쓸까요?',

  // O-04
  side: '어느 쪽이세요?',
  sides: { groom: '신랑', bride: '신부' },

  // O-06, O-07
  inviteNow: '배우자도 지금 초대할까요?',
  inviteChoices: { now: '지금 초대', later: '나 먼저 할게요' },
  inviteTitle: '이 코드를 보내주세요',
  inviteValid: '7일 동안 쓸 수 있어요',
  copyLink: '링크 복사',
  sendKakao: '카톡으로 보내기',
  inviteFailed: '지금은 코드를 만들 수 없어요',
  copied: '복사했어요', // [확인 필요] 복사 토스트

  // O-10, O-20 (Q7)
  part1Title: '우리 부부에 대해 알려주세요',
  part1Help: '답에 맞춰 목표와 플랜을 추천해요',
  part1Cta: '시작할게요',
  part2Title: '이제 둘의 목표를 정해요',
  part2Help: '고른 목표마다 얼마를, 언제까지 모을지 물어볼게요',
  part2Cta: '목표 고르기',
  summaryTitle: '지금까지 알려준 내용',
  edit: '수정',

  // O-11
  married: '결혼은 하셨나요?',
  marriedChoices: { married: '했어요', engaged: '준비 중이에요' },
  engagedSub: '결혼 준비 돈도 같이 정리해요',
  dropPrepAnswers: '결혼 준비 답은 지워져요',
  dropConfirm: '바꿀게요', // [확인 필요]
  cancel: '취소',

  // O-12
  weddingDone: '결혼한 날은 언제예요?',
  weddingPlanned: '결혼 예정일은 언제예요?',
  weddingPlannedHelp: '결혼기념일과 결혼 비용 기한에 써요',
  undecided: '아직 미정이에요',
  whenPlanned: '언제쯤 예정이에요?',
  noDate: '없는 날짜예요',
  pastOnly: '오늘까지의 날짜를 넣어 주세요', // [확인 필요]
  futureOnly: '내일부터의 날짜를 넣어 주세요', // [확인 필요]

  // O-13
  birthYear: (me: string) => `${me}님은 몇 년생이세요?`,
  from1950: '1950년부터 입력해 주세요',
  adultsOnly: '만 18세부터 쓸 수 있어요',

  // O-15, O-16, O-18
  housing: '지금 어떤 집에 사세요?',
  housings: {
    jeonse: '전세',
    monthly_rent: '반전세·월세',
    own: '자가',
    parents: '부모님 집',
    none: '아직 안 구했어요',
  },
  employment: (me: string) => `${me}님은 어떻게 일하고 계세요?`,
  employments: {
    regular: '정규직',
    contract: '계약직',
    freelance: '프리랜서·사업자',
    resting: '쉬는 중',
  },
  childPlan: '아이 계획이 있으세요?',
  childPlans: {
    within_1y: '1년 안',
    in_1_3y: '1~3년',
    after_3y: '3년 뒤',
    none: '없어요',
    unsure: '아직 모르겠어요',
  },

  // O-19a~e
  weddingGoalChip: '결혼 비용 목표',
  weddingBudget: '결혼 준비에 총 얼마를 생각하세요?',
  weddingBudgetHelp: '둘이 합한 금액이에요',
  familySupport: '양가에서 도움을 받기로 했나요?',
  familySupportChoices: { yes: '네', no: '아니요', unknown: '아직 몰라요' },
  familySupportAmount: '얼마를 도와주시기로 했어요?',
  amountUnknown: '금액은 아직 몰라요',
  weddingSaved: '지금까지 결혼 준비로 모아둔 돈이 있나요?',
  none: '없어요',
  newlywedHome: '신혼집은 언제 구하나요?',
  newlywedHomes: {
    have: '이미 구했어요',
    before: '결혼 전에',
    after: '결혼 후에',
    parents: '부모님 집에서 시작해요',
  },
  newlywedWhen: '언제쯤 구할 예정이에요?',
  prepMode: '결혼 전까지 돈은 어떻게 관리할까요?',
  prepModes: {
    separate: { label: '각자 관리하고 결혼 비용만 같이', sub: '나머지는 결혼 후에 정해요' },
    together: { label: '지금부터 합쳐서', sub: '신혼부부와 같은 플랜을 만들어요' },
  },

  // O-21
  goalsTitle: '둘이 가장 먼저 이루고 싶은 건 뭐예요?',
  goalsHelp: '우선순위 순서대로 모두 골라 주세요',
  goalsHelpSeparate: '고른 목표는 결혼 후부터 모아요',
  autoEmergency: '비상금은 자동으로 들어가요',
  autoWedding: '결혼 비용은 자동으로 들어가요', // [확인 필요] 예비 각자 관리 자동 줄
  autoWeddingEmergency: '결혼 비용과 비상금은 자동으로 들어가요', // [확인 필요] 예비 합쳐서 자동 줄
  recommended: '추천',
  makeOwn: '+ 직접 만들기',
  picked: (n: number) => `${n}개 골랐어요`,
  onlyEmergency: '비상금만 먼저 모을게요',
  onlyWedding: '결혼 비용만 먼저 모을게요',
  goalTabsLabel: '목표 분류',

  // O-23, O-24
  first: '1순위',
  saveRatio: (manText: string) => `${manText}을 모아요`,
  yearsLater: (n: number) => `${n}년 뒤`,
  monthlyNeed: (manText: string) => `매달 ${manText}씩 모으면 돼요`,
  needFormula: (left: string, months: number) => `${left} ÷ ${months}개월`,
  goalDeadline: '언제까지 모을까요?', // [확인 필요] O-24 질문 문구
  notBeforeThisYear: (y: number) => `${y}년부터 넣어 주세요`, // [확인 필요]
  yearTotal: (manText: string) => `1년에 모두 ${manText} 원`,

  // O-31 (파트 3)
  income: (me: string) => `${me}님은 한 달에 얼마 받으세요?`,
  incomeHelp: '세금 떼고 통장에 들어오는 돈이에요',
  incomeLow: '최근 몇 달 중 가장 적게 번 달은 얼마였어요?',
  incomeLowHelp: '이 금액이 기준 수입이 돼요',
  noIncome: '지금은 수입이 없어요',

  // O-32, O-33
  payday: '월급날은 며칠이에요?',
  paydayLast: '말일',
  paydayShortMonth: '짧은 달은 말일로 계산해요', // [확인 필요] 29~31일 안내
  partnerIncome: (partner: string) => `${partner}님 수입을 대략 알면 골라주세요`,
  partnerExact: '정확히 알아요',
  partnerExactLabel: (partner: string) => `${partner}님 한 달 실수령`, // [확인 필요] 금액 칸 이름(화면 읽기용)

  // O-36
  fixedGroups: '매달 꼭 나가는 돈을 골라주세요',
  fixedGroupsHelp: '대출 상환은 다음에 따로 물어요',
  addOwn: '직접 추가',
  addOwnPlaceholder: '예: 정수기 렌탈', // [확인 필요]
  add: '추가', // [확인 필요]
  noneApply: '해당 없어요',
  fixedTotal: '같이 내는 돈은 한 달에 얼마예요?',
  fixedTotalHelp: '휴대폰처럼 각자 내는 건 빼고요',

  // O-38, O-39
  living: '식비·생활용품 등에는 한 달에 얼마쯤 쓰세요?',
  loan: '갚고 있는 대출이 있다면 한 달에 모두 얼마씩 갚아요?',

  // O-51, O-52 (파트 5)
  later: '나중에 할게요',
  allowance: (me: string) => `${me}님 용돈은 한 달에 얼마로 할까요?`,
  allowanceHelp: '각자 자유롭게 쓰는 돈이에요',
  allowancePlaceholder: '50만 원',
  allowancePartnerSame: (partner: string) => `${partner}님 용돈도 같은 금액으로 계산해 둘게요`,
  split: '같이 쓰는 돈은 어떻게 나눌까요?',
  splitHelp: (amount: string) => `한 달 ${amount}을 두 분이 나눠 넣어요`,
  splitWedding: '결혼 비용은 어떻게 나눌까요?',
  splitWeddingHelp: (amount: string) => `한 달 ${amount}을 두 분이 나눠 넣어요`,
  splitModes: { half: '반반', income: '버는 만큼', custom: '직접 정할게요' },
  splitPartnerUnknown: (partner: string) => `${partner}님 수입을 알면 계산돼요`,
  splitNoSaving: '모을 돈이 남지 않아 생활비만 나눠요',
  splitPct: (name: string, pct: number) => `${name} ${pct}%`,

  // 결과 공통(O-61~67)
  tempPlan: '임시 플랜',
  tempJoin: (partner: string) => `${partner}님이 합류하면 다시 계산돼요`,
  tempEstimates: '추정값을 정확히 채우면 다시 계산돼요',

  // O-61
  analyzing: '두 분의 돈 흐름을 정리하고 있어요',

  // O-62
  canSave: (amount: string) => `두 분은 한 달에 ${amount}을 모을 수 있어요`,
  canSaveMine: (me: string, amount: string) => `${me}님 몫으로 한 달에 ${amount}을 모을 수 있어요`,
  canSaveSolo: (amount: string) => `한 달에 ${amount}을 모을 수 있어요`,
  noSaving: '지금은 모을 돈이 남지 않아요',
  livingOverIncome: '생활비가 수입보다 많아요',
  incomeCard: '월 수입',
  incomeBoth: '두 분 합계',
  incomeMine: (me: string) => `${me}님 수입`,
  joinPreview: (partner: string) => `${partner}님이 합류하면 여기서 월급을 나눠요`,
  saveCard: '한 달에 모을 수 있는 돈',
  saveGoal: '목표',
  saveEmergency: '비상금',
  checkSpending: '지출 점검',
  checkFixed: '고정지출 다시 보기', // [확인 필요]
  checkLiving: '생활비 다시 보기', // [확인 필요]
  flowTitle: (income: string) => `${income}은 이렇게 나뉘어요`,
  flowAllowance: '용돈',
  flowShared: '공동 생활비',
  flowSave: '모을 돈',
  basisTitle: '이렇게 계산했어요',
  basisIncome: '수입',
  basisAllowance: '용돈',
  basisFixed: '고정지출',
  basisLiving: '생활비',
  basisSave: '모을 수 있는 돈', // [확인 필요] 계산 근거 마지막 줄
  weddingSave: (amount: string) => `결혼 비용으로 한 달에 ${amount}씩 모아요`, // [확인 필요] 각자 관리 예비부부 O-62 결론
  weddingCard: '결혼 비용 한 달 필요액', // [확인 필요]

  // O-64
  goalsResult: '목표는 이렇게 모아요',
  perMonth: (amount: string) => `${amount} 원/월`,
  expected: (ym: string) => `${ym} 달성 예상`,
  expectedUnknown: '달성 예상 미정', // [확인 필요] 배분 0이면 ‘미정’
  goalNoAmount: '금액을 정하면 계산돼요', // [확인 필요] 금액을 아직 안 정한 목표 줄
  goalShort: (goal: string) => `${topic(goal)} 기한까지 조금 부족해요`,
  adjustDeadline: '기한 늘리기', // [확인 필요]
  adjustDeadlineSub: (goal: string, ym: string) => `${goal} ${ym}까지`, // [확인 필요]
  adjustAmount: '목표 금액 낮추기', // [확인 필요]
  adjustAmountSub: (goal: string, amount: string) => `${goal} ${amount}`, // [확인 필요]
  adjustSpend: '지출 줄이기',
  adjustSpendLiving: (amount: string) => `생활비 ${amount} 줄이기`, // [확인 필요]
  adjustSpendAllowance: (amount: string) => `내 용돈 ${amount} 줄이기`, // [확인 필요]
  adjustLabel: '조정 안', // [확인 필요] 조정 안 묶음 이름(화면 읽기용)

  // O-65
  lookAt: (names: string) => `${names}만 살펴보면 돼요`,
  allGood: '지금 흐름이 좋아요',
  indicators: {
    savingRate: '저축률',
    emergency: '비상금',
    loanBurden: '대출 상환 부담',
    fixedRatio: '고정지출 비율',
    investPrinciple: '투자 원칙 합의',
  },
  signals: { good: '양호', caution: '주의', danger: '위험', unknown: '아직 몰라요' },
  actionsTitle: '이렇게 해 볼까요', // [확인 필요] 개선 액션 묶음 제목
  firstWeek: {
    assets: { label: '자산 정리하기', day: '2일째' },
    loans: { label: '대출 정리하기', day: '3일째' },
    fixed: { label: '고정지출 나누기·생활비 카드', day: '4일째' },
    invest: { label: '투자 원칙 정하기', day: '7일째' },
  },

  // O-63
  accountMode: '통장을 어떻게 쓰고 있어요?',
  accountModes: { single: '통장 하나로 써요', roles: '역할별로 나눠 쓸래요' },
  accounts: '통장을 이렇게 나눠 쓸까요?',
  accountsHelp: '금액을 누르면 고칠 수 있어요',
  accountsWedding: '결혼 준비 통장을 하나 정해요',
  accountsSingle: '한 달에 이렇게 써요', // [확인 필요] 통장 하나 모드 월 금액 묶음 제목
  roles: {
    living: '공동 생활비',
    goal_fund: '목표자금',
    emergency: '비상금',
    wedding: '결혼 준비',
    personal: '용돈',
  },
  accountName: (role: string) => `${role} 통장`,
  whichAccount: '어느 통장으로 쓸까요',
  existing: '쓰던 통장이 있어요',
  newAccount: '새로 만들 거예요',
  fromZero: '0원에서 시작해요',
  accountNamePlaceholder: '생활비 통장',
  accountNameLabel: '통장 이름', // [확인 필요] 화면 읽기용
  balanceLabel: '지금 잔액', // [확인 필요]
  sameAccount: '공동 생활비와 목표자금은 다른 통장으로 써야 해요',
  sameAccountOther: '역할마다 다른 통장으로 써야 해요', // [확인 필요] 비상금이 겹칠 때
  goalFundEmpty: '모을 돈이 생기면 써요',
  allowanceAccounts: '각자 용돈 통장', // [확인 필요] 묶음 제목
  assumed: '(가정)',
  monthlyTransfer: '각자 매달 옮길 돈', // [확인 필요] 묶음 제목
  baseDayLine: (day: string) => `매달 ${day} 기준`,
  change: '바꾸기',
  dayText: (d: number | 'last') => (d === 'last' ? '말일' : `${d}일`),

  // O-66
  startPlan: '이대로 시작할까요?',
  invite: (partner: string) => `${partner}님 초대하기`,
  baseDay: (day: string) => `매달 ${day}`,
  myPayday: (me: string) => `${me}님 월급날`,
  planName: (month: number) => `${month}월 월급 플랜`,
  daysLeft: (n: number) => `${n}일 남음`,
  planAmountLabel: '이번 달 옮길 수 있는 돈', // [확인 필요] 금액 칸 이름(화면 읽기용)
  planTooMuch: (amount: string) => `한 달 ${amount}까지 넣을 수 있어요`, // [확인 필요]
  shortCycle: '이번 달은 기간이 짧아서 다음 달과 합쳐 정리해요',
  zeroPlan: '이번 달은 옮기지 않고 시작할까요?',
  linesTitle: '이렇게 옮겨요',
  total: '합계',
  start: '시작하기',

  // O-67
  started: (month: number) => `${month}월 월급 플랜을 시작했어요`,
  missionMarried: '양가 명절·생신도 미리 챙겨볼까요?',
  missionEngaged: '결혼 비용 항목부터 나눠볼까요?',
  doNow: '지금 하기',
};
