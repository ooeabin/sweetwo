import { test, expect, type Page } from '@playwright/test';
import { emptyV22, mockOnboarding, mockSaving, newSavingDb, seed } from './mocks';
import { checkRow } from './w02-row';

// 월급날 확인 → 월급 자동 수입 기록(07 4장, 20 W-02 6번·W-20b, 2026-11-20).
// 첫 확인 → 수입 카드에 “월급 +350만 원 자동”, W-20b에서 지우기 → 다시 확인해도 안 생김
async function open(page: Page) {
  const now = new Date('2026-10-07T10:00:00+09:00');
  await page.clock.setFixedTime(now);
  const db = await mockOnboarding(page, { now });
  seed(db);
  db.v22 = emptyV22();
  const sv = newSavingDb();
  await mockSaving(page, db, sv, String(db.me.id));
  await page.goto('/salary');
  return { db, sv };
}

test('첫 확인 → 수입 카드에 “월급 +350만 원 자동”, 지우면 다시 확인해도 안 생김', async ({
  page,
}) => {
  const { sv } = await open(page);
  const income = page.getByRole('region', { name: '이번 달 수입' });
  await expect(income.locator('.hg-incomecard__sum')).toHaveText('350만 원'); // 기본값(저장 전)
  // 줄 하나를 확인하면 월급이 수입으로 들어옴
  await checkRow(page, '청약');
  const row = income.locator('.hg-incomecard__row');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('월급');
  await expect(row).toContainText('+350만 원');
  await expect(row.locator('.hg-incomecard__auto')).toHaveText('자동');
  await expect(income.locator('.hg-incomecard__sum')).toHaveText('350만 원');
  expect(sv.moneyIns.filter((m) => m.source === 'payday_auto')).toHaveLength(1);
  // 다른 줄을 더 확인해도 한 줄 그대로
  await checkRow(page, '내 집 마련');
  await expect(page.getByText('5개 중 2개 확인')).toBeVisible();
  expect(sv.moneyIns.filter((m) => m.source === 'payday_auto')).toHaveLength(1);
  // W-20b에서 지우기
  await income.getByRole('button', { name: '수입 기록 전체 보기' }).click();
  await expect(page).toHaveURL(/\/salary\/money-in\/list/);
  await expect(page.getByText('월급, 자동')).toBeVisible();
  await page.getByRole('button', { name: '350만 원 기록 메뉴' }).click();
  await page.getByRole('menuitem', { name: '지우기' }).click();
  await expect(page.getByText('아직 적은 수입이 없어요')).toBeVisible();
  // 같은 사이클에서 다시 확인(한 번에 모두)해도 다시 안 생김
  await page.goto('/salary');
  await page.getByRole('button', { name: '모두 계획대로 됐어요' }).click();
  await expect(page.locator('.hg-toast')).toContainText('계획대로 됐어요');
  await expect(page.getByRole('region', { name: '이번 달 수입' })).toContainText(
    '아직 적은 수입이 없어요',
  );
  expect(sv.moneyIns.filter((m) => !m.deleted_at)).toHaveLength(0);
});
