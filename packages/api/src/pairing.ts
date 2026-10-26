import { TERMS_VERSION, type Json, type SplitLineDraft } from '@sweetwo/core';
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

/**
 * 합류 완료(18): P-06 분배표 저장 + 첫 체크리스트 + 연결 + 코드 사용됨. lines 없으면 대기(시작한 사람이 아직 온보딩 중, P-05).
 * version = P-06을 열 때 공동 분배표 버전(합쳐서). 그 사이 바뀌었으면 'split_changed'
 */
export async function completeJoin(
  lines?: SplitLineDraft[],
  version?: number,
): Promise<'ok' | 'split_changed'> {
  const p_lines = lines
    ? (lines.map((l) => ({
        kind: l.kind,
        amount: l.amount,
        goal_id: l.goalId ?? null,
        user_id: l.userId ?? null,
        name: l.name ?? null,
      })) as unknown as Json)
    : undefined;
  const { error } = await supabase().rpc('complete_join', { p_lines, p_version: version });
  if (error?.message?.includes('split_changed')) return 'split_changed';
  fail(error);
  return 'ok';
}

/** P-04: 합류 중 관리 방식 바꾸기(바로 적용, 시작한 사람 알림) */
export async function setJoinSalaryMode(mode: 'separate' | 'joint') {
  const { error } = await supabase().rpc('set_join_salary_mode', { p_mode: mode });
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

/** P-02b ‘지우고 새로 입력할게요’: 시작한 사람이 대신 입력한 내 명의 항목을 휴지통으로 */
export async function discardPrefill() {
  const { error } = await supabase().rpc('discard_prefill');
  fail(error);
}

