import { test, expect, type Page } from '@playwright/test';
import { emptyV22, mockOnboarding, mockSaving, newSavingDb, seed } from './mocks';

// W-02 수입 카드 기본값(월급)과 빈 템플릿 안내(20 W-02 6번·0b, 07 4장, 2026-11-20 사용자 결정).
// 기록 0건 → 월급 350만 원 + 연필 → 300만 원으로 고침 → 기록 1건 → 첫 확인 뒤에도 1건
async function open(page: Page, tweak?: (db: Awaited<ReturnType<typeof mockOnboarding>>) => void) {
  const now = new Date('2026-10-07T10:00:00+09:00');
  await page.clock.setFixedTime(now);
  const db = await mockOnboarding(page, { now });
  seed(db);
  db.v22 = emptyV22();
  tweak?.(db);
  const sv = newSavingDb();
  await mockSaving(page, db, sv, String(db.me.id));
  await page.goto('/salary');
  return { db, sv };
}

test('기록 0건: 월급 350만 원 + 연필 → 300만 원으로 고침 → 기록 1건, 첫 확인 뒤에도 1건', async ({
  page,
}) => {
  const { sv } = await open(page);
  const income = page.getByRole('region', { name: '이번 달 수입' });
  await expect(income.locator('.hg-incomecard__sum')).toHaveText('350만 원');
  const row = income.locator('.hg-incomecard__row');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('월급');
  await expect(row.locator('.hg-incomecard__auto')).toHaveText('자동');
  await expect(row).toContainText('+350만 원');
  expect(sv.moneyIns).toHaveLength(0); // 저장 전에는 기록 없음
  await income.getByRole('button', { name: /월급 금액 고치기/ }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('월급 금액').fill('3000000');
  await sheet.getByRole('button', { name: '확인' }).click();
  await expect(income.locator('.hg-incomecard__sum')).toHaveText('300만 원');
  await expect(income.locator('.hg-incomecard__row')).toHaveCount(1);
  await expect(income.locator('.hg-incomecard__row')).toContainText('+300만 원');
  expect(sv.moneyIns.filter((m) => m.source === 'payday_auto')).toHaveLength(1);
  expect(sv.moneyIns[0]).toMatchObject({ amount: 3_000_000, source: 'payday_auto' });
  // 첫 확인을 해도 한 줄, 금액 그대로
  await page.getByRole('button', { name: '청약 확인' }).click();
  await expect(page.getByText('5개 중 1개 확인')).toBeVisible();
  expect(sv.moneyIns.filter((m) => !m.deleted_at)).toHaveLength(1);
  expect(sv.moneyIns[0]?.amount).toBe(3_000_000);
  // 자동 월급 줄은 눌러서 고침(W-20 수정)
  await income.getByRole('button', { name: '월급 300만 원 고치기' }).click();
  await expect(page).toHaveURL(/\/salary\/money-in\?edit=/);
});

test('손대지 않고 첫 확인 → 프로필 월급으로 자동 기록(그대로)', async ({ page }) => {
  const { sv } = await open(page);
  await page.getByRole('button', { name: '청약 확인' }).click();
  const income = page.getByRole('region', { name: '이번 달 수입' });
  await expect(income.locator('.hg-incomecard__sum')).toHaveText('350만 원');
  expect(sv.moneyIns[0]).toMatchObject({ amount: 3_500_000, source: 'payday_auto' });
});

test('0원으로 저장하면 기록 없이 닫고 다시 안 물음', async ({ page }) => {
  const { sv } = await open(page);
  const income = page.getByRole('region', { name: '이번 달 수입' });
  await income.getByRole('button', { name: /월급 금액 고치기/ }).click();
  await page.getByRole('dialog').getByLabel('월급 금액').fill('0');
  await page.getByRole('dialog').getByRole('button', { name: '확인' }).click();
  await expect(income).toContainText('아직 적은 수입이 없어요');
  expect(sv.moneyIns).toHaveLength(0);
  await page.getByRole('button', { name: '청약 확인' }).click();
  await expect(page.getByText('5개 중 1개 확인')).toBeVisible();
  expect(sv.moneyIns).toHaveLength(0);
});

test('월급 0원 + 기록 없음: 큰 금액 0원 + 연필, 줄 없음', async ({ page }) => {
  await open(page, (db) => Object.assign(db.me, { monthly_income: 0 }));
  const income = page.getByRole('region', { name: '이번 달 수입' });
  await expect(income.locator('.hg-incomecard__sum')).toHaveText('0원');
  await expect(income.getByRole('button', { name: /월급 금액 고치기/ })).toBeVisible();
  await expect(income.locator('.hg-incomecard__row')).toHaveCount(0);
});

test('템플릿 줄 0개: 한 덩어리 안내 + 주 버튼 → 월급 계획 템플릿', async ({ page }) => {
  await open(page, (db) => {
    const list = db.checklists[0];
    if (list) list.pay_check_line = [];
  });
  await expect(page.getByText('350만 원을 나눠서')).toBeVisible();
  await expect(page.getByText('월급 계획 템플릿을 완성해 주세요')).toBeVisible();
  await expect(page.getByRole('region', { name: '이번 달 수입' })).toHaveCount(0);
  await expect(page.getByText('월급 계획 템플릿에서 줄을 추가해 주세요')).toHaveCount(0);
  await page.getByRole('button', { name: '월급 계획 템플릿 채우기' }).click();
  await expect(page).toHaveURL(/\/salary\/plan/);
});
