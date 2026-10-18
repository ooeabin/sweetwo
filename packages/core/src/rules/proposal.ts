import { addDays, todayKst } from '../date';
import type { BaseDay } from '../onboarding/cycle';
import { nextDayOf } from './this-month';

// 제안 적용일(docs/spec/08-couple-proposal-permission.md 6-3): 제안 후 72시간이 지난 첫 기준일 0시(KST).
export function proposalApplyOn(base: BaseDay, now = new Date()): string {
  const after = new Date(now.getTime() + 72 * 3_600_000);
  const day = todayKst(after);
  // 72시간 뒤가 그날 0시 정각이 아니면 그날 0시는 이미 지났으므로 다음 날부터
  const kst = new Date(after.getTime() + 9 * 3_600_000);
  const midnight =
    kst.getUTCHours() === 0 && kst.getUTCMinutes() === 0 && kst.getUTCSeconds() === 0;
  return nextDayOf(midnight ? day : addDays(day, 1), base);
}

export type ProposalItem =
  | 'allowance'
  | 'split'
  | 'living_budget'
  | 'family_budget'
  | 'base_day'
  | 'goal_order'
  | 'goal_amount'
  | 'goal_deadline'
  | 'goal_pause'
  | 'goal_delete'
  | 'goal_add'
  | 'goal_restore'
  | 'wedding_budget'
  | 'wedding_item_budget';
/** 목표 항목(goal_add 말고는 target = 목표 id) */
export const isGoalItem = (item: string) => item.startsWith('goal_');
