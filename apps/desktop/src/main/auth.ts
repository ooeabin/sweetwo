import { app, BrowserWindow, shell } from 'electron';
import { DESKTOP_LOGIN_TIMEOUT_MS } from '@sweetwo/core';
import { z } from 'zod';
import { CH, type AuthEvent, type AuthProviderName, type SignOutReason } from '../shared/channels';
import { authorizeUrl, randomToken } from './pkce';
import { secureStore } from './secure-store';

// 데스크톱 로그인(docs/DEV_GUIDE.md ‘데스크톱 로그인과 딥링크’, 기획서 A-02, A-03)
// 시스템 브라우저 OAuth(PKCE) → https 웹 콜백 → sweetwo:// 딥링크 → main이 code를 토큰으로 바꾼다.
// code_verifier와 refresh token은 main에만. 렌더러는 access token만 IPC로 받는다.
const env = {
  url: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  key: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
  web: (import.meta.env.VITE_WEB_ORIGIN as string | undefined) ?? 'https://app.sweetwo.kr',
};

const TokenResponse = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_at: z.number().optional(),
  expires_in: z.number(),
});
type Session = { accessToken: string; refreshToken: string; expiresAt: number };

let session: Session | null = null;
let pending: {
  provider: AuthProviderName;
  verifier: string;
  state: string;
  url: string;
  startedAt: number;
  reopened: boolean;
  timer: NodeJS.Timeout;
} | null = null;
let refreshing: Promise<Session | null> | null = null;

const emit = (ev: AuthEvent) => {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send(CH.authEvent, ev);
};

function requireEnv() {
  if (!env.url || !env.key)
    throw new Error(
      'VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY가 필요해요(apps/desktop/.env.local)',
    );
  return { url: env.url, key: env.key };
}

async function tokenRequest(
  grant: 'pkce' | 'refresh_token',
  body: Record<string, string>,
): Promise<Session | 'rejected'> {
  const { url, key } = requireEnv();
  const res = await fetch(`${url}/auth/v1/token?grant_type=${grant}`, {
    method: 'POST',
    headers: {
      apikey: key,
      'Content-Type': 'application/json',
      // S-15 로그인된 기기 이름(core deviceLabel): 세션에 남는 브라우저 정보
      'User-Agent': `sweeTwo/${app.getVersion()} Electron (${process.platform === 'darwin' ? 'Macintosh' : process.platform === 'win32' ? 'Windows' : 'Linux'})`,
    },
    body: JSON.stringify(body),
  });
  if (res.status >= 400 && res.status < 500) return 'rejected';
  if (!res.ok) throw new Error(`auth ${res.status}`);
  const t = TokenResponse.parse(await res.json());
  const s = {
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    expiresAt: t.expires_at ? t.expires_at * 1000 : Date.now() + t.expires_in * 1000,
  };
  secureStore.set('refresh-token', s.refreshToken); // 암호화를 못 쓰면 저장 안 됨(다음 실행 때 다시 로그인)
  return s;
}

function clearPending() {
  if (pending) clearTimeout(pending.timer);
  pending = null;
}

export async function startLogin(provider: AuthProviderName) {
  clearPending();
  const { url } = requireEnv();
  const verifier = randomToken();
  const state = randomToken(16);
  const loginUrl = authorizeUrl({
    supabaseUrl: url,
    webOrigin: env.web,
    provider,
    verifier,
    state,
  });
  const timer = setTimeout(() => {
    clearPending();
    emit({ type: 'login_failed', reason: 'timeout' });
  }, DESKTOP_LOGIN_TIMEOUT_MS);
  pending = {
    provider,
    verifier,
    state,
    url: loginUrl,
    startedAt: Date.now(),
    reopened: false,
    timer,
  };
  try {
    await shell.openExternal(loginUrl);
    return { ok: true as const };
  } catch {
    clearPending();
    return { ok: false as const, reason: 'browser_open_failed' as const };
  }
}

export async function reopenLogin() {
  if (!pending) return { ok: false as const, reason: 'request_mismatch' as const };
  pending.reopened = true;
  try {
    await shell.openExternal(pending.url);
    return { ok: true as const };
  } catch {
    return { ok: false as const, reason: 'browser_open_failed' as const };
  }
}

export const cancelLogin = () => clearPending();

/** 딥링크로 돌아온 결과. 이 기기가 시작한 요청(state)과 같을 때만 처리. */
export async function handleAuthCallback(
  link:
    | { kind: 'auth'; code: string; state: string }
    | { kind: 'auth_error'; error: string; state: string },
) {
  if (!pending || pending.state !== link.state) {
    emit({ type: 'login_failed', reason: 'request_mismatch' });
    return;
  }
  const p = pending;
  clearPending();
  if (link.kind === 'auth_error') {
    emit({
      type: 'login_failed',
      reason: link.error === 'access_denied' ? 'cancelled' : 'provider_error',
    });
    return;
  }
  try {
    const s = await tokenRequest('pkce', { auth_code: link.code, code_verifier: p.verifier });
    if (s === 'rejected') {
      emit({ type: 'login_failed', reason: 'request_mismatch' });
      return;
    }
    session = s;
    emit({
      type: 'signed_in',
      provider: p.provider,
      waitSec: Math.round((Date.now() - p.startedAt) / 1000),
      reopened: p.reopened,
    });
  } catch {
    emit({ type: 'login_failed', reason: 'network' });
  }
}

async function refresh(): Promise<Session | null> {
  const rt = session?.refreshToken ?? secureStore.get('refresh-token');
  if (!rt) return null;
  try {
    const s = await tokenRequest('refresh_token', { refresh_token: rt });
    if (s === 'rejected') {
      await signOut('expired', { remote: false });
      return null;
    }
    session = s;
    return s;
  } catch {
    return session; // 오프라인: 가진 토큰으로 조회만(A-08 ‘데스크톱 오프라인 중 만료’)
  }
}

/** 만료 1분 전이면 갱신. 세션이 없으면 null. */
export async function getAccessToken(): Promise<string | null> {
  if (session && session.expiresAt - Date.now() > 60_000) return session.accessToken;
  refreshing ??= refresh().finally(() => (refreshing = null));
  return (await refreshing)?.accessToken ?? null;
}

export async function signOut(reason: SignOutReason, o: { remote: boolean } = { remote: true }) {
  const s = session;
  session = null;
  secureStore.remove('refresh-token');
  if (o.remote && s && env.url && env.key) {
    // 이 기기 세션만 끊는다. 실패해도 로컬은 지운다.
    await fetch(`${env.url}/auth/v1/logout?scope=local`, {
      method: 'POST',
      headers: { apikey: env.key, Authorization: `Bearer ${s.accessToken}` },
    }).catch(() => undefined);
  }
  emit({ type: 'signed_out', reason });
}
