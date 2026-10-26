import type { AssetSide } from '@sweetwo/core';
import { create } from 'zustand';

// 항목 추가 중인 값(F-03a~e). 이번 실행에서만
export interface AssetDraft {
  side: AssetSide;
  grp: string | null;
  kind: string | null;
  name: string | null;
  amount: number | null;
  /** ‘잘 모르겠어요’ 구간 중간값으로 정함(F-03 6번) */
  estimated: boolean;
  owner: 'me' | 'partner' | 'joint' | null;
  visibility: 'all' | 'sum' | 'private';
  /** F-03f~i 유형별 질문(나중에 해도 됨) */
  maturity: string | null;
  payment: number | null;
  paidCount: number | null;
  rate: number | null;
}
const empty: AssetDraft = {
  side: 'asset',
  grp: null,
  kind: null,
  name: null,
  amount: null,
  estimated: false,
  owner: null,
  visibility: 'sum', // 기본 = 금액만 보여 주기
  maturity: null,
  payment: null,
  paidCount: null,
  rate: null,
};

export const useAssetDraft = create<{
  draft: AssetDraft;
  set: (p: Partial<AssetDraft>) => void;
  /** visibility = 내 새 항목 기본값(S-13, 없으면 합계만) */
  reset: (side: AssetSide, visibility?: AssetDraft['visibility']) => void;
}>((set, get) => ({
  draft: empty,
  set: (p) => set({ draft: { ...get().draft, ...p } }),
  reset: (side, visibility = 'sum') => set({ draft: { ...empty, side, visibility } }),
}));

const SAVINGS = ['saving', 'policy_saving'];

/**
 * 화면 순서: 유형 → 이름 → 금액 → 명의(혼자 쓰기면 없음) → 공개 범위(내 명의만) → 유형별(F-03f~i):
 * 적금 = 만기일 → 월 납입액, 청약 = 납입 회차 → 월 납입액, 보증금 = 계약 만기일, 부채 = 금리 → 월 상환액.
 * 월 납입액·상환액은 기록만(분배표와 연결하지 않음). 통장 역할, 목표 연결은 재기획으로 없앰
 */
export function assetSteps(d: AssetDraft, solo: boolean) {
  const k = d.kind ?? '';
  const saving = SAVINGS.includes(k);
  const sub = k === 'housing_subscription';
  return [
    'kind',
    'name',
    'amount',
    ...(solo ? [] : ['owner']),
    ...(!solo && d.owner === 'me' ? ['visibility'] : []),
    ...(saving || k === 'deposit_money' ? ['maturity'] : []),
    ...(sub ? ['count'] : []),
    ...(d.side === 'debt' ? ['rate'] : []),
    ...(saving || sub || d.side === 'debt' ? ['payment'] : []),
  ];
}
