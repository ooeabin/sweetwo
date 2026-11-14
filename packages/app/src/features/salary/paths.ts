// 월급 탭 경로(20). 월급 탭 = 구간 탭 ‘이번 달’(W-02, 첫 화면) / ‘계획’(W-01, ?view=plan, 2026-11-09)
export const salaryPaths = {
  plan: '/salary?view=plan', // W-01 월급 계획 영수증(옛 /salary/split은 여기로 넘김)
  checklist: '/salary', // W-02
  review: '/salary/review', // W-05
};

/** W-01 주소: 사람 탭(각자, who), 처음에 열 저금 줄 금액 시트(line = 저금 항목 id) */
export const planPath = (o: { who?: string | null; line?: string | null } = {}) => {
  const q = new URLSearchParams({ view: 'plan' });
  if (o.who) q.set('who', o.who);
  if (o.line) q.set('line', o.line);
  return `/salary?${q.toString()}`;
};

// 저금 항목(20 W-10~W-12, ADR 0007)
export const savingPaths = {
  list: '/salary/items', // W-13 저금 목록(2026-11-09 round 3)
  add: '/salary/items/new', // W-11a~d
  item: (id: string) => `/salary/items/${id}`, // W-10
  edit: (id: string, field: 'name' | 'amount' | 'deadline' | 'monthly') =>
    `/salary/items/${id}/edit/${field}`, // W-10a(monthly = 매달 금액, 2026-11-09 round 3)
  achieved: (id: string) => `/salary/items/${id}/achieved`, // W-12
  after: (id: string) => `/salary/items/${id}/after`, // W-12a
};

// v2.2 같이 모으기와 돈 기록(20 ‘월급 탭 v2.2’, PR 10). 서버 알림 링크와 core pickTopTask가 같은 주소를 씀
export const togetherPaths = {
  adjust: (id: string) => `/salary/items/${id}/adjust`, // W-10b
  next: (id: string) => `/salary/items/${id}/next`, // W-12b
  notes: (id: string) => `/salary/items/${id}/notes`, // W-14(저금)
  note: (id: string, note: string) => `/salary/items/${id}/notes/${note}`, // W-14a(note = 'new' 또는 메모 id)
  bundleNew: (goal?: string) =>
    `/salary/bundles/new${goal ? `?goal=${encodeURIComponent(goal)}` : ''}`, // W-15
  bundle: (id: string) => `/salary/bundles/${id}`, // 알림 링크: 들어가기(W-15 2~4단계) 또는 내 저금 W-10
  bundleJoin: (id: string) => `/salary/bundles/${id}/join`, // W-15 들어가기
  bundleEdit: (id: string) => `/salary/bundles/${id}/edit`, // W-15a
  bundleField: (id: string, field: 'name' | 'target' | 'deadline') =>
    `/salary/bundles/${id}/edit/${field}`,
  bundleNotes: (id: string) => `/salary/bundles/${id}/notes`, // W-14(묶음)
  bundleNote: (id: string, note: string) => `/salary/bundles/${id}/notes/${note}`,
  bundleAchieved: (id: string) => `/salary/bundles/${id}/achieved`, // W-12(묶음, 합계 기준)
  moneyIn: '/salary/money-in', // W-20
  distribute: (id: string) => `/salary/money-in/${id}`, // W-20a
  moneyInList: '/salary/money-in/list', // W-20b 들어온 돈 기록(고치기·지우기, 2026-11-14)
  moneyInEdit: (id: string) => `/salary/money-in?edit=${encodeURIComponent(id)}`, // W-20 고치기
  reconcile: '/salary/reconcile', // W-10c
};
