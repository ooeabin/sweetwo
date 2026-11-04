import type { Won } from '../money';

// 우리 자산 순위 1단계(계산·배분 7-7, 23 F-08, ADR 0006, 2026-11-04).
// 2024년 가계금융복지조사 순자산 구간별 가구 분포, 전체 가구(통계청·한국은행·금융감독원, 2024년 3월 말, 보도자료 표 1-2).
// 구간 안은 고르게 퍼져 있다고 보고 우리보다 위에 있는 가구 비율을 추정. 비율 합(100.1)으로 나눠 100에 맞춤.

const EOK = 100_000_000;

/** 순자산 구간(아래 끝 포함, 위 끝 미만)과 가구 비율(%). 끝이 null이면 열린 구간 */
export const RANK_BASIS = {
  label: '2024년 가계금융복지조사',
  asOf: '2024-03-31',
  medianNet: 240_000_000, // 순자산 중앙값(보도자료 표 1-5)
  brackets: [
    { from: null, to: -1 * EOK, share: 0.2 },
    { from: -1 * EOK, to: 0, share: 2.8 },
    { from: 0, to: 1 * EOK, share: 26.2 },
    { from: 1 * EOK, to: 2 * EOK, share: 15.5 },
    { from: 2 * EOK, to: 3 * EOK, share: 12.2 },
    { from: 3 * EOK, to: 4 * EOK, share: 9.1 },
    { from: 4 * EOK, to: 5 * EOK, share: 6.6 },
    { from: 5 * EOK, to: 6 * EOK, share: 4.9 },
    { from: 6 * EOK, to: 7 * EOK, share: 3.6 },
    { from: 7 * EOK, to: 8 * EOK, share: 3.1 },
    { from: 8 * EOK, to: 9 * EOK, share: 2.7 },
    { from: 9 * EOK, to: 10 * EOK, share: 2.3 },
    { from: 10 * EOK, to: null, share: 10.9 },
  ] as { from: Won | null; to: Won | null; share: number }[],
};

/** 순자산이 들어가는 구간 번호(RANK_BASIS.brackets) */
export function rankBracket(net: Won): number {
  const b = RANK_BASIS.brackets;
  const i = b.findIndex((x) => (x.from === null || net >= x.from) && (x.to === null || net < x.to));
  return i < 0 ? b.length - 1 : i;
}

/** 상위 n%(1~99 정수, 올림). 10억 이상은 11, −1억 미만은 99 */
export function rankTopPct(net: Won): number {
  const b = RANK_BASIS.brackets;
  const total = b.reduce((t, x) => t + x.share, 0);
  const i = rankBracket(net);
  const x = b[i];
  if (!x) return 99;
  if (x.to === null) return Math.ceil((x.share * 100) / total); // 10억 이상: 구간 안을 모름
  if (x.from === null) return 99;
  const above = b.slice(i + 1).reduce((t, y) => t + y.share, 0);
  const inside = (x.share * (x.to - net)) / (x.to - x.from);
  const pct = Math.ceil(((above + inside) * 100) / total - 1e-9);
  return Math.min(Math.max(pct, 1), 99);
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
