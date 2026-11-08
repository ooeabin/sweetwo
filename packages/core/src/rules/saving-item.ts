import { z } from 'zod';
import { ceilTo10k, MAX_WON, type Won } from '../money';
import { addMonths, monthsBetween, parseYm, thisMonth, type YearMonth } from '../onboarding/month';

// 저금 항목(docs/spec/20-salary-plan.md ‘저금 항목’, 06-calc-allocation.md 4장·5장, ADR 0007).
// 모은 돈은 서버 goal_saved(시작할 때 모은 돈 + 체크한 저금 줄 합)가 정본, 여기 savedFromLines는 같은 식(테스트·미리보기용).

/** 체크리스트 저금 줄 한 줄(체크 상태와 실제 보낸 금액) */
export interface SavingCheckLine {
  goal_id: string | null;
  kind: string;
  state: string;
  planned: Won;
  actual: Won | null;
}

/**
 * 모은 돈 = 시작할 때 모은 돈 + 그 저금 항목 저금 줄을 체크한 금액 합(다른 금액이면 그 금액).
 * ‘못 함’·체크 안 함은 더하지 않음(06 4-1, 시작할 때 모은 돈은 2026-11-09 ADR 0007 고침)
 */
export function savedFromLines(id: string, lines: SavingCheckLine[], start: Won = 0): Won {
  return (
    start +
    lines
      .filter((l) => l.goal_id === id && l.kind === 'saving' && l.state === 'checked')
      .reduce((t, l) => t + (l.actual ?? l.planned), 0)
  );
}

