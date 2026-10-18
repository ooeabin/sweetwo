import { expect, it } from 'vitest';
import { incomeRatio, periodIncome, periodSupplement } from './income-period';

const p = {
  user_id: 'yebin',
  start_month: '2027-01-01',
  end_month: '2027-03-01',
  amount: 1_200_000,
  ended_at: null,
};

it('그 달 수입: 기간 안이면 기간 수입, 밖이면 원래 수입, 끝난 기간은 무시', () => {
  expect(periodIncome('yebin', 2_700_000, [p], '2027-02-01')).toBe(1_200_000);
  expect(periodIncome('yebin', 2_700_000, [p], '2027-04')).toBe(2_700_000);
  expect(periodIncome('chanwoo', 3_500_000, [p], '2027-02-01')).toBe(3_500_000);
  expect(periodIncome('yebin', 2_700_000, [{ ...p, ended_at: 'x' }], '2027-02-01')).toBe(2_700_000);
});

it('보충안: 감소분 전액, 비상금 한도', () => {
  // 270 → 120, 3달: 월 150 보충, 비상금 600이면 충분
  expect(
    periodSupplement({
      base: 2_700_000,
      amount: 1_200_000,
      start: '2027-01-01',
      end: '2027-03-01',
      emergencyHeld: 6_000_000,
    }),
  ).toEqual({ months: 3, decrease: 1_500_000, monthly: 1_500_000, short: 0 });
  // 비상금 300이면 월 100, 150만 모자람
  expect(
    periodSupplement({
      base: 2_700_000,
      amount: 1_200_000,
      start: '2027-01-01',
      end: '2027-03-01',
      emergencyHeld: 3_000_000,
    }),
  ).toEqual({ months: 3, decrease: 1_500_000, monthly: 1_000_000, short: 1_500_000 });
  // 수입이 늘면 보충 없음
  expect(
    periodSupplement({
      base: 2_700_000,
      amount: 3_000_000,
      start: '2027-01-01',
      end: '2027-01-01',
      emergencyHeld: 0,
    }).monthly,
  ).toBe(0);
});

it('버는 만큼 분담: 찬우 350, 예빈 120 → 74:26', () => {
  expect(incomeRatio(3_500_000, 1_200_000)).toBe(74);
  expect(incomeRatio(0, 0)).toBe(50);
});
