import { describe, expect, it } from 'vitest';
import { ceilTo10k, readWon } from './money';

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
