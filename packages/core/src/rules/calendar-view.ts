import { addDays } from '../date';
import type { MoneyKind } from './calendar';

// 달력 Y-04 K안(docs/spec/24-calendar.md, 2026-11-24): 칸 그림 키 표(한 곳), 달 요약 줄, 칸 숫자 상태, 한 주로 접기.
// 그림 파일 이름 = 키. 파일이 아직 없으면 화면이 그림 칸을 그리지 않는다(Illustrations 숨김 규칙).

/** 경조사 그림 키 12개(docs/design/assets/Illustrations.md 10번 1~12). 순서 = Y-07 그림 고르기 격자 순서 */
export const CARE_ART_KEYS = [
  'cake',
  'heart',
  'diamond',
  'gift',
  'flower-tulip',
  'confetti',
  'users-three',
  'house',
  'baby',
  'graduation-cap',
  'airplane-tilt',
  'moon-stars',
] as const;
export type CareArtKey = (typeof CARE_ART_KEYS)[number];

/** 경조사 이름 칩(care_day.kind) → 기본 그림 키. 칩에 없는 종류와 직접 쓰기는 gift */
const CARE_ART_DEFAULT: Record<string, CareArtKey> = {
  birthday: 'cake',
  anniversary: 'diamond',
  dating_anniversary: 'heart',
  seollal: 'moon-stars',
  chuseok: 'moon-stars',
  parents_day: 'flower-tulip',
  event: 'gift',
  custom: 'gift',
};

export const isCareArtKey = (k: string | null | undefined): k is CareArtKey =>
  !!k && (CARE_ART_KEYS as readonly string[]).includes(k);

/** 이름 칩 kind의 기본 그림 키(DB 기존 행 채우기와 같은 표, supabase/migrations 20261229090000) */
export const careArtDefault = (kind: string): CareArtKey => CARE_ART_DEFAULT[kind] ?? 'gift';

/** 경조사 한 건의 그림 키: 저장한 키가 12개 안이면 그것, 아니면(null, 모르는 값) 종류 기본값 */
export const careArtKey = (c: { kind: string; art_key?: string | null }): CareArtKey =>
  isCareArtKey(c.art_key) ? c.art_key : careArtDefault(c.kind);

/** 금융 일정 종류별 고정 그림 키 4개. 월급날 확인 목록 안내·자동으로 나가는 날·공휴일은 그림 없음 */
const MONEY_ART: Partial<Record<MoneyKind, string>> = {
  payday: 'wallet',
  maturity: 'vault',
  deadline: 'flag-pennant',
  goal: 'flag-pennant',
  note: 'receipt',
};
export const moneyArtKey = (kind: MoneyKind): string | null => MONEY_ART[kind] ?? null;
/** 고정 4개(Illustrations.md 10번 13~16) */
export const MONEY_ART_KEYS = ['wallet', 'vault', 'flag-pennant', 'receipt'] as const;

/** 달 머리 아래 요약 줄의 재료(“경조사 3개(85만 원 예상)”, “금융 일정 4개”) */
export interface MonthSummary {
  kind: 'care' | 'money';
  count: number;
  /** 경조사 금액 메모 합(원). 금액 메모가 하나도 없으면 null */
  budget: number | null;
}

/**
 * 요약 줄: 보기 필터가 ‘금융 일정’이면 금융 일정 수, 아니면 그 달 경조사 수와 금액 메모 합.
 * 0개면 null(줄 없음). 금액 메모가 없으면 budget null(“경조사 3개”만)
 */
export function monthSummary(o: {
  filter: 'all' | 'care' | 'money';
  cares: readonly { budget: number }[];
  moneyCount: number;
}): MonthSummary | null {
  if (o.filter === 'money') {
    return o.moneyCount > 0 ? { kind: 'money', count: o.moneyCount, budget: null } : null;
  }
  if (!o.cares.length) return null;
  const sum = o.cares.reduce((a, c) => a + Math.max(0, c.budget), 0);
  return { kind: 'care', count: o.cares.length, budget: sum > 0 ? sum : null };
}

/** 칸 숫자 모양: 일정 있는 날 event(굵은 ink), 지난 날 past(stone), 그 밖 plain(slate). 공휴일·오늘·고른 날은 화면이 겹쳐 씀 */
export type DayTone = 'event' | 'past' | 'plain';
export function dayTone(date: string, today: string, eventCount: number): DayTone {
  if (eventCount > 0) return 'event';
  return date < today ? 'past' : 'plain';
}

