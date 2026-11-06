import { ceilTo10k, type Won } from '../money';
import { monthlyNeed } from './goals';
import { addMonths, thisMonth, type YearMonth } from './month';

// 목표 배분(docs/spec/06-calc-allocation.md 4장, 5-3). 저축 가능 금액을 우선순위대로 월 필요액만큼 나눔.

export interface AllocGoal {
  id: string;
  template: string;
  name: string;
  kind: 'once' | 'yearly' | 'monthly';
  priority: number;
  /** 목표 금액(매달형은 월 납입액). null = 아직 안 정함(배분 없음) */
  target: Won | null;
  held: Won;
  deadline: YearMonth | null;
  /** 결혼 후 목표(예비부부 각자 관리): 저장만, 배분 없음 */
  afterMarriage?: boolean;
  paused?: boolean;
}

export interface AllocLine {
  goal: AllocGoal;
  /** 월 필요액(1만 원 단위 올림). 금액·기한이 없으면 null */
  need: Won | null;
  /** 월 배분액 */
  alloc: Won;
  /** 예상 달성 월. 배분 0이면 null(‘미정’). 매달형은 없음 */
  expected: YearMonth | null;
  /** 기한까지 모자람 */
  short: boolean;
}

export function goalNeed(g: AllocGoal, now = new Date()): Won | null {
  if (g.target === null) return null;
  if (g.kind === 'monthly') return ceilTo10k(g.target);
  return monthlyNeed({ target: g.target, held: g.held, deadline: g.deadline, now })?.need ?? null;
}

/** 예상 달성 월 = 남은 금액 ÷ 월 배분액을 올림한 개월 수 뒤의 달 */
export function expectedMonth(g: AllocGoal, alloc: Won, now = new Date()): YearMonth | null {
  if (g.kind === 'monthly' || g.target === null) return null;
  const left = Math.max(g.target - g.held, 0);
  if (left === 0) return thisMonth(now);
  if (alloc <= 0) return null;
  return addMonths(thisMonth(now), Math.ceil(left / alloc));
}
