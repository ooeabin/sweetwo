import { savingItemId } from '@sweetwo/core';
import { AuthCallError } from './auth';
import { supabase } from './client';

// 저금 항목(docs/spec/20-salary-plan.md ‘저금 항목’, W-10~W-12, ADR 0007). 행은 goal 테이블(space_goals()로 읽음).
// 추가·달성 뒤 선택은 RPC로만, 이름·목표 금액·기한·휴지통은 updateGoal로 바로.

const fail = (e: { message?: string } | null) => {
  if (e) throw new AuthCallError(e.message?.includes('fetch') ? 'network' : 'unknown');
};

/** 해제 대기 중이거나 월급 계획이 없어 추가할 수 없음 */
export class SavingItemBlocked extends Error {
  constructor(readonly reason: 'unlink_pending' | 'no_split') {
    super(reason);
  }
}

/**
 * W-11 저장: 저금 항목 + 내(합쳐서면 공동) 월급 계획 저금 묶음 맨 아래 줄(매달 금액) + 이번 사이클 체크리스트 줄.
 * deadline은 'YYYY-MM-01'. 새 항목 id
 */
export async function addSavingItem(o: {
  name: string;
  monthly: number;
  target: number | null;
  deadline: string | null;
}): Promise<string> {
  const { data, error } = await supabase().rpc('add_saving_item', {
    p_name: o.name,
    p_monthly: o.monthly,
    p_target: o.target ?? undefined,
    p_deadline: o.deadline ?? undefined,
  });
  if (error?.message?.includes('unlink_pending')) throw new SavingItemBlocked('unlink_pending');
  if (error?.message?.includes('no_split')) throw new SavingItemBlocked('no_split');
  fail(error);
  const id = savingItemId.safeParse(data);
  if (!id.success) throw new AuthCallError('unknown');
  return id.data;
}

/** W-12a ‘계속 모을게요’: 목표 금액·기한만 지움 */
export async function keepSavingItem(id: string) {
  const { error } = await supabase().rpc('saving_item_keep', { p_goal: id });
  fail(error);
}

/** ‘계속 모을게요’ 되돌리기: 지운 목표 금액·기한을 돌려놓고 달성 상태로 */
export async function unkeepSavingItem(id: string, target: number, deadline: string | null) {
  const { error } = await supabase().rpc('saving_item_unkeep', {
    p_goal: id,
    p_target: target,
    p_deadline: deadline ?? undefined,
  });
  fail(error);
}

/** W-12a ‘그만할게요’: 월급 계획에서 줄을 빼고 기록만 남김 */
export async function stopSavingItem(id: string) {
  const { error } = await supabase().rpc('saving_item_stop', { p_goal: id });
  fail(error);
}

/** ‘그만할게요’ 되돌리기: 다시 모으는 중(줄은 그만두기 전 금액으로) */
export async function reopenSavingItem(id: string) {
  const { error } = await supabase().rpc('saving_item_reopen', { p_goal: id });
  fail(error);
}
