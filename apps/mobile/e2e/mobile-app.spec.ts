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
        // 오프라인 캐시: 다시 불러와도 남게 localStorage에(실제 앱은 Keychain 키 + 암호 파일)
        cache: {
          load: async () => localStorage.getItem('e2e-cache'),
          save: async (t: string) => (localStorage.setItem('e2e-cache', t), true),
          clear: async () => {
            localStorage.removeItem('e2e-cache');
            localStorage.setItem('e2e-cache-cleared', '1');
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
  await page.getByRole('button', { name: '카카오로 3초 만에 로그인' }).click();
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
  // 앱 기기 기록(AD-16 최소 지원 버전 미만 기기 수)
  await expect.poll(() => db.rpc).toContain('note_device');
  const push = page.getByRole('switch', { name: /^푸시 알림/ }).first();
  await expect(push).not.toBeChecked();
  await push.click();
  await expect.poll(async () => (await fake(page)).asked).toBe(1);
  await expect
    .poll(() => db.rpc.filter((x) => x === 'register_push_device').length)
    .toBeGreaterThan(0);
  // 푸시를 눌러 들어옴 → 그 알림 화면
  await page.evaluate(() =>
    (window as unknown as { __fake: Fake }).__fake.openCb?.({ id: 'nope', target: '/salary' }),
  );
  await expect(page).toHaveURL(/\/salary$/);
});

test('앱 정보(S-19): 업데이트는 스토어가 해서 ‘업데이트 확인’ 줄이 없음, 합류한 사람 홈에 PC 안내 띠 없음(ADR 0008)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  if (db.space) db.space.created_by = 'starter-other';
  await fakeIosBridge(page, true);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await expect(page.getByText('PC에서도 같은 계정으로 쓸 수 있어요')).toHaveCount(0);
  await page.goto('/settings/about');
  await expect(page.getByRole('button', { name: '새 기능 보기' })).toBeVisible();
  await expect(page.getByRole('button', { name: /업데이트 확인/ })).toHaveCount(0);
  await axe(page);
});

test('오프라인 조회(30 동기화 4장): 받은 화면 데이터를 기기에 두고, 인터넷이 끊겨도 홈을 보여 줌 + “오프라인”', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await fakeIosBridge(page, true);
  await page.goto('/');
  await expect(page.locator('.hg-hubsave')).toContainText('내 집 마련');
  // 홈이 쓰는 데이터(저금 항목, 체크리스트)가 모두 기기에 들어간 뒤
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const c = localStorage.getItem('e2e-cache') ?? '';
          return c.includes('내 집 마련') && c.includes('pay_checklist');
        }),
      { timeout: 15_000 },
    )
    .toBe(true);
  // 마지막으로 받은 것까지 저장되게 한 번 더 기다림(3초 모아서 저장)
  await page.waitForTimeout(3500);
  // 서버에 닿지 않음
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.route('**/rest/v1/**', (r) => r.abort('internetdisconnected'));
  await page.route('**/auth/v1/**', (r) => r.abort('internetdisconnected'));
  // 인터넷 없음으로 다시 켬(개발 서버는 닿아야 해서 브라우저 오프라인 대신 onLine만 끔)
  await page.addInitScript(() =>
    Object.defineProperty(Navigator.prototype, 'onLine', { get: () => false }),
  );
  await page.reload();
  await expect(page.locator('.hg-hubsave')).toContainText('내 집 마련');
  await expect(page.getByRole('status').filter({ hasText: '오프라인' })).toContainText(
    /마지막 저장 10월 7일 \d{2}:\d{2}/,
  );
});

test('우리 둘 공간이 바뀌면(연결 해제 확정 등) 기기에 둔 예전 공간 데이터를 지움(31 보안·개인정보 4장)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await fakeIosBridge(page, true);
  await page.goto('/');
  await expect(page.locator('.hg-hubsave')).toContainText('내 집 마련');
  await expect
    .poll(
      () => page.evaluate(() => (localStorage.getItem('e2e-cache') ?? '').includes('내 집 마련')),
      {
        timeout: 10_000,
      },
    )
    .toBe(true);
  // 서버에서 공간이 바뀜(예전 저금 항목은 더 이상 안 보임)
  db.me.space_id = 'space-2';
  if (db.space) db.space.id = 'space-2';
  db.goals.splice(0, db.goals.length);
  await page.reload();
  await expect
    .poll(
      () => page.evaluate(() => (localStorage.getItem('e2e-cache') ?? '').includes('내 집 마련')),
      {
        timeout: 10_000,
      },
    )
    .toBe(false);
});

// QA 11구간(2026-11-12): 휴대폰 알림 권한, S-18 본인 확인
test('S-14 휴대폰 알림이 꺼져 있으면 “휴대폰 설정에서 알림을 켜 주세요” + ‘설정 열기’, 푸시·묶음은 꺼짐으로(S11-04)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  db.me.noti_prefs = { push: true };
  await fakeIosBridge(page, true);
  await page.addInitScript(() => {
    const w = window as unknown as {
      __fake: Fake;
      sweetwo: { push: Record<string, unknown> };
    };
    w.__fake.push = 'denied';
    w.sweetwo.push.request = async () => false;
    w.sweetwo.push.openSettings = async () => void w.__fake.opened.push('os-settings');
  });
  await page.goto('/settings/notifications');
  await expect(page.getByText('휴대폰 설정에서 알림을 켜 주세요')).toBeVisible();
  await expect(page.getByRole('switch', { name: /^푸시 알림/ }).first()).not.toBeChecked();
  await expect(page.getByRole('switch', { name: /^월급 체크리스트/ })).not.toBeChecked();
  await axe(page);
  await page.locator('main').getByRole('button', { name: '설정 열기' }).click();
  await expect.poll(async () => (await fake(page)).opened).toContain('os-settings');
});

test('S-18 앱 잠금이 꺼진 모바일 앱도 내보내기 전 가입 소셜로 다시 로그인(S11-02)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await fakeIosBridge(page, true);
  await page.addInitScript(() => {
    (window as unknown as { __fake: Fake }).__fake.pinSet = null;
    localStorage.setItem('sweetwo.last-provider', 'kakao');
    localStorage.setItem('sweetwo.pin-asked', '1');
  });
  await page.goto('/settings/data');
  await page.getByRole('button', { name: '내보내기', exact: true }).click();
  await expect.poll(async () => (await fake(page)).started).toEqual(['kakao']);
  // 다시 로그인하고 돌아오면 이어서 내보냄
  expect(await page.evaluate(() => sessionStorage.getItem('sweetwo.return-to'))).toBe(
    '/settings/data?export=joint&format=csv',
  );
});

test('S-18 PIN을 5번 틀리면 A-02 + 안내(S-15와 같음, S11-07)', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await fakeIosBridge(page, true);
  await page.addInitScript(() => {
    const w = window as unknown as { sweetwo: { lock: Record<string, unknown> } };
    w.sweetwo.lock.verify = async () => ({ ok: false, failed: 5, signedOut: true });
  });
  await page.goto('/settings/data');
  await page.getByRole('button', { name: '내보내기', exact: true }).click();
  await page.getByLabel('PIN을 입력해 주세요').fill('111111');
  await page.getByRole('button', { name: '확인' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('PIN을 5번 틀려서 다시 로그인해 주세요')).toBeVisible();
});
