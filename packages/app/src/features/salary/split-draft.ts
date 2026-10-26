import {
  dateToYm,
  emergencyTarget,
  recommendSplit,
  type AllocGoal,
  type SplitLineDraft,
} from '@sweetwo/core';
import type { Goal, Me } from '@sweetwo/api';

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

/**
 * 저금 줄 순서: 비상금 → 우리 목표 → 내 목표(묶음 안은 우선순위). 보류·달성 목표는 뺌.
 * owners = 내 목표를 넣을 사람(각자 = 분배표 주인 한 명, 합쳐서 = 두 사람)
 */
export function savingGoals(goals: Goal[], owners: string | string[] | undefined): Goal[] {
  const ids = Array.isArray(owners) ? owners : owners ? [owners] : [];
  const live = goals.filter(
    (g) => g.status === 'active' || g.status === 'delayed' || g.template === 'emergency',
  );
  const rank = (g: Goal) => (g.template === 'emergency' ? 0 : g.owner_user_id === null ? 1 : 2);
  return live
    .filter((g) => g.owner_user_id === null || ids.includes(g.owner_user_id))
    .sort((a, b) => rank(a) - rank(b) || a.priority - b.priority);
}

type Person = Pick<Me, 'id' | 'monthly_income'>;

/**
 * 추천값(O-50 처음 채우기, W-01 ‘추천값으로 다시 채우기’, 20 W-01 6번).
 * - 각자: 분배표 주인 수입. 우리 목표 줄은 상대 분배표 같은 목표 줄만큼 빼고 채움(others)
 * - 합쳐서: 두 사람 수입 합, 용돈은 사람마다
 * - keep: 그대로 둘 줄(배우자 탭의 배우자 내 목표 줄)
 */
export function recommendedDraft(
  owner: Person,
  goals: Goal[],
  o: {
    partner?: Person | null;
    joint?: boolean;
    others?: Record<string, number>;
    keep?: Record<string, number>;
  } = {},
): SplitLineDraft[] {
  const people = o.joint && o.partner ? [owner, o.partner] : [owner];
  const incomes = people.map((p) => ({ userId: p.id, income: p.monthly_income ?? 0 }));
  return recommendSplit({
    income: incomes.reduce((s, p) => s + p.income, 0),
    people: incomes,
    goals: savingGoals(
      goals,
      people.map((p) => p.id),
    ).map(toAllocGoal),
    others: o.others,
    keep: o.keep,
  });
}

/** 상대 분배표의 우리 목표(비상금 포함) 저금 줄 금액(각자 모드 추천값에서 뺌) */
export function ourLinesOf(
  split: { split_line: { kind: string; goal_id: string | null; amount: number }[] } | undefined,
  goals: Goal[],
): Record<string, number> {
  const ours = new Set(goals.filter((g) => g.owner_user_id === null).map((g) => g.id));
  const out: Record<string, number> = {};
  for (const l of split?.split_line ?? [])
    if (l.kind === 'saving' && l.goal_id && ours.has(l.goal_id))
      out[l.goal_id] = (out[l.goal_id] ?? 0) + l.amount;
  return out;
}

/** 비상금 목표 금액 = (고정지출 + 생활비) × 3(06 3장). 둘 다 0이면 null(금액 정하기) */
export function emergencyGoalTarget(lines: SplitLineDraft[]) {
  const sum = (k: SplitLineDraft['kind']) =>
    lines.filter((l) => l.kind === k).reduce((s, l) => s + l.amount, 0);
  const t = emergencyTarget(sum('fixed'), sum('living'));
  return t > 0 ? t : null;
}
