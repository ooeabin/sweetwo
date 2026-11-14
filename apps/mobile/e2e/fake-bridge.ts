import type { Page } from '@playwright/test';

// 흉내 모바일 브리지(window.sweetwo, iOS). 모양 = packages/app platform.ts AppBridge.
// 1구간 검토(2026-11-10) 흐름용: 잠금(잠김, PIN 확인, 5번 틀림), PIN 지우기(lock.reset), 초대 링크(onInvite),
// Android 하드웨어 뒤로(onBack), 로그인 결과(onEvent), 기기 캐시. 상태는 window.__fb에.
export type FakeState = {
  token: string | null;
  pin: string | null;
  locked: boolean;
  failed: number;
  resets: number;
  signOuts: number;
  started: string[];
  opened: string[];
  pendingLogin: boolean;
  invite: string | null;
  cacheCleared: number;
  /** 글 공유(shareText)로 보낸 것 */
  shared: { text: string; url?: string }[];
  /** 보상형 광고를 부른 횟수(ads.rewarded) */
  ads: number;
  /** 푸시 허용 창을 띄운 횟수(O-55·P-11) */
  pushRequests: number;
  /** 홈 화면 위젯에 넘긴 값(widget.update, 26 v2.2). 마지막 것이 끝 */
  widget: unknown[];
};
export interface FakeOptions {
  signedIn?: boolean;
  pin?: string | null;
  locked?: boolean;
  /** 처음 실행 때 들어온 초대 링크(구독하면 넘김) */
  invite?: string;
  /** 로그인 토큰을 끝없이 기다림(A-01 ‘연결이 느려요’) */
  hangToken?: boolean;
  /** 이 기기에 로그인 요청이 없음(A-03 새로 고침) */
  noPendingLogin?: boolean;
  /** 생체 인증: 'face'(iPhone Face ID), 'fingerprint'(Android). on이면 이미 켜 둠 */
  bio?: { kind: 'face' | 'fingerprint'; on?: boolean };
  /** 로그인 창 열기 결과: 'fail' = 못 엶, 'hang' = 응답 없음(누른 버튼만 도는 원) */
  start?: 'ok' | 'fail' | 'hang';
  /** 웹사이트 열기 실패(A-01 업데이트) */
  openFail?: boolean;
  /** 기기 보안 저장소 읽기 오류(A-01 실행 판단 오류) */
  tokenError?: boolean;
  /** PIN 저장 실패(A-06) */
  setPinFails?: boolean;
  /**
   * 보상형 광고(ads.rewarded, F-08 ‘새로 확인하기’): 결과를 정함. 'throw' = 브리지 오류(앱은 failed로 셈).
   * 없으면 브리지에 ads가 없음(광고 SDK 없는 앱, 광고 없이 바로)
   */
  ad?: 'rewarded' | 'closed' | 'failed' | 'throw';
  /** 푸시: 'prompt'면 아직 안 물음, 허용 창에서 grant대로(기본 거절된 기기) */
  push?: { status: 'prompt' | 'denied' | 'granted'; grant?: boolean };
  /** 첫 실행 초대 코드(설치 리퍼러·클립보드, 2026-11-13 O-01 시트) */
  inviteCode?: { code: string; source: 'clipboard' | 'referrer' };
  /** 홈 화면에 놓인 위젯(widget.installed, widget_added 분석, 2026-11-13 PR 14) */
  widgets?: { widget: 'wg01' | 'wg04'; size: 'small' | 'medium' }[];
}

