import { expect, test } from 'vitest';
import {
  balanceOdd,
  emergencyDecreased,
  expectedBalance,
  goalGapAmount,
  loanAfter,
  type CloseLine,
} from './close-detail';

const split = (role: string, amount: number, done?: number): CloseLine => ({
  target: 'account',
  account_role: role,
  kind: 'split',
  amount,
  state: done === undefined ? 'pending' : 'done',
  done_amount: done ?? null,
});

test('예상 잔액 = 지난 정리 잔액 + 이번 나누기(옮긴 금액, 안 옮겼으면 계획액)', () => {
  const lines = [split('goal_fund', 3_000_000, 2_800_000), split('living', 1_850_000)];
  expect(expectedBalance('goal_fund', 10_000_000, lines)).toBe(12_800_000);
  expect(expectedBalance('living', 500_000, lines)).toBe(2_350_000);
  expect(expectedBalance('emergency', null, lines)).toBeNull();
});

test('목표자금 → 공동 생활비 줄: 옮긴 것만 빼고 더함, 아직 안 옮긴 줄은 제외', () => {
  const moved: CloseLine = {
    target: 'account',
    account_role: 'living',
    kind: 'goal_to_living',
    amount: 250_000,
    state: 'done',
    done_amount: 250_000,
  };
  const pending: CloseLine = { ...moved, state: 'pending', done_amount: null };
  expect(expectedBalance('goal_fund', 1_000_000, [moved, pending])).toBe(750_000);
  expect(expectedBalance('living', 0, [moved, pending])).toBe(250_000);
});

test('이상값: 차이가 예상의 50% 이상이면서 100만 원 이상', () => {
  expect(balanceOdd(1_000_000, 3_000_000)).toBe(true);
  expect(balanceOdd(2_700_000, 3_000_000)).toBe(false);
  expect(balanceOdd(0, 1_500_000)).toBe(true);
  expect(balanceOdd(100_000, 900_000)).toBe(false); // 100만 원 미만
  expect(balanceOdd(1, null)).toBe(false);
});

test('목표에서 쓴 돈 차액: 기록 25만, 통장 40만 줄면 15만', () => {
  expect(goalGapAmount(12_800_000, 12_400_000, 250_000)).toBe(150_000);
  expect(goalGapAmount(12_800_000, 12_600_000, 250_000)).toBe(0);
  expect(goalGapAmount(null, 1, 0)).toBe(0);
});

test('비상금 감소, 대출 상환 뒤 잔액', () => {
  expect(emergencyDecreased(5_000_000, 4_800_000)).toBe(true);
  expect(emergencyDecreased(5_000_000, 5_000_000)).toBe(false);
  expect(loanAfter(100_000_000, 1_200_000)).toBe(98_800_000);
  expect(loanAfter(500_000, 1_200_000)).toBe(0);
});
