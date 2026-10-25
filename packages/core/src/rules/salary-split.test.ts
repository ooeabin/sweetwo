import { describe, expect, it } from 'vitest';
import type { AllocGoal } from '../onboarding/allocation';
import { emergencyMonthly, goalEta, leftover, recommendSplit, round10k } from './salary-split';

// 기획서 예시(17 O-50·O-60): 찬우 실수령 350만, 1순위 내 집 마련 1억 5,000만(기한 5년 뒤), 2순위 여행(금액 미정)
const now = new Date('2026-10-26T03:00:00Z');
const goal = (o: Partial<AllocGoal> & Pick<AllocGoal, 'id' | 'template'>): AllocGoal => ({
  name: o.template,
  kind: 'once',
  priority: 0,
  target: null,
  held: 0,
  deadline: null,
  ...o,
});
const emergency = goal({ id: 'e', template: 'emergency' });
const home = goal({ id: 'h', template: 'home', priority: 1, target: 150_000_000, deadline: '2031-10' });
const travel = goal({ id: 't', template: 'travel', priority: 2 });

describe('recommendSplit', () => {
  const lines = recommendSplit({
    income: 3_500_000,
    people: [{ userId: 'chanwoo', income: 3_500_000 }],
    goals: [emergency, home, travel],
    now,
  });
  const amount = (k: string, id?: string) =>
    lines.find((l) => l.kind === k && (id === undefined || l.goalId === id))?.amount;

  it('찬우 350만 예시: 고정 88, 생활 88, 용돈 35', () => {
    expect(amount('fixed')).toBe(880_000);
    expect(amount('living')).toBe(880_000);
    expect(amount('allowance')).toBe(350_000);
  });
  it('남은 139만 → 비상금 44만, 내 집 마련 95만, 여행 0원', () => {
    expect(amount('saving', 'e')).toBe(440_000);
    expect(amount('saving', 'h')).toBe(950_000);
    expect(amount('saving', 't')).toBe(0);
  });
  it('남는 돈 0원, 내 집 마련 월 필요액 250만', () => {
    expect(leftover(3_500_000, lines)).toBe(0);
    expect(lines.find((l) => l.goalId === 'h')?.need).toBe(2_500_000);
  });
  it('저금 줄이 쓰는 돈 줄보다 먼저', () => {
    expect(lines.map((l) => l.kind)).toEqual(['saving', 'saving', 'saving', 'fixed', 'living', 'allowance']);
  });
  it('월급이 없으면 모두 0원', () => {
    const z = recommendSplit({ income: 0, people: [{ userId: 'c', income: 0 }], goals: [emergency, home], now });
    expect(z.every((l) => l.amount === 0)).toBe(true);
  });
  it('합쳐서: 용돈은 사람마다 그 사람 실수령의 10%', () => {
    const j = recommendSplit({
      income: 6_200_000,
      people: [
        { userId: 'chanwoo', income: 3_500_000 },
        { userId: 'yebin', income: 2_700_000 },
      ],
      goals: [emergency],
      now,
    });
    expect(j.filter((l) => l.kind === 'allowance').map((l) => l.amount)).toEqual([350_000, 270_000]);
  });
});

describe('비상금', () => {
  it('(88 + 88) × 3 ÷ 12 = 44만', () => expect(emergencyMonthly(880_000, 880_000)).toBe(440_000));
  it('1만 원 반올림', () => expect(round10k(875_000)).toBe(880_000));
});

describe('goalEta', () => {
  it('매달 95만이면 2039년 12월, 기한보다 8년 넘게 늦음', () => {
    const e = goalEta(home, 950_000, now);
    expect(e.expected).toBe('2039-12');
    expect(Math.floor((e.lateMonths ?? 0) / 12)).toBe(8);
  });
  it('저금 줄 0원이면 예상 없음', () => expect(goalEta(home, 0, now).expected).toBeNull());
  it('기한 안이면 늦음 0', () => expect(goalEta(home, 2_500_000, now).lateMonths).toBe(0));
});
