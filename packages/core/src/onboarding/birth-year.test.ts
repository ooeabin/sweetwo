import { expect, it } from 'vitest';
import { birthYearRange } from './birth-year';

it('생년월일 휠 범위: 1950년 ~ 올해 − 18년(KST)', () => {
  expect(birthYearRange(new Date('2026-10-15T03:00:00Z'))).toEqual({ min: 1950, max: 2008 });
  // 12월 31일 밤 KST는 다음 해
  expect(birthYearRange(new Date('2026-12-31T16:00:00Z')).max).toBe(2009);
});
