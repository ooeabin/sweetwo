import { dateToYm, recommendSplit, type SavingPlanItem, type SplitLineDraft } from '@sweetwo/core';
import type { Goal, Me } from '@sweetwo/api';

// 월급 계획 초안(O-50 추천값, W-01 ‘추천값으로 다시 채우기’, 20·06 3-2). 2026-11-08 ADR 0007: 비상금 없음, 저금 줄 = 저금 항목.

/** 저금 항목 → 추천값 재료(모은 금액은 서버 값) */
export const toPlanItem = (g: Goal, saved: Record<string, number> | undefined): SavingPlanItem => ({
  id: g.id,
  target: g.target_amount,
  saved: saved?.[g.id] ?? 0,
  deadline: g.deadline ? dateToYm(g.deadline) : null,
});

/**
 * 이 월급 계획의 저금 항목(저금 묶음 순서 = 만든 순서). 그만 모음·휴지통은 뺌.
 * owner = 월급 계획 주인(각자), 합쳐서면 null(우리 둘 항목 + 각자일 때 만든 항목 모두)
 */
export function savingGoals(goals: Goal[], owner: string | null): Goal[] {
  return goals
    .filter((g) => !g.deleted_at && !g.closed_at)
    .filter((g) => owner === null || g.owner_user_id === owner)
    .sort((a, b) => a.priority - b.priority || (a.created_at < b.created_at ? -1 : 1));
}

type Person = Pick<Me, 'id' | 'monthly_income'>;

/**
 * 추천값(O-50 처음 채우기, W-01 ‘추천값으로 다시 채우기’, 20 W-01 6번).
 * - 각자: 월급 계획 주인 수입, 그 사람 저금 항목만
 * - 합쳐서: 두 사람 수입 합, 용돈은 사람마다, 공동 월급 계획의 저금 항목
 * - current: 지금 저금 줄 금액(목표 금액·기한이 없는 항목은 그대로), keep: 그대로 둘 줄(파트너 탭)
 */
export function recommendedDraft(
  owner: Person,
  goals: Goal[],
  o: {
    partner?: Person | null;
    joint?: boolean;
    saved?: Record<string, number>;
    current?: SplitLineDraft[];
    keep?: Record<string, number>;
  } = {},
): SplitLineDraft[] {
  const people = o.joint && o.partner ? [owner, o.partner] : [owner];
  const incomes = people.map((p) => ({ userId: p.id, income: p.monthly_income ?? 0 }));
  const current: Record<string, number> = {};
  for (const l of o.current ?? [])
    if (l.kind === 'saving' && l.goalId) current[l.goalId] = (current[l.goalId] ?? 0) + l.amount;
  return recommendSplit({
    income: incomes.reduce((s, p) => s + p.income, 0),
    people: incomes,
    items: savingGoals(goals, o.joint ? null : owner.id).map((g) => toPlanItem(g, o.saved)),
    current,
    keep: o.keep,
  });
}
