import { addDays, daysBetween } from '../date';
import type { Won } from '../money';
import { baseDateIn, type BaseDay } from '../onboarding/cycle';

// 이번 달(docs/spec/19-this-month.md) 숫자. 남은 생활비는 06 3장, 월말 정리 기간은 07 2장.

/** 이번 달 남은 생활비 = 생활비 예산 − 이번 달 변동 항목 입력 합계(고정, 큰 지출 제외). 예산 0이면 % 없음 */
export function livingLeft(budget: Won, spentVariable: Won) {
  const left = budget - spentVariable;
  return {
    left,
    over: left < 0,
    /** 남은 비율(%, 정수). 예산 0이면 null */
    pct: budget > 0 ? Math.round((Math.max(left, 0) * 100) / budget) : null,
  };
}

/** 월말 정리 기간 = 다음 기준일 3일 전 ~ 전날(= 사이클 끝 2일 전 ~ 끝) */
export function closePeriod(cycleEnd: string) {
  return { start: addDays(cycleEnd, -2), end: cycleEnd };
}
export const inClosePeriod = (today: string, cycleEnd: string) => {
  const p = closePeriod(cycleEnd);
  return today >= p.start && today <= p.end;
};

/** 오늘 이후(오늘 포함) 처음 오는 그 날(1~31, 말일). 없는 날이면 말일 */
export function nextDayOf(today: string, day: BaseDay): string {
  const [y = 0, m = 1] = today.split('-').map(Number);
  const thisMonth = baseDateIn(y, m, day);
  if (thisMonth >= today) return thisMonth;
  const t = y * 12 + m; // 다음 달
  return baseDateIn(Math.floor(t / 12), (t % 12) + 1, day);
}

export type UpcomingKind = 'payday' | 'close' | 'wedding';
export interface Upcoming {
  date: string;
  kind: UpcomingKind;
  /** payday: 누구의 월급날(이름) */
  who?: string;
  dday: number;
}

/** 다가오는 일정(H-07): 30일 안, 날짜순 최대 5개. 첫 사이클을 다음 사이클과 합쳐 정리하면 그 기간은 빼고 */
export function upcoming(o: {
  today: string;
  paydays: { who: string; day: BaseDay | null }[];
  cycleEnd: string | null;
  mergedClose: boolean;
  weddingDate?: string | null;
}): Upcoming[] {
  const out: Upcoming[] = [];
  const within = (d: string) => daysBetween(o.today, d) >= 0 && daysBetween(o.today, d) <= 30;
  for (const p of o.paydays) {
    if (p.day === null) continue;
    const d = nextDayOf(o.today, p.day);
    if (within(d)) out.push({ date: d, kind: 'payday', who: p.who, dday: daysBetween(o.today, d) });
  }
  if (o.cycleEnd && !o.mergedClose) {
    const start = closePeriod(o.cycleEnd).start;
    const d = start < o.today ? o.today : start;
    if (d <= o.cycleEnd && within(d))
      out.push({ date: d, kind: 'close', dday: daysBetween(o.today, d) });
  }
  if (o.weddingDate && within(o.weddingDate))
    out.push({ date: o.weddingDate, kind: 'wedding', dday: daysBetween(o.today, o.weddingDate) });
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).slice(0, 5);
}

/**
 * 결혼 비용 현황(H-P4, 06 11장): 예식 전까지 모을 돈 = 총예산 − 양가 지원 − 모아둔 돈.
 * 부족액 = 모을 돈 − 예식 전까지 남은 모으기 계획액(월 필요액 × 남은 개월). 0 이하면 여유.
 */
export function weddingStatus(o: {
  budget: Won;
  support: Won;
  saved: Won;
  monthlyPlan: Won;
  monthsLeft: number;
}) {
  const toSave = Math.max(o.budget - o.support - o.saved, 0);
  const surplus = Math.max(o.support + o.saved - o.budget, 0);
  const shortfall = toSave - o.monthlyPlan * Math.max(o.monthsLeft, 0);
  return { toSave, shortfall: Math.max(shortfall, 0), surplus: surplus || Math.max(-shortfall, 0) };
}
