import { addDays, daysBetween } from '../date';
import { baseDateIn } from '../onboarding/cycle';
import type { BaseDay } from '../onboarding/cycle';

// 캘린더 돈 일정(docs/spec/24-calendar.md ‘캘린더 범위’, 재기획 2026-10-25). 읽기 전용이고 누르면 해당 화면.
// 월급날(주말·공휴일이면 직전 영업일, 부부가 끄면 그대로), 월말 확인 띠(다음 월급날 3일 전 ~ 전날, W-05),
// 목표 기한(한 번 목표, 기한의 달 1일), 매년 목표 쓰는 달(그 달 1일), 자산·대출 만기.

export type MoneyKind = 'payday' | 'review' | 'deadline' | 'goal' | 'maturity';
export interface MoneyDate {
  date: string;
  kind: MoneyKind;
  /** 라벨에 넣을 이름(사람, 항목, 목표). 합쳐서 모드 월급날은 ''. 문구는 화면이 만든다 */
  name: string;
  /** 누르면 갈 곳의 id(만기 자산, 목표) */
  ref?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const ymOf = (y: number, m: number) => `${y}-${pad(m)}`;
const weekday = (s: string) => {
  const [y = 0, m = 1, d = 1] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

/** 주말·공휴일이면 직전 영업일(07 1장, 표시만 바뀌고 기준일·사이클은 그대로) */
export function businessDayOnOrBefore(s: string, holidays: ReadonlySet<string> = new Set()) {
  let d = s;
  for (let i = 0; i < 14; i++) {
    const w = weekday(d);
    if (w !== 0 && w !== 6 && !holidays.has(d)) return d;
    d = addDays(d, -1);
  }
  return d;
}

/** 설·추석 연휴 띠(24 Y-04 10번): 설날·추석과 그 연휴, 그 대체공휴일 */
export const isFestive = (name: string) => name.includes('설날') || name.includes('추석');

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
  /** 각자 모드 = 사람마다(이름), 합쳐서 모드 = 체크리스트를 만드는 날 하나(이름 '') */
  paydays: { name: string; day: BaseDay | null }[];
  /** 공휴일 날짜. 월급날 앞당기기에 씀 */
  holidays?: ReadonlySet<string>;
  /** 월급날 주말·공휴일 앞당겨 표시(기본 켜짐) */
  shift?: boolean;
  /** 월말 확인 기준 월급날(각자 = 내 월급날, 합쳐서 = 공동 사이클 날). 없으면 띠 없음 */
  reviewDay: BaseDay | null;
  maturities: { id: string; name: string; date: string }[];
  /** 한 번 목표 기한(YYYY-MM-DD, 보통 그 달 1일). 진행 중 목표만 넘김 */
  goalDeadlines: { id: string; name: string; date: string }[];
  /** 매년 목표 쓰는 달(기한의 달) */
  yearlyGoals: { id: string; name: string; month: number }[];
}

/** 그 달(y, m)의 돈 일정과 월말 확인 띠 */
export function moneyDates(y: number, m: number, o: MoneyInput) {
  const ym = ymOf(y, m);
  const first = `${ym}-01`;
  const out: MoneyDate[] = [];
  for (const p of o.paydays) {
    if (p.day === null) continue;
    out.push({
      date:
        o.shift === false
          ? baseDateIn(y, m, p.day)
          : businessDayOnOrBefore(baseDateIn(y, m, p.day), o.holidays),
      kind: 'payday',
      name: p.name,
    });
  }
  // 월말 확인: 다음 월급날 3일 전 ~ 전날. 이번 달·다음 달 월급날 앞을 모두 보고 이 달에 걸친 것만
  const bands: { start: string; end: string }[] = [];
  if (o.reviewDay !== null) {
    for (const [yy, mm] of [
      [y, m],
      [m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1],
    ] as const) {
      const base = baseDateIn(yy, mm, o.reviewDay);
      const band = { start: addDays(base, -3), end: addDays(base, -1) };
      if (band.start.slice(0, 7) === ym || band.end.slice(0, 7) === ym) {
        bands.push(band);
        if (band.start.slice(0, 7) === ym) out.push({ date: band.start, kind: 'review', name: '' });
      }
    }
  }
  for (const a of o.maturities)
    if (a.date.slice(0, 7) === ym)
      out.push({ date: a.date, kind: 'maturity', name: a.name, ref: a.id });
  for (const g of o.goalDeadlines)
    if (g.date.slice(0, 7) === ym)
      out.push({ date: g.date, kind: 'deadline', name: g.name, ref: g.id });
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
