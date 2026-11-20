import { describe, expect, it } from 'vitest';
import { copy } from './copy';

// 홈 타일·카드 보조 줄 문구(19 H-04·H-08·H-10, 2026-11-20)
describe('홈 보조 줄', () => {
  it('H-04 값 아래 “자산 …, 부채 …”, 이름표 “순자산”', () => {
    expect(copy.netLabel).toBe('순자산');
    expect(copy.assetsDebts('4,200만 원', '7,330만 원')).toBe('자산 4,200만 원, 부채 7,330만 원');
    expect(copy.assetsDebts('•••', '•••')).toBe('자산 •••, 부채 •••');
  });
  it('H-08 “이번 달 일정 n개”, 없으면 없다고', () => {
    expect(copy.monthSchedules(3)).toBe('이번 달 일정 3개');
    expect(copy.monthSchedules(0)).toBe('이번 달 일정이 없어요');
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
