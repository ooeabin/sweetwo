import type { InvestAnswer, Tables, TablesInsert, TablesUpdate } from '@sweetwo/core';
import { AuthCallError } from './auth';
import { supabase } from './client';
import { ensureSpace } from './onboarding';

// 우리 자산(docs/spec/23-assets.md). 공개 범위는 서버가 거름: 행은 내가 볼 수 있는 것만, 배우자 ‘합계만’은 묶음 합계로.
const fail = (e: { message?: string } | null) => {
  if (e) throw new AuthCallError(e.message?.includes('fetch') ? 'network' : 'unknown');
};

export type Asset = Tables<'asset'>;
export type AssetInsert = Omit<TablesInsert<'asset'>, 'space_id'>;
export type AssetHistory = Tables<'asset_history'>;
export interface PartnerAssetSum {
  side: Asset['side'];
  grp: string;
  n: number;
  total: number;
  principal_total: number;
}

/** 지금 가진 항목(판 것, 지운 것 빼고) */
export async function fetchAssets(): Promise<Asset[]> {
  const { data, error } = await supabase()
    .from('asset')
    .select('*')
    .is('deleted_at', null)
    .eq('status', 'held')
    .order('amount', { ascending: false });
  fail(error);
  return data ?? [];
}

export async function fetchPartnerAssetSums(): Promise<PartnerAssetSum[]> {
  const { data, error } = await supabase().rpc('partner_asset_sums');
  fail(error);
  return (data ?? []) as PartnerAssetSum[];
}

/** 월말 순자산(원금 기준, 평가금액 기준) */
export async function fetchNetWorthHistory(months = 12) {
  const { data, error } = await supabase().rpc('net_worth_history', { p_months: months });
  fail(error);
  return (data ?? []) as { month: string; net: number; expected: number }[];
}

export async function fetchAssetHistory(id: string): Promise<AssetHistory[]> {
  const { data, error } = await supabase()
    .from('asset_history')
    .select('*')
    .eq('asset_id', id)
    .order('recorded_at', { ascending: false })
    .limit(36);
  fail(error);
  return data ?? [];
}

export async function insertAsset(row: AssetInsert): Promise<string> {
  const space_id = await ensureSpace();
  const { data, error } = await supabase()
    .from('asset')
    .insert({ ...row, space_id })
    .select('id')
    .single();
  fail(error);
  return data?.id ?? '';
}

export async function updateAsset(id: string, patch: TablesUpdate<'asset'>) {
  const { error } = await supabase().from('asset').update(patch).eq('id', id);
  fail(error);
}

/** 휴지통으로(과거 순자산 기록은 유지) */
export const trashAsset = (id: string) => updateAsset(id, { deleted_at: new Date().toISOString() });
export const restoreAsset = (id: string) => updateAsset(id, { deleted_at: null });

/** 투자 원칙 답(O-53): 내 답과 배우자 답 */
export async function fetchInvestAnswers(): Promise<{
  mine: InvestAnswer | null;
  partner: InvestAnswer | null;
}> {
  const { data, error } = await supabase().rpc('invest_answers');
  fail(error);
  const row = Array.isArray(data) ? data[0] : null;
  return { mine: row?.mine ?? null, partner: row?.partner ?? null };
}

/** F-04a 만기된 돈 정리: 다른 통장으로(그 통장 + 만기 금액, 이 항목은 만기 완료) 또는 다시 가입(새 만기일) */
export async function settleMatured(
  id: string,
  how: { to: string } | { newDate: string },
): Promise<void> {
  const { error } = await supabase().rpc(
    'settle_matured',
    'to' in how ? { p_asset: id, p_to: how.to } : { p_asset: id, p_new_date: how.newDate },
  );
  fail(error);
}
