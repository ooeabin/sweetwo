import {
  fetchAccounts,
  fetchAssets,
  fetchCloseBalances,
  fetchCycleGoalUses,
  fetchRecentCloses,
  qk,
} from '@sweetwo/api';
import {
  emergencyDecreased,
  expectedBalance,
  goalGapAmount,
  type BalanceRole,
  type CloseLine,
} from '@sweetwo/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCloseData } from './data';

const ROLES: BalanceRole[] = ['living', 'goal_fund', 'emergency', 'wedding'];
/** 꼼꼼 모드 단계(21 W-04b~f·i). 조건 단계는 해당 없으면 빠짐 */
export type DetailStep = 'w-04b' | 'w-04c' | 'w-04d' | 'w-04e' | 'w-04f' | 'w-04i';
const ORDER: DetailStep[] = ['w-04b', 'w-04c', 'w-04d', 'w-04e', 'w-04f', 'w-04i'];

// 꼼꼼 모드 데이터: 공동 통장마다 예상 잔액(지난 정리 잔액, 첫 정리는 O-63 잔액 + 이번 나누기)과
// 이번에 넣은 잔액, 이번 사이클 목표 사용 기록, 투자·대출 자산. 계산은 core rules/close-detail.ts
export function useDetailData() {
  const d = useCloseData();
  const qc = useQueryClient();
  const accounts = useQuery({ queryKey: qk.accounts, queryFn: fetchAccounts });
  const balances = useQuery({ queryKey: qk.closeBalances, queryFn: fetchCloseBalances });
  const closes = useQuery({ queryKey: qk.recentClosesLong, queryFn: () => fetchRecentCloses(12) });
  const assets = useQuery({ queryKey: qk.assets, queryFn: fetchAssets });
  const start = d.plan?.cycle_start ?? '';
  const end = d.plan?.cycle_end ?? '';
  const uses = useQuery({
    queryKey: qk.cycleGoalUses(start, end),
    queryFn: () => fetchCycleGoalUses(start, end),
    enabled: !!start,
  });
  const loading =
    d.loading ||
    accounts.isLoading ||
    balances.isLoading ||
    closes.isLoading ||
    assets.isLoading ||
    uses.isLoading;

  const closeId = d.close?.id ?? null;
  const engaged = d.space?.marriage_status === 'engaged';
  const lines: CloseLine[] = (d.plan?.lines ?? []).map((l) => ({
    target: l.target,
    account_role: l.account_role,
    kind: l.kind,
    amount: l.amount,
    state: l.state,
    done_amount: l.done_amount,
  }));
  // 지난 정리(끝낸 것, 최근 순) 중 그 통장 잔액이 있는 가장 최근 값
  const doneOrder = (closes.data ?? []).filter((c) => c.id !== closeId).map((c) => c.id);
  const lastBalance = (accountId: string) => {
    for (const id of doneOrder) {
      const b = (balances.data ?? []).find(
        (x) => x.month_close_id === id && x.account_id === accountId,
      );
      if (b) return b.amount;
    }
    return null;
  };
  const rows = (accounts.data ?? [])
    .filter((a) => ROLES.includes(a.role as BalanceRole))
    .filter((a) => (engaged ? a.role === 'wedding' : a.role !== 'wedding'))
    .map((a) => {
      const role = a.role as BalanceRole;
      const base = lastBalance(a.id) ?? a.start_balance;
      const mine = (balances.data ?? []).find(
        (x) => x.month_close_id === closeId && x.account_id === a.id,
      );
      return {
        id: a.id,
        role,
        name: a.name,
        assetId: a.asset_id,
        expected: expectedBalance(role, base, lines),
        amount: mine?.amount ?? null,
      };
    });
  const byRole = (r: BalanceRole) => rows.find((x) => x.role === r);

  // W-04c: 이번 사이클 기록(이 정리의 차액 답은 빼고), 목표자금(예비부부는 결혼 준비) 통장 차액
  const records = (uses.data ?? []).filter((u) => u.closeId !== closeId);
  const fundRole: BalanceRole = engaged ? 'wedding' : 'goal_fund';
  const fund = byRole(fundRole);
  const fundPaid = engaged ? 'wedding_account' : 'goal_fund';
  const gap = goalGapAmount(
    fund?.expected ?? null,
    fund?.amount ?? null,
    records.filter((u) => u.paidFrom === fundPaid).reduce((t, u) => t + u.amount, 0),
  );
  const em = byRole('emergency');
  const invest = (assets.data ?? []).filter(
    (a) => a.side === 'asset' && a.grp === 'invest' && a.status === 'held' && !a.deleted_at,
  );
  const loans = (assets.data ?? []).filter(
    (a) => a.side === 'debt' && !!a.monthly_payment && a.status === 'held' && !a.deleted_at,
  );

  const steps: DetailStep[] = [
    ...(rows.length ? (['w-04b'] as const) : []),
    ...(records.length || gap > 0 ? (['w-04c'] as const) : []),
    ...(em && emergencyDecreased(em.expected, em.amount) ? (['w-04d'] as const) : []),
    ...(invest.length ? (['w-04e'] as const) : []),
    ...(loans.length ? (['w-04f'] as const) : []),
    'w-04i' as const,
  ];
  /** 다음 단계: 순서대로 다음(조건이 안 맞는 단계는 그 화면이 바로 넘김), 마지막이면 정산 요약 */
  const nextOf = (s: DetailStep) => ORDER[ORDER.indexOf(s) + 1] ?? 'w-04g';
  /** 이전 단계: 지금 보이는 단계 중 앞, 없으면 정산 요약 */
  const prevOf = (s: DetailStep) => {
    const before = steps.filter((x) => ORDER.indexOf(x) < ORDER.indexOf(s));
    return before[before.length - 1] ?? 'w-04g';
  };
  /** 이 단계가 이번 정리에 없으면 다음으로 */
  const skip = (s: DetailStep) => !steps.includes(s);
  const progress = (s: DetailStep) => ({ total: steps.length, now: Math.max(0, steps.indexOf(s)) });

  return {
    ...d,
    loading,
    closeId,
    rows,
    records,
    gap,
    invest,
    loans,
    steps,
    nextOf,
    prevOf,
    skip,
    progress,
    refreshDetail: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: qk.closeBalances }),
        qc.invalidateQueries({ queryKey: qk.assets }),
        qc.invalidateQueries({ queryKey: ['goal_use'] }),
        qc.invalidateQueries({ queryKey: qk.goalRecords }),
        d.refreshClose(),
      ]),
  };
}
export type DetailData = ReturnType<typeof useDetailData>;
