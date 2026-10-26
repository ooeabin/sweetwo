import { saveSplit, type SalarySplit } from '@sweetwo/api';
import { toDraft } from '../salary';

// G-05 매달 넣던 돈(22): 달성으로 빠진 저금 줄 금액(goal.freed_lines, 분배표마다)을 다른 목표 저금 줄에 더함.

/** 내가 고칠 분배표(각자 = 내 것, 합쳐서 = 공동) */
export const mySplit = (
  splits: SalarySplit[] | undefined,
  meId: string | undefined,
  joint: boolean,
) => splits?.find((s) => (joint ? s.owner_user_id === null : s.owner_user_id === meId));

/** 이 목표가 달성되며 내 분배표에서 빠진 금액 */
export function freedAmount(freed: unknown, split: SalarySplit | undefined) {
  if (!split || !freed || typeof freed !== 'object' || Array.isArray(freed)) return 0;
  const v = (freed as Record<string, unknown>)[split.id];
  return typeof v === 'number' && v > 0 ? v : 0;
}

/** 고른 목표 저금 줄에 금액을 더해 저장. 되돌리기 함수를 돌려줌 */
export async function addToGoalLine(split: SalarySplit, goalId: string, amount: number) {
  const owner = split.owner_user_id ?? undefined;
  const before = toDraft([...split.split_line].sort((a, b) => a.sort - b.sort));
  const after = before.map((l) =>
    l.kind === 'saving' && l.goalId === goalId ? { ...l, amount: l.amount + amount } : l,
  );
  await saveSplit(after, owner);
  return () => saveSplit(before, owner);
}

// 새 목표 만들기로 간 매달 넣던 돈: 목표 추가 흐름(G-03a~f) 동안 기기에 잠깐 두고, 추가하면 그 목표 줄에 넣음
const KEY = 'sweetwo:goal-freed';
export function keepFreed(amount: number) {
  try {
    sessionStorage.setItem(KEY, String(amount));
  } catch {
    /* 저장소를 못 쓰면 0원 줄로 */
  }
}
export function takeFreed(): number {
  try {
    const v = Number(sessionStorage.getItem(KEY) ?? '0');
    sessionStorage.removeItem(KEY);
    return Number.isInteger(v) && v > 0 ? v : 0;
  } catch {
    return 0;
  }
}
