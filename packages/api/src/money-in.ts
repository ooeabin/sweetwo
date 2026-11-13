import {
  MoneyInPeriodSchema,
  MoneyInRowSchema,
  type MoneyInPeriod,
  type MoneyInRowResponse,
} from '@sweetwo/core';
import { AuthCallError } from './auth';
import { supabase } from './client';

// 돈 들어왔어요(W-20·W-20a, H-13, 07 6장, 서버 20261203090000_v22_saving_together 계약 5·6).

const fail = (e: { message?: string } | null) => {
  if (e) throw new AuthCallError(e.message?.includes('fetch') ? 'network' : 'unknown');
};

export type MoneyInKind = MoneyInRowResponse['kind'];

/** 기록을 못 함: 금액 범위, 오늘 뒤 날짜, 나눠 넣은 합이 들어온 금액보다 큼, 넣을 수 없는 저금 */
export class MoneyInBlocked extends Error {
  constructor(readonly reason: 'bad_amount' | 'future_date' | 'over' | 'not_owner' | 'not_found') {
    super(reason);
  }
}
const failMoney = (e: { message?: string } | null) => {
  for (const r of ['bad_amount', 'future_date', 'over', 'not_owner', 'not_found'] as const)
    if (e?.message?.includes(r)) throw new MoneyInBlocked(r);
  fail(e);
};

/** 내(공개 ‘모두’면 상대 것도, RLS) 돈 들어온 기록. 최근 받은 날부터 */
export async function fetchMoneyIns(limit = 100): Promise<MoneyInRowResponse[]> {
  const { data, error } = await supabase()
    .from('money_in')
    .select('*')
    .is('deleted_at', null)
    .order('received_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  fail(error);
  return (data ?? []).map((r) => MoneyInRowSchema.parse(r));
}

/** W-20 기록(log_money_in). receivedOn 생략 = 오늘(KST). 새 기록 id */
export async function logMoneyIn(o: {
  amount: number;
  receivedOn?: string;
  kind?: MoneyInKind;
}): Promise<string> {
  const { data, error } = await supabase().rpc('log_money_in', {
    p_amount: o.amount,
    p_received_on: o.receivedOn,
    p_kind: o.kind,
  });
  failMoney(error);
  if (typeof data !== 'string') throw new AuthCallError('unknown');
  return data;
}

/** 받은 날·금액·종류 고치기(money_in_set). 나눠 넣은 합보다 적게는 못 줄임(bad_amount) */
export async function updateMoneyIn(
  id: string,
  o: { amount?: number; receivedOn?: string; kind?: MoneyInKind },
) {
  const { error } = await supabase().rpc('money_in_set', {
    p_id: id,
    p_amount: o.amount,
    p_received_on: o.receivedOn,
    p_kind: o.kind,
  });
  failMoney(error);
}

/** 지우기(나눠 넣은 것도 지움) */
export async function deleteMoneyIn(id: string) {
  const { error } = await supabase().rpc('money_in_delete', { p_id: id });
  failMoney(error);
}

/** W-20a 저금에 나눠 넣기(distribute_money_in). 0원 줄은 건너뜀. 넣은 저금 수 */
export async function distributeMoneyIn(
  id: string,
  items: { goalId: string; amount: number }[],
): Promise<number> {
  const { data, error } = await supabase().rpc('distribute_money_in', {
    p_money_in: id,
    p_items: items.map((i) => ({ goal_id: i.goalId, amount: i.amount })),
  });
  failMoney(error);
  return typeof data === 'number' ? data : 0;
}

/** 날짜 없는 사람의 기간(money_in_period, core moneyInPeriod와 같은 값). today 생략 = 오늘(KST) */
export async function fetchMoneyInPeriod(today?: string): Promise<MoneyInPeriod> {
  const { data, error } = await supabase().rpc('money_in_period', { p_today: today });
  fail(error);
  return MoneyInPeriodSchema.parse(data);
}

/** 돈 들어왔어요 신호(Realtime money_in) */
export function subscribeMoneyIns(spaceId: string, on: () => void) {
  const ch = supabase()
    .channel(`money_in:${spaceId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'money_in', filter: `space_id=eq.${spaceId}` },
      () => on(),
    )
    .subscribe();
  return () => {
    void supabase().removeChannel(ch);
  };
}
