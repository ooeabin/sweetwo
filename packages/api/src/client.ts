import { createClient, type SupabaseClient, type SupportedStorage } from '@supabase/supabase-js';
import type { Database } from '@sweetwo/core';

// Supabase 클라이언트는 하나만. 앱에는 공개돼도 되는 값(VITE_)만 들어간다.
// - 웹(개발·e2e): supabase-js가 세션을 localStorage에(15 A-02 6번)
// - 모바일 앱: 토큰은 네이티브 브리지만. 웹뷰는 access token을 브리지에서 받아 쓴다(supabase.auth는 쓰지 않음).
export type Db = SupabaseClient<Database>;

type Mode = { kind: 'web' } | { kind: 'bridge'; getAccessToken: () => Promise<string | null> };
let mode: Mode = { kind: 'web' };
let client: Db | null = null;

/** 앱 시작 때 한 번, supabase()를 처음 부르기 전에. */
export function configureSupabase(m: Mode) {
  if (client) throw new Error('configureSupabase는 supabase()보다 먼저 불러야 해요');
  mode = m;
}

const safe = <T>(f: () => T, fallback: T): T => {
  try {
    return f();
  } catch {
    return fallback;
  }
};
const webStorage: SupportedStorage = {
  getItem: (k) => safe(() => localStorage.getItem(k), null),
  setItem: (k, v) => safe(() => localStorage.setItem(k, v), undefined),
  removeItem: (k) => safe(() => localStorage.removeItem(k), undefined),
};

// 앱 기본 틀 6번 툴팁 “모두 저장됨” / “저장 중”: 서버로 가는 쓰기(POST·PATCH·PUT·DELETE)가 진행 중인지
let writing = 0;
const savingListeners = new Set<() => void>();
const emitSaving = () => savingListeners.forEach((f) => f());
export const isSaving = () => writing > 0;
export function subscribeSaving(f: () => void) {
  savingListeners.add(f);
  return () => void savingListeners.delete(f);
}
// 오프라인(30 동기화 4장): 앱은 마지막으로 받은 데이터로 볼 수만 있고, 서버로 가는 쓰기는 보내지 않음.
// 인터넷이 없으면 쓰기를 바로 실패시키고 그 시각을 남김 → 앱이 실패 안내 대신 “인터넷에 연결되면 할 수 있어요”를 띄움
let blockedAt = 0;
/** 인터넷이 없어 쓰기를 막은 마지막 시각(ms) */
export const lastOfflineBlock = () => blockedAt;
const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

// 보기만(15 A-01 5번 ‘업데이트 없이 보기만 할게요’, 13 공통 상태 12번): 최소 지원 버전 미만이면 서버로 가는 쓰기를 보내지 않음.
// 화면은 그대로 두고 저장하려 하면 바로 실패 → 앱이 “지금 버전으로는 저장할 수 없어요” 토스트(toast.tsx).
// 조회용 RPC(stable 함수)와 로그인·기기 기록처럼 보기에 필요한 것만 통과.
let readOnly = false;
let readOnlyAt = 0;
/** 보기만 모드 켜기·끄기(A-01) */
export const setReadOnly = (on: boolean) => {
  readOnly = on;
};
export const isReadOnly = () => readOnly;
/** 보기만이라 쓰기를 막은 마지막 시각(ms) */
export const lastReadOnlyBlock = () => readOnlyAt;
const READ_RPC = new Set([
  'goal_saved_sums',
  'goal_story',
  'invest_answers',
  'invite_preview',
  'my_mail_bounced',
  'my_notices',
  'my_sessions',
  'my_unlink',
  'net_worth_history',
  'partner_asset_sums',
  'partner_birth_year',
  'partner_profile',
  'pending_terms',
  'space_avatars',
  'space_goals',
  'trash_rows',
  'unlink_partner_name',
  'login_state',
  // 보기에 필요한 기록·준비(사용자 데이터를 바꾸지 않음)
  'ensure_my_space',
  'start_checklist',
  'note_login',
  'note_device',
  'touch_app',
  'mark_notifications_read',
  // 보안: 기기 로그아웃, 푸시 해제는 막지 않음
  'end_sessions',
  'unregister_push_device',
]);
const blockedByReadOnly = (url: string) => {
  if (!readOnly || url.includes('/auth/v1/')) return false;
  const m = /\/rest\/v1\/rpc\/([a-z0-9_]+)/.exec(url);
  return !(m?.[1] && READ_RPC.has(m[1]));
};
const trackedFetch: typeof fetch = async (input, init) => {
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const write = method !== 'GET' && method !== 'HEAD';
  if (!write) return fetch(input, init);
  const url = input instanceof Request ? input.url : String(input);
  // 로그인 토큰 갱신(auth)은 막지 않음(Supabase가 알아서 다시 시도)
  if (offline() && !url.includes('/auth/v1/')) {
    blockedAt = Date.now();
    throw new TypeError('Failed to fetch');
  }
  if (blockedByReadOnly(url)) {
    readOnlyAt = Date.now();
    throw new TypeError('read_only');
  }
  writing++;
  emitSaving();
  try {
    return await fetch(input, init);
  } finally {
    writing--;
    emitSaving();
  }
};

export function supabase(): Db {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anonKey) {
    throw new Error('VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY가 필요해요 (.env.development)');
  }
  client =
    mode.kind === 'bridge'
      ? createClient<Database>(url, anonKey, {
          accessToken: mode.getAccessToken,
          global: { fetch: trackedFetch },
        })
      : createClient<Database>(url, anonKey, {
          auth: {
            persistSession: true,
            flowType: 'pkce',
            storageKey: 'sb-session',
            storage: webStorage,
            detectSessionInUrl: false,
          },
          global: { fetch: trackedFetch },
        });
  return client;
}
