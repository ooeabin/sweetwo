import { expect, it } from 'vitest';
import { readPlanSnapshot } from './plan';

it('플랜 기준값: 맞는 값은 그대로, 깨진 값은 빈 값', () => {
  expect(
    readPlanSnapshot({
      parts: { living: 1_110_000, goalFund: 1_500_000, emergency: 390_000 },
      baseDay: 25,
    }),
  ).toEqual({
    parts: { living: 1_110_000, goalFund: 1_500_000, emergency: 390_000 },
    baseDay: 25,
  });
  expect(readPlanSnapshot({ parts: { living: 1.5 } })).toEqual({});
  expect(readPlanSnapshot(null)).toEqual({});
});
