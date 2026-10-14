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
