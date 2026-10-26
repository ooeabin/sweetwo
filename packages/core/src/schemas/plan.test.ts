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

it('트레이 위젯 값: 형식이 맞아야 받음', async () => {
  const { TraySnapshot, TrayState, WIDGET_DEFAULTS } = await import('./widget');
  const ok = {
    at: '2026-10-07T01:00:00Z',
    salary: { state: 'progress', label: '9월 월급', done: 2, total: 5, left: 3, payday: '2026-10-25' },
    task: null,
    days: [],
  };
  expect(TraySnapshot.safeParse(ok).success).toBe(true);
  expect(TraySnapshot.safeParse({ ...ok, salary: { ...ok.salary, state: 'x' } }).success).toBe(false);
  expect(TraySnapshot.safeParse({ ...ok, salary: { ...ok.salary, done: 1.5 } }).success).toBe(false);
  expect(
    TrayState.safeParse({
      signedIn: false,
      locked: false,
      snapshot: null,
      settings: WIDGET_DEFAULTS,
    }).success,
  ).toBe(true);
});
