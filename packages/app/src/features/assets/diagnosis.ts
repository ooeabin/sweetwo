import { fetchGoalAssetSums, fetchGoalRecords, fetchRecentCloses, qk } from '@sweetwo/api';
import {
  diagnose,
  diagnosisSummary,
  emergencyBase,
  emergencyMonths,
  goalHeld,
  type Indicator,
} from '@sweetwo/core';
import { useQuery } from '@tanstack/react-query';
import { useAssetsData } from './data';
import { moneyPlan } from './money';

// 재정 진단(23 F-06, 06 8장). 저축률 = 가장 최근 월말 정리(W-04k 넣은 돈 ÷ 그달 소득), 없으면 계획값(‘추정’).
// 비상금 잔액 = 비상금 목표 보유액(기타 보유액 + 연결 자산 + 넣은 돈, 비공개 제외).
// 투자 원칙 = O-53 두 사람 답(둘 다 양호, 한 명만 주의, 아무도 아직 몰라요).
export function useDiagnosis() {
  const d = useAssetsData();
  const close = useQuery({ queryKey: qk.recentCloses, queryFn: () => fetchRecentCloses(2) });
  const linked = useQuery({ queryKey: qk.goalAssetSums, queryFn: fetchGoalAssetSums });
  const records = useQuery({ queryKey: qk.goalRecords, queryFn: fetchGoalRecords });
  const loading = d.loading || close.isLoading || linked.isLoading || records.isLoading;
  if (loading || !d.me || !d.space) return { loading, d, result: null };

  const sp = d.space;
  const p = moneyPlan(d.me, sp, d.partnerProfile);
  const fixed = (sp.fixed_total ?? 0) + (sp.loan_repayment ?? 0);
  const monthly = fixed + (sp.living_budget ?? 0);
  const base = emergencyBase({
    fixed,
    living: sp.living_budget ?? 0,
    employments: [d.me.employment, d.partnerProfile?.employment],
  });
  const eg = d.goals.find((g) => g.template === 'emergency');
  const linkedTotal = eg ? ((linked.data ?? []).find((x) => x.goal_id === eg.id)?.total ?? 0) : 0;
  const deposited = eg
    ? (records.data?.deposits ?? [])
        .filter((x) => x.goalId === eg.id)
        .reduce((t, x) => t + x.amount, 0)
    : 0;
  const used = eg
    ? (records.data?.uses ?? []).filter((x) => x.goalId === eg.id).reduce((t, x) => t + x.amount, 0)
    : 0;
  const balance = eg ? goalHeld(eg.other_held, linkedTotal + deposited - used) : null;
  const last = close.data?.[0];
  const real =
    last && last.income !== null
      ? { income: last.income, saving: last.deposits.reduce((t, x) => t + x.amount, 0) }
      : null;
  const list: Indicator[] = diagnose({
    income: real?.income ?? p.sum.income,
    saving: real ? real.saving : Math.max(p.sum.saveable, 0),
    emergencyBalance: balance,
    emergencyBase: base.amount,
    loanRepayment: sp.loan_repayment ?? 0,
    fixed,
    invest: d.invest.state,
  });
  const estimated = {
    savingRate: !real,
    income: p.couple.partnerEstimated,
    fixed: !!(sp.fixed_total_estimated || sp.living_budget_estimated),
  };
  return {
    loading,
    d,
    result: {
      list,
      summary: diagnosisSummary(list),
      months: emergencyMonths(balance, monthly),
      baseMonths: base.months,
      emergencyGoalId: eg?.id ?? null,
      noLoan: (sp.loan_repayment ?? 0) === 0,
      estimated,
      hasPrivate: d.items.some((a) => a.visibility === 'private'),
      invest: d.invest,
      investMine: d.answers.mine,
      partnerName: d.couple?.partnerName ?? '',
    },
  };
}
export type Diagnosis = NonNullable<ReturnType<typeof useDiagnosis>['result']>;
