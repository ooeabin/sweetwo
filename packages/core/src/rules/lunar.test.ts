import { expect, it } from 'vitest';
import { lunarToSolar, solarToLunar } from './lunar';

// 한국천문연구원 음양력 자료와 대조
it('설·추석 양력 날짜', () => {
  expect(lunarToSolar(2026, 1, 1)).toBe('2026-02-17');
  expect(lunarToSolar(2026, 8, 15)).toBe('2026-09-25');
  expect(lunarToSolar(2027, 1, 1)).toBe('2027-02-07');
  expect(lunarToSolar(2027, 8, 15)).toBe('2027-09-15');
});

it('윤달이 없는 해는 평달, 작은달 30일은 29일, 2050년 넘으면 null', () => {
  expect(lunarToSolar(2026, 3, 5, true)).toBe(lunarToSolar(2026, 3, 5, false));
  expect(lunarToSolar(2051, 1, 1)).toBeNull();
  expect(solarToLunar('2026-09-25')).toEqual({ month: 8, day: 15, leap: false });
});
