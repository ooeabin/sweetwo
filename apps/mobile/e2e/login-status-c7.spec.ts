import { test, expect, type Locator, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { emitAuth, fakeBridge } from './fake-bridge';
import { chanwoo, fakeJwt, mockOnboarding, mockSupabase, seed } from './mocks';

// 구역 7 로그인·상태 검토(2026-11-25): 첫 로딩 뼈대(CS-05), 서버 오류 다시 시도(CS-07), A-02 알약 두 줄, Toast가 아래 버튼 위,
// S-18b 0개 줄 숨김, 약관 하위 ✓, A-05r 마케팅 › 줄, CS-19 아래 꽉 찬 주 버튼.
const NOW = new Date('2026-10-07T10:00:00+09:00');
const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const box = async (loc: Locator) => {
  const b = await loc.boundingBox();
  if (!b) throw new Error('보이지 않음');
  return b;
};
const home = async (page: Page) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  return db;
};

test('첫 불러오는 중(CS-05): 계정을 받는 동안 빈 화면이 아니라 화면 모양 뼈대', async ({
  page,
}) => {
  await home(page);
  await page.route(/\/rest\/v1\/app_user/, async (route) => {
    await new Promise((r) => setTimeout(r, 3000));
    await route.fallback();
  });
  await page.goto('/');
  // 0.3초가 지나면 홈 모양 뼈대(앱 틀 + 회색 조각), 글자는 아직 없음
  await expect(page.locator('.hg-frame .hg-skel').first()).toBeVisible({ timeout: 2500 });
  await expect(page.getByRole('button', { name: '모두 계획대로 됐어요' })).toHaveCount(0);
  await page.goto('/salary');
  await expect(page.locator('.hg-frame .hg-skel').first()).toBeVisible({ timeout: 2500 });
});

