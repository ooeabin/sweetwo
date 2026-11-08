// 월급 탭 경로(20). 월급 탭 첫 화면 = W-02
export const salaryPaths = {
  split: '/salary/split', // W-01
  checklist: '/salary', // W-02
  done: '/salary/done', // W-02 끝
  review: '/salary/review', // W-05
};

// 저금 항목(20 W-10~W-12, ADR 0007)
export const savingPaths = {
  add: '/salary/items/new', // W-11a~d
  item: (id: string) => `/salary/items/${id}`, // W-10
  edit: (id: string, field: 'name' | 'amount' | 'deadline') => `/salary/items/${id}/edit/${field}`, // W-10a
  achieved: (id: string) => `/salary/items/${id}/achieved`, // W-12
  after: (id: string) => `/salary/items/${id}/after`, // W-12a
};
