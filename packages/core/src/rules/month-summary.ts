import { assertWon, type Won } from '../money';

// 월 정산 요약 (docs/spec/06-calc-allocation.md 7장, 컴포넌트 MonthSummary)
// 쓴 돈 = 고정 + 변동 + 용돈 + 큰 지출 / 남은 돈 = 소득 − 쓴 돈 − 저축 / 사용 비율 = 쓴 돈 ÷ 소득
export interface MonthSummaryInput {
  income: Won;
  fixed: Won;
  variable: Won;
  allowance: Won;
  bigExpense: Won;
  saved: Won;
}

export interface MonthSummary {
  spent: Won;
  saved: Won;
  left: Won | null;
  /** 소수 첫째 자리 퍼센트(59.3). 소득이 0이면 null */
  usedPct: number | null;
}

export function monthSummary(input: MonthSummaryInput): MonthSummary {
  const { income, fixed, variable, allowance, bigExpense, saved } = input;
  [income, fixed, variable, allowance, bigExpense, saved].forEach(assertWon);
  const spent = fixed + variable + allowance + bigExpense;
  if (income <= 0) return { spent, saved, left: null, usedPct: null };
  return {
    spent,
    saved,
    left: income - spent - saved,
    // 정수 연산으로 소수 첫째 자리 반올림
    usedPct: Math.round((spent * 1000) / income) / 10,
  };
}

/**
 * 지난달보다(MonthSummary hg-sum__chg, 23 F-01 17번): 변동 항목별 차이가 큰 순으로 최대 4개.
 * 한쪽 달에만 있는 항목은 다른 달을 0으로. 차이가 0이면 뺌.
 */
export function spendChanges(
  cur: { category_id: string; amount: Won }[],
  prev: { category_id: string; amount: Won }[],
  limit = 4,
): { category_id: string; diff: Won }[] {
  const sum = (xs: { category_id: string; amount: Won }[]) => {
    const m = new Map<string, Won>();
    for (const x of xs) m.set(x.category_id, (m.get(x.category_id) ?? 0) + x.amount);
    return m;
  };
  const a = sum(cur);
  const b = sum(prev);
  return [...new Set([...a.keys(), ...b.keys()])]
    .map((id) => ({ category_id: id, diff: (a.get(id) ?? 0) - (b.get(id) ?? 0) }))
    .filter((x) => x.diff !== 0)
    .sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff))
    .slice(0, limit);
}
