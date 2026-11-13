import { describe, expect, it } from 'vitest';
import { largestRemainder, planRatio, splitShares } from './plan-ratio';

// 기획서 06 3-5 예시 표 그대로
const man = (n: number) => n * 10_000;

describe('비율(06 3-5)', () => {
  it('찬우 W-01: 350만, 저금 139만, 지출 203만 → 40 / 58 / 2', () => {
    expect(planRatio({ income: man(350), saving: man(139), spend: man(203) })).toEqual({
      saving: 40,
      spend: 58,
      free: 2,
      left: man(8),
    });
  });
  it('딱 맞음: 300만, 100만, 200만 → 33 / 67 / 0', () => {
    expect(planRatio({ income: man(300), saving: man(100), spend: man(200) })).toEqual({
      saving: 33,
      spend: 67,
      free: 0,
      left: 0,
    });
  });
  it('모자람: 350만, 139만, 241만 → 저금·지출만 37 / 63, 여유 자금 −30만', () => {
    expect(planRatio({ income: man(350), saving: man(139), spend: man(241) })).toEqual({
      saving: 37,
      spend: 63,
      free: null,
      left: -man(30),
    });
  });
  it('셋이 같음: 같은 나머지는 저금 → 지출 → 여유 자금 순 → 34 / 33 / 33', () => {
    expect(planRatio({ income: man(300), saving: man(100), spend: man(100) })).toEqual({
      saving: 34,
      spend: 33,
      free: 33,
      left: man(100),
    });
  });
  it('월급 없음: 모두 0', () => {
    expect(planRatio({ income: 0, saving: 0, spend: 0 })).toEqual({
      saving: 0,
      spend: 0,
      free: 0,
      left: 0,
    });
  });
  it('월급 없이 줄만 있으면 모자람(기준 = 줄 합)', () => {
    expect(planRatio({ income: 0, saving: 0, spend: man(10) })).toMatchObject({
      saving: 0,
      spend: 100,
      free: null,
    });
  });
});

describe('가장 큰 나머지 방식', () => {
  it('합은 늘 100', () => {
    for (const v of [
      [1, 1, 1],
      [1, 2, 3, 4, 5, 6, 7],
      [999, 1, 0],
      [man(88), man(80), man(35), man(44), man(95)],
    ])
      expect(largestRemainder(v).reduce((s, x) => s + x, 0)).toBe(100);
  });
  it('0은 0%(나머지도 0이라 더 받지 않음)', () => {
    expect(largestRemainder([man(1), 0, man(2)])).toEqual([33, 0, 67]);
  });
  it('합이 0이면 모두 0', () => {
    expect(largestRemainder([0, 0])).toEqual([0, 0]);
  });
});

describe('분담 도우미(06 3-7, 서버 propose_split)', () => {
  it('월급 비율: 생활비 통장 100만, 찬우 350만 / 예빈 280만 → 56만 / 44만, “6 : 4”', () => {
    expect(
      splitShares(1_000_000, 'income_ratio', { mineIncome: 3_500_000, partnerIncome: 2_800_000 }),
    ).toEqual({
      mine: 560_000,
      partner: 440_000,
      ratioPct: 56,
      ratioTen: [6, 4],
    });
  });
  it('반반: 1만 원 반올림(15만 → 8만 / 7만), 직접: 내 몫 그대로', () => {
    expect(splitShares(150_000, 'half')).toMatchObject({
      mine: 80_000,
      partner: 70_000,
      ratioPct: 53,
    });
    expect(splitShares(1_000_000, 'custom', { mine: 700_000 })).toMatchObject({
      mine: 700_000,
      partner: 300_000,
    });
    expect(splitShares(1_000_000, 'custom', { mine: 1_100_000 })).toBeNull();
    expect(splitShares(1_000_000, 'custom', { mine: 5_000 })).toBeNull();
  });
  it('월급이 없거나 금액이 1만 원 단위가 아니면 null, 999억 상한도 정수로', () => {
    expect(splitShares(1_000_000, 'income_ratio', { mineIncome: 0, partnerIncome: 1 })).toBeNull();
    expect(splitShares(15_000, 'half')).toBeNull();
    const big = splitShares(99_999_990_000, 'income_ratio', {
      mineIncome: 99_999_999_999,
      partnerIncome: 99_999_999_999,
    });
    expect(big?.mine).toBe(50_000_000_000);
    expect(big && big.mine + big.partner).toBe(99_999_990_000);
  });
});
