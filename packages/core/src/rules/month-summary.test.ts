import { describe, expect, it } from 'vitest';
import { monthSummary, spendChanges } from './month-summary';

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

it('지난달보다: 변동 항목별 차이가 큰 순으로 4개, 한쪽에만 있으면 0으로, 차이 0은 뺌', () => {
  const r = spendChanges(
    [
      { category_id: 'eat', amount: 480_000 },
      { category_id: 'shop', amount: 200_000 },
      { category_id: 'cafe', amount: 50_000 },
      { category_id: 'gift', amount: 300_000 },
      { category_id: 'car', amount: 100_000 },
    ],
    [
      { category_id: 'eat', amount: 400_000 },
      { category_id: 'shop', amount: 250_000 },
      { category_id: 'cafe', amount: 50_000 },
      { category_id: 'pet', amount: 90_000 },
      { category_id: 'car', amount: 70_000 },
    ],
  );
  expect(r).toEqual([
    { category_id: 'gift', diff: 300_000 },
    { category_id: 'pet', diff: -90_000 },
    { category_id: 'eat', diff: 80_000 },
    { category_id: 'shop', diff: -50_000 },
  ]);
});