export async function fakeBridge(page: Page, o: FakeOptions = {}) {
  await page.addInitScript((o: FakeOptions) => {
    type Cb<T> = ((v: T) => void) | null;
    const f: FakeState = {
      token: o.signedIn ? 'e2e-access-token' : null,
      pin: o.pin === undefined ? (o.signedIn ? '258036' : null) : o.pin,
      locked: !!o.locked,
      failed: 0,
      resets: 0,
      signOuts: 0,
      started: [],
      opened: [],
      pendingLogin: !o.noPendingLogin,
      invite: o.invite ?? null,
      cacheCleared: 0,
      shared: [],
      ads: 0,
      pushRequests: 0,
      widget: [],
    };
    const cbs: {
      auth: Set<(e: unknown) => void>;
      lock: Cb<void>;
      invite: Cb<string>;
      back: Set<() => boolean>;
      navigate: Cb<[string, unknown]>;
    } = { auth: new Set(), lock: null, invite: null, back: new Set(), navigate: null };
    const off = () => () => undefined;
    Object.assign(window, {
      __fb: f,
      __fbcb: cbs,
      sweetwo: {
        platform: 'ios',
        version: 'ios',
        appVersion: '1.0.0',
        onInvite: (cb: (c: string) => void) => {
          cbs.invite = cb;
          if (f.invite) {
            cb(f.invite);
            f.invite = null;
          }
          return () => (cbs.invite = null);
        },
        // 앱 링크·위젯으로 화면 열기: 테스트가 __fbcb.navigate([path, from])를 부름
        onNavigate: (cb: (path: string, from?: unknown) => void) => {
          cbs.navigate = ([p, from]) => cb(p, from);
          return () => (cbs.navigate = null);
        },
        onBack: (cb: () => boolean) => {
          cbs.back.add(cb);
          return () => void cbs.back.delete(cb);
        },
        ...(o.ad
          ? {
              ads: {
                rewarded: async () => {
                  f.ads++;
                  if (o.ad === 'throw') throw new Error('ad');
                  return o.ad;
                },
              },
            }
          : {}),
        shareText: async (t: { text: string; url?: string }) => {
          f.shared.push(t);
          return 'shared';
        },
        openUrl: async (u: string) => {
          if (o.openFail) throw new Error('open');
          f.opened.push(u);
        },
        widget: {
          update: async (d: unknown) => void f.widget.push(d),
          installed: async () => o.widgets ?? [],
        },
        ...(o.inviteCode ? { inviteCode: { firstRun: async () => o.inviteCode } } : {}),
        push: {
          status: async () => o.push?.status ?? 'denied',
          request: async () => {
            f.pushRequests++;
            return !!o.push?.grant;
          },
          token: async () => (o.push?.grant ? 'e2e-push-token' : null),
          onOpen: off,
          onReceive: off,
        },
        auth: {
          start: async (p: string) => {
            f.started.push(p);
            if (o.start === 'hang') return new Promise(() => undefined);
            if (o.start === 'fail') return { ok: false, reason: 'browser_open_failed' };
            f.pendingLogin = true;
            return { ok: true };
          },
          reopen: async () => ({ ok: true }),
          cancel: async () => void (f.pendingLogin = false),
          pending: async () => f.pendingLogin,
          getAccessToken: () =>
            o.tokenError
              ? Promise.reject(new Error('keychain'))
              : o.hangToken
                ? new Promise(() => undefined)
                : Promise.resolve(f.token),
          signOut: async () => {
            f.token = null;
            f.signOuts++;
          },
          onEvent: (cb: (ev: unknown) => void) => {
            cbs.auth.add(cb);
            return () => void cbs.auth.delete(cb);
          },
        },
        cache: {
          load: async () => localStorage.getItem('e2e-cache'),
          save: async (t: string) => (localStorage.setItem('e2e-cache', t), true),
          clear: async () => {
            localStorage.removeItem('e2e-cache');
            f.cacheCleared++;
          },
        },
        lock: {
          status: async () => ({
            hasPin: f.pin !== null,
            locked: f.pin !== null && f.locked,
            touchIdAvailable: !!o.bio,
            touchIdEnabled: !!o.bio?.on,
            bioKind: o.bio?.kind ?? 'face',
            autoLockMin: 5,
          }),
          setPin: async (pin: string) => {
            if (o.setPinFails) return false;
            f.pin = pin;
            f.locked = false;
            return true;
          },
          verify: async (pin: string) => {
            if (pin === f.pin) {
              f.locked = false;
              f.failed = 0;
              return { ok: true };
            }
            f.failed++;
            if (f.failed >= 5) {
              f.pin = null;
              f.token = null;
              return { ok: false, failed: f.failed, signedOut: true };
            }
            return { ok: false, failed: f.failed, signedOut: false };
          },
          lockNow: async () => {
            if (!f.pin) return;
            f.locked = true;
            cbs.lock?.();
          },
          setTouchId: async () => false,
          unlockWithTouchId: async () => false,
          clear: async () => true,
          reset: async () => {
            f.pin = null;
            f.locked = false;
            f.resets++;
          },
          setAutoLock: async () => true,
          onLock: (cb: () => void) => {
            cbs.lock = cb;
            return () => undefined;
          },
        },
      },
    });
  }, o);
}

export const fb = (page: Page) =>
  page.evaluate(() => (window as unknown as { __fb: FakeState }).__fb);

/** 브리지가 앱에 이벤트를 보냄(로그인 결과, 로그아웃) */
export const emitAuth = (page: Page, ev: Record<string, unknown>, token?: string) =>
  page.evaluate(
    ({ ev, token }) => {
      const w = window as unknown as {
        __fb: FakeState;
        __fbcb: { auth: Set<(e: unknown) => void> };
      };
      if (token !== undefined) w.__fb.token = token;
      if (ev.type === 'signed_out') w.__fb.token = null;
      [...w.__fbcb.auth].forEach((cb) => cb(ev));
    },
    { ev, token },
  );

/** 실행 중에 초대 링크가 들어옴 */
export const emitInvite = (page: Page, code: string) =>
  page.evaluate((code) => {
    (window as unknown as { __fbcb: { invite: ((c: string) => void) | null } }).__fbcb.invite?.(
      code,
    );
  }, code);

/** Android 하드웨어 뒤로. 앱이 받았으면 true */
export const pressHardwareBack = (page: Page) =>
  page.evaluate(() =>
    [...(window as unknown as { __fbcb: { back: Set<() => boolean> } }).__fbcb.back]
      .reverse()
      .some((f) => f()),
  );
