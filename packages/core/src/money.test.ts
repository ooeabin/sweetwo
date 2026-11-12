import { describe, expect, it } from 'vitest';
import { ceilTo10k, readWon, readWonCap } from './money';

describe('만 원 단위 읽기(Q3 읽기 형식)', () => {
  it('기획서 예시 그대로', () => {
    expect(readWon(5_000)).toBe('5,000원');
    expect(readWon(3_200_000)).toBe('320만 원');
    expect(readWon(3_205_000)).toBe('320만 5,000원');
    expect(readWon(120_000_000)).toBe('1억 2,000만 원');
    expect(readWon(200_000_000)).toBe('2억 원');
    expect(readWon(30_000_000)).toBe('3,000만 원');
    expect(readWon(500_000_000)).toBe('5억 원');
  });
  it('1만 원 단위 올림', () => {
    expect(ceilTo10k(2_500_000)).toBe(2_500_000);
    expect(ceilTo10k(2_500_001)).toBe(2_510_000);
  });
});

describe('readWonCap(합계 999억+, 11 공통 6장)', () => {
  it('999억 안은 그대로, 넘으면 999억+', () => {
    expect(readWonCap(99_999_999_999)).toBe('999억 9,999만 9,999원');
    expect(readWonCap(100_000_000_000)).toBe('999억+');
    expect(readWonCap(250_000_000_000)).toBe('999억+');
    expect(readWonCap(-120_000_000_000)).toBe('−999억+');
    expect(readWonCap(-12_000_000)).toBe('−1,200만 원');
  });
});
