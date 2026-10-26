import { createClient, type SupabaseClient, type SupportedStorage } from '@supabase/supabase-js';
import type { Database } from '@sweetwo/core';

// Supabase 클라이언트는 하나만. 앱에는 공개돼도 되는 값(VITE_)만 들어간다.
// - 웹(개발·e2e)과 모바일: supabase-js가 세션을 localStorage에. 앱은 로그인을 유지하고 앱 잠금(A-06)으로 보호(15 A-02 6번)
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
