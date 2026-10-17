import type { Tables } from '@sweetwo/core';
import { AuthCallError } from './auth';
import { supabase } from './client';
import { ensureSpace } from './onboarding';

// 이번 달 서버 호출: 할 일(H-04), 지출 항목과 지출 적기(W-04j)
const fail = (e: { message?: string } | null) => {
  if (e) throw new AuthCallError(e.message?.includes('fetch') ? 'network' : 'unknown');
};

export type Todo = Tables<'todo'>;
export async function fetchTodos(): Promise<Todo[]> {
  const { data, error } = await supabase().from('todo').select('*').is('deleted_at', null);
  fail(error);
  return data ?? [];
}
/** 없는 종류만 넣음(이미 있으면 그대로) */
export async function insertTodos(rows: Pick<Todo, 'kind' | 'screen' | 'open_on' | 'sort'>[]) {
  if (!rows.length) return;
  const space_id = await ensureSpace();
  const { error } = await supabase()
    .from('todo')
    .upsert(
      rows.map((r) => ({ ...r, space_id })),
      { onConflict: 'space_id,kind', ignoreDuplicates: true },
    );
  fail(error);
}
export async function updateTodo(
  id: string,
  patch: Pick<Partial<Todo>, 'status' | 'snoozed_until' | 'done_by' | 'done_at'>,
) {
  const { error } = await supabase().from('todo').update(patch).eq('id', id);
  fail(error);
}

/** 그 할 일을 연 화면에서 끝냈을 때(O-53 등). 이미 끝냈으면 그대로 */
export async function completeTodoKind(kind: Todo['kind'], by: string) {
  const { error } = await supabase()
    .from('todo')
    .update({ status: 'done', done_by: by, done_at: new Date().toISOString() })
    .eq('kind', kind)
    .neq('status', 'done');
  fail(error);
}

export type SpendCategory = Tables<'spend_category'>;
export async function fetchSpendCategories(): Promise<SpendCategory[]> {
  const { data, error } = await supabase()
    .from('spend_category')
    .select('*')
    .is('deleted_at', null)
    .order('sort');
  fail(error);
  return data ?? [];
}
export async function insertSpendCategories(
  rows: Pick<SpendCategory, 'default_key' | 'name' | 'sort'>[],
) {
  if (!rows.length) return;
  const space_id = await ensureSpace();
  const { error } = await supabase()
    .from('spend_category')
    .insert(rows.map((r) => ({ ...r, space_id })));
  fail(error);
}

export type MonthClose = Tables<'month_close'>;
export type MonthSpend = Tables<'month_spend'>;
export type BigExpenseRow = Tables<'big_expense'>;
export type SavingDeposit = Tables<'saving_deposit'>;
export type MonthCloseFull = MonthClose & {
  spends: MonthSpend[];
  bigs: BigExpenseRow[];
  deposits: SavingDeposit[];
};
/** 플랜의 월말 정리(초안 포함)와 항목별 지출, 큰 지출, 저축 납입. 없으면 null */
export async function fetchMonthClose(planId: string): Promise<MonthCloseFull | null> {
  const { data, error } = await supabase()
    .from('month_close')
    .select('*, spends:month_spend(*), bigs:big_expense(*), deposits:saving_deposit(*)')
    .eq('plan_id', planId)
    .is('deleted_at', null)
    .maybeSingle();
  fail(error);
  if (!data) return null;
  const live = <T extends { deleted_at: string | null }>(xs: T[] | null) =>
    (xs ?? []).filter((x) => !x.deleted_at);
  return {
    ...data,
    spends: live(data.spends),
    bigs: live(data.bigs),
    deposits: live(data.deposits),
  };
}

export async function updateMonthClose(
  id: string,
  patch: Pick<
    Partial<MonthClose>,
    'income' | 'big_none' | 'started_by' | 'started_at' | 'status' | 'closed_by' | 'closed_at'
  >,
) {
  const { error } = await supabase().from('month_close').update(patch).eq('id', id);
  fail(error);
}

/** 큰 지출 저장: 고른 칩은 저장(다시 고르면 되살림), 뺀 칩은 휴지통 */
export async function saveBigExpenses(
  closeId: string,
  rows: Pick<BigExpenseRow, 'kind' | 'name' | 'amount' | 'how'>[],
  removedKinds: string[],
) {
  const space_id = await ensureSpace();
  if (rows.length) {
    const { error } = await supabase()
      .from('big_expense')
      .upsert(
        rows.map((r) => ({ ...r, month_close_id: closeId, space_id, deleted_at: null })),
        { onConflict: 'month_close_id,kind' },
      );
    fail(error);
  }
  if (removedKinds.length) {
    const { error } = await supabase()
      .from('big_expense')
      .update({ deleted_at: new Date().toISOString() })
      .eq('month_close_id', closeId)
      .in('kind', removedKinds);
    fail(error);
  }
}

