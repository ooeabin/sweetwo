import { AuthCallError } from './auth';
import { supabase } from './client';

// S-15 로그인된 기기
const fail = (e: { message?: string } | null) => {
  if (e) throw new AuthCallError(e.message?.includes('fetch') ? 'network' : 'unknown');
};

export type DeviceSession = {
  id: string;
  userAgent: string | null;
  createdAt: string;
  lastUsedAt: string;
  current: boolean;
};

export async function fetchSessions(): Promise<DeviceSession[]> {
  const { data, error } = await supabase().rpc('my_sessions');
  fail(error);
  return (data ?? []).map((r) => ({
    id: r.id,
    userAgent: r.user_agent,
    createdAt: r.created_at,
    lastUsedAt: r.last_used_at,
    current: r.current,
  }));
}

/** 기기 하나 로그아웃(id), 또는 이 기기 빼고 모두(id 없음) */
export async function endSessions(id?: string): Promise<number> {
  const { data, error } = await supabase().rpc('end_sessions', id ? { p_id: id } : {});
  fail(error);
  return typeof data === 'number' ? data : 0;
}
