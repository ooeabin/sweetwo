import { ceilTo10k, type Won } from '../money';
import { monthlyNeed } from './goals';
import { addMonths, monthsBetween, thisMonth, type YearMonth } from './month';

// 목표 배분(docs/spec/06-calc-allocation.md 4장, 5-3). 저축 가능 금액을 우선순위대로 월 필요액만큼 나눔.

export interface AllocGoal {
  id: string;
  template: string;
  name: string;
  kind: 'once' | 'yearly' | 'monthly';
  priority: number;
  /** 목표 금액(매달형은 월 납입액). null = 아직 안 정함(배분 없음) */
  target: Won | null;
  held: Won;
  deadline: YearMonth | null;
  /** 결혼 후 목표(예비부부 각자 관리): 저장만, 배분 없음 */
  afterMarriage?: boolean;
  paused?: boolean;
}

export interface AllocLine {
  goal: AllocGoal;
  /** 월 필요액(1만 원 단위 올림). 금액·기한이 없으면 null */
  need: Won | null;
  /** 월 배분액 */
  alloc: Won;
  /** 예상 달성 월. 배분 0이면 null(‘미정’). 매달형은 없음 */
  expected: YearMonth | null;
  /** 기한까지 모자람 */
  short: boolean;
}

export interface Allocation {
  lines: AllocLine[];
  /** 목표 월 필요액 합계 > 저축 가능 금액 */
  short: boolean;
  /** 모자란 금액(필요액 합계 − 저축 가능 금액) */
  shortfall: Won;
  emergency: Won;
  goals: Won;
}

/** 배분 순서: 비상금 → 고금리 대출 → 결혼 비용 → 사용자가 고른 순서(06 4장) */
const RANK: Record<string, number> = { emergency: 0, high_interest_loan: 1, wedding: 2 };
export const allocOrder = (a: AllocGoal, b: AllocGoal) =>
  (RANK[a.template] ?? 3) - (RANK[b.template] ?? 3) || a.priority - b.priority;

export function goalNeed(g: AllocGoal, now = new Date()): Won | null {
  if (g.target === null) return null;
  if (g.kind === 'monthly') return ceilTo10k(g.target);
  return monthlyNeed({ target: g.target, held: g.held, deadline: g.deadline, now })?.need ?? null;
}

/** 예상 달성 월 = 남은 금액 ÷ 월 배분액을 올림한 개월 수 뒤의 달 */
export function expectedMonth(g: AllocGoal, alloc: Won, now = new Date()): YearMonth | null {
  if (g.kind === 'monthly' || g.target === null) return null;
  const left = Math.max(g.target - g.held, 0);
  if (left === 0) return thisMonth(now);
  if (alloc <= 0) return null;
  return addMonths(thisMonth(now), Math.ceil(left / alloc));
}

export function allocate(saveable: Won, goals: AllocGoal[], now = new Date()): Allocation {
  const active = goals.filter((g) => !g.afterMarriage && !g.paused).sort(allocOrder);
  let left = Math.max(saveable, 0);
  const lines: AllocLine[] = active.map((g) => {
    const need = goalNeed(g, now);
    const alloc = need === null ? 0 : Math.min(need, left);
    left -= alloc;
    return { goal: g, need, alloc, expected: null, short: need !== null && alloc < need };
  });
  // 모든 목표를 채우고 남는 돈: 주거 목표, 없으면 1순위(사용자가 고른) 목표에
  if (left > 0) {
    const extra =
      lines.find((l) => l.goal.template === 'home' && l.need !== null) ??
      lines.find((l) => (RANK[l.goal.template] ?? 3) === 3 && l.need !== null);
    if (extra) extra.alloc += left;
  }
  for (const l of lines) l.expected = expectedMonth(l.goal, l.alloc, now);
  const needSum = lines.reduce((s, l) => s + (l.need ?? 0), 0);
  const emergency = lines
    .filter((l) => l.goal.template === 'emergency')
    .reduce((s, l) => s + l.alloc, 0);
  const total = lines.reduce((s, l) => s + l.alloc, 0);
  return {
    lines,
    short: needSum > Math.max(saveable, 0),
    shortfall: Math.max(needSum - Math.max(saveable, 0), 0),
    emergency,
    goals: total - emergency,
  };
}

// 부족할 때 조정 안 3개(06 4장 ‘부족 상태’). 우선순위 낮은 목표부터.

/** 기한 연장: 모자란 목표마다 지금 배분액으로 채우는 달로. 배분 0인 목표가 있으면 null */
export function extendDeadlines(a: Allocation, now = new Date()) {
  const short = a.lines.filter((l) => l.short);
  if (!short.length || short.some((l) => l.alloc <= 0 || l.goal.kind === 'monthly')) return null;
  return short.map((l) => ({
    goal: l.goal,
    deadline: expectedMonth(l.goal, l.alloc, now) as YearMonth,
  }));
}

/** 금액 조정: 모자란 목표 금액을 기한까지 지금 배분액으로 모을 수 있는 만큼(1만 원 단위 내림). 배분 0이면 null */
export function lowerTargets(a: Allocation, now = new Date()) {
  const short = a.lines.filter((l) => l.short);
  if (!short.length || short.some((l) => l.alloc <= 0 || l.goal.deadline === null)) return null;
  return short.map((l) => {
    const months = Math.max(monthsBetween(thisMonth(now), l.goal.deadline as YearMonth), 1);
    const target =
      l.goal.kind === 'monthly'
        ? l.alloc
        : Math.floor((l.goal.held + l.alloc * months) / 10_000) * 10_000;
    return { goal: l.goal, target };
  });
}

/**
 * 지출 줄이기: 생활비 예산부터, 모자라면 내 용돈(상대 용돈은 대상 아님).
 * 합류 전 배우자 용돈 = 내 용돈 가정이면 내 용돈 1만 원이 2만 원을 만든다(allowanceFactor 2).
 * 줄여도 모자라면 null.
 */
export function cutSpending(o: {
  shortfall: Won;
  livingBudget: Won;
  myAllowance: Won;
  allowanceFactor: 1 | 2;
}) {
  const need = ceilTo10k(o.shortfall);
  if (need <= 0) return null;
  const living = Math.min(need, o.livingBudget);
  const rest = need - living;
  const allowance = ceilTo10k(Math.ceil(rest / o.allowanceFactor));
  if (allowance > o.myAllowance) return null;
  return {
    livingBudget: o.livingBudget - living,
    myAllowance: o.myAllowance - allowance,
    livingCut: living,
    allowanceCut: allowance,
  };
}

/** 비상금 기준(06 8장) = (고정지출 + 생활비 예산) × 기준 개월. 정규직만이면 3, 아니면 6 */
export function emergencyBase(o: {
  fixed: Won;
  living: Won;
  employments: (string | null | undefined)[];
}): { months: 3 | 6; amount: Won } {
  const known = o.employments.filter((e): e is string => !!e);
  const months = known.length && known.every((e) => e === 'regular') ? 3 : 6;
  return { months, amount: (o.fixed + o.living) * months };
}
