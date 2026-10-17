import type { Tables } from '@sweetwo/core';
import { AuthCallError } from './auth';
import { supabase } from './client';

// 계정 삭제(25 S-18b, 31 3-2)와 내보내기(S-18) 자료
const fail = (e: { message?: string } | null) => {
  if (e) throw new AuthCallError(e.message?.includes('fetch') ? 'network' : 'unknown');
};

/** S-18b 삭제. 다시 로그인한 지 10분이 넘었으면 'reauth', 아니면 취소할 수 있는 마지막 날(YYYY-MM-DD) */
export async function requestAccountDeletion(): Promise<{ until: string } | 'reauth'> {
  const { data, error } = await supabase().rpc('request_account_deletion');
  if (error?.message?.includes('reauth_required')) return 'reauth';
  fail(error);
  return { until: String(data) };
}

/** A-02 ‘취소하고 계속 쓰기’ */
export async function cancelAccountDeletion() {
  const { error } = await supabase().rpc('cancel_account_deletion');
  fail(error);
}

export type ExportData = {
  assets: Tables<'asset'>[];
  goals: Tables<'goal'>[];
  plans: (Tables<'monthly_plan'> & { plan_line: Tables<'plan_line'>[] })[];
  closes: Tables<'month_close'>[];
  deposits: Tables<'saving_deposit'>[];
  careDays: Tables<'care_day'>[];
  careRecords: Tables<'care_record'>[];
  proposals: Tables<'proposal'>[];
};

/** 내보내기에 쓰는 행들(RLS가 공개 범위·서프라이즈를 거름) */
export async function fetchExportData(): Promise<ExportData> {
  const s = supabase();
  const [assets, goals, plans, closes, deposits, careDays, careRecords, proposals] =
    await Promise.all([
      s.from('asset').select('*').is('deleted_at', null).order('created_at'),
      s.from('goal').select('*').is('deleted_at', null).order('priority'),
      s.from('monthly_plan').select('*, plan_line(*)').is('deleted_at', null).order('label_month'),
      s.from('month_close').select('*').is('deleted_at', null),
      s.from('saving_deposit').select('*').is('deleted_at', null),
      s.from('care_day').select('*').is('deleted_at', null),
      s.from('care_record').select('*').is('deleted_at', null).order('occurs_on'),
      s.from('proposal').select('*').order('created_at'),
    ]);
  for (const r of [assets, goals, plans, closes, deposits, careDays, careRecords, proposals])
    fail(r.error);
  const arr = <T>(x: T[] | null): T[] => (Array.isArray(x) ? x : []);
  return {
    assets: arr(assets.data),
    goals: arr(goals.data),
    plans: arr(plans.data) as ExportData['plans'],
    closes: arr(closes.data),
    deposits: arr(deposits.data),
    careDays: arr(careDays.data),
    careRecords: arr(careRecords.data),
    proposals: arr(proposals.data),
  };
}
