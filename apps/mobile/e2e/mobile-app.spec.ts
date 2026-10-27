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
  // 앱 기기 기록(AD-16 최소 지원 버전 미만 기기 수)
  await expect.poll(() => db.rpc).toContain('note_device');
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

test('모바일로 합류한 사람의 첫 홈: “PC에서도” 띠 1회 → 링크 메일 보내기', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  if (db.space) db.space.created_by = 'starter-other';
  await fakeIosBridge(page, true);
  await page.goto('/');
  const band = page.getByText('PC에서도 같은 계정으로 쓸 수 있어요');
  await expect(band).toBeVisible();
  await page.getByRole('button', { name: '데스크톱 앱 받기 링크 보내기' }).click();
  await expect(page.getByText('알림 이메일로 링크를 보냈어요')).toBeVisible();
  expect(db.rpc).toContain('send_desktop_link');
  await expect(band).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await expect(band).toHaveCount(0);
});

test('앱 정보(S-19): 업데이트 확인 → 받는 중 → 다 받으면 “다시 시작”(자동 업데이트가 있는 앱)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await fakeIosBridge(page, true);
  // 데스크톱 자동 업데이트 브리지 흉내(main updater.ts가 보내는 상태)
  await page.addInitScript(() => {
    const w = window as unknown as {
      sweetwo: Record<string, unknown>;
      __update: { cb: ((s: unknown) => void) | null; installed: number };
    };
    w.__update = { cb: null, installed: 0 };
    w.sweetwo.update = {
      state: async () => ({ status: 'latest' }),
      check: async () => {
        setTimeout(() => w.__update.cb?.({ status: 'ready', version: '1.2.0' }), 50);
        return { status: 'downloading', version: '1.2.0', percent: 42 };
      },
      install: async () => void w.__update.installed++,
      onState: (cb: (s: unknown) => void) => {
        w.__update.cb = cb;
        return () => undefined;
      },
    };
  });
  await page.goto('/settings/about');
  const row = page.getByRole('button', { name: /업데이트 확인/ });
  await expect(row).toContainText('최신 버전이에요');
  await row.click();
  await expect(page.getByText('1.2.0 버전을 받았어요. 다시 시작하면 바뀌어요')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '다시 시작' }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __update: { installed: number } }).__update.installed,
      ),
    )
    .toBe(1);
});

test('오프라인 조회(30 동기화 4장): 받은 화면 데이터를 기기에 두고, 인터넷이 끊겨도 홈을 보여 줌 + “오프라인”', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await fakeIosBridge(page, true);
  await page.goto('/');
  await expect(page.getByRole('region', { name: '목표' })).toContainText('내 집 마련');
  // 홈이 쓰는 데이터(목표, 체크리스트)가 모두 기기에 들어간 뒤
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
  await expect(page.getByRole('region', { name: '목표' })).toContainText('내 집 마련');
  await expect(page.getByRole('status').filter({ hasText: '오프라인' })).toContainText(
    /마지막 저장 10월 7일 \d{2}:\d{2}/,
  );
});

test('부부 공간이 바뀌면(연결 해제 확정 등) 기기에 둔 예전 공간 데이터를 지움(31 보안·개인정보 4장)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await fakeIosBridge(page, true);
  await page.goto('/');
  await expect(page.getByRole('region', { name: '목표' })).toContainText('내 집 마련');
  await expect
    .poll(
      () => page.evaluate(() => (localStorage.getItem('e2e-cache') ?? '').includes('내 집 마련')),
      {
        timeout: 10_000,
      },
    )
    .toBe(true);
  // 서버에서 공간이 바뀜(예전 목표는 더 이상 안 보임)
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
