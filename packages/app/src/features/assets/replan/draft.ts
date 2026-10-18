import { create } from 'zustand';

// 계획 다시 세우기(23 F-05f·F-07a~c) 진행 중 값. 이번 실행에서만.
export type ReplanKind = 'move' | 'baby' | 'job' | 'goals';
interface Draft {
  /** 기간 수입 변경(F-05f·g) */
  period: { start: string | null; end: string | null; amount: number | null };
  /** 일반(F-07a·b): 고른 바뀜, 바뀐 값 */
  kinds: ReplanKind[];
  income: number | null;
  fixed: number | null;
  living: number | null;
  set: (p: Partial<Omit<Draft, 'set' | 'reset'>>) => void;
  reset: () => void;
}
const empty = {
  period: { start: null, end: null, amount: null },
  kinds: [] as ReplanKind[],
  income: null,
  fixed: null,
  living: null,
};
export const useReplan = create<Draft>((set) => ({
  ...empty,
  set: (p) => set(p),
  reset: () => set(empty),
}));

export const replanPath = {
  period: (step: 'start' | 'end' | 'amount') => `/assets/money/period/${step}`,
  start: '/assets/replan',
  question: (k: 'income' | 'fixed' | 'living') => `/assets/replan/q/${k}`,
  compare: (mode: 'period' | 'general') => `/assets/replan/compare/${mode}`,
};
