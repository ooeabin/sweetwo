// 목표 문구(docs/spec/22-goals.md G-01, G-02). 기획서 “ ” 안 문장을 그대로.
// [확인 필요] 표시는 기획서에 문구가 없어 임시로 둔 것.
export const copy = {
  title: '목표',
  retry: '다시 시도',
  loadFailed: '잠시 문제가 생겼어요. 다시 시도해 주세요',
  back: '뒤로',

  // G-01
  summary: (amount: string) => `매달 목표에 ${amount}씩 모으고 있어요`,
  saveable: (amount: string) => `저축 가능 ${amount}`,
  status: {
    active: '진행 중',
    delayed: '지연',
    wrapping_up: '마무리 중',
    achieved: '달성',
    used: '사용 완료',
    paused: '보류',
  },
  afterMarriage: '결혼 후 목표',
  proposing: '제안 중',
  heldOf: (held: string, target: string) => `${held} / ${target} 원`,
  now: '지금',
  ahead: (pct: number) => `계획보다 ${pct}% 앞서 있어요`,
  late: (months: number) => `계획보다 ${months}달 늦어요`,
  plan: (amount: string, ym: string) => `월 ${amount}씩, ${ym} 달성 예정`,
  planUnknown: '예상 미정',
  yearly: '매년',
  yearlyUse: (ym: string) => `${ym}에 써요`,
  monthly: '매달',
  monthlyHeld: (amount: string) => `${amount} 모았어요`, // [확인 필요] 매달 목표 누적액
  noAmount: '금액을 정하면 계산돼요', // [확인 필요] O-64와 같음
  folded: (n: number) => `보류·달성·사용 완료 ${n}개`,
  add: '+ 목표 추가',
  reorder: '순서 바꾸기',
  short: (amount: string) => `저축 가능 금액보다 월 ${amount} 많아요`,
  adjust: '조정하기',
  owner: (names: string) => `담당 ${names}`, // [확인 필요] 화면 읽기용
  empty: '아직 목표가 없어요', // [확인 필요]

  // G-02
  numbers: {
    target: '목표 금액',
    held: '보유액',
    left: '남은 금액',
    alloc: '월 배분액',
    deadline: '기한',
    expected: '예상 달성',
  },
  nextUse: (ym: string) => `다음 사용 ${ym}`,
  heldFrom: (other: string, linked: string, deposits: string) =>
    `기타 보유액 ${other}, 연결 자산 ${linked}, 월말 정리에서 넣은 돈 ${deposits}`, // [확인 필요]
  records: '월별 기록', // [확인 필요] 요소 이름
  recordPlan: (amount: string) => `계획 ${amount}`,
  recordActual: (amount: string) => `실제 ${amount}`,
  rested: '쉬어감',
  notClosed: '정리 전', // [확인 필요]
  noRecords: '월말 정리를 하면 여기에 쌓여요', // [확인 필요]
  more: '더보기',
  info: '정보', // [확인 필요] 요소 이름
  ownerLabel: '담당',
  together: '같이',
  createdAt: '만든 날',

  // ⋯ 메뉴, 목표 수정
  menu: '목표 메뉴', // [확인 필요] 화면 읽기용
  rename: '이름 변경',
  pause: '보류',
  resume: '다시 모으기',
  remove: '삭제',
  undo: '되돌리기',
  saved: '저장했어요', // [확인 필요]
  paused: '보류했어요', // [확인 필요]
  resumed: '다시 모아요', // [확인 필요]
  removed: '삭제했어요', // [확인 필요]
  save: '저장',
  proposeTo: (name: string) => `${name}님께 제안하기`,
  proposed: (name: string) => `${name}님에게 제안했어요`,
  editAmount: '얼마가 필요해요?',
  editDeadline: '언제까지 모을까요?',
  editYearly: '매년 몇 월에 써요?',
  editName: '목표 이름을 알려주세요',
  notBeforeThisMonth: '이번 달부터 고를 수 있어요', // [확인 필요]
  nameRequired: '이름을 넣어 주세요',
  impact: '이렇게 바뀌어요', // [확인 필요] 영향 미리보기 제목
  impactAlloc: (name: string, before: string, after: string) => `${name} 월 ${before} → ${after}`,
  impactOther: (name: string, diff: string) => `${name} ${diff}`,
  impactStatus: (before: string, after: string) => `상태 ${before} → ${after}`, // [확인 필요]
  impactExpected: (before: string, after: string) => `예상 달성 ${before} → ${after}`, // [확인 필요]
  pausedNote: '월 0원으로 배분에서 빠져 있어요',

  // G-03a~f 목표 추가
  addTitle: '어떤 목표를 추가할까요?',
  addTabs: '목표 분류', // [확인 필요] 화면 읽기용
  makeOwn: '+ 직접 만들기',
  next: '다음',
  heldTitle: '이미 모아둔 돈이 있나요?',
  heldAssets: '가진 자산에서 고르기',
  heldAssetsTotal: (amount: string) => `보유액 ${amount}`, // [확인 필요]
  heldNew: '새로 입력할게요',
  heldNone: '없어요',
  heldAmount: '얼마 모아뒀어요?', // [확인 필요]
  ownerTitle: '누가 모을까요?',
  ownerMe: '나',
  confirmTitle: (amount: string, ym: string) => `매달 ${amount}씩 모으면 ${ym}에 달성해요`,
  confirmMonthly: (amount: string) => `매달 ${amount}씩 모아요`, // [확인 필요] 매달 목표
  confirmUnknown: (name: string) => `${name} 목표를 추가할까요?`, // [확인 필요] 배분 0 또는 금액 미정
  confirmPosition: '우선순위는 맨 아래예요', // [확인 필요] 위치 고르기는 G-06과 함께
  addDone: '추가하기',
  added: '목표를 추가했어요', // [확인 필요]
  shortAfterAdd: (amount: string) => `저축 가능 금액보다 월 ${amount} 많아져요`, // [확인 필요]

  // G-06 순서 바꾸기
  orderTitle: '어떤 것부터 모을까요?',
  orderOk: '이 순서로 할게요',
  orderFixed: '비상금은 맨 위에 고정돼요', // [확인 필요]
  // 첫 주 5일째 나머지 목표(16 O-22~25)
  weekHeldTitle: '이 목표에 이미 모아둔 돈이 있나요?',
  weekRank: (n: number) => `${n}순위`,
  weekClose: '닫기',
  orderPreview: '바뀌는 배분', // [확인 필요]
  orderUp: (name: string) => `${name} 위로`,
  orderDown: (name: string) => `${name} 아래로`,
  orderMoved: (name: string, pos: number, total: number) =>
    `${name}, ${total}개 중 ${pos}번째로 옮겼어요`,
  orderHandle: (name: string) => `${name} 끌어서 옮기기`, // [확인 필요]
  orderSaved: '순서를 바꿨어요',

  // G-04 충돌 조정
  adjustTitle: (amount: string) => `목표가 저축 가능 금액보다 월 ${amount} 많아요`,
  adjustLabel: '조정 안', // [확인 필요] 화면 읽기용
  adjustDeadline: '기한 늘리기',
  adjustAmount: '금액 줄이기',
  adjustSpend: '지출 줄이기',
  adjustLiving: (before: string, after: string) => `생활비 예산 ${before} → ${after}`, // [확인 필요]
  adjustAllowance: (before: string, after: string) => `내 용돈 ${before} → ${after}`, // [확인 필요]
  adjustLine: (name: string, before: string, after: string) => `${name} ${before} → ${after}`,
  adjustNone: '고를 수 있는 안이 없어요. 목표를 고치거나 순서를 바꿔 보세요', // [확인 필요]
  adjustApply: '이렇게 바꿀게요', // [확인 필요]
  adjustDone: '바꿨어요', // [확인 필요]
  close: '닫기',

  // 달성·사용 완료 카드(달성·보류 상태 3·4번)
  achievedHeld: (amount: string) => `${amount} 모았어요`,
  usedSpent: (amount: string) => `${amount} 썼어요`,
  usedAsk: '이 돈을 썼나요?',

  // G-05 축하
  achievedEyebrow: '목표 달성',
  storyAll: (n: number) => `${n}개월 동안 매달 둘이 함께 모았어요`,
  storySome: (n: number, m: number) => `${n}개월 중 ${m}번은 둘이 함께 모았어요`,
  storySolo: (n: number) => `${n}개월 만에 모았어요`,
  // G-05 보낼 곳
  sendTitle: (amount: string) => `매달 모으던 ${amount}은 어디로 보낼까요?`,
  sendOptions: { goal: '다른 목표', add: '새 목표 만들기', allowance: '용돈 늘리기' },
  // G-05 사용 기록
  useAsk: (name: string, amount: string) => `${name}에 모은 ${amount}, 썼나요?`,
  useOptions: { later: '아직이에요', spent: '썼어요', moved: '다른 자산으로 옮겼어요' },
  useAmount: '얼마 썼어요?',
  useFrom: (amount: string) => `${amount}, 어디서 냈어요?`,
  paidFrom: { goal_fund: '목표자금 통장', living: '생활비 통장·카드', personal: '각자 돈' },
  useAsset: '어느 자산으로 옮겼어요?', // [확인 필요] 옮긴 자산 선택 질문
  noAssets: '옮길 자산이 없어요. 우리 자산에서 먼저 추가해 주세요', // [확인 필요]
  useLine: (amount: string) =>
    `이번 달 월급 나누기에 ‘목표자금 → 공동 생활비 ${amount}’을 넣었어요`,
  seeSplit: '월급 나누기 보기',
  restMoved: (amount: string, goal: string) => `남은 ${amount}은 ${goal}으로 옮겨요`,
  restOther: '다른 목표로',
  restPick: '어느 목표로 옮길까요?', // [확인 필요]
  restDone: '옮겼어요', // [확인 필요]
  ok: '확인', // [확인 필요]
  partnerRecorded: (name: string) => `${name}님이 기록했어요`,
  seeRecord: '기록 보기',

  // G-07 결혼 비용 상세
  wedding: '결혼 비용',
  estimated: '추정',
  weddingPlanned: (ym: string) => `${ym} 예정`,
  weddingSummary: {
    budget: '총예산',
    paid: '결제 완료',
    remaining: '남은 결제',
    saved: '모아둔 돈',
    support: '양가 지원',
  },
  weddingShort: (amount: string) => `예식 전까지 ${amount}이 부족해요`,
  weddingSurplus: (amount: string) => `여유 ${amount}`,
  weddingCols: { name: '항목', budget: '예산', deposit: '계약금', balance: '잔금', payer: '누가' },
  payers: { us: '우리', groom: '', bride: '', family: '양가 지원' },
  paidMark: (md: string) => `${md} ✓`,
  paidNow: '결제했어요',
  addItem: '+ 항목 추가',
  weddingTable: '결혼 비용 항목', // [확인 필요] 화면 읽기용
  weddingMonths: '월별 나갈 돈과 모일 돈', // [확인 필요] 요소 이름
  monthOut: (amount: string) => `나갈 돈 ${amount}`,
  monthIn: (amount: string) => `모일 돈 ${amount}`,
  monthShort: (amount: string) => `${amount} 모자라요`,
  noItems: '항목을 추가하면 여기에 보여요', // [확인 필요]
  budgetEdit: '총예산은 얼마예요?', // [확인 필요] 총예산 Q3 질문
  applied: '바꿨어요',
  // G-07a~d
  itemKind: '어떤 항목이에요?',
  itemCustom: '직접 입력',
  itemName: '항목 이름을 알려주세요', // [확인 필요]
  itemBudget: '예산은 얼마예요?',
  itemDates: '계약금과 잔금 날짜가 정해졌나요?',
  itemDatesOptions: { later: '아직이에요', set: '정해졌어요' },
  depositAmount: '계약금',
  depositOn: '계약금 날짜', // [확인 필요]
  balanceAmount: '잔금',
  balanceOn: '잔금 날짜', // [확인 필요]
  itemPayer: '누가 내나요?',
  payerOptions: { us: '우리(결혼 준비 통장)', me: '나', partner: '', family: '양가 지원' },
  itemSaved: '저장했어요', // [확인 필요]
  removeItem: '항목 숨기기', // [확인 필요]
  // G-07 결제 기록
  payAsk: (item: string, part: string) => `${item} ${part}, 실제로 얼마 냈어요?`,
  payBudget: (amount: string) => `예산 ${amount}`,
  payFrom: (amount: string) => `${amount}, 어디서 냈어요?`,
  payFromOptions: { wedding_account: '결혼 준비 통장', personal_support: '각자 돈·양가 지원' },
  payOver: (item: string, amount: string) => `${item}이 예산보다 ${amount} 넘었어요`,
  payOverOptions: { cut: '다른 항목에서 줄이기', raise: '총예산 늘리기' },
  payCutWhich: '어느 항목에서 줄일까요?', // [확인 필요]
  payDone: '결제를 기록했어요', // [확인 필요]
};
