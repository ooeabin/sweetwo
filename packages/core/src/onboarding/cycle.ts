import { todayKst } from '../date';
import type { Won } from '../money';
import { splitShares, type SplitMode } from './plan';

// 월 사이클(docs/spec/07-month-cycle.md 1장, 3-1)과 첫 월급 플랜(17-onboarding-2.md O-66). 날짜는 KST.

/** 기준일: 1~31 또는 말일 */
export type BaseDay = number | 'last';

const M = 10_000;
const pad = (n: number) => String(n).padStart(2, '0');
const lastDayOf = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const toDate = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const parse = (s: string) => {
  const [y = 0, m = 1, d = 1] = s.split('-').map(Number);
  return { y, m, d };
};
const dayNo = (s: string) => {
  const { y, m, d } = parse(s);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};
const shiftMonth = (y: number, m: number, n: number) => {
  const t = y * 12 + (m - 1) + n;
  return { y: Math.floor(t / 12), m: (t % 12) + 1 };
};

/** 그 달의 기준일 날짜. 그 달에 없는 날(29~31일)이면 말일 */
export function baseDateIn(y: number, m: number, base: BaseDay) {
  const last = lastDayOf(y, m);
  return toDate(y, m, base === 'last' ? last : Math.min(base, last));
}

/** 기본 기준일 = 두 사람 월급날 중 늦은 날(미합류면 내 월급날). 말일이 가장 늦다 */
export function defaultBaseDay(paydays: (BaseDay | null | undefined)[]): BaseDay | null {
  const known = paydays.filter((p): p is BaseDay => p !== null && p !== undefined);
  if (!known.length) return null;
  if (known.includes('last')) return 'last';
  return Math.max(...(known as number[]));
}

export interface Cycle {
  /** 사이클 시작(기준일) 'YYYY-MM-DD' */
  start: string;
  /** 다음 기준일 전날 */
  end: string;
  /** 플랜 이름의 월(기준일의 월) 'YYYY-MM' */
  labelMonth: string;
  /** 오늘 포함 남은 일수 */
  daysLeft: number;
  /** 사이클 일수 */
  days: number;
  /** 남은 기간 15일 미만 → 첫 정리를 다음 사이클과 합침 */
  short: boolean;
}

/** 오늘이 든 사이클 = 기준일 0시 ~ 다음 기준일 전날 자정 */
export function currentCycle(base: BaseDay, now = new Date()): Cycle {
  const today = todayKst(now);
  const { y, m } = parse(today);
  const thisBase = baseDateIn(y, m, base);
  const s = today >= thisBase ? { y, m } : shiftMonth(y, m, -1);
  const start = baseDateIn(s.y, s.m, base);
  const n = shiftMonth(s.y, s.m, 1);
  const nextStart = baseDateIn(n.y, n.m, base);
  const endNo = dayNo(nextStart) - 1;
  const end = new Date(endNo * 86_400_000).toISOString().slice(0, 10);
  const daysLeft = endNo - dayNo(today) + 1;
  return {
    start,
    end,
    labelMonth: start.slice(0, 7),
    daysLeft,
    days: endNo - dayNo(start) + 1,
    short: daysLeft < 15,
  };
}

/** 월 금액을 남은 기간만큼(× 남은 일수 ÷ 사이클 일수), 1만 원 단위 반올림 */
export const prorate = (monthly: Won, c: Pick<Cycle, 'daysLeft' | 'days'>): Won =>
  Math.round((monthly * c.daysLeft) / c.days / M) * M;

export interface PlanParts {
  living: Won;
  goalFund: Won;
  emergency: Won;
}

/**
 * 이번 달 옮길 돈을 바꾸면: 공동 생활비는 그대로, 목표자금과 비상금을 같은 비율로 줄이거나 늘림.
 * 생활비보다 적게 넣으면 생활비만 그 금액. 비율로 나눈 끝전은 목표자금에.
 */
export function adjustParts(p: PlanParts, total: Won): PlanParts {
  const t = Math.max(total, 0);
  if (t <= p.living) return { living: t, goalFund: 0, emergency: 0 };
  const rest = t - p.living;
  const saving = p.goalFund + p.emergency;
  if (saving <= 0) return { living: p.living, goalFund: rest, emergency: 0 };
  const emergency = Math.round((rest * p.emergency) / saving / M) * M;
  return { living: p.living, goalFund: rest - emergency, emergency };
}

export interface SplitLine {
  key: keyof PlanParts;
  amount: Won;
  me: Won;
  partner: Won;
}

/** 통장별 줄을 분담 비율로 나눔(06 4장 splitShares, 줄마다 1만 원 단위) */
export function splitLines(
  p: PlanParts,
  o: { mode: SplitMode; myIncome: Won; partnerIncome: Won; myRatio?: number },
): SplitLine[] {
  return (Object.keys(p) as (keyof PlanParts)[]).map((key) => {
    const s = splitShares({ total: p[key], ...o });
    return { key, amount: p[key], me: s.me, partner: s.partner };
  });
}
