import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, formatDateFull, formatDateWeekday } from '../date';
import {
  closePeriod,
  inClosePeriod,
  livingLeft,
  nextDayOf,
  upcoming,
  weddingStatus,
} from './this-month';

const M = 10_000;

describe('날짜 표기', () => {
  it('오늘 띠 날짜와 예식일', () => {
    expect(formatDateWeekday('2026-10-11')).toBe('10월 11일 일요일');
    expect(formatDateFull('2027-01-09')).toBe('2027년 1월 9일');
    expect(daysBetween('2026-10-14', '2027-01-09')).toBe(87);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('이번 달 남은 생활비(06 3장)', () => {
  it('예산 − 변동 입력, 넘으면 음수, 예산 0이면 % 없음', () => {
    expect(livingLeft(130 * M, 98 * M)).toEqual({ left: 32 * M, over: false, pct: 25 });
    expect(livingLeft(130 * M, 140 * M)).toEqual({ left: -10 * M, over: true, pct: 0 });
    expect(livingLeft(0, 0).pct).toBeNull();
  });
});

describe('월말 정리 기간과 다가오는 일정(07 2장, H-07)', () => {
  it('정리 기간 = 다음 기준일 3일 전 ~ 전날', () => {
    expect(closePeriod('2026-10-24')).toEqual({ start: '2026-10-22', end: '2026-10-24' });
    expect(inClosePeriod('2026-10-21', '2026-10-24')).toBe(false);
    expect(inClosePeriod('2026-10-22', '2026-10-24')).toBe(true);
  });
  it('다음 월급날(오늘 포함, 없는 날은 말일)', () => {
    expect(nextDayOf('2026-10-07', 25)).toBe('2026-10-25');
    expect(nextDayOf('2026-10-26', 25)).toBe('2026-11-25');
    expect(nextDayOf('2027-02-01', 31)).toBe('2027-02-28');
    expect(nextDayOf('2026-10-31', 'last')).toBe('2026-10-31');
  });
  it('30일 안 날짜순, 첫 정리를 합치면 정리 기간 없음', () => {
    const base = {
      today: '2026-10-07',
      paydays: [{ who: '찬우', day: 25 as const }],
      cycleEnd: '2026-10-24',
    };
    expect(upcoming({ ...base, mergedClose: false })).toEqual([
      { date: '2026-10-22', kind: 'close', dday: 15 },
      { date: '2026-10-25', kind: 'payday', who: '찬우', dday: 18 },
    ]);
    expect(upcoming({ ...base, mergedClose: true }).map((u) => u.kind)).toEqual(['payday']);
    expect(upcoming({ ...base, mergedClose: false, weddingDate: '2027-01-09' })).toHaveLength(2);
  });
});

describe('결혼 비용 현황(06 11장 예시)', () => {
  it('3,000 − 1,000 − 900 − 800 = 부족 300만', () => {
    expect(
      weddingStatus({
        budget: 3_000 * M,
        support: 1_000 * M,
        saved: 900 * M,
        monthlyPlan: 100 * M,
        monthsLeft: 8,
      }),
    ).toEqual({
      toSave: 1_100 * M,
      shortfall: 300 * M,
      surplus: 0,
    });
  });
  it('계획대로 모으면 부족 0, 양가 지원 + 모아둔 돈이 넘치면 여유', () => {
    expect(
      weddingStatus({
        budget: 3_000 * M,
        support: 1_000 * M,
        saved: 900 * M,
        monthlyPlan: 140 * M,
        monthsLeft: 8,
      }).shortfall,
    ).toBe(0);
    expect(
      weddingStatus({
        budget: 3_000 * M,
        support: 2_000 * M,
        saved: 1_200 * M,
        monthlyPlan: 0,
        monthsLeft: 8,
      }),
    ).toEqual({
      toSave: 0,
      shortfall: 0,
      surplus: 200 * M,
    });
  });
});
