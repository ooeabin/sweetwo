import type { IncomeKind } from '@sweetwo/api';
import { create } from 'zustand';

// O-35b 고른 다른 수입과 입력 중 금액. 이번 실행에서만(금액은 넘길 때마다 서버에 저장)
export const INCOME_KINDS: IncomeKind[] = ['side_job', 'rent', 'support'];
export const useIncomeDraft = create<{
  picks: IncomeKind[];
  amounts: Partial<Record<IncomeKind, number | null>>;
  setPicks: (p: IncomeKind[]) => void;
  setAmount: (k: IncomeKind, v: number | null) => void;
}>((set, get) => ({
  picks: [],
  amounts: {},
  setPicks: (picks) => set({ picks }),
  setAmount: (k, v) => set({ amounts: { ...get().amounts, [k]: v } }),
}));
