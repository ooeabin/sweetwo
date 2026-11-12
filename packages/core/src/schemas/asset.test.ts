import { describe, expect, it } from 'vitest';
import { AssetRowSchema, parsePaidCount, parseRate } from './asset';

describe('자산 입력 규칙(D5 = A, F-03과 F-04가 같음)', () => {
  it('금리 0~30%, 소수 1자리', () => {
    expect(parseRate('')).toBeNull();
    expect(parseRate('4.2')).toBe(4.2);
    expect(parseRate('0')).toBe(0);
    expect(parseRate('30')).toBe(30);
    expect(parseRate('30.1')).toBe('bad');
    expect(parseRate('4.25')).toBe('bad');
    expect(parseRate('100')).toBe('bad');
    expect(parseRate('.5')).toBe('bad');
  });
  it('납입 회차 0~999', () => {
    expect(parsePaidCount('')).toBeNull();
    expect(parsePaidCount('24')).toBe(24);
    expect(parsePaidCount('999')).toBe(999);
    expect(parsePaidCount('1000')).toBe('bad');
    expect(parsePaidCount('3.5')).toBe('bad');
  });
});

describe('asset 응답 검사', () => {
  it('비어 있을 수 있는 열은 null로 채움, 필수 열이 틀리면 거절', () => {
    const r = AssetRowSchema.parse({
      id: 'a1',
      side: 'asset',
      grp: 'cash',
      kind: 'bank',
      name: '통장',
      amount: 1000,
      owner: 'joint',
      visibility: 'all',
    });
    expect(r).toMatchObject({ principal: null, status: 'held', estimated: false });
    expect(AssetRowSchema.safeParse({ ...r, amount: 1.5 }).success).toBe(false);
    expect(AssetRowSchema.safeParse({ ...r, side: 'x' }).success).toBe(false);
  });
});
