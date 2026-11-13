import { describe, expect, it } from 'vitest';
import {
  addMonthsToDate,
  autoDayIn,
  autoDue,
  autoPickTaskOpen,
  canLateCheck,
  confirmableLines,
  confirmFinish,
  cycleOf,
  firstChecklistStart,
  isConfirmed,
  lateCheckUntil,
  nextAutoDue,
  reviewDue,
} from './pay-confirm';

describe('자동 줄 나가는 날(서버 auto_due_date, 07 3장)', () => {
  // 찬우 월급날 25일, 사이클 10월 25일 ~ 11월 24일
  it('null = 월급날', () => expect(autoDue('2026-10-25', '2026-11-24', null)).toBe('2026-10-25'));
  it('사이클 시작 뒤 그 달의 그날', () =>
    expect(autoDue('2026-10-25', '2026-11-24', 26)).toBe('2026-10-26'));
  it('시작보다 앞선 날이면 다음 달의 그날', () =>
    expect(autoDue('2026-10-25', '2026-11-24', 5)).toBe('2026-11-05'));
  it('말일(31)은 그 달 말일', () =>
    expect(autoDue('2026-10-25', '2026-11-24', 31)).toBe('2026-10-31'));
  it('짧은 달 말일: 2월 사이클 30일은 2월 28일', () =>
    expect(autoDue('2027-02-01', '2027-02-28', 30)).toBe('2027-02-28'));
  it('끝보다 뒤면 끝(25일 사이클에 24일 → 다음 달 24일 = 끝)', () =>
    expect(autoDue('2027-01-25', '2027-02-24', 24)).toBe('2027-02-24'));
  it('말일 월급(31) 사이클, 짧은 다음 달', () =>
    expect(autoDue('2027-01-31', '2027-02-27', 15)).toBe('2027-02-15'));
});

it('오늘이 든 사이클과 첫 사이클(소급 없음, 07 3-1)', () => {
  expect(cycleOf('2026-11-13', 25)).toEqual({ start: '2026-10-25', end: '2026-11-24' });
  expect(cycleOf('2026-11-25', 25)).toEqual({ start: '2026-11-25', end: '2026-12-24' });
  expect(cycleOf('2027-02-28', 'last')).toEqual({ start: '2027-02-28', end: '2027-03-30' });
  // 11월 13일 온보딩 → 첫 목록 11월 25일. 그날 만들었으면 그날
  expect(firstChecklistStart('2026-11-13', 25)).toBe('2026-11-25');
  expect(firstChecklistStart('2026-11-25', 25)).toBe('2026-11-25');
  expect(firstChecklistStart('2026-11-26', 25)).toBe('2026-12-25');
  expect(firstChecklistStart('2026-11-13', null)).toBeNull();
});

it('늦은 확인(서버 late_check_until, 07 4장): 그다음 사이클 끝까지', () => {
  // 10월 25일 사이클(끝 11월 24일) → 다음 사이클 11월 25일 ~ 12월 24일
  expect(lateCheckUntil('2026-11-24', 25)).toBe('2026-12-24');
  expect(canLateCheck('2026-12-24', '2026-11-24', 25)).toBe(true);
  expect(canLateCheck('2026-12-25', '2026-11-24', 25)).toBe(false);
  expect(canLateCheck('2026-11-24', '2026-11-24', 25)).toBe(false);
  // 말일 월급: 1월 31일 사이클(끝 2월 27일) → 2월 28일 ~ 3월 30일
  expect(lateCheckUntil('2027-02-27', 'last')).toBe('2027-03-30');
  // 날짜 없음으로 바꿈: 다음 시작 + 1달 − 1일
  expect(lateCheckUntil('2026-11-24', null)).toBe('2026-12-24');
  expect(addMonthsToDate('2027-01-31', 1)).toBe('2027-02-28');
});

describe('손 줄과 확인 끝(07 7장)', () => {
  const lines = [
    { state: 'wait', auto: false, kind: 'saving' },
    { state: 'wait', auto: true, auto_due: '2026-10-26', kind: 'fixed' },
    { state: 'wait', auto: true, auto_due: '2026-10-26', kind: 'send' },
    { state: 'wait', auto: true, auto_due: '2026-11-05', kind: 'fixed' },
  ];
  it('자동 줄은 따로 요구하지 않음', () => {
    expect(isConfirmed(lines)).toBe(false);
    expect(isConfirmed(lines.slice(1))).toBe(true);
    expect(confirmFinish([{ state: 'checked' }, { state: 'wait', auto: true }])).toBe('all');
    expect(confirmFinish([{ state: 'checked' }, { state: 'skipped' }])).toBe('mixed');
    expect(confirmFinish(lines)).toBeNull();
  });
  it('다음 자동 확인 “26일에 2개”', () => {
    expect(nextAutoDue(lines)).toEqual({ date: '2026-10-26', count: 2 });
    expect(nextAutoDue([{ state: 'checked', auto: true, auto_due: '2026-10-26' }])).toBeNull();
  });
  it('월급 전 확인은 손 줄이 남았을 때만', () => {
    expect(reviewDue('2026-11-22', '2026-11-24', lines)).toBe(true);
    expect(reviewDue('2026-11-22', '2026-11-24', lines.slice(1))).toBe(false);
    expect(reviewDue('2026-11-21', '2026-11-24', lines)).toBe(false);
  });
});

it('“모두 계획대로 됐어요” 권한(confirm_payday): 각자 주인만, 합쳐서 누구나, 남의 용돈 줄 건너뜀', () => {
  const lines = [
    { state: 'wait', kind: 'saving', user_id: null },
    { state: 'wait', kind: 'allowance', user_id: 'y' },
    { state: 'wait', kind: 'allowance', user_id: 'c' },
    { state: 'wait', kind: 'send', user_id: 'y', auto: true },
  ];
  expect(confirmableLines(lines, { joint: false, ownerId: 'y', meId: 'c' })).toEqual([]);
  expect(confirmableLines(lines, { joint: false, ownerId: 'c', meId: 'c' })).toHaveLength(3);
  expect(
    confirmableLines(lines, { joint: true, ownerId: null, meId: 'c' }).map((l) => l.user_id),
  ).toEqual([null, 'c']);
});

it('자동 줄 고르기 띠(H-06 9번): 첫 월급날 7일 전 ~ 전날', () => {
  const o = { firstPayday: '2026-11-25', autoLines: 0, manualLines: 3, done: false };
  expect(autoPickTaskOpen({ ...o, today: '2026-11-17' })).toBe(false);
  expect(autoPickTaskOpen({ ...o, today: '2026-11-18' })).toBe(true);
  expect(autoPickTaskOpen({ ...o, today: '2026-11-24' })).toBe(true);
  expect(autoPickTaskOpen({ ...o, today: '2026-11-25' })).toBe(false);
  expect(autoPickTaskOpen({ ...o, today: '2026-11-20', autoLines: 1 })).toBe(false);
  expect(autoPickTaskOpen({ ...o, today: '2026-11-20', done: true })).toBe(false);
});

it('날짜 없는 사람 자동 저금 나가는 날(기본 1일, 31 = 말일)', () => {
  expect(autoDayIn('2027-02', null)).toBe('2027-02-01');
  expect(autoDayIn('2027-02', 31)).toBe('2027-02-28');
});
