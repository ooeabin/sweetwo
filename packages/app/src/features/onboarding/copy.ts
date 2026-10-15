// 온보딩 ① 문구(docs/spec/16-onboarding-1.md, 질문 패턴 docs/spec/12-question-pattern.md). 기획서 “ ” 안 문장 그대로.
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
};
