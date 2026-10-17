import {
  fetchCurrentPlan,
  fetchGoals,
  fetchLivingCheck,
  fetchMe,
  fetchMonthClose,
  fetchPartner,
  fetchProposals,
  fetchSpace,
  fetchSpendCategories,
  qk,
} from '@sweetwo/api';
import { coupleOf, readPlanSnapshot, todayKst } from '@sweetwo/core';
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
  const partner = useQuery({ queryKey: qk.partner, queryFn: fetchPartner });
  const cats = useQuery({ queryKey: qk.spendCategories, queryFn: fetchSpendCategories });
  const planId = plan.data?.id;
  const close = useQuery({
    queryKey: qk.monthClose(planId ?? ''),
    queryFn: () => fetchMonthClose(planId ?? ''),
    enabled: !!planId,
  });
  // 생활비 체크 ‘내 용돈에서’(W-03c)는 이번 달 그 사람 용돈에서 뺌(즉시 적용)
  const living = useQuery({
    queryKey: qk.livingCheck(planId ?? ''),
    queryFn: () => fetchLivingCheck(planId ?? ''),
    enabled: !!planId && !!space.data?.living_check,
  });
  const proposals = useQuery({ queryKey: qk.proposals, queryFn: fetchProposals });
  const loading =
    proposals.isLoading ||
    me.isLoading ||
    space.isLoading ||
    goals.isLoading ||
    plan.isLoading ||
    cats.isLoading ||
    close.isLoading;

  const sp = space.data;
  const c = me.data && sp ? coupleOf(me.data, sp, partner.data ?? null) : null;
  const joined = !!c?.joined;
  const solo = !!c?.solo;
  // 정산 기준 = 월급 플랜과 같게(06 7장). 배우자 수입을 모르면(합류 전) 내 돈만
  const mineOnly = solo || (!joined && !!c?.partnerUnknown);
  const myIncome = c?.myIncome ?? 0;
  const snapIncome = readPlanSnapshot(plan.data?.snapshot).income;
  const incomeDefault = mineOnly
    ? myIncome
    : joined
      ? myIncome + (c?.partnerIncome ?? 0)
      : (snapIncome ?? myIncome + (c?.partnerIncome ?? 0));
  const cut = living.data?.allowanceCut ?? 0;
  const cutMine = !!cut && (living.data?.allowanceSide ?? me.data?.side) === me.data?.side;
  const baseAllowance = me.data?.allowance ?? 0;
  const myAllowance = Math.max(0, baseAllowance - (cutMine ? cut : 0));
  const partnerAllowance = Math.max(
    0,
    (c?.partnerAllowance ?? baseAllowance) - (cut && !cutMine ? cut : 0),
  );
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
    /** 부부 값(coupleOf) */
    couple: c,
    proposals: proposals.data ?? [],
    /** W-04h 다음 달 조정이 나오는지: 연결된 부부(해제 대기 아님)에게 받은 제안, 보류 제안, 함께 정하기가 있을 때 */
    adjust:
      joined &&
      !solo &&
      sp?.couple_state === 'connected' &&
      (proposals.data ?? []).some(
        (p) =>
          ((p.status === 'open' || p.status === 'held') && p.proposer !== me.data?.id) ||
          (p.status === 'open' && p.together),
      ),
    /** 미합류 + 배우자 수입 추정: 추정값으로 셈 / 미합류 + 모름: 내 돈만 */
    basisNote:
      joined || solo
        ? null
        : mineOnly
          ? ('mine' as const)
          : c?.partnerEstimated
            ? ('estimated' as const)
            : null, // 배우자 수입을 정확히 넣었으면 문구 없음
    month,
    incomeDefault,
    /** 정산에 넣는 용돈: 내 돈만이면 내 용돈, 아니면 둘(합류 전 배우자 용돈 = 내 용돈 가정) */
    allowance: mineOnly ? myAllowance : myAllowance + partnerAllowance,
    partnerAllowance,
    partnerName: c?.partnerName ?? '',
    myAllowance,
    // 정리 상태와 납입이 바뀌면 목표 기록(보유액)도 다시 읽음
    refreshClose: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: qk.monthClose(planId ?? '') }),
        qc.invalidateQueries({ queryKey: qk.goalRecords }),
        qc.invalidateQueries({ queryKey: qk.recentCloses }),
      ]),
    refreshCats: () => qc.invalidateQueries({ queryKey: qk.spendCategories }),
  };
}
export type CloseData = ReturnType<typeof useCloseData>;

/** 월말 정리 단계(기본 3단계 + 조건 W-04h, 시작·끝 제외). 진행 막대 칸 = 이번 정리에 나오는 단계 수 */
export const CLOSE_STEPS = ['w-04j', 'w-04k', 'w-04h', 'w-04g'] as const;
export const closePath = (step: string) => `/month/close/${step}`;
export const closeProgress = (step: (typeof CLOSE_STEPS)[number], adjust = false) => {
  const steps = CLOSE_STEPS.filter((s) => adjust || s !== 'w-04h');
  return { total: steps.length, now: steps.indexOf(step as never) };
};
