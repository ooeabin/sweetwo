// 연·월 계산(KST). 'YYYY-MM' 문자열로 다룬다.
import { todayKst } from '../date';

export type YearMonth = `${number}-${string}`;

export const ym = (y: number, m: number): YearMonth =>
  `${y}-${String(m).padStart(2, '0')}` as YearMonth;
export const parseYm = (s: string) => {
  const [y = 0, m = 1] = s.split('-').map(Number);
  return { y, m };
};
export const thisMonth = (now = new Date()): YearMonth => todayKst(now).slice(0, 7) as YearMonth;
export const addMonths = (s: string, n: number): YearMonth => {
  const { y, m } = parseYm(s);
  const t = y * 12 + (m - 1) + n;
  return ym(Math.floor(t / 12), (t % 12) + 1);
};
export const addYears = (s: string, n: number) => addMonths(s, n * 12);
/** from → to 개월 수(같은 달 0) */
export const monthsBetween = (from: string, to: string) => {
  const a = parseYm(from);
  const b = parseYm(to);
  return b.y * 12 + b.m - (a.y * 12 + a.m);
};
/** 올해 또는 내년 중 처음 오는 그 달(이번 달이면 이번 달) */
export const nextOccurrence = (month: number, now = new Date()): YearMonth => {
  const { y, m } = parseYm(thisMonth(now));
  return ym(month >= m ? y : y + 1, month);
};
/** DB date(그 달 1일) ↔ YearMonth */
export const ymToDate = (s: string) => `${s}-01`;
export const dateToYm = (d: string) => d.slice(0, 7) as YearMonth;
