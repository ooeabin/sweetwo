import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import type { DesktopBridge } from '@sweetwo/app';
import { parseDeepLink } from '@sweetwo/core';
import {
  authEvents,
  cancelLogin,
  getAccessToken,
  listenAppUrls,
  reopenLogin,
  signOut,
  startLogin,
  watchBrowserClosed,
} from './auth';
import { emitter } from './events';
import {
  pushOpens,
  pushReceives,
  pushStatus,
  pushToken,
  requestPush,
  startPush,
  takePendingOpen,
} from './push';
import {
  clearPinVerified,
  lockEvents,
  lockNow,
  lockStatus,
  setAutoLock,
  setBiometric,
  setPin,
  startAutoLock,
  unlockWithBiometric,
  verifyPin,
} from './lock';

// 모바일 브리지(window.sweetwo). 모양은 packages/app/src/platform.ts DesktopBridge와 같음(위젯·OS 알림 없음).
// 웹뷰에는 access token만. refresh token, code_verifier, 로그인 콜백 code는 이 파일 밖(웹뷰 화면 코드)에서 못 봄.
const invites = emitter<string>();
const navigates = emitter<string>();
// 앱이 화면을 그리기 전에 들어온 링크(처음 실행)는 받는 쪽이 생길 때 넘김
let pendingInvite: string | null = null;
let pendingPath: string | null = null;

export async function installBridge(): Promise<'ios' | 'android'> {
  const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
  const info = await CapApp.getInfo().catch(() => ({ version: '0.0.0' }));
  listenAppUrls((raw) => {
    const link = parseDeepLink(raw);
    if (link?.kind === 'invite') {
      pendingInvite = link.code;
      invites.emit(link.code);
    } else if (link?.kind === 'open') {
      pendingPath = link.path;
      navigates.emit(link.path);
    }
  });
  watchBrowserClosed();
  startPush();
  await startAutoLock();

  const bridge: DesktopBridge = {
    platform,
    version: Capacitor.getPlatform(),
    appVersion: info.version,
    onInvite: (cb) => {
      if (pendingInvite) {
        cb(pendingInvite);
        pendingInvite = null;
      }
      return invites.on(cb);
    },
    auth: {
      start: (p) => startLogin(p),
      reopen: () => reopenLogin(),
      cancel: () => cancelLogin(),
      getAccessToken: () => getAccessToken(),
      signOut: () => signOut('user'),
      onEvent: (cb) => authEvents.on(cb),
    },
    lock: {
      status: () => lockStatus(),
      setPin: (pin) => setPin(pin),
      verify: (pin) => verifyPin(pin),
      lockNow: () => lockNow(),
      setTouchId: (on) => setBiometric(on),
      unlockWithTouchId: () => unlockWithBiometric(),
      clear: () => clearPinVerified(),
      setAutoLock: (min) => setAutoLock(min),
      onLock: (cb) => lockEvents.on(() => cb()),
    },
    onNavigate: (cb) => {
      if (pendingPath) {
        cb(pendingPath);
        pendingPath = null;
      }
      return navigates.on(cb);
    },
    push: {
      status: () => pushStatus(),
      request: () => requestPush(),
      token: () => pushToken(),
      onOpen: (cb) => {
        const p = takePendingOpen();
        if (p) cb(p);
        return pushOpens.on(cb);
      },
      onReceive: (cb) => pushReceives.on(cb),
    },
    openUrl: async (url) => {
      // 웹사이트(다운로드·약관)만 앱 안 브라우저로
      if (!/^https:\/\/(www\.)?sweetwo\.kr(\/|$)/.test(url)) return;
      await Browser.open({ url });
    },
  };
  window.sweetwo = bridge;
  return platform;
}
