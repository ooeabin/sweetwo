import { test, expect } from '@playwright/test';
import { type MemDb, mockOnboarding } from './mocks';

// 메뉴·화면 점검 PR-1(2026-11-16): 머리 ‹는 온 곳으로, 알림 제목 h1, 설정 첫 줄 ‘내 정보’
const NOW = new Date('2026-10-07T10:00:00+09:00');

function seed(db: MemDb) {
  Object.assign(db.me, {
    nickname: '찬우',
    side: 'groom',
    employment: 'regular',
    monthly_income: 3_500_000,
    payday: 25,
    payday_last: false,
    allowance: 500_000,
    onboarding_step: 'O-67',
    onboarding_done_at: '2026-09-20T01:00:00Z',
    space_id: 'space-1',
  });
  db.space = {
    id: 'space-1',
    created_by: db.me.id,
    couple_state: 'not_joined',
    marriage_status: 'married',
    base_day: 25,
  } as MemDb['space'];
}

test('알림 화면 제목은 h1, 알림 설정에서 ‹는 알림으로, 설정 첫 줄은 내 정보', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'narrow', '좁은 창 흐름');
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/');
  await page.locator('.hg-frame__mhead').getByRole('button', { name: /^알림/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: '알림' })).toBeVisible();
  await page
    .getByRole('button', { name: /알림 설정/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/settings\/notifications$/);
  await page.getByRole('button', { name: '뒤로' }).first().click();
  await expect(page).toHaveURL(/\/notifications$/);

  await page.goto('/settings');
  await expect(page.getByRole('button', { name: /^내 정보/ })).toBeVisible();
});

test('머리 B안(2026-11-26): ‹는 Regular 선·같은 자리, 제목 17/500, N-02 ‘모두 읽음’ 글자 끝은 화면 오른쪽 24', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'narrow', '좁은 창 머리');
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  const icoX = async () => {
    const ico = page.locator('.hg-back:visible > .hg-ico').first();
    return (await ico.boundingBox())?.x;
  };
  await page.goto('/salary/plan');
  const title = page.getByRole('heading', { level: 1, name: '월급 계획 템플릿' });
  await expect(title).toBeVisible();
  expect(await title.evaluate((e) => getComputedStyle(e).fontWeight)).toBe('500');
  const backMask = await page
    .locator('.hg-back:visible > .hg-ico')
    .first()
    .evaluate((e) => getComputedStyle(e).getPropertyValue('--ico'));
  expect(backMask).toContain('M165.66'); // Phosphor Regular caret-left
  const x1 = await icoX();

  await page.goto('/notifications');
  const noti = page.getByRole('heading', { level: 1, name: '알림' });
  await expect(noti).toBeVisible();
  expect(await noti.evaluate((e) => getComputedStyle(e).fontWeight)).toBe('500');
  expect(await icoX()).toBe(x1);
  const all = page.getByRole('button', { name: '모두 읽음' });
  const end = await all.evaluate((e) => {
    const r = e.getBoundingClientRect();
    return Math.round(r.right - parseFloat(getComputedStyle(e).paddingRight));
  });
  expect(end).toBe((page.viewportSize()?.width ?? 0) - 24);
});
