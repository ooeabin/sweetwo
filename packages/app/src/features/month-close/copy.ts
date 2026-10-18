// 월말 정리 문구(docs/spec/21-month-close.md). 기획서 “ ” 안 문장을 그대로.
// [확인 필요] 표시는 기획서에 문구가 없어 임시로 둔 것.
export const copy = {
  // W-04j 지출 입력(이번 달 ‘지출 적기’로 앞당겨 열기)
  spendTitle: '이번 달 쓴 돈을 적어요', // [확인 필요] 제목
  spendHelp: '카드 명세서를 보며 항목별로 이번 달 합계만 넣어요',
  fixedShared: '공동 고정지출', // [확인 필요] 항목별 금액(O-37) 전에는 합계 한 줄
  loan: '대출 상환',
  fixedGroup: '고정',
  addItem: '항목 이름', // [확인 필요] 화면 읽기용
  add: '추가', // [확인 필요]
  done: '다 적었어요', // [확인 필요]
  saveFailed: '잠시 문제가 생겼어요. 다시 시도해 주세요',
  retry: '다시 시도',
  noPlan: '월급 플랜이 있어야 적을 수 있어요', // [확인 필요]

  next: '다음',

  // W-04a 시작
  startTitle: (m: number) => `${m}월 월급 플랜 정리를 시작할게요`,
  startHelp: '5~10분이면 돼요',
  startAlone: (partner: string) => `바꾼 값은 끝에서 ${partner}님께 제안으로 가요`,
  start: '시작',

  // W-04j 소득 확인, 큰 지출
  incomeTitle: '이번 달 들어온 돈', // [확인 필요] 소득 확인 묶음 이름
  incomeSub: '월급 플랜 수입이에요', // [확인 필요]
  incomeLabel: '이번 달 실제 받은 금액', // [확인 필요] 화면 읽기용
  right: '맞아요',
  edit: '수정',
  bigOptions: [
    { key: 'car_insurance', name: '자동차보험 연납' },
    { key: 'car_tax', name: '자동차세' },
    { key: 'property_tax', name: '재산세' },
    { key: 'insurance', name: '보험 연납' },
    { key: 'custom', name: '직접 쓰기' },
  ],

  // W-04k 저축 확인
  savingsTitle: '이번 달 넣은 돈', // [확인 필요] 제목
  savingsHelp: '목표마다 이번 달 넣은 돈을 확인해요', // [확인 필요]
  planned: (amount: string) => `계획 ${amount}`, // [확인 필요] 보조 줄
  otherSaving: '기타 저축',
  savingsTotal: '이번 달 넣은 돈 합계', // [확인 필요]

  // W-04g 정산 요약
  summary: (m: number) => `${m}월 정산`,
  cardNote: '지난달 카드 사용분',
  saved: (amount: string, pct: number) => `이번 달 ${amount}을 모았어요 (계획의 ${pct}%)`,
  partnerEstimated: (partner: string) => `${partner}님 수입은 추정값으로 셌어요`,
  myMoneyOnly: (partner: string, me: string) =>
    `${partner}님이 합류하기 전이라 ${me}님 돈만 셌어요`,
  allowanceNote: (me: string, amount: string) => `${me} ${amount}`,
  finish: '정리 끝내기', // [확인 필요]
  fixText: (avg: string) => `최근 3개월 평균 ${avg} 원을 썼어요. 예산을 맞출까요?`,
  fixApplied: '생활비 예산을 맞췄어요', // [확인 필요]
  fixProposed: (partner: string) => `${partner}님께 제안을 보냈어요`, // [확인 필요]
  good: (amount: string) => `생활비를 계획보다 ${amount} 아꼈어요`,
  planTable: '계획 대비', // [확인 필요] 표 이름
  planCol: { name: '목표', planned: '계획', saved: '넣은 돈', diff: '차이' }, // [확인 필요]
  shortTitle: (amount: string) => `계획보다 ${amount} 덜 모았어요. 어떻게 채울까요?`, // [확인 필요]
  short: {
    spread_3m: '3개월에 나눠 채우기',
    extend: '기한 늘리기',
    skip_this_month: '이번 달만 넘어가기',
  },
  spreadSub: (amount: string) => `다음 3개월 동안 ${amount}씩 더 넣어요`, // [확인 필요]
  overTitle: (amount: string) => `계획보다 ${amount} 더 모았어요. 어느 목표에 더 넣을까요?`, // [확인 필요]
  detailed: '더 꼼꼼히 정리하기',

  // W-04 끝
  doneTitle: (m: number) => `${m}월 월급 플랜 정리 끝!`,
  noChange: '바뀐 값이 없어요',
  toMonth: '이번 달로', // [확인 필요]

  // W-04a2 실제 수입
  actualTitle: '이번 달 실제 들어온 돈은 얼마예요?',
  incomeShortToast: (amount: string) => `다음 달에 비상금에서 생활비로 ${amount}을 채워요`, // [확인 필요]
  incomeOverTitle: (amount: string) => `기준보다 ${amount} 더 들어왔어요`, // [확인 필요]
  incomeOverHelp: '더 들어온 돈은 목표나 용돈으로 나눌 수 있어요', // [확인 필요]
  incomeOverGo: '추가 소득 나누기',

  // 놓친 달
  missedTitle: (m: string) => `${m} 월급 플랜을 아직 정리하지 않았어요`,
  missedSub: (m: number) => `${m}월 플랜은 이미 시작했어요`,
  missedMany: (range: string) => `${range} 정리가 밀렸어요`,
  missedNow: '지금 정리하기',
  missedNowSub: '그달 쓴 돈과 넣은 돈을 한 번에 적어요',
  missedRest: '쉬어가기',
  missedRestSub: '그달 합계만 적고 넘어가요',
  missedTodo: '지난달 정리',
  restDone: '그달 합계를 적었어요', // [확인 필요]

  // W-04h 다음 달 조정
  adjustTitle: '다음 달 플랜, 바꿀 게 있을까요?',
  heldBadge: '보류', // [확인 필요]
  heldNote: '반대해서 보류됐어요',
  togetherAlone: (partner: string) => `${partner}님도 좋아요를 눌러야 바뀌어요`,
  livingBudget: '생활비 예산', // [확인 필요]
  allocTitle: '목표 배분', // [확인 필요]
  allocTotal: (total: string, saveable: string) => `합계 ${total} 원 / 저축 가능 ${saveable} 원`,

  // W-04 끝(혼자: 제안 묶음)
  sentTitle: (n: number, partner: string) => `바뀐 값 ${n}개를 ${partner}님께 제안으로 보냈어요`,
  doneConfirmed: (n: number) => `바뀐 값 ${n}개를 확정했어요`,
  pending: '제안 중',
  applyFrom: (date: string) => `반대 없으면 ${date}부터 적용돼요`,
  seeSent: '보낸 제안 보기',

  // W-04p 월말 정리 제안 응답
  bundleTitle: (who: string, m: number) => `${who}님이 ${m}월 월급 플랜을 정리했어요`,
  allLike: '모두 좋아요',
  restLike: (n: number) => `나머지 ${n}개 좋아요`,
  bundleDone: '모두 답했어요', // [확인 필요]

  // 꼼꼼 모드
  // W-04b 통장 잔액
  balanceTitle: '지금 통장 잔액을 알려주세요',
  asPlanned: (amount: string) => `계획대로라면 ${amount}`,
  balanceLess: (amount: string) => `계획보다 ${amount} 적어요`,
  balanceMore: (amount: string) => `계획보다 ${amount} 많아요`,
  balanceSame: '계획대로예요',
  balanceTotal: (amount: string) => `통장 잔액 모두 ${amount}`,
  balanceOdd: '입력한 값이 맞나요?',
  // W-04c 목표에서 쓴 돈
  usesTitle: '이번 달 목표에서 쓴 돈, 이렇게 기록돼 있어요',
  paidFrom: {
    goal_fund: (a: string) => `목표자금 통장에서 ${a}`,
    living: (a: string) => `생활비 카드로 ${a}`,
    wedding_account: (a: string) => `결혼 준비 통장에서 ${a}`, // [확인 필요]
    personal: (a: string) => `내 돈으로 ${a}`, // [확인 필요]
    personal_support: (a: string) => `내 돈으로 ${a}`, // [확인 필요]
  } as Record<string, (a: string) => string>,
  usesRight: '맞아요',
  gapTitle: (amount: string) => `나머지 ${amount}은 어느 목표에서 썼어요?`,
  gapHelp: (amount: string) => `목표자금 통장이 기록보다 ${amount} 더 줄었어요`,
  achieved: '달성',
  notGoal: '목표에서 쓴 돈이 아니에요',
  // W-04d 비상금
  emergencyTitle: '이번 달 비상금을 쓴 일이 있었나요?',
  emergencyNo: '없어요',
  emergencyYes: '있어요',
  emergencyWhy: '어디에 썼어요?', // [확인 필요]
  emergencyReasons: {
    hospital: '병원',
    repair: '수리',
    family_event: '경조사',
    living_short: '생활비 부족',
    etc: '기타',
  } as Record<'hospital' | 'repair' | 'family_event' | 'living_short' | 'etc', string>,
  // W-04e 투자
  investTitle: '투자 평가액이 바뀌었나요?',
  investSame: '그대로예요',
  // W-04f 대출
  loanTitle: '대출 잔액이 줄었죠?',
  loanHelp: (amount: string) => `월 상환액 ${amount}을 뺐어요`, // [확인 필요]
  // W-04i 대화 카드
  cardsTitle: '이번 달 이야기해 볼까요?', // [확인 필요]
  cardNext: '넘기기',
  cardSkip: '건너뛰기',
  cardCount: (n: number, total: number) => `${n} / ${total}`,
  // 대화 카드(주제별 질문 묶음: 빚, 용돈, 투자, 양가). 첫 문장만 기획서 예시, 나머지는 [확인 필요]
  cards: [
    '이번 달 가장 만족스러운 지출은 뭐였어요?',
    '용돈이 모자라거나 남은 적이 있었나요?',
    '다음 달에 꼭 쓰고 싶은 돈이 있나요?',
    '갚고 있는 돈 중에 먼저 줄이고 싶은 게 있나요?',
    '투자에 대해 요즘 어떻게 생각해요?',
    '양가에 드리는 돈, 지금 정도가 괜찮나요?',
    '이번 달 아끼느라 힘들었던 게 있었나요?',
    '올해 안에 같이 해 보고 싶은 게 있나요?',
    '비상금은 어느 정도면 마음이 편할 것 같아요?',
  ],

  // 함께 모드(W-04a 4~8번, W-04 끝 6~8번, 함께 정하기 3번)
  closing: (name: string) => `${name}님이 정리 중이에요`,
  closingHelp: '같이 하면 바꾼 값이 바로 확정돼요',
  closingStep: (step: string) => `지금 ${step}`, // [확인 필요] 단계 이름 줄
  joinTogether: '같이 하기',
  viewOnly: '보기만',
  togetherNow: '함께 정리 중',
  viewing: '보기만 하는 중이에요',
  typing: (name: string) => `${name}님이 입력 중`,
  partnerLeft: (name: string) => `${name}님이 나갔어요. 이제부터 바꾸는 값은 제안으로 보내요`,
  confirmedTitle: (n: number) => `바뀐 값 ${n}개를 확정했어요`,
  confirmed: '확정',
  applyNext: (m: number) => `${m}월 월급 플랜부터 적용돼요`,
  togetherConfirm: '같이 정하면 바로 확정돼요',
  setThis: '이 값으로 정하기',
  stepNames: {
    'w-04a': '시작',
    'w-04a2': '이번 달 수입',
    'w-04j': '지출 입력',
    'w-04k': '저축 확인',
    'w-04h': '다음 달 조정',
    'w-04g': '정산 요약',
    'w-04-end': '정리 끝',
  } as Record<string, string>,
};
