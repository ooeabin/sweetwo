import type { Won } from '../money';

// 월말 정리 정산 요약 아래(docs/spec/21-month-close.md W-04g, 06 4장·7장).

/**
 * 생활비 예산 보정 제안: 최근 3개월(정리한 달) 변동 항목 합계 평균이 예산과 10% 넘게 다를 때만.
 * 큰 지출은 이미 변동 합계에 없음. 평균은 1만 원 단위 반올림. 3개월이 안 되면 null
 */
export function livingBudgetFix(budget: Won, months: Won[]): { avg: Won } | null {
  if (months.length < 3 || budget <= 0) return null;
  const last3 = months.slice(0, 3);
  const raw = last3.reduce((t, x) => t + x, 0) / 3;
  const avg = Math.round(raw / 10_000) * 10_000;
  // 10% 넘게: |평균 − 예산| × 10 > 예산 (정수 비교)
  return Math.abs(avg - budget) * 10 > budget ? { avg } : null;
}

export interface PlanRow {
  key: string;
  name: string;
  planned: Won;
  saved: Won;
}

/** 계획 대비: 미달(넣은 돈 < 계획) / 초과(넣은 돈 > 계획) / 같음 */
export function planGap(rows: PlanRow[]): {
  planned: Won;
  saved: Won;
  kind: 'short' | 'over' | null;
  amount: Won;
} {
  const planned = rows.reduce((t, r) => t + r.planned, 0);
  const saved = rows.reduce((t, r) => t + r.saved, 0);
  const diff = saved - planned;
  return {
    planned,
    saved,
    kind: planned <= 0 || diff === 0 ? null : diff < 0 ? 'short' : 'over',
    amount: Math.abs(diff),
  };
}

/** 미달을 다음 3개월에 나눠 채울 때 한 달 몫(1만 원 단위 올림, 06 4장 월 배분액과 같음) */
export function spreadMonthly(short: Won, months = 3): Won {
  return Math.ceil(short / months / 10_000) * 10_000;
}

/** 잘한 점 1개: 생활비를 예산보다 1만 원 이상 덜 썼으면 아낀 금액(1만 원 단위 내림), 아니면 null */
export function livingSaved(budget: Won, variable: Won): Won | null {
  const s = Math.floor((budget - variable) / 10_000) * 10_000;
  return budget > 0 && s >= 10_000 ? s : null;
}
