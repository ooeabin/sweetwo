import { expect, it } from 'vitest';
import {
  salaryChangeApplyDay,
  salaryChangeAppliedDay,
  salaryChangeDay,
  salaryChangedTaskOpen,
  salaryChangeImmediate,
  salaryChangeInput,
  salaryChangeMonthsAhead,
  salaryChangeRevertDay,
  salaryChangeState,
} from './salary-change';

// 예빈 월급날 25일, 2027년 3월부터 육아휴직 150만(06 3-2 예), 2027년 12월까지
const c = {
  id: 's',
  amount: 1_500_000,
  effective_from: '2027-03-01',
  until_month: '2027-12-01',
  revert_amount: null,
  applied_at: null,
  reverted_at: null,
  cancelled_at: null,
};

it('적용일 = 그 달 사이클 시작일, 되돌림 = until 다음 달 사이클 시작일(서버 salary_change_day)', () => {
  expect(salaryChangeApplyDay(c, 25)).toBe('2027-03-25');
  expect(salaryChangeRevertDay(c, 25)).toBe('2028-01-25');
  expect(salaryChangeRevertDay({ until_month: null }, 25)).toBeNull();
  // 말일·짧은 달, 날짜 없음은 1일
  expect(salaryChangeDay('2027-02-01', 'last')).toBe('2027-02-28');
  expect(salaryChangeDay('2027-02-01', 30)).toBe('2027-02-28');
  expect(salaryChangeDay('2027-02-01', null)).toBe('2027-02-01');
});

it('이번 달부터는 월급날 전이어도 바로, 미래 달은 예약(2026-11-13 P2 = A)', () => {
  expect(salaryChangeImmediate({ effective_from: '2026-11-01' }, 10, '2026-11-13')).toBe(true);
  expect(salaryChangeImmediate({ effective_from: '2026-11-01' }, 25, '2026-11-13')).toBe(true);
  expect(salaryChangeImmediate({ effective_from: '2026-12-01' }, 25, '2026-11-13')).toBe(false);
  expect(salaryChangeImmediate({ effective_from: '2026-12-01' }, 1, '2026-12-01')).toBe(true);
});

it('실제로 적용된 날: 월급날 전에 바로 적용했으면 그날(띠 6번)', () => {
  const now = { effective_from: '2026-11-01', applied_at: '2026-11-13T01:00:00Z' };
  expect(salaryChangeAppliedDay(now, 25)).toBe('2026-11-13');
  expect(salaryChangeAppliedDay({ ...now, applied_at: '2026-11-24T15:30:00Z' }, 25)).toBe(
    '2026-11-25',
  );
  expect(
    salaryChangeAppliedDay(
      { effective_from: '2027-03-01', applied_at: '2027-03-24T15:01:00Z' },
      25,
    ),
  ).toBe('2027-03-25');
  expect(salaryChangeAppliedDay({ ...now, applied_at: null }, 25)).toBeNull();
});

it('상태', () => {
  expect(salaryChangeState(c)).toBe('scheduled');
  expect(salaryChangeState({ ...c, applied_at: 'x' })).toBe('applied');
  expect(salaryChangeState({ ...c, applied_at: 'x', reverted_at: 'y' })).toBe('reverted');
  expect(salaryChangeState({ ...c, cancelled_at: 'z' })).toBe('cancelled');
});

it('월급이 바뀐 달 띠: 적용된 사이클 첫 7일, W-01을 열면 끝', () => {
  const o = { appliedDay: '2027-03-25', done: false };
  expect(salaryChangedTaskOpen({ ...o, today: '2027-03-25' })).toBe(true);
  expect(salaryChangedTaskOpen({ ...o, today: '2027-03-31' })).toBe(true);
  expect(salaryChangedTaskOpen({ ...o, today: '2027-04-01' })).toBe(false);
  expect(salaryChangedTaskOpen({ ...o, done: true, today: '2027-03-26' })).toBe(false);
});

it('S-11c 입력(서버 schedule_salary_change 검사)', () => {
  const s = salaryChangeInput('2026-11');
  expect(s.safeParse({ amount: 1_500_000, from: '2027-03', until: '2027-12' }).success).toBe(true);
  expect(s.safeParse({ amount: 1_500_000, from: '2026-10', until: null }).success).toBe(false);
  expect(s.safeParse({ amount: 1_500_000, from: '2027-03', until: '2027-02' }).success).toBe(false);
  expect(s.safeParse({ amount: 100_000_000_000, from: '2027-03', until: null }).success).toBe(
    false,
  );
  expect(salaryChangeMonthsAhead('2026-11', '2027-03')).toBe(4);
});
