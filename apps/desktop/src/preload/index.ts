import { contextBridge, ipcRenderer } from 'electron';
import {
  CH,
  type AuthEvent,
  type AuthProviderName,
  type LockStatus,
  type OsNotice,
  type VerifyResult,
} from '../shared/channels';

// 렌더러에 노출하는 것은 window.sweetwo 하나. 모양은 packages/app/src/platform.ts의 DesktopBridge와 같아야 한다.
// refresh token, code_verifier, 로그인 콜백 code는 노출하지 않는다(main 전용). access token만 준다.
const listen = <T>(channel: string, cb: (v: T) => void) => {
  const handler = (_e: unknown, v: T) => cb(v);
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
};

const appVersion =
  process.argv.find((a) => a.startsWith('--sweetwo-app-version='))?.split('=')[1] ?? '0.0.0';

contextBridge.exposeInMainWorld('sweetwo', {
  version: process.versions.electron,
  appVersion,
  onInvite: (cb: (code: string) => void) => listen(CH.invite, cb),
  auth: {
    start: (p: AuthProviderName) =>
      ipcRenderer.invoke(CH.authStart, p) as Promise<
        { ok: true } | { ok: false; reason: 'browser_open_failed' }
      >,
    reopen: () => ipcRenderer.invoke(CH.authReopen) as Promise<{ ok: boolean }>,
    cancel: () => ipcRenderer.invoke(CH.authCancel) as Promise<void>,
    getAccessToken: () => ipcRenderer.invoke(CH.authToken) as Promise<string | null>,
    signOut: () => ipcRenderer.invoke(CH.authSignOut) as Promise<void>,
    onEvent: (cb: (ev: AuthEvent) => void) => listen(CH.authEvent, cb),
  },
  lock: {
    status: () => ipcRenderer.invoke(CH.lockStatus) as Promise<LockStatus>,
    setPin: (pin: string) => ipcRenderer.invoke(CH.lockSetPin, pin) as Promise<boolean>,
    verify: (pin: string) => ipcRenderer.invoke(CH.lockVerify, pin) as Promise<VerifyResult>,
    lockNow: () => ipcRenderer.invoke(CH.lockNow) as Promise<void>,
    setTouchId: (on: boolean) => ipcRenderer.invoke(CH.lockSetTouchId, on) as Promise<boolean>,
    unlockWithTouchId: () => ipcRenderer.invoke(CH.lockTouchId) as Promise<boolean>,
    onLock: (cb: () => void) => listen(CH.lockEvent, cb),
  },
  notify: {
    show: (n: OsNotice) => ipcRenderer.invoke(CH.notifyShow, n) as Promise<void>,
    onOpen: (cb: (id: string) => void) => listen(CH.notifyOpen, cb),
  },
});
