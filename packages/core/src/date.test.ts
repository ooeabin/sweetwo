import { expect, test } from 'vitest';
import {
  formatDateDot,
  parseDateDot,
  parseTimeText,
  formatDot2,
  formatKstDateTime,
  formatKstMonthDayTime,
  hoursBetween,
} from './date';
import * as dt from './date';

test('어드민 시각은 KST', () => {
  expect(formatKstDateTime('2026-10-18T05:05:00Z')).toBe('2026-10-18 14:05');
  expect(formatKstDateTime('2026-10-18T16:30:00Z')).toBe('2026-10-19 01:30');
});

test('경과 시간(시간 단위 내림)', () => {
  expect(hoursBetween('2026-10-18T00:00:00Z', new Date('2026-10-19T01:59:00Z'))).toBe(25);
  expect(hoursBetween('2026-10-19T00:00:00Z', new Date('2026-10-18T00:00:00Z'))).toBe(0);
});

test('오프라인 띠 마지막 저장 시각은 KST 월·일 + 시각', () => {
  expect(formatKstMonthDayTime('2026-10-27T06:05:00Z')).toBe('10월 27일 15:05');
  expect(formatKstMonthDayTime('2026-10-27T16:30:00Z')).toBe('10월 28일 01:30');
});

test('formatDot2: 두 자리 월.일', () => {
  expect(formatDot2('2026-08-26')).toBe('08.26');
});

test('서버 시각의 KST 날짜(S6-10): UTC 전날 15시 이후는 KST 다음 날', () => {
  const { kstDateOf } = dt;
  expect(kstDateOf('2026-10-24T14:59:59Z')).toBe('2026-10-24');
  expect(kstDateOf('2026-10-24T15:00:00Z')).toBe('2026-10-25');
  expect(kstDateOf('2026-10-25T00:30:00+09:00')).toBe('2026-10-25');
});

test('formatDayWeekday: 일 + 요일', () => {
  expect(dt.formatDayWeekday('2026-12-24')).toBe('24일 목요일');
  expect(dt.formatDayWeekday('2026-10-11')).toBe('11일 일요일');
});

test('formatDateDot·parseDateDot·parseTimeText: 어드민 날짜 칸', () => {
  expect(formatDateDot('2026-11-25')).toBe('2026.11.25');
  expect(parseDateDot('2026.11.25')).toBe('2026-11-25');
  expect(parseDateDot('20261125')).toBe('2026-11-25');
  expect(parseDateDot('2026-1-5')).toBe('2026-01-05');
  expect(parseDateDot('2026.02.30')).toBeNull();
  expect(parseDateDot('11.25')).toBeNull();
  expect(parseTimeText('1400')).toBe('14:00');
  expect(parseTimeText('9:05')).toBe('09:05');
  expect(parseTimeText('24:00')).toBeNull();
});

test('달력 시트: 요일 포함 표기(2026-11-24)', () => {
  expect(dt.formatDateDow('2026-11-26')).toBe('2026년 11월 26일 (목)');
  expect(dt.formatMonthDayDow('2026-11-01')).toBe('11월 1일 (일)');
  expect(dt.formatDateReadout('2026-11-26')).toBe('2026년 11월 26일 목요일');
  expect(dt.weekdayIndex('2026-11-28')).toBe(6);
});

test('달력 시트: 한 달 칸(일요일 시작, 앞 빈 칸)', () => {
  // 2026년 11월은 일요일 1일: 앞 빈 칸 0, 30일
  const nov = dt.monthCells(2026, 11);
  expect(nov[0]).toBe(1);
  expect(nov).toHaveLength(30);
  // 2026년 2월은 일요일 1일, 28일. 2026년 12월은 화요일 1일: 앞 빈 칸 2
  expect(dt.monthCells(2026, 12).slice(0, 3)).toEqual([null, null, 1]);
  // 윤년 2월 29일
  expect(dt.daysInMonth(2028, 2)).toBe(29);
  expect(dt.daysInMonth(2026, 2)).toBe(28);
});
