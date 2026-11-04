import { describe, expect, it } from 'vitest';
import { rankBracket, rankState, rankTopPct } from './networth-rank';

// 계산·배분 7-7 예시를 그대로
describe('우리 자산 순위 1단계(7-7)', () => {
  it('1,600만 원 → 상위 93%', () => expect(rankTopPct(16_000_000)).toBe(93));
  it('3억 5,000만 원 → 상위 39%', () => expect(rankTopPct(350_000_000)).toBe(39));
  it('−500만 원 → 상위 98%', () => expect(rankTopPct(-5_000_000)).toBe(98));
  it('10억 이상은 상위 11% 고정', () => {
    expect(rankTopPct(1_000_000_000)).toBe(11);
    expect(rankTopPct(5_000_000_000)).toBe(11);
  });
  it('−1억 미만은 상위 99%', () => expect(rankTopPct(-200_000_000)).toBe(99));
  it('중앙값 근처(2억 4,000만 원) → 상위 51%(43.2 + 12.2 × 0.6 = 50.52 → 50.5)', () =>
    expect(rankTopPct(240_000_000)).toBe(51));
  it('구간 경계: 1억은 1~2억 구간', () => expect(rankBracket(100_000_000)).toBe(3));
});

describe('순위 배너 상태', () => {
  const base = { hasItems: true, net: 16_000_000, thisMonth: '2026-11-01' };
  it('자산 없음', () =>
    expect(
      rankState({ ...base, hasItems: false, seen: { month: null, pct: null, net: null } }).kind,
    ).toBe('empty'));
  it('안 봄', () =>
    expect(rankState({ ...base, seen: { month: null, pct: null, net: null } }).kind).toBe('unseen'));
  it('이번 달에 봤고 순자산 그대로', () =>
    expect(rankState({ ...base, seen: { month: '2026-11-01', pct: 93, net: 16_000_000 } })).toEqual({
      kind: 'seen',
      pct: 93,
      month: '2026-11-01',
    }));
  it('순자산이 바뀜', () =>
    expect(
      rankState({ ...base, seen: { month: '2026-11-01', pct: 93, net: 15_000_000 } }).kind,
    ).toBe('stale'));
  it('다음 달', () =>
    expect(
      rankState({ ...base, seen: { month: '2026-10-01', pct: 93, net: 16_000_000 } }).kind,
    ).toBe('stale'));
});
