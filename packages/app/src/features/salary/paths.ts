// 월급 탭 경로(20). 월급 탭 = 구간 탭 ‘이번 달’(W-02, 첫 화면) / ‘계획’(W-01, ?view=plan, 2026-11-09)
export const salaryPaths = {
  plan: '/salary?view=plan', // W-01 월급 계획 영수증(옛 /salary/split은 여기로 넘김)
  checklist: '/salary', // W-02
  done: '/salary/done', // W-02 끝
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
