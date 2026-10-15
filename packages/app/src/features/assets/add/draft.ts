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
  /** F-03f~i 유형별 질문(나중에 해도 됨) */
  maturity: string | null;
  payment: number | null;
  payFrom: 'goal_fund' | 'personal' | null;
  paidCount: number | null;
  rate: number | null;
  goalId: string | null;
}
const empty: AssetDraft = {
  side: 'asset',
  grp: null,
  kind: null,
  name: null,
  amount: null,
  owner: null,
  visibility: 'sum', // 기본 = 합계만 공개
  maturity: null,
  payment: null,
  payFrom: null,
  paidCount: null,
  rate: null,
  goalId: null,
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

const SAVINGS = ['saving', 'policy_saving'];

/**
 * 화면 순서: 유형 → 이름 → 금액 → 명의(혼자 쓰기면 없음) → 공개 범위(내 명의만) → 유형별(F-03f~i):
 * 적금 = 만기일 → 월 납입액 → 빠지는 통장, 청약 = 납입 회차 → 월 납입액 → 빠지는 통장, 보증금 = 계약 만기일,
 * 부채 = 금리 → 월 상환액, 자산 = 목표 연결(진행 중 목표가 있을 때)
 */
export function assetSteps(d: AssetDraft, solo: boolean, hasGoals = false) {
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
    ...((saving || sub) && (d.payment ?? 0) > 0 ? ['payfrom'] : []),
    ...(d.side === 'asset' && hasGoals ? ['goal'] : []),
  ];
}
