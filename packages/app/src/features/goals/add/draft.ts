import type { Answers, YearMonth } from '@sweetwo/core';
import { create } from 'zustand';

// 목표 추가 중인 값(G-03a~f). 닫았다 다시 열면 이어서(22 G-03a 예외). 기기에만, 저장소가 막혀 있으면 이번 실행에서만.
export interface AddDraft {
  template: string | null;
  answers: Answers;
  deadline: YearMonth | null;
  deadlineEstimated: boolean;
  /** null = 아직 안 고름, 'none' = 없어요, 'assets' = 가진 자산에서 고름, 숫자 = 기타 보유액 */
  held: number | 'none' | 'new' | 'assets' | null;
  /** 가진 자산에서 고른 자산 id */
  assetIds: string[];
  /** 고른 자산 합계(원금 기준, 미리보기용) */
  assetTotal: number;
  owner: 'together' | 'me' | 'partner' | null;
}

const KEY = 'sweetwo.goal-add';
const empty: AddDraft = {
  template: null,
  answers: {},
  deadline: null,
  deadlineEstimated: false,
  held: null,
  assetIds: [],
  assetTotal: 0,
  owner: null,
};
const read = (): AddDraft => {
  try {
    const v = localStorage.getItem(KEY);
    return v ? { ...empty, ...(JSON.parse(v) as Partial<AddDraft>) } : empty;
  } catch {
    return empty;
  }
};
const write = (d: AddDraft) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* 이번 실행에서만 */
  }
};

export const useAddDraft = create<{
  draft: AddDraft;
  set: (patch: Partial<AddDraft>) => void;
  start: (template: string) => void;
  clear: () => void;
}>((set, get) => ({
  draft: read(),
  set: (patch) => {
    const draft = { ...get().draft, ...patch };
    write(draft);
    set({ draft });
  },
  start: (template) => {
    const draft = { ...empty, template };
    write(draft);
    set({ draft });
  },
  clear: () => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* 없음 */
    }
    set({ draft: empty });
  },
}));
