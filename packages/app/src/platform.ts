// 플랫폼 차이는 여기서만. 모바일 앱(Capacitor) 전용 기능은 window.sweetwo 브리지로만 쓴다.
// apps/mobile/src/native/bridge.ts가 이 모양으로 노출. 브리지가 없으면 브라우저(개발·e2e용, ADR 0001).
// 데스크톱 앱(Electron)은 ADR 0008(2026-11-10)로 없앰.
import type { AuthProvider } from '@sweetwo/core';

export type Platform = 'ios' | 'android' | 'web';
/** 앱(브리지가 있는 곳): 모바일 앱 */
export const isApp = (p: Platform) => p !== 'web';

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
  /** 생체 인증 종류(문구): iPhone Touch ID, iPhone Face ID, Android 지문. 없으면 touch */
  bioKind?: 'touch' | 'face' | 'fingerprint';
  /** 자동 잠금(분). 0 = 사용 안 함 */
  autoLockMin: number;
}
export type VerifyResult = { ok: true } | { ok: false; failed: number; signedOut: boolean };

export interface AppBridge {
  platform: 'ios' | 'android';
  /** Capacitor 플랫폼 이름 */
  version: string;
  /** 앱 버전(package.json) */
  appVersion: string;
  /**
   * 초대 링크(sweetwo://i/{code}, https://sweetwo.kr/i/{code} 앱 링크)를 받는다. 받는 쪽이 생기기 전에 온 링크(처음 실행)는
   * 구독할 때 한 번 넘김. 돌려준 함수로 해제. 앱은 A-01 판단이 끝난 뒤 구독해 A-07(/i/{code})로(잠겨 있으면 풀린 뒤 보임)
   */
  onInvite: (cb: (code: string) => void) => () => void;
  auth: {
    /** 시스템 로그인 창으로 소셜 로그인을 연다(A-03) */
    start: (
      p: AuthProvider,
    ) => Promise<{ ok: true } | { ok: false; reason: 'browser_open_failed' }>;
    reopen: () => Promise<{ ok: boolean }>;
    cancel: () => Promise<void>;
    /** 이 기기가 시작한 로그인 요청이 아직 기다리는 중인지(A-03 새로 고침·재실행 때, 2026-11-10). 없으면 모름 */
    pending?: () => Promise<boolean>;
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
    /**
     * 이 기기 PIN·생체 인증 지우기(확인 없이, 2026-11-10). ‘PIN을 잊었어요’(바로 로그아웃과 함께), 다른 계정으로
     * 로그인했을 때만 앱이 부른다. 잠금 해제 대신 쓰지 않음
     */
    reset?: () => Promise<void>;
    /** 자동 잠금 분: 0·1·5·15 */
    setAutoLock: (min: number) => Promise<boolean>;
    onLock: (cb: () => void) => () => void;
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
  /** 웹사이트 열기(A-01 업데이트 → 스토어 안내). sweetwo.kr 주소만 */
  openUrl?: (url: string) => Promise<void>;
  /** 오프라인 조회 캐시(30 동기화 4장): 기기에 암호화해 둔 마지막 화면 데이터(JSON 글). 로그아웃하면 기기가 지움 */
  cache?: {
    load: () => Promise<string | null>;
    save: (text: string) => Promise<boolean>;
    clear: () => Promise<void>;
  };
  /** 만든 파일을 OS 공유 창으로(‘파일에 저장’ 등 저장 위치는 사람이 고름). 없으면(브라우저) 내려받기 */
  saveFile?: (f: { name: string; base64: string; mime: string }) => Promise<'saved' | 'cancelled'>;
  /**
   * 이미지 공유(W-01 영수증 ‘공유하기’, 2026-11-09). PNG base64(머리 없이).
   * OS 공유 창 → 'shared' | 'cancelled'. 없으면(브라우저) 앱이 내려받기
   */
  shareImage?: (f: { name: string; base64: string }) => Promise<'shared' | 'cancelled'>;
  /**
   * 모바일: 보상형 동영상 광고(AdMob, 자산 순위 F-08 앞, ADR 0006). 끝까지 보면 'rewarded', 닫으면 'closed',
   * 못 불러오면 'failed'. 브라우저는 없음(광고 없이 바로)
   */
  ads?: { rewarded: () => Promise<'rewarded' | 'closed' | 'failed'> };
  /**
   * 안드로이드 하드웨어 뒤로(2026-11-09). 받는 쪽이 true를 돌려주면 처리한 것, false면 브리지가 기본 동작
   * (웹뷰 뒤로, 더 갈 곳이 없으면 앱 닫기). 돌려준 함수로 해제. iOS는 없음
   */
  onBack?: (cb: () => boolean) => () => void;
  /** 앱 링크(sweetwo://open…)로 이 화면으로 가라고 할 때 */
  onNavigate: (cb: (path: string) => void) => () => void;
}

declare global {
  interface Window {
    sweetwo?: AppBridge;
  }
}

export function detectPlatform(): Platform {
  if (typeof window === 'undefined' || !window.sweetwo) return 'web';
  return window.sweetwo.platform;
}
