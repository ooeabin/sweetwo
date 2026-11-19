import { z } from 'zod';
import { readWon, type Won } from '../money';

// W-01 영수증 비율 막대(docs/spec/06-calc-allocation.md 3-5, 20 W-01 4번).
// 퍼센트는 정수이고 합이 100: 모두 버림 → 모자란 만큼 나머지가 큰 순서로 1씩(같으면 저금 → 지출 → 여유 자금).
// 여유 자금이 0보다 작으면 기준 = 저금 + 지출, 두 칸만 나눔(free = null). 기준이 0이면 모두 0.

export interface PlanRatio {
  saving: number;
  spend: number;
  /** 여유 자금 %. 모자라면(여유 자금 < 0) null */
  free: number | null;
  /** 여유 자금(원, 음수면 모자람) */
  left: Won;
}

/** 가장 큰 나머지 방식(해밀턴). 정수 값들을 합 100인 정수 퍼센트로. 합이 0이면 모두 0 */
export function largestRemainder(values: number[]): number[] {
  const total = values.reduce((s, v) => s + v, 0);
  if (total <= 0) return values.map(() => 0);
  // 정수 원 단위라 v * 100도 정수: 몫·나머지를 정수로 계산(부동소수점 비교 없음)
  const parts = values.map((v, i) => ({
    i,
    floor: Math.floor((v * 100) / total),
    rem: (v * 100) % total,
  }));
  let short = 100 - parts.reduce((s, p) => s + p.floor, 0);
  const order = [...parts].sort((a, b) => b.rem - a.rem || a.i - b.i);
  const out = parts.map((p) => p.floor);
  for (const p of order) {
    if (short <= 0) break;
    out[p.i] = (out[p.i] ?? 0) + 1;
    short -= 1;
  }
  return out;
}

/** 수입, 저금 줄 합, 지출 줄 합 → 비율(06 3-5) */
export function planRatio(o: { income: Won; saving: Won; spend: Won }): PlanRatio {
  const saving = Math.max(o.saving, 0);
  const spend = Math.max(o.spend, 0);
  const left = o.income - saving - spend;
  if (left < 0) {
    const [s = 0, p = 0] = largestRemainder([saving, spend]);
    return { saving: s, spend: p, free: null, left };
  }
  const [s = 0, p = 0, f = 0] = largestRemainder([saving, spend, left]);
  return { saving: s, spend: p, free: f, left };
}

/** 서버 split_line_add가 돌려준 새 줄 id(검사용) */
export const splitLineId = z.string().min(1);

// ───────── 분담 도우미(06 3-7, W-01b, R3) ─────────
// 서버 propose_split(마이그레이션 20261203090000_v22_saving_together 계약 7)과 같은 결과. a = 제안한 사람(나).

export type SplitRule = 'half' | 'income_ratio' | 'custom';

/** 1만 원 단위 반올림(정수, 0.5는 올림: 서버 round(numeric)과 같음, 양수만) num ÷ den */
function roundDiv10k(num: bigint, den: bigint): number {
  // round(num / den / 10000) × 10000 = floor((2·num + den·10000) / (2·den·10000)) × 10000
  const unit = den * 10_000n;
  return Number(((2n * num + unit) / (2n * unit)) * 10_000n);
}

export interface SplitShares {
  /** 제안한 사람 몫 */
  mine: Won;
  /** 상대 몫 = 합계 − 내 몫 */
  partner: Won;
  /** 내 몫 비율 % = 반올림(내 몫 × 100 ÷ 합계)(서버 ratio_a) */
  ratioPct: number;
  /** 10을 합으로 한 비율(“6 : 4”, 06 3-7): [반올림(내 몫 × 10 ÷ 합계), 10 − 그것] */
  ratioTen: [number, number];
}

/**
 * 분담 몫(06 3-7). total = 한 달 넣을 금액(1만 원 단위). half = 반올림(total ÷ 2).
 * income_ratio = 반올림(total × 내 실수령 ÷ 두 실수령 합)(앱은 서버 응답을 쓰고, 이 계산은 테스트·미리 보기용).
 * custom = 내가 적은 몫. 결과가 0 아래거나 total을 넘으면 null(서버 'bad_amount'), 월급이 없으면 income_ratio는 null
 */
