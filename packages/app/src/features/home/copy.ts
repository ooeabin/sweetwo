// 홈 문구(docs/spec/19-this-month.md). 기획서 “ ” 안 문장 그대로. [확인 필요]는 기획서에 문구가 없거나 확인 중인 것.
export const copy = {
  // H-01 인사
  hiLeft: (name: string, n: number) => `${name}님, 이번 달 월급 체크가 ${n}개 남았어요`, // [확인 필요]
  hiGoal: (name: string, goal: string, pct: number) => `${name}님, ${goal}까지 ${pct}% 왔어요`, // [확인 필요]
  hi: (name: string) => `${name}님, 반가워요`, // [확인 필요] 목표 금액이 없을 때
  // 오늘 띠
  add: '추가',
  check: '월급 체크하기',
  // H-02 목표
  goals: '목표',
  goalAmount: (saved: string, target: string) => `${saved} / ${target}`,
  expected: (ym: string) => `예상 ${ym}`,
  delayed: '지연',
  thisMonthTodo: (amount: string) => `이번 달 ${amount} 넣을 차례예요`,
  thisMonthDone: (amount: string) => `이번 달 ${amount} 넣었어요`,
  setAmount: '금액 정하기',
  moreGoals: '목표 더보기',
  seeGoal: '자세히 보기', // [확인 필요] 1순위 카드 → G-02
  addGoal: '다른 목표 추가하기',
  // H-03 이번 달 월급
  progress: (total: number, done: number) => `${total}개 중 ${done}개 했어요`,
  partnerProgress: (name: string, total: number, done: number) =>
    `${name}님 ${total}개 중 ${done}개`,
  allDone: (label: string) => `${label}을 다 나눴어요`,
  savedThisMonth: (amount: string) => `목표에 ${amount} 모았어요`,
  showLines: '줄 펼치기', // [확인 필요]
  editSplit: '분배표 고치기',
  noSalary: '월급이 생기면 분배표를 만들어 드려요',
  tellSalary: '월급 알려 주기',
  // H-04 우리 자산
  assets: '우리 자산',
  assetsEmpty: '가진 돈을 적으면 순자산을 보여 드려요',
  addAsset: '가진 돈 추가하기',
  // H-05 다가오는 일정
  upcoming: '다가오는 일정',
  noUpcoming: '30일 안에 일정이 없어요', // [확인 필요]
  payday: (who: string) => `${who}님 월급날`, // [확인 필요]
  review: '월말 확인',
  deadline: (goal: string) => `${goal} 기한`, // [확인 필요]
  dday: (n: number) => (n === 0 ? 'D-day' : `D-${n}`), // [확인 필요]
  // H-06 할 일 한 줄
  todoReview: (label: string, n: number) => `${label}에서 체크 안 한 게 ${n}개 있어요`,
  todoInvite: '같이 쓸 사람을 초대해 주세요',
  todoAmount: (goal: string) => `${goal} 목표 금액을 정해 주세요`,
  open: '열기', // [확인 필요] 할 일 이동 버튼
  close: '닫기',
};
