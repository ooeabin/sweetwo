import type { Won } from '../money';
import type { AssetSide, NetWorthItem } from './asset';

// 자산 순위 1단계(계산·배분 7-7, 23 F-08, ADR 0006, 2026-11-04).
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

/** 순자산이 들어가는 칸 번호: 0 = −1억 미만, 1~10 = 점 사이, 11 = P90(11억 20만 원) 이상 */
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

/** P90 이상(상위 10% 안, 그 위는 나눌 수 없음). 문구를 “상위 10% 안이에요”로 */
export function rankTopOpen(net: Won): boolean {
  return rankBracket(net) >= RANK_BASIS.points.length;
}

/**
 * 다음 10% 칸까지(F-08 6b): 지금 상위 n%에서 한 칸 위(상위 80%, 70% …) 경계값까지 남은 금액.
 * P90 이상(상위 10%)이면 null
 */
export function rankNextStep(net: Won): { top: number; need: Won } | null {
  const now = rankTopPct(net);
  const top = Math.floor((now - 1) / 10) * 10;
  if (top < 10) return null;
  const point = RANK_BASIS.points.find((x) => x.below === 100 - top);
  if (!point) return null;
  return { top, need: Math.max(point.net - net, 1) };
}

/** 지난달 대비(F-08 6c): 지난달 순자산으로 다시 계산한 상위 n%. 양수 = 올라감(%p) */
export function rankChange(prevNet: Won | null, net: Won): { prev: number; up: number } | null {
  if (prevNet === null) return null;
  const prev = rankTopPct(prevNet);
  return { prev, up: prev - rankTopPct(net) };
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
 * 연령대별 부채 비율(부채 ÷ 자산, 평균끼리, %)과 금융자산 비율(금융자산 ÷ 자산, 평균끼리, %), 2025년 3월 말.
 * 부록 통계표 1~10 ‘가계의 재무건전성 부채/자산’, 자산·금융자산 평균에서 계산(소수 첫째 자리)
 */
export const RANK_AGE_STATS: Record<RankAgeBand, { debtPct: number; financialPct: number }> = {
  '20s': { debtPct: 30.3, financialPct: 57.1 },
  '30s': { debtPct: 30.3, financialPct: 39.2 },
  '40s': { debtPct: 22.8, financialPct: 26.2 },
  '50s': { debtPct: 16.7, financialPct: 24.9 },
  '60s': { debtPct: 10.8, financialPct: 18.7 },
};

/** 우리 부채 비율(계산·배분 7-2): 부채 합계 ÷ 자산 합계(평가금액), 반올림 %. 자산 0원이면 null */
export function debtRatioPct(assets: Won, debts: Won): number | null {
  if (assets <= 0) return null;
  return Math.round((debts * 100) / assets);
}

// 공공 통계의 금융자산 = 저축액(예금·적금, 주식·펀드, 보험 등) + 전·월세 보증금. 나머지(부동산, 자동차 등)는 실물자산
const FINANCIAL_GROUPS = new Set([
  'cash',
  'deposit',
  'subscription',
  'invest',
  'pension',
  'insurance',
]);
const isFinancial = (grp: string, kind?: string) =>
  FINANCIAL_GROUPS.has(grp) || (grp === 'real_estate' && kind === 'deposit_money');

/**
 * 우리 금융자산 비율(F-08 6a): 금융자산 ÷ 자산(평가금액), 반올림 %. 비공개·판 항목 제외.
 * 파트너 ‘합계만’ 묶음은 세부 항목을 몰라 부동산 묶음을 모두 실물로 셈. 자산 0원이면 null
 */
export function financialPct(
  items: (NetWorthItem & { grp: string; kind?: string })[],
  partnerSums: { side: AssetSide; grp: string; total: Won }[] = [],
): number | null {
  const live = items.filter(
    (i) => i.side === 'asset' && i.visibility !== 'private' && (i.status ?? 'held') === 'held',
  );
  const partner = partnerSums.filter((p) => p.side === 'asset');
  const total = live.reduce((t, i) => t + i.amount, 0) + partner.reduce((t, p) => t + p.total, 0);
  if (total <= 0) return null;
  const fin =
    live.filter((i) => isFinancial(i.grp, i.kind)).reduce((t, i) => t + i.amount, 0) +
    partner.filter((p) => isFinancial(p.grp)).reduce((t, p) => t + p.total, 0);
  return Math.round((fin * 100) / total);
}

/**
 * 우리 연령대(7-1처럼 두 사람 출생연도로 계산한 평균 나이 = 올해 − 출생연도, 내림).
 * 한 사람만 적었으면 그 사람 나이. 아무도 안 적었으면 null(연령대 비교를 숨김)
 */
export function rankAgeBand(
  birthYears: (number | null | undefined)[],
  year: number,
): RankAgeBand | null {
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

// ───────── 자산 순위 v2.2(06 7-8, 23 F-08, G3, Q15) ─────────
// 서버 networth_rank_pair()·peer_median()·rank_age_band()(마이그레이션 20261204090000_v22_unlink_rank 계약 6)와 같은 결과.

/** 한 사람 나이(올해 − 출생연도)로 연령대(서버 rank_age_band): 30 미만 20s, 60 이상 60s. 출생연도가 없으면 null */
export function rankBandOf(birthYear: number | null | undefined, year: number): RankAgeBand | null {
  if (typeof birthYear !== 'number') return null;
  const age = year - birthYear;
  if (age < 30) return '20s';
  if (age < 40) return '30s';
  if (age < 50) return '40s';
  if (age < 60) return '50s';
  return '60s';
}

/** 둘의 합 순위 연령대(Q15): 먼저 태어난(출생연도가 작은) 사람 기준. 예: 1993년생 + 1995년생, 2026년 → 33세 → 30s */
export function pairRankBand(
  birthYears: readonly (number | null | undefined)[],
  year: number,
): RankAgeBand | null {
  const ys = birthYears.filter((y): y is number => typeof y === 'number');
  return ys.length ? rankBandOf(Math.min(...ys), year) : null;
}

/** 또래 가구 중간값(서버 peer_median): 내 출생연도 연령대의 순자산 중앙값. 출생연도가 없으면 둘 다 null */
export function peerMedian(
  birthYear: number | null | undefined,
  year: number,
): { band: RankAgeBand | null; median: Won | null } {
  const band = rankBandOf(birthYear, year);
  return { band, median: band ? RANK_AGE_MEDIAN[band] : null };
}

export type RankPair =
  | {
      mode: 'pair';
      net: Won;
      top_pct: number;
      top_open: boolean;
      band: RankAgeBand | null;
      /** 연령대별 분위 표가 아직 없어 전체 가구 표로 계산('all', 06 7-8 “전체 가구 기준이에요”) */
      basis: 'all' | 'age';
    }
  | { mode: 'peer'; band: RankAgeBand | null; median: Won | null };

/**
 * 순위 결과(서버 networth_rank_pair): 연결 + 두 사람 모두 동의면 둘의 합(숨기기 제외, 평가금액) 순위,
 * 그 밖(혼자, 미합류, 한 사람만 동의, 해제 대기)은 내 연령대 중간값 한 줄
 */
export function rankPair(o: {
  consented: boolean;
  net: Won;
  birthYears: readonly (number | null | undefined)[];
  myBirthYear: number | null | undefined;
  year: number;
}): RankPair {
  if (!o.consented) return { mode: 'peer', ...peerMedian(o.myBirthYear, o.year) };
  return {
    mode: 'pair',
    net: o.net,
    top_pct: rankTopPct(o.net),
    top_open: rankTopOpen(o.net),
    band: pairRankBand(o.birthYears, o.year),
    basis: 'all',
  };
}

/** 순위에 넣는 둘의 합(서버 networth_rank_pair): 보유 중, 숨기기(private) 빼고, 평가금액 자산 − 부채 */
export const rankPairNet = (
  items: readonly { side: AssetSide; amount: Won; visibility?: string; status?: string }[],
): Won =>
  items
    .filter((i) => i.visibility !== 'private' && (i.status ?? 'held') === 'held')
    .reduce((t, i) => t + (i.side === 'asset' ? i.amount : -i.amount), 0);
