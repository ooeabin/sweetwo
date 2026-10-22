// 월급 플랜·월급 나누기 문구(docs/spec/20-salary-plan.md W-01, W-02). 기획서 “ ” 안 문장을 그대로.
// [확인 필요] 표시는 기획서에 문구가 없어 임시로 둔 것.
export const copy = {
  backHome: '이번 달',
  backPlan: '월급 플랜',
  planTitle: (month: number) => `${month}월 월급 플랜`,
  firstTitle: '이번 달 남은 기간 플랜',
  period: (start: string, end: string) => `${start} ~ ${end}`,
  temp: '임시',
  progress: (total: number, done: number) => `${total}곳 중 ${done}곳 나눴어요`,
  allDone: '월급을 다 나눴어요',
  notJoined: (partner: string) => `${partner}님이 합류하면 여기서 월급을 나눠요`,
  flowLabel: '돈 흐름', // [확인 필요] 화면 읽기용
  flow: {
    allowance: '용돈',
    living: '공동 생활비',
    goalFund: '목표자금',
    emergency: '비상금',
    fixed: '고정',
    livingOnly: '생활비',
    saving: '저축',
  },
  incomeThisMonth: (name: string, amount: string) => `${name} ${amount}이 들어오는 달이에요`,
  plannedLabel: '계획액', // [확인 필요] 섹션 이름
  roles: {
    living: '공동 생활비',
    goal_fund: '목표자금',
    emergency: '비상금',
    wedding: '결혼 준비',
    personal: '개인',
  } as Record<string, string>,
  chip: (name: string, date: string, amount: string) => `${name} ${date} ${amount}`,
  splitButton: '월급 나누기',
  editMoney: '월 수입·지출 수정',
  back: '뒤로',
  loadFailed: '잠시 문제가 생겼어요. 다시 시도해 주세요',

  // W-02
  splitTitle: '월급 나누기',
  sideTabs: '누구 몫', // [확인 필요] 화면 읽기용
  // “공동 생활비 통장에 156만 원”: 받는 곳은 왼쪽, 금액은 오른쪽 금액 칸(TransferRow)
  rowLabel: (role: string) => `${role} 통장에`,
  autoFrom: (role: string) => `${role} 통장에서`,
  auto: '자동',
  moved: (role: string) => `${role} 통장 옮겼어요`,
  cancel: '취소',
  other: '다른 금액을 옮겼어요',
  actual: (amount: string) => `${amount} 옮겼어요`, // [확인 필요] 실제 금액 표시
  proxy: (partner: string) => `${partner}님 대신 체크`,
  proxyNote: (partner: string) => `${partner}님 몫은 보기만 해요`, // [확인 필요]
  already: (partner: string) => `${partner}님이 먼저 체크했어요`,
  partnerProgress: (name: string, done: number, total: number) => `${name} ${done}/${total}`,
  close: '닫기',
  nothing: '나눌 줄이 없어요', // [확인 필요]

  // W-01a 이번 달만 바꾸기
  editTitle: (role: string) => `${role}에 이번 달 얼마 넣을까요?`, // [확인 필요]
  editHelp: '이번 달만 바뀌어요. 매달 기본값은 월 수입·지출에서 바꿔요', // [확인 필요]
  editFrom: (role: string, before: string, after: string) => `${role} ${before} → ${after}`,
  editTooMuch: (role: string) => `${role}보다 많이 옮길 수 없어요`, // [확인 필요]
  editSave: '저장', // [확인 필요]
  editShort: '이번 달만 바꾸기',
  editLink: (role: string) => `${role} 이번 달만 바꾸기`,
  adjusted: '이번 달만 바꿨어요',
  undo: '되돌리기',

  // W-07 들어오는 돈
  incomeTitle: '들어오는 돈',
  incomeHelp: '상여금, 연말정산 환급처럼 들어오는 돈만 적어요. 나가는 돈은 매년 목표로 모아요', // [확인 필요]
  incomeAdd: '+ 추가',
  incomeEmpty: '아직 적은 들어오는 돈이 없어요', // [확인 필요]
  incomeMonth: (m: number) => `${m}월`,
  incomeYearly: '매년',
  incomeOnce: '올해만', // [확인 필요]
  incomeDelete: (name: string) => `${name} 지우기`,
  incomeDeleted: '지웠어요', // [확인 필요]
  incomeName: '어떤 돈이에요?', // [확인 필요] 이름
  incomeAmount: '얼마예요?', // [확인 필요] 금액
  incomeWhen: '몇 월에 들어와요?', // [확인 필요] 월
  incomeRepeat: '매년 들어오나요?', // [확인 필요]
  incomeSaved: '들어오는 돈을 적었어요', // [확인 필요]
  next: '다음',

  // W-02a
  otherTitle: '얼마를 옮겼어요?',
  less: (amount: string) => `계획보다 ${amount} 적어요`,
  more: (amount: string) => `계획보다 ${amount} 많아요`,
  confirm: '확인',

  // W-03 생활비 체크
  living: {
    title: '이번 달 생활비, 지금까지 어때요?',
    later: '나중에 할게요',
    answers: { enough: '여유 있어요', just: '딱 맞아요', over: '넘칠 것 같아요' } as Record<
      'enough' | 'just' | 'over',
      string
    >,
    overTitle: '얼마쯤 더 들 것 같아요?',
    coverTitle: '더 드는 돈은 어디서 채울까요?',
    cover: { goal: '목표 배분에서', allowance: '내 용돈에서', next_month: '다음 달에 메울게요' },
    coverGoalSub: '우선순위 낮은 목표부터',
    coverAllowanceSub: (before: string, after: string) => `이번 달 내 용돈 ${before} → ${after}`,
    coverAllowanceNo: (allowance: string) => `내 용돈 ${allowance}보다 많아요`, // [확인 필요]
  },
};
