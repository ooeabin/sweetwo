import {
  dateToYm,
  emergencyTarget,
  recommendSplit,
  type AllocGoal,
  type SplitLineDraft,
} from '@sweetwo/core';
import type { Goal, Me } from './data';

// 월급 분배표 초안(O-50, 17 온보딩 ②). W-01도 같은 규칙을 쓴다.

export const toAllocGoal = (g: Goal): AllocGoal => ({
  id: g.id,
  template: g.template,
  name: g.name,
  kind: g.kind,
  priority: g.priority,
  target: g.target_amount,
  held: g.other_held,
  deadline: g.deadline ? dateToYm(g.deadline) : null,
  paused: g.status === 'paused',
});

/** 저금 줄 순서: 비상금 → 우리 목표 → 내 목표(묶음 안은 우선순위). 배우자 내 목표는 빼고, 보류·달성 목표도 뺌 */
export function savingGoals(goals: Goal[], meId: string | undefined): Goal[] {
  const live = goals.filter(
    (g) => g.status === 'active' || g.status === 'delayed' || g.template === 'emergency',
  );
  const rank = (g: Goal) => (g.template === 'emergency' ? 0 : g.owner_user_id === null ? 1 : 2);
  return live
    .filter((g) => g.owner_user_id === null || g.owner_user_id === meId)
    .sort((a, b) => rank(a) - rank(b) || a.priority - b.priority);
}

/** 처음 채우는 값: 내 월급 기준(배우자는 합류할 때 자기 분배표를 넣음) */
export function recommendedDraft(me: Me, goals: Goal[]): SplitLineDraft[] {
  const income = me.monthly_income ?? 0;
  return recommendSplit({
    income,
    people: [{ userId: me.id, income }],
    goals: savingGoals(goals, me.id).map(toAllocGoal),
  });
}

/** 비상금 목표 금액 = (고정지출 + 생활비) × 3(06 3장). 둘 다 0이면 null(금액 정하기) */
export function emergencyGoalTarget(lines: SplitLineDraft[]) {
  const sum = (k: SplitLineDraft['kind']) =>
    lines.filter((l) => l.kind === k).reduce((s, l) => s + l.amount, 0);
  const t = emergencyTarget(sum('fixed'), sum('living'));
  return t > 0 ? t : null;
}
