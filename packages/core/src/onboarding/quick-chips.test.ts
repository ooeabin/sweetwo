import { describe, expect, it } from 'vitest';
import { MAX_WON } from '../money';
import { addQuickAmount, quickChips } from './bands';

describe('addQuickAmount: 빠른 금액 칩은 지금 값에 더한다', () => {
  const plus100 = quickChips.small.find((c) => c.value === 1_000_000)?.value ?? 1_000_000;
  it('3,500,000에 +100만은 4,500,000', () => {
    expect(addQuickAmount(3_500_000, plus100)).toBe(4_500_000);
  });
  it('비어 있으면 칩 금액 그대로', () => {
    expect(addQuickAmount(null, plus100)).toBe(1_000_000);
  });
  it('0원에서도 더함', () => {
    expect(addQuickAmount(0, quickChips.small[0]?.value ?? 10_000)).toBe(10_000);
  });
  it('999억을 넘지 않음', () => {
    expect(addQuickAmount(MAX_WON - 10, plus100)).toBe(MAX_WON);
  });
});
