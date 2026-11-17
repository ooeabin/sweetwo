import type { Won } from '../money';
import { addDays } from '../date';
import { PERIOD_DAYS, type MoneyInRow } from './money-in-period';
import { confirmFinish, manualCount } from './pay-confirm';
import { checklistFinish, monthProgress } from './month-progress';

// W-21 지난 달 모아보기(docs/spec/20-salary-plan.md W-21, 2026-11-17).
// 줄 하나 = 지난 사이클 하나: 결과, 수입, 그 달 모은 금액. 계산은 W-02 머리(MonthBar)와 같은 규칙을 한 곳에 모음.

export interface ArchiveLine {
  kind: string;
  state: string;
  planned: Won;
  actual: Won | null;
  /** 손 줄이면 false(자동 줄은 true). confirmFinish가 보는 값 */
  auto?: boolean | null;
}

export type ArchiveResult = 'all' | 'mixed' | 'late';

export interface ArchiveRow {
  result: ArchiveResult;
  /** result가 late일 때 늦게 확인할 수 있는 줄 수 */
  lateCount: number;
  /** 그 달 수입(W-02 1c 공유 이미지와 같은 기준: 체크리스트 주인의 실수령, 합쳐서면 두 사람 합). 없으면(0 이하) 계획 금액 합 */
  income: Won;
  /** 그 달 모은 금액 = 확인한 저축·투자 줄 합(다른 금액이면 그 금액, 건너뜀은 0) */
  saved: Won;
}

/**
 * 한 달 줄. lateCount = 지금 늦게 확인할 수 있는 손 줄 수(W-02 lateLines, 있으면 “확인을 마쳤어요”를 띄우지 않음)
 */
export function archiveRow(o: {
  lines: readonly ArchiveLine[];
  income: Won;
  lateCount: number;
}): ArchiveRow {
  const lines = o.lines.map((l) => ({ ...l, auto: l.auto ?? false }));
  const p = monthProgress({ income: o.income, lines: [...lines] });
  const finish =
    o.lateCount > 0 ? null : manualCount(lines) > 0 ? confirmFinish(lines) : checklistFinish(lines);
  return {
    // 끝난 사이클에 남은 대기 줄이 없으면 건너뜀이 섞인 것으로 봄
    result: o.lateCount > 0 ? 'late' : (finish ?? 'mixed'),
    lateCount: o.lateCount,
    income: o.income > 0 ? o.income : p.planned,
    saved: p.savingSent,
  };
}

export interface PastPeriod {
  /** 기간 시작 S */
  start: string;
  /** 기간 끝 E = S + 29 */
  end: string;
  /** [S, E] 안 수입 합 */
  received: Won;
  /** 수입 적은 기록 수 */
  count: number;
}

/**
 * 날짜 없는 사람의 끝난 기간들(07 6장, W-21): moneyInPeriod와 같은 기간 나눔(30일, 첫 수입 날부터, E 뒤 처음 수입 날이 다음 S).
 * 오늘이 아직 안 지난 기간(진행 중)은 빼고, 최근 기간부터
 */
export function pastPeriods(moneyIns: readonly MoneyInRow[], today: string): PastPeriod[] {
  const rows = moneyIns.filter((r) => !r.deleted_at && r.received_on <= today);
  const days = [...new Set(rows.map((r) => r.received_on))].sort();
  const out: PastPeriod[] = [];
  let s: string | null = null;
  let e: string | null = null;
  for (const d of days) {
    if (s === null || e === null || d > e) {
      s = d;
      e = addDays(d, PERIOD_DAYS - 1);
    }
    if (out.at(-1)?.start !== s) out.push({ start: s, end: e, received: 0, count: 0 });
  }
  for (const p of out) {
    const inn = rows.filter((r) => r.received_on >= p.start && r.received_on <= p.end);
    p.received = inn.reduce((t, r) => t + r.amount, 0);
    p.count = inn.length;
  }
  return out.filter((p) => p.end < today).reverse();
}
