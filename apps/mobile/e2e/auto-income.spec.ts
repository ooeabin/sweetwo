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

test('첫 확인 → 수입 카드에 “월급 +3,500,000원 자동”, 지우면 다시 확인해도 안 생김', async ({
  page,
}) => {
  const { sv } = await open(page);
  const income = page.getByRole('group', { name: '이번 달 수입' });
  await expect(income).toContainText('3,500,000원'); // 기본값(저장 전)
  // 줄 하나를 확인하면 월급이 수입으로 들어옴
  await checkRow(page, '청약');
  await expect(income).toContainText('3,500,000원');
  expect(sv.moneyIns.filter((m) => m.source === 'payday_auto')).toHaveLength(1);
  // 다른 줄을 더 확인해도 한 줄 그대로
  await checkRow(page, '내 집 마련');
  await expect(page.getByRole('tab', { name: /^완료 2$/ })).toBeVisible();
  expect(sv.moneyIns.filter((m) => m.source === 'payday_auto')).toHaveLength(1);
  // W-20b에서 지우기
  await income.getByRole('button').click();
  await expect(page).toHaveURL(/\/salary\/money-in\/list/);
  await expect(page.getByText(/, 자동/)).toBeVisible();
  await page.getByRole('button', { name: '3,500,000원 기록 메뉴' }).click();
  await page.getByRole('menuitem', { name: '지우기' }).click();
  await expect(page.getByText('아직 적은 수입이 없어요')).toBeVisible();
  // 같은 사이클에서 다시 확인(한 번에 모두)해도 다시 안 생김
  await page.goto('/salary');
  await page.getByRole('button', { name: '모두 계획대로 됐어요' }).click();
  await expect(page.locator('.hg-toast')).toContainText('계획대로 됐어요');
  await expect(page.getByRole('group', { name: '이번 달 수입' })).not.toContainText('만 원');
  expect(sv.moneyIns.filter((m) => !m.deleted_at)).toHaveLength(0);
});
