import { test, expect, type Page } from '@playwright/test';
import { emptyV22, mockOnboarding, seed } from './mocks';
import { fakeBridge, type FakeState } from './fake-bridge';

// 분석 GA4 전송(ADR 0010, 32 0-5 ‘전송 경로’): 모바일 브리지(analytics)가 있으면 앱이 이벤트·화면 ID·가명 사용자를 넘김.
// 실제 Firebase·GA 호출은 없음(흉내 브리지가 받은 것만 확인)
const NOW = new Date('2026-10-07T10:00:00+09:00');
const ga = async (page: Page) =>
  (await page.evaluate(() => (window as unknown as { __fb: FakeState }).__fb.ga)) ?? [];

test('GA 브리지: 화면 ID screen_view, 가명 user_id·couple_hash, 금액·id 원값 없음, ‘사용 기록 보내기’를 끄면 수집 끔', async ({
  page,
}) => {
  await fakeBridge(page, { signedIn: true, pin: null, ga: true });
  await page.addInitScript(() => localStorage.setItem('sweetwo.pin-asked', '1'));
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  db.v22 = emptyV22();
  await page.goto('/');

  await expect
    .poll(async () => (await ga(page)).some((g) => g.kind === 'screen' && g.v === 'H-01'))
    .toBe(true);
  await expect
    .poll(async () =>
      (await ga(page)).some(
        (g) => g.kind === 'user' && /^[0-9a-f]{32}$/.test(String((g.v as { id: unknown }).id)),
      ),
    )
    .toBe(true);

  await page.goto('/settings/data');
  await expect
    .poll(async () => (await ga(page)).some((g) => g.kind === 'screen' && g.v === 'S-18'))
    .toBe(true);
  const sent = JSON.stringify(await ga(page));
  expect(sent).not.toContain(db.me.id);
  expect(sent).not.toMatch(/\d{1,3}(,\d{3})+원/);

  await page.getByRole('switch', { name: '사용 기록 보내기' }).click();
  await expect.poll(() => db.me.analytics_off).toBe(true);
  await expect
    .poll(async () => (await ga(page)).some((g) => g.kind === 'enabled' && g.v === false))
    .toBe(true);
  // 끈 뒤로는 화면 이동도 보내지 않음
  const before = (await ga(page)).filter((g) => g.kind === 'screen').length;
  await page.goto('/settings');
  await page.waitForTimeout(300);
  expect((await ga(page)).filter((g) => g.kind === 'screen').length).toBe(before);
});
