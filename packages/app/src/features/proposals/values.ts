import type { Proposal } from '@sweetwo/api';
import { formatYm, readWon, type Json, type SplitMode } from '@sweetwo/core';
import { copy } from './copy';

// 제안 한 줄 읽기: “{항목} 전 → 후”(G-08 2번). 분담 비율(starter_ratio)은 시작한 사람 몫 %.
export interface Names {
  myId: string;
  myName: string;
  partnerName: string;
  /** 내가 공간을 시작한 사람인지 */
  starter: boolean;
}

const obj = (j: Json): Record<string, Json | undefined> =>
  j && typeof j === 'object' && !Array.isArray(j) ? j : {};
const num = (j: Json, k: string) => {
  const v = obj(j)[k];
  return typeof v === 'number' ? v : null;
};
const modeOf = (j: Json): SplitMode | null => {
  const v = obj(j).mode;
  return v === 'half' || v === 'income' || v === 'custom' ? v : null;
};

export const nameOf = (n: Names, uid: string) => (uid === n.myId ? n.myName : n.partnerName);

/** 분담 제안 값 → 모드, 내 몫 % */
export function splitOfProposal(after: Json, starter: boolean) {
  const r = num(after, 'starter_ratio') ?? 50;
  return { mode: modeOf(after) ?? 'half', myPct: starter ? r : 100 - r };
}

const str = (j: Json, k: string) => {
  const v = obj(j)[k];
  return typeof v === 'string' ? v : null;
};
const bool = (j: Json, k: string) => obj(j)[k] === true;

export interface GoalName {
  id: string;
  name: string;
}

/** 받은 제안 한 줄(할 일, “{이름}님이 {용돈을} 바꾸자고 제안했어요”) */
export function arrivedText(
  p: Pick<Proposal, 'item' | 'target_id' | 'after'>,
  who: string,
  goals: GoalName[] = [],
) {
  if (p.item === 'goal_add') {
    const a = obj(p.after);
    return copy.arrivedAdd(who, typeof a.name === 'string' ? a.name : copy.goalUnknown);
  }
  return copy.arrived(who, itemObject(p, goals));
}

/** 알림 문장 속 목적어(“{이름}님이 {용돈을} 바꾸자고 제안했어요”) */
export function itemObject(p: Pick<Proposal, 'item' | 'target_id'>, goals: GoalName[] = []) {
  if (p.item.startsWith('goal_'))
    return copy.goalObject(goals.find((g) => g.id === p.target_id)?.name ?? copy.goalUnknown);
  return copy.itemObject[p.item] ?? '';
}

export function describe(
  p: Pick<Proposal, 'item' | 'proposer' | 'before' | 'after' | 'target_id'>,
  n: Names,
  goals: GoalName[] = [],
) {
  const who = nameOf(n, p.proposer);
  const goal = goals.find((g) => g.id === p.target_id)?.name ?? copy.goalUnknown;
  if (p.item === 'living_budget') {
    const v = (j: Json) => {
      const a = num(j, 'living_budget');
      return a === null ? copy.unset : readWon(a);
    };
    return { label: copy.livingBudget, before: v(p.before), after: v(p.after) };
  }
  if (p.item === 'family_budget') {
    const v = (j: Json) => {
      const a = num(j, 'target_amount');
      return a === null ? copy.unset : copy.familyBudgetValue(readWon(a));
    };
    return { label: copy.familyBudget, before: v(p.before), after: v(p.after) };
  }
  if (p.item === 'goal_order') {
    const v = (j: Json) => {
      const ids = obj(j).order;
      return Array.isArray(ids)
        ? ids.map((id) => goals.find((g) => g.id === id)?.name ?? copy.goalUnknown).join(', ')
        : copy.unset;
    };
    return { label: copy.goalOrder, before: v(p.before), after: v(p.after) };
  }
  if (p.item === 'goal_add') {
    const a = obj(p.after);
    const name = typeof a.name === 'string' ? a.name : copy.goalUnknown;
    const amount = num(p.after, 'target_amount');
    const d = str(p.after, 'deadline');
    const value = [amount === null ? null : readWon(amount), d ? formatYm(d) : null]
      .filter(Boolean)
      .join(', ');
    return { label: copy.goalAdd(name), before: copy.unset, after: value || name };
  }
  if (p.item === 'goal_amount') {
    const v = (j: Json) => {
      const a = num(j, 'target_amount');
      return a === null ? copy.unset : readWon(a);
    };
    return { label: copy.goalItems.goal_amount(goal), before: v(p.before), after: v(p.after) };
  }
  if (p.item === 'goal_deadline') {
    const v = (j: Json) => {
      const d = str(j, 'deadline');
      return d ? formatYm(d) : copy.unset;
    };
    return { label: copy.goalItems.goal_deadline(goal), before: v(p.before), after: v(p.after) };
  }
  if (p.item === 'goal_pause') {
    const v = (j: Json) => copy.goalPaused[bool(j, 'paused') ? 'true' : 'false'];
    return { label: copy.goalItems.goal_pause(goal), before: v(p.before), after: v(p.after) };
  }
  if (p.item === 'goal_delete') {
    const v = (j: Json) => copy.goalDeleted[bool(j, 'deleted') ? 'true' : 'false'];
    return { label: copy.goalItems.goal_delete(goal), before: v(p.before), after: v(p.after) };
  }
  if (p.item === 'allowance') {
    const v = (j: Json) => {
      const a = num(j, 'allowance');
      return a === null ? copy.unset : readWon(a);
    };
    return { label: copy.items.allowance(who), before: v(p.before), after: v(p.after) };
  }
  const [starterName, joinerName] = n.starter
    ? [n.myName, n.partnerName]
    : [n.partnerName, n.myName];
  const v = (j: Json) => {
    const m = modeOf(j);
    if (!m) return copy.unset;
    if (m !== 'custom') return copy.splitModes[m];
    const r = num(j, 'starter_ratio') ?? 50;
    return copy.splitCustom(starterName, r, joinerName, 100 - r);
  };
  return { label: copy.items.split, before: v(p.before), after: v(p.after) };
}
