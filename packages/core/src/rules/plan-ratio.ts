import { z } from 'zod';
import type { Won } from '../money';

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
