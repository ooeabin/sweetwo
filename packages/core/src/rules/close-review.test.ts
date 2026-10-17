import { expect, test } from 'vitest';
import { livingBudgetFix, livingSaved, planGap, spreadMonthly } from './close-review';

test('보정 제안: 최근 3개월 평균 138만 원, 예산 120만 원 → 10% 넘게 달라 제안', () => {
  expect(livingBudgetFix(1_200_000, [1_400_000, 1_350_000, 1_390_000])).toEqual({ avg: 1_380_000 });
});

test('보정 제안: 10% 안이거나 3개월이 안 되면 없음', () => {
  expect(livingBudgetFix(1_200_000, [1_300_000, 1_300_000, 1_300_000])).toBeNull();
  expect(livingBudgetFix(1_200_000, [1_400_000, 1_400_000])).toBeNull();
  expect(livingBudgetFix(0, [1, 2, 3])).toBeNull();
  // 덜 써도 제안
  expect(livingBudgetFix(1_200_000, [900_000, 1_000_000, 1_000_000])).toEqual({ avg: 970_000 });
});

test('계획 대비: 미달·초과·같음', () => {
  const rows = [
    { key: 'home', name: '집 마련', planned: 1_000_000, saved: 800_000 },
    { key: 'trip', name: '여행', planned: 100_000, saved: 100_000 },
  ];
  expect(planGap(rows)).toEqual({
    planned: 1_100_000,
    saved: 900_000,
    kind: 'short',
    amount: 200_000,
  });
  expect(planGap([{ key: 'a', name: 'a', planned: 100_000, saved: 150_000 }]).kind).toBe('over');
  expect(planGap([{ key: 'a', name: 'a', planned: 100_000, saved: 100_000 }]).kind).toBeNull();
  expect(planGap([{ key: 'a', name: 'a', planned: 0, saved: 100_000 }]).kind).toBeNull();
});

test('3개월에 나눠 채우기: 20만 원 → 월 7만 원(1만 원 올림)', () => {
  expect(spreadMonthly(200_000)).toBe(70_000);
  expect(spreadMonthly(300_000)).toBe(100_000);
});

test('잘한 점: 생활비를 계획보다 12만 원 아꼈어요', () => {
  expect(livingSaved(1_200_000, 1_075_000)).toBe(120_000);
  expect(livingSaved(1_200_000, 1_195_000)).toBeNull();
  expect(livingSaved(0, 0)).toBeNull();
});
