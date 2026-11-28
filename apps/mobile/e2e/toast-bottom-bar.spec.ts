import { test, expect, type Page } from '@playwright/test';
import { mockOnboarding, seed } from './mocks';

// 공통 Toast: 화면 아래 고정 주 버튼 위로 뜸(2026-11-23, StickyBar `--hg-bottom-bar-h`). W-21 빈 상태는 가운데쯤 + slate.
const NOW = new Date('2026-10-07T10:00:00+09:00');

async function open(page: Page, path: string) {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto(path);
  return db;
}

async function expectAboveBar(page: Page) {
  // 올라오는 움직임이 끝난 뒤 잰다
  await page
    .locator('.hg-toast')
    .evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  const toast = await page.locator('.hg-toast').boundingBox();
  const bar = await page.locator('.hg-stickybar .hg-btn--primary').boundingBox();
  expect(toast).not.toBeNull();
  expect(bar).not.toBeNull();
  expect((toast?.y ?? 0) + (toast?.height ?? 0)).toBeLessThanOrEqual(bar?.y ?? 0);
}

test('토스트가 아래 고정 주 버튼 위에 뜸: W-02 줄 확인 두 번(확인했어요, 건너뜀)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, '/salary');
  await expect(page.getByRole('button', { name: '모두 계획대로 됐어요' })).toBeVisible();
  const barH = await page.evaluate(() =>
    document.documentElement.style.getPropertyValue('--hg-bottom-bar-h'),
  );
  expect(parseInt(barH, 10)).toBeGreaterThan(40);

  await page.locator('.hg-transfer__open', { hasText: '식비' }).click();
  await page.getByRole('button', { name: '다른 금액으로 했어요' }).click();
  await page.getByRole('textbox', { name: '얼마를 보냈어요?' }).fill('700000');
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.locator('.hg-toast')).toContainText('확인했어요');
  await expectAboveBar(page);

  await page.locator('.hg-transfer__open', { hasText: '청약' }).click();
  await page.getByRole('button', { name: '다른 금액으로 했어요' }).click();
  await page.getByRole('textbox', { name: '얼마를 보냈어요?' }).fill('0');
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.locator('.hg-toast')).toContainText('건너뛰었어요');
  await expectAboveBar(page);

  // 키보드가 열려 화면이 줄어든 만큼 작은 높이에서도 겹치지 않음
  await page.setViewportSize({ width: 390, height: 480 });
  await expectAboveBar(page);
});

test('바가 없는 화면은 토스트 자리 그대로(아래 여백 + 안전 영역)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, '/salary/archive');
  const v = await page.evaluate(() =>
    document.documentElement.style.getPropertyValue('--hg-bottom-bar-h'),
  );
  expect(v).toBe('');
});

test('W-21 지난 달 없음: 공통 빈 상태, 화면 가운데쯤, slate', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, '/salary/archive');
  const t = page.getByText('아직 지난 달 기록이 없어요');
  await expect(t).toBeVisible();
  const box = await t.boundingBox();
  expect(box?.y ?? 0).toBeGreaterThan(844 * 0.3);
  expect(box?.y ?? 0).toBeLessThan(844 * 0.6);
  const [color, slate] = await t.evaluate((el) => {
    const probe = document.createElement('i');
    probe.style.color = 'var(--slate)';
    document.body.append(probe);
    const s = getComputedStyle(probe).color;
    probe.remove();
    return [getComputedStyle(el).color, s];
  });
  expect(color).toBe(slate);
});
