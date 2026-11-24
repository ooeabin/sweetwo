import { test, expect } from '@playwright/test';
import { emptyV22, mockOnboarding, seed } from './mocks';

// 연결 판정(13 공통 상태 9번, 30 동기화 4장): navigator.onLine만 믿지 않고 실제 확인(auth/v1/health)으로 정한다.
const NOW = new Date('2026-10-07T10:00:00+09:00');

async function open(page: import('@playwright/test').Page) {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  db.v22 = emptyV22();
  return db;
}

test('브라우저가 거짓으로 오프라인이라 알려도(navigator.onLine=false) 서버에 닿으면 데이터가 보이고 오프라인 띠가 없음', async ({
  page,
}) => {
  await open(page);
  await page.addInitScript(() =>
    Object.defineProperty(Navigator.prototype, 'onLine', { get: () => false }),
  );
  await page.goto('/');
  await expect(page.locator('.hg-together')).toContainText('내 집 마련');
  await expect(page.getByRole('status').filter({ hasText: '오프라인' })).toHaveCount(0);
});

test('실제로 끊기면(setOffline) 오프라인 띠, 다시 연결되면 사라짐', async ({ page, context }) => {
  await open(page);
  await page.goto('/');
  await expect(page.locator('.hg-together')).toContainText('내 집 마련');
  await page.route('**/auth/v1/health', (r) => r.abort('internetdisconnected'));
  await context.setOffline(true);
  await expect(page.getByRole('status').filter({ hasText: '오프라인' })).toBeVisible();
  await page.unroute('**/auth/v1/health');
  await context.setOffline(false);
  await expect(page.getByRole('status').filter({ hasText: '오프라인' })).toHaveCount(0);
});
