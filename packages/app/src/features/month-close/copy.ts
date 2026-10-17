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
};
