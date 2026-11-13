import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { AppBridge } from '@sweetwo/app';
import { parseDeepLink } from '@sweetwo/core';
import {
  authEvents,
  cancelLogin,
  getAccessToken,
  listenAppUrls,
  loginPending,
  reopenLogin,
  signOut,
  startLogin,
  watchBrowserClosed,
} from './auth';
import { emitter } from './events';
import { showRewarded } from './ads';
import { firstRunInviteCode } from './invite-code';
import { offlineCache } from './offline-cache';
import {
  pushOpens,
  pushReceives,
  pushStatus,
  pushToken,
  openPushSettings,
  requestPush,
  startPush,
  takePendingOpen,
} from './push';
import {
  clearPin,
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
import { writeWidget } from './widget';

// 모바일 브리지(window.sweetwo). 모양은 packages/app/src/platform.ts AppBridge.
// 웹뷰에는 access token만. refresh token, code_verifier, 로그인 콜백 code는 이 파일 밖(웹뷰 화면 코드)에서 못 봄.
const invites = emitter<string>();
const navigates = emitter<string>();
// 앱이 화면을 그리기 전에 들어온 링크(처음 실행)는 받는 쪽이 생길 때 넘김
let pendingInvite: string | null = null;
let pendingPath: string | null = null;
const backs = new Set<() => boolean>();
let backBound = false;

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

  const bridge: AppBridge = {
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
      pending: async () => loginPending(),
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
      // ‘PIN을 잊었어요’(곧 로그아웃), 다른 계정 로그인 때만 앱이 부름(platform.ts AppBridge.lock.reset)
      reset: () => clearPin(),
      setAutoLock: (min) => setAutoLock(min),
      onLock: (cb) => lockEvents.on(() => cb()),
    },
    // 안드로이드 하드웨어 뒤로(2026-11-09): 앱(홈 밖 메뉴 → 홈, 열린 메뉴 서랍 닫기)이 먼저, 아니면 웹뷰 뒤로 / 앱 닫기
    onBack: (cb) => {
      backs.add(cb);
      if (!backBound) {
        backBound = true;
        void CapApp.addListener('backButton', ({ canGoBack }) => {
          if ([...backs].reverse().some((f) => f())) return;
          if (canGoBack) window.history.back();
          else void CapApp.exitApp();
        });
      }
      return () => void backs.delete(cb);
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
      openSettings: () => openPushSettings(),
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
    cache: {
      load: () => offlineCache.load(),
      save: (text) => offlineCache.save(text),
      clear: () => offlineCache.clear(),
    },
    // 내보내기(S-18): 앱 캐시에 쓰고 공유 창으로. 공유가 끝나면 캐시 파일은 지움
    saveFile: async (f) => {
      const name = f.name.replace(/[^\w.-]/g, '_');
      const w = await Filesystem.writeFile({
        path: name,
        data: f.base64,
        directory: Directory.Cache,
      });
      try {
        await Share.share({ title: name, files: [w.uri] });
        return 'saved';
      } catch {
        return 'cancelled';
      } finally {
        await Filesystem.deleteFile({ path: name, directory: Directory.Cache }).catch(
          () => undefined,
        );
      }
    },
    // 이미지 공유(W-01 영수증 ‘공유하기’, 2026-11-09): 앱 캐시에 PNG를 쓰고 OS 공유 창. 끝나면 캐시 파일은 지움
    shareImage: async (f) => {
      const name = f.name.replace(/[^\w.-]/g, '_');
      const w = await Filesystem.writeFile({
        path: name,
        data: f.base64,
        directory: Directory.Cache,
      });
      try {
        await Share.share({ files: [w.uri] });
        return 'shared';
      } catch {
        return 'cancelled';
      } finally {
        await Filesystem.deleteFile({ path: name, directory: Directory.Cache }).catch(
          () => undefined,
        );
      }
    },
    // 글 공유(O-07 초대 코드, 2026-11-10): Android WebView에는 navigator.share가 없어 @capacitor/share로
    shareText: async (t) => {
      try {
        await Share.share({ text: t.text, url: t.url, dialogTitle: t.text });
        return 'shared';
      } catch {
        return 'cancelled';
      }
    },
    // 보상형 광고(F-08 ‘새로 확인하기’, ads.ts): 비맞춤형(npa=1), ATT 묻지 않음
    ads: { rewarded: () => showRewarded() },
    // 첫 실행 초대 코드(O-01, invite-code.ts): Android 설치 리퍼러, iOS 클립보드 1회
    inviteCode: { firstRun: () => firstRunInviteCode() },
    // 홈 화면 위젯(26 WG-01·WG-04, widget.ts): 금액 없는 글만
    widget: { update: (d) => writeWidget(d) },
  };
  window.sweetwo = bridge;
  return platform;
}
