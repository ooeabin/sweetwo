import { businessDayOnOrBefore } from '@sweetwo/core';
import { describe, expect, it } from 'vitest';
import { firstPaydayLabel } from './first-payday';

// O-55·O-60 첫 월급날(2026-11-16 5차 검토 B2): 앞당기기(07 1장)를 반영
describe('firstPaydayLabel', () => {
  const me = { monthly_income: 3_000_000, payday: 25, payday_last: false, payday_none: false };
  const now = new Date('2026-12-10T03:00:00Z');
  const shift = (d: string) => businessDayOnOrBefore(d, new Set(['2026-12-25']));
  it('앞당기지 않으면 원래 날', () => expect(firstPaydayLabel(me, now)).toBe('12월 25일'));
  it('공휴일이면 직전 영업일', () => expect(firstPaydayLabel(me, now, shift)).toBe('12월 24일'));
  it('주말이면 직전 금요일(2027-04-25 일 → 23일)', () =>
    expect(firstPaydayLabel(me, new Date('2027-04-10T03:00:00Z'), shift)).toBe('4월 23일'));
  it('날짜 없음·월급 없음은 null', () => {
    expect(firstPaydayLabel({ ...me, payday_none: true }, now, shift)).toBeNull();
    expect(firstPaydayLabel({ ...me, monthly_income: 0 }, now, shift)).toBeNull();
  });
});
