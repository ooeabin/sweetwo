import { describe, expect, it } from 'vitest';
import {
  debtRatioPct,
  financialPct,
  pairRankBand,
  peerMedian,
  rankAgeBand,
  rankBandOf,
  rankPair,
  rankPairNet,
  rankBracket,
  rankChange,
  rankNextStep,
  rankState,
  rankTopOpen,
  rankTopPct,
} from './networth-rank';

// 계산·배분 7-7 예시를 그대로
describe('자산 순위 1단계(7-7, 2025년 기준)', () => {
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
  it('P90 이상은 ‘상위 10% 안’', () => {
    expect(rankTopOpen(1_100_200_000)).toBe(true);
    expect(rankTopOpen(1_100_199_999)).toBe(false);
  });
  it('−1억 미만은 상위 99%', () => expect(rankTopPct(-200_000_000)).toBe(99));
  it('0원 → 상위 97%', () => expect(rankTopPct(0)).toBe(97));
  it('칸 경계: P10(1,210만 원)은 P10~P20 칸', () => expect(rankBracket(12_100_000)).toBe(3));
});

describe('다음 칸, 지난달 대비, 부채·금융자산 비율(F-08)', () => {
  it('1,600만 원(상위 89%) → 상위 80%(P20 5,108만 원)까지 3,508만 원', () =>
    expect(rankNextStep(16_000_000)).toEqual({ top: 80, need: 35_080_000 }));
  it('상위 90%면 다음은 80%', () => expect(rankNextStep(12_100_000)?.top).toBe(80));
  it('3억 5,000만 원(상위 39%) → 상위 30%(P70 4억 6,180만 원)까지 1억 1,180만 원', () =>
    expect(rankNextStep(350_000_000)).toEqual({ top: 30, need: 111_800_000 }));
  it('상위 10%면 없음', () => expect(rankNextStep(2_000_000_000)).toBeNull());
  it('지난달 1,000만 원 → 이번 달 1,600만 원: 상위 92%(3 + 7 × 1,000 ÷ 1,210 = 8.8) → 89%, 3%p 올라감', () =>
    expect(rankChange(10_000_000, 16_000_000)).toEqual({ prev: 92, up: 3 }));
  it('지난달 기록이 없으면 없음', () => expect(rankChange(null, 16_000_000)).toBeNull());
  it('부채 비율: 자산 2억, 부채 3,600만 → 18%', () =>
    expect(debtRatioPct(200_000_000, 36_000_000)).toBe(18));
  it('부채 비율: 자산 0원이면 없음', () => expect(debtRatioPct(0, 1_000_000)).toBeNull());
  it('금융자산 비율: 예금 4,000만 + 전세 보증금 1억 + 집 2억 + 차 2,000만 → 14,000 ÷ 36,000 = 39%', () =>
    expect(
      financialPct([
        { side: 'asset', grp: 'deposit', kind: 'savings', amount: 40_000_000 },
        { side: 'asset', grp: 'real_estate', kind: 'deposit_money', amount: 100_000_000 },
        { side: 'asset', grp: 'real_estate', kind: 'house', amount: 200_000_000 },
        { side: 'asset', grp: 'etc', kind: 'car', amount: 20_000_000 },
        { side: 'debt', grp: 'credit', kind: 'credit_loan', amount: 5_000_000 },
        {
          side: 'asset',
          grp: 'deposit',
          kind: 'savings',
          amount: 9_000_000,
          visibility: 'private',
        },
      ]),
    ).toBe(39));
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
    expect(rankState({ ...base, seen: { month: null, pct: null, net: null } }).kind).toBe(
      'unseen',
    ));
  it('이번 달에 봤고 순자산 그대로', () =>
    expect(rankState({ ...base, seen: { month: '2026-11-01', pct: 93, net: 16_000_000 } })).toEqual(
      {
        kind: 'seen',
        pct: 93,
        month: '2026-11-01',
      },
    ));
  it('순자산이 바뀜', () =>
    expect(
      rankState({ ...base, seen: { month: '2026-11-01', pct: 93, net: 15_000_000 } }).kind,
    ).toBe('stale'));
  it('다음 달', () =>
    expect(
      rankState({ ...base, seen: { month: '2026-10-01', pct: 93, net: 16_000_000 } }).kind,
    ).toBe('stale'));
});

describe('순위 v2.2(06 7-8, 서버 networth_rank_pair)', () => {
  it('연령대 = 먼저 태어난 사람(찬우 1993 + 예빈 1995, 2026년 → 33세 → 30대)', () => {
    expect(pairRankBand([1993, 1995], 2026)).toBe('30s');
    expect(pairRankBand([1997, null], 2026)).toBe('20s');
    expect(pairRankBand([], 2026)).toBeNull();
    expect(rankBandOf(1966, 2026)).toBe('60s');
  });
  it('두 사람 모두 동의면 둘의 합 순위(숨기기 빼고), 아니면 또래 중간값', () => {
    const net = rankPairNet([
      { side: 'asset', amount: 300_000_000 },
      { side: 'asset', amount: 50_000_000, visibility: 'private' },
      { side: 'asset', amount: 10_000_000, status: 'sold' },
      { side: 'debt', amount: 61_400_000 },
    ]);
    expect(net).toBe(238_600_000);
    expect(
      rankPair({ consented: true, net, birthYears: [1993, 1995], myBirthYear: 1995, year: 2026 }),
    ).toEqual({
      mode: 'pair',
      net,
      top_pct: 50,
      top_open: false,
      band: '30s',
      basis: 'all',
    });
    expect(
      rankPair({ consented: false, net, birthYears: [1993, 1995], myBirthYear: 1995, year: 2026 }),
    ).toEqual({
      mode: 'peer',
      band: '30s',
      median: 155_850_000,
    });
    expect(peerMedian(null, 2026)).toEqual({ band: null, median: null });
  });
});
