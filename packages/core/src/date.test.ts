import { expect, test } from 'vitest';
import { formatKstDateTime, formatKstMonthDayTime, hoursBetween } from './date';

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
