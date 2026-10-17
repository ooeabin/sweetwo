import { expect, it } from 'vitest';
import { businessDayOnOrBefore, monthGrid, moneyDates } from './calendar';

it('달력 칸: 일요일 시작 6주, 다른 달은 muted', () => {
  const g = monthGrid(2026, 10);
  expect(g).toHaveLength(42);
  expect(g[0]).toEqual({ date: '2026-09-27', day: 27, muted: true });
  expect(g[4]).toEqual({ date: '2026-10-01', day: 1, muted: false });
});

it('주말 월급날은 직전 금요일', () => {
  expect(businessDayOnOrBefore('2026-10-25')).toBe('2026-10-23'); // 일요일
  expect(businessDayOnOrBefore('2026-10-24')).toBe('2026-10-23'); // 토요일
  expect(businessDayOnOrBefore('2026-10-23')).toBe('2026-10-23');
});

it('돈 날짜: 월급날, 정리 띠, 만기, 제안, 들어오는 돈(한 번이면 처음 오는 그 달), 매년 목표', () => {
  const r = moneyDates(2026, 10, {
    paydays: [
      { name: '찬우', day: 25 },
      { name: '예빈', day: 10 },
    ],
    baseDay: 25,
    maturities: [
      { id: 'a', name: '청년 적금', date: '2026-10-30' },
      { id: 'b', name: '예금', date: '2027-01-01' },
    ],
    proposals: [{ id: 'p', date: '2026-10-25' }],
    income: [
      { name: '상여금', month: 10, yearly: true, createdOn: '2026-01-05' },
      { name: '환급', month: 10, yearly: false, createdOn: '2026-11-01' },
    ],
    yearlyGoals: [{ id: 'g', name: '자동차 유지비', month: 10 }],
  });
  expect(r.dates.map((d) => `${d.date} ${d.kind} ${d.name}`)).toEqual([
    '2026-10-01 income 상여금',
    '2026-10-01 goal 자동차 유지비',
    '2026-10-09 payday 예빈',
    '2026-10-22 close ',
    '2026-10-23 payday 찬우',
    '2026-10-25 proposal ',
    '2026-10-30 maturity 청년 적금',
  ]);
  expect(r.bands).toEqual([{ start: '2026-10-22', end: '2026-10-24' }]);
  // 한 번만 들어오는 돈은 다음 해 10월
  expect(
    moneyDates(2027, 10, {
      paydays: [],
      baseDay: null,
      maturities: [],
      proposals: [],
      income: [{ name: '환급', month: 10, yearly: false, createdOn: '2026-11-01' }],
      yearlyGoals: [],
    }).dates,
  ).toHaveLength(1);
});
