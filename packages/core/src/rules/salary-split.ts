import { type Won } from '../money';
import { expectedMonth, goalNeed, type AllocGoal } from '../onboarding/allocation';
import { monthsBetween, type YearMonth } from '../onboarding/month';

// 월급 분배표 추천값과 예상 달성일(docs/spec/17-onboarding-2.md O-50·O-60, 06-calc-allocation.md 3장·5장).

export type SplitKind = 'saving' | 'fixed' | 'living' | 'allowance' | 'custom';

export interface SplitLineDraft {
  kind: SplitKind;
  amount: Won;
  /** 저금 줄 */
  goalId?: string;
  /** 용돈 줄(합쳐서면 사람마다 1줄) */
  userId?: string;
  /** 직접 추가 줄 */
  name?: string;
  /** 저금 줄: 목표 월 필요액(금액이 정해진 목표만) */
  need?: Won | null;
}

/** 1만 원 단위 반올림 */
export const round10k = (v: number): Won => Math.round(v / 10_000) * 10_000;
const floor10k = (v: number): Won => Math.floor(v / 10_000) * 10_000;

export const FIXED_RATE = 0.25;
export const LIVING_RATE = 0.25;
export const ALLOWANCE_RATE = 0.1;

/** 비상금 목표 금액 = (고정지출 + 생활비) × 3, 월 필요액 = ÷ 12(1만 원 반올림) */
export const emergencyTarget = (fixed: Won, living: Won): Won => (fixed + living) * 3;
export const emergencyMonthly = (fixed: Won, living: Won): Won =>
  round10k(emergencyTarget(fixed, living) / 12);

export interface RecommendInput {
  /** 분배표 수입(합쳐서면 두 사람 합) */
  income: Won;
  /** 용돈 줄을 받을 사람과 그 사람 실수령 */
  people: { userId: string; income: Won }[];
  /** 저금 줄 순서대로(비상금 → 우리 목표 → 내 목표, 묶음 안은 우선순위). 비상금은 template 'emergency' */
  goals: AllocGoal[];
  now?: Date;
}

/**
 * 처음 채우는 값(O-50, W-01 ‘추천값으로 다시 채우기’).
 * 고정지출·생활비 = 수입 × 25%, 용돈 = 사람마다 실수령 × 10%, 남은 금액을 저금 줄 순서대로 월 필요액만큼.
 * 비상금 월 필요액은 (고정지출 + 생활비) × 3 ÷ 12. 금액이 없는 목표는 0원.
 */
export function recommendSplit(o: RecommendInput): SplitLineDraft[] {
  const income = Math.max(o.income, 0);
  const fixed = round10k(income * FIXED_RATE);
  const living = round10k(income * LIVING_RATE);
  const allowances = o.people.map((p) => ({
    kind: 'allowance' as const,
    userId: p.userId,
    amount: round10k(Math.max(p.income, 0) * ALLOWANCE_RATE),
  }));
  let left = income - fixed - living - allowances.reduce((s, a) => s + a.amount, 0);
  const savings: SplitLineDraft[] = o.goals.map((g) => {
    const need = g.template === 'emergency' ? emergencyMonthly(fixed, living) : goalNeed(g, o.now);
    const amount = need === null ? 0 : Math.max(Math.min(need, floor10k(left)), 0);
    left -= amount;
    return { kind: 'saving', goalId: g.id, amount, need };
  });
  return [
    ...savings,
    { kind: 'fixed', amount: fixed },
    { kind: 'living', amount: living },
    ...allowances,
  ];
}

/** 남는 돈 = 수입 − 모든 줄 합계. 음수면 모자람 */
export const leftover = (income: Won, lines: Pick<SplitLineDraft, 'amount'>[]): Won =>
  income - lines.reduce((s, l) => s + l.amount, 0);

export interface GoalEta {
  /** 예상 달성 월. 저금 줄이 0원이거나 금액이 없으면 null */
  expected: YearMonth | null;
  /** 기한보다 늦은 개월 수(기한 안이면 0). 기한이 없으면 null */
  lateMonths: number | null;
}

/** 예상 달성일(O-60): 오늘 + (목표 금액 − 모은 돈) ÷ 저금 줄 금액, 개월 올림 */
export function goalEta(g: AllocGoal, monthly: Won, now = new Date()): GoalEta {
  const expected = expectedMonth(g, monthly, now);
  if (!expected || !g.deadline) return { expected, lateMonths: null };
  return { expected, lateMonths: Math.max(monthsBetween(g.deadline, expected), 0) };
}
