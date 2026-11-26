import { describe, expect, it } from 'vitest';
import {
  largestRemainder,
  planInputCheck,
  planOverText,
  planRatio,
  planSummary,
  splitShares,
} from './plan-ratio';

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

describe('W-01 요약 카드(20 W-01 3번, 2026-11-19)', () => {
  it('시안: 월급 350만, 저축·투자 139만, 지출 183만 → “월급의 40%”, 막대 40 / 52 / 8, 미계획 28만', () => {
    expect(planSummary({ income: man(350), saving: man(139), spend: man(183) })).toEqual({
      income: man(350),
      empty: false,
      share: 40, // 139 ÷ 350 = 39.7% → 반올림 40
      noSaving: false,
      bar: { saving: 40, spend: 52, free: 8 },
      left: man(28),
      over: false,
      noLines: false,
      chart: true,
    });
  });
  it('문장 퍼센트는 정수 반올림(0.5는 올림): 1 ÷ 8 = 12.5% → 13, 3 ÷ 8 = 37.5% → 38', () => {
    expect(planSummary({ income: man(8), saving: man(1), spend: 0 }).share).toBe(13);
    expect(planSummary({ income: man(8), saving: man(3), spend: 0 }).share).toBe(38);
    expect(planSummary({ income: man(300), saving: man(100), spend: man(200) }).share).toBe(33);
  });
  it('저축·투자가 0원이면 퍼센트 0, noSaving(굵은 문장이 “월급을 어떻게 나눌지 정해 보세요”)', () => {
    const s = planSummary({ income: man(350), saving: 0, spend: man(35) });
    expect(s).toMatchObject({ share: 0, noSaving: true, over: false });
    expect(s.bar).toEqual({ saving: 0, spend: 10, free: 90 });
  });
  it('모자람: 막대는 저축·투자·지출만으로 꽉 채우고(합 100, 미계획 칸 0), 미계획은 음수', () => {
    const s = planSummary({ income: man(350), saving: man(139), spend: man(241) });
    expect(s).toMatchObject({ over: true, left: -man(30), share: 40 });
    expect(s.bar).toEqual({ saving: 37, spend: 63, free: 0 });
    expect(s.bar.saving + s.bar.spend + s.bar.free).toBe(100);
  });
  it('월급 0원이면 empty(막대·범례 없음), 줄이 있어도 퍼센트 0', () => {
    expect(planSummary({ income: 0, saving: 0, spend: 0 })).toMatchObject({
      empty: true,
      share: 0,
      left: 0,
      over: false,
    });
    expect(planSummary({ income: 0, saving: man(10), spend: 0 })).toMatchObject({
      empty: true,
      share: 0,
      over: true,
    });
  });
  it('999억 상한도 정수로(BigInt)', () => {
    expect(planSummary({ income: 99_999_999_999, saving: 49_999_999_999, spend: 0 }).share).toBe(
      50,
    );
  });
});

describe('W-01 요약 카드: 줄 없음·계획 초과(2026-11-19)', () => {
  it('줄이 하나도 없으면 막대·범례 없이 문장만(월급이 있어도)', () => {
    const r = planSummary({ income: 3_500_000, saving: 0, spend: 0, lines: 0 });
    expect(r.noLines).toBe(true);
    expect(r.chart).toBe(false);
    expect(r.noSaving).toBe(true);
  });
  it('줄이 있으면(0원 줄 포함) 막대를 그림, 월급 0원이면 그리지 않음', () => {
    expect(planSummary({ income: 3_500_000, saving: 0, spend: 0, lines: 2 }).chart).toBe(true);
    expect(planSummary({ income: 0, saving: 100, spend: 0, lines: 1 }).chart).toBe(false);
    expect(planSummary({ income: 3_500_000, saving: 1, spend: 1 }).chart).toBe(true);
  });
  it('계획이 월급을 넘으면 “계획이 월급보다 250,000원 많아요”', () => {
    const r = planSummary({ income: 3_500_000, saving: 500_000, spend: 3_250_000, lines: 4 });
    expect(r.over).toBe(true);
    expect(r.left).toBe(-250_000);
    expect(planOverText(r.left)).toBe('계획이 월급보다 250,000원 많아요');
  });
});

describe('planInputCheck(06 3-3, 2026-11-26 입력할 때만 막음)', () => {
  it('바꾼 뒤 미계획이 0 이상이면 막지 않음', () => {
    expect(planInputCheck({ left0: 500_000, before: 200_000, after: 500_000 })).toEqual({
      left: 0,
      over: 0,
      blocked: false,
    });
  });
  it('늘려서 월급을 넘으면 막고 넘는 금액을 줌(“월급보다 300,000원 많아요”)', () => {
    expect(planInputCheck({ left0: 500_000, before: 200_000, after: 800_000 })).toEqual({
      left: -300_000,
      over: 300_000,
      blocked: true,
    });
  });
  it('이미 넘친 상태에서 줄이면 아직 넘어도 막지 않음', () => {
    const r = planInputCheck({ left0: 100_000, before: 500_000, after: 300_000 });
    expect(r.over).toBe(200_000);
    expect(r.blocked).toBe(false);
  });
  it('이미 넘친 상태에서 그대로 두면 막지 않음, 조금이라도 늘리면 막음', () => {
    expect(planInputCheck({ left0: 100_000, before: 500_000, after: 500_000 }).blocked).toBe(false);
    expect(planInputCheck({ left0: 100_000, before: 500_000, after: 510_000 }).blocked).toBe(true);
  });
  it('새 줄(before 0): 0원은 넘쳐 있어도 추가 가능, 0원보다 크면 막음', () => {
    expect(planInputCheck({ left0: -250_000, before: 0, after: 0 }).blocked).toBe(false);
    expect(planInputCheck({ left0: 300_000, before: 0, after: 400_000 }).blocked).toBe(true);
  });
  it('월급 0원이면 0원보다 큰 새 줄은 곧 막힘', () => {
    expect(planInputCheck({ left0: 0, before: 0, after: 10_000 })).toEqual({
      left: -10_000,
      over: 10_000,
      blocked: true,
    });
  });
  it('아직 안 넣었으면(null) 바꾸기 전 값으로 셈', () => {
    expect(planInputCheck({ left0: 100_000, before: 300_000, after: null })).toEqual({
      left: -200_000,
      over: 200_000,
      blocked: false,
    });
  });
});
