import {
  GoalMovePublicSchema,
  SavingNoteRowSchema,
  savingItemId,
  type GoalMovePublic,
  type SavingNoteRow,
} from '@sweetwo/core';
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
 * deadline은 'YYYY-MM-01'. start = 시작할 때 모은 금액(W-11c ‘이미 모은 금액이 있어요’, 만들 때만, 2026-11-09). 새 항목 id
 */
export async function addSavingItem(o: {
  name: string;
  monthly: number;
  target: number | null;
  deadline: string | null;
  start?: number;
}): Promise<string> {
  const { data, error } = await supabase().rpc('add_saving_item', {
    p_name: o.name,
    p_monthly: o.monthly,
    p_target: o.target ?? undefined,
    p_deadline: o.deadline ?? undefined,
    p_start: o.start ?? 0,
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

/** 새 목표 금액이 지금 모은 금액 이하라 못 바꿈(W-12a ‘목표 금액을 새로 정할게요’) */
export class SavingTargetTooLow extends Error {
  constructor() {
    super('not_above');
  }
}

/**
 * W-12a ‘목표 금액을 새로 정할게요’(2026-11-09 round 3): 달성(고르기 전) 항목의 목표 금액을 모은 금액보다 큰 새 금액으로,
 * 기한은 지우고 모으는 중으로. 되돌리기는 unkeepSavingItem(예전 목표 금액·기한)
 */
export async function retargetSavingItem(id: string, target: number) {
  const { error } = await supabase().rpc('saving_item_retarget', { p_goal: id, p_target: target });
  if (error?.message?.includes('not_above')) throw new SavingTargetTooLow();
  fail(error);
}

// ─────────────────────────── v2.2 바로잡기·잔액 맞추기·쓸 곳 메모(06 4-2, 서버 20261203090000_v22_saving_together) ───────────────────────────

export type SavingReasonCode = 'fix' | 'used' | 'interest' | 'reconcile' | 'note_paid' | 'custom';

/** 모은 금액을 못 바꿈: 고칠 수 없는 저금, 해제 대기, 0원 아래, 금액 범위, 이미 낸 메모 */
export class SavingAdjustBlocked extends Error {
  constructor(
    readonly reason:
      | 'not_owner'
      | 'unlink_pending'
      | 'below_zero'
      | 'bad_amount'
      | 'already_paid'
      | 'no_goal'
      | 'not_found',
  ) {
    super(reason);
  }
}
const failAdjust = (e: { message?: string } | null) => {
  for (const r of [
    'not_owner',
    'unlink_pending',
    'below_zero',
    'bad_amount',
    'already_paid',
    'no_goal',
    'not_found',
  ] as const)
    if (e?.message?.includes(r)) throw new SavingAdjustBlocked(r);
  fail(e);
};

/**
 * W-10b ‘모은 금액 바로잡기’(adjust_saving): delta + 더함 / − 뺌, 사유 글(40자, 본인만 읽음),
 * hideFromSummary = ‘주간 요약에 넣지 않기’(G11). 같이 모으는 저금이면 상대에게 사람·금액·사유 없는 한 줄. 움직임 id
 */
export async function adjustSaving(o: {
  goalId: string;
  delta: number;
  reasonCode?: SavingReasonCode;
  reason?: string;
  hideFromSummary?: boolean;
}): Promise<string> {
  const { data, error } = await supabase().rpc('adjust_saving', {
    p_goal: o.goalId,
    p_delta: o.delta,
    p_reason_code: o.reasonCode ?? 'fix',
    p_reason: o.reason,
    p_hide_from_summary: o.hideFromSummary ?? false,
  });
  failAdjust(error);
  if (typeof data !== 'string') throw new AuthCallError('unknown');
  return data;
}

/** W-10c 잔액 맞추기(reconcile_savings): 저금마다 실제 금액, 차이만큼 바로잡기. 바꾼 저금 수 */
export async function reconcileSavings(
  items: { goalId: string; actual: number }[],
): Promise<number> {
  const { data, error } = await supabase().rpc('reconcile_savings', {
    p_items: items.map((i) => ({ goal_id: i.goalId, actual: i.actual })),
  });
  failAdjust(error);
  return typeof data === 'number' ? data : 0;
}

/** 한 저금의 돈 움직임(goal_move_public, 사유 글 없음). 최근 것부터(W-10 저금 내역) */
export async function fetchGoalMoves(goalId: string): Promise<GoalMovePublic[]> {
  const { data, error } = await supabase()
    .from('goal_move_public')
    .select('*')
    .eq('goal_id', goalId)
    .order('created_at', { ascending: false })
    .limit(100);
  fail(error);
  return (data ?? []).map((r) => GoalMovePublicSchema.parse(r));
}

/** 내가 넣은 움직임의 사유 글(goal_move_reasons, 본인만). id → 사유 */
export async function fetchMyMoveReasons(goalId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase().rpc('goal_move_reasons', { p_goal: goalId });
  fail(error);
  return Object.fromEntries((data ?? []).map((r) => [r.id, r.reason]));
}

/** 쓸 곳 메모(W-14). 저금 또는 묶음 하나의 메모, 기한 순 */
export async function fetchSavingNotes(o: {
  goalId?: string;
  bundleId?: string;
}): Promise<SavingNoteRow[]> {
  let q = supabase().from('saving_note').select('*').is('deleted_at', null);
  if (o.goalId) q = q.eq('goal_id', o.goalId);
  if (o.bundleId) q = q.eq('bundle_id', o.bundleId);
  const { data, error } = await q
    .order('due_on', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });
  fail(error);
  return (data ?? []).map((r) => SavingNoteRowSchema.parse(r));
}

/** 다가오는 안 낸 메모(홈 띠 14번, H-12, 캘린더). from~to = KST 날짜 */
export async function fetchUpcomingNotes(from: string, to: string): Promise<SavingNoteRow[]> {
  const { data, error } = await supabase()
    .from('saving_note')
    .select('*')
    .is('deleted_at', null)
    .eq('paid', false)
    .gte('due_on', from)
    .lte('due_on', to)
    .order('due_on', { ascending: true });
  fail(error);
  return (data ?? []).map((r) => SavingNoteRowSchema.parse(r));
}

/** 메모 추가(W-14a). spaceId 필요(열 권한 insert). 저금 또는 묶음 중 하나. 새 메모 id */
export async function addSavingNote(o: {
  spaceId: string;
  goalId?: string;
  bundleId?: string;
  name: string;
  amount: number | null;
  dueOn: string | null;
}): Promise<string> {
  const { data, error } = await supabase()
    .from('saving_note')
    .insert({
      space_id: o.spaceId,
      goal_id: o.goalId ?? null,
      bundle_id: o.bundleId ?? null,
      name: o.name,
      amount: o.amount,
      due_on: o.dueOn,
    })
    .select('id')
    .single();
  fail(error);
  if (!data) throw new AuthCallError('unknown');
  return data.id;
}

/** 메모 고치기·지우기(deleted_at) */
export async function updateSavingNote(
  id: string,
  patch: { name?: string; amount?: number | null; dueOn?: string | null; deleted?: boolean },
) {
  const { error } = await supabase()
    .from('saving_note')
    .update({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.amount !== undefined ? { amount: patch.amount } : {}),
      ...(patch.dueOn !== undefined ? { due_on: patch.dueOn } : {}),
      ...(patch.deleted !== undefined
        ? { deleted_at: patch.deleted ? new Date().toISOString() : null }
        : {}),
    })
    .eq('id', id);
  fail(error);
}

/** W-14 ‘냈어요’(mark_note_paid): subtract = “모은 금액에서 뺄게요”. 뺐으면 움직임 id, 아니면 null */
export async function markNotePaid(id: string, subtract: boolean): Promise<string | null> {
  const { data, error } = await supabase().rpc('mark_note_paid', {
    p_note: id,
    p_subtract: subtract,
  });
  failAdjust(error);
  return typeof data === 'string' ? data : null;
}

/** 바로잡기 되돌리기(Toast, undo_saving_adjust): 내가 넣은 바로잡기 한 줄을 지우고 상대 한 줄도 지움 */
export async function undoSavingAdjust(moveId: string) {
  const { error } = await supabase().rpc('undo_saving_adjust', { p_move: moveId });
  failAdjust(error);
}

/** 냈어요 되돌리기(Toast, unpay_saving_note): 뺀 바로잡기도 되돌리고 메모는 안 냄으로 */
export async function unpaySavingNote(id: string) {
  const { error } = await supabase().rpc('unpay_saving_note', { p_note: id });
  failAdjust(error);
}

/** 쓸 곳 메모 신호(Realtime saving_note, 서버 발행이 있어야 옴) */
export function subscribeSavingNotes(spaceId: string, on: () => void) {
  const ch = supabase()
    .channel(`saving_note:${spaceId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'saving_note', filter: `space_id=eq.${spaceId}` },
      () => on(),
    )
    .subscribe();
  return () => {
    void supabase().removeChannel(ch);
  };
}
