import { describe, expect, it } from 'vitest';
import { copy } from './copy';

describe('P-09 안내 조사(2026-11-16 r6)', () => {
  it('저금 이름 받침에 따라 와/과', () => {
    expect(copy.savedHelp('찬우', '이사')).toBe(
      '찬우님의 ‘이사’와 묶어서 둘이 모은 금액을 바로 보여 드려요',
    );
    expect(copy.savedHelp('찬우', '결혼 비용')).toBe(
      '찬우님의 ‘결혼 비용’과 묶어서 둘이 모은 금액을 바로 보여 드려요',
    );
    expect(copy.savedHelp('', '여행')).toBe(
      '파트너의 ‘여행’과 묶어서 둘이 모은 금액을 바로 보여 드려요',
    );
  });
});
