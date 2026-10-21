import {
  ensureSpace,
  fetchAccounts,
  fetchFixedExpenses,
  fetchGoals,
  fetchMe,
  fetchPartner,
  fetchSpace,
  qk,
  updateMe,
  updateSpace,
  type Account,
  type FixedExpense,
  type Goal,
  type Me,
  type Space,
} from '@sweetwo/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { create } from 'zustand';

// 온보딩 데이터: 서버 값(react-query) + 이 탭에서만 쓰는 값(zustand).
export function useMe() {
  return useQuery({ queryKey: qk.me, queryFn: fetchMe });
}
export function useSpace() {
  return useQuery({
    queryKey: qk.space,
    queryFn: async () => {
      await ensureSpace();
      return fetchSpace();
    },
  });
}
/** 합류한 배우자(합류 전 null). 시작한 사람이 온보딩 중에 배우자가 먼저 합류할 수 있음 */
export function usePartner() {
  return useQuery({ queryKey: qk.partner, queryFn: fetchPartner });
}
export function useGoals() {
  return useQuery({ queryKey: qk.goals, queryFn: fetchGoals });
}

export function useAccounts() {
  return useQuery({ queryKey: qk.accounts, queryFn: fetchAccounts });
}
export function useFixedExpenses() {
  return useQuery({ queryKey: qk.fixedExpenses, queryFn: fetchFixedExpenses });
}

/** 저장 뒤 캐시 새로 고침 */
export function useRefresh() {
  const qc = useQueryClient();
  return {
    me: () => qc.invalidateQueries({ queryKey: qk.me }),
    space: () => qc.invalidateQueries({ queryKey: qk.space }),
    goals: () => qc.invalidateQueries({ queryKey: qk.goals }),
  };
}

export const saveMe = updateMe;
export const saveSpace = updateSpace;

/** O-06 답(서버에 저장하지 않음, 결과 뒤 할 일 ‘배우자 초대하기’는 할 일 단계에서) */
interface Local {
  inviteNow: 'now' | 'later' | null;
  setInviteNow: (v: 'now' | 'later') => void;
}
export const useOnboardingLocal = create<Local>((set) => ({
  inviteNow: null,
  setInviteNow: (v) => set({ inviteNow: v }),
}));

export type { Account, FixedExpense, Goal, Me, Space };