/** 칸 그림과 ‘+n’: 첫 일정 그림 하나, 나머지 개수. 첫 일정 그림이 없으면 둘 다 없음 */
export function dayArt<T>(arts: readonly (T | null)[]): { first: T; more: number } | null {
  const first = arts[0];
  if (arts.length === 0 || first === null || first === undefined) return null;
  return { first, more: arts.length - 1 };
}

/** 한 주로 접었을 때 보이는 줄: 고른 날이 든 주(7칸 단위 줄 번호). 못 찾으면 0 */
export function weekIndexOf(dates: readonly string[], selected: string): number {
  const i = dates.indexOf(selected);
  return i < 0 ? 0 : Math.floor(i / 7);
}

/** 연휴 그림 키 2개(2026-11-26): 연휴의 모든 날 칸에 같은 그림. 파일이 없으면 안 그림 */
export const HOLIDAY_ART_KEYS = ['holiday-seol', 'holiday-chuseok'] as const;
export type HolidayStreakKind = 'seol' | 'chuseok';
const STREAK_ART: Record<HolidayStreakKind, (typeof HOLIDAY_ART_KEYS)[number]> = {
  seol: 'holiday-seol',
  chuseok: 'holiday-chuseok',
};
const STREAK_NAME: Record<HolidayStreakKind, string> = { seol: '설', chuseok: '추석' };

/** 설날·추석 날짜를 포함해 이어진 공휴일 한 덩어리(대체공휴일 포함) */
export interface HolidayStreak {
  kind: HolidayStreakKind;
  /** 첫 날, 끝 날(YYYY-MM-DD) */
  start: string;
  end: string;
}

/**
 * 연휴 찾기: 공휴일 날짜를 이어진 덩어리로 묶고, 이름에 ‘설날’ 또는 ‘추석’이 든 날이 있는 덩어리만 연휴.
 * (주말은 공휴일 표에 연휴로 들어 있어야 이어짐. 설날과 추석이 한 덩어리로 이어지는 일은 없음)
 */
export function holidayStreaks(
  holidays: readonly { date: string; name: string }[],
): HolidayStreak[] {
  const sorted = [...holidays].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const out: HolidayStreak[] = [];
  let group: { date: string; name: string }[] = [];
  const flush = () => {
    if (!group.length) return;
    const kind: HolidayStreakKind | null = group.some((h) => h.name.includes('설날'))
      ? 'seol'
      : group.some((h) => h.name.includes('추석'))
        ? 'chuseok'
        : null;
    const first = group[0];
    const last = group[group.length - 1];
    if (kind && first && last) out.push({ kind, start: first.date, end: last.date });
    group = [];
  };
  for (const h of sorted) {
    const last = group[group.length - 1];
    if (last && last.date === h.date) {
      group.push(h);
      continue;
    }
    if (last && addDays(last.date, 1) !== h.date) flush();
    group.push(h);
  }
  flush();
  return out;
}

/** 그 날이 든 연휴(없으면 null) */
export const streakOn = (streaks: readonly HolidayStreak[], date: string): HolidayStreak | null =>
  streaks.find((s) => date >= s.start && date <= s.end) ?? null;

/** 연휴 그림 키(칸 첫 그림) */
export const holidayStreakArtKey = (k: HolidayStreakKind) => STREAK_ART[k];

/** 그 달에 하루라도 걸린 연휴 */
export const streaksInMonth = (streaks: readonly HolidayStreak[], y: number, m: number) => {
  const ym = `${y}-${String(m).padStart(2, '0')}`;
  return streaks.filter((s) => s.start.slice(0, 7) <= ym && ym <= s.end.slice(0, 7));
};

/** 연휴 기간 글자: “6~9일”, 달을 넘으면 “9월 30일~10월 2일” */
export function streakSpan(s: HolidayStreak): string {
  const [, sm, sd] = s.start.split('-').map(Number) as [number, number, number];
  const [, em, ed] = s.end.split('-').map(Number) as [number, number, number];
  return sm === em ? `${sd}~${ed}일` : `${sm}월 ${sd}일~${em}월 ${ed}일`;
}

/** 요약 줄 맨 앞 글자: “설 연휴 6~9일”, 달을 넘으면 “추석 연휴 9월 30일~10월 2일” */
export const streakLabel = (s: HolidayStreak): string =>
  `${STREAK_NAME[s.kind]} 연휴 ${streakSpan(s)}`;

/** 칸 그림 목록 앞에 연휴 그림을 붙임(그 날의 첫 그림이 연휴 그림, 나머지는 “+n”) */
export const withStreakArt = <T>(arts: readonly (T | null)[], streakArt: T | null): (T | null)[] =>
  streakArt === null ? [...arts] : [streakArt, ...arts];
