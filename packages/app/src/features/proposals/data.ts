import {
  applyDueProposals,
  fetchCurrentPlan,
  fetchGoals,
  fetchMe,
  fetchPartner,
  fetchProposals,
  fetchSpace,
  qk,
  updatePendingShares,
  type Proposal,
} from '@sweetwo/api';
import { coupleOf, pendingShares, todayKst } from '@sweetwo/core';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

// 제안 데이터. 키는 qk.proposals 하나(목록을 받아 화면이 상태로 거른다).
export const useProposals = () => useQuery({ queryKey: qk.proposals, queryFn: fetchProposals });

/** 내가 받은 열린 제안(오래된 것부터) */
export const openReceived = (list: Proposal[], myId: string | undefined) =>
  list.filter((p) => p.status === 'open' && p.proposer !== myId).reverse();
/** 내가 보낸 열린 제안 */
export const openSent = (list: Proposal[], myId: string | undefined) =>
  list.filter((p) => p.status === 'open' && p.proposer === myId);

/** 값이 바뀐 뒤 다시 읽을 것 */
export async function refreshAfterChange(qc: QueryClient) {
  await Promise.all(
    [qk.proposals, qk.me, qk.partner, qk.space, qk.goals].map((k) =>
      qc.invalidateQueries({ queryKey: k }),
    ),
  );
}

/** 좋아요·적용 뒤 이번 사이클 안 나눈 돈 재계산(08 6-2). 금액과 이미 나눈 줄은 그대로 */
export async function recalcPendingShares() {
  const [me, space, partner, plan] = await Promise.all([
    fetchMe(),
    fetchSpace(),
    fetchPartner(),
    fetchCurrentPlan(todayKst()),
  ]);
  if (!me || !space || !plan) return;
  const c = coupleOf(me, space, partner);
  const shares = pendingShares(plan.lines ?? [], {
    mode: space.split_deferred || !space.split_mode ? 'half' : space.split_mode,
    myRatio: c.myRatio,
    myIncome: c.myIncome ?? 0,
    partnerIncome: c.partnerIncome ?? 0,
    iAmGroom: me.side !== 'bride',
  });
  if (shares.length) await updatePendingShares(plan.id, shares, plan.is_temp);
}

// 적용일이 지난 제안 적용: 매일 작업 대신 앱을 열 때 한 번(이번 실행 동안)
let dueChecked = false;
export function useApplyDue() {
  const qc = useQueryClient();
  useEffect(() => {
    if (dueChecked) return;
    dueChecked = true;
    void applyDueProposals()
      .then(async (n) => {
        if (!n) return;
        await recalcPendingShares();
        await refreshAfterChange(qc);
        await qc.invalidateQueries({ queryKey: qk.currentPlan(todayKst()) });
      })
      .catch(() => {
        dueChecked = false;
      });
  }, [qc]);
}

/** 제안 화면에 필요한 것: 나, 공간, 배우자, 두 사람 기준, 제안 목록, 이번 플랜 */
export function useProposalContext() {
  const me = useQuery({ queryKey: qk.me, queryFn: fetchMe });
  const space = useQuery({ queryKey: qk.space, queryFn: fetchSpace });
  const partner = useQuery({ queryKey: qk.partner, queryFn: fetchPartner });
  const list = useProposals();
  const goals = useQuery({ queryKey: qk.goals, queryFn: fetchGoals });
  const today = todayKst();
  const plan = useQuery({
    queryKey: qk.currentPlan(today),
    queryFn: () => fetchCurrentPlan(today),
  });
  const ready =
    !me.isLoading &&
    !space.isLoading &&
    !partner.isLoading &&
    !list.isLoading &&
    !plan.isLoading &&
    !goals.isLoading;
  const couple = me.data && space.data ? coupleOf(me.data, space.data, partner.data ?? null) : null;
  return {
    ready,
    me: me.data ?? null,
    space: space.data ?? null,
    plan: plan.data ?? null,
    couple,
    list: list.data ?? [],
    goals: goals.data ?? [],
  };
}
