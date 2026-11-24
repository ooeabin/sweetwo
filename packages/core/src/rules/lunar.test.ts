import { expect, it } from 'vitest';
import { lunarDaySolar, lunarMonthCells, lunarToSolar, solarToLunar } from './lunar';

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

it('음력 한 달 달력 칸: 첫날의 양력 요일에 맞춤(2026-11-24)', () => {
  // 음력 2026-8-1 = 양력 2026-09-11(금) → 앞 빈 칸 5
  const cells = lunarMonthCells(2026, 8);
  expect(cells?.slice(0, 6)).toEqual([null, null, null, null, null, 1]);
  expect(cells?.filter((c) => c !== null).length).toBeGreaterThanOrEqual(29);
  // 그해 윤달이 없으면 null, 지원 범위 밖도 null
  expect(lunarMonthCells(2026, 3, true)).toBeNull();
  expect(lunarMonthCells(2051, 1)).toBeNull();
  expect(lunarDaySolar(2026, 8, 15)).toBe('2026-09-25');
});
