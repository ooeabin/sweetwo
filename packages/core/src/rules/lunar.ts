import KoreanLunarCalendar from 'korean-lunar-calendar';

// 음력 ↔ 양력(09 데이터 항목 62~63줄: korean-lunar-calendar, 한국천문연구원 기준표, 2050년까지).
// 윤달 날짜가 그해 없으면 평달 같은 날, 음력 30일이 그 달에 없으면(작은달) 그 달 말일(29일).
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (c: { year: number; month: number; day: number }) =>
  `${c.year}-${pad(c.month)}-${pad(c.day)}`;

export const LUNAR_MAX_YEAR = 2050;

/** 그해 음력 월·일의 양력 날짜. 지원 범위 밖이면 null */
export function lunarToSolar(
  year: number,
  month: number,
  day: number,
  leap = false,
): string | null {
  if (year > LUNAR_MAX_YEAR) return null;
  const c = new KoreanLunarCalendar();
  for (const [d, l] of [
    [day, leap],
    [day, false],
    [Math.min(day, 29), leap],
    [Math.min(day, 29), false],
  ] as const) {
    if (c.setLunarDate(year, month, d, l)) return iso(c.getSolarCalendar());
  }
  return null;
}

/** 양력 날짜의 음력 월·일(상세 “(음력 8월 3일)”) */
export function solarToLunar(date: string) {
  const [y = 0, m = 1, d = 1] = date.split('-').map(Number);
  const c = new KoreanLunarCalendar();
  if (!c.setSolarDate(y, m, d)) return null;
  const l = c.getLunarCalendar();
  return { month: l.month, day: l.day, leap: !!l.intercalation };
}
