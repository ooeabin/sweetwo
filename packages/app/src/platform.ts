// desktop/web 차이는 여기서만. 데스크톱 전용 기능은 preload가 노출한 window.sweetwo 브리지로만 쓴다.
// 모양은 apps/desktop/src/preload/index.ts와 같아야 한다(e2e가 키를 검사).
import type { AuthProvider } from '@sweetwo/core';

export type Platform = 'desktop' | 'web';

export type LoginFailReason =
  | 'cancelled'
  | 'timeout'
  | 'provider_error'
  | 'request_mismatch'
  | 'browser_open_failed'
  | 'network';
export type SignOutReason = 'user' | 'expired' | 'pin_failed' | 'other_device';
export type AuthEvent =
  | { type: 'signed_in'; provider: AuthProvider; waitSec: number; reopened: boolean }
  | { type: 'login_failed'; reason: LoginFailReason }
  | { type: 'signed_out'; reason: SignOutReason };

export interface LockStatus {
  hasPin: boolean;
  locked: boolean;
  touchIdAvailable: boolean;
  touchIdEnabled: boolean;
}
export type VerifyResult = { ok: true } | { ok: false; failed: number; signedOut: boolean };

export interface DesktopBridge {
  /** Electron 버전 */
  version: string;
  /** 앱 버전(package.json) */
  appVersion: string;
  /** 초대 링크(sweetwo://i/{code})를 받는다. 돌려준 함수로 해제. */
  onInvite: (cb: (code: string) => void) => () => void;
  auth: {
    /** 기본 브라우저로 소셜 로그인을 연다(A-03) */
    start: (
      p: AuthProvider,
    ) => Promise<{ ok: true } | { ok: false; reason: 'browser_open_failed' }>;
    reopen: () => Promise<{ ok: boolean }>;
    cancel: () => Promise<void>;
    /** 세션이 없으면 null */
    getAccessToken: () => Promise<string | null>;
    signOut: () => Promise<void>;
    onEvent: (cb: (ev: AuthEvent) => void) => () => void;
  };
  lock: {
    status: () => Promise<LockStatus>;
    setPin: (pin: string) => Promise<boolean>;
    verify: (pin: string) => Promise<VerifyResult>;
    lockNow: () => Promise<void>;
    setTouchId: (on: boolean) => Promise<boolean>;
    unlockWithTouchId: () => Promise<boolean>;
    onLock: (cb: () => void) => () => void;
  };
}

declare global {
  interface Window {
    sweetwo?: DesktopBridge;
  }
}

export function detectPlatform(): Platform {
  return typeof window !== 'undefined' && window.sweetwo ? 'desktop' : 'web';
}
