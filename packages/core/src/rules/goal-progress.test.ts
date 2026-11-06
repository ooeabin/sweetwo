import { describe, expect, it } from 'vitest';
import { goalBars, goalProgress } from './goal-progress';

describe('goalProgress(22 G-02 9번)', () => {
  it('계획은 매달 넣는 돈대로, 실제는 그달까지 더한 돈', () => {
    const r = goalProgress({
      start: '2026-08-12',
      now: '2026-10-26',
      held: 1_000_000,
      monthly: 500_000,
      flows: [
        { ym: '2026-08', amount: 500_000 },
        { ym: '2026-09', amount: 300_000 },
        { ym: '2026-10', amount: 500_000 },
        { ym: '2026-10', amount: -100_000 },
      ],
    });
    expect(r).toEqual([
      { ym: '2026-08', plan: 1_500_000, actual: 1_500_000, milestone: false },
      { ym: '2026-09', plan: 2_000_000, actual: 1_800_000, milestone: false },
      { ym: '2026-10', plan: 2_500_000, actual: 2_200_000, milestone: false },
    ]);
  });
  it('만든 달보다 앞선 기록은 첫 달에, 이번 달에 만든 목표는 한 점', () => {
    const r = goalProgress({
      start: '2026-10-01',
      now: '2026-10-26',
      held: 0,
      monthly: 100_000,
      flows: [{ ym: '2026-09', amount: 50_000 }],
    });
    expect(r).toEqual([{ ym: '2026-10', plan: 100_000, actual: 50_000, milestone: false }]);
  });
  it('연 마일스톤 점: 만든 달에서 12개월, 24개월 되는 달', () => {
    const r = goalProgress({
      start: '2024-03-05',
      now: '2026-10-26',
      held: 0,
      monthly: 10_000,
      flows: [],
    });
    expect(r.filter((x) => x.milestone).map((x) => x.ym)).toEqual(['2025-03', '2026-03']);
  });
});

describe('goalBars(22 G-02 10a번)', () => {
  it('최근 6개월, 있는 달만, 이번 달 표시, 차이', () => {
    const r = goalBars(
      [
        { ym: '2026-03', planned: 950_000, actual: 950_000 },
        { ym: '2026-08', planned: 950_000, actual: 1_250_000 },
        { ym: '2026-09', planned: 950_000, actual: 0 },
        { ym: '2026-10', planned: 950_000, actual: 950_000 },
      ],
      '2026-10-26',
    );
    expect(r.map((b) => [b.month, b.diff, b.now])).toEqual([
      [8, 300_000, false],
      [9, -950_000, false],
      [10, 0, true],
    ]);
  });
});
