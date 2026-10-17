import { expect, it } from 'vitest';
import { businessDayOnOrBefore, isFestive, monthGrid, moneyDates } from './calendar';

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

it('공휴일이면 직전 영업일(주말 넘어서까지)', () => {
  // 2026-10-05 대체공휴일(월) → 10-03 토, 10-04 일 지나 10-02 금
  expect(businessDayOnOrBefore('2026-10-05', new Set(['2026-10-03', '2026-10-05']))).toBe(
    '2026-10-02',
  );
  // 2026-09-25 추석(금), 24 연휴(목) → 23 수
  expect(businessDayOnOrBefore('2026-09-25', new Set(['2026-09-24', '2026-09-25']))).toBe(
    '2026-09-23',
  );
});
it('설·추석 연휴 띠', () => {
  expect(['설날', '설날 연휴', '대체공휴일(설날)', '추석 연휴', '개천절'].map(isFestive)).toEqual([
    true,
    true,
    true,
    true,
    false,
  ]);
});
it('앞당기기를 끄면 월급날 그대로', () => {
  const o = {
    paydays: [{ name: '찬우', day: 25 as const }],
    baseDay: null,
    maturities: [],
    proposals: [],
    income: [],
    yearlyGoals: [],
  };
  expect(moneyDates(2026, 10, o).dates[0]?.date).toBe('2026-10-23');
  expect(moneyDates(2026, 10, { ...o, shift: false }).dates[0]?.date).toBe('2026-10-25');
  expect(
    moneyDates(2026, 9, { ...o, holidays: new Set(['2026-09-24', '2026-09-25']) }).dates[0]?.date,
  ).toBe('2026-09-23'); // 추석 25일, 연휴 24일 → 23일
});
