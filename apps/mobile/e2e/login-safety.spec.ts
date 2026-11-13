import { test, expect, type Page } from '@playwright/test';
import { axe } from './axe';
import { emitAuth, emitInvite, fakeBridge, fb, pressHardwareBack } from './fake-bridge';
import {
  asReturningFromProvider,
  chanwoo,
  fakeJwt,
  mockOnboarding,
  mockSupabase,
  SB,
  seed,
} from './mocks';

// 1구간 검토(2026-11-10) 고친 흐름: 초대 링크, PIN 잊음, 로그아웃 뒤 데이터 비우기, 잠금 뒤 화면, 가입 취소,
// A-07 막다른 화면, A-01 느린 연결, 보기만 모드, 약관 보기, 약한 PIN, 소셜 버튼, 태블릿 배치.
const NOW = new Date('2026-10-07T10:00:00+09:00');

const signedInHome = async (page: Page, o: Parameters<typeof fakeBridge>[1] = {}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await fakeBridge(page, { signedIn: true, ...o });
  return db;
};
const lockHeading = (page: Page) => page.getByRole('heading', { name: 'PIN을 입력해 주세요' });
const login = async (page: Page, sub = chanwoo.id) => {
  await page.getByRole('button', { name: '카카오로 3초 만에 로그인', exact: true }).click();
  await expect(page).toHaveURL(/\/login\/wait$/);
  await emitAuth(
    page,
    { type: 'signed_in', provider: 'kakao', waitSec: 2, reopened: false },
    fakeJwt(sub),
  );
};

test('초대 링크(S1-01): 앱이 링크로 열리면 A-07, 실행 중에 들어온 링크도', async ({ page }) => {
  await signedInHome(page, { invite: 'K7M2QX', pin: null });
  await page.addInitScript(() => localStorage.setItem('sweetwo.pin-asked', '1'));
  await page.goto('/');
  await expect(page).toHaveURL(/\/i\/K7M2QX$/);
  await expect(page.getByRole('heading', { name: '찬우님이 초대했어요' })).toBeVisible();
  await emitInvite(page, 'abcdef');
  await expect(page).toHaveURL(/\/i\/abcdef$/);
  await expect(page.getByText('ABCDEF', { exact: true })).toBeVisible();
});

test('초대 링크(S1-01): 잠겨 있으면 잠금을 푼 뒤 A-07', async ({ page }) => {
  await signedInHome(page, { invite: 'K7M2QX', locked: true });
  await page.goto('/');
  await expect(lockHeading(page)).toBeVisible();
  await expect(page.getByRole('heading', { name: '찬우님이 초대했어요' })).toBeHidden();
  await page.keyboard.type('258036');
  await expect(page.getByRole('heading', { name: '찬우님이 초대했어요' })).toBeVisible();
  await expect(page).toHaveURL(/\/i\/K7M2QX$/);
});

test('잠금 뒤 화면(S1-05): 보이지 않고 Tab·화면 읽기가 닿지 않음', async ({ page }) => {
  await signedInHome(page, { locked: true });
  await page.goto('/');
  await expect(lockHeading(page)).toBeVisible();
  await expect(page.locator('.hg-together')).toBeHidden();
  for (let i = 0; i < 16; i++) {
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(
      () =>
        !!document.activeElement?.closest('[role="dialog"]') ||
        document.activeElement === document.body,
    );
    expect(inside).toBe(true);
  }
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1); // 잠금 제목만
  await page.keyboard.type('258036');
  await expect(page.locator('.hg-together')).toBeVisible();
});

test('PIN을 잊었어요(S1-02·S1-32): 확인 → PIN 지우고 로그아웃 → A-02 안내 → 로그인 → 새 PIN 정하기', async ({
  page,
}) => {
  await signedInHome(page, { locked: true });
  await page.goto('/');
  await page.getByRole('button', { name: 'PIN을 잊었어요' }).click();
  await expect(page.getByRole('heading', { name: 'PIN을 잊었나요?' })).toBeVisible();
  await expect(
    page.getByText('로그아웃하고 다시 로그인하면 새 PIN을 정할 수 있어요'),
  ).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '취소' }).click();
  await expect(page.getByRole('heading', { name: 'PIN을 잊었나요?' })).toBeHidden();
  expect((await fb(page)).resets).toBe(0);
  await page.getByRole('button', { name: 'PIN을 잊었어요' }).click();
  await page.getByRole('button', { name: '로그아웃할게요' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole('status').filter({ hasText: '다시 로그인하면 새 PIN을 정할 수 있어요' }),
  ).toBeVisible();
  expect(await fb(page)).toMatchObject({ resets: 1, pin: null, token: null });
  await login(page);
  // 2026-11-13 v2.2: 먼저 “앱 잠금을 켤까요?”(건너뛸 수 있음) → ‘켜기’
  await expect(page.getByRole('heading', { name: '앱 잠금을 켤까요?' })).toBeVisible();
  await page.getByRole('button', { name: '켜기' }).click();
  await expect(
    page.getByRole('heading', { name: '앱을 열 때 쓸 PIN 6자리를 정해 주세요' }),
  ).toBeVisible();
});

