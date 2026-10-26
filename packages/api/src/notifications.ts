import type { Tables } from '@sweetwo/core';
import { AuthCallError } from './auth';
import { supabase } from './client';

// 알림 센터(14 N-01~N-03). 내 알림만(RLS), 읽음 처리만 함수로. 새 알림은 Realtime으로 받음
const fail = (e: { message?: string } | null) => {
  if (e) throw new AuthCallError(e.message?.includes('fetch') ? 'network' : 'unknown');
};

export type Notification = Tables<'notification'>;
export const NOTI_PAGE = 30;

/** 최신순 30개. before = 그보다 오래된 것(더 불러오기) */
export async function fetchNotifications(before?: string): Promise<Notification[]> {
  let q = supabase()
    .from('notification')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(NOTI_PAGE);
  if (before) q = q.lt('created_at', before);
  const { data, error } = await q;
  fail(error);
  return data ?? [];
}

/** 읽지 않은 알림이 있는지(종 아이콘 점) */
export async function fetchHasUnread(): Promise<boolean> {
  const { data, error } = await supabase()
    .from('notification')
    .select('id')
    .is('read_at', null)
    .limit(1);
  fail(error);
  return (data ?? []).length > 0;
}

/** 읽음. ids가 없으면 모두 */
export async function markNotificationsRead(ids?: string[]) {
  const { error } = await supabase().rpc('mark_notifications_read', ids ? { p_ids: ids } : {});
  fail(error);
}

/** 새 알림(INSERT)·읽음(UPDATE) 받기. 돌려준 함수로 끊음 */
export function subscribeNotifications(
  userId: string,
  on: (ev: { type: 'insert' | 'update'; row: Notification }) => void,
) {
  const ch = supabase()
    .channel(`notification:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notification', filter: `user_id=eq.${userId}` },
      (p) => {
        if (p.eventType === 'INSERT') on({ type: 'insert', row: p.new as Notification });
        else if (p.eventType === 'UPDATE') on({ type: 'update', row: p.new as Notification });
      },
    )
    .subscribe();
  return () => {
    void supabase().removeChannel(ch);
  };
}

/** 알림 하나(OS 알림을 눌렀을 때 갈 화면 찾기) */
export async function fetchNotification(id: string): Promise<Notification | null> {
  const { data, error } = await supabase()
    .from('notification')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  fail(error);
  return data;
}

// ── 앱 안 공지(AD-10): 게시되고 노출 기간 안의 것만(RLS) ─────────────────────
export type ActiveNotice = {
  id: string;
  kind: string;
  title: string;
  body: string;
  importance: 'normal' | 'must';
  platforms: string[];
};
export async function fetchActiveNotices(platform: 'desktop' | 'web'): Promise<ActiveNotice[]> {
  const { data, error } = await supabase()
    .from('notice')
    .select('id, kind, title, body, importance, platforms')
    .order('starts_at', { ascending: false });
  if (error) return [];
  return (data ?? [])
    .filter((n) => n.platforms.includes(platform))
    .map((n) => ({ ...n, importance: n.importance === 'must' ? 'must' : 'normal' }));
}

/** 새 기기 로그인 확인(로그인 뒤 한 번): 다른 세션이 있으면 서버가 본인에게 알림 + 메일 */
export async function noteLogin(): Promise<boolean> {
  const { data, error } = await supabase().rpc('note_login');
  if (error) throw new Error(error.message);
  return data === true;
}

/** 데스크톱 앱 접속 신호(켜져 있는 동안 5분마다). 10분 넘게 없으면 서버가 알림을 메일로 대신 보냄 */
export async function touchApp(): Promise<void> {
  const { error } = await supabase().rpc('touch_app');
  if (error) throw new Error(error.message);
}

/** S-14 마케팅 정보 받기: 가장 최근 동의 기록(없으면 null = 꺼짐) */
export async function fetchMarketing(): Promise<{ agreed: boolean; at: string } | null> {
  const { data, error } = await supabase()
    .from('consent')
    .select('agreed, created_at')
    .eq('kind', 'marketing')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const r = data?.[0];
  return r ? { agreed: r.agreed, at: r.created_at } : null;
}

/** S-14 마케팅 정보 받기 켜기·끄기(동의 기록은 추가만) */
export async function setMarketing(userId: string, on: boolean, version: string): Promise<void> {
  const { error } = await supabase().from('consent').insert({
    user_id: userId,
    kind: 'marketing',
    terms_version: version,
    agreed: on,
    source: 'settings',
  });
  if (error) throw new Error(error.message);
}

/** 홈 띠: 내 알림 이메일로 보낸 메일이 반송됐는지(14 ‘알림 메일 반송’). 주소를 바꾸면 사라짐 */
export async function fetchMailBounced(): Promise<boolean> {
  const { data, error } = await supabase().rpc('my_mail_bounced');
  if (error) return false;
  return data === true;
}
