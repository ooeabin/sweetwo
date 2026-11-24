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

/** 음력 그 달 그 날의 양력(없는 날이면 null, lunarToSolar와 달리 대신 쓰는 날 없음) */
export function lunarDaySolar(year: number, month: number, day: number, leap = false): string | null {
  if (year > LUNAR_MAX_YEAR) return null;
  const c = new KoreanLunarCalendar();
  if (!c.setLunarDate(year, month, day, leap)) return null;
  const solar = c.getSolarCalendar();
  // 라이브러리는 없는 윤달·없는 30일도 받아 주므로 되돌려 같은 음력 날짜인지 확인
  if (!c.setSolarDate(solar.year, solar.month, solar.day)) return null;
  const l = c.getLunarCalendar();
  return l.year === year && l.month === month && l.day === day && !!l.intercalation === leap
    ? iso(solar)
    : null;
}

/**
 * 음력 한 달 달력 칸(일요일 시작): 앞 빈 칸 null, 그 뒤 1~29(또는 30). 첫날의 양력 요일에 맞춤.
 * 그 달이 없으면(그해 윤달이 없음, 지원 범위 밖) null. 달력 시트 음력(2026-11-24)
 */
export function lunarMonthCells(year: number, month: number, leap = false): (number | null)[] | null {
  const first = lunarDaySolar(year, month, 1, leap);
  if (!first) return null;
  const [fy = 0, fm = 1, fd = 1] = first.split('-').map(Number);
  const lead = new Date(Date.UTC(fy, fm - 1, fd)).getUTCDay();
  const days = lunarDaySolar(year, month, 30, leap) ? 30 : 29;
  return [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
}
