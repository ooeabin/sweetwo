import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor, registerPlugin } from '@capacitor/core';
import type { AuthEvent } from '@sweetwo/app';
import { DESKTOP_LOGIN_TIMEOUT_MS, parseDeepLink, type AuthProvider } from '@sweetwo/core';
import { z } from 'zod';
import { emitter } from './events';
import { authorizeUrl, randomToken } from './pkce';
import { offlineCache } from './offline-cache';
import { secureStore } from './store';

// 모바일 로그인(DEV_GUIDE ‘모바일 세션’, 기획서 A-02, A-03). 데스크톱 apps/desktop/src/main/auth.ts와 같은 흐름.
// 시스템 로그인 창(iOS ASWebAuthenticationSession = 앱 안 WebAuth 플러그인, Android Custom Tabs = @capacitor/browser)
// → https 웹 콜백(from=app) → sweetwo://auth/callback → state 확인 → grant_type=pkce 교환.
// code_verifier는 메모리에만, refresh token은 Keychain·Keystore에만. 웹뷰의 supabase-js는 access token만 받는다.
const env = {
  url: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  key: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
  web: (import.meta.env.VITE_WEB_ORIGIN as string | undefined) ?? 'https://sweetwo.kr',
};

/** iOS 앱 안 플러그인(ios/App/App/SceneDelegate.swift WebAuthPlugin). Android에는 없음 */
const WebAuth = registerPlugin<{
  start(o: { url: string; callbackScheme: string }): Promise<{ url?: string; cancelled?: boolean }>;
  cancel(): Promise<void>;
}>('WebAuth');

const TokenResponse = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_at: z.number().optional(),
  expires_in: z.number(),
});
type Session = { accessToken: string; refreshToken: string; expiresAt: number };
export type SignOutReason = Extract<AuthEvent, { type: 'signed_out' }>['reason'];

export const authEvents = emitter<AuthEvent>();
let session: Session | null = null;
let pending: {
  provider: AuthProvider;
  verifier: string;
  state: string;
  url: string;
  startedAt: number;
  reopened: boolean;
  timer: ReturnType<typeof setTimeout>;
} | null = null;
let refreshing: Promise<Session | null> | null = null;

function requireEnv() {
  if (!env.url || !env.key) throw new Error('VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY가 필요해요');
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
      // S-15 로그인된 기기 이름은 웹뷰 User-Agent(iPhone, Android)로 core deviceLabel이 만듦
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
  await secureStore.set('refresh-token', s.refreshToken);
  return s;
}

function clearPending() {
  if (pending) clearTimeout(pending.timer);
  pending = null;
}

const ios = () => Capacitor.getPlatform() === 'ios';

async function openLogin(url: string) {
  if (ios()) {
    // 로그인 창이 sweetwo://로 돌아오면 바로 닫히며 결과를 줌(앱 링크 받기가 필요 없음)
    void WebAuth.start({ url, callbackScheme: 'sweetwo' })
      .then((r) => {
        if (r.url) void handleUrl(r.url);
        else if (r.cancelled && pending) {
          clearPending();
          authEvents.emit({ type: 'login_failed', reason: 'cancelled' });
        }
      })
      .catch(() => {
        if (!pending) return;
        clearPending();
        authEvents.emit({ type: 'login_failed', reason: 'provider_error' });
      });
    return;
  }
  await Browser.open({ url, presentationStyle: 'popover' });
}

export async function startLogin(provider: AuthProvider) {
  clearPending();
  const { url } = requireEnv();
  const verifier = randomToken();
  const state = randomToken(16);
  const loginUrl = await authorizeUrl({
    supabaseUrl: url,
    webOrigin: env.web,
    provider,
    verifier,
    state,
  });
  const timer = setTimeout(() => {
    clearPending();
    authEvents.emit({ type: 'login_failed', reason: 'timeout' });
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
    await openLogin(loginUrl);
    return { ok: true as const };
  } catch {
    clearPending();
    return { ok: false as const, reason: 'browser_open_failed' as const };
  }
}

export async function reopenLogin() {
  if (!pending) return { ok: false };
  pending.reopened = true;
  try {
    await openLogin(pending.url);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function cancelLogin() {
  clearPending();
  if (ios()) await WebAuth.cancel().catch(() => undefined);
  else await Browser.close().catch(() => undefined);
}

/** sweetwo://auth/callback(로그인 결과)만 여기서. 이 기기가 시작한 요청(state)과 같을 때만 처리 */
export async function handleUrl(raw: string): Promise<boolean> {
  const link = parseDeepLink(raw);
  if (!link || (link.kind !== 'auth' && link.kind !== 'auth_error')) return false;
  if (!ios()) void Browser.close().catch(() => undefined);
  if (!pending || pending.state !== link.state) {
    authEvents.emit({ type: 'login_failed', reason: 'request_mismatch' });
    return true;
  }
  const p = pending;
  clearPending();
  if (link.kind === 'auth_error') {
    authEvents.emit({
      type: 'login_failed',
      reason: link.error === 'access_denied' ? 'cancelled' : 'provider_error',
    });
    return true;
  }
  try {
    const s = await tokenRequest('pkce', { auth_code: link.code, code_verifier: p.verifier });
    if (s === 'rejected') {
      authEvents.emit({ type: 'login_failed', reason: 'request_mismatch' });
      return true;
    }
    session = s;
    authEvents.emit({
      type: 'signed_in',
      provider: p.provider,
      waitSec: Math.round((Date.now() - p.startedAt) / 1000),
      reopened: p.reopened,
    });
  } catch {
    authEvents.emit({ type: 'login_failed', reason: 'network' });
  }
  return true;
}

/** Android: 로그인 창을 닫고 돌아왔는데 결과가 없으면 취소로(결과 링크가 조금 늦게 올 수 있어 잠깐 기다림) */
export function watchBrowserClosed() {
  if (ios()) return;
  void Browser.addListener('browserFinished', () => {
    const started = pending?.startedAt;
    setTimeout(() => {
      if (pending && pending.startedAt === started) {
        clearPending();
        authEvents.emit({ type: 'login_failed', reason: 'cancelled' });
      }
    }, 1500);
  });
}

async function refresh(): Promise<Session | null> {
  const rt = session?.refreshToken ?? (await secureStore.get('refresh-token'));
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
    return session; // 오프라인: 가진 토큰으로 조회만
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
  await secureStore.remove('refresh-token');
  // 로그아웃(직접, 만료, 다른 기기, PIN 실패)이면 기기 캐시도 지움
  await offlineCache.clear();
  if (o.remote && s && env.url && env.key) {
    // 이 기기 세션만 끊는다. 실패해도 로컬은 지운다.
    await fetch(`${env.url}/auth/v1/logout?scope=local`, {
      method: 'POST',
      headers: { apikey: env.key, Authorization: `Bearer ${s.accessToken}` },
    }).catch(() => undefined);
  }
  authEvents.emit({ type: 'signed_out', reason });
}

/** 앱 링크·sweetwo:// 받기(실행 중, 처음 실행 둘 다) */
export function listenAppUrls(onOther: (raw: string) => void) {
  const take = (raw: string) => void handleUrl(raw).then((auth) => !auth && onOther(raw));
  void CapApp.addListener('appUrlOpen', ({ url }) => take(url));
  void CapApp.getLaunchUrl().then((r) => r?.url && take(r.url));
}
