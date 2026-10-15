// 날짜는 KST 하나만 쓴다.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 지금 KST 기준 'YYYY-MM-DD' */
export function todayKst(now: Date = new Date()): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

const WEEKDAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
const ymd = (s: string) => {
  const [y = 0, m = 1, d = 1] = s.slice(0, 10).split('-').map(Number);
  return { y, m, d };
};
const dayNumber = (s: string) => {
  const { y, m, d } = ymd(s);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};

/** '2026-10-11' → "10월 11일 일요일"(오늘 띠 날짜) */
export function formatDateWeekday(s: string): string {
  const { y, m, d } = ymd(s);
  return `${m}월 ${d}일 ${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}`;
}

/** '2026-10-25' → "10월 25일" */
export function formatMonthDay(s: string): string {
  const { m, d } = ymd(s);
  return `${m}월 ${d}일`;
}

/** '2026-10-24' → "10.24"(기록 줄 날짜) */
export function formatDot(s: string): string {
  const { m, d } = ymd(s);
  return `${m}.${d}`;
}

/** '2027-01-09' → "2027년 1월 9일" */
export function formatDateFull(s: string): string {
  const { y, m, d } = ymd(s);
  return `${y}년 ${m}월 ${d}일`;
}

/** from → to 날짜 수(같은 날 0, 내일 1) */
export const daysBetween = (from: string, to: string) => dayNumber(to) - dayNumber(from);

/** 날짜 + n일 'YYYY-MM-DD' */
export const addDays = (s: string, n: number) =>
  new Date((dayNumber(s) + n) * 86_400_000).toISOString().slice(0, 10);
