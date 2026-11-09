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
  const parts = values.map((v, i) => ({ i, floor: Math.floor((v * 100) / total), rem: (v * 100) % total }));
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
