import type { Tables, TablesInsert } from '@sweetwo/core';
import { AuthCallError } from './auth';
import { supabase } from './client';

// 결혼 비용(22 G-07): 항목, 결제, 예산 바꾸기(연결된 부부는 제안), 결제 기록.
const fail = (e: { message?: string } | null) => {
  if (e) throw new AuthCallError(e.message?.includes('fetch') ? 'network' : 'unknown');
};

export type WeddingItem = Tables<'wedding_item'>;
export type WeddingPayment = Tables<'wedding_payment'>;

export async function fetchWeddingItems(): Promise<WeddingItem[]> {
  const { data, error } = await supabase()
    .from('wedding_item')
    .select('*')
    .is('deleted_at', null)
    .order('sort')
    .order('created_at');
  fail(error);
  return data ?? [];
}

export async function fetchWeddingPayments(): Promise<WeddingPayment[]> {
  const { data, error } = await supabase()
    .from('wedding_payment')
    .select('*')
    .is('deleted_at', null);
  fail(error);
  return data ?? [];
}

/** 새 항목(예산 포함 바로). 돌려줌 = id */
export async function insertWeddingItem(
  row: Omit<TablesInsert<'wedding_item'>, 'space_id'> & { space_id: string },
): Promise<string> {
  const { data, error } = await supabase().from('wedding_item').insert(row).select('id').single();
  fail(error);
  return data?.id ?? '';
}

/** 예산 말고 다른 칸(이름, 날짜, 누가, 숨김) */
export async function updateWeddingItem(
  id: string,
  patch: Pick<
    Partial<WeddingItem>,
    | 'name'
    | 'deposit_amount'
    | 'deposit_on'
    | 'balance_amount'
    | 'balance_on'
    | 'payer'
    | 'deleted_at'
  >,
) {
  const { error } = await supabase().from('wedding_item').update(patch).eq('id', id);
  fail(error);
}

/** 예산 바꾸기. itemId null = 총예산. 'applied' = 바로, 'proposed' = 제안으로 감 */
export async function changeWeddingBudget(
  itemId: string | null,
  budget: number,
  applyOn: string,
): Promise<'applied' | 'proposed'> {
  const { data, error } = await supabase().rpc('change_wedding_budget', {
    p_budget: budget,
    p_apply_on: applyOn,
    ...(itemId ? { p_item: itemId } : {}),
  });
  fail(error);
  return data === 'proposed' ? 'proposed' : 'applied';
}

/** 결제 기록. 돌려줌 = 예산 넘은 금액 */
export async function recordWeddingPayment(
  itemId: string,
  part: 'deposit' | 'balance',
  amount: number,
  paidFrom: 'wedding_account' | 'personal_support',
): Promise<number> {
  const { data, error } = await supabase().rpc('record_wedding_payment', {
    p_item: itemId,
    p_part: part,
    p_amount: amount,
    p_paid_from: paidFrom,
  });
  fail(error);
  return Number(data ?? 0);
}
