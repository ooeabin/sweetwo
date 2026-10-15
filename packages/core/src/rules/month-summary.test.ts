import { describe, expect, it } from 'vitest';
import { monthSummary } from './month-summary';

describe('monthSummary (계산·배분 7장 예시)', () => {
  it('찬우와 예빈 10월 정산', () => {
    const r = monthSummary({
      income: 7_642_680,
      fixed: 1_387_540,
      variable: 1_838_389,
      allowance: 600_000,
      bigExpense: 709_000,
      saved: 900_000,
    });
    expect(r.spent).toBe(4_534_929);
    expect(r.left).toBe(2_207_751);
    expect(r.usedPct).toBe(59.3);
  });

  it('소득이 0이면 비율과 남은 돈을 비운다', () => {
    const r = monthSummary({
      income: 0,
      fixed: 1,
      variable: 0,
      allowance: 0,
      bigExpense: 0,
      saved: 0,
    });
    expect(r.usedPct).toBeNull();
    expect(r.left).toBeNull();
  });

  it('정수가 아닌 금액은 막는다', () => {
    expect(() =>
      monthSummary({ income: 1.5, fixed: 0, variable: 0, allowance: 0, bigExpense: 0, saved: 0 }),
    ).toThrow(RangeError);
  });
});