test('만료·다른 계정(S1-03·S1-13·S1-14): 이 기기 데이터를 비우고, 다른 계정은 앞 계정 화면·PIN을 보지 않음', async ({
  page,
}) => {
  const db = await signedInHome(page, { pin: null });
  await page.addInitScript(() => localStorage.setItem('sweetwo.pin-asked', '1'));
  await page.goto('/salary');
  await expect(page.getByText('내 집 마련').first()).toBeVisible();
  // 브리지가 세션을 버림(갱신 토큰 거절) → A-08, 같은 계정이면 돌아올 화면은 남김
  await emitAuth(page, { type: 'signed_out', reason: 'expired' });
  await expect(page).toHaveURL(/\/session-expired$/);
  await expect(page.getByText('로그인이 만료됐어요')).toBeVisible();
  expect((await fb(page)).cacheCleared).toBeGreaterThan(0);
  expect(await page.evaluate(() => sessionStorage.getItem('sweetwo.return-to'))).toBe('/salary');
  await page.getByRole('button', { name: '다른 계정으로 로그인' }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await fb(page)).resets).toBe(1);
  expect(
    await page.evaluate(() => [
      localStorage.getItem('sweetwo.last-provider'),
      sessionStorage.getItem('sweetwo.return-to'),
    ]),
  ).toEqual([null, null]);
  // 다른 계정(예빈): 저금이 없고, 서버 응답이 늦어도 앞 계정 저금이 잠깐이라도 보이지 않아야 함
  db.goals.splice(0, db.goals.length);
  await page.route(`${SB}/rest/v1/rpc/space_goals`, async (r) => {
    await new Promise((res) => setTimeout(res, 8000));
    await r.fallback();
  });
  await login(page, '22222222-2222-2222-2222-222222222222');
  // 2026-11-13 v2.2: 먼저 “앱 잠금을 켤까요?”(건너뛸 수 있음) → ‘켜기’
  await expect(page.getByRole('heading', { name: '앱 잠금을 켤까요?' })).toBeVisible();
  await page.getByRole('button', { name: '켜기' }).click();
  await expect(
    page.getByRole('heading', { name: '앱을 열 때 쓸 PIN 6자리를 정해 주세요' }),
  ).toBeVisible();
  await page.keyboard.type('135790');
  await page.keyboard.type('135790');
  await expect(page).toHaveURL(/\/$/);
  await page.waitForTimeout(1000);
  await expect(page.getByText('내 집 마련')).toHaveCount(0);
});

