import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { mockOnboarding, type MemDb } from './onboarding-mock';

// 함께 모드(docs/spec/21-month-close.md W-04a 4~8번, W-04 끝 6~8번, 함께 정하기 3번). 예빈 화면, 찬우가 정리 시작.
const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const heading = (page: Page, name: string | RegExp) =>
  expect(page.getByRole('heading', { name })).toBeVisible();
const NOW = new Date('2026-10-23T10:00:00+09:00');

function seed(db: MemDb, close: Record<string, unknown>) {
  Object.assign(db.me, {
    nickname: '예빈',
    side: 'bride',
    employment: 'regular',
    monthly_income: 2_700_000,
    payday: 10,
    payday_last: false,
    allowance: 500_000,
    onboarding_step: 'P-11',
    onboarding_done_at: '2026-09-07T01:00:00Z',
    space_id: 'space-1',
  });
  db.space = {
    id: 'space-1',
    created_by: 'chanwoo',
    couple_state: 'connected',
    partner_nickname: '예빈',
    marriage_status: 'married',
    partner_income: 3_500_000,
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
  db.partner = {
    id: 'chanwoo',
    nickname: '찬우',
    side: 'groom',
    employment: 'regular',
    monthly_income: 3_500_000,
    payday: 25,
    payday_last: false,
    allowance: 500_000,
  };
  db.plans.push({
    args: {
      p_label_month: '2026-09-01',
      p_cycle_start: '2026-09-25',
      p_cycle_end: '2026-10-24',
      p_first_adjust: 3_000_000,
      p_merged_close: false,
      p_is_temp: false,
      p_snapshot: {
        parts: { living: 1_100_000, goalFund: 1_000_000, emergency: 300_000 },
        income: 6_200_000,
      },
      p_lines: [],
    },
  });
  db.closes.push({
    id: 'close-1',
    status: 'started',
    started_by: 'chanwoo',
    started_at: '2026-10-23T00:30:00Z',
    together_by: null,
    together_at: null,
    together_left_at: null,
    deleted_at: null,
    ...close,
  });
}

test('찬우가 정리 중: “찬우님이 정리 중이에요” → 같이 하기 → 함께 정리 중', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db, {});
  await page.goto('/month/close/w-04a');
  await heading(page, '찬우님이 정리 중이에요');
  await expect(page.getByText('같이 하면 바꾼 값이 바로 확정돼요')).toBeVisible();
  await expect(page.getByRole('button', { name: '보기만' })).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '같이 하기' }).click();
  await expect(page).toHaveURL(/\/month\/close\/w-04j$/);
  await expect(page.getByRole('status').filter({ hasText: '함께 정리 중' })).toBeVisible();
  expect(db.closes[0]).toMatchObject({ together_by: db.me.id, together_left_at: null });
  await axe(page);
});

test('보기만: 읽기 전용 + “보기만 하는 중이에요” → 같이 하기로 바꿈', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db, {});
  await page.goto('/month/close/w-04a');
  await page.getByRole('button', { name: '보기만' }).click();
  await expect(page).toHaveURL(/\/month\/close\/w-04j$/);
  const bar = page.getByRole('status').filter({ hasText: '보기만 하는 중이에요' });
  await expect(bar).toBeVisible();
  await expect(page.locator('[inert]')).toHaveCount(1);
  await axe(page);
  await bar.getByRole('button', { name: '같이 하기' }).click();
  await expect(page.getByRole('status').filter({ hasText: '함께 정리 중' })).toBeVisible();
  await expect(page.locator('[inert]')).toHaveCount(0);
});

test('함께 모드 끝: 바뀐 값은 “확정”, 다음 달 플랜부터 적용', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db, {
    status: 'done',
    closed_at: '2026-10-23T01:00:00Z',
    together_by: 'yebin-me',
    together_at: '2026-10-23T00:40:00Z',
  });
  db.proposals.push({
    id: 'p-1',
    space_id: 'space-1',
    item: 'living_budget',
    target_id: null,
    proposer: 'chanwoo',
    before: { living_budget: 550_000 },
    after: { living_budget: 600_000 },
    apply_on: '2026-10-25',
    status: 'applied',
    response: 'like',
    month_close_id: 'close-1',
    round_trips: 0,
    oppose_count: 0,
    together: false,
    created_at: '2026-10-23T00:50:00Z',
  });
  await page.goto('/month/close/w-04-end');
  await expect(page.getByText('바뀐 값 1개를 확정했어요')).toBeVisible();
  await expect(page.getByText('확정', { exact: true })).toBeVisible();
  await expect(page.getByText('10월 월급 플랜부터 적용돼요')).toBeVisible();
  await axe(page);
});
