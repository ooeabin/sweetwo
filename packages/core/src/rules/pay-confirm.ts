import { addDays, daysBetween } from '../date';
import { baseDateIn, type BaseDay } from '../onboarding/cycle';
import { inReviewWindow } from './review-window';

// 월급날 확인 v2.2(docs/spec/07 2·3·4·7장, ADR 0009 결정 2·3·3-1). 서버 마이그레이션 20261201090000_v22_check_loop
// 계약과 같은 결과: auto_due_date, late_check_until, make_checklist(checklist_from 소급 없음), confirm_payday 권한.
// ‘손 줄’ = 확인 목록 줄 중 auto = false(사람이 확인), ‘자동 줄’ = auto = true(나가는 날 자동 확인).

const pad = (n: number) => String(n).padStart(2, '0');
const ymdOf = (d: string) => ({ y: Number(d.slice(0, 4)), m: Number(d.slice(5, 7)) });
const shiftMonth = (y: number, m: number, n: number) => {
  const t = y * 12 + (m - 1) + n;
  return { y: Math.floor(t / 12), m: (t % 12) + 1 };
};
/** 날짜 + n달(Postgres `date + interval 'n month'`처럼 그 달에 없는 날이면 말일) */
export function addMonthsToDate(d: string, n: number): string {
  const { y, m } = ymdOf(d);
  const t = shiftMonth(y, m, n);
  const day = Number(d.slice(8, 10));
  return baseDateIn(t.y, t.m, day);
}
/** 서버 cycle_date(day, y, m): 1~31(31 = 말일), 그 달에 없는 날이면 말일 */
const cycleDate = (day: number, y: number, m: number) => baseDateIn(y, m, day >= 31 ? 'last' : day);
/** BaseDay('last' 또는 1~31) → 서버 smallint(말일 = 31) */
export const baseDayNumber = (b: BaseDay): number => (b === 'last' ? 31 : b);

/**
 * 자동 줄 나가는 날(서버 auto_due_date(s, e, day), 07 3장): day가 null이면 사이클 시작(= 월급날).
 * 아니면 시작일이 있는 달의 그날(말일 넘으면 말일)이 시작일 이상이면 그날, 아니면 다음 달의 그날. 끝보다 뒤면 끝
 */
export function autoDue(cycleStart: string, cycleEnd: string, autoDay: number | null): string {
  if (autoDay === null) return cycleStart;
  const { y, m } = ymdOf(cycleStart);
  let d = cycleDate(autoDay, y, m);
  if (d < cycleStart) {
    const n = shiftMonth(y, m, 1);
    d = cycleDate(autoDay, n.y, n.m);
  }
  return d < cycleEnd ? d : cycleEnd;
}

/** 오늘이 든 사이클(서버 make_checklist): 이번 달 기준일이 오늘보다 뒤면 지난달 기준일부터, 끝 = 다음 기준일 전날 */
export function cycleOf(today: string, base: BaseDay): { start: string; end: string } {
  const day = baseDayNumber(base);
  const { y, m } = ymdOf(today);
  let s = cycleDate(day, y, m);
  if (s > today) {
    const p = shiftMonth(y, m, -1);
    s = cycleDate(day, p.y, p.m);
  }
  const n = shiftMonth(Number(s.slice(0, 4)), Number(s.slice(5, 7)), 1);
  return { start: s, end: addDays(cycleDate(day, n.y, n.m), -1) };
}

/**
 * 첫 확인 목록이 생기는 날(소급 없음, 07 3-1, 서버 계약 2): 월급 계획을 만든 날(checklist_from) 이후 처음 오는 기준일.
 * 만든 날이 기준일이면 그날. 날짜 없음(기준일 null)이면 없음
 */
export function firstChecklistStart(checklistFrom: string, base: BaseDay | null): string | null {
  if (base === null) return null;
  const day = baseDayNumber(base);
  const { y, m } = ymdOf(checklistFrom);
  const d = cycleDate(day, y, m);
  if (d >= checklistFrom) return d;
  const n = shiftMonth(y, m, 1);
  return cycleDate(day, n.y, n.m);
}

/**
 * 늦은 확인 마지막 날(서버 late_check_until, 07 4장): 지난 사이클 목록은 그다음 사이클이 끝날 때까지.
 * 다음 사이클 시작 = 끝 + 1일, 그 끝 = 그다음 기준일 전날. 기준일이 없으면(날짜 없음으로 바꿈) 다음 시작 + 1달 − 1일
 */
export function lateCheckUntil(cycleEnd: string, base: BaseDay | null): string {
  const next = addDays(cycleEnd, 1);
  if (base === null) return addDays(addMonthsToDate(next, 1), -1);
  const { y, m } = ymdOf(addMonthsToDate(next, 1));
  return addDays(cycleDate(baseDayNumber(base), y, m), -1);
}

/** 오늘 늦은 확인을 받을 수 있나: 사이클이 끝났고 늦은 확인 마지막 날 안 */
export const canLateCheck = (today: string, cycleEnd: string, base: BaseDay | null) =>
  today > cycleEnd && today <= lateCheckUntil(cycleEnd, base);

export interface ConfirmLine {
  state: string;
  auto?: boolean | null;
  auto_due?: string | null;
  kind?: string;
  user_id?: string | null;
}

