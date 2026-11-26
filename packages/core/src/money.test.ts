import { describe, expect, it } from 'vitest';
import { ceilTo10k, formatWon, formatWonCap, readWon, readWonCap } from './money';

describe('금액 표기(11 공통 6장, 2026-11-26 토스식)', () => {
  it('원 단위 그대로 쉼표 + 붙여 쓴 원', () => {
    expect(formatWon(0)).toBe('0원');
    expect(formatWon(8_500)).toBe('8,500원');
    expect(formatWon(3_500_000)).toBe('3,500,000원');
    expect(formatWon(1_390_000)).toBe('1,390,000원');
    expect(formatWon(3_205_000)).toBe('3,205,000원');
    expect(formatWon(150_000_000)).toBe('150,000,000원');
    expect(formatWon(99_999_999_999)).toBe('99,999,999,999원');
  });
  it('음수는 빼기 기호 −', () => {
    expect(formatWon(-1_200_000)).toBe('−1,200,000원');
    expect(formatWon(-500)).toBe('−500원');
  });
  it('합계 999억+', () => {
    expect(formatWonCap(99_999_999_999)).toBe('99,999,999,999원');
    expect(formatWonCap(100_000_000_000)).toBe('999억+');
    expect(formatWonCap(-120_000_000_000)).toBe('−999억+');
    expect(formatWonCap(-12_000_000)).toBe('−12,000,000원');
  });
});

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
