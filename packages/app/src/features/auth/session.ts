import { configureSupabase, unregisterPushDevice, webAuth } from '@sweetwo/api';
import { isApp, type AppBridge, type Platform } from '../../platform';

// 세션은 플랫폼마다 다르다. 화면은 이 파일만 부른다.
// - 모바일 앱(네이티브 브리지): 브리지가 토큰을 쥔다. 웹뷰는 access token만 받는다
// - 웹(개발·e2e): supabase-js 브라우저 저장소(로그인 유지, 15 A-02 6번)
let platform: Platform = 'web';
let bridge: AppBridge | undefined;

export function initSession(p: Platform) {
  platform = p;
  bridge = isApp(p) ? window.sweetwo : undefined;
  const b = bridge;
  configureSupabase(
    b ? { kind: 'bridge', getAccessToken: () => b.auth.getAccessToken() } : { kind: 'web' },
  );
}

const jwtSub = (token: string): string | null => {
  try {
    const part = token.split('.')[1] ?? '';
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const sub: unknown = (JSON.parse(json) as { sub?: unknown }).sub;
    return typeof sub === 'string' ? sub : null;
  } catch {
    return null;
  }
};

export const session = {
  get platform() {
    return platform;
  },
  get bridge() {
    return bridge;
  },
  /** 로그인한 사용자 ID(토큰의 sub). 세션이 없으면 null */
  async userId(): Promise<string | null> {
    if (!bridge) return webAuth.userId();
    const t = await bridge.auth.getAccessToken();
    return t ? jwtSub(t) : null;
  },
  async has(): Promise<boolean> {
    if (bridge) return (await bridge.auth.getAccessToken()) !== null;
    return webAuth.hasSession();
  },
  async signOut() {
    // 모바일: 이 기기로 푸시가 더 가지 않게 토큰부터 지움(실패해도 로그아웃)
    const t = await bridge?.push?.token().catch(() => null);
    if (t) await unregisterPushDevice(t).catch(() => undefined);
    if (bridge) await bridge.auth.signOut();
    else await webAuth.signOut();
  },
};
