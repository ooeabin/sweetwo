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
  /** 목표별 모은 돈 */
  saved: Record<string, number>;
  splits: (Tables<'salary_split'> & { split_line: Tables<'split_line'>[] })[];
  checklists: (Tables<'pay_checklist'> & { pay_check_line: Tables<'pay_check_line'>[] })[];
  careDays: Tables<'care_day'>[];
  careRecords: Tables<'care_record'>[];
};

/** 내보내기에 쓰는 행들(RLS가 공개 범위·서프라이즈를 거름) */
export async function fetchExportData(): Promise<ExportData> {
  const s = supabase();
  const [assets, goals, saved, splits, checklists, careDays, careRecords] = await Promise.all([
    s.from('asset').select('*').is('deleted_at', null).order('created_at'),
    s.from('goal').select('*').is('deleted_at', null).order('priority'),
    s.rpc('goal_saved_sums'),
    s.from('salary_split').select('*, split_line(*)'),
    s.from('pay_checklist').select('*, pay_check_line(*)').order('cycle_start'),
    s.from('care_day').select('*').is('deleted_at', null),
    s.from('care_record').select('*').is('deleted_at', null).order('occurs_on'),
  ]);
  for (const r of [assets, goals, saved, splits, checklists, careDays, careRecords]) fail(r.error);
  const arr = <T>(x: T[] | null): T[] => (Array.isArray(x) ? x : []);
  return {
    assets: arr(assets.data),
    goals: arr(goals.data),
    saved: Object.fromEntries(arr(saved.data).map((r) => [r.goal_id, r.saved])),
    splits: arr(splits.data) as ExportData['splits'],
    checklists: arr(checklists.data) as ExportData['checklists'],
    careDays: arr(careDays.data),
    careRecords: arr(careRecords.data),
  };
}
