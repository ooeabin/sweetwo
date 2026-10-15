import { TERMS_VERSION } from '@sweetwo/core';
import { AuthCallError } from './auth';
import { supabase } from './client';

// 배우자 합류 서버 호출(docs/spec/18-partner-join.md, 15 A-07)
const fail = (e: { message?: string } | null) => {
  if (e) throw new AuthCallError(e.message?.includes('fetch') ? 'network' : 'unknown');
};

export type InviteStatus = 'ok' | 'invalid' | 'expired' | 'used' | 'unavailable';
/** 로그인 전에도: 초대한 사람 호칭과 상태 */
export async function invitePreview(
  code: string,
): Promise<{ inviter: string | null; status: InviteStatus }> {
  const { data, error } = await supabase().rpc('invite_preview', { p_code: code });
  fail(error);
  const row = Array.isArray(data) ? data[0] : null;
  return {
    inviter: (row?.inviter_nickname as string | null) ?? null,
    status: (row?.status as InviteStatus | undefined) ?? 'invalid',
  };
}

export type JoinResult =
  | 'joined'
  | 'resume'
  | 'invalid'
  | 'locked'
  | 'expired'
  | 'used'
  | 'unavailable'
  | 'own_code'
  | 'already_connected'
  | 'has_records';
export async function joinSpace(code: string): Promise<JoinResult> {
  const { data, error } = await supabase().rpc('join_space', { p_code: code });
  fail(error);
  return data as JoinResult;
}

/** 합류 완료(P-11): 부부 연결, 코드 사용됨 */
export async function finishJoin() {
  const { error } = await supabase().rpc('finish_join');
  fail(error);
}

/** 이번 플랜의 안 나눈 줄 분담액만 다시(P-11) */
export async function updatePendingShares(
  planId: string,
  shares: { account_role: string; amount_groom: number; amount_bride: number }[],
  isTemp: boolean,
) {
  const { error } = await supabase().rpc('update_pending_shares', {
    p_plan_id: planId,
    p_shares: shares,
    p_is_temp: isTemp,
  });
  fail(error);
}

/** 사전 입력 확인(P-02b) 동의 기록 */
export async function recordPrefillConsent(userId: string) {
  const { error } = await supabase().from('consent').insert({
    user_id: userId,
    kind: 'space_sharing',
    terms_version: TERMS_VERSION,
    agreed: true,
    source: 'prefill_review',
  });
  fail(error);
}