/** 기한의 날(06 5-2, 2026-11-09): 고른 달의 말일 'YYYY-MM-DD'. ‘2026년 11월까지’ = 11월 30일까지 */
export function deadlineDay(deadline: string): string {
  const { y, m } = parseYm(deadline.slice(0, 7));
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${deadline.slice(0, 7)}-${String(last).padStart(2, '0')}`;
}

/** W-11d 기한 처음 값(20): 1년 뒤 같은 달 */
export const defaultDeadline = (now = new Date()): YearMonth => addMonths(thisMonth(now), 12);

/** 진행률(06 5-1): 모은 돈 ÷ 목표 금액, 내림 정수 %, 100 상한. 목표 금액이 없으면 null */
export function savingPct(saved: Won, target: Won | null): number | null {
  if (target === null || target <= 0) return null;
  return Math.min(Math.floor((Math.max(saved, 0) * 100) / target), 100);
}

/** 막대 채움 %: 모은 돈이 있으면 최소 2%(빈 막대가 안 모은 것처럼 보여서, GoalRow) */
export function savingBar(saved: Won, target: Won | null): number {
  const p = savingPct(saved, target) ?? 0;
  return saved > 0 ? Math.max(p, 2) : p;
}

/** 남은 개월(06 5-2): 이번 달부터 기한 달까지(기한 = 그 달 말일이라 기한 달도 셈), 최소 1 */
export const monthsLeft = (deadline: YearMonth, now = new Date()) =>
  Math.max(monthsBetween(thisMonth(now), deadline) + 1, 1);

/**
 * 월 필요액(06 5-2, 기한이 있을 때만): (목표 금액 − 모은 돈) ÷ 남은 개월, 1만 원 단위 올림. 0 아래면 0.
 * 목표 금액이나 기한이 없으면 null
 */
export function savingNeed(
  o: { target: Won | null; saved: Won; deadline: YearMonth | null },
  now = new Date(),
): Won | null {
  if (o.target === null || !o.deadline) return null;
  const months = monthsLeft(o.deadline, now);
  const left = Math.max(o.target - o.saved, 0);
  return ceilTo10k(Math.ceil(left / months));
}

/**
 * 예상 달성 월(06 5-3): 이번 달부터 매달 모아 (목표 금액 − 모은 돈) ÷ 매달 금액(올림)째 달.
 * = 이번 달 + 개월 − 1(월 필요액의 남은 개월과 같은 셈). 매달 금액이 0원이거나 목표 금액이 없으면 null
 */
export function savingEta(
  o: { target: Won | null; saved: Won },
  monthly: Won,
  now = new Date(),
): YearMonth | null {
  if (o.target === null) return null;
  const left = Math.max(o.target - o.saved, 0);
  if (left === 0) return thisMonth(now);
  if (monthly <= 0) return null;
  return addMonths(thisMonth(now), Math.ceil(left / monthly) - 1);
}

/**
 * 기한보다 늦어지는 개월(06 5-4, 20 W-10 3번): 월 필요액 > 매달 금액이면 예상 달성 월 − 기한 월.
 * 목표 금액·기한이 없거나, 매달 금액이 0원이거나, 늦지 않으면 null
 */
export function savingLate(
  o: { target: Won | null; saved: Won; deadline: YearMonth | null },
  monthly: Won,
  now = new Date(),
): number | null {
  const need = savingNeed(o, now);
  if (need === null || !o.deadline || monthly <= 0 || need <= monthly) return null;
  const eta = savingEta(o, monthly, now);
  if (!eta) return null;
  const late = monthsBetween(o.deadline, eta);
  return late > 0 ? late : null;
}

export type SavingState = 'saving' | 'achieved' | 'closed';

/** 상태(20 ‘달성과 그만 모음’): 그만 모음 > 달성 > 모으는 중 */
export function savingState(g: { status: string; closed_at: string | null }): SavingState {
  if (g.closed_at) return 'closed';
  return g.status === 'achieved' ? 'achieved' : 'saving';
}

/** 달성 축하를 띄울 때(W-12): 모으는 중이고 목표 금액이 있고 모은 돈이 닿음 */
export function reachedTarget(
  g: { status: string; closed_at: string | null; target_amount: Won | null },
  saved: Won,
): boolean {
  return savingState(g) === 'saving' && g.target_amount !== null && saved >= g.target_amount;
}

const ym = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) as unknown as z.ZodType<YearMonth>;

/**
 * 저금 항목 추가(W-11) 입력. 이름 1~20자, 매달 금액 1만 원 단위(0원 가능), 목표 금액은 선택,
 * 기한은 목표 금액이 있을 때만 이번 달부터, 시작할 때 모은 돈은 0원 이상이고 목표 금액보다 적게
 * (서버 add_saving_item과 같은 검사, bad_start)
 */
export const savingItemInput = (now = new Date()) =>
  z
    .object({
      name: z.string().trim().min(1).max(20),
      monthly: z
        .number()
        .int()
        .min(0)
        .max(MAX_WON)
        .refine((v) => v % 10_000 === 0),
      target: z.number().int().min(1).max(MAX_WON).nullable(),
      deadline: ym.nullable(),
      start: z.number().int().min(0).max(MAX_WON).default(0),
    })
    .refine((v) => v.deadline === null || (v.target !== null && v.deadline >= thisMonth(now)), {
      path: ['deadline'],
    })
    .refine((v) => v.target === null || v.start < v.target, { path: ['start'] });
export type SavingItemInput = z.infer<ReturnType<typeof savingItemInput>>;

/** add_saving_item 응답(새 저금 항목 id) */
export const savingItemId = z.string().uuid();

/**
 * 달성 축하 문장(20 W-12 4번): 모든 달 함께 → 'all'(“16개월 동안 매달 둘이 함께 모았어요”),
 * 일부 → 'some'(“16개월 중 14번은 둘이 함께 모았어요”), 한 사람만 또는 각자 항목 → 'solo'(“16개월 만에 모았어요”).
 * 모은 달이 없으면 문장 없음(null).
 */
export function celebrationStory(
  months: number,
  together: number,
  solo: boolean,
): { kind: 'all' | 'some' | 'solo'; months: number; together: number } | null {
  if (months <= 0) return null;
  if (solo || together <= 0) return { kind: 'solo', months, together: 0 };
  if (together >= months) return { kind: 'all', months, together: months };
  return { kind: 'some', months, together };
}
