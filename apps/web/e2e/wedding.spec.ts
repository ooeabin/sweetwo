import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockOnboarding, type MemDb } from './onboarding-mock';


const axe = async (page: Page) => {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const heading = (page: Page, name: string | RegExp) =>
  expect(page.getByRole('heading', { name }).first()).toBeVisible();
const NOW = new Date('2026-10-07T10:00:00+09:00');

// 결혼 비용(docs/spec/22-goals.md G-07). 예비부부 찬우, 예빈.
function seed(db: MemDb, state: 'not_joined' | 'connected') {
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
    couple_state: state,
    partner_nickname: '예빈',
    marriage_status: 'engaged',
    prep_money_mode: 'together',
    wedding_date: '2027-01-09',
    wedding_budget: 30_000_000,
    family_support: 5_000_000,
    wedding_saved: 8_000_000,
    partner_income: 2_700_000,
    partner_income_estimated: false,
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
  if (state === 'connected')
    db.partner = {
      id: 'yebin',
      nickname: '예빈',
      side: 'bride',
      employment: 'regular',
      monthly_income: 2_700_000,
      payday: 10,
      payday_last: false,
      allowance: 500_000,
    };
  db.goals.push({
    id: 'gw',
    template: 'wedding',
    name: '결혼 비용',
    kind: 'once',
    owner: 'together',
    priority: 0,
    target_amount: 25_000_000,
    other_held: 8_000_000,
    deadline: '2027-01-01',
    amount_estimated: false,
    deadline_estimated: false,
    after_marriage: false,
    status: 'active',
    details: {},
    created_by: db.me.id,
    created_at: '2026-08-20T00:00:00Z',
    deleted_at: null,
  });
}

test('결혼 비용(G-07): 항목 추가 → 이번 달 결제했어요 → 예산 넘으면 총예산 늘리기(합류 전 바로)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db, 'not_joined');

  await page.goto('/goals');
  await page
    .getByRole('button', { name: /결혼 비용/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/goals\/wedding$/);
  await heading(page, '결혼 비용');
  const sum = page.getByRole('region', { name: '결혼 비용' });
  await expect(sum.locator('.hg-listrow', { hasText: '총예산' })).toContainText('3,000만 원');
  await expect(sum.locator('.hg-listrow', { hasText: '양가 지원' })).toContainText('500만 원');
  await expect(page.getByText('D-94')).toBeVisible();
  await axe(page);

  await page.getByRole('button', { name: '+ 항목 추가' }).click();
  await heading(page, '어떤 항목이에요?');
  await page.getByRole('radio', { name: '예물' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await heading(page, '예산은 얼마예요?');
  await page.getByLabel('예산은 얼마예요?').fill('5000000');
  await page.getByRole('button', { name: '다음' }).click();
  await heading(page, '계약금과 잔금 날짜가 정해졌나요?');
  await page.getByRole('radio', { name: '정해졌어요' }).click();
  await page.getByLabel('계약금', { exact: true }).fill('1000000');
  await page.getByLabel('계약금 날짜', { exact: true }).fill('2026-10-14');
  await page.getByLabel('잔금', { exact: true }).fill('4000000');
  await page.getByLabel('잔금 날짜', { exact: true }).fill('2026-12-05');
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();
  await heading(page, '누가 내나요?');
  await page.getByRole('radio', { name: '우리(결혼 준비 통장)' }).click();

  await expect(page).toHaveURL(/\/goals\/wedding$/);
  const table = page.getByRole('table', { name: '결혼 비용 항목' });
  await expect(table.getByRole('row', { name: /예물/ })).toContainText('500만 원');
  await expect(table.getByRole('row', { name: /예물/ })).toContainText('우리');
  await expect(page.getByText('월별 나갈 돈과 모일 돈')).toBeVisible();
  await axe(page);

  // 이번 달 결제일인 계약금 → 결제했어요
  await page.getByRole('button', { name: '결제했어요' }).click();
  await heading(page, '예물 계약금, 실제로 얼마 냈어요?');
  await expect(page.getByText('예산 100만 원')).toBeVisible();
  await page.getByRole('button', { name: '다음' }).click();
  await heading(page, '100만 원, 어디서 냈어요?');
  await page.getByRole('radio', { name: '결혼 준비 통장' }).click();
  await expect(page).toHaveURL(/\/goals\/wedding$/);
  await expect(table.getByRole('row', { name: /예물/ })).toContainText('✓');
  await expect(page.getByRole('button', { name: '결제했어요' })).toHaveCount(0);
  await expect(sum.locator('.hg-listrow', { hasText: '결제 완료' })).toContainText('100만 원');

  // 잔금이 예산보다 많으면 → 총예산 늘리기
  await page.goto('/goals/wedding/pay/wi-1/balance');
  await page.getByLabel('예물 잔금, 실제로 얼마 냈어요?').fill('4500000');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('radio', { name: '결혼 준비 통장' }).click();
  await heading(page, '예물이 예산보다 50만 원 넘었어요');
  await axe(page);
  await page.getByRole('radio', { name: '총예산 늘리기' }).click();
  await expect(page).toHaveURL(/\/goals\/wedding$/);
  expect(db.space?.wedding_budget).toBe(30_500_000);
  expect(db.weddingItems[0]).toMatchObject({ budget: 5_500_000, payer: 'us' });
});

test('결혼 비용: 연결된 부부는 총예산 바꾸기가 제안', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db, 'connected');
  await page.goto('/goals/wedding');
  await page.getByRole('button', { name: /총예산/ }).click();
  await heading(page, '총예산은 얼마예요?');
  await page.getByLabel('총예산은 얼마예요?').fill('32000000');
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByText('예빈님에게 제안했어요')).toBeVisible();
  expect(db.space?.wedding_budget).toBe(30_000_000);
  expect(db.proposals).toContainEqual(
    expect.objectContaining({ item: 'wedding_budget', after: { budget: 32_000_000 } }),
  );
});
