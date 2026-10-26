// 플랫폼 차이는 여기서만. 앱(데스크톱 Electron, 모바일 Capacitor) 전용 기능은 window.sweetwo 브리지로만 쓴다.
// 데스크톱은 apps/desktop/src/preload/index.ts, 모바일은 apps/mobile/src/native/bridge.ts가 같은 모양으로 노출(e2e가 키를 검사).
// 위젯·OS 알림은 데스크톱만(모바일은 없음), 플랫폼 값은 bridge.platform(없으면 데스크톱).
import type { AuthProvider } from '@sweetwo/core';

export type Platform = 'desktop' | 'ios' | 'android' | 'web';
/** 앱(브리지가 있는 곳): 데스크톱·모바일 */
export const isApp = (p: Platform) => p !== 'web';
export const isMobile = (p: Platform) => p === 'ios' || p === 'android';

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
  /** 생체 인증 종류(문구): Mac·iPhone Touch ID, iPhone Face ID, Android 지문. 없으면 touch */
  bioKind?: 'touch' | 'face' | 'fingerprint';
  /** 자동 잠금(분). 0 = 사용 안 함 */
  autoLockMin: number;
}
export type VerifyResult = { ok: true } | { ok: false; failed: number; signedOut: boolean };

/** 자동 업데이트 상태(apps/desktop shared/channels.ts와 같은 모양) */
export type UpdateState =
  | { status: 'idle' | 'checking' | 'latest' | 'error' }
  | { status: 'downloading'; version: string; percent: number }
  | { status: 'ready'; version: string };

export interface DesktopBridge {
  /** 모바일 브리지는 'ios' | 'android', 데스크톱은 없음 */
  platform?: 'desktop' | 'ios' | 'android';
  /** Electron 버전(모바일은 Capacitor 버전) */
  version: string;
  /** 앱 버전(package.json) */
  appVersion: string;
  /** 초대 링크(sweetwo://i/{code})를 받는다. 돌려준 함수로 해제. */
  onInvite: (cb: (code: string) => void) => () => void;
  auth: {
    /** 기본 브라우저(모바일은 시스템 로그인 창)로 소셜 로그인을 연다(A-03) */
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
    /** S-15 잠금 끄기(1분 안에 verify한 뒤만) */
    clear: () => Promise<boolean>;
    /** 자동 잠금 분: 0·1·5·15 */
    setAutoLock: (min: number) => Promise<boolean>;
    onLock: (cb: () => void) => () => void;
  };
  /** OS 알림(14). 누르면 그 알림 id */
  notify?: {
    show: (n: { id: string; title: string; body?: string }) => Promise<void>;
    onOpen: (cb: (id: string) => void) => () => void;
  };
  /** 모바일 푸시(14). 토큰은 앱이 서버에 등록(register_push_device), 누르면 그 알림 화면 */
  push?: {
    status: () => Promise<'granted' | 'denied' | 'prompt'>;
    /** 허용 묻기(OS 창). 허용되면 true */
    request: () => Promise<boolean>;
    /** 허용돼 있으면 기기 토큰, 아니면 null */
    token: () => Promise<string | null>;
    onOpen: (cb: (n: { id: string; target: string }) => void) => () => void;
    /** 앱이 화면에 떠 있을 때 온 푸시(OS 알림 대신 앱 안 토스트) */
    onReceive: (cb: (n: { title: string; body: string | null }) => void) => () => void;
  };
  /** 웹사이트 열기(A-01 업데이트 → 다운로드·스토어 안내). 모바일만, sweetwo.kr 주소만 */
  openUrl?: (url: string) => Promise<void>;
  /** 데스크톱 자동 업데이트(S-19 ‘업데이트 확인’). 모바일은 스토어 업데이트라 없음 */
  update?: {
    state: () => Promise<UpdateState>;
    check: () => Promise<UpdateState>;
    install: () => Promise<void>;
    onState: (cb: (s: UpdateState) => void) => () => void;
  };
  /** 모바일: 만든 파일을 OS 공유 창으로(‘파일에 저장’ 등 저장 위치는 사람이 고름). 데스크톱은 없음(내려받기 창) */
  saveFile?: (f: { name: string; base64: string; mime: string }) => Promise<'saved' | 'cancelled'>;
  /** main이 앱 창에 이 화면으로 가라고 할 때(트레이 위젯, 위젯 설정 메뉴) */
  onNavigate: (cb: (path: string) => void) => () => void;
  /** 트레이 위젯(26)·위젯 설정(S-22). 값은 core TraySnapshot·TrayState·WidgetSettings로 검사해서 씀 */
  widget?: {
    update: (s: unknown) => Promise<void>;
    state: () => Promise<unknown>;
    onChange: (cb: (s: unknown) => void) => () => void;
    open: (path: string) => Promise<void>;
    hide: () => Promise<void>;
    settings: () => Promise<unknown>;
    setSettings: (p: unknown) => Promise<unknown>;
  };
}

declare global {
  interface Window {
    sweetwo?: DesktopBridge;
  }
}

export function detectPlatform(): Platform {
  if (typeof window === 'undefined' || !window.sweetwo) return 'web';
  return window.sweetwo.platform ?? 'desktop';
}
