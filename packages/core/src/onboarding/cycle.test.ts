import { describe, expect, it } from 'vitest';
import {
  adjustParts,
  baseDateIn,
  currentCycle,
  defaultBaseDay,
  prorate,
  splitLines,
} from './cycle';

const M = 10_000;
const kst = (d: string) => new Date(`${d}T09:00:00+09:00`);

describe('기준일과 사이클(07 1장)', () => {
  it('기획서 예시: 25일 기준, 10월 7일 시작 → 9월 월급 플랜, 남은 18일', () => {
    expect(currentCycle(25, kst('2026-10-07'))).toEqual({
      start: '2026-09-25',
      end: '2026-10-24',
      labelMonth: '2026-09',
      daysLeft: 18,
      days: 30,
      short: false,
    });
  });
  it('기준일 당일이면 그 달 플랜, 15일 미만이면 짧은 기간', () => {
    expect(currentCycle(25, kst('2026-10-25')).labelMonth).toBe('2026-10');
    const c = currentCycle(25, kst('2026-10-15'));
    expect([c.daysLeft, c.short]).toEqual([10, true]);
  });
  it('그 달에 없는 날(29~31일)은 말일', () => {
    expect(baseDateIn(2027, 2, 31)).toBe('2027-02-28');
    expect(baseDateIn(2028, 2, 'last')).toBe('2028-02-29');
    const c = currentCycle(31, kst('2027-03-10'));
    expect([c.start, c.end, c.days]).toEqual(['2027-02-28', '2027-03-30', 31]);
  });
  it('연말을 넘는 사이클', () => {
    const c = currentCycle(10, kst('2027-01-05'));
    expect([c.start, c.end, c.labelMonth]).toEqual(['2026-12-10', '2027-01-09', '2026-12']);
  });
  it('기본 기준일 = 두 월급날 중 늦은 날(말일이 가장 늦음)', () => {
    expect(defaultBaseDay([25, null])).toBe(25);
    expect(defaultBaseDay([10, 25])).toBe(25);
    expect(defaultBaseDay([25, 'last'])).toBe('last');
    expect(defaultBaseDay([null, undefined])).toBeNull();
  });
});

describe('첫 월급 플랜(07 3-1, O-66)', () => {
  it('월 배분액 × 남은 일수 ÷ 사이클 일수, 1만 원 단위', () => {
    expect(prorate(260 * M, { daysLeft: 18, days: 30 })).toBe(156 * M);
    expect(prorate(65 * M, { daysLeft: 18, days: 30 })).toBe(39 * M);
  });
  it('옮길 돈을 바꾸면 생활비는 그대로, 목표자금과 비상금은 같은 비율로', () => {
    const p = { living: 156 * M, goalFund: 105 * M, emergency: 39 * M };
    expect(adjustParts(p, 228 * M)).toEqual({
      living: 156 * M,
      goalFund: 52 * M,
      emergency: 20 * M,
    });
    expect(adjustParts(p, 100 * M)).toEqual({ living: 100 * M, goalFund: 0, emergency: 0 });
    expect(adjustParts(p, 0)).toEqual({ living: 0, goalFund: 0, emergency: 0 });
  });
  it('통장별 줄을 분담 비율로(직접 60:40)', () => {
    const lines = splitLines(
      { living: 156 * M, goalFund: 105 * M, emergency: 39 * M },
      { mode: 'custom', myRatio: 60, myIncome: 350 * M, partnerIncome: 250 * M },
    );
    expect(lines.map((l) => [l.key, l.me, l.partner])).toEqual([
      ['living', 94 * M, 62 * M],
      ['goalFund', 63 * M, 42 * M],
      ['emergency', 23 * M, 16 * M],
    ]);
  });
});