/** 손 줄(사람이 확인) */
export const isManual = (l: ConfirmLine) => !l.auto;
/** 남은 손 줄 수(wait인 손 줄) */
export const manualLeft = (lines: readonly ConfirmLine[]) =>
  lines.filter((l) => isManual(l) && l.state === 'wait').length;
/** 손 줄 수 */
export const manualCount = (lines: readonly ConfirmLine[]) => lines.filter(isManual).length;

/**
 * 확인 끝(07 7장): 손 줄이 모두 체크 또는 건너뜀. 손 줄이 없으면 처음부터 끝(자동 줄은 따로 요구하지 않음)
 */
export const isConfirmed = (lines: readonly ConfirmLine[]) => manualLeft(lines) === 0;

/** 확인 끝 문장 종류(07 7장): 손 줄이 모두 체크면 'all'(“…계획대로 됐어요”), 건너뜀이 섞이면 'mixed'. 끝나지 않았으면 null */
export function confirmFinish(lines: readonly ConfirmLine[]): 'all' | 'mixed' | null {
  const manual = lines.filter(isManual);
  if (manual.some((l) => l.state === 'wait')) return null;
  return manual.some((l) => l.state !== 'checked') ? 'mixed' : 'all';
}

/** 월급 전 확인이 열리는가(07 4장): 기간(다음 기준일 3일 전 ~ 끝) 안 + 손 줄이 남음. 자동 줄만 남으면 없음 */
export const reviewDue = (today: string, cycleEnd: string, lines: readonly ConfirmLine[]) =>
  inReviewWindow(today, cycleEnd) && manualLeft(lines) > 0;

/**
 * 이 사람이 확인을 맡은 손 줄인가(서버 pay_line_mine과 같음, 07 4장, 08 2장):
 * 각자 목록은 주인만. 합쳐서 목록은 누구나, 단 남의 용돈 줄은 빼고(B7).
 * 한 사람 관리형(managerId 있음, 2026-11-13 UX B H2): 관리하는 사람은 모든 손 줄(상대 용돈 줄 포함),
 * 관리하지 않는 쪽은 자기 줄(user_id = 나)만. 나머지는 W-02에서 보기만, 월급날·월급 전 확인 알림도 없음
 */
export function lineIsMine(
  l: ConfirmLine,
  o: { joint: boolean; ownerId: string | null; meId: string; managerId?: string | null },
): boolean {
  if (!o.joint) return o.ownerId === o.meId;
  if (o.managerId) return o.managerId === o.meId || (!!l.user_id && l.user_id === o.meId);
  return !(l.kind === 'allowance' && l.user_id && l.user_id !== o.meId);
}

/**
 * “모두 계획대로 됐어요”(confirm_payday)가 체크할 줄: 남은 손 줄 중 내가 확인을 맡은 것(lineIsMine).
 * 각자 목록은 주인만(남이면 빈 배열)
 */
export function confirmableLines<T extends ConfirmLine>(
  lines: readonly T[],
  o: { joint: boolean; ownerId: string | null; meId: string; managerId?: string | null },
): T[] {
  if (!o.joint && o.ownerId !== o.meId) return [];
  return lines.filter((l) => isManual(l) && l.state === 'wait' && lineIsMine(l, o));
}

/**
 * 다음 자동 확인(H-11 “26일에 3개”): 아직 대기 중인 자동 줄 중 가장 이른 나가는 날과 그날 줄 수. 없으면 null
 */
export function nextAutoDue(lines: readonly ConfirmLine[]): { date: string; count: number } | null {
  const due = lines
    .filter((l) => l.auto && l.state === 'wait' && l.auto_due)
    .map((l) => l.auto_due as string)
    .sort();
  const first = due[0];
  if (!first) return null;
  return { date: first, count: due.filter((d) => d === first).length };
}

/**
 * 자동 줄 고르기 띠(H-06 9번, W-01d, G6): 첫 월급날 7일 전 ~ 전날, 자동 줄 0개, 손 줄 1개 이상, 아직 안 고름
 */
export function autoPickTaskOpen(o: {
  today: string;
  firstPayday: string | null;
  autoLines: number;
  manualLines: number;
  done: boolean;
}): boolean {
  if (!o.firstPayday || o.done || o.autoLines > 0 || o.manualLines === 0) return false;
  const d = daysBetween(o.today, o.firstPayday);
  return d >= 1 && d <= 7;
}

/** 확인 목록 이름 날짜(07 1장 ‘{월} {일}일 월급’): 사이클 시작일의 월·일 */
export const checklistMonthDay = (cycleStart: string) => ({
  month: Number(cycleStart.slice(5, 7)),
  day: Number(cycleStart.slice(8, 10)),
});

/** 날짜 없는 사람 자동 저금 줄의 그달 나가는 날(서버 auto_confirm_due_lines, 기본 1일, 31 = 말일) */
export const autoDayIn = (month: string, autoDay: number | null) => {
  const { y, m } = ymdOf(`${month.slice(0, 7)}-01`);
  return cycleDate(autoDay ?? 1, y, m);
};

/** 테스트·표시용: 'YYYY-MM-DD'를 만듦 */
export const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
