import { expect, it } from 'vitest';
import {
  moneyInPeriod,
  periodDisplay,
  periodFillPct,
  periodFilledBand,
  periodFull,
  periodNeeded,
} from './money-in-period';

// 06 2-2 예시(예빈, 프리랜서, 월급 계획 합 380만: 저금 100, 고정지출 120, 생활비 110, 용돈 50).
// 서버 money_in_period와 같은 예시(pgTAP v22_money_in)
const MAN = 10_000;
const needed = periodNeeded([
  { amount: 100 * MAN },
  { amount: 120 * MAN },
  { amount: 110 * MAN },
  { amount: 50 * MAN },
]);
const oct = [
  { amount: 200 * MAN, received_on: '2026-10-03' },
  { amount: 140 * MAN, received_on: '2026-10-20' },
];

it('필요한 돈 = 모든 줄 합(체크리스트에 넣기 상관없이), 여유 자금은 줄이 아님', () => {
  expect(needed).toBe(380 * MAN);
});

it('첫 돈 전: none', () => {
  expect(moneyInPeriod([], '2026-11-01', needed)).toEqual({
    status: 'none',
    start: null,
    end: null,
    day: null,
    received: 0,
    needed: null,
    gapDays: null,
  });
});

it('첫 기간 15일째(10월 17일): early 200만', () => {
  const p = moneyInPeriod(oct.slice(0, 1), '2026-10-17', needed);
  expect(p).toMatchObject({ status: 'early', start: '2026-10-03', end: '2026-11-01', day: 15 });
  expect(p.received).toBe(200 * MAN);
  expect(periodDisplay(p)).toBe('early');
});

it('16일째(10월 18일, S + 15): bar 200 / 380 = 52%(10월 20일 돈은 아직 미래)', () => {
  const p = moneyInPeriod(oct, '2026-10-18', needed);
  expect(p).toMatchObject({ status: 'bar', day: 16, received: 200 * MAN, needed: 380 * MAN });
  expect(periodFillPct(p.received, p.needed)).toBe(52);
  expect(periodFilledBand(p)).toBe(50);
  expect(periodFull(p)).toBe(false);
});

it('같은 기간 끝 E(11월 1일): bar 340 / 380 = 89%', () => {
  const p = moneyInPeriod(oct, '2026-11-01', needed);
  expect(p).toMatchObject({ status: 'bar', day: 30, received: 340 * MAN });
  expect(periodFillPct(p.received, p.needed)).toBe(89);
});

it('빈 날(11월 13일): gap, 마지막 10월 20일부터 24일', () => {
  const p = moneyInPeriod(oct, '2026-11-13', needed);
  expect(p).toMatchObject({ status: 'gap', gapDays: 24, day: null, start: '2026-10-03' });
});

it('새 기간(11월 14일 400만): early 새 S, 다 참(11월 29일 16일째) 100% 상한', () => {
  const rows = [...oct, { amount: 400 * MAN, received_on: '2026-11-14' }];
  const a = moneyInPeriod(rows, '2026-11-14', needed);
  expect(a).toMatchObject({
    status: 'early',
    start: '2026-11-14',
    end: '2026-12-13',
    day: 1,
    received: 400 * MAN,
  });
  const b = moneyInPeriod(rows, '2026-11-29', needed);
  expect(b).toMatchObject({ status: 'bar', day: 16 });
  expect(periodFillPct(b.received, b.needed)).toBe(100);
  expect(periodFull(b)).toBe(true);
});

it('경계: E 다음 날 받은 돈은 새 기간, 지운 기록은 빠짐, 필요한 돈 0이면 막대 없이 early 문장', () => {
  const rows = [
    { amount: 100 * MAN, received_on: '2026-10-03' },
    { amount: 50 * MAN, received_on: '2026-11-02' },
    { amount: 999 * MAN, received_on: '2026-11-02', deleted_at: '2026-11-03T00:00:00Z' },
  ];
  const p = moneyInPeriod(rows, '2026-11-02', 0);
  expect(p).toMatchObject({ status: 'early', start: '2026-11-02', received: 50 * MAN });
  const q = moneyInPeriod(rows, '2026-11-20', 0);
  expect(q.status).toBe('bar');
  expect(periodDisplay(q)).toBe('early');
  // 마지막 날(E = S + 29)에 받은 돈은 그 기간
  const r = moneyInPeriod(
    [
      { amount: 10 * MAN, received_on: '2026-10-03' },
      { amount: 20 * MAN, received_on: '2026-11-01' },
    ],
    '2026-11-01',
    needed,
  );
  expect(r).toMatchObject({ start: '2026-10-03', received: 30 * MAN });
});
