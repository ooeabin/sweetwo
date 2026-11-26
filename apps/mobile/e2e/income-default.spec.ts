import { test, expect, type Page } from '@playwright/test';
import { emptyV22, mockOnboarding, mockSaving, newSavingDb, seed } from './mocks';
import { checkRow } from './w02-row';

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

const LIST = /\/salary\/money-in\/list$/;

// W-02는 한 줄 “이번 달 수입 350만 원 ›”만(2026-11-23 바탕 기준), 기본값 연필·‘+ 수입 입력하기’·기록은 W-20b 맨 위
async function openList(page: Page) {
  await page.getByRole('group', { name: '이번 달 수입' }).getByRole('button').click();
  await expect(page).toHaveURL(LIST);
}

test('기록 0건: 한 줄 3,500,000원 → W-20b 월급 3,500,000원 + 연필 → 3,000,000원으로 고침 → 기록 1건, 첫 확인 뒤에도 1건', async ({
  page,
}) => {
  const { sv } = await open(page);
  const line = page.getByRole('group', { name: '이번 달 수입' });
  await expect(line).toContainText('3,500,000원');
  await openList(page);
  const hero = page.locator('.hg-fdhero');
  await expect(hero.locator('.hg-fdhero__amt')).toContainText('3,500,000원');
  await expect(page.getByText('+3,500,000원')).toBeVisible();
  await expect(page.getByText('자동', { exact: false }).first()).toBeVisible();
  expect(sv.moneyIns).toHaveLength(0); // 저장 전에는 기록 없음
  await hero.getByRole('button', { name: /월급 금액 고치기/ }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('월급 금액').fill('3000000');
  await sheet.getByRole('button', { name: '확인' }).click();
  await expect(hero.locator('.hg-fdhero__amt')).toContainText('3,000,000원');
  await expect(page.getByText('+3,000,000원')).toBeVisible();
  expect(sv.moneyIns.filter((m) => m.source === 'payday_auto')).toHaveLength(1);
  expect(sv.moneyIns[0]).toMatchObject({ amount: 3_000_000, source: 'payday_auto' });
  // 첫 확인을 해도 한 줄, 금액 그대로
  await page.goto('/salary');
  await checkRow(page, '청약');
  await expect(page.getByRole('group', { name: '이번 달 수입' })).toContainText('3,000,000원');
  expect(sv.moneyIns.filter((m) => !m.deleted_at)).toHaveLength(1);
  expect(sv.moneyIns[0]?.amount).toBe(3_000_000);
});

test('손대지 않고 첫 확인 → 프로필 월급으로 자동 기록(그대로)', async ({ page }) => {
  const { sv } = await open(page);
  await checkRow(page, '청약');
  const line = page.getByRole('group', { name: '이번 달 수입' });
  await expect(line).toContainText('3,500,000원');
  expect(sv.moneyIns[0]).toMatchObject({ amount: 3_500_000, source: 'payday_auto' });
});

test('0원으로 저장하면 기록 없이 닫고 다시 안 물음', async ({ page }) => {
  const { sv } = await open(page);
  await openList(page);
  await page
    .locator('.hg-fdhero')
    .getByRole('button', { name: /월급 금액 고치기/ })
    .click();
  await page.getByRole('dialog').getByLabel('월급 금액').fill('0');
  await page.getByRole('dialog').getByRole('button', { name: '확인' }).click();
  await expect(page.locator('.hg-fdhero__amt')).toContainText('0원');
  expect(sv.moneyIns).toHaveLength(0);
  await page.goto('/salary');
  await checkRow(page, '청약');
  await expect(page.getByText('청약').first()).toBeVisible();
  expect(sv.moneyIns).toHaveLength(0);
});

test('월급 0원 + 기록 없음: W-02 한 줄 값 0원, W-20b 큰 금액 0원 + 연필, 기본값 줄 없음', async ({
  page,
}) => {
  await open(page, (db) => Object.assign(db.me, { monthly_income: 0 }));
  await expect(page.getByRole('group', { name: '이번 달 수입' })).toContainText('0원');
  await openList(page);
  await expect(page.locator('.hg-fdhero__amt')).toContainText('0원');
  await expect(
    page.locator('.hg-fdhero').getByRole('button', { name: /월급 금액 고치기/ }),
  ).toBeVisible();
  await expect(page.getByText(/^\+/)).toHaveCount(0);
});

test('템플릿 줄 0개: 3단계 안내 + 주 버튼 → 월급 계획 템플릿', async ({ page }) => {
  await open(page, (db) => {
    const list = db.checklists[0];
    if (list) list.pay_check_line = [];
  });
  await expect(page.getByRole('heading', { name: '월급날 루틴, 한 번에 끝내기' })).toBeVisible();
  await expect(page.getByRole('group', { name: '이번 달 수입' })).toHaveCount(0);
  await expect(page.getByText('확인할 항목이 없어요')).toHaveCount(0);
  await page.getByRole('button', { name: '월급 계획 세우기' }).click();
  await expect(page).toHaveURL(/\/salary\/plan/);
});
