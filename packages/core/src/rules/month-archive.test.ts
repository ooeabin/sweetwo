import { expect, it } from 'vitest';
import { archiveRow, pastPeriods } from './month-archive';

// W-21 지난 달 모아보기(20 W-21). 예시: 찬우, 수입 350만, 저금 100만(손) + 생활비 150만(손) + 고정지출 60만(자동)
const MAN = 10_000;
const line = (
  kind: string,
  state: string,
  planned: number,
  actual: number | null = null,
  auto = false,
) => ({ kind, state, planned: planned * MAN, actual: actual === null ? null : actual * MAN, auto });

it('모두 체크: 계획대로, 모은 금액 = 체크한 저금 줄 합, 수입 그대로', () => {
  const r = archiveRow({
    lines: [
      line('saving', 'checked', 100),
      line('living', 'checked', 150),
      line('fixed', 'checked', 60, null, true),
    ],
    lateCount: 0,
  });
  expect(r).toEqual({ result: 'all', lateCount: 0, planned: 310 * MAN, saved: 100 * MAN });
});

it('건너뜀이 섞이면 확인을 마쳤어요, 건너뛴 저금은 모은 금액에 안 들어감, 다른 금액은 그 금액', () => {
  const r = archiveRow({
    lines: [
      line('saving', 'skipped', 100),
      line('saving', 'checked', 30, 20),
      line('living', 'checked', 150),
    ],
    lateCount: 0,
  });
  expect(r.result).toBe('mixed');
  expect(r.saved).toBe(20 * MAN);
});

it('늦게 확인할 줄이 남았으면 late(확인할 것 n개)', () => {
  const r = archiveRow({
    lines: [line('saving', 'skipped', 100), line('living', 'checked', 150)],
    lateCount: 1,
  });
  expect(r).toMatchObject({ result: 'late', lateCount: 1, saved: 0 });
});

it('계획한 월급 = 그 달 줄 계획 합(달마다 다름)', () => {
  const r = archiveRow({
    lines: [line('saving', 'checked', 100), line('living', 'checked', 150)],
    lateCount: 0,
  });
  expect(r.planned).toBe(250 * MAN);
  const r2 = archiveRow({ lines: [line('saving', 'checked', 80)], lateCount: 0 });
  expect(r2.planned).toBe(80 * MAN);
});

it('자동 줄뿐이면 모두 체크일 때 계획대로', () => {
  const r = archiveRow({
    lines: [line('fixed', 'checked', 60, null, true)],
    lateCount: 0,
  });
  expect(r.result).toBe('all');
});

// 07 6장 예시: 10월 3일 200만, 10월 20일 140만 → 기간 10.03~11.01. 11월 5일 80만 → 새 기간 11.05~12.04
const ins = [
  { amount: 200 * MAN, received_on: '2026-10-03' },
  { amount: 140 * MAN, received_on: '2026-10-20' },
  { amount: 80 * MAN, received_on: '2026-11-05' },
];

it('날짜 없는 사람: 끝난 기간만 최근부터, 진행 중 기간은 뺌', () => {
  expect(pastPeriods(ins, '2026-11-10')).toEqual([
    { start: '2026-10-03', end: '2026-11-01', received: 340 * MAN, count: 2 },
  ]);
  expect(pastPeriods(ins, '2026-12-10')).toEqual([
    { start: '2026-11-05', end: '2026-12-04', received: 80 * MAN, count: 1 },
    { start: '2026-10-03', end: '2026-11-01', received: 340 * MAN, count: 2 },
  ]);
});

it('날짜 없는 사람: 기록이 없거나 지운 기록·오늘 뒤 기록은 셈하지 않음', () => {
  expect(pastPeriods([], '2026-11-10')).toEqual([]);
  expect(
    pastPeriods(
      [
        { amount: 10 * MAN, received_on: '2026-09-01', deleted_at: '2026-09-02T00:00:00Z' },
        { amount: 10 * MAN, received_on: '2026-12-01' },
      ],
      '2026-11-10',
    ),
  ).toEqual([]);
});
