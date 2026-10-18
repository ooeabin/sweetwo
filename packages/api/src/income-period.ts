import type { Tables } from '@sweetwo/core';
import { AuthCallError } from './auth';
import { supabase } from './client';

// 기간 수입 변경(23 F-05f·F-07c).
const fail = (e: { message?: string } | null) => {
  if (e) throw new AuthCallError(e.message?.includes('fetch') ? 'network' : 'unknown');
};

export type IncomePeriod = Tables<'income_period'>;

/** 이 공간의 기간 수입 변경(끝나지 않은 것 먼저) */
export async function fetchIncomePeriods(): Promise<IncomePeriod[]> {
  const { data, error } = await supabase()
    .from('income_period')
    .select('*')
    .is('deleted_at', null)
    .order('start_month');
  fail(error);
  return data ?? [];
}

/** 겹치는 기간이 있으면 */
export class IncomePeriodOverlap extends Error {
  constructor() {
    super('overlap');
  }
}

/** 적용하기: 기간 수입 + 보충 줄(바로) + (연결된 부부) 그 기간 ‘버는 만큼’ 분담 제안 */
export async function setIncomePeriod(p: {
  start: string;
  end: string;
  amount: number;
  supplement: number;
  splitApplyOn: string | null;
}): Promise<string> {
  const { data, error } = await supabase().rpc('set_income_period', {
    p_start: p.start,
    p_end: p.end,
    p_amount: p.amount,
    p_supplement: p.supplement,
    ...(p.splitApplyOn ? { p_split_apply_on: p.splitApplyOn } : {}),
  });
  if (error?.message?.includes('overlap')) throw new IncomePeriodOverlap();
  fail(error);
  return typeof data === 'string' ? data : '';
}
