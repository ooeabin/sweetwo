import { describe, expect, it } from 'vitest';
import { baseDateIn, defaultBaseDay } from './cycle';

describe('기준일(07 1장)', () => {
  it('그 달에 없는 날(29~31일)은 말일', () => {
    expect(baseDateIn(2027, 2, 31)).toBe('2027-02-28');
    expect(baseDateIn(2028, 2, 'last')).toBe('2028-02-29');
    expect(baseDateIn(2026, 10, 25)).toBe('2026-10-25');
  });
  it('기본 기준일 = 두 월급날 중 늦은 날(말일이 가장 늦음)', () => {
    expect(defaultBaseDay([25, null])).toBe(25);
    expect(defaultBaseDay([10, 25])).toBe(25);
    expect(defaultBaseDay([25, 'last'])).toBe('last');
    expect(defaultBaseDay([null, undefined])).toBeNull();
  });
});
