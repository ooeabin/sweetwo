import type { Proposal } from '@sweetwo/api';
import { readWon, type Json, type SplitMode } from '@sweetwo/core';
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

export function describe(p: Pick<Proposal, 'item' | 'proposer' | 'before' | 'after'>, n: Names) {
  const who = nameOf(n, p.proposer);
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
