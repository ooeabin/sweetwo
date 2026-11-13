import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { type MemDb, mockOnboarding, seed } from './mocks';

// 만기일 당일(23 F-04a, 19 H-06 ‘만기·경조사’, H-05 만기): 홈 할 일 한 줄 → F-04a → 다른 통장으로 / 다시 가입했어요.
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
  // 월급 전 확인·초대 할 일이 앞에 오지 않게
  Object.assign(db.space ?? {}, { couple_state: 'solo' });
  seedAssets(db);
  await page.goto('/');
  const band = page.locator('.hg-hubband', { hasText: '청년 적금이 만기됐어요' });
  await expect(band).toBeVisible();
  await band.getByRole('button').first().click();
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
  // 2026-11-04 날짜 휠: 처음 값이 1년 뒤 오늘(2027-10-07)이라 그대로 저장
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page).toHaveURL(/\/assets\/a-sav$/);
  expect(db.assets.find((a) => a.id === 'a-sav')?.maturity_date).toBe('2027-10-07');

  // 2026-11-11 띠 닫기(✕) 없음: 정리하면(새 만기일) 홈 띠가 사라짐
  await page.goto('/');
  await expect(page.locator('.hg-hubband', { hasText: '청년 적금이 만기됐어요' })).toHaveCount(0);
  const sav = db.assets.find((a) => a.id === 'a-sav');
  if (sav) sav.maturity_date = '2026-10-07';
  await page.reload();
  const band = page.locator('.hg-hubband', { hasText: '청년 적금이 만기됐어요' });
  await expect(band).toHaveCount(1);
  await expect(band.getByRole('button', { name: '닫기' })).toHaveCount(0);
});

test('F-04 투자: 시세 바꾸기, 팔았어요(일부) → 받은 통장 → 실현 손익, 수정 내역에 고친 사람', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  seedAssets(db);
  const bank = db.assets.find((a) => a.id === 'a-bank') as Record<string, unknown>;
  db.assets.push({
    ...bank,
    id: 'a-stock',
    grp: 'invest',
    kind: 'stock',
    name: '찬우 주식',
    amount: 10_000_000,
    principal: 8_000_000,
    monthly_payment: null,
    interest_rate: null,
    paid_count: null,
    created_at: '2026-01-10T00:00:00Z',
  });
  await page.goto('/assets/a-stock');
  await expect(page.getByRole('heading', { name: '찬우 주식' })).toBeVisible();
  await page.getByRole('button', { name: '팔았어요' }).click();
  // 먼저 묻기(전부 / 일부만) → 받은 금액 → 남은 평가금액, 화면마다 키패드 하나
  await expect(page.getByRole('heading', { name: '얼마나 팔았어요?' })).toBeVisible();
  await axe(page);
  await page.getByRole('radio', { name: /일부만 팔았어요/ }).click();
  await expect(page.getByRole('heading', { name: '받은 금액은 얼마예요?' })).toBeVisible();
  await page.getByLabel('받은 금액은 얼마예요?').fill('5000000');
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('heading', { name: '남은 평가금액은 얼마예요?' })).toBeVisible();
  await page.getByLabel('남은 평가금액은 얼마예요?').fill('5000000');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('radio', { name: /입출금 통장/ }).click();
  await expect(page.getByText('입출금 통장 +500만 원')).toBeVisible();
  await expect(page.getByText('실현 손익 +100만 원')).toBeVisible();
  await axe(page);
  expect(db.assets.find((a) => a.id === 'a-bank')?.amount).toBe(8_000_000);
  expect(db.assets.find((a) => a.id === 'a-stock')).toMatchObject({
    amount: 5_000_000,
    status: 'held',
  });
});

test('F-04 투자: 전부 팔았어요 → 받은 통장 → 결과(F-04d)가 보이고 목록에서 빠짐(2026-11-12 S8-01)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  seedAssets(db);
  const bank = db.assets.find((a) => a.id === 'a-bank') as Record<string, unknown>;
  db.assets.push({
    ...bank,
    id: 'a-stock',
    grp: 'invest',
    kind: 'stock',
    name: '찬우 주식',
    amount: 10_000_000,
    principal: 8_000_000,
    created_at: '2026-01-10T00:00:00Z',
  });
  await page.goto('/assets/a-stock/sold');
  await page.getByRole('radio', { name: /전부 팔았어요/ }).click();
  await page.getByLabel('받은 금액은 얼마예요?').fill('11000000');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('radio', { name: /입출금 통장/ }).click();
  await expect(page.getByRole('heading', { name: '팔았어요' })).toBeVisible();
  await expect(page.getByText('입출금 통장 +1,100만 원')).toBeVisible();
  await expect(page.getByText('실현 손익 +300만 원')).toBeVisible();
  await axe(page);
  expect(db.assets.find((a) => a.id === 'a-stock')?.status).toBe('sold');
  await page.getByRole('button', { name: '목록으로 가기' }).click();
  await expect(page).toHaveURL(/\/assets\/items\?side=asset/);
  await expect(page.getByRole('button', { name: /찬우 주식/ })).toHaveCount(0);
});

test('만기일 + 31일째: 홈 띠는 내려가고, 상세 “만기일이 지났어요” + ‘정리하기’ → F-04a(2026-11-11)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  Object.assign(db.space ?? {}, { couple_state: 'solo' });
  seedAssets(db);
  const sav = db.assets.find((a) => a.id === 'a-sav');
  // 오늘(10월 7일)은 만기일 다음 31일째. 상세 화면은 만든 날·고친 날도 씀
  for (const x of db.assets)
    Object.assign(x, {
      rate_estimated: false,
      monthly_payment: null,
      interest_rate: null,
      paid_count: null,
      pay_from: null,
      goal_id: null,
      estimated: false,
      created_at: '2025-10-07T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
    });
  if (sav) sav.maturity_date = '2026-09-06';
  await page.goto('/');
  await expect(page.locator('.hg-hubtile').first()).toBeVisible();
  await expect(page.getByText('청년 적금이 만기됐어요')).toHaveCount(0);
  await page.goto('/assets/a-sav');
  const note = page.getByRole('status').filter({ hasText: '만기일이 지났어요' });
  await expect(note).toBeVisible();
  await axe(page);
  await note.getByRole('button', { name: '정리하기' }).click();
  await expect(page.getByRole('heading', { name: '만기된 돈은 어디로 옮겼어요?' })).toBeVisible();
  // 만기 전 항목에는 띠 없음
  await page.goto('/assets/a-bank');
  await expect(page.getByRole('heading', { name: '입출금 통장' })).toBeVisible();
  await expect(page.getByText('만기일이 지났어요')).toHaveCount(0);
});
