import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { mockOnboarding, type MemDb } from './onboarding-mock';

const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const heading = (page: Page, name: string | RegExp) =>
  expect(page.getByRole('heading', { name }).first()).toBeVisible();
const NOW = new Date('2026-10-07T10:00:00+09:00');

// 가이드(S-01~S-03), 체크리스트 할 일, 내 답 다시 보기(S-17). 찬우, 예빈 합류 전, 신혼 첫해.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

// 프로필 사진(docs/spec/25-settings.md S-11e). 찬우, 예빈 합류 전.
function seed(db: MemDb) {
  Object.assign(db.me, {
    nickname: '찬우',
    side: 'groom',
    employment: 'regular',
    monthly_income: 3_500_000,
    payday: 25,
    allowance: 500_000,
    onboarding_step: 'O-67',
    onboarding_done_at: '2026-08-20T01:00:00Z',
    space_id: 'space-1',
  });
  db.space = {
    id: 'space-1',
    created_by: db.me.id,
    couple_state: 'not_joined',
    partner_nickname: '예빈',
    marriage_status: 'married',
    partner_income: 2_700_000,
    partner_income_estimated: true,
    partner_income_unknown: false,
    fixed_total: 1_000_000,
    living_budget: 550_000,
    loan_repayment: 0,
    split_mode: 'half',
    split_ratio: 50,
    split_deferred: false,
    account_mode: 'roles',
    base_day: null,
    base_day_last: false,
  };
}

test('프로필 사진(S-11e): 너무 큰 사진은 막음 → 고르기 → 자르기 → 저장 → 사진, 지우기', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/settings/me');
  await expect(page.locator('.hg-avatar--xl')).toHaveText('찬');
  await page.getByRole('button', { name: '사진 바꾸기' }).click();
  await heading(page, '프로필 사진');
  await expect(page.getByText('올린 사진은 예빈님과 나만 볼 수 있어요')).toBeVisible();
  await axe(page);

  const input = page.getByLabel('사진 고르기', { exact: true });
  await input.setInputFiles({
    name: 'big.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.alloc(11 * 1024 * 1024),
  });
  await expect(page.getByRole('alert')).toHaveText('10MB 이하 사진만 올릴 수 있어요');
  await input.setInputFiles({ name: 'a.gif', mimeType: 'image/gif', buffer: PNG });
  await expect(page.getByRole('alert')).toHaveText('이 형식은 올릴 수 없어요');

  await input.setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG });
  const stage = page.getByRole('group', { name: '사진 위치, 화살표로 옮겨요' });
  await expect(stage).toBeVisible();
  await stage.focus();
  await page.keyboard.press('+');
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('slider', { name: '확대' })).toHaveAttribute('aria-valuenow', '110');
  await expect(page.getByRole('img', { name: '미리보기' })).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '저장할게요' }).click();
  await expect(page.getByText('사진을 바꿨어요')).toBeVisible();
  await expect(page).toHaveURL(/\/settings\/me$/);
  expect(db.me.avatar_path).toBe(`space-1/${db.me.id}.jpg`);
  expect(db.storage).toEqual([`/storage/v1/object/avatars/space-1/${db.me.id}.jpg`]);
  await expect(page.getByRole('img', { name: '찬우' })).toBeVisible();

  await page.getByRole('button', { name: '사진 지우기' }).click();
  await expect(page.getByText('사진을 지웠어요')).toBeVisible();
  expect(db.me.avatar_path).toBeNull();
  await expect(page.locator('.hg-avatar--xl')).toHaveText('찬');
});
