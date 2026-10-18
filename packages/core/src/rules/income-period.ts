import type { Won } from '../money';
import { monthsBetween } from '../onboarding/month';

// 기간 수입 변경(23 F-05f·F-07c, 06 9장).

export interface IncomePeriodIn {
  user_id: string;
  start_month: string;
  end_month: string;
  amount: Won;
  ended_at: string | null;
}

/** 그 달 이 사람 수입: 그 달이 든 기간이 있으면 그 기간 수입, 없으면 원래 수입 */
export function periodIncome(
  userId: string,
  base: Won | null,
  periods: IncomePeriodIn[],
  labelMonth: string,
): Won | null {
  const m = `${labelMonth.slice(0, 7)}-01`;
  const p = periods.find(
    (x) => x.user_id === userId && !x.ended_at && x.start_month <= m && x.end_month >= m,
  );
  return p ? p.amount : base;
}

/**
 * 보충안(06 9장): 월 보충액 = 월 수입 감소분 전액, 비상금 잔액 한도(기간 달 수로 나눠 1원 아래 버림).
 * 수입이 늘면 보충 없음. short = 비상금이 모자라는 금액.
 */
export function periodSupplement(o: {
  base: Won;
  amount: Won;
  start: string;
  end: string;
  emergencyHeld: Won;
}) {
  const months = Math.max(monthsBetween(o.start.slice(0, 7), o.end.slice(0, 7)), 0) + 1;
  const decrease = Math.max(o.base - o.amount, 0);
  const need = decrease * months;
  const monthly = Math.min(decrease, Math.floor(Math.max(o.emergencyHeld, 0) / months));
  return { months, decrease, monthly, short: Math.max(need - o.emergencyHeld, 0) };
}

/** ‘버는 만큼’ 분담 시작한 사람 몫 %(반올림). 둘 다 0이면 50 */
export function incomeRatio(starterIncome: Won, joinerIncome: Won) {
  const t = starterIncome + joinerIncome;
  return t > 0 ? Math.round((starterIncome * 100) / t) : 50;
}
