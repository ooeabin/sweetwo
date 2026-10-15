import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockOnboarding, type MemDb } from './onboarding-mock';

// 목표 메뉴 G-01 목록, G-02 상세(docs/spec/22-goals.md). 찬우, 예빈 합류.

const axe = async (page: Page) => {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const heading = (page: Page, name: string | RegExp) =>
  expect(page.getByRole('heading', { name }).first()).toBeVisible();
const NOW = new Date('2026-10-07T10:00:00+09:00');

const goal = (
  id: string,
  template: string,
  name: string,
  priority: number,
  target: number,
  deadline: string,
  extra: Record<string, unknown> = {},
) => ({
  id,
  template,
  name,
  kind: 'once',
  owner: 'together',
  priority,
  target_amount: target,
  other_held: 0,
  deadline,
  amount_estimated: false,
  deadline_estimated: false,
  after_marriage: false,
  status: 'active',
  details: {},
  created_by: 'chanwoo',
  created_at: '2026-08-20T00:00:00Z',
  deleted_at: null,
  ...extra,
});

/** 합류한 신혼부부. 저축 가능 = 620 − 100 − 185 = 335만 */
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
    living_budget: 550_000,
    loan_repayment: 300_000,
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
  db.goals.push(
    goal('g1', 'emergency', '비상금', 0, 5_550_000, '2027-10-01', { other_held: 1_000_000 }),
    goal('g2', 'home', '내 집 마련', 1, 150_000_000, '2031-10-01', { owner: 'me' }),
    goal('g3', 'travel', '여행', 2, 3_000_000, '2027-06-01', { status: 'paused' }),
  );
  for (const g of db.goals) g.created_by = db.me.id;
  db.plans.push({
    args: {
      p_label_month: '2026-09-01',
      p_cycle_start: '2026-09-25',
      p_cycle_end: '2026-10-24',
      p_first_adjust: 3_000_000,
      p_merged_close: false,
      p_is_temp: false,
      p_snapshot: { parts: { living: 1_850_000, goalFund: 3_000_000, emergency: 350_000 } },
      p_lines: [
        { target: 'goal', goal_id: 'g1', amount: 350_000 },
        { target: 'goal', goal_id: 'g2', amount: 3_000_000 },
      ],
    },
  });
  db.closes.push({ id: 'close-1', status: 'done', deleted_at: null });
  db.deposits.push(
    { id: 'dep-1', month_close_id: 'close-1', goal_id: 'g1', name: '비상금', amount: 350_000 },
    {
      id: 'dep-2',
      month_close_id: 'close-1',
      goal_id: 'g2',
      name: '내 집 마련',
      amount: 2_500_000,
    },
  );
}

test('목표 목록 → 상세: 진행, 월 배분, 접힌 목록, 월별 기록', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);

  // 이번 달에서 목표 탭으로
  await page.goto('/');
  await page.getByRole('link', { name: '목표' }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/goals$/);

  // 요약: 보류 목표 빼고 월 배분 합 = 저축 가능 전부(남는 돈은 주거 목표에)
  await expect(page.getByText('매달 목표에 335만 원씩 모으고 있어요')).toBeVisible();
  await expect(page.getByText('저축 가능 335만 원')).toBeVisible();

  // 비상금: 보유 100 + 넣은 돈 35 = 135 / 555
  const emergency = page.getByRole('button', { name: /비상금/ });
  await expect(emergency).toContainText('135만 / 555만 원');
  await expect(emergency).toContainText('진행 중');
  await expect(emergency.getByRole('img', { name: '담당 찬우, 예빈' })).toBeVisible();
  const home = page.getByRole('button', { name: /내 집 마련/ });
  await expect(home).toContainText('250만 / 15,000만 원');
  await expect(home.getByRole('img', { name: '담당 찬우' })).toBeVisible();
  await expect(home).toContainText(/월 \d+만 원씩, \d{4}년 \d+월 달성 예정/);

  // 보류 목표는 접힌 목록
  await expect(page.getByRole('button', { name: /여행/ })).toHaveCount(0);
  await page.getByRole('button', { name: '보류·달성·사용 완료 1개' }).click();
  await expect(page.getByRole('button', { name: /여행/ })).toContainText('보류');
  await axe(page);

  // 상세
  await home.click();
  await expect(page).toHaveURL(/\/goals\/g2$/);
  await heading(page, '내 집 마련');
  await expect(page.locator('.hg-card', { hasText: '목표 금액' })).toContainText('1억 5,000만 원');
  await expect(page.locator('.hg-card', { hasText: '보유액' })).toContainText('250만 원');
  await expect(page.locator('.hg-card', { hasText: '남은 금액' })).toContainText('1억 4,750만 원');
  await expect(page.locator('.hg-card', { hasText: '기한' })).toContainText('2031년 10월');
  const sept = page.locator('.hg-listrow', { hasText: '2026년 9월' });
  await expect(sept).toContainText('계획 300만 원');
  await expect(sept).toContainText('실제 250만 원');
  await expect(sept).toContainText('−50만 원');
  await expect(page.locator('.hg-listrow', { hasText: '만든 날' })).toContainText(
    '2026년 8월 20일',
  );
  await axe(page);

  await page.getByRole('button', { name: '뒤로' }).click();
  await expect(page).toHaveURL(/\/goals$/);
});
