import { describe, expect, it } from 'vitest';
import { copy } from './copy';

// 홈 타일·카드 보조 줄 문구(19 H-04·H-08·H-10, 2026-11-20)
describe('홈 보조 줄', () => {
  it('H-04 이름표 “순자산” + 값(2026-11-23 바탕 기준: 자산·부채 줄은 없앰)', () => {
    expect(copy.netLabel).toBe('순자산');
  });
  it('H-08 다음 일정 기준: “다음 일정 D-8”, 당일, 없음', () => {
    expect(copy.nextSchedule(8)).toBe('다음 일정 D-8');
    expect(copy.nextSchedule(0)).toBe('오늘 일정 있어요');
    expect(copy.nextSchedule(null)).toBe('다가오는 일정이 없어요');
  });
  it('H-10 보조 한 줄: 목표 금액이 있으면 “10%, 300만 원 중”', () => {
    expect(copy.pctOfTarget(10, '300만 원')).toBe('10%, 300만 원 중');
    expect(copy.thisMonthGain('30만 원')).toBe('이번 달 +30만 원');
  });
  it('H-16 머리, 할 일 시트 알약', () => {
    expect(copy.upcomingTitle).toBe('다가오는 날');
    expect(copy.taskDecided).toBe('정했어요');
    expect(copy.ddayShort(8)).toBe('D-8');
  });
});
