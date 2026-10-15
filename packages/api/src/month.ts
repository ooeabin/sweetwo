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
/** 플랜의 월말 정리(초안 포함)와 항목별 지출. 없으면 null */
export async function fetchMonthClose(
  planId: string,
): Promise<(MonthClose & { spends: MonthSpend[] }) | null> {
  const { data, error } = await supabase()
    .from('month_close')
    .select('*, spends:month_spend(*)')
    .eq('plan_id', planId)
    .is('deleted_at', null)
    .maybeSingle();
  fail(error);
  return data ? { ...data, spends: (data.spends ?? []).filter((x) => !x.deleted_at) } : null;
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
