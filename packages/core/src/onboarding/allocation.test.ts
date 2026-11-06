import { describe, expect, it } from 'vitest';
import { expectedMonth, goalNeed, type AllocGoal } from './allocation';

const M = 10_000;
const now = new Date('2026-10-15T03:00:00Z'); // KST 2026-10-15
const goal = (o: Partial<AllocGoal> & Pick<AllocGoal, 'id' | 'template'>): AllocGoal => ({
  name: o.template,
  kind: 'once',
  priority: 1,
  target: null,
  held: 0,
  deadline: null,
  ...o,
});

describe('월 필요액과 예상 달성 월(06 5-3)', () => {
  it('비상금 780만 원 12개월 → 월 65만 원', () => {
    const e = goal({ id: 'e', template: 'emergency', target: 780 * M, deadline: '2027-10' });
    expect(goalNeed(e, now)).toBe(65 * M);
  });
  it('금액이 없으면 필요액 없음, 매달형은 월 납입액(1만 원 올림)', () => {
    expect(goalNeed(goal({ id: 't', template: 'travel' }), now)).toBeNull();
    expect(goalNeed(goal({ id: 'm', template: 'x', kind: 'monthly', target: 123_400 }), now)).toBe(
      13 * M,
    );
  });
  it('예상 달성 월 = 남은 금액 ÷ 월 배분액 올림', () => {
    const h = goal({ id: 'h', template: 'home', target: 1000 * M, held: 100 * M });
    expect(expectedMonth(h, 100 * M, now)).toBe('2027-07');
    expect(expectedMonth(h, 0, now)).toBeNull();
    expect(expectedMonth({ ...h, held: 1000 * M }, 0, now)).toBe('2026-10');
  });
});
