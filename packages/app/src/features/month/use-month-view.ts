import {
  useCurrentPlan,
  useGoalAssetSums,
  useGoalRecords,
  useGoals,
  useMe,
  useMonthClose,
  usePartner,
  useSpace,
} from './data';
import { goalExtra, monthView } from './view';

/** 이번 달 값(H-01과 같은 계산). 다른 메뉴의 ‘이번 달’ 카드에서 씀(우리 자산 F-01 4번) */
export function useMonthView() {
  const me = useMe();
  const space = useSpace();
  const goals = useGoals();
  const plan = useCurrentPlan();
  const partner = usePartner();
  const close = useMonthClose(plan.data?.id);
  const records = useGoalRecords();
  const linked = useGoalAssetSums();
  if (!me.data || !space.data) return null;
  return monthView({
    me: me.data,
    space: space.data,
    goals: goals.data ?? [],
    plan: plan.data ?? null,
    partner: partner.data ?? null,
    spentVariable: (close.data?.spends ?? []).reduce((t, x) => t + x.amount, 0),
    closeDone: close.data?.status === 'done',
    goalDeposits: goalExtra(records.data?.deposits ?? [], linked.data ?? []),
  });
}
