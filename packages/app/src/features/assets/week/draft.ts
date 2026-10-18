import { create } from 'zustand';

// 첫 주 자산·대출 정리(17 O-41~47) 진행 중 값. 이번 실행에서만(넘길 때마다 서버에 저장되므로 닫아도 답은 남음)
export type WeekOwner = 'me' | 'partner' | 'joint';
export interface WeekItem {
  /** 저장된 자산 id(뒤로 와서 고치면 update) */
  id: string | null;
  amount: number | null;
  owner: WeekOwner;
  paidCount: number | null;
  rate: number | null;
  rateEstimated: boolean;
  payment: number | null;
}
export const newItem = (): WeekItem => ({
  id: null,
  amount: null,
  owner: 'me',
  paidCount: null,
  rate: null,
  rateEstimated: false,
  payment: null,
});

interface Side {
  picks: string[];
  items: Record<string, WeekItem>;
}
interface WeekDraft {
  assets: Side;
  loans: Side;
  setPicks: (side: 'assets' | 'loans', picks: string[]) => void;
  setItem: (side: 'assets' | 'loans', key: string, p: Partial<WeekItem>) => void;
  /** 끝나거나 닫으면 돌아갈 곳(합류 P-06에서 열었을 때). 없으면 이번 달 */
  back: string | null;
  setBack: (back: string | null) => void;
}
const emptySide = (): Side => ({ picks: [], items: {} });

export const useWeekDraft = create<WeekDraft>((set, get) => ({
  assets: emptySide(),
  loans: emptySide(),
  back: null,
  setBack: (back) => set({ back }),
  setPicks: (side, picks) => set({ [side]: { ...get()[side], picks } }),
  setItem: (side, key, p) => {
    const cur = get()[side];
    const item = { ...(cur.items[key] ?? newItem()), ...p };
    set({ [side]: { ...cur, items: { ...cur.items, [key]: item } } });
  },
}));