export function splitShares(
  total: Won,
  rule: SplitRule,
  o: { mineIncome?: Won | null; partnerIncome?: Won | null; mine?: Won | null } = {},
): SplitShares | null {
  if (!Number.isInteger(total) || total <= 0 || total % 10_000 !== 0) return null;
  let mine: number;
  if (rule === 'half') mine = roundDiv10k(BigInt(total), 2n);
  else if (rule === 'income_ratio') {
    const a = o.mineIncome ?? 0;
    const b = o.partnerIncome ?? 0;
    if (a <= 0 || b <= 0) return null;
    mine = roundDiv10k(BigInt(total) * BigInt(a), BigInt(a + b));
  } else {
    if (o.mine == null || o.mine < 0 || o.mine > total || o.mine % 10_000 !== 0) return null;
    mine = o.mine;
  }
  const ten = Number((BigInt(mine) * 20n + BigInt(total)) / (2n * BigInt(total)));
  return {
    mine,
    partner: total - mine,
    ratioPct: Number((BigInt(mine) * 200n + BigInt(total)) / (2n * BigInt(total))),
    ratioTen: [ten, 10 - ten],
  };
}

// ───────── W-01 요약 카드(20 W-01 3번, 2026-11-19) ─────────

export interface PlanSummaryValue {
  /** 월급(합쳐서면 두 사람 합). 0 이하면 요약은 ‘월급 적기’ 상태(막대·범례 없음) */
  income: Won;
  /** 월급 0원이라 막대와 범례를 그리지 않음 */
  empty: boolean;
  /** 월급 중 저축·투자 비율 %(정수, 0.5는 올림). 월급이 없으면 0 */
  share: number;
  /** 저축·투자 줄 합이 0원(굵은 문장이 “월급을 어떻게 나눌지 정해 보세요”) */
  noSaving: boolean;
  /** 막대 칸 퍼센트(합 100, 0인 칸은 그리지 않음). 미계획이 음수면 free = 0이고 저축·투자·지출이 막대를 꽉 채움 */
  bar: { saving: number; spend: number; free: number };
  /** 미계획 금액(원, 음수 = 모자람). 범례 셋째 줄 금액 */
  left: Won;
  /** 계획이 월급을 넘음(미계획 < 0): 범례 미계획 금액을 −와 빨강으로, 굵은 문장은 `planOverText` */
  over: boolean;
  /** 저축·투자 줄도 지출 줄도 0개(2026-11-19 사용자 결정): 알약 막대와 ● 범례를 숨기고 문장만 */
  noLines: boolean;
  /** 알약 막대와 ● 범례를 그림(월급이 있고 줄이 하나라도 있을 때) */
  chart: boolean;
}

/** 계획이 월급을 넘을 때 굵은 문장(2026-11-19): “계획이 월급보다 25만 원 많아요”. left = 미계획(음수) */
export const planOverText = (left: Won) => `계획이 월급보다 ${readWon(Math.abs(left))} 많아요`;

/**
 * 월급, 저축·투자 줄 합, 지출 줄 합 → W-01 요약 카드 값(막대는 `planRatio`, 문장 퍼센트는 월급 기준 반올림).
 * lines = 저축·투자 줄 수 + 지출 줄 수(주지 않으면 줄이 있다고 봄)
 */
export function planSummary(o: {
  income: Won;
  saving: Won;
  spend: Won;
  lines?: number;
}): PlanSummaryValue {
  const saving = Math.max(o.saving, 0);
  const income = Math.max(o.income, 0);
  const r = planRatio({ income, saving, spend: o.spend });
  const noLines = o.lines !== undefined && o.lines <= 0;
  const share =
    income > 0 ? Number((BigInt(saving) * 200n + BigInt(income)) / (2n * BigInt(income))) : 0;
  return {
    income,
    empty: income <= 0,
    share,
    noSaving: saving <= 0,
    bar: { saving: r.saving, spend: r.spend, free: r.free ?? 0 },
    left: r.left,
    over: r.left < 0,
    noLines,
    chart: income > 0 && !noLines,
  };
}
