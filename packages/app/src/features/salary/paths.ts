// 월급 탭 경로(20). 월급 탭 첫 화면 = W-02 ‘이번 달 월급 체크’(/salary), W-01 ‘월급 계획 템플릿’은 따로 화면(/salary/plan, 2026-11-18 구간 탭 없앰)
export const salaryPaths = {
  plan: '/salary/plan', // W-01 월급 계획 템플릿(옛 /salary/plan, /salary/split은 여기로 넘김)
  checklist: '/salary', // W-02
  archive: '/salary/archive', // W-21 지난 달 모아보기(2026-11-17)
};

/** W-01 주소: 사람 탭(각자, who), 처음에 열 저금 줄 금액 시트(line = 저금 항목 id) */
export const planPath = (o: { who?: string | null; line?: string | null } = {}) => {
  const q = new URLSearchParams();
  if (o.who) q.set('who', o.who);
  if (o.line) q.set('line', o.line);
  const s = q.toString();
  return `/salary/plan${s ? `?${s}` : ''}`;
};

/** W-01 ‘저축·투자’ 묶음으로 스크롤(옛 W-13 저금 목록 주소 /salary/items의 새 자리, 2026-11-18). from = 분석 entry */
export const savingListPath = (from?: 'checklist' | 'home' | 'split' | 'direct') =>
  `/salary/plan${from ? `?from=${from}` : ''}#saving`;

// 저금 항목(20 W-10~W-12, ADR 0007)
export const savingPaths = {
  list: '/salary/plan#saving', // W-13 저금 목록은 없앰(2026-11-18) → W-01 저축·투자 묶음. 옛 /salary/items는 넘김
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
  moneyInList: '/salary/money-in/list', // W-20b 수입 기록(고치기·지우기, 2026-11-14)
  moneyInEdit: (id: string) => `/salary/money-in?edit=${encodeURIComponent(id)}`, // W-20 고치기
  reconcile: '/salary/reconcile', // W-10c
};
