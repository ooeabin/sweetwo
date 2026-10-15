import type { AssetSide } from '@sweetwo/core';
import { create } from 'zustand';

// 항목 추가 중인 값(F-03a~e). 이번 실행에서만
export interface AssetDraft {
  side: AssetSide;
  grp: string | null;
  kind: string | null;
  name: string | null;
  amount: number | null;
  owner: 'me' | 'partner' | 'joint' | null;
  visibility: 'all' | 'sum' | 'private';
}
const empty: AssetDraft = {
  side: 'asset',
  grp: null,
  kind: null,
  name: null,
  amount: null,
  owner: null,
  visibility: 'sum', // 기본 = 합계만 공개
};

export const useAssetDraft = create<{
  draft: AssetDraft;
  set: (p: Partial<AssetDraft>) => void;
  reset: (side: AssetSide) => void;
}>((set, get) => ({
  draft: empty,
  set: (p) => set({ draft: { ...get().draft, ...p } }),
  reset: (side) => set({ draft: { ...empty, side } }),
}));

/** 화면 순서: 유형 → 이름 → 금액 → 명의(혼자 쓰기면 없음) → 공개 범위(내 명의만, 혼자 쓰기면 없음) */
export function assetSteps(d: AssetDraft, solo: boolean) {
  return [
    'kind',
    'name',
    'amount',
    ...(solo ? [] : ['owner']),
    ...(!solo && d.owner === 'me' ? ['visibility'] : []),
  ];
}