test('가입 취소(S1-11): A-04 뒤로, A-05 하드웨어 뒤로 = 로그아웃하고 A-02, 다시 실행해도 A-02', async ({
  page,
}) => {
  await mockSupabase(page, { loginState: { state: 'new', needs_email: true } });
  await asReturningFromProvider(page, 'kakao');
  await page.goto('/auth/callback?code=e2e-code');
  await expect(page.getByRole('heading', { name: '알림 받을 이메일을 알려 주세요' })).toBeVisible();
  // 좁은 창은 꺾쇠(뒤로), 넓은 창(마우스)은 아래 바 ‘이전’
  await page
    .getByRole('button', { name: /^(뒤로|이전)$/ })
    .locator('visible=true')
    .first()
    .click();
  await expect(page.getByRole('heading', { name: '같이 모으는 돈, 둘이 같이 봐요' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('sb-session'))).toBeNull();
});

test('가입 취소(S1-11): 앱 A-05 하드웨어 뒤로, 가입 안 끝낸 세션으로 다시 실행하면 A-02', async ({
  page,
}) => {
  await mockSupabase(page, { loginState: { state: 'new', needs_email: false } });
  await fakeBridge(page);
  await page.goto('/login');
  await login(page);
  await expect(page.getByRole('checkbox', { name: '모두 동의해요(선택 포함)' })).toBeVisible();
  expect(await pressHardwareBack(page)).toBe(true);
  await expect(page).toHaveURL(/\/login$/);
  expect((await fb(page)).signOuts).toBeGreaterThan(0);
});

test('가입 취소(S1-11): 가입을 끝내지 않은 세션으로 실행하면 A-04·A-05가 아니라 A-02', async ({
  page,
}) => {
  await mockSupabase(page, { loginState: { state: 'new', needs_email: true } });
  await fakeBridge(page, { signedIn: true, pin: null });
  await page.addInitScript(() => localStorage.setItem('sweetwo.started', '1'));
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  expect((await fb(page)).token).toBeNull();
});

test('A-07 합류 불가(S1-06·S1-27·S1-35): 막다른 화면 없이 코드 다시 입력, 처음으로. 형식이 아니면 서버에 묻지 않음', async ({
  page,
}) => {
  await mockSupabase(page);
  let asked = 0;
  await page.route(`${SB}/rest/v1/rpc/invite_preview`, (route) => {
    asked++;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ inviter_nickname: '찬우', status: 'expired' }]),
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  });
  await page.goto('/i/K7M2QX');
  await expect(
    page.getByRole('heading', { name: '초대가 만료됐어요. 새 코드를 요청해 주세요' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '합류하기' })).toHaveCount(0);
  await axe(page);
  await page.getByRole('button', { name: '코드 다시 입력하기' }).click();
  await expect(page).toHaveURL(/\/i$/);
  await page.goto('/i/K7M2QX');
  await page.getByRole('button', { name: '처음으로' }).click();
  await expect(page).toHaveURL(/\/login$/);
  const before = asked;
  await page.goto('/i/abc%3Cb%3E');
  await expect(page.getByRole('heading', { name: '코드를 다시 확인해 주세요' })).toBeVisible();
  await expect(page.locator('.hg-invite-code')).toHaveCount(0);
  expect(asked).toBe(before);
});

test('A-07 초대 정보를 못 불러옴(S1-07): 합류하기 대신 오류 + 다시 시도', async ({ page }) => {
  await mockSupabase(page);
  await page.route(`${SB}/rest/v1/rpc/invite_preview`, (route) =>
    route.fulfill({ status: 500, body: '{}', headers: { 'Access-Control-Allow-Origin': '*' } }),
  );
  await page.goto('/i/K7M2QX');
  await expect(page.getByRole('heading', { name: '잠시 문제가 생겼어요' })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole('button', { name: '합류하기' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '다시 시도' })).toBeVisible();
});

test('A-01 느린 연결(S1-08): 판단이 10초 넘으면 “연결이 느려요” + 다시 시도', async ({ page }) => {
  await mockSupabase(page);
  await fakeBridge(page, { hangToken: true });
  await page.clock.install();
  await page.goto('/');
  await page.clock.runFor(11_000);
  await expect(page.getByRole('status').filter({ hasText: '연결이 느려요' })).toBeVisible();
  await expect(page.getByRole('button', { name: '다시 시도' })).toBeVisible();
});

