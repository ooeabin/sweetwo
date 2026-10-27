// 월급 체크리스트 문구(docs/spec/20-salary-plan.md, 홈 19-this-month.md H-03). 기획서 “ ” 안 문장 그대로.
// [확인 필요] 표시는 기획서에 문구가 없어 임시로 둔 것.
export const copy = {
  // W-01 월급 분배표
  splitTitle: '월급 분배표',
  splitHelp: '금액을 눌러 바꿀 수 있어요', // [확인 필요]
  save: '저장',
  saved: '분배표를 바꿨어요',
  undo: '되돌리기',
  splitPending: '연결 해제 대기 중에는 분배표를 고칠 수 없어요', // [확인 필요]
  refill: '추천값으로 다시 채우기',
  refillTitle: '추천값으로 다시 채울까요?', // [확인 필요]
  refillBody: '지금 적은 금액은 추천값으로 바뀌어요', // [확인 필요]
  refillOk: '다시 채우기', // [확인 필요]
  cancel: '취소',
  // W-02 이번 달 월급
  cycleTitle: (label: string) => label,
  period: (start: string, end: string) => `${start} ~ ${end}`,
  progress: (total: number, done: number) => `${total}개 중 ${done}개 했어요`,
  close: '닫기',
  prevMonth: '지난 달 보기', // [확인 필요]
  nextMonth: '다음 달 보기', // [확인 필요]
  partnerChangedSplit: (name: string) =>
    `${name}님이 분배표를 바꿔서 체크 안 한 줄을 다시 계산했어요`,
  allDone: '다 보냈어요',
  savingLine: (goal: string, amount: string) => `${goal}에 ${amount}`,
  spendLine: (name: string, amount: string) => `${name} ${amount}`,
  checkLabel: (name: string) => `${name} 체크`,
  otherAmount: '다른 금액으로 보냈어요',
  checkedBy: (who: string, date: string) => `${who}님이 ${date}에 체크했어요`,
  checkedOn: (date: string) => `${date}에 체크했어요`, // [확인 필요] 내가 체크한 줄
  skipped: '이번 달은 못 했어요',
  editSplit: '분배표 고치기',
  addedToGoal: (goal: string, amount: string) => `${goal}에 ${amount} 더했어요`,
  checked: '체크했어요', // [확인 필요] 쓰는 돈 줄 체크 토스트
  alreadyChecked: (who: string) => `${who}님이 먼저 체크했어요`,
  closed: '지난 달 체크리스트는 고칠 수 없어요', // [확인 필요]
  failed: '잠시 문제가 생겼어요. 다시 시도해 주세요',
  retry: '다시 시도',
  noChecklist: '월급이 생기면 분배표를 만들어 드려요',
  tellSalary: '월급 알려 주기',
  // W-02a 다른 금액
  howMuch: '얼마를 보냈어요?',
  lessThanPlan: (amount: string) => `계획보다 ${amount} 적어요`,
  moreThanPlan: (amount: string) => `계획보다 ${amount} 많아요`, // [확인 필요]
  next: '다음',
  // W-02 끝
  doneTitle: '이번 달 월급을 다 나눴어요', // [확인 필요]
  doneSaved: (amount: string) => `이번 달 목표에 ${amount} 모았어요`,
  partnerProgress: (name: string, total: number, done: number) =>
    `${name}님 ${total}개 중 ${done}개`,
  ok: '확인',
  // W-05 월말 확인
  reviewTitle: (label: string) => `${label}, 빠진 게 있나요?`,
  reviewNone: '빠진 게 없어요', // [확인 필요]
  // 분배표 목록(O-50, W-01 같은 틀), W-02 묶음 이름도 같이 씀
  splitIncome: (amount: string) => `월급 ${amount}`,
  paydayLast: '말일',
  payday: (d: number) => `${d}일`,
  savingGroup: '저금',
  spendGroup: '쓰는 돈',
  lineNames: { fixed: '고정지출', living: '생활비', allowance: '용돈' },
  fixedSub: '월세·관리비·보험·통신·대출 상환처럼 매달 정해진 돈', // [확인 필요]
  livingSub: '식비·장보기처럼 쓰는 대로 나가는 돈', // [확인 필요]
  needPerMonth: (amount: string) => `매달 ${amount}이 필요해요`,
  addLine: '+ 줄 추가',
  addLineTitle: '줄 추가',
  newLineName: '줄 이름', // [확인 필요]
  newLinePlaceholder: '예: 부모님 용돈',
  removeLine: '줄 지우기', // [확인 필요]
  lineAmount: (name: string) => `${name} 금액`,
  tenThousandUnit: '1만 원 단위로 넣어 주세요', // [확인 필요]
  leftover: (amount: string) => `남는 돈 ${amount}`,
  short: (amount: string) => `${amount}이 모자라요`,
  shortHelp: '쓰는 돈이나 저금을 줄여 주세요',
};
