import { addDays } from '../date';
import { careDateInYear, familyCostMonthly, monthsUntil, type CareRule } from './care';

// 이번 회차 양가 비용(docs/spec/24-calendar.md Y-06, 06 10장). 회차 = 결혼기념일 기준 1년.
// 양가 날(category family)만 셈. 항목 4행: 설·추석 / 부모님 생신 / 어버이날 / 그 밖의 날, 단가 × 횟수.

const pad = (n: number) => String(n).padStart(2, '0');
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const dateIn = (y: number, m: number, d: number) =>
  `${y}-${pad(m)}-${pad(Math.min(d, lastDay(y, m)))}`;

export interface Round {
  start: string;
  /** 마지막 날(다음 결혼기념일 전날) */
  end: string;
}

/** 오늘이 든 회차. 결혼일을 모르거나 아직이면 오늘부터 1년 */
export function careRound(weddingDate: string | null, today: string): Round {
  const y = Number(today.slice(0, 4));
  if (weddingDate && weddingDate <= today) {
    const m = Number(weddingDate.slice(5, 7));
    const d = Number(weddingDate.slice(8, 10));
    const start = [y, y - 1].map((yy) => dateIn(yy, m, d)).find((s) => s <= today) ?? today;
    const sy = Number(start.slice(0, 4));
    return { start, end: addDays(dateIn(sy + 1, m, d), -1) };
  }
  const [, m = 1, d = 1] = today.split('-').map(Number);
  return { start: today, end: addDays(dateIn(y + 1, m, d), -1) };
}

export interface RoundCare extends CareRule {
  id: string;
  category: string;
  kind: string;
  budget: number;
  /** 부모님 생신인지(가족 관계 parent) */
  parent?: boolean;
}

/** 회차 안 양가 날(날짜순) */
export function roundOccurrences<T extends RoundCare>(cares: T[], r: Round) {
  const sy = Number(r.start.slice(0, 4));
  return cares
    .filter((c) => c.category === 'family')
    .flatMap((c) => {
      const dates =
        c.date_rule === 'once'
          ? [c.once_on]
          : [sy - 1, sy, sy + 1].map((y) => careDateInYear(c, y));
      return [...new Set(dates)]
        .filter((d): d is string => !!d && d >= r.start && d <= r.end)
        .map((date) => ({ care: c, date }));
    })
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

export type FamilyRowKey = 'holiday' | 'birthday' | 'parents_day' | 'other';
export const FAMILY_ROWS: FamilyRowKey[] = ['holiday', 'birthday', 'parents_day', 'other'];
export const rowOf = (c: Pick<RoundCare, 'kind' | 'parent'>): FamilyRowKey =>
  c.kind === 'seollal' || c.kind === 'chuseok'
    ? 'holiday'
    : c.kind === 'birthday' && c.parent
      ? 'birthday'
      : c.kind === 'parents_day'
        ? 'parents_day'
        : 'other';

export interface FamilyRow {
  key: FamilyRowKey;
  /** 한 번 단가(그 밖의 날은 평균, 1천 원 반올림) */
  unit: number;
  count: number;
  total: number;
}

/** 항목 4행(Y-06 5번) */
export function familyRows(occ: { care: RoundCare }[]): FamilyRow[] {
  return FAMILY_ROWS.map((key) => {
    const xs = occ.filter((o) => rowOf(o.care) === key);
    const total = xs.reduce((t, o) => t + o.care.budget, 0);
    const unit =
      key === 'other'
        ? xs.length
          ? Math.round(total / xs.length / 1000) * 1000
          : 0
        : (xs[0]?.care.budget ?? 0);
    return { key, unit, count: xs.length, total };
  });
}

/** 단가를 바꾸면 1년 합계(바꾼 행은 단가 × 횟수, 그대로인 행은 지금 합계) */
export function rowsTotal(rows: FamilyRow[], units: Partial<Record<FamilyRowKey, number>> = {}) {
  return rows.reduce((t, r) => {
    const u = units[r.key];
    return t + (u === undefined || u === r.unit ? r.total : u * r.count);
  }, 0);
}

/** 회차 남은 달마다 나갈 돈(Y-06 3번): 이번 달부터 회차 끝 달까지, 오늘 이후 날만 */
export function monthlyOut(occ: { care: RoundCare; date: string }[], r: Round, today: string) {
  const out: { month: string; amount: number }[] = [];
  let y = Number(today.slice(0, 4));
  let m = Number(today.slice(5, 7));
  const endYm = r.end.slice(0, 7);
  while (`${y}-${pad(m)}` <= endYm) {
    const ym = `${y}-${pad(m)}`;
    out.push({
      month: `${ym}-01`,
      amount: occ
        .filter((o) => o.date >= today && o.date.slice(0, 7) === ym)
        .reduce((t, o) => t + o.care.budget, 0),
    });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/**
 * 회차 요약(Y-06 2·4번): 예산, 쓴 돈, 모아둔 돈(보유액), 아직 안 쓴 돈, 남은 달, 매달 모을 돈,
 * 다음 챙길 날까지 모아둔 돈이 충분한지(모자라면 다음 달부터 더 모을 돈, 1천 원 올림)
 */
export function familyCostSummary(o: {
  total: number;
  spent: number;
  held: number;
  round: Round;
  today: string;
  next: { date: string; budget: number } | null;
}) {
  const left = Math.max(o.total - o.spent, 0);
  const monthsLeft = monthsUntil(o.today, o.round.end);
  const monthly = familyCostMonthly({
    total: o.total,
    spent: o.spent,
    saved: o.held,
    monthsLeft,
  });
  const short = o.next ? Math.max(o.next.budget - o.held, 0) : 0;
  const extra =
    short && o.next ? Math.ceil(short / monthsUntil(o.today, o.next.date) / 1000) * 1000 : 0;
  return { left, monthsLeft, monthly, enough: short === 0, extra };
}