test('보기만 모드(S1-09): 업데이트 없이 보기만 하면 저장 요청을 보내지 않고 안내', async ({
  page,
}) => {
  await signedInHome(page, { pin: null });
  await page.addInitScript(() => localStorage.setItem('sweetwo.pin-asked', '1'));
  await page.route(`${SB}/rest/v1/app_config*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ min_version_ios: '9.0.0', min_version_web: '0.0.0' }),
      headers: { 'Access-Control-Allow-Origin': '*' },
    }),
  );
  const writes: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/rest/v1/consent')) writes.push(r.url());
  });
  await page.goto('/settings/notifications');
  await expect(page.getByRole('heading', { name: '새 버전으로 업데이트해 주세요' })).toBeVisible();
  await expect(page.getByText('업데이트를 받지 못했어요')).toHaveCount(0);
  await page.getByRole('button', { name: '업데이트 없이 보기만 할게요' }).click();
  await page.getByRole('switch', { name: /마케팅 정보 받기/ }).click();
  await expect(page.getByText('지금 버전으로는 저장할 수 없어요')).toBeVisible();
  await expect(page.getByRole('button', { name: '지금 업데이트' })).toBeVisible();
  expect(writes).toEqual([]);
});

test('A-05 약관 보기(S1-18·S1-19): 이용약관은 앱 안 브라우저, 동의 문서는 시트. 마케팅 동의 결과 알림', async ({
  page,
}) => {
  await mockSupabase(page, { loginState: { state: 'new', needs_email: false } });
  await fakeBridge(page);
  await page.goto('/login');
  await login(page);
  await page.getByRole('button', { name: '[필수] 이용약관 보기' }).click();
  await expect.poll(async () => (await fb(page)).opened).toEqual(['https://sweetwo.kr/terms']);
  await page.getByRole('button', { name: '[필수] 파트너와 우리 둘 공간 공유 보기' }).click();
  const share = page.getByRole('dialog', { name: '파트너와 우리 둘 공간 공유 동의' });
  await expect(share).toBeVisible();
  await share.getByRole('button', { name: '닫기' }).last().click();
  await expect(share).toBeHidden();
  await page.getByRole('button', { name: '[선택] 마케팅 정보 받기 보기' }).click();
  const sheet = page.getByRole('dialog', { name: '마케팅 정보 받기 동의' });
  await expect(sheet.getByText('밤 9시부터 아침 8시까지는 보내지 않아요.')).toBeVisible();
  await axe(page);
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(/\/signup\/terms$/); // Esc가 시트만 닫고 가입은 그대로
  await page.getByRole('checkbox', { name: '모두 동의해요(선택 포함)' }).click();
  await page.getByRole('button', { name: '동의하고 계속하기' }).click();
  await expect(page.getByText(/sweeTwo 마케팅 정보 받기에 동의했어요/)).toBeVisible();
});

test('약한 PIN(A-06): 9 다음 0으로 도는 연속, 두 개씩 3번, 두 숫자 번갈아도 안 됨', async ({
  page,
}) => {
  await signedInHome(page, { pin: null });
  await page.goto('/lock/setup');
  // 2026-11-13 v2.2: 먼저 “앱 잠금을 켤까요?”(건너뛸 수 있음) → ‘켜기’
  await expect(page.getByRole('heading', { name: '앱 잠금을 켤까요?' })).toBeVisible();
  await page.getByRole('button', { name: '켜기' }).click();
  await expect(
    page.getByRole('heading', { name: '앱을 열 때 쓸 PIN 6자리를 정해 주세요' }),
  ).toBeVisible();
  for (const pin of ['890123', '112233', '121212', '098765']) {
    await page.keyboard.type(pin);
    await expect(page.getByText('같은 숫자나 이어지는 숫자는 쓸 수 없어요')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: '앱을 열 때 쓸 PIN 6자리를 정해 주세요' }),
    ).toBeVisible();
  }
  await page.keyboard.type('258036');
  await expect(page.getByRole('heading', { name: '한 번 더 입력해 주세요' })).toBeVisible();
});

test('A-02 소셜 버튼(S1-30): 공식 문구, ‘최근 사용’은 이름이 아닌 설명, 비활성 카카오도 노랑', async ({
  page,
}) => {
  await mockSupabase(page);
  await page.addInitScript(() => {
    localStorage.setItem('sweetwo.started', '1');
    localStorage.setItem('sweetwo.last-provider', 'apple');
  });
  await page.goto('/login');
  const apple = page.getByRole('button', { name: 'Apple로 계속하기', exact: true });
  await expect(apple).toHaveAccessibleDescription('최근 사용');
  await expect(
    page.getByRole('button', { name: '카카오로 3초 만에 로그인', exact: true }),
  ).toBeVisible();
  await page.context().setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  const kakao = page.getByRole('button', { name: '카카오로 3초 만에 로그인', exact: true });
  await expect(kakao).toBeDisabled();
  await expect(kakao).toHaveCSS('background-color', 'rgb(254, 229, 0)');
  await page.context().setOffline(false);
});

test('태블릿(터치) 질문 화면(S1-24): Enter 안내와 넓은 창 바 없이 휴대폰처럼 가운데 열', async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    viewport: { width: 820, height: 1180 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  await mockSupabase(page, { loginState: { state: 'new', needs_email: true } });
  await asReturningFromProvider(page, 'kakao');
  await page.goto('/auth/callback?code=e2e-code');
  await expect(page.getByRole('heading', { name: '알림 받을 이메일을 알려 주세요' })).toBeVisible();
  await expect(page.getByText('Enter 키를 눌러도 돼요')).toBeHidden();
  await expect(page.locator('.hg-qbar')).toBeHidden();
  await expect(page.locator('.hg-q__nav .hg-back')).toBeVisible();
  const box = await page.getByRole('button', { name: '다음' }).boundingBox();
  expect(box?.width).toBeGreaterThan(400); // 휴대폰처럼 열 너비 주 버튼(넓은 창 120px 버튼 아님)
  await ctx.close();
});
