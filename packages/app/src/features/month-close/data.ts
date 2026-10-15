import {
  fetchCurrentPlan,
  fetchGoals,
  fetchMe,
  fetchMonthClose,
  fetchSpace,
  fetchSpendCategories,
  qk,
} from '@sweetwo/api';
import { readPlanSnapshot, todayKst } from '@sweetwo/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';

// 월말 정리 데이터. 키는 이번 달과 같은 qk라 캐시를 같이 쓴다.
export function useCloseData() {
  const today = todayKst();
  const qc = useQueryClient();
  const me = useQuery({ queryKey: qk.me, queryFn: fetchMe });
  const space = useQuery({ queryKey: qk.space, queryFn: fetchSpace });
  const goals = useQuery({ queryKey: qk.goals, queryFn: fetchGoals });
  const plan = useQuery({
    queryKey: qk.currentPlan(today),
    queryFn: () => fetchCurrentPlan(today),
  });
  const cats = useQuery({ queryKey: qk.spendCategories, queryFn: fetchSpendCategories });
  const planId = plan.data?.id;
  const close = useQuery({
    queryKey: qk.monthClose(planId ?? ''),
    queryFn: () => fetchMonthClose(planId ?? ''),
    enabled: !!planId,
  });
  const loading =
    me.isLoading ||
    space.isLoading ||
    goals.isLoading ||
    plan.isLoading ||
    cats.isLoading ||
    close.isLoading;

  const sp = space.data;
  const joined = sp?.couple_state === 'connected';
  const solo = sp?.couple_state === 'solo';
  // 정산 기준 = 월급 플랜과 같게(06 7장). 배우자 수입을 모르면(합류 전) 내 돈만
  const mineOnly = solo || (!joined && !!sp?.partner_income_unknown);
  const myIncome = me.data?.monthly_income ?? 0;
  const snapIncome = readPlanSnapshot(plan.data?.snapshot).income;
  const incomeDefault = mineOnly
    ? myIncome
    : (snapIncome ?? myIncome + (sp?.partner_income_unknown ? 0 : (sp?.partner_income ?? 0)));
  const myAllowance = me.data?.allowance ?? 0;
  const month = plan.data ? Number(plan.data.label_month.slice(5, 7)) : Number(today.slice(5, 7));

  return {
    loading,
    today,
    me: me.data ?? null,
    space: sp ?? null,
    goals: goals.data ?? [],
    plan: plan.data ?? null,
    planId,
    cats: cats.data ?? [],
    close: close.data ?? null,
    joined,
    solo,
    /** 미합류 + 배우자 수입 추정: 추정값으로 셈 / 미합류 + 모름: 내 돈만 */
    basisNote:
      joined || solo
        ? null
        : mineOnly
          ? ('mine' as const)
          : sp?.partner_income_estimated
            ? ('estimated' as const)
            : null, // 배우자 수입을 정확히 넣었으면 문구 없음
    month,
    incomeDefault,
    /** 정산에 넣는 용돈: 내 돈만이면 내 용돈, 아니면 둘(합류 전 배우자 용돈 = 내 용돈 가정) */
    allowance: mineOnly ? myAllowance : myAllowance * 2,
    myAllowance,
    refreshClose: () => qc.invalidateQueries({ queryKey: qk.monthClose(planId ?? '') }),
    refreshCats: () => qc.invalidateQueries({ queryKey: qk.spendCategories }),
  };
}
export type CloseData = ReturnType<typeof useCloseData>;

/** 월말 정리 단계(기본 3단계, 시작·끝 제외). 진행 막대 칸 = 3 */
export const CLOSE_STEPS = ['w-04j', 'w-04k', 'w-04g'] as const;
export const closePath = (step: string) => `/month/close/${step}`;
export const closeProgress = (step: (typeof CLOSE_STEPS)[number]) => ({
  total: CLOSE_STEPS.length,
  now: CLOSE_STEPS.indexOf(step),
});
