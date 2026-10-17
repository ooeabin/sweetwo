import { addDays, daysBetween } from '../date';
import { baseDateIn } from '../onboarding/cycle';
import type { BaseDay } from '../onboarding/cycle';

// 캘린더 돈 날짜(docs/spec/24-calendar.md ‘캘린더 범위’). 읽기 전용이고 누르면 해당 화면.
// 월급날(주말이면 직전 금요일), 월말 정리 기간 띠(기준일 3일 전 ~ 전날), 자산·대출 만기, 제안 적용일,
// 들어오는 돈(그 달 1일), 매년 목표 쓰는 달(그 달 1일).

export type MoneyKind = 'payday' | 'close' | 'maturity' | 'proposal' | 'income' | 'goal';
export interface MoneyDate {
  date: string;
  kind: MoneyKind;
  /** 라벨에 넣을 이름(사람, 항목, 목표). 문구는 화면이 만든다 */
  name: string;
  /** 누르면 갈 곳의 id(만기 자산, 제안, 목표) */
  ref?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const ymOf = (y: number, m: number) => `${y}-${pad(m)}`;
const weekday = (s: string) => {
  const [y = 0, m = 1, d = 1] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

/** 주말이면 직전 금요일(공휴일 표는 다음 단계) */
export function businessDayOnOrBefore(s: string) {
  const w = weekday(s);
  return w === 0 ? addDays(s, -2) : w === 6 ? addDays(s, -1) : s;
}

/** 달력 칸 6주 × 7일(일요일 시작). 다른 달 날짜는 muted */
export function monthGrid(y: number, m: number) {
  const first = `${ymOf(y, m)}-01`;
  const start = addDays(first, -weekday(first));
  return Array.from({ length: 42 }, (_, i) => {
    const date = addDays(start, i);
    return { date, day: Number(date.slice(8, 10)), muted: date.slice(0, 7) !== ymOf(y, m) };
  });
}

export interface MoneyInput {
  paydays: { name: string; day: BaseDay | null }[];
  /** 사이클 기준일(월말 정리 기간 계산). 없으면 정리 띠 없음 */
  baseDay: BaseDay | null;
  maturities: { id: string; name: string; date: string }[];
  proposals: { id: string; date: string }[];
  /** 들어오는 돈: 월(1~12), 매년이 아니면 처음 오는 그 달 한 번(만든 날 기준) */
  income: { name: string; month: number; yearly: boolean; createdOn: string }[];
  /** 매년 목표 쓰는 달(기한의 달) */
  yearlyGoals: { id: string; name: string; month: number }[];
}

/** 그 달(y, m)의 돈 날짜와 월말 정리 띠 */
export function moneyDates(y: number, m: number, o: MoneyInput) {
  const ym = ymOf(y, m);
  const first = `${ym}-01`;
  const out: MoneyDate[] = [];
  for (const p of o.paydays) {
    if (p.day === null) continue;
    out.push({
      date: businessDayOnOrBefore(baseDateIn(y, m, p.day)),
      kind: 'payday',
      name: p.name,
    });
  }
  // 정리 기간: 다음 기준일 3일 전 ~ 전날. 이번 달·다음 달 기준일 앞을 모두 보고 이 달에 걸친 것만
  const bands: { start: string; end: string }[] = [];
  if (o.baseDay !== null) {
    for (const [yy, mm] of [
      [y, m],
      [m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1],
    ] as const) {
      const base = baseDateIn(yy, mm, o.baseDay);
      const band = { start: addDays(base, -3), end: addDays(base, -1) };
      if (band.start.slice(0, 7) === ym || band.end.slice(0, 7) === ym) {
        bands.push(band);
        if (band.start.slice(0, 7) === ym) out.push({ date: band.start, kind: 'close', name: '' });
      }
    }
  }
  for (const a of o.maturities)
    if (a.date.slice(0, 7) === ym)
      out.push({ date: a.date, kind: 'maturity', name: a.name, ref: a.id });
  for (const p of o.proposals)
    if (p.date.slice(0, 7) === ym)
      out.push({ date: p.date, kind: 'proposal', name: '', ref: p.id });
  for (const e of o.income) {
    if (e.month !== m) continue;
    if (!e.yearly) {
      // 한 번만: 만든 날 이후 처음 오는 그 달
      const cy = Number(e.createdOn.slice(0, 4));
      const cm = Number(e.createdOn.slice(5, 7));
      const year = e.month >= cm ? cy : cy + 1;
      if (year !== y) continue;
    }
    out.push({ date: first, kind: 'income', name: e.name });
  }
  for (const g of o.yearlyGoals)
    if (g.month === m) out.push({ date: first, kind: 'goal', name: g.name, ref: g.id });
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { dates: out, bands };
}

/** 오늘부터 n일 안(오늘 포함)인지 */
export const withinDays = (today: string, date: string, n: number) => {
  const d = daysBetween(today, date);
  return d >= 0 && d < n;
};
