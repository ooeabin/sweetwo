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
