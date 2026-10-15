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
  heldFrom: (other: string, deposits: string) =>
    `기타 보유액 ${other}, 월말 정리에서 넣은 돈 ${deposits}`, // [확인 필요]
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
};
