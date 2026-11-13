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
/**
 * 위젯에 둘 값(26 v2.2). 금액은 없음(26 ‘금액 표시’: 기본 가림, S-22 ‘위젯에 금액 보이기’는 아직 없음).
 * 글은 앱 copy가 만든 그대로, D-n은 위젯이 그날(KST) 다시 셈
 */
export interface WidgetData {
  /** WG-01 같이 모으기: 대표 저금(core pickHeroes 첫 칸). 저금이 없으면 null */
  save: {
    name: string;
    /** 큰 숫자: “62%”, 목표 금액이 없으면 “모으는 중” */
    big: string;
    /** 중 크기 막대(0~100). 목표 금액이 없으면 null */
    pct: number | null;
    /** 중 크기 한 줄 “2027년 5월까지”. 없으면 null */
    line: string | null;
    /** 다 모았으면 배지 글(“다 모았어요”) */
    done: string | null;
    to: string;
  } | null;
  /** WG-04 다가오는 날: 가장 가까운 경조사 또는 쓸 곳 메모(금액 없음). 없으면 null */
  next: { name: string; date: string; to: string } | null;
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
    /** 휴대폰 설정 앱의 이 앱 알림 화면 열기(S-14 ‘설정 열기’, 2026-11-12). 옛 앱(네이티브 플러그인 없음)은 없음 */
    openSettings?: () => Promise<void>;
    onOpen: (cb: (n: { id: string; target: string }) => void) => () => void;
    /** 앱이 화면에 떠 있을 때 온 푸시(OS 알림 대신 앱 안 토스트) */
    onReceive: (cb: (n: { title: string; body: string | null }) => void) => () => void;
  };
  /**
   * 첫 실행 초대 코드(15 O-01, 18 P-01 v2.2, 2026-11-13): Android 설치 리퍼러, iOS는 웹 초대 페이지(L-07)가 복사한 클립보드를
   * 첫 실행 1회만 읽음(31 2장). 코드가 없으면 null. 네이티브는 PR 13, 옛 앱·브라우저는 없음(앱이 null로 봄)
   */
  inviteCode?: {
    firstRun: () => Promise<{ code: string; source: 'clipboard' | 'referrer' } | null>;
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
   * 글 공유(O-07 초대 코드, 2026-11-10 QA 2구간 S2-05). OS 공유 창(카카오톡 등) → 'shared' | 'cancelled'.
   * Android WebView에는 navigator.share가 없어 브리지로. 없으면(브라우저) 앱이 링크 복사
   */
  shareText?: (t: { text: string; url?: string }) => Promise<'shared' | 'cancelled'>;
  /**
   * 모바일: 보상형 동영상 광고(AdMob, F-08 ‘새로 확인하기’만, 첫 결과는 광고 없음, ADR 0006·0009 결정 11).
   * 비맞춤형만(npa=1, ATT 묻지 않음), 금융 카테고리는 AdMob 콘솔에서 차단. 끝까지 보면 'rewarded', 닫으면 'closed',
   * 못 불러오면 'failed'(앱은 광고 없이 바로 결과). 브라우저와 플러그인이 아직 없는 앱은 ads 없음(광고 없이 바로)
   */
  ads?: { rewarded: () => Promise<'rewarded' | 'closed' | 'failed'> };
  /**
   * 홈 화면 위젯(26 WG-01 같이 모으기, WG-04 다가오는 날, 2026-11-13). 앱이 홈 값을 받을 때마다 보여 줄 글만 넘기고
   * 네이티브가 기기 공유 저장소(iOS App Group, Android 앱 전용 SharedPreferences)에 둔다. 금액·토큰은 넘기지 않음.
   * 잠금(PIN)·로그아웃은 네이티브가 스스로 처리. 옛 앱·브라우저는 없음
   */
  widget?: {
    update: (d: WidgetData) => Promise<void>;
  };
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
