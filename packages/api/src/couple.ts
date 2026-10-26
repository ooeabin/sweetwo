import type { Tables } from '@sweetwo/core';
import { AuthCallError } from './auth';
import { supabase } from './client';

// S-12 부부 정보: 초대 코드 보기, 새 코드 받기. 초대 코드는 부부 공간 사람만 봄(RLS), 만들기는 함수로만
const fail = (e: { message?: string } | null) => {
  if (e) throw new AuthCallError(e.message?.includes('fetch') ? 'network' : 'unknown');
};

export type LatestInvite = { code: string; expiresAt: string; usedAt: string | null };

/** 가장 최근 초대 코드(없으면 null). 만료됐는지는 화면이 expiresAt으로 판단 */
export async function fetchLatestInvite(): Promise<LatestInvite | null> {
  const { data, error } = await supabase()
    .from('invite')
    .select('code, expires_at, used_at')
    .order('created_at', { ascending: false })
    .limit(1);
  fail(error);
  const row = data?.[0];
  return row ? { code: row.code, expiresAt: row.expires_at, usedAt: row.used_at } : null;
}

/** 새 코드 받기: 이전 코드는 바로 못 씀 */
export async function renewInvite(): Promise<{ code: string; expiresAt: string }> {
  const { data, error } = await supabase().rpc('renew_invite');
  fail(error);
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) throw new AuthCallError('unknown');
  return { code: row.code, expiresAt: row.expires_at };
}

export type Unlink = Tables<'couple_unlink'>;

/** 진행 중인 연결 해제 요청(없으면 null) */
export async function fetchUnlink(): Promise<Unlink | null> {
  const { data, error } = await supabase()
    .from('couple_unlink')
    .select('*')
    .eq('status', 'pending')
    .limit(1);
  fail(error);
  return data?.[0] ?? null;
}

/** S-12c 연결 해제 요청(같이 쓰던 데이터는 나누지 않고 확정 때 모두 지움). confirm = “연결 해제” */
export async function requestUnlink(confirm: string) {
  const { error } = await supabase().rpc('request_unlink', { p_confirm: confirm });
  fail(error);
}

/** 요청 취소(요청한 사람, 상대 응답 전) */
export async function cancelUnlink() {
  const { error } = await supabase().rpc('cancel_unlink');
  fail(error);
}

/** S-12d ‘확인했어요’(받은 사람): 바로 해제 확정 */
export async function agreeUnlink() {
  const { error } = await supabase().rpc('agree_unlink');
  fail(error);
}

/** 지금 공간이 해제로 만든 공간이면 그 해제(S-12h, 혼자 쓰기) */
export async function fetchMyUnlink(): Promise<Unlink | null> {
  const { data, error } = await supabase().rpc('my_unlink');
  fail(error);
  return (Array.isArray(data) ? data[0] : null) ?? null;
}

/** S-12h ‘시작하기’: 혼자 쓰기 온보딩 O-11부터 */
export async function startAfterUnlink() {
  const { error } = await supabase().rpc('start_after_unlink');
  fail(error);
}

/** S-12 “다시 연결하기”(해제 확정 뒤 30일 안) */
export async function requestReconnect() {
  const { error } = await supabase().rpc('request_reconnect');
  fail(error);
}

/** S-12g 답: true = 다시 연결할게요, false = 괜찮아요 */
export async function answerReconnect(accept: boolean) {
  const { error } = await supabase().rpc('answer_reconnect', { p_accept: accept });
  fail(error);
}

/** 혼자 쓰기 → 새로 초대하기(미합류로) */
export async function startNewInvite() {
  const { error } = await supabase().rpc('start_new_invite');
  fail(error);
}

/** 해제 뒤 상대 호칭 */
export async function fetchUnlinkPartnerName(): Promise<string> {
  const { data, error } = await supabase().rpc('unlink_partner_name');
  fail(error);
  return typeof data === 'string' ? data : '';
}
