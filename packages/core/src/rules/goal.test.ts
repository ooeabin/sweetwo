import { expect, it } from 'vitest';
import {
  celebrationStory,
  goalHeld,
  goalMonths,
  goalPace,
  goalRest,
  goalStatus,
  paceChip,
} from './goal';

const kst = (s: string) => new Date(`${s}T12:00:00+09:00`);

it('보유액 = 기타 보유액 + 넣은 돈, 0 하한(06 5-4)', () => {
  expect(goalHeld(3_000_000, 600_000)).toBe(3_600_000);
  expect(goalHeld(0, -10_000)).toBe(0);
});

it('달별 기록: 새 달부터, 정리 전은 실제 없음, 계획 0원은 쉬어감', () => {
  const plans = [
    { goalId: 'g', month: '2026-08-01', amount: 300_000 },
    { goalId: 'g', month: '2026-09-01', amount: 300_000 },
    { goalId: 'g', month: '2026-10-01', amount: 0 },
    { goalId: 'x', month: '2026-09-01', amount: 999 },
  ];
  const deposits = [
    { goalId: 'g', month: '2026-08-01', amount: 330_000 },
    { goalId: 'g', month: '2026-09-01', amount: 270_000 },
  ];
  expect(goalMonths('g', plans, deposits)).toEqual([
    { month: '2026-10', plan: 0, actual: null, diff: null, rested: true },
    { month: '2026-09', plan: 300_000, actual: 270_000, diff: -30_000, rested: false },
    { month: '2026-08', plan: 300_000, actual: 330_000, diff: 30_000, rested: false },
  ]);
});

const line = (
  o: Partial<{
    kind: string;
    target: number | null;
    held: number;
    deadline: `${number}-${string}` | null;
    expected: `${number}-${string}` | null;
  }>,
) => ({
  expected: o.expected ?? null,
  goal: {
    kind: o.kind ?? 'once',
    target: o.target ?? 10_000_000,
    held: o.held ?? 0,
    deadline: o.deadline ?? null,
  },
});

it('상태(06 5-5)', () => {
  expect(goalStatus('active', line({ deadline: '2030-01', expected: '2029-06' }))).toBe('active');
  expect(goalStatus('active', line({ deadline: '2030-01', expected: '2030-03' }))).toBe('delayed');
  expect(goalStatus('active', line({ deadline: '2030-01', expected: null }))).toBe('delayed');
  expect(goalStatus('active', line({ held: 10_000_000 }))).toBe('achieved');
  expect(goalStatus('paused', line({ held: 10_000_000 }))).toBe('paused');
  expect(goalStatus('active', line({ kind: 'monthly' }))).toBeNull();
  // 2개월 연속 미달(쉰 달 제외)
  const m = (diff: number, rested = false) => ({
    month: '2026-09' as const,
    plan: rested ? 0 : 1,
    actual: 1 + diff,
    diff,
    rested,
  });
  expect(goalStatus('active', line({}), [m(-1), m(0, true), m(-1)])).toBe('delayed');
  expect(goalStatus('active', line({}), [m(-1), m(1)])).toBe('active');
});

it('지금 눈금과 칩', () => {
  // 2026년 1월 만들고 2028년 1월 기한, 지금 2027년 1월 → 50%
  expect(goalPace('2026-01-15T00:00:00Z', '2028-01', kst('2027-01-10'))).toBe(50);
  expect(goalPace('2026-01-15T00:00:00Z', null)).toBeNull();
  expect(paceChip({ pct: 53, pace: 50, expected: '2027-12', deadline: '2028-01' })).toEqual({
    kind: 'ahead',
    pct: 3,
  });
  expect(paceChip({ pct: 40, pace: 50, expected: '2028-03', deadline: '2028-01' })).toEqual({
    kind: 'late',
    months: 2,
  });
  expect(paceChip({ pct: 40, pace: 50, expected: '2027-12', deadline: '2028-01' })).toBeNull();
});

it('달성 축하 문장: 매달 함께, 일부 함께, 혼자', () => {
  expect(celebrationStory(16, 16, false)).toEqual({ kind: 'all', months: 16, together: 16 });
  expect(celebrationStory(16, 14, false)).toEqual({ kind: 'some', months: 16, together: 14 });
  expect(celebrationStory(16, 0, false)).toEqual({ kind: 'solo', months: 16, together: 0 });
  expect(celebrationStory(16, 14, true)).toEqual({ kind: 'solo', months: 16, together: 0 });
  expect(celebrationStory(0, 0, false)).toBeNull();
});

it('사용 기록 뒤 남은 보유액: 400만 중 380만 → 20만, 각자 돈은 그대로, 넘치면 0', () => {
  expect(goalRest(4_000_000, 3_800_000, 'living')).toBe(200_000);
  expect(goalRest(4_000_000, 3_800_000, 'personal')).toBe(4_000_000);
  expect(goalRest(4_000_000, 4_500_000, 'goal_fund')).toBe(0);
});
