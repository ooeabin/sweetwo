import type { Won } from '../money';

// 월말 정리 꼼꼼 모드(docs/spec/21-month-close.md W-04b~f, 06 6장·7장).

export type BalanceRole = 'living' | 'goal_fund' | 'emergency' | 'wedding';
export interface CloseLine {
  target: 'account' | 'goal';
  account_role: string | null;
  kind: 'split' | 'emergency_to_living' | 'goal_to_living';
  amount: Won;
  state: 'pending' | 'done';
  done_amount: Won | null;
}

/**
 * W-04b 예상 잔액 = 지난 정리 잔액(첫 정리는 O-63 잔액) + 이번 나누기.
 * 나누기 줄은 옮긴 금액(없으면 계획액). ‘목표자금·비상금 → 공동 생활비’ 줄은 옮긴 것만(빠지는 통장 −, 생활비 +).
 * 기준선이 없으면 null(첫 정리에 O-63을 건너뛴 경우)
 */
export function expectedBalance(
  role: BalanceRole,
  base: Won | null,
  lines: CloseLine[],
): Won | null {
  if (base === null) return null;
  let v = base;
  for (const l of lines) {
    if (l.target !== 'account') continue;
    const moved = l.state === 'done' ? (l.done_amount ?? l.amount) : null;
    if (l.kind === 'split') {
      if (l.account_role === role) v += moved ?? l.amount;
    } else if (moved !== null) {
      const from = l.kind === 'goal_to_living' ? 'goal_fund' : 'emergency';
      if (role === from) v -= moved;
      if (role === 'living') v += moved;
    }
  }
  return v;
}

/** 이상값: 예상과 차이가 예상의 50% 이상이면서 100만 원 이상이면 한 번 묻기(막지 않음) */
export function balanceOdd(input: Won, expected: Won | null): boolean {
  if (expected === null) return false;
  const diff = Math.abs(input - expected);
  return diff >= 1_000_000 && diff * 2 >= Math.abs(expected);
}

/**
 * W-04c 차액: 목표자금 통장이 기록보다 더 줄었으면 그 금액(줄어든 만큼 − 목표자금 통장에서 쓴 기록). 없으면 0
 */
export function goalGapAmount(expected: Won | null, actual: Won | null, recorded: Won): Won {
  if (expected === null || actual === null) return 0;
  return Math.max(0, expected - actual - recorded);
}

/** W-04d: 비상금이 예상보다 줄었을 때만 묻기 */
export const emergencyDecreased = (expected: Won | null, actual: Won | null) =>
  expected !== null && actual !== null && actual < expected;

/** W-04f: 이번 달 상환 뒤 대출 잔액(월 상환액만큼 차감, 0 밑으로 안 내려감) */
export const loanAfter = (amount: Won, monthly: Won | null) =>
  Math.max(0, amount - (monthly ?? 0));
