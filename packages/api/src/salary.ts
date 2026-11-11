import { splitLineId, type Json, type SplitLineDraft, type Tables } from '@sweetwo/core';
import { AuthCallError } from './auth';
import { supabase } from './client';

// 월급 계획(W-01, O-50)와 이번 달 월급 체크리스트(W-02). 쓰기는 RPC로만(docs/spec/20-salary-plan.md).
export type SplitLine = Tables<'split_line'>;
export type SalarySplit = Tables<'salary_split'> & { split_line: SplitLine[] };
export type PayCheckLine = Tables<'pay_check_line'>;
export type PayChecklist = Tables<'pay_checklist'> & { pay_check_line: PayCheckLine[] };

const fail = (e: { message?: string } | null) => {
  if (e) throw new AuthCallError(e.message?.includes('fetch') ? 'network' : 'unknown');
};

/** 우리 둘 공간의 월급 계획 전부(각자 = 사람마다, 합쳐서 = 하나). 줄은 순서대로 */
export async function fetchSplits(): Promise<SalarySplit[]> {
  const { data, error } = await supabase()
    .from('salary_split')
    .select('*, split_line(*)')
    .order('sort', { referencedTable: 'split_line', ascending: true });
  fail(error);
  return (data ?? []) as SalarySplit[];
}

/** 이번 사이클 체크리스트(월급 계획마다 서버가 없으면 만듦, 예약 작업 전에 앱을 열어도 같게) */
export async function fetchChecklistsEnsured(today: string): Promise<PayChecklist[]> {
  const splits = await fetchSplits();
  await Promise.all(
    splits.map((s) => startChecklist(s.owner_user_id ?? undefined).catch(() => null)),
  );
  return fetchCurrentChecklists(today);
}

/** 월급 계획 저장(줄 통째로 교체). owner: 각자면 사람 id, 합쳐서면 생략 */
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

/**
 * 온보딩 중 추천 월급 계획 다시 만들기 전(17 O-32, 2026-11-10 S2-01): 내 월급 계획과 공동 월급 계획, 그 체크리스트를 지움.
 * 온보딩을 마친 뒤에는 서버가 거부. 체크한 기록이 있으면 서버가 아무것도 지우지 않음
 */
export async function resetOnboardingPlan(): Promise<void> {
  const { error } = await supabase().rpc('onboarding_reset_plan');
  fail(error);
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

/** 지난 체크리스트(W-02 ‹ › 지난 달 보기, 읽기 전용). owner null = 합쳐서 공동. 최근 것부터 24개 */
export async function fetchPastChecklists(
  owner: string | null,
  before: string,
): Promise<PayChecklist[]> {
  let q = supabase()
    .from('pay_checklist')
    .select('*, pay_check_line(*)')
    .lt('cycle_end', before)
    .order('cycle_start', { ascending: false })
    .order('sort', { referencedTable: 'pay_check_line', ascending: true })
    .limit(24);
  q = owner === null ? q.is('owner_user_id', null) : q.eq('owner_user_id', owner);
  const { data, error } = await q;
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

/** 저금 항목별 모은 금액 = 그 항목 저금 줄을 체크한 금액 합(06 4장, 서버 goal_saved) */
export async function fetchGoalSaved(): Promise<Record<string, number>> {
  const { data, error } = await supabase().rpc('goal_saved_sums');
  fail(error);
  return Object.fromEntries((data ?? []).map((r) => [r.goal_id, r.saved]));
}

/** 한 저금 항목의 체크 줄(W-10 6번 저금 내역) */
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

/** S-11f 월급 관리 방식 바꾸기(월급 계획 합치기·나누기는 서버, 체크리스트는 다음 월급날부터). 해제 대기 중이면 'unlink_pending' */
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

// ── W-01 영수증: 줄마다 바로 저장(2026-11-09, docs/spec/20-salary-plan.md W-01) ─────────────
// 서버 split_line_set / split_line_add / split_line_delete / split_reorder. 이번 달 체크 안 한 줄은 서버가 맞춤.

/** 고칠 수 없음: 같은 이름, 파트너 것(각자), 해제 대기, 합쳐서 용돈 줄, 직접 추가 줄 10개 */
export type SplitBlockReason =
  'duplicate_line' | 'not_owner' | 'unlink_pending' | 'keep_allowance' | 'too_many_custom';
export class SplitBlocked extends Error {
  constructor(readonly reason: SplitBlockReason) {
    super(reason);
  }
}
const REASONS: SplitBlockReason[] = [
  'duplicate_line',
  'not_owner',
  'unlink_pending',
  'keep_allowance',
  'too_many_custom',
];
const failSplit = (e: { message?: string } | null) => {
  const r = REASONS.find((x) => e?.message?.includes(x));
  if (r) throw new SplitBlocked(r);
  fail(e);
};

/** 줄 하나 금액·이름(이름은 직접 추가 줄만) */
export async function setSplitLine(line: string, o: { amount?: number; name?: string }) {
  const { error } = await supabase().rpc('split_line_set', {
    p_line: line,
    p_amount: o.amount,
    p_name: o.name,
  });
  failSplit(error);
}

/** 지출 줄 추가(직접 추가 줄, 되돌리기면 지운 기본 줄도). sort = 넣을 자리(없으면 맨 아래). 새 줄 id */
export async function addSplitLine(
  split: string,
  o: {
    kind: Exclude<SplitLineDraft['kind'], 'saving'>;
    amount: number;
    name?: string;
    userId?: string;
    sort?: number;
  },
): Promise<string> {
  const { data, error } = await supabase().rpc('split_line_add', {
    p_split: split,
    p_kind: o.kind,
    p_amount: o.amount,
    p_name: o.name,
    p_user: o.userId,
    p_sort: o.sort,
  });
  failSplit(error);
  const id = splitLineId.safeParse(data);
  if (!id.success) throw new AuthCallError('unknown');
  return id.data;
}

/** 줄 지우기(저금 줄 = 그만 모음, 기록은 남음) */
export async function deleteSplitLine(line: string) {
  const { error } = await supabase().rpc('split_line_delete', { p_line: line });
  failSplit(error);
}

/** 순서(그 월급 계획의 모든 줄 id, 저금 줄이 앞) */
export async function reorderSplit(split: string, ids: string[]) {
  const { error } = await supabase().rpc('split_reorder', { p_split: split, p_ids: ids });
  failSplit(error);
}

/**
 * 월급 계획 변경 신호(Realtime postgres_changes, salary_split 행: 서버 RPC마다 updated_at·version이 오름).
 * 받으면 splitKeys를 무효화. 돌려준 함수로 끊음
 */
/**
 * 체크리스트 줄이 바뀌면 신호(Realtime pay_check_line, 같은 공간만. RLS가 읽을 수 있는 줄만 보냄).
 * 합쳐서 모드에서 상대가 공동 체크리스트를 체크하면 홈 큰 상자·W-02가 바로 바뀜(2026-11-11 QA 4구간 S4-02)
 */
export function subscribeCheckLines(spaceId: string, on: () => void) {
  const ch = supabase()
    .channel(`pay_check_line:${spaceId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'pay_check_line', filter: `space_id=eq.${spaceId}` },
      () => on(),
    )
    .subscribe();
  return () => {
    void supabase().removeChannel(ch);
  };
}

export function subscribeSplits(spaceId: string, on: () => void) {
  const ch = supabase()
    .channel(`salary_split:${spaceId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'salary_split', filter: `space_id=eq.${spaceId}` },
      () => on(),
    )
    .subscribe();
  return () => {
    void supabase().removeChannel(ch);
  };
}
