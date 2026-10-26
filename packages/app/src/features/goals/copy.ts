// 목표 문구(docs/spec/22-goals.md G-01, G-02). 기획서 “ ” 안 문장을 그대로.
// [확인 필요] 표시는 기획서에 문구가 없어 임시로 둔 것.
export const copy = {
  title: '목표',
  retry: '다시 시도',
  saveFailed: '저장하지 못했어요',
  // 충돌 선택(13 공통 상태 11번)
  conflictQ: '어느 쪽으로 할까요?',
  conflictBody: (partner: string) => `${partner}님이 방금 이 값을 바꿨어요`,
  conflictMine: '내 값',
  conflictTheirs: (partner: string) => `${partner}님 값`,
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
  // G-01 예외: 배우자가 방금 고친 목표 [확인 필요]
  partnerChanged: (name: string, field: string) =>
    `${name}님이 ${
      field === 'deadline'
        ? '기한을'
        : field === 'amount'
          ? '목표 금액을'
          : field === 'name'
            ? '이름을'
            : '목표를'
    } 바꿨어요`,
  // G-02 9번 진행 그래프, 10a번 월별 저금 막대 [확인 필요]
  graphTitle: '모은 돈 흐름',
  graphActual: '모은 돈',
  graphPlan: '계획',
  graphPlanText: (v: string) => `계획 ${v}`,
  barsTitle: '한 달 평균 저금',
  barsPct: (p: number) => `계획의 ${p}%`,
  barsNote: (plan: number) =>
    `가운데 선이 계획 ${plan}만 원. 더 넣은 만큼 위, 덜 넣은 만큼 아래(만 원)`,
  monthLabel: (m: number) => `${m}월`,
  barTip: (month: number, put: string, diff: number, gap: string) =>
    diff === 0
      ? `${month}월 ${put}, 계획대로`
      : `${month}월 ${put}, 계획보다 ${gap} ${diff > 0 ? '더' : '덜'}`,
  recordPlan: (amount: string) => `계획 ${amount}`,
  recordActual: (amount: string) => `실제 ${amount}`,
  rested: '쉬어감',
  notClosed: '정리 전', // [확인 필요]
  noRecords: '월말 정리를 하면 여기에 쌓여요', // [확인 필요]
  more: '더보기',
  info: '정보', // [확인 필요] 요소 이름
  together: '같이',
  createdAt: '만든 날',
  createdBy: '만든 사람',
  ownerOf: '주인', // [확인 필요]
  help: '도움말',
  positionLabel: '어디에 넣을까요?', // [확인 필요] 우선순위 위치
  positionBefore: (name: string) => `${name} 앞`,
  positionLast: '맨 아래',
  lateLink: '분배표에서 저금 늘리기', // [확인 필요]
  nextYearQ: (name: string, amount: string) => `내년 ${name}도 ${amount}으로 할까요?`,
  nextYearKeep: '그대로',
  nextYearChange: '바꿀래요',
  nextYearAmount: '내년에는 얼마가 필요해요?', // [확인 필요]
  nextYearDone: '내년 금액을 바꿨어요', // [확인 필요]
  helpLabels: {
    home: '청약·정책대출 체크리스트',
    baby: '출산 준비 체크리스트', // [확인 필요]
    wedding: '결혼 예산 체크리스트', // [확인 필요]
  },
  recordStateTitle: '상태',
  recordMonth: '월',
  recordPlanned: '저금 줄',
  recordPut: '넣은 돈',
  recordState: {
    checked: '넣었어요',
    other: '다른 금액',
    skipped: '못 함',
    wait: '아직',
  } as Record<string, string>,
  savedAll: (amount: string) => `${amount} 모았어요`,
  usedQ: '이 돈을 썼나요?',
  numNextUse: '다음에 쓰는 달',
  numRound: '회차',
  round: (n: number) => `${n}회차`,
  byWho: (date: string, name: string) => `${date}, ${name}`,

  // ⋯ 메뉴, 목표 수정
  menu: '목표 메뉴', // [확인 필요] 화면 읽기용
  rename: '이름 변경',
  pause: '보류',
  resume: '다시 모으기',
  remove: '삭제',
  undo: '되돌리기',
  saved: '저장했어요', // [확인 필요]
  amountChanged: '목표 금액을 바꿨어요', // [확인 필요] 08 4장 “{무엇}을 바꿨어요”
  deadlineChanged: '기한을 바꿨어요',
  nameChanged: '이름을 바꿨어요', // [확인 필요]
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
  impactNeed: (before: string, after: string) => `월 필요액 ${before} → ${after}`, // [확인 필요]
  impactStatus: (before: string, after: string) => `상태 ${before} → ${after}`, // [확인 필요]
  impactExpected: (before: string, after: string) => `예상 달성 ${before} → ${after}`, // [확인 필요]
  pausedNote: '월 0원으로 배분에서 빠져 있어요',

  // G-03a~f 목표 추가
  addTitle: '어떤 목표를 추가할까요?',
  addTabs: '목표 분류', // [확인 필요] 화면 읽기용
  makeOwn: '+ 직접 만들기',
  next: '다음',
  heldTitle: '이 목표로 이미 모은 돈이 있나요?', // [확인 필요]
  heldAssets: '가진 자산에서 고르기',
  heldAssetsTotal: (amount: string) => `보유액 ${amount}`, // [확인 필요]
  heldNew: '있어요',
  heldNone: '없어요',
  heldAmount: '얼마 모아뒀어요?', // [확인 필요]
  ownerTitle: '누가 모을까요?',
  ownerMe: '나',
  confirmTitle: (amount: string, ym: string) => `매달 ${amount}씩 모으면 ${ym}에 이뤄요`, // [확인 필요]
  confirmMonthly: (amount: string) => `매달 ${amount}씩 모아요`, // [확인 필요] 매달 목표
  confirmUnknown: (name: string) => `${name} 목표를 추가할까요?`, // [확인 필요] 배분 0 또는 금액 미정
  confirmPosition: '우선순위는 맨 아래예요', // [확인 필요]
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
  sendTitle: (amount: string) => `매달 넣던 ${amount}은 어디로 보낼까요?`,
  sendOptions: { goal: '다른 목표', add: '새 목표 만들기', split: '분배표에서 정할게요' }, // [확인 필요]
  sendPick: '어느 목표에 더할까요?', // [확인 필요]
  sendDone: (goal: string, amount: string) => `${goal} 저금 줄에 ${amount}을 더했어요`, // [확인 필요]
  // G-05 사용 기록
  useAsk: (name: string, amount: string) => `${name}에 모은 ${amount}, 썼나요?`,
  useOptions: { later: '아직이에요', spent: '썼어요' },
  useAmount: '얼마 썼어요?',
  restTitle: (amount: string) => `남은 ${amount}은 어떻게 할까요?`, // [확인 필요]
  restOptions: { emergency: '비상금에 넣기', goal: '다른 목표에 넣기', keep: '그대로 두기' }, // [확인 필요]
  restPick: '어느 목표에 넣을까요?', // [확인 필요]
  restDone: '넣었어요', // [확인 필요]
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
  // 재기획(22, ADR 0003) 목표 종류, 모은 돈, 넣기·빼기, 꺼내 쓰기
  groups: { ours: '우리 목표', mine: '내 목표' }, // [확인 필요]
  partnerGroup: (name: string) => `${name}님 목표`, // [확인 필요]
  monthlySummary: (amount: string) => `매달 목표에 ${amount}씩 모으고 있어요`, // [확인 필요]
  noSplit: '분배표에서 저금을 정해 주세요', // [확인 필요]
  editSplit: '분배표 고치기',
  planNew: (amount: string, ym: string) => `매달 ${amount}씩, ${ym} 달성 예정`,
  setAmount: '금액 정하기',
  lateLine: (n: string) => `기한보다 ${n} 늦어요`,
  moreSaving: '분배표에서 저금 늘리기', // [확인 필요]
  thisMonthDone: (amount: string) => `이번 달 ${amount} 넣었어요`,
  thisMonthTodo: (amount: string) => `이번 달 ${amount} 넣을 차례예요`,
  thisMonthSkipped: '이번 달은 못 했어요', // [확인 필요]
  foldedNew: (n: number) => `보류, 달성, 다 쓴 목표 ${n}개`, // [확인 필요]
  onlyEmergency: '다른 목표 추가하기',
  years: (n: number) => `${n}년`,
  months: (n: number) => `${n}개월`,
  // G-02
  kindOurs: '우리 목표', // [확인 필요]
  kindMine: '내 목표', // [확인 필요]
  kindPartner: (name: string) => `${name}님 목표`, // [확인 필요]
  numTarget: '목표 금액',
  numSaved: '모은 돈',
  numLeft: '남은 금액',
  numMonthly: '매달 넣는 돈',
  numDeadline: '기한',
  numExpected: '예상 달성',
  perPerson: (parts: string) => parts, // “찬우 60만 + 예빈 35만”
  noDeadline: '없음', // [확인 필요]
  expectUnknown: '예상 미정',
  addHeld: '이미 모은 돈 넣기',
  changeMonthly: '매달 넣을 돈 바꾸기', // [확인 필요]
  inOut: '넣기·빼기', // [확인 필요]
  use: '꺼내 쓰기',
  onTime: '기한 안에 이뤄요',
  lateHelp: '분배표에서 저금을 늘리면 앞당길 수 있어요',
  toOurs: '우리 목표로 바꾸기', // [확인 필요]
  toMine: '내 목표로 바꾸기', // [확인 필요]
  cantToMine: (name: string) => `${name}님도 모으고 있어서 바꿀 수 없어요`, // [확인 필요]
  changedKind: '목표 종류를 바꿨어요', // [확인 필요]
  history: '모은 돈 기록', // [확인 필요]
  historyHeld: '이미 모은 돈',
  historyChecked: (label: string) => `${label} 저금`,
  historyIn: '넣었어요',
  historyOut: '뺐어요',
  historyUse: '꺼내 썼어요',
  historySkipped: '못 했어요',
  noHistory: '아직 기록이 없어요', // [확인 필요]
  viewOnly: '보기만 할 수 있어요', // [확인 필요] 배우자 내 목표
  // G-02a 넣기·빼기, G-02b 꺼내 쓰기
  moveTitle: '모은 돈을 어떻게 고칠까요?', // [확인 필요]
  moveIn: '넣을게요',
  moveOut: '뺄게요',
  moveInAmount: '얼마를 넣을까요?', // [확인 필요]
  moveOutAmount: '얼마를 뺄까요?', // [확인 필요]
  useTitle: (goal: string) => `${goal}에서 얼마를 꺼내 썼어요?`, // [확인 필요]
  useHelp: (saved: string) => `지금 모은 돈은 ${saved}이에요`,
  tooMuch: '모은 돈보다 많아요', // [확인 필요]
  movedIn: (goal: string, amount: string) => `${goal}에 ${amount} 넣었어요`,
  movedOut: (goal: string, amount: string) => `${goal}에서 ${amount} 뺐어요`, // [확인 필요]
  used: (goal: string, amount: string) => `${goal}에서 ${amount} 꺼내 썼어요`, // [확인 필요]
  heldAsk: '이 목표로 이미 모은 돈이 있나요?', // [확인 필요]
  // G-03e 누구 목표
  whoTitle: '누구 목표예요?', // [확인 필요]
  whoOurs: '우리 둘', // [확인 필요]
  whoMine: '나', // [확인 필요]
  confirmZeroLine: '분배표에 이 목표 줄을 0원으로 만들어 둘게요. 금액은 분배표에서 정해요', // [확인 필요]

  // 목표 사진(22 G-02 ‘목표 사진’, 직접 만든 목표만). 올리기 규칙·문구는 프로필 사진(25 S-11e)과 같음
  photoTitle: '목표 사진', // [확인 필요]
  photoChange: '사진 바꾸기',
  photoRemove: '사진 지우기',
  photoRemoved: '사진을 지웠어요', // [확인 필요]
  photoSaved: '사진을 바꿨어요',
  photoDrop: '사진을 끌어 놓거나 골라 주세요',
  photoPick: '사진 고르기',
  photoHelp: 'JPG, PNG, HEIC, WebP, 10MB 이하',
  photoNotice: (partner: string) => `올린 사진은 ${partner}님과 나만 볼 수 있어요`,
  photoNoticeSolo: '올린 사진은 나만 볼 수 있어요', // [확인 필요] 혼자 쓰기
  photoTooBig: '10MB 이하 사진만 올릴 수 있어요',
  photoBadType: '이 형식은 올릴 수 없어요',
  photoStage: '사진 위치, 화살표로 옮겨요',
  photoZoom: '확대', // [확인 필요] 화면 읽기용
  photoPreview: '미리보기', // [확인 필요] 화면 읽기용
  photoAgain: '다시 고르기',
  photoSave: '저장할게요',
};
