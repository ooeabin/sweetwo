import type { Tables } from '@sweetwo/core';
import { AuthCallError } from './auth';
import { supabase } from './client';
import { ensureSpace, fetchMe } from './onboarding';

// 상여금(O-35, 연간 이벤트)과 다른 수입(O-35b). 넣기·고치기는 내 것만(RLS), 다른 수입 합계는 서버 트리거가 app_user.other_income에
const fail = (e: { message?: string } | null) => {
  if (e) throw new AuthCallError(e.message?.includes('fetch') ? 'network' : 'unknown');
};

export type IncomeItem = Tables<'income_item'>;
export type IncomeKind = IncomeItem['kind'];
export type IncomeEvent = Tables<'income_event'>;

export async function fetchIncomeItems(): Promise<IncomeItem[]> {
  const { data, error } = await supabase().from('income_item').select('*').is('deleted_at', null);
  fail(error);
  return data ?? [];
}
export async function fetchIncomeEvents(): Promise<IncomeEvent[]> {
  const { data, error } = await supabase()
    .from('income_event')
    .select('*')
    .is('deleted_at', null)
    .order('month');
  fail(error);
  return data ?? [];
}

async function mine() {
  const me = await fetchMe();
  if (!me) throw new AuthCallError('unknown');
  return { id: me.id, space_id: await ensureSpace() };
}

/** 고르지 않은 내 다른 수입 종류는 휴지통(O-35b 칩) */
export async function keepIncomeKinds(kinds: IncomeKind[]) {
  const m = await mine();
  const gone = (await fetchIncomeItems())
    .filter((r) => r.owner_user_id === m.id && !kinds.includes(r.kind))
    .map((r) => r.id);
  if (!gone.length) return;
  const { error } = await supabase()
    .from('income_item')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', gone);
  fail(error);
}

/** 내 다른 수입 한 종류의 월 금액(있으면 고침) */
export async function saveIncomeItem(kind: IncomeKind, monthly_amount: number) {
  const m = await mine();
  const old = (await fetchIncomeItems()).find((r) => r.owner_user_id === m.id && r.kind === kind);
  const { error } = old
    ? await supabase().from('income_item').update({ monthly_amount }).eq('id', old.id)
    : await supabase()
        .from('income_item')
        .insert({ kind, monthly_amount, owner_user_id: m.id, space_id: m.space_id });
  fail(error);
}

/** 내 상여금 목록을 이 행들로 바꿈(전에 넣은 건 휴지통) */
export async function saveIncomeEvents(rows: { name: string; amount: number; month: number }[]) {
  const m = await mine();
  const cur = (await fetchIncomeEvents()).filter((r) => r.owner_user_id === m.id);
  if (cur.length) {
    const { error } = await supabase()
      .from('income_event')
      .update({ deleted_at: new Date().toISOString() })
      .in(
        'id',
        cur.map((r) => r.id),
      );
    fail(error);
  }
  if (!rows.length) return;
  const { error } = await supabase()
    .from('income_event')
    .insert(rows.map((r) => ({ ...r, owner_user_id: m.id, space_id: m.space_id })));
  fail(error);
}
