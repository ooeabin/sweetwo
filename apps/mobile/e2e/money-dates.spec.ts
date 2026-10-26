import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { mockOnboarding, type MemDb } from './onboarding-mock';
import { seed } from './seed-home';

// 만기일 당일(23 F-04a, 19 H-06 ‘만기·챙길 날’, H-05 만기): 홈 할 일 한 줄 → F-04a → 다른 통장으로 / 다시 가입했어요.
// 찬우 혼자, 10월 7일. 청년 적금 만기 10월 7일, 입출금 통장 300만.

const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const NOW = new Date('2026-10-07T10:00:00+09:00');

function seedAssets(db: MemDb) {
  const base = {
    side: 'asset',
    principal: null,
    owner: 'person',
    owner_user_id: db.me.id,
    created_by: db.me.id,
    visibility: 'all',
    status: 'held',
    deleted_at: null,
  };
  db.assets.push(
    {
      ...base,
      id: 'a-sav',
      grp: 'deposit',
      kind: 'saving',
      name: '청년 적금',
      amount: 12_000_000,
      maturity_date: '2026-10-07',
    },
    {
      ...base,
      id: 'a-bank',
      grp: 'cash',
      kind: 'bank',
      name: '입출금 통장',
      amount: 3_000_000,
      maturity_date: null,
    },
  );
}

test('만기일 당일: 할 일 한 줄 → 다른 통장으로 옮겼어요(통장 + 만기 금액, 만기 완료)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  // 월말 확인·초대·목표 금액 할 일이 앞에 오지 않게
  Object.assign(db.space ?? {}, { couple_state: 'solo' });
  seedAssets(db);
  await page.goto('/');
  const band = page.locator('.hg-body__banner', { hasText: '청년 적금이 만기됐어요' });
  await expect(band).toBeVisible();
  await expect(page.getByRole('region', { name: '다가오는 일정' })).toContainText('청년 적금 만기');
  await band.getByRole('button', { name: '열기' }).click();
  await expect(page.getByRole('heading', { name: '만기된 돈은 어디로 옮겼어요?' })).toBeVisible();
  await axe(page);
  await page.getByRole('radio', { name: /다른 통장으로/ }).click();
  await expect(page.getByRole('heading', { name: '어느 통장으로 옮겼어요?' })).toBeVisible();
  await page.getByRole('radio', { name: /입출금 통장/ }).click();
  await expect(page).toHaveURL(/\/assets\/a-bank$/);
  expect(db.assets.find((a) => a.id === 'a-bank')?.amount).toBe(15_000_000);
  expect(db.assets.find((a) => a.id === 'a-sav')?.status).toBe('matured');
});

test('만기일 당일: 다시 가입했어요 → 새 만기일, 닫으면 그날은 안 보임', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  Object.assign(db.space ?? {}, { couple_state: 'solo' });
  seedAssets(db);
  await page.goto('/assets/a-sav/matured');
  await page.getByRole('radio', { name: /다시 가입했어요/ }).click();
  await expect(page.getByRole('heading', { name: '만기일은 언제예요?' })).toBeVisible();
  await page.getByLabel('년', { exact: true }).fill('2027');
  await page.getByLabel('월', { exact: true }).fill('10');
  await page.getByLabel('일', { exact: true }).fill('7');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page).toHaveURL(/\/assets\/a-sav$/);
  expect(db.assets.find((a) => a.id === 'a-sav')?.maturity_date).toBe('2027-10-07');

  // 닫기
  const sav = db.assets.find((a) => a.id === 'a-sav');
  if (sav) sav.maturity_date = '2026-10-07';
  await page.goto('/');
  const band = page.locator('.hg-body__banner', { hasText: '청년 적금이 만기됐어요' });
  await band.getByRole('button', { name: '닫기' }).click();
  await expect(band).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.hg-body__banner', { hasText: '청년 적금이 만기됐어요' })).toHaveCount(
    0,
  );
});
