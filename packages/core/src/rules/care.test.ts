import { expect, it } from 'vitest';
import {
  careDatesInMonth,
  familyCostMonthly,
  monthsUntil,
  nextAnniversary,
  nextCareDate,
  type CareRule,
} from './care';

const r = (o: Partial<CareRule>): CareRule => ({
  date_rule: 'solar_yearly',
  month: null,
  day: null,
  leap: false,
  once_on: null,
  ...o,
});

it('다음 날짜: 양력은 올해 지났으면 내년, 음력은 그해 양력으로, 날짜 없으면 null', () => {
  expect(nextCareDate(r({ month: 5, day: 8 }), '2026-10-07')).toBe('2027-05-08');
  expect(nextCareDate(r({ month: 10, day: 14 }), '2026-10-07')).toBe('2026-10-14');
  // 음력 8월 15일(추석): 2026년은 9월 25일이 지났으니 2027년 9월 15일
  expect(nextCareDate(r({ date_rule: 'lunar_yearly', month: 8, day: 15 }), '2026-10-07')).toBe(
    '2027-09-15',
  );
  expect(nextCareDate(r({}), '2026-10-07')).toBeNull();
  expect(nextCareDate(r({ date_rule: 'once', once_on: '2026-11-01' }), '2026-10-07')).toBe(
    '2026-11-01',
  );
});

it('그 달 날짜: 음력 설은 2027년 2월', () => {
  const seollal = r({ date_rule: 'lunar_yearly', month: 1, day: 1 });
  expect(careDatesInMonth(seollal, 2027, 2)).toEqual(['2027-02-07']);
  expect(careDatesInMonth(seollal, 2027, 3)).toEqual([]);
});

it('양가 비용 월 적립: 1천 원 단위 올림, 다음 결혼기념일까지', () => {
  // 1년 288만 원, 회차 남은 6개월 → 48만
  expect(familyCostMonthly({ total: 2_880_000, monthsLeft: 6 })).toBe(480_000);
  expect(familyCostMonthly({ total: 1_000_000, monthsLeft: 7 })).toBe(143_000);
  expect(nextAnniversary('2025-04-18', '2026-10-07')).toBe('2027-04-18');
  expect(monthsUntil('2026-10-07', '2027-04-18')).toBe(6);
});
