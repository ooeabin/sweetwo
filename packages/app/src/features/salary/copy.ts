// 월급 탭 문구(docs/spec/20-salary-plan.md 체크리스트·저금 항목 W-10~W-12, 홈 19-this-month.md H-03). 기획서 “ ” 안 문장 그대로.
// [확인 필요] 표시는 기획서에 문구가 없어 임시로 둔 것.
export const copy = {
  // W-01 월급 계획
  splitTitle: '월급 계획',
  splitHelp: '눌러서 금액을 바꿔요', // [확인 필요]
  save: '저장',
  saved: '월급 계획을 바꿨어요',
  undo: '되돌리기',
  splitPending: '연결 해제 대기 중에는 월급 계획을 고칠 수 없어요', // [확인 필요]
  // 각자 모드 파트너 것은 보기만(2026-11-09) [확인 필요]
  partnerSplitView: (name: string) => `${name}님 월급 계획이에요. 보기만 할 수 있어요`,
  partnerChecklistView: (name: string) => `${name}님 체크리스트예요. 보기만 할 수 있어요`,
  refill: '추천값으로 다시 채우기',
  refillTitle: '추천값으로 다시 채울까요?', // [확인 필요]
  refillBody: '지금 적은 금액은 추천값으로 바뀌어요', // [확인 필요]
  refillOk: '다시 채우기', // [확인 필요]
  cancel: '취소',
  // W-02 이번 달 월급
  cycleTitle: (label: string) => label,
  period: (start: string, end: string) => `${start} ~ ${end}`,
  progress: (total: number, done: number) => `${total}개 중 ${done}개 완료`,
  close: '닫기',
  prevMonth: '지난 달 보기', // [확인 필요]
  nextMonth: '다음 달 보기', // [확인 필요]
  partnerChangedSplit: (name: string) =>
    `${name}님이 월급 계획을 바꿔서 체크 안 한 줄을 다시 계산했어요`,
  allDone: '다 보냈어요',
  savingLine: (goal: string, amount: string) => `${goal}에 ${amount}`,
  spendLine: (name: string, amount: string) => `${name} ${amount}`,
  checkLabel: (name: string) => `${name} 체크`,
  viewLabel: (name: string, done: boolean) =>
    `${name} ${done ? '체크했어요' : '아직 체크 안 했어요'}`, // [확인 필요] 화면 읽기용(파트너 줄)
  otherAmount: '다른 금액으로 보냈어요',
  // 줄을 누르면 여는 시트(2026-11-03) [확인 필요]
  lineSheet: (name: string, amount: string) => `${name} ${amount}`,
  sent: '보냈어요',
  // 체크한 사람·때(2026-11-03): 파트너가 체크했으면 이름 칩 + “08.26 체크”, 내가 체크했으면 날짜만
  checkedAt: (date: string) => `${date} 체크`, // [확인 필요]
  // W-05 ‘이번 달은 못 했어요’ 뒤 Toast(2026-11-03)
  skippedDone: (name: string) => `${name}, 이번 달은 못 한 걸로 했어요`, // [확인 필요]
  skipped: '이번 달은 못 했어요',
  editSplit: '월급 계획 고치기',
  // W-02 묶음 ‘모두 보냈어요’(2026-11-09 round 3) [확인 필요]
  groupAllSent: '모두 보냈어요',
  groupAllSentLabel: (group: string) => `${group} 모두 보냈어요`,
  groupSavingDone: (n: number, amount: string) => `저금 ${n}개에 ${amount} 더했어요`,
  groupSpendDone: (n: number) => `지출 ${n}개를 체크했어요`,
  // 토스트는 한 줄(Toast.md): 저금 항목 이름이 길면 8자 + … 로 줄여 금액이 잘리지 않게
  addedToGoal: (goal: string, amount: string) =>
    `${[...goal].length > 8 ? `${[...goal].slice(0, 8).join('')}…` : goal}에 ${amount} 더했어요`,
  checked: '체크했어요', // [확인 필요] 지출 줄 체크 토스트
  alreadyChecked: (who: string) => `${who}님이 먼저 체크했어요`,
  closed: '지난 달 체크리스트는 고칠 수 없어요', // [확인 필요]
  failed: '잠시 문제가 생겼어요. 다시 시도해 주세요',
  retry: '다시 시도',
  noChecklist: '월급이 생기면 월급 계획을 만들어 드려요',
  tellSalary: '월급 알려 주기',
  // W-02a 다른 금액
  howMuch: '얼마를 보냈어요?',
  howMuchFor: (line: string) => `${line}, 얼마를 보냈어요?`, // [확인 필요] 2026-11-09
  planned: (amount: string) => `계획 ${amount}`, // [확인 필요] 2026-11-09
  lessThanPlan: (amount: string) => `계획보다 ${amount} 적어요`,
  moreThanPlan: (amount: string) => `계획보다 ${amount} 많아요`, // [확인 필요]
  next: '다음',
  // W-02 끝
  doneTitle: '이번 달 월급 체크를 다 했어요', // [확인 필요] 2026-11-03 ‘나눴어요’ 대신
  doneSaved: (amount: string) => `이번 달 저금 ${amount}을 보냈어요`, // [확인 필요] 2026-11-08
  partnerProgress: (name: string, total: number, done: number) =>
    `${name}님 ${total}개 중 ${done}개`,
  ok: '확인',
  // W-05 월급 전 확인
  reviewTitle: (label: string) => `${label}, 빠진 게 있나요?`,
  reviewNone: '빠진 게 없어요', // [확인 필요]
  // 월급 계획 목록(O-50, W-01 같은 틀), W-02 묶음 이름도 같이 씀
  splitIncome: (amount: string) => `월급 ${amount}`,
  paydayLast: '말일',
  payday: (d: number) => `${d}일`,
  savingGroup: '저금',
  spendGroup: '지출',
  lineNames: { fixed: '고정지출', living: '생활비', allowance: '용돈' },
  fixedSub: '월세·관리비·보험·통신·대출 상환처럼 매달 정해진 돈', // [확인 필요]
  livingSub: '식비·장보기처럼 그때그때 쓰는 지출', // [확인 필요]
  needPerMonth: (amount: string) => `매달 ${amount}이 필요해요`,
  // 월 필요액 > 매달 금액(2026-11-09, W-10 3번, W-11d 보조) [확인 필요]
  lateBy: (n: number) => `지금대로면 기한보다 ${n}개월 늦어요`,
  changeMonthly: '매달 금액 바꾸기', // [확인 필요]
  changeDeadline: '기한 바꾸기', // [확인 필요]
  addLine: '+ 줄 추가',
  addLineTitle: '줄 추가',
  newLineName: '줄 이름', // [확인 필요]
  newLinePlaceholder: '예: 부모님 용돈',
  removeLine: '줄 지우기', // [확인 필요]
  lineAmount: (name: string) => `${name} 금액`,
  tenThousandUnit: '1만 원 단위로 넣어 주세요', // [확인 필요]
  leftover: (amount: string) => `여유 자금 ${amount}`,
  short: (amount: string) => `${amount}이 모자라요`,
  shortHelp: '지출이나 저금을 줄여 주세요',
  // 월급 탭(2026-11-08 ADR 0007)
  tabTitle: '월급',
  addItem: '+ 저금 추가', // [확인 필요] 2026-11-09 사용자에게는 ‘저금’
  // 첫 저금 빈 줄(2026-11-09, 내 저금이 없을 때) [확인 필요]. ListRow + 아이콘이 글자 앞 ‘+’를 대신
  firstSaving: (left: string) => `저금 추가 (여유 자금 ${left})`,
  firstSavingLike: (partner: string) => `${partner}님처럼 나도 모을 곳을 만들어 볼까요?`,
  firstSavingLeft: (left: string) => `여유 자금 ${left}`,
  seeItem: '저금 보기', // [확인 필요] 저금 줄 시트·금액 입력 아래(2026-11-09 ‘저금 항목’ 대신)
  itemProgress: (saved: string, target: string) => `${saved} / ${target}`,
  closedFold: (n: number) => `그만 모은 저금 ${n}개`, // [확인 필요]
  // W-13 저금 목록(2026-11-09 round 3) [확인 필요]
  listTitle: '저금',
  listOpen: '저금 목록 보기', // 저금 묶음 머리(누르는 제목) 화면 읽기 이름
  listSaved: (amount: string) => `모은 금액 ${amount}`,
  listEmpty: '아직 저금이 없어요',
  listAdd: '저금 추가',
  // W-10 저금 항목 상세
  back: '뒤로',
  thisMonth: '이번 달', // [확인 필요] 매달 카드의 이번 달 줄
  savedLabel: '모은 금액',
  targetOf: (target: string, pct: number) => `목표 ${target}의 ${pct}%`, // [확인 필요]
  edit: '고치기',
  until: (ym: string) => `${ym}까지`,
  setDeadline: '기한 정하기', // [확인 필요]
  noTarget: '목표 금액을 정하면 얼마나 모았는지 보여 드려요', // [확인 필요]
  setTarget: '목표 금액 정하기', // [확인 필요]
  reachedAll: (target: string) => `${target}을 다 모았어요`, // [확인 필요]
  achieved: '달성',
  monthlyOf: (amount: string) => `매달 ${amount}씩`,
  change: '바꾸기',
  expected: (ym: string) => `예상 ${ym}`, // [확인 필요]
  history: '저금 내역', // [확인 필요]
  historyChecked: (label: string, amount: string) => `${label} ${amount}`,
  historyOther: (label: string, amount: string) => `${label} 다른 금액 ${amount}`,
  historySkipped: (label: string) => `${label} 못 함`,
  historyStart: (amount: string) => `시작할 때 모은 금액 ${amount}`, // [확인 필요] 2026-11-09
  noHistory: '아직 기록이 없어요', // [확인 필요]
  more: '더보기',
  info: '정보',
  createdOn: (date: string) => `${date}에 만들었어요`, // [확인 필요]
  createdBy: (name: string) => `만든 사람 ${name}`, // [확인 필요]
  closedNote: '그만 모은 저금이에요', // [확인 필요]
  partnerItem: (name: string) => `${name}님 저금이에요. 보기만 할 수 있어요`, // [확인 필요] 2026-11-09
  menu: '더보기',
  rename: '이름 바꾸기',
  remove: '지우기',
  removed: '휴지통으로 옮겼어요',
  loadFailed: '잠시 문제가 생겼어요. 다시 시도해 주세요',
  // W-10a 고치기
  saveEdit: '저장',
  amountChanged: '목표 금액을 바꿨어요', // [확인 필요]
  deadlineChanged: '기한을 바꿨어요',
  nameChanged: '이름을 바꿨어요', // [확인 필요]
  targetCleared: '목표 금액을 지웠어요', // [확인 필요]
  deadlineCleared: '기한을 지웠어요', // [확인 필요]
  clearTarget: '목표 금액 지우기', // [확인 필요]
  clearDeadline: '기한 지우기', // [확인 필요]
  // W-10a 매달 금액·새 목표 금액(2026-11-09 round 3) [확인 필요]
  monthlyChanged: '매달 금액을 바꿨어요',
  retargetQ: '새 목표 금액은 얼마예요?',
  retargetHelp: (saved: string) => `지금 모은 금액 ${saved}`,
  retargetLow: '지금 모은 금액보다 크게 넣어 주세요',
  notBeforeThisMonth: '이번 달부터 고를 수 있어요', // [확인 필요]
  nameRequired: '이름을 넣어 주세요',
  saveFailed: '저장하지 못했어요',
  conflictQ: '어느 쪽으로 할까요?',
  conflictBody: (partner: string) => `${partner}님이 방금 이 값을 바꿨어요`,
  conflictMine: '내 값',
  conflictTheirs: (partner: string) => `${partner}님 값`,
  // W-11 저금 항목 추가
  addNameQ: '무엇을 위해 모을까요?', // [확인 필요]
  addNameHelp: '월급 계획 저금 묶음에 한 줄로 생겨요', // [확인 필요]
  addNamePlaceholder: '예: 여행, 적금', // [확인 필요]
  addMonthlyQ: '매달 얼마씩 모을까요?', // [확인 필요]
  addMonthlyHelp: (left: string) => `지금 여유 자금 ${left}`, // [확인 필요]
  addTargetQ: '모으고 싶은 목표 금액이 있나요?', // [확인 필요]
  addTargetHelp: '정하면 얼마나 모았는지 보여 드려요', // [확인 필요]
  addNoTarget: '목표 금액 없이 모을게요', // [확인 필요]
  // W-11c 선택 칸(2026-11-09, 만들 때만) [확인 필요]
  addHasStart: '이미 모은 금액이 있어요',
  addStart: '이미 모은 금액',
  addStartOver: '목표 금액보다 적게 넣어 주세요',
  addDeadlineQ: '언제까지 모을까요?',
  addNoDeadline: '기한 없이 모을게요', // [확인 필요]
  addDone: '추가하기', // [확인 필요]
  added: '저금을 추가했어요', // [확인 필요]
  addShort: '여유 자금이 모자라요. 지출이나 저금을 줄여 주세요', // [확인 필요]
  addBlocked: '연결 해제 대기 중에는 저금을 추가할 수 없어요', // [확인 필요]
  addNoSplit: '월급이 생기면 저금을 추가할 수 있어요', // [확인 필요]
  // W-12 달성 축하, W-12a
  achievedEyebrow: '다 모았어요', // [확인 필요] 2026-11-09 ‘목표 달성’ 대신
  storyAll: (n: number) => `${n}개월 동안 매달 둘이 함께 모았어요`,
  storySome: (n: number, m: number) => `${n}개월 중 ${m}번은 둘이 함께 모았어요`,
  storySolo: (n: number) => `${n}개월 만에 모았어요`,
  afterQ: '이 저금을 어떻게 할까요?', // [확인 필요]
  afterKeep: '계속 모을게요', // [확인 필요]
  afterStop: '그만할게요', // [확인 필요]
  // W-12a 선택지 보조 한 줄, 셋째 선택지(2026-11-09 round 3) [확인 필요]
  afterKeepSub: '목표 금액만 지우고 지금처럼 모아요',
  afterStopSub: '월급 계획에서 빠지고 저금 내역은 남아요',
  afterRetarget: '목표 금액을 새로 정할게요',
  afterRetargetSub: '모은 금액은 그대로 두고 더 큰 목표로 이어서 모아요',
  keptToast: '목표 금액을 지우고 계속 모아요', // [확인 필요]
  stoppedToast: '그만 모으기로 했어요', // [확인 필요]
};
