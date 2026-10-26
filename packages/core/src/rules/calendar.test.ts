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

it('돈 일정: 월급날, 월말 확인 띠, 목표 기한, 매년 목표 쓰는 달, 만기', () => {
  const r = moneyDates(2026, 10, {
    paydays: [
      { name: '찬우', day: 25 },
      { name: '예빈', day: 10 },
    ],
    reviewDay: 25,
    maturities: [
      { id: 'a', name: '청년 적금', date: '2026-10-30' },
      { id: 'b', name: '예금', date: '2027-01-01' },
    ],
    goalDeadlines: [
      { id: 'h', name: '내 집 마련', date: '2026-10-01' },
      { id: 't', name: '여행', date: '2027-03-01' },
    ],
    yearlyGoals: [{ id: 'g', name: '자동차 유지비', month: 10 }],
  });
  expect(r.dates.map((d) => `${d.date} ${d.kind} ${d.name}`)).toEqual([
    '2026-10-01 deadline 내 집 마련',
    '2026-10-01 goal 자동차 유지비',
    '2026-10-09 payday 예빈',
    '2026-10-22 review ',
    '2026-10-23 payday 찬우',
    '2026-10-30 maturity 청년 적금',
  ]);
  expect(r.bands).toEqual([{ start: '2026-10-22', end: '2026-10-24' }]);
});

it('합쳐서 모드: 월급날 하나(이름 없음), 월말 확인은 공동 사이클 날 기준', () => {
  const r = moneyDates(2026, 11, {
    paydays: [{ name: '', day: 10 }],
    reviewDay: 10,
    maturities: [],
    goalDeadlines: [],
    yearlyGoals: [],
  });
  expect(r.dates.map((d) => `${d.date} ${d.kind} ${d.name}`)).toEqual([
    '2026-11-07 review ',
    '2026-11-10 payday ',
  ]);
  // 12월 10일 앞 띠(12-07~09)는 11월에 걸치지 않음
  expect(r.bands).toEqual([{ start: '2026-11-07', end: '2026-11-09' }]);
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
    reviewDay: null,
    maturities: [],
    goalDeadlines: [],
    yearlyGoals: [],
  };
  expect(moneyDates(2026, 10, o).dates[0]?.date).toBe('2026-10-23');
  expect(moneyDates(2026, 10, { ...o, shift: false }).dates[0]?.date).toBe('2026-10-25');
  expect(
    moneyDates(2026, 9, { ...o, holidays: new Set(['2026-09-24', '2026-09-25']) }).dates[0]?.date,
  ).toBe('2026-09-23'); // 추석 25일, 연휴 24일 → 23일
});
