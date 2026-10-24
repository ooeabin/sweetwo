import { createClient, type SupabaseClient, type SupportedStorage } from '@supabase/supabase-js';
import type { Database } from '@sweetwo/core';

// Supabase 클라이언트는 하나만. 앱에는 공개돼도 되는 값(VITE_)만 들어간다.
// - 웹: supabase-js가 세션을 브라우저 저장소에(‘로그인 유지’ 켜면 localStorage 최대 14일, 끄면 sessionStorage)
// - 데스크톱: 토큰은 main 프로세스만. 렌더러는 access token을 브리지에서 받아 쓴다(supabase.auth는 쓰지 않음).
export type Db = SupabaseClient<Database>;

type Mode = { kind: 'web' } | { kind: 'desktop'; getAccessToken: () => Promise<string | null> };
let mode: Mode = { kind: 'web' };
let client: Db | null = null;

/** 앱 시작 때 한 번, supabase()를 처음 부르기 전에. */
export function configureSupabase(m: Mode) {
  if (client) throw new Error('configureSupabase는 supabase()보다 먼저 불러야 해요');
  mode = m;
}

const KEEP_KEY = 'sweetwo.keep-login';
const safe = <T>(f: () => T, fallback: T): T => {
  try {
    return f();
  } catch {
    return fallback;
  }
};
export const keepLogin = {
  get: () => safe(() => localStorage.getItem(KEEP_KEY) === '1', false),
  set: (on: boolean) =>
    safe(
      () => (on ? localStorage.setItem(KEEP_KEY, '1') : localStorage.removeItem(KEEP_KEY)),
      undefined,
    ),
};

// ‘로그인 유지’에 따라 저장소를 고른다. 바꿀 때는 다른 쪽 값을 지운다.
const webStorage: SupportedStorage = {
  getItem: (k) => safe(() => (keepLogin.get() ? localStorage : sessionStorage).getItem(k), null),
  setItem: (k, v) => {
    safe(() => {
      const [use, other] = keepLogin.get()
        ? [localStorage, sessionStorage]
        : [sessionStorage, localStorage];
      use.setItem(k, v);
      other.removeItem(k);
    }, undefined);
  },
  removeItem: (k) => {
    safe(() => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    }, undefined);
  },
};

export function supabase(): Db {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anonKey) {
    throw new Error('VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY가 필요해요 (.env.development)');
  }
  client =
    mode.kind === 'desktop'
      ? createClient<Database>(url, anonKey, { accessToken: mode.getAccessToken })
      : createClient<Database>(url, anonKey, {
          auth: {
            persistSession: true,
            flowType: 'pkce',
            storageKey: 'sb-session',
            storage: webStorage,
            detectSessionInUrl: false,
          },
        });
  return client;
}
