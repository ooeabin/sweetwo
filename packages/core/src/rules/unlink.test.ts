import { describe, expect, it } from 'vitest';
import { splitPercent, unlinkShare, unlinkTotals } from './unlink';

describe('연결 해제 자산 정리 안', () => {
  it('찬우 350만, 예빈 250만 버는 만큼이면 58 : 42', () => {
    expect(splitPercent('income', 3_500_000, 2_500_000, 50)).toBe(58);
    expect(splitPercent('income', 2_500_000, 3_500_000, 50)).toBe(42);
  });
  it('수입을 모르면 50, 반반 50, 직접은 내 몫', () => {
    expect(splitPercent('income', 3_500_000, null, 50)).toBe(50);
    expect(splitPercent('half', 1, 2, 70)).toBe(50);
    expect(splitPercent('custom', 1, 2, 70)).toBe(70);
  });
  it('기본 몫은 1만 원 단위 반올림(서버와 같음)', () => {
    expect(unlinkShare(24_000_000, 58)).toBe(13_920_000);
    expect(unlinkShare(1_234_567, 50)).toBe(620_000);
    expect(unlinkShare(4_000, 50)).toBe(0);
    expect(unlinkShare(15_000, 100)).toBe(15_000);
  });
  it('합계', () => {
    expect(
      unlinkTotals(
        [
          { assetId: 'a', name: '공동 적금', amount: 24_000_000, mine: 13_920_000, side: 'asset' },
          { assetId: 'b', name: '비상금 통장', amount: 3_000_000, mine: 1_000_000, side: 'asset' },
          { assetId: 'c', name: '공동 대출', amount: 10_000_000, mine: 5_800_000, side: 'debt' },
        ],
        'asset',
      ),
    ).toEqual({ mine: 14_920_000, theirs: 12_080_000 });
  });
});

describe('자산 정리 안 읽기', () => {
  it('깨진 줄은 뺌', async () => {
    const { readUnlinkPlan } = await import('../schemas/unlink');
    expect(
      readUnlinkPlan([
        { asset_id: 'a', name: '공동 적금', amount: 100, mine: 50 },
        { asset_id: 'd', name: '공동 대출', amount: 100, mine: 40, side: 'debt' },
        { asset_id: 'b', name: '이상', amount: 100, mine: 200 },
        { asset_id: 'c', name: '소수', amount: 1.5, mine: 0 },
        null,
      ]),
    ).toEqual([
      { assetId: 'a', name: '공동 적금', amount: 100, mine: 50, side: 'asset' },
      { assetId: 'd', name: '공동 대출', amount: 100, mine: 40, side: 'debt' },
    ]);
    expect(readUnlinkPlan(null)).toEqual([]);
  });
});
