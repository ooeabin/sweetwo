import { test, expect, type Page } from '@playwright/test';
import { axe } from './axe';
import { mockOnboarding } from './onboarding-mock';
import { seed } from './seed-home';
import { fakeJwt, chanwoo, mockSupabase } from './supabase-mock';

const NOW = new Date('2026-10-07T10:00:00+09:00');

// 모바일 앱(iOS) 흐름을 흉내 브리지로 확인(네이티브 부분은 기기 빌드에서). 브리지 모양 = packages/app platform.ts
type Fake = {
  started: string[];
  opened: string[];
  token: string | null;
  authCb: ((ev: unknown) => void) | null;
  pinSet: string | null;
  bioOn: boolean | null;
  push: 'granted' | 'denied' | 'prompt';
  asked: number;
  openCb: ((n: { id: string; target: string }) => void) | null;
};
async function fakeIosBridge(page: Page, signedIn = false) {
  await page.addInitScript((signed) => {
    const f: Fake = {
      started: [],
      opened: [],
      token: null,
      authCb: null,
      pinSet: null,
      bioOn: null,
      push: 'prompt',
      asked: 0,
      openCb: null,
    };
    if (signed) {
      f.token = 'e2e-access-token';
      f.pinSet = '258036';
    }
    const off = () => () => undefined;
    Object.assign(window, {
      __fake: f,
      sweetwo: {
        platform: 'ios',
        version: 'ios',
        appVersion: '1.0.0',
        onInvite: off,
        onNavigate: off,
        openUrl: async (u: string) => void f.opened.push(u),
        push: {
          status: async () => f.push,
          request: async () => {
            f.asked++;
            f.push = 'granted';
            return true;
          },
          token: async () => (f.push === 'granted' ? 'fcm-e2e-token-0001' : null),
          onOpen: (cb: (n: { id: string; target: string }) => void) => {
            f.openCb = cb;
            return () => undefined;
          },
          onReceive: off,
        },
        auth: {
          start: async (p: string) => {
            f.started.push(p);
            return { ok: true };
          },
          reopen: async () => ({ ok: true }),
          cancel: async () => undefined,
          getAccessToken: async () => f.token,
          signOut: async () => void (f.token = null),
          onEvent: (cb: (ev: unknown) => void) => {
            f.authCb = cb;
            return () => undefined;
          },
        },
        lock: {
          status: async () => ({
            hasPin: f.pinSet !== null,
            locked: false,
            touchIdAvailable: true,
            touchIdEnabled: !!f.bioOn,
            bioKind: 'face',
            autoLockMin: 5,
          }),
          setPin: async (pin: string) => {
            f.pinSet = pin;
            return true;
          },
          verify: async () => ({ ok: true }),
          lockNow: async () => undefined,
          setTouchId: async (on: boolean) => {
            f.bioOn = on;
            return true;
          },
          unlockWithTouchId: async () => true,
          clear: async () => true,
          setAutoLock: async () => true,
          onLock: off,
        },
      },
    });
  }, signedIn);
}
const fake = (page: Page) => page.evaluate(() => (window as unknown as { __fake: Fake }).__fake);

test('모바일(iOS): 최소 버전 미만이면 업데이트 → 웹사이트 다운로드(스토어 안내)', async ({
  page,
}) => {
  await fakeIosBridge(page);
  await mockSupabase(page, { minVersionIos: '9.0.0' });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '새 버전으로 업데이트해 주세요' })).toBeVisible();
  await page.getByRole('button', { name: '지금 업데이트' }).click();
  await expect.poll(async () => (await fake(page)).opened).toEqual(['https://sweetwo.kr/download']);
});

test('모바일(iOS): 로그인 창 → 돌아오면 다음 화면, PIN 뒤 “Face ID로도 풀까요?”', async ({
  page,
}) => {
  await fakeIosBridge(page);
  await mockSupabase(page, {
    loginState: {
      state: 'existing',
      provider: 'kakao',
      onboarding_done: true,
      onboarding_step: null,
    },
  });
  await page.goto('/login');
  await page.getByRole('button', { name: '카카오로 3초 만에 시작하기' }).click();
  await expect.poll(async () => (await fake(page)).started).toEqual(['kakao']);
  await expect(page).toHaveURL(/\/login\/wait$/);
  // 로그인 창이 닫히며 결과가 옴(네이티브 브리지 → 앱)
  await page.evaluate((jwt) => {
    const f = (window as unknown as { __fake: Fake }).__fake;
    f.token = jwt;
    f.authCb?.({ type: 'signed_in', provider: 'kakao', waitSec: 3, reopened: false });
  }, fakeJwt(chanwoo.id));
  await expect(
    page.getByRole('heading', { name: '앱을 열 때 쓸 PIN 6자리를 정해 주세요' }),
  ).toBeVisible();
  await page.keyboard.type('258036');
  await expect(page.getByRole('heading', { name: '한 번 더 입력해 주세요' })).toBeVisible();
  await page.keyboard.type('258036');
  await expect(page.getByRole('heading', { name: 'Face ID로도 풀까요?' })).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: 'Face ID 켜기' }).click();
  await expect.poll(async () => (await fake(page)).bioOn).toBe(true);
});

test('모바일 푸시(S-14): 켜면 OS 허용 → 기기 등록, 푸시를 누르면 그 화면', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  db.me.noti_prefs = { push: false };
  await fakeIosBridge(page, true);
  await page.goto('/settings/notifications');
  const push = page.getByRole('switch', { name: '푸시 알림' }).first();
  await expect(push).not.toBeChecked();
  await push.click();
  await expect.poll(async () => (await fake(page)).asked).toBe(1);
  await expect
    .poll(() => db.rpc.filter((x) => x === 'register_push_device').length)
    .toBeGreaterThan(0);
  // 푸시를 눌러 들어옴 → 그 알림 화면
  await page.evaluate(() =>
    (window as unknown as { __fake: Fake }).__fake.openCb?.({ id: 'nope', target: '/goals' }),
  );
  await expect(page).toHaveURL(/\/goals$/);
});
