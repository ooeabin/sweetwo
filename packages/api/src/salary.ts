import type { Json, SplitLineDraft, Tables } from '@sweetwo/core';
import { AuthCallError } from './auth';
import { supabase } from './client';

// 월급 분배표(W-01, O-50)와 이번 달 월급 체크리스트(W-02). 쓰기는 RPC로만(docs/spec/20-salary-plan.md).
export type SplitLine = Tables<'split_line'>;
export type SalarySplit = Tables<'salary_split'> & { split_line: SplitLine[] };
export type PayCheckLine = Tables<'pay_check_line'>;
export type PayChecklist = Tables<'pay_checklist'> & { pay_check_line: PayCheckLine[] };

const fail = (e: { message?: string } | null) => {
  if (e) throw new AuthCallError(e.message?.includes('fetch') ? 'network' : 'unknown');
};

/** 부부 공간의 분배표 전부(각자 = 사람마다, 합쳐서 = 하나). 줄은 순서대로 */
export async function fetchSplits(): Promise<SalarySplit[]> {
  const { data, error } = await supabase()
    .from('salary_split')
    .select('*, split_line(*)')
    .order('sort', { referencedTable: 'split_line', ascending: true });
  fail(error);
  return (data ?? []) as SalarySplit[];
}

/** 분배표 저장(줄 통째로 교체). owner: 각자면 사람 id, 합쳐서면 생략 */
export async function saveSplit(lines: SplitLineDraft[], owner?: string): Promise<string> {
  const p_lines = lines.map((l) => ({
    kind: l.kind,
    amount: l.amount,
    goal_id: l.goalId ?? null,
    user_id: l.userId ?? null,
    name: l.name ?? null,
  })) as unknown as Json;
  const { data, error } = await supabase().rpc('save_split', { p_lines, p_owner: owner });
  fail(error);
  return data as string;
}

/** 지금 사이클 체크리스트를 만듦(이미 있으면 그것). 월급이 없으면 null */
export async function startChecklist(owner?: string): Promise<string | null> {
  const { data, error } = await supabase().rpc('start_checklist', { p_owner: owner });
  fail(error);
  return (data as string | null) ?? null;
}

/** 지금 사이클 체크리스트들(오늘이 든 것). 줄은 순서대로 */
export async function fetchCurrentChecklists(today: string): Promise<PayChecklist[]> {
  const { data, error } = await supabase()
    .from('pay_checklist')
    .select('*, pay_check_line(*)')
    .lte('cycle_start', today)
    .gte('cycle_end', today)
    .order('sort', { referencedTable: 'pay_check_line', ascending: true });
  fail(error);
  return (data ?? []) as PayChecklist[];
}

/** 줄 체크(checked), 풀기(wait), 이번 달은 못 했어요(skipped). 다른 금액은 actual(0이면 못 함) */
export async function checkPayLine(
  line: string,
  state: 'checked' | 'wait' | 'skipped',
  actual?: number,
): Promise<'ok' | 'already_checked' | 'closed'> {
  const { error } = await supabase().rpc('check_pay_line', {
    p_line: line,
    p_state: state,
    p_actual: actual,
  });
  if (error?.message?.includes('already_checked')) return 'already_checked';
  if (error?.message?.includes('closed')) return 'closed';
  fail(error);
  return 'ok';
}

/** 목표별 체크한 저금 합(모은 돈 계산용) */
export async function fetchGoalCheckedSums(): Promise<Record<string, number>> {
  const { data, error } = await supabase().rpc('goal_checked_sums');
  fail(error);
  return Object.fromEntries((data ?? []).map((r) => [r.goal_id, r.amount]));
}

/** 목표별 모은 돈 = 이미 모은 돈 + 체크한 저금 + 넣기 − 빼기 − 꺼내 쓰기(06 4장) */
export async function fetchGoalSaved(): Promise<Record<string, number>> {
  const { data, error } = await supabase().rpc('goal_saved_sums');
  fail(error);
  return Object.fromEntries((data ?? []).map((r) => [r.goal_id, r.saved]));
}

export type GoalMove = Tables<'goal_move'>;
/** 목표 넣기·빼기·꺼내 쓰기 기록(되돌린 것 빼고) */
export async function fetchGoalMoves(goal: string): Promise<GoalMove[]> {
  const { data, error } = await supabase()
    .from('goal_move')
    .select('*')
    .eq('goal_id', goal)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  fail(error);
  return data ?? [];
}

/** 넣기(in)·빼기(out)·꺼내 쓰기(use). 모은 돈보다 많이 빼면 'too_much' */
export async function moveGoal(
  goal: string,
  kind: 'in' | 'out' | 'use',
  amount: number,
): Promise<{ id: string } | 'too_much'> {
  const { data, error } = await supabase().rpc('move_goal', {
    p_goal: goal,
    p_kind: kind,
    p_amount: amount,
  });
  if (error?.message?.includes('too_much')) return 'too_much';
  fail(error);
  return { id: data as string };
}

export async function undoGoalMove(id: string) {
  const { error } = await supabase().rpc('undo_goal_move', { p_id: id });
  fail(error);
}

/** 한 목표의 지난 체크 줄(월별 기록, G-02 10번) */
export async function fetchGoalLines(
  goal: string,
): Promise<(PayCheckLine & { pay_checklist: { label: string; cycle_start: string } | null })[]> {
  const { data, error } = await supabase()
    .from('pay_check_line')
    .select('*, pay_checklist(label, cycle_start)')
    .eq('goal_id', goal)
    .order('checked_at', { ascending: false });
  fail(error);
  return (data ?? []) as never;
}

/** S-11f 월급 관리 방식 바꾸기(분배표 합치기·나누기는 서버, 체크리스트는 다음 월급날부터). 해제 대기 중이면 'unlink_pending' */
export async function setSalaryMode(mode: 'separate' | 'joint'): Promise<'ok' | 'unlink_pending'> {
  const { error } = await supabase().rpc('set_salary_mode', { p_mode: mode });
  if (error?.message?.includes('unlink_pending')) return 'unlink_pending';
  fail(error);
  return 'ok';
}

/** S-11d 체크리스트 만드는 날(합쳐서 + 합류): 두 사람 월급날 중 하나(말일 = 31) */
export async function setJointCycleDay(day: number) {
  const { error } = await supabase().rpc('set_joint_cycle_day', { p_day: day });
  fail(error);
}
