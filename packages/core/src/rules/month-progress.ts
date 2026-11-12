import type { Won } from '../money';
import { planRatio, type PlanRatio } from './plan-ratio';

// W-02 진행 막대와 달 결과 카드(docs/spec/06-calc-allocation.md 3-6, 20 W-02 1번·W-02 끝, 2026-11-09).
// 칸 너비 = 이번 달 체크리스트의 계획 금액(planned)으로 W-01과 같은 비율(3-5 가장 큰 나머지 방식).
// 저금·지출 칸 안 채움 = 보낸 금액(체크한 줄의 actual, 없으면 planned) ÷ 그 칸 계획 금액, 정수 % 버림.
// 칸의 줄을 모두 체크하면 100(다른 금액으로 보냈어도), 하나라도 남으면(‘못 함’ 포함) 최대 99.
// ‘못 함’(skipped) 줄은 보내지 않은 것: 보낸 금액에 넣지 않음.

export interface MonthLine {
  kind: string;
  state: string;
  planned: Won;
  actual: Won | null;
}

export interface MonthProgress {
  /** 칸 너비(계획 금액 기준, W-01 막대와 같은 계산) */
  ratio: PlanRatio;
  /** 칸 안 채움 %(0~100) */
  fill: { saving: number; spend: number };
  /** 보낸 금액(체크한 줄 합) */
  sent: Won;
  /** 계획 금액 합(모든 줄) */
  planned: Won;
  savingSent: Won;
  spendSent: Won;
  savingPlanned: Won;
  spendPlanned: Won;
  /** 체크한 줄 수(‘못 함’ 빼고) */
  checked: number;
  /** 끝난 줄 수(체크 + 못 함) */
  done: number;
  total: number;
  /** 체크 안 한 줄이 없음 */
  complete: boolean;
  /** 여유 자금 = 수입 − 보낸 금액(달 결과 카드) */
  left: Won;
}

/** 체크한 줄의 보낸 금액(다른 금액이면 그 금액) */
export const sentOf = (l: MonthLine): Won => (l.state === 'checked' ? (l.actual ?? l.planned) : 0);

function fillOf(lines: MonthLine[], sent: Won, planned: Won): number {
  if (!lines.length) return 0;
  if (lines.every((l) => l.state === 'checked')) return 100;
  if (planned <= 0) return 0;
  return Math.min(Math.floor((Math.min(sent, planned) * 100) / planned), 99);
}

/** 수입 + 이번 달 체크리스트 줄 → 진행(칸 너비, 채움, 보낸 금액) */
export function monthProgress(o: { income: Won; lines: MonthLine[] }): MonthProgress {
  const saving = o.lines.filter((l) => l.kind === 'saving');
  const spend = o.lines.filter((l) => l.kind !== 'saving');
  const sum = (ls: MonthLine[], f: (l: MonthLine) => Won) => ls.reduce((s, l) => s + f(l), 0);
  const savingPlanned = sum(saving, (l) => l.planned);
  const spendPlanned = sum(spend, (l) => l.planned);
  const savingSent = sum(saving, sentOf);
  const spendSent = sum(spend, sentOf);
  const sent = savingSent + spendSent;
  return {
    ratio: planRatio({ income: o.income, saving: savingPlanned, spend: spendPlanned }),
    fill: {
      saving: fillOf(saving, savingSent, savingPlanned),
      spend: fillOf(spend, spendSent, spendPlanned),
    },
    sent,
    planned: savingPlanned + spendPlanned,
    savingSent,
    spendSent,
    savingPlanned,
    spendPlanned,
    checked: o.lines.filter((l) => l.state === 'checked').length,
    done: o.lines.filter((l) => l.state !== 'wait').length,
    total: o.lines.length,
    complete: o.lines.every((l) => l.state !== 'wait'),
    left: o.income - sent,
  };
}

export interface PlanLineRef {
  id: string;
  kind: string;
  goal_id: string | null;
  user_id: string | null;
  name: string | null;
  amount: Won;
}
export interface CheckLineRef {
  split_line_id?: string | null;
  kind: string;
  goal_id: string | null;
  user_id: string | null;
  name: string | null;
  state: string;
}

/**
 * W-01 금액 바꾸기가 이번 달 체크 안 한 줄도 바꾸는지(서버 sync_checklist와 같은 맞춤, 20 W-01 7번 Toast).
 * 이번 사이클 체크리스트가 있고, 금액이 바뀌고, 그 줄을 이미 체크·못 함으로 끝내지 않았으면 true.
 * 끝난 줄 맞춤 = 같은 split_line_id, 또는 종류·저금 항목·사람·이름이 같음(서버 그대로)
 */
export function planChangeTouchesMonth(
  line: PlanLineRef,
  next: Won,
  month: CheckLineRef[] | null | undefined,
): boolean {
  if (!month || next === line.amount) return false;
  const closed = month.some(
    (x) =>
      x.state !== 'wait' &&
      (x.split_line_id === line.id ||
        (x.kind === line.kind &&
          (x.goal_id ?? null) === (line.goal_id ?? null) &&
          (x.user_id ?? null) === (line.user_id ?? null) &&
          (x.name ?? null) === (line.name ?? null))),
  );
  return !closed;
}

/**
 * 체크리스트 다 끝남(07 5장, 2026-11-12 D4): 여유 자금 줄을 뺀 모든 줄이 체크 또는 ‘못 함’이면 끝남.
 * 모두 체크면 'all'(“{월}월 월급 체크를 다 했어요”), ‘못 함’이 섞이면 'mixed'(“…체크를 마쳤어요”).
 * 체크 안 한 줄이 있거나 줄이 없으면 null. 서버 check_pay_line의 체크리스트 상태·파트너 알림과 같은 판단
 */
export type ChecklistFinish = 'all' | 'mixed';
export function checklistFinish(lines: readonly { state: string }[]): ChecklistFinish | null {
  if (!lines.length || lines.some((l) => l.state === 'wait')) return null;
  return lines.every((l) => l.state === 'checked') ? 'all' : 'mixed';
}

/**
 * 줄 하나를 바꾸면 체크리스트가 이번에 끝나는지(W-02·W-05 마지막 줄 Toast, 2026-11-12): 바꾸기 전에는 안 끝났고 바꾼 뒤 끝나면
 * 그 끝남, 아니면 null. 다른 금액 0원은 ‘못 함’(서버와 같음)
 */
export function finishAfter(
  lines: readonly { id: string; state: string }[],
  id: string,
  next: 'checked' | 'wait' | 'skipped',
  actual?: number | null,
): ChecklistFinish | null {
  if (checklistFinish(lines)) return null;
  const to = next === 'checked' && actual === 0 ? 'skipped' : next;
  return checklistFinish(lines.map((l) => (l.id === id ? { ...l, state: to } : l)));
}
