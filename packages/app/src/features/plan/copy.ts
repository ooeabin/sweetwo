// 월급 플랜·월급 나누기 문구(docs/spec/20-salary-plan.md W-01, W-02). 기획서 “ ” 안 문장을 그대로.
// [확인 필요] 표시는 기획서에 문구가 없어 임시로 둔 것.
export const copy = {
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
  incomeMonth: (name: string, amount: string) => `${name} ${amount}이 들어오는 달이에요`,
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

  // W-02a
  otherTitle: '얼마를 옮겼어요?',
  less: (amount: string) => `계획보다 ${amount} 적어요`,
  more: (amount: string) => `계획보다 ${amount} 많아요`,
  confirm: '확인',
};