/** 저축 납입 저장(W-04k). 이름마다 하나 */
export async function saveDeposits(
  closeId: string,
  rows: Pick<SavingDeposit, 'name' | 'goal_id' | 'amount'>[],
) {
  if (!rows.length) return;
  const space_id = await ensureSpace();
  const { error } = await supabase()
    .from('saving_deposit')
    .upsert(
      rows.map((r) => ({ ...r, month_close_id: closeId, space_id })),
      { onConflict: 'month_close_id,name' },
    );
  fail(error);
}
/** 지출 적기를 처음 열면 초안을 만든다(있으면 그것) */
export async function ensureMonthClose(planId: string): Promise<string> {
  const cur = await fetchMonthClose(planId);
  if (cur) return cur.id;
  const space_id = await ensureSpace();
  const { data, error } = await supabase()
    .from('month_close')
    .insert({ space_id, plan_id: planId })
    .select('id')
    .single();
  fail(error);
  return (data as { id: string }).id;
}
/** 항목 하나 저장(칸을 벗어날 때). 나중 저장이 이김 */
export async function saveMonthSpend(closeId: string, categoryId: string, amount: number) {
  const space_id = await ensureSpace();
  const { error } = await supabase()
    .from('month_spend')
    .upsert(
      { month_close_id: closeId, category_id: categoryId, space_id, amount },
      { onConflict: 'month_close_id,category_id' },
    );
  fail(error);
}

export interface GoalRecordRow {
  goalId: string;
  month: string;
  amount: number;
}

/** 목표 달별 기록(G-02): 플랜마다 목표 줄 계획액, 정리를 마친 달의 이 목표 납입액 */
export async function fetchGoalRecords(): Promise<{
  plans: GoalRecordRow[];
  deposits: GoalRecordRow[];
}> {
  const [lines, deps] = await Promise.all([
    supabase()
      .from('plan_line')
      .select('goal_id, amount, monthly_plan!inner(label_month)')
      .eq('target', 'goal')
      .is('deleted_at', null)
      .not('goal_id', 'is', null),
    supabase()
      .from('saving_deposit')
      .select('goal_id, amount, month_close!inner(status, monthly_plan!inner(label_month))')
      .is('deleted_at', null)
      .not('goal_id', 'is', null),
  ]);
  fail(lines.error);
  fail(deps.error);
  return {
    plans: (lines.data ?? []).map((l) => ({
      goalId: l.goal_id ?? '',
      month: l.monthly_plan.label_month,
      amount: l.amount,
    })),
    deposits: (deps.data ?? [])
      .filter((d) => d.month_close.status === 'done')
      .map((d) => ({
        goalId: d.goal_id ?? '',
        month: d.month_close.monthly_plan.label_month,
        amount: d.amount,
      })),
  };
}

/** 가장 최근에 마친 월말 정리의 소득과 이번 달 넣은 돈(재정 진단 저축률, 06 8장). 없으면 null */
/** 끝낸 월말 정리, 최근 순(F-01 월 정산 요약과 지난달보다, F-06 저축률). 그달 = 플랜 label_month */
export type ClosedMonth = MonthCloseFull & { label_month: string };
export async function fetchRecentCloses(n = 2): Promise<ClosedMonth[]> {
  const { data, error } = await supabase()
    .from('month_close')
    .select(
      '*, plan:monthly_plan(label_month), spends:month_spend(*), bigs:big_expense(*), deposits:saving_deposit(*)',
    )
    .eq('status', 'done')
    .is('deleted_at', null)
    .order('closed_at', { ascending: false })
    .limit(n);
  fail(error);
  const live = <T extends { deleted_at: string | null }>(xs: T[] | null) =>
    (xs ?? []).filter((x) => !x.deleted_at);
  return (data ?? []).map(({ plan, ...c }) => ({
    ...c,
    label_month: plan?.label_month ?? '',
    spends: live(c.spends),
    bigs: live(c.bigs),
    deposits: live(c.deposits),
  }));
}

/** 월급 나누기 ‘옮겼어요’(W-02). 금액을 주면 다른 금액(W-02a). 먼저 체크한 사람이 있으면 'already' */
export async function checkSplit(
  lineId: string,
  side: 'groom' | 'bride',
  amount?: number,
): Promise<'ok' | 'already'> {
  const { data, error } = await supabase().rpc('check_split', {
    p_line: lineId,
    p_side: side,
    ...(amount === undefined ? {} : { p_amount: amount }),
  });
  fail(error);
  return data === 'already' ? 'already' : 'ok';
}
export async function uncheckSplit(lineId: string, side: 'groom' | 'bride') {
  const { error } = await supabase().rpc('uncheck_split', { p_line: lineId, p_side: side });
  fail(error);
}

/** 이번 달만 바꾸기(W-01a): 줄 금액을 바꾸고 차이는 빠지는 곳 줄이. 되돌리기 = 전 금액으로 다시 */
export async function adjustPlan(
  planId: string,
  role: 'living' | 'goal_fund' | 'emergency',
  amount: number,
  counter: 'living' | 'goal_fund' | 'emergency',
) {
  const { error } = await supabase().rpc('adjust_plan', {
    p_plan: planId,
    p_role: role,
    p_amount: amount,
    p_counter: counter,
  });
  fail(error);
}
