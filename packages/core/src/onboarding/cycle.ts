// 월 사이클 기준일(docs/spec/07-month-cycle.md 1장). 날짜는 KST.

/** 기준일: 1~31 또는 말일 */
export type BaseDay = number | 'last';

const pad = (n: number) => String(n).padStart(2, '0');
const lastDayOf = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const toDate = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

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
