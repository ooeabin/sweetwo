import { describe, expect, it } from 'vitest';
import { copy } from './copy';

describe('W-11b 매달 금액 안내(2026-11-23)', () => {
  it('미계획 금액이 있으면 “안에서 정해 보세요”, 용돈 말은 없음', () => {
    expect(copy.addMonthlyHelp('550,000원', '350,000원', true)).toBe(
      '미계획 금액 550,000원 안에서 정해 보세요',
    );
  });
  it('0원 이하면 예전 문구', () => {
    expect(copy.addMonthlyHelp('0원', '350,000원', false)).toBe(
      '미계획 금액 0원, 용돈 350,000원 빼고',
    );
    expect(copy.addMonthlyHelp('0원', undefined, false)).toBe('미계획 금액 0원');
  });
});
