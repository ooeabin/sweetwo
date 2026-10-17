import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockOnboarding, type MemDb } from './onboarding-mock';

// 캘린더 Y-01 목록, Y-04 달력의 돈 날짜(docs/spec/24-calendar.md). 찬우(월급날 25일)와 합류한 예빈(10일)

const axe = async (page: Page) => {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const NOW = new Date('2026-10-07T10:00:00+09:00');

function seed(db: MemDb) {
  Object.assign(db.me, {
    nickname: '찬우',
    side: 'groom',
    employment: 'regular',
    monthly_income: 3_500_000,
    payday: 25,
    payday_last: false,
    allowance: 500_000,
    onboarding_step: 'O-67',
    onboarding_done_at: '2026-09-20T01:00:00Z',
    space_id: 'space-1',
  });
  db.space = {
    id: 'space-1',
    created_by: db.me.id,
    couple_state: 'connected',
    partner_nickname: '예빈',
    marriage_status: 'married',
    partner_income: 2_500_000,
    fixed_total: 1_000_000,
    living_budget: 550_000,
    loan_repayment: 300_000,
    split_mode: 'half',
    account_mode: 'roles',
    base_day: 25,
    base_day_last: false,
  };
  db.partner = {
    id: 'yebin',
    nickname: '예빈',
    side: 'bride',
    employment: 'regular',
    monthly_income: 2_500_000,
    payday: 10,
    payday_last: false,
    allowance: 500_000,
  };
  db.assets.push({
    id: 'a-sav',
    side: 'asset',
    grp: 'deposit',
    kind: 'saving',
    name: '청년 적금',
    amount: 3_000_000,
    principal: null,
    maturity_date: '2026-10-30',
    owner: 'joint',
    owner_user_id: null,
    visibility: 'all',
    status: 'held',
    created_by: db.me.id,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    deleted_at: null,
  });
  db.incomeEvents.push({
    id: 'ev',
    owner_user_id: db.me.id,
    name: '상여금',
    amount: 2_000_000,
    month: 11,
    yearly: true,
    created_at: '2026-09-21T00:00:00Z',
    deleted_at: null,
  });
}

test('목록(Y-01): 60일 안 돈 날짜, 누르면 해당 화면, 챙길 날 빈 상태, 필터', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/');
  await page.getByRole('link', { name: '캘린더' }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/calendar\/list$/);
  await expect(page.getByText('양가 부모님 생신부터 챙겨볼까요?')).toBeVisible();
  const money = page.getByRole('region', { name: '돈 날짜' });
  // 예빈 월급날 10일(토) → 9일(금), 정리 시작 22일, 찬우 월급날 25일(일) → 23일(금)
  const rows = await money.getByRole('button').allTextContents();
  expect(rows[0]).toContain('예빈 월급날');
  expect(rows[0]).toContain('10월 9일');
  expect(rows.join('|')).toContain('정리 시작');
  expect(rows.join('|')).toContain('청년 적금 만기');
  expect(rows.join('|')).toContain('상여금 들어오는 날');
  await axe(page);

  await page.getByRole('button', { name: '챙길 날' }).click();
  await expect(money).toHaveCount(0);
  await page.getByRole('button', { name: '돈 날짜' }).click();
  await expect(page.getByText('양가 부모님 생신부터 챙겨볼까요?')).toHaveCount(0);
  await page.getByRole('button', { name: /청년 적금 만기/ }).click();
  await expect(page).toHaveURL(/\/assets\/a-sav$/);
});

test('달력(Y-04): 돈 날짜 점, 정리 기간 띠, 고른 날 일정 → 화면, 달 넘기기, 보기 기억', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/calendar/month');
  await expect(page.getByRole('button', { name: '10월 7일' })).toHaveAttribute(
    'aria-current',
    'date',
  );
  await expect(page.getByText('이 날짜엔 없어요')).toBeVisible();
  await axe(page);

  const d23 = page.getByRole('button', { name: '10월 23일, 일정 1개' });
  await expect(d23).toHaveClass(/is-band/);
  await d23.click();
  await expect(page.getByText('10월 23일(금)')).toBeVisible();
  await page.getByRole('button', { name: /찬우 월급날/ }).click();
  await expect(page).toHaveURL(/\/plan$/);

  await page.goto('/calendar');
  await expect(page).toHaveURL(/\/calendar\/month$/);
  await page.getByRole('button', { name: '다음 달' }).click();
  await expect(page.getByRole('region', { name: '2026년 11월' })).toBeVisible();
  await page.getByRole('button', { name: '11월 1일, 일정 1개' }).click();
  await expect(page.getByRole('button', { name: /상여금 들어오는 날/ })).toBeVisible();
  // 챙길 날만 보면 돈 날짜 점·띠 없음
  await page.getByRole('button', { name: '챙길 날' }).click();
  await expect(page.getByRole('button', { name: '11월 1일' })).toBeVisible();
});
