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

// 계획 다시 세우기(docs/spec/23-assets.md F-05f·F-07). 찬우, 예빈 합류.
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
    couple_state: 'connected',
    partner_nickname: '예빈',
    marriage_status: 'married',
    partner_income: 2_700_000,
    partner_income_estimated: false,
    partner_income_unknown: false,
    fixed_total: 1_000_000,
    living_budget: 1_300_000,
    loan_repayment: 0,
    split_mode: 'custom',
    split_ratio: 60,
    split_deferred: false,
    account_mode: 'roles',
    base_day: null,
    base_day_last: false,
  };
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
    id: 'g1',
    template: 'emergency',
    name: '비상금',
    kind: 'once',
    owner: 'together',
    priority: 0,
    target_amount: 9_000_000,
    other_held: 6_000_000,
    deadline: '2027-10-01',
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

test('기간 수입 변경(F-05f·F-07c): 기간 → 그 기간 수입 → 비교(보충, 비상금 모자람, 분담 제안) → 적용', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/assets/money');
  await page.getByRole('button', { name: '기간 정해서 바꾸기' }).click();
  await heading(page, '언제부터 바뀌어요?');
  await page.getByLabel('년').fill('2027');
  await page.getByRole('radio', { name: '1월', exact: true }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await heading(page, '언제까지예요?');
  await page.getByLabel('년').fill('2027');
  await page.getByRole('radio', { name: '3월', exact: true }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await heading(page, '그 기간 월 수입은 얼마예요?');
  await page.getByLabel('그 기간 월 수입은 얼마예요?').fill('1200000');
  await page.getByRole('button', { name: '다음' }).click();

  await heading(page, '바뀌는 점을 확인해 주세요');
  const t = page.getByRole('table', { name: '바뀌는 점을 확인해 주세요' });
  await expect(t.getByRole('columnheader', { name: '2027년 1월 ~ 2027년 3월' })).toBeVisible();
  await expect(t.getByRole('row', { name: /월 수입/ })).toContainText('620만 원');
  await expect(t.getByRole('row', { name: /월 수입/ })).toContainText('390만 원');
  // 감소 230만 × 3달 = 690만 > 비상금 600만 → 월 200만, 90만 모자람
  await expect(t.getByRole('row', { name: /비상금에서 보충/ })).toContainText('월 200만 원');
  await expect(t.getByRole('row', { name: /비상금에서 보충/ })).toContainText('바로 반영');
  await expect(t.getByRole('row', { name: /비상금 잔액/ })).toContainText('0원');
  await expect(page.getByText('비상금이 90만 원 모자라요')).toBeVisible();
  await expect(t.getByRole('row', { name: /분담/ })).toContainText('60:40');
  await expect(t.getByRole('row', { name: /분담/ })).toContainText('버는 만큼 31:69');
  await axe(page);
  await page.getByRole('button', { name: '적용하기' }).click();
  await expect(page.getByText('적용했어요. 분담은 예빈님에게 제안했어요')).toBeVisible();
  await expect(page).toHaveURL(/\/assets\/money$/);
  expect(db.incomePeriods).toEqual([
    expect.objectContaining({
      start_month: '2027-01-01',
      end_month: '2027-03-01',
      amount: 1_200_000,
      supplement: 2_000_000,
    }),
  ]);
  expect(db.proposals).toContainEqual(
    expect.objectContaining({ item: 'split', after: { mode: 'income' } }),
  );
});

test('계획 다시 세우기(F-07a~c): 이직·수입 변화 + 출산 → 다시 묻기 → 비교(목표 달성 시기) → 수입은 바로, 생활비는 제안', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/assets/replan');
  await heading(page, '어떤 게 바뀌었나요?');
  await page.getByRole('button', { name: '이직·수입 변화' }).click();
  await page.getByRole('button', { name: '출산' }).click();
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();
  await heading(page, '찬우님 한 달 수입은 얼마예요?');
  await expect(page.getByLabel('찬우님 한 달 수입은 얼마예요?')).toHaveValue(/3,?500,?000/);
  await page.getByLabel('찬우님 한 달 수입은 얼마예요?').fill('4000000');
  await page.getByRole('button', { name: '다음' }).click();
  await heading(page, '생활비는 한 달에 얼마로 할까요?');
  await page.getByLabel('생활비는 한 달에 얼마로 할까요?').fill('1500000');
  await page.getByRole('button', { name: '다음' }).click();

  await heading(page, '바뀌는 점을 확인해 주세요');
  const t = page.getByRole('table', { name: '바뀌는 점을 확인해 주세요' });
  await expect(t.getByRole('row', { name: /저축 가능 금액/ })).toBeVisible();
  await expect(t.getByRole('row', { name: /비상금 달성/ })).toBeVisible();
  await expect(t.getByRole('row', { name: /생활비/ })).toContainText('제안');
  await axe(page);
  await page.getByRole('button', { name: '적용하기' }).click();
  await expect(page.getByText('예빈님에게 제안했어요')).toBeVisible();
  expect(db.me.monthly_income).toBe(4_000_000);
  expect(db.space?.living_budget).toBe(1_300_000);
  expect(db.proposals).toContainEqual(
    expect.objectContaining({ item: 'living_budget', after: { living_budget: 1_500_000 } }),
  );
});
