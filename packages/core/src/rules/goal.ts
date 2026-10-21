import type { Won } from '../money';
import type { AllocLine } from '../onboarding/allocation';
import { dateToYm, monthsBetween, thisMonth, type YearMonth } from '../onboarding/month';

// 목표 화면(G-01, G-02) 값(docs/spec/06-calc-allocation.md 5-3~5-5, 22-goals.md).
// 보유액은 연결 자산이 아직 없어 ‘기타 보유액 + 월말 정리(W-04k)에서 이 목표로 넣은 돈 누적’(5-4, 잔액을 맞추지 않는 사람 규칙).

export type GoalStatus = 'active' | 'delayed' | 'achieved' | 'used' | 'paused' | 'wrapping_up';

/** 달별 한 줄: 그달 플랜의 이 목표 계획액, 정리를 마친 달의 실제 납입액 */
export interface GoalMonthInput {
  goalId: string;
  /** 플랜 이름 달 'YYYY-MM-01' 또는 'YYYY-MM' */
  month: string;
  amount: Won;
}

export interface GoalMonth {
  month: YearMonth;
  plan: Won;
  /** null = 아직 정리 전 */
  actual: Won | null;
  /** 실제 − 계획(정리 전이면 null) */
  diff: Won | null;
  /** 계획 0원인 달(쉬어감) */
  rested: boolean;
}

/** 보유액 = 기타 보유액 + 넣은 돈 누적, 0 하한(5-4) */
export const goalHeld = (otherHeld: Won, deposits: Won) => Math.max(otherHeld + deposits, 0);

/** 비상금 잔액 = 비상금 목표 보유액 + 넣기 − 꺼내기(23 F-09, 0 아래로 안 내려감) */
export const emergencyBalance = (held: Won, moves: { kind: 'in' | 'out'; amount: Won }[]) =>
  Math.max(held + moves.reduce((t, m) => t + (m.kind === 'in' ? m.amount : -m.amount), 0), 0);

/** 달별 기록(새 달부터). 계획은 플랜 줄, 실제는 정리를 마친 달의 납입 */
export function goalMonths(
  goalId: string,
  plans: GoalMonthInput[],
  deposits: GoalMonthInput[],
): GoalMonth[] {
  const sum = (rows: GoalMonthInput[], m: string) =>
    rows
      .filter((r) => r.goalId === goalId && dateToYm(r.month) === m)
      .reduce((t, r) => t + r.amount, 0);
  const months = [
    ...new Set(
      [...plans, ...deposits].filter((r) => r.goalId === goalId).map((r) => dateToYm(r.month)),
    ),
  ].sort((a, b) => b.localeCompare(a));
  return months.map((m) => {
    const plan = sum(plans, m);
    const closed = deposits.some((r) => r.goalId === goalId && dateToYm(r.month) === m);
    const actual = closed ? sum(deposits, m) : null;
    return {
      month: m,
      plan,
      actual,
      diff: actual === null ? null : actual - plan,
      rested: plan === 0,
    };
  });
}

/**
 * 상태(5-5): 보류, 사용 완료, 마무리 중은 저장된 값. 달성 = 보유액 ≥ 목표 금액.
 * 지연 = 예상 달성일 > 기한, 또는 2개월 연속 배분 미달(쉰 달 제외). 매달 목표는 상태 없음(null).
 */
export function goalStatus(
  saved: GoalStatus,
  line: Pick<AllocLine, 'expected'> & {
    goal: { kind: string; target: Won | null; held: Won; deadline: YearMonth | null };
  },
  months: GoalMonth[] = [],
): GoalStatus | null {
  if (saved === 'paused' || saved === 'used' || saved === 'wrapping_up') return saved;
  const g = line.goal;
  if (g.kind === 'monthly') return null;
  if (saved === 'achieved' || (g.target !== null && g.target > 0 && g.held >= g.target))
    return 'achieved';
  if (g.deadline && g.target !== null && (line.expected === null || line.expected > g.deadline))
    return 'delayed';
  const closed = months.filter((m) => m.actual !== null && !m.rested).slice(0, 2);
  if (closed.length === 2 && closed.every((m) => (m.diff ?? 0) < 0)) return 'delayed';
  return 'active';
}

/** 계획상 지금 위치 %(만든 달부터 기한까지 고르게). 기한이 없으면 null */
export function goalPace(createdAt: string, deadline: YearMonth | null, now = new Date()) {
  // 만든 날을 모르면(옛 기록·불완전한 행) 계획 위치 없음
  if (!deadline || !createdAt) return null;
  const start = dateToYm(createdAt);
  const total = monthsBetween(start, deadline);
  if (total <= 0) return 100;
  const done = Math.min(Math.max(monthsBetween(start, thisMonth(now)), 0), total);
  return (done * 100) / total;
}

/** ‘지금’ 눈금 아래 칩: 앞섰으면 몇 %, 기한보다 늦게 끝나면 몇 달(G-01 3번) */
export function paceChip(o: {
  pct: number;
  pace: number | null;
  expected: YearMonth | null;
  deadline: YearMonth | null;
}): { kind: 'ahead'; pct: number } | { kind: 'late'; months: number } | null {
  if (o.deadline && o.expected && o.expected > o.deadline)
    return { kind: 'late', months: monthsBetween(o.deadline, o.expected) };
  if (o.pace === null) return null;
  const ahead = Math.round(Math.min(o.pct, 100) - o.pace);
  return ahead > 0 ? { kind: 'ahead', pct: ahead } : null;
}

/**
 * 달성 축하 문장(22 G-05 축하): 모든 달 함께 → 'all'(“16개월 동안 매달 둘이 함께 모았어요”),
 * 일부 → 'some'(“16개월 중 14번은 둘이 함께 모았어요”), 한 사람만 또는 혼자 쓰기 → 'solo'(“16개월 만에 모았어요”).
 * 모은 달이 없으면(기타 보유액만으로 달성) 문장 없음(null).
 */
export function celebrationStory(
  months: number,
  together: number,
  solo: boolean,
): { kind: 'all' | 'some' | 'solo'; months: number; together: number } | null {
  if (months <= 0) return null;
  if (solo || together <= 0) return { kind: 'solo', months, together: 0 };
  if (together >= months) return { kind: 'all', months, together: months };
  return { kind: 'some', months, together };
}

/** 사용 기록 뒤 남은 보유액(10번): 각자 돈은 차감 없음, 쓴 돈 > 보유액이면 0 */
export function goalRest(held: Won, spent: Won, paidFrom: 'goal_fund' | 'living' | 'personal') {
  return paidFrom === 'personal' ? held : Math.max(held - spent, 0);
}