test('서버 오류(CS-07): 못 받으면 뼈대에 머물지 않고 오류 카드 + 다시 시도가 다시 요청', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await home(page);
  let broken = true;
  await page.route(/\/rest\/v1\/app_user/, async (route) => {
    if (broken)
      return route.fulfill({
        status: 500,
        body: '{"message":"x"}',
        headers: { 'Access-Control-Allow-Origin': '*', 'content-type': 'application/json' },
      });
    await route.fallback();
  });
  await page.goto('/');
  const card = page.getByRole('status').filter({ hasText: '잠시 문제가 생겼어요' });
  await expect(card).toBeVisible({ timeout: 45_000 });
  await expect(card).toContainText('다시 시도해 주세요');
  await expect(page.locator('.hg-skel')).toHaveCount(0);
  await axe(page);
  broken = false;
  // 다른 요청의 재시도로 오류 카드가 다시 그려질 수 있어(요소 교체), 눌릴 때까지 다시 찾는다
  await expect(async () => {
    await card.getByRole('button', { name: '다시 시도' }).click({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
  await expect(card).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

const failToLogin = async (page: Page, reason: string) => {
  await mockSupabase(page, { loginState: { state: 'new', needs_email: false } });
  await fakeBridge(page);
  await page.goto('/login');
  await page.getByRole('button', { name: '카카오로 3초 만에 로그인', exact: true }).click();
  await expect(page).toHaveURL(/\/login\/wait$/);
  await emitAuth(page, { type: 'login_failed', reason });
};

test('A-02 실패 알약: 긴 문구는 폭 안에서 두 줄로 줄바꿈, 잘리지 않음', async ({ page }) => {
  await failToLogin(page, 'provider_error');
  const pill = page.locator('.hg-auth__toast');
  await expect(pill).toContainText('다른 방법으로 해볼까요?');
  const b = await box(pill);
  const main = await box(page.locator('.hg-auth__actions'));
  expect(b.x).toBeGreaterThanOrEqual(main.x - 1);
  expect(b.x + b.width).toBeLessThanOrEqual(main.x + main.width + 1);
  // 글자가 알약 밖으로 넘치지 않음(scrollWidth <= clientWidth)
  const over = await pill.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(over).toBeLessThanOrEqual(1);
});

test('Toast는 아래에 붙은 로그인 버튼 위로 뜸(로그아웃 뒤 A-02)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await home(page);
  await page.goto('/');
  await page.locator('.hg-frame__mhead').getByRole('button', { name: '설정', exact: true }).click();
  await page.getByRole('button', { name: /^내 정보/ }).click();
  await page.getByRole('button', { name: '로그아웃' }).click();
  await expect(page).toHaveURL(/\/login$/);
  const toast = page.locator('.hg-toast', { hasText: '로그아웃했어요' });
  await expect(toast).toBeVisible();
  await toast.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  const t = await box(toast);
  const btn = await box(page.locator('.hg-auth__actions .hg-btn').first());
  expect(t.y + t.height).toBeLessThanOrEqual(btn.y);
});

test('S-18b: 내 명의 항목이 0개면 “0개는 지워져요” 줄을 숨김', async ({ page }) => {
  const db = await home(page);
  void db;
  await page.goto('/settings/data/delete');
  await expect(
    page.getByText(/같이 쓰던 데이터도 모두 지워져요|우리 둘 공간 전체 삭제/),
  ).toBeVisible();
  await expect(page.getByText('30일 안에 다시 로그인하면 복구돼요')).toBeVisible();
  await expect(page.getByText(/내 명의 항목 0개/)).toHaveCount(0);
});

test('A-05 약관 하위 ✓: 안 체크는 회색 ✓가 늘 보이고, 체크하면 오렌지 ✓', async ({ page }) => {
  await mockSupabase(page, { loginState: { state: 'new', needs_email: false } });
  await fakeBridge(page);
  await page.goto('/login');
  await page.getByRole('button', { name: '카카오로 3초 만에 로그인', exact: true }).click();
  await emitAuth(
    page,
    { type: 'signed_in', provider: 'kakao', waitSec: 2, reopened: false },
    fakeJwt(chanwoo.id),
  );
  await expect(page).toHaveURL(/\/signup\/terms$/);
  const tick = (i: number) =>
    page
      .locator('.hg-consent__sub .hg-checkbox')
      .nth(i)
      .evaluate((el) => {
        const cs = getComputedStyle(el, '::after');
        return { content: cs.content, color: cs.borderLeftColor, w: cs.borderLeftWidth };
      });
  const off = await tick(0);
  expect(off.content).not.toBe('none');
  expect(off.w).toBe('2px');
  await page.getByRole('checkbox', { name: '[필수] 만 18세 이상이에요' }).click();
  const on = await tick(0);
  expect(on.content).not.toBe('none');
  expect(on.color).not.toBe(off.color);
  // 누르는 칸 44px 이상
  const row = await box(page.getByRole('checkbox', { name: '[필수] 이용약관' }));
  expect(row.height).toBeGreaterThanOrEqual(44);
  await axe(page);
});

test('A-05r 마케팅 재확인: ‘마케팅 정보 받기’는 › 있는 줄, 누르면 시트', async ({ page }) => {
  const db = await home(page);
  db.pendingTerms = [{ kind: 'marketing', version: '' }];
  await page.goto('/calendar');
  await expect(page.getByRole('heading', { name: '마케팅 정보를 계속 받을까요?' })).toBeVisible();
  const row = page.locator('button.hg-listrow', { hasText: '마케팅 정보 받기' });
  await expect(row).toBeVisible();
  await expect(row.locator('.hg-chevron')).toBeVisible();
  await row.click();
  await expect(page.getByRole('dialog', { name: '마케팅 정보 받기 동의' })).toBeVisible();
  await axe(page);
});

test('CS-19: 아래 꽉 찬 주 버튼(다른 상태 화면과 같은 틀)', async ({ page }) => {
  await home(page);
  await page.goto('/calendar/nowhere/really');
  const btn = page.getByRole('button', { name: '홈으로 가기' });
  await expect(btn).toBeVisible();
  const b = await box(btn);
  const vp = page.viewportSize() ?? { width: 0, height: 0 };
  // 한 열 폭을 꽉 채움(작은 가운데 버튼이 아님). 좁은 창은 아래에 붙음
  expect(b.width).toBeGreaterThan(280);
  if (vp.width < 768) expect(b.y).toBeGreaterThan(vp.height * 0.7);
  await expect(
    page.locator('.hg-auth__actions').getByRole('button', { name: '홈으로 가기' }),
  ).toBeVisible();
  await axe(page);
  await btn.click();
  await expect(page).toHaveURL(/\/$/);
});
