import type { Won } from '../money';

// 월급 나누기(docs/spec/20-salary-plan.md W-01·W-02). 줄 하나에 신랑·신부 쪽 몫이 따로 있고 사람마다 ‘옮겼어요’.
// 공동 통장 나누기만(개인 통장 제외), 몫이 0인 사람에게는 줄이 없음. 진행 = 두 사람 몫 전체 기준.
export type Side = 'groom' | 'bride';

export interface SplitCheckLine {
  id: string;
  target: string;
  account_role: string | null;
  kind: string;
  sort: number;
  amount_groom: Won | null;
  amount_bride: Won | null;
  groom_done_at: string | null;
  groom_done_by: string | null;
  groom_done_amount: Won | null;
  bride_done_at: string | null;
  bride_done_by: string | null;
  bride_done_amount: Won | null;
}

export interface SplitRow {
  lineId: string;
  role: string;
  /** split = 월급에서, emergency_to_living·goal_to_living = 자동 나누기 줄 */
  kind: string;
  side: Side;
  /** 계획 몫 */
  amount: Won;
  done: boolean;
  /** 실제 옮긴 금액(다른 금액이면 계획과 다름) */
  doneAmount: Won | null;
  doneBy: string | null;
}

const shareOf = (l: SplitCheckLine, s: Side) =>
  (s === 'groom' ? l.amount_groom : l.amount_bride) ?? 0;

export function splitRows(lines: SplitCheckLine[], side: Side): SplitRow[] {
  return lines
    .filter((l) => l.target === 'account' && l.account_role !== 'personal' && shareOf(l, side) > 0)
    .sort((a, b) => a.sort - b.sort)
    .map((l) => {
      const at = side === 'groom' ? l.groom_done_at : l.bride_done_at;
      return {
        lineId: l.id,
        role: l.account_role ?? '',
        kind: l.kind,
        side,
        amount: shareOf(l, side),
        done: at !== null,
        doneAmount: side === 'groom' ? l.groom_done_amount : l.bride_done_amount,
        doneBy: side === 'groom' ? l.groom_done_by : l.bride_done_by,
      };
    });
}

/** 진행 “{total}곳 중 {done}곳 나눴어요”: 두 사람 몫 전체 */
export function splitProgress(lines: SplitCheckLine[]) {
  const all = [...splitRows(lines, 'groom'), ...splitRows(lines, 'bride')];
  return { done: all.filter((r) => r.done).length, total: all.length };
}

/** 남은 몫(사람 하나): 개수와 계획 금액 합 */
export function splitLeft(lines: SplitCheckLine[], side: Side) {
  const left = splitRows(lines, side).filter((r) => !r.done);
  return { count: left.length, amount: left.reduce((t, r) => t + r.amount, 0) };
}
