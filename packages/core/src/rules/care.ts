import { addDays, daysBetween } from '../date';
import { lunarToSolar } from './lunar';

// 챙길 날(docs/spec/24-calendar.md). 매년 양력 / 매년 음력 / 한 번. 화면은 다음 날짜, 달력 달의 날짜, D-day를 여기서.
export interface CareRule {
  date_rule: 'solar_yearly' | 'lunar_yearly' | 'once';
  month: number | null;
  day: number | null;
  leap: boolean;
  once_on: string | null;
}

const pad = (n: number) => String(n).padStart(2, '0');
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** 그 해(음력이면 그 음력 해)의 양력 날짜. 날짜가 없으면 null */
export function careDateInYear(c: CareRule, year: number): string | null {
  if (c.date_rule === 'once') return c.once_on;
  if (c.month === null || c.day === null) return null;
  if (c.date_rule === 'lunar_yearly') return lunarToSolar(year, c.month, c.day, c.leap);
  return `${year}-${pad(c.month)}-${pad(Math.min(c.day, lastDay(year, c.month)))}`;
}

/** 오늘(포함) 뒤 처음 오는 날. 한 번이면 그 날(지났어도) */
export function nextCareDate(c: CareRule, today: string): string | null {
  if (c.date_rule === 'once') return c.once_on;
  const y = Number(today.slice(0, 4));
  for (const yy of [y - 1, y, y + 1]) {
    const d = careDateInYear(c, yy);
    if (d && d >= today) return d;
  }
  return null;
}

/** 그 달(y, m) 안의 날짜들(음력은 앞 해 음력이 이번 해 양력으로 넘어오는 경우까지) */
export function careDatesInMonth(c: CareRule, y: number, m: number): string[] {
  const ym = `${y}-${pad(m)}`;
  const years = c.date_rule === 'lunar_yearly' ? [y - 1, y] : [y];
  const out = new Set<string>();
  for (const yy of years) {
    const d = careDateInYear(c, yy);
    if (d && d.slice(0, 7) === ym) out.add(d);
  }
  return [...out];
}

export const dday = (today: string, date: string) => daysBetween(today, date);

/** 설·추석 연휴(전날 ~ 다음날) */
export const holidaySpan = (date: string) => ({ start: addDays(date, -1), end: addDays(date, 1) });

/**
 * 양가 비용 한 회차(24 Y-02e, 06 10장): 1년 = 명절 2번 + 부모님 생신 한 분 단가 × 분 수(+ 그 밖의 날 예산).
 * 월 적립 = (회차 예산 − 이미 쓴 돈 − 모아둔 돈) ÷ 회차 남은 개월, 1천 원 단위 올림. 첫 등록은 쓴 돈·모아둔 돈 0
 */
export function familyCostMonthly(o: {
  total: number;
  spent?: number;
  saved?: number;
  monthsLeft: number;
}) {
  const left = Math.max(o.total - (o.spent ?? 0) - (o.saved ?? 0), 0);
  return Math.ceil(left / Math.max(o.monthsLeft, 1) / 1000) * 1000;
}

/** 다음 결혼기념일(회차 끝 = 다음 기념일 전날). 결혼일 모르면 null */
export function nextAnniversary(weddingDate: string | null, today: string): string | null {
  if (!weddingDate) return null;
  const m = Number(weddingDate.slice(5, 7));
  const d = Number(weddingDate.slice(8, 10));
  const y = Number(today.slice(0, 4));
  for (const yy of [y, y + 1]) {
    const date = `${yy}-${pad(m)}-${pad(Math.min(d, lastDay(yy, m)))}`;
    if (date > today) return date;
  }
  return null;
}

/** 이번 달부터 그 날짜의 달까지 남은 개월(같은 달이면 1) */
export function monthsUntil(today: string, date: string) {
  const a = Number(today.slice(0, 4)) * 12 + Number(today.slice(5, 7));
  const b = Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7));
  return Math.max(b - a, 1);
}

/** 그 해의 생일(양력 날짜). 음력이면 그 음력 해의 양력 날짜 */
export function birthdayInYear(
  b: { month: number; day: number; lunar: boolean; leap: boolean },
  year: number,
) {
  return careDateInYear(
    {
      date_rule: b.lunar ? 'lunar_yearly' : 'solar_yearly',
      month: b.month,
      day: b.day,
      leap: b.leap,
      once_on: null,
    },
    year,
  );
}

export type MilestoneKind = 'hwangap' | 'chilsun' | 'palsun';
/**
 * 환갑·칠순·팔순(24 참고 ‘챙길 날 전체 목록’): 태어난 해 기준, 오늘 이후만.
 * 환갑 = 만 60세 생일. 칠순·팔순은 가족 방식: 세는 나이(기본) 70·80 = 만 69·79, 만 나이면 만 70·80
 */
export function milestones(
  m: {
    birth_year: number | null;
    birth_month: number | null;
    birth_day: number | null;
    birth_lunar: boolean;
    birth_leap: boolean;
    korean_age: boolean;
  },
  today: string,
): { kind: MilestoneKind; date: string }[] {
  if (m.birth_year === null || m.birth_month === null || m.birth_day === null) return [];
  const b = { month: m.birth_month, day: m.birth_day, lunar: m.birth_lunar, leap: m.birth_leap };
  const k = m.korean_age ? 1 : 0;
  return (
    [
      ['hwangap', 60],
      ['chilsun', 70 - k],
      ['palsun', 80 - k],
    ] as const
  ).flatMap(([kind, age]) => {
    const date = birthdayInYear(b, (m.birth_year ?? 0) + age);
    return date && date >= today ? [{ kind, date }] : [];
  });
}

/** 조카 돌(24 Y-03b): 태어난 날(양력으로) + 1년. 태어난 해가 없거나 지났으면 null */
export function firstBirthday(
  m: {
    birth_year: number | null;
    birth_month: number | null;
    birth_day: number | null;
    birth_lunar: boolean;
    birth_leap: boolean;
  },
  today: string,
): string | null {
  if (m.birth_year === null || m.birth_month === null || m.birth_day === null) return null;
  const born = m.birth_lunar
    ? lunarToSolar(m.birth_year, m.birth_month, m.birth_day, m.birth_leap)
    : `${m.birth_year}-${pad(m.birth_month)}-${pad(m.birth_day)}`;
  if (!born) return null;
  const [y = 0, mo = 1, d = 1] = born.split('-').map(Number);
  const date = `${y + 1}-${pad(mo)}-${pad(Math.min(d, lastDay(y + 1, mo)))}`;
  return date >= today ? date : null;
}
