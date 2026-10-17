// 생활비 체크(docs/spec/20-salary-plan.md W-03, 07 3-2장). 서버 living_check_day와 같은 결과.
import { addDays, daysBetween } from '../date';
import type { Won } from '../money';

/** 체크일 = 기준일 + 사이클 길이의 절반(반올림) */
export function livingCheckDay(cycleStart: string, cycleEnd: string): string {
  const days = daysBetween(cycleStart, cycleEnd) + 1;
  return addDays(cycleStart, Math.round(days / 2));
}

/** 이번 달 카드 시기: 체크일 전후 2일 */
export function inLivingCheckWindow(today: string, cycleStart: string, cycleEnd: string): boolean {
  return Math.abs(daysBetween(livingCheckDay(cycleStart, cycleEnd), today)) <= 2;
}

/** W-03c ‘내 용돈에서’: 내 용돈보다 많으면 고를 수 없음. 고를 수 있으면 바뀐 용돈 */
export function allowanceAfterCut(allowance: Won | null, over: Won): Won | null {
  const a = allowance ?? 0;
  return over > a ? null : a - over;
}

export type AmountBand = '<10만' | '10-50만' | '50-100만' | '100-300만' | '300-1000만' | '1000만+';
/** 분석 이벤트 금액 구간(32 5장 ‘그 밖의 금액 _band’) */
export function amountBand(v: Won): AmountBand {
  if (v < 100_000) return '<10만';
  if (v < 500_000) return '10-50만';
  if (v < 1_000_000) return '50-100만';
  if (v < 3_000_000) return '100-300만';
  if (v < 10_000_000) return '300-1000만';
  return '1000만+';
}
