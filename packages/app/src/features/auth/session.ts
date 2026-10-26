import { configureSupabase, webAuth } from '@sweetwo/api';
import { isApp, type DesktopBridge, type Platform } from '../../platform';

// 세션은 플랫폼마다 다르다. 화면은 이 파일만 부른다.
// - 앱(데스크톱 main 프로세스, 모바일 네이티브 브리지): 브리지가 토큰을 쥔다. 웹뷰는 access token만 받는다
// - 웹(개발·e2e): supabase-js 브라우저 저장소(로그인 유지, 15 A-02 6번)
let platform: Platform = 'web';
let bridge: DesktopBridge | undefined;

export function initSession(p: Platform) {
  platform = p;
  bridge = isApp(p) ? window.sweetwo : undefined;
  const b = bridge;
  configureSupabase(
    b ? { kind: 'desktop', getAccessToken: () => b.auth.getAccessToken() } : { kind: 'web' },
  );
}

export const session = {
  get platform() {
    return platform;
  },
  get bridge() {
    return bridge;
  },
  async has(): Promise<boolean> {
    if (bridge) return (await bridge.auth.getAccessToken()) !== null;
    return webAuth.hasSession();
  },
  async signOut() {
    if (bridge) await bridge.auth.signOut();
    else await webAuth.signOut();
  },
};
