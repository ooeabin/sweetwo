// main과 preload가 같이 쓰는 IPC 채널 이름. 채널은 여기서만 만든다.
export const CH = {
  /** main → 렌더러: 초대 링크(sweetwo://i/{code}) */
  invite: 'sweetwo:invite',
  // 로그인(A-02, A-03, A-08)
  authStart: 'sweetwo:auth-start',
  authReopen: 'sweetwo:auth-reopen',
  authCancel: 'sweetwo:auth-cancel',
  authToken: 'sweetwo:auth-token',
  authSignOut: 'sweetwo:auth-sign-out',
  /** main → 렌더러: AuthEvent */
  authEvent: 'sweetwo:auth-event',
  // 앱 잠금(A-06)
  lockStatus: 'sweetwo:lock-status',
  lockSetPin: 'sweetwo:lock-set-pin',
  lockVerify: 'sweetwo:lock-verify',
  lockNow: 'sweetwo:lock-now',
  lockSetTouchId: 'sweetwo:lock-set-touch-id',
  lockTouchId: 'sweetwo:lock-touch-id',
  /** main → 렌더러: 잠김 */
  lockEvent: 'sweetwo:lock-event',
  // 알림(14): 렌더러가 Realtime으로 받은 새 알림을 OS 알림으로, 누르면 그 알림 id를 렌더러로
  notifyShow: 'sweetwo:notify-show',
  /** main → 렌더러: 누른 알림 id */
  notifyOpen: 'sweetwo:notify-open',
} as const;

export type AuthProviderName = 'kakao' | 'google' | 'apple';
export type LoginFailReason =
  | 'cancelled'
  | 'timeout'
  | 'provider_error'
  | 'request_mismatch'
  | 'browser_open_failed'
  | 'network';
export type SignOutReason = 'user' | 'expired' | 'pin_failed' | 'other_device';

export type AuthEvent =
  | { type: 'signed_in'; provider: AuthProviderName; waitSec: number; reopened: boolean }
  | { type: 'login_failed'; reason: LoginFailReason }
  | { type: 'signed_out'; reason: SignOutReason };

export interface LockStatus {
  hasPin: boolean;
  locked: boolean;
  touchIdAvailable: boolean;
  touchIdEnabled: boolean;
}
export interface OsNotice {
  id: string;
  title: string;
  body?: string;
}
export type VerifyResult = { ok: true } | { ok: false; failed: number; signedOut: boolean };
