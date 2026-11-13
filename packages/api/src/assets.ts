import {
  AssetHistorySchema,
  AnswerResult,
  AssetRowSchema,
  NetWorthMonthSchema,
  NetworthSummarySchema,
  RankConsentRequestRowSchema,
  RankPairSchema,
  type RankConsentRequestRow,
  type RankPairResponse,
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

// ─────────────────────────── v2.2 자산 공개 첫 선택·순자산·순위(06 6장·7-8, 23 F-03e·F-08·F-08c, 서버 20261204090000_v22_unlink_rank) ───────────────────────────

/** F-03e 자산 공개 첫 선택(set_asset_share_default): 모두 / 총액만(sum) / 숨기기(private). 새 항목 기본값 */
export async function setAssetShareDefault(vis: 'all' | 'sum' | 'private') {
  const { error } = await supabase().rpc('set_asset_share_default', { p_vis: vis });
  if (error) throw new AuthCallError(error.message.includes('fetch') ? 'network' : 'unknown');
}

/** 순자산 요약(networth_summary, 평가금액 기본 + principalNet ‘원금으로 보기’) */
export async function fetchNetworthSummary() {
  const { data, error } = await supabase().rpc('networth_summary');
  if (error) throw new AuthCallError(error.message.includes('fetch') ? 'network' : 'unknown');
  return NetworthSummarySchema.parse(data);
}

/** 순위 미리 보기(networth_rank_pair): 두 사람 모두 동의면 pair, 아니면 peer(또래 중간값). 기록하지 않음 */
export async function fetchRankPair(): Promise<RankPairResponse> {
  const { data, error } = await supabase().rpc('networth_rank_pair');
  if (error) throw new AuthCallError(error.message.includes('fetch') ? 'network' : 'unknown');
  return RankPairSchema.parse(data);
}

/** 첫 조회가 아닌데 광고를 안 봄(record_rank_view 'ad_required') */
export class RankAdRequired extends Error {
  constructor() {
    super('ad_required');
  }
}

/**
 * 순위 보기 기록(record_rank_view, F-08): 사람마다 첫 조회는 광고 없이, 그다음은 보상형 광고를 본 뒤 paidByAd = true.
 * pair면 서버가 홈 배지용 저장 순위(rank_month·pct·net)도 갱신. 결과
 */
export async function recordRankView(paidByAd = false): Promise<RankPairResponse> {
  const { data, error } = await supabase().rpc('record_rank_view', { p_paid_by_ad: paidByAd });
  if (error?.message.includes('ad_required')) throw new RankAdRequired();
  if (error) throw new AuthCallError(error.message.includes('fetch') ? 'network' : 'unknown');
  return RankPairSchema.parse(data);
}

/** 순위 같이 보기 요청(request_rank_consent, 내 동의 켬 + 상대에게 요청). 연결 전이면 'not_connected'. 요청 id */
export async function requestRankConsent(): Promise<string> {
  const { data, error } = await supabase().rpc('request_rank_consent');
  if (error?.message.includes('not_connected')) throw new AssetForbiddenError();
  if (error) throw new AuthCallError(error.message.includes('fetch') ? 'network' : 'unknown');
  if (typeof data !== 'string') throw new AuthCallError('unknown');
  return data;
}

/** F-08c 답(answer_rank_consent). 만료·이미 답함이면 'expired' */
export async function answerRankConsent(id: string, accept: boolean): Promise<AnswerResult> {
  const { data, error } = await supabase().rpc('answer_rank_consent', {
    p_request: id,
    p_accept: accept,
  });
  if (error?.message.includes('not_open')) return 'expired';
  if (error) throw new AuthCallError(error.message.includes('fetch') ? 'network' : 'unknown');
  return AnswerResult.parse(data);
}

/** 내 동의 끄기(set_rank_consent(false)): 두 사람 홈 배지·저장 순위를 지움. 켜기는 requestRankConsent */
export async function turnOffRankConsent() {
  const { error } = await supabase().rpc('set_rank_consent', { p_on: false });
  if (error) throw new AuthCallError(error.message.includes('fetch') ? 'network' : 'unknown');
}

/** 우리 공간의 열린 순위 요청(없으면 null) */
export async function fetchOpenRankRequest(): Promise<RankConsentRequestRow | null> {
  const { data, error } = await supabase()
    .from('rank_consent_request')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw new AuthCallError(error.message.includes('fetch') ? 'network' : 'unknown');
  const row = (data ?? [])[0];
  return row ? RankConsentRequestRowSchema.parse(row) : null;
}

/** 순위 요청 신호(Realtime rank_consent_request, 서버 발행이 있어야 옴) */
export function subscribeRankRequests(spaceId: string, on: () => void) {
  const ch = supabase()
    .channel(`rank_consent_request:${spaceId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'rank_consent_request',
        filter: `space_id=eq.${spaceId}`,
      },
      () => on(),
    )
    .subscribe();
  return () => {
    void supabase().removeChannel(ch);
  };
}
