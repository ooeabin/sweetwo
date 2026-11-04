import { describe, expect, it } from 'vitest';
import { rankAgeBand, rankBracket, rankState, rankTopPct } from './networth-rank';

// 계산·배분 7-7 예시를 그대로
describe('우리 자산 순위 1단계(7-7, 2025년 기준)', () => {
  it('1,600만 원 → 상위 89%(10 + 10 × 390 ÷ 3,898 = 11.0 → 89.0)', () =>
    expect(rankTopPct(16_000_000)).toBe(89));
  it('3억 5,000만 원 → 상위 39%(60 + 10 × 1,950 ÷ 13,130 = 61.5 → 38.5)', () =>
    expect(rankTopPct(350_000_000)).toBe(39));
  it('−500만 원 → 상위 98%(0.2 + 2.8 × 0.95 = 2.86 → 97.14)', () =>
    expect(rankTopPct(-5_000_000)).toBe(98));
  it('중앙값 근처 2억 4,000만 원 → 상위 50%', () => expect(rankTopPct(240_000_000)).toBe(50));
  it('P90(11억 20만 원) 이상은 상위 10% 고정', () => {
    expect(rankTopPct(1_100_200_000)).toBe(10);
    expect(rankTopPct(5_000_000_000)).toBe(10);
  });
  it('−1억 미만은 상위 99%', () => expect(rankTopPct(-200_000_000)).toBe(99));
  it('0원 → 상위 97%', () => expect(rankTopPct(0)).toBe(97));
  it('칸 경계: P10(1,210만 원)은 P10~P20 칸', () => expect(rankBracket(12_100_000)).toBe(3));
});

describe('연령대(7-1처럼 두 사람 평균 나이)', () => {
  it('1993년생 + 1995년생, 2026년 → 평균 32세 → 30대', () =>
    expect(rankAgeBand([1993, 1995], 2026)).toBe('30s'));
  it('한 사람만 적었으면 그 사람 나이', () => expect(rankAgeBand([1998, null], 2026)).toBe('20s'));
  it('평균 39.5세는 내려서 30대', () => expect(rankAgeBand([1986, 1987], 2026)).toBe('30s'));
  it('아무도 안 적었으면 없음', () => expect(rankAgeBand([null, null], 2026)).toBeNull());
  it('60세 이상', () => expect(rankAgeBand([1960], 2026)).toBe('60s'));
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
