import type { Won } from '../money';

// 우리 자산 순위 1단계(계산·배분 7-7, 23 F-08, ADR 0006, 2026-11-04).
// 2025년 가계금융복지조사(통계청·한국은행·금융감독원, 자산·부채 2025년 3월 말) 부록 통계표 12의 순자산 분위 경계값(P10~P90),
// 0원 아래는 2024년 보도자료 표 1-2의 순자산 구간별 가구 분포(−1억 미만 0.2%, −1억~0 2.8%).
// 점 사이는 고르게 퍼져 있다고 보고 우리 아래 가구 비율(백분위)을 추정.

const EOK = 100_000_000;
const MAN = 10_000;

/** 순자산(원)과 그 값 아래 가구 비율(%, 백분위). 낮은 값부터 */
export const RANK_BASIS = {
  label: '2025년 가계금융복지조사',
  asOf: '2025-03-31',
  medianNet: 23_860 * MAN, // P50(부록 통계표 12)
  points: [
    { net: -1 * EOK, below: 0.2 }, // 2024 표 1-2
    { net: 0, below: 3 }, // 2024 표 1-2
    { net: 1_210 * MAN, below: 10 },
    { net: 5_108 * MAN, below: 20 },
    { net: 10_296 * MAN, below: 30 },
    { net: 16_472 * MAN, below: 40 },
    { net: 23_860 * MAN, below: 50 },
    { net: 33_050 * MAN, below: 60 },
    { net: 46_180 * MAN, below: 70 },
    { net: 69_380 * MAN, below: 80 },
    { net: 110_020 * MAN, below: 90 },
  ] as { net: Won; below: number }[],
};

/** 우리 순자산이 들어가는 칸 번호: 0 = −1억 미만, 1~10 = 점 사이, 11 = P90(11억 20만 원) 이상 */
export function rankBracket(net: Won): number {
  const p = RANK_BASIS.points;
  const i = p.findIndex((x) => net < x.net);
  return i < 0 ? p.length : i;
}

/** 상위 n%(1~99 정수, 올림). P90 이상은 10(위로는 나눌 수 없음), −1억 미만은 99 */
export function rankTopPct(net: Won): number {
  const p = RANK_BASIS.points;
  const i = rankBracket(net);
  if (i === 0) return 99;
  if (i >= p.length) return 10;
  const lo = p[i - 1];
  const hi = p[i];
  if (!lo || !hi) return 99;
  const below = lo.below + ((hi.below - lo.below) * (net - lo.net)) / (hi.net - lo.net);
  const pct = Math.ceil(100 - below - 1e-9);
  return Math.min(Math.max(pct, 1), 99);
}

/** 가구주 연령대(부록 통계표 1~10 ‘가구주 연령대별’, 10세 구간) */
export type RankAgeBand = '20s' | '30s' | '40s' | '50s' | '60s';

/** 연령대별 순자산 중앙값(2025년 3월 말, 원). 29세 이하는 20대로 */
export const RANK_AGE_MEDIAN: Record<RankAgeBand, Won> = {
  '20s': 5_000 * MAN,
  '30s': 15_585 * MAN,
  '40s': 28_384 * MAN,
  '50s': 31_685 * MAN,
  '60s': 25_000 * MAN,
};

/**
 * 우리 연령대(7-1처럼 두 사람 출생연도로 계산한 평균 나이 = 올해 − 출생연도, 내림).
 * 한 사람만 적었으면 그 사람 나이. 아무도 안 적었으면 null(연령대 비교를 숨김)
 */
export function rankAgeBand(birthYears: (number | null | undefined)[], year: number): RankAgeBand | null {
  const ys = birthYears.filter((y): y is number => typeof y === 'number' && y > 1900);
  if (ys.length === 0) return null;
  const age = Math.floor(ys.reduce((t, y) => t + (year - y), 0) / ys.length);
  if (age < 30) return '20s';
  if (age < 40) return '30s';
  if (age < 50) return '40s';
  if (age < 60) return '50s';
  return '60s';
}

/** 배너 상태: 자산 없음 / 안 봄 / 이번 달 봄(순자산 그대로) / 지난번 값 */
export type RankState =
  | { kind: 'empty' }
  | { kind: 'unseen' }
  | { kind: 'seen'; pct: number; month: string }
  | { kind: 'stale'; pct: number; month: string };

export function rankState(o: {
  hasItems: boolean;
  net: Won;
  thisMonth: string; // 'YYYY-MM-01'
  seen: { month: string | null; pct: number | null; net: number | null };
}): RankState {
  if (!o.hasItems) return { kind: 'empty' };
  const { month, pct, net } = o.seen;
  if (!month || pct === null) return { kind: 'unseen' };
  if (month.slice(0, 7) === o.thisMonth.slice(0, 7) && net === o.net)
    return { kind: 'seen', pct, month };
  return { kind: 'stale', pct, month };
}
