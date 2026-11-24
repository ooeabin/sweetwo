// 날짜는 KST 하나만 쓴다.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 지금 KST 기준 'YYYY-MM-DD' */
export function todayKst(now: Date = new Date()): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 서버 시각(ISO) → 그때의 KST 날짜 'YYYY-MM-DD'(2026-11-12 S6-10: UTC 날짜로 비교하면 KST 0~9시가 하루 앞으로 읽힘) */
export const kstDateOf = (iso: string): string => todayKst(new Date(iso));

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

/** '2026-12-24' → "24일 목요일"(같은 달 안 짧은 날짜, 캘린더 앞당긴 월급날 까닭) */
export function formatDayWeekday(s: string): string {
  const { y, m, d } = ymd(s);
  return `${d}일 ${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}`;
}

/** '2026-10-25' → "10월 25일" */
export function formatMonthDay(s: string): string {
  const { m, d } = ymd(s);
  return `${m}월 ${d}일`;
}

/** '2026-08-26' → "08.26"(체크한 날, 월급 기간처럼 두 자리. 2026-11-03) */
export function formatDot2(s: string): string {
  return s.slice(5, 10).replace('-', '.');
}

/** '2026-10-24' → "10.24"(기록 줄 날짜) */
export function formatDot(s: string): string {
  const { m, d } = ymd(s);
  return `${m}.${d}`;
}

/** '2026-11-25' → "2026.11.25"(어드민 날짜 칸 DatePicker, 2026-11-17) */
export function formatDateDot(s: string): string {
  return s.slice(0, 10).replace(/-/g, '.');
}

/** "2026.11.25", "2026-11-25", "20261125", "2026 11 25" → '2026-11-25'(없는 날짜면 null). 어드민 날짜 칸 직접 입력 */
export function parseDateDot(t: string): string | null {
  const m = /^(\d{4})[-./\s]?(\d{1,2})[-./\s]?(\d{1,2})\.?$/.exec(t.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d)
    return null;
  return dt.toISOString().slice(0, 10);
}

/** "14:00", "1400", "9:05" → '14:00'(없는 시각이면 null) */
export function parseTimeText(t: string): string | null {
  const m = /^(\d{1,2}):?(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const [h, mi] = [Number(m[1]), Number(m[2])];
  if (h > 23 || mi > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
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

/** 시각(ISO) → KST "2026-10-18 14:05"(어드민 표, 감사 로그) */
export function formatKstDateTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + KST_OFFSET_MS).toISOString();
  return `${d.slice(0, 10)} ${d.slice(11, 16)}`;
}

/** 시각(ISO) → KST "10월 27일 15:05"(오프라인 띠 ‘마지막 저장’) */
export function formatKstMonthDayTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + KST_OFFSET_MS).toISOString();
  return `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일 ${d.slice(11, 16)}`;
}

/** 두 시각 사이 시간(시간 단위 내림) */
export const hoursBetween = (fromIso: string, to: Date = new Date()) =>
  Math.max(0, Math.floor((to.getTime() - new Date(fromIso).getTime()) / 3_600_000));

const WEEKDAY_SHORT = ['일', '월', '화', '수', '목', '금', '토'];

/** 요일 0(일)~6(토) */
export function weekdayIndex(s: string): number {
  const { y, m, d } = ymd(s);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** '2026-11-26' → "2026년 11월 26일 (목)"(폼 날짜 한 줄, 달력 시트 2026-11-24) */
export function formatDateDow(s: string): string {
  const { y, m, d } = ymd(s);
  return `${y}년 ${m}월 ${d}일 (${WEEKDAY_SHORT[weekdayIndex(s)]})`;
}

/** '2026-11-26' → "11월 26일 (목)"(달력 시트 아래 버튼) */
export function formatMonthDayDow(s: string): string {
  const { m, d } = ymd(s);
  return `${m}월 ${d}일 (${WEEKDAY_SHORT[weekdayIndex(s)]})`;
}

/** '2026-11-26' → "2026년 11월 26일 목요일"(달력 날짜 화면 읽기 이름) */
export function formatDateReadout(s: string): string {
  const { y, m, d } = ymd(s);
  return `${y}년 ${m}월 ${d}일 ${WEEKDAYS[weekdayIndex(s)]}`;
}

/** 그 달 일 수 */
export const daysInMonth = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate();

/**
 * 그 달 달력 칸(일요일 시작): 앞 빈 칸은 null, 그 뒤 1~말일. 줄 수는 부르는 쪽이 7칸씩 끊음.
 * 달력 시트의 격자 계산(2026-11-24)
 */
export function monthCells(y: number, m: number): (number | null)[] {
  const lead = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  return [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth(y, m) }, (_, i) => i + 1),
  ];
}
