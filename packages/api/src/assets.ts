import {
  AssetHistorySchema,
  AssetRowSchema,
  NetWorthMonthSchema,
  PartnerAssetSumSchema,
  type AssetHistoryRow,
  type AssetRow,
  type PartnerAssetSumRow,
  type Tables,
  type TablesInsert,
  type TablesUpdate,
} from '@sweetwo/core';
import { AuthCallError } from './auth';
import { supabase } from './client';
import { ensureSpace } from './onboarding';

// 자산 관리(docs/spec/23-assets.md). 공개 범위는 서버가 거름: 행은 내가 볼 수 있는 것만, 파트너 ‘합계만’은 묶음 합계로.
// 응답은 core Zod 스키마로 검사(2026-11-12 QA 8구간 S8-19)

/** 서버가 권한 밖이라 거절한 저장(RLS로 0행, 명의 잠금 not_owner, 2026-11-12 S8-16). 화면은 13 공통 상태 8번 문구 */
export class AssetForbiddenError extends Error {
  constructor() {
    super('forbidden');
  }
}
const fail = (e: { message?: string; code?: string } | null) => {
  if (!e) return;
  if (e.code === '42501' || e.message === 'not_owner') throw new AssetForbiddenError();
  throw new AuthCallError(e.message?.includes('fetch') ? 'network' : 'unknown');
};

export type Asset = AssetRow;

/** AD-19 항목 이름 목록(F-03a 세부 항목 칩). 기본 칩에 입히는 건 core withKindNames */
export async function fetchAssetKindNames(): Promise<Tables<'asset_kind_name'>[]> {
  const { data, error } = await supabase().from('asset_kind_name').select('*').order('created_at');
  fail(error);
  return data ?? [];
}
export type AssetInsert = Omit<TablesInsert<'asset'>, 'space_id'>;
export type AssetHistory = AssetHistoryRow;
export type PartnerAssetSum = PartnerAssetSumRow;

/** 지금 가진 항목(판 것, 지운 것 빼고) */
export async function fetchAssets(): Promise<Asset[]> {
  const { data, error } = await supabase()
    .from('asset')
    .select('*')
    .is('deleted_at', null)
    .eq('status', 'held')
    .order('amount', { ascending: false });
  fail(error);
  return AssetRowSchema.array().parse(data ?? []);
}

export async function fetchPartnerAssetSums(): Promise<PartnerAssetSum[]> {
  const { data, error } = await supabase().rpc('partner_asset_sums');
  fail(error);
  return PartnerAssetSumSchema.array().parse(data ?? []);
}

/** 월말 순자산(원금 기준, 평가금액 기준) */
export async function fetchNetWorthHistory(months = 12) {
  const { data, error } = await supabase().rpc('net_worth_history', { p_months: months });
  fail(error);
  return NetWorthMonthSchema.array().parse(data ?? []);
}

export async function fetchAssetHistory(id: string): Promise<AssetHistory[]> {
  const { data, error } = await supabase()
    .from('asset_history')
    .select('*')
    .eq('asset_id', id)
    .order('recorded_at', { ascending: false })
    .limit(36);
  fail(error);
  return AssetHistorySchema.array().parse(data ?? []);
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

/** 바로 고치기. 고친 행이 없으면(RLS가 거른 권한 밖 행) AssetForbiddenError(2026-11-12 S8-16) */
export async function updateAsset(id: string, patch: TablesUpdate<'asset'>) {
  const { data, error } = await supabase().from('asset').update(patch).eq('id', id).select('id');
  fail(error);
  if (!data?.length) throw new AssetForbiddenError();
}

/** 휴지통으로(과거 순자산 기록은 유지) */
export const trashAsset = (id: string) => updateAsset(id, { deleted_at: new Date().toISOString() });
export const restoreAsset = (id: string) => updateAsset(id, { deleted_at: null });

/** F-04a 만기된 돈 정리: 다른 통장으로(그 통장 + 만기 금액, 이 항목은 만기 완료) 또는 다시 가입(새 만기일) */
/** F-04b~d 팔았어요: 받은 금액을 고른 통장에(일부만이면 남은 평가금액). 실현 손익(원금 없으면 null) */
export async function sellAsset(
  id: string,
  o: { received: number; to: string; remain?: number | null },
): Promise<number | null> {
  const { data, error } = await supabase().rpc('sell_asset', {
    p_asset: id,
    p_received: o.received,
    p_to: o.to,
    ...(o.remain !== undefined && o.remain !== null ? { p_remain: o.remain } : {}),
  });
  fail(error);
  return data === null ? null : Number(data);
}

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

/**
 * 자산 변경 신호(Realtime asset, 2026-11-12 QA 8구간 S8-06, 20261124090000 발행). 읽기 권한은 asset_select 그대로라
 * 볼 수 있는 행(공동, 모두 보여 주기, 내 것)만 신호가 옴. 돌려준 함수로 끊음
 */
export function subscribeAssets(spaceId: string, on: () => void) {
  const ch = supabase()
    .channel(`asset:${spaceId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'asset', filter: `space_id=eq.${spaceId}` },
      () => on(),
    )
    .subscribe();
  return () => {
    void supabase().removeChannel(ch);
  };
}
