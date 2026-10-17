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
