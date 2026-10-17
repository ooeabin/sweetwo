import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockOnboarding, type MemDb } from './onboarding-mock';

// 이번 달 H-04 할 일과 W-04j 지출 적기(docs/spec/19-this-month.md, 21-month-close.md). 찬우, 예빈 미합류.

const axe = async (page: Page) => {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};

/** 온보딩을 10월 7일에 마친 신혼부부(생활비 55만, 9월 월급 플랜) */
function seed(db: MemDb) {
  Object.assign(db.me, {
    nickname: '찬우',
    side: 'groom',
    birth_year: 1994,
    employment: 'regular',
    monthly_income: 3_500_000,
    payday: 25,
    payday_last: false,
    allowance: 500_000,
    onboarding_step: 'O-67',
    onboarding_done_at: '2026-10-07T01:00:00Z',
    space_id: 'space-1',
  });
  db.space = {
    id: 'space-1',
    couple_state: 'not_joined',
    partner_nickname: '예빈',
    marriage_status: 'married',
    wedding_date: '2025-05-17',
    partner_income: 2_500_000,
    partner_income_estimated: true,
    partner_income_unknown: false,
    fixed_total: 1_000_000,
    fixed_total_estimated: false,
    living_budget: 550_000,
    living_budget_estimated: false,
    loan_repayment: 300_000,
    split_mode: 'custom',
    split_ratio: 60,
    split_deferred: false,
    prep_money_mode: null,
    account_mode: 'roles',
    base_day: null,
    base_day_last: false,
  };
  db.plans.push({
    args: {
      p_label_month: '2026-09-01',
      p_cycle_start: '2026-09-25',
      p_cycle_end: '2026-10-24',
      p_first_adjust: 3_000_000,
      p_merged_close: false,
      p_is_temp: true,
      p_snapshot: { parts: { living: 1_110_000, goalFund: 1_500_000, emergency: 390_000 } },
      p_lines: [],
    },
  });
}

test('할 일: 첫 주 할 일은 하루 하나씩, 내일 할게요, 초대 코드 복사', async ({ page, context }) => {
  const now = new Date('2026-10-09T10:00:00+09:00'); // 3일째
  await page.clock.setFixedTime(now);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const db = await mockOnboarding(page, { now });
  seed(db);
  await page.goto('/');

  const card = page.getByRole('region', { name: '할 일' });
  await expect(card).toContainText('3개 남았어요');
  await expect(card).toContainText('예빈님을 초대해 주세요');
  await expect(card).toContainText('자산 정리하기');
  await expect(card).toContainText('대출 정리하기');
  await expect(card).not.toContainText('고정지출 나누기');
  await axe(page);

  await card.getByRole('button', { name: '내일 할게요' }).first().click();
  await expect(card).toContainText('2개 남았어요');
  await expect(card).not.toContainText('자산 정리하기');
  expect(db.todos.find((t) => t.kind === 'assets')).toMatchObject({
    status: 'snoozed',
    snoozed_until: '2026-10-10',
  });
  expect(db.todos.find((t) => t.kind === 'invest')).toMatchObject({ open_on: '2026-10-13' });

  await card.getByRole('button', { name: '코드 복사' }).click();
  await expect(page.getByText('복사했어요')).toBeVisible();
});

test('지출 적기: 항목별로 적으면 칸을 벗어날 때 저장, 남은 생활비에 반영', async ({ page }) => {
  const now = new Date('2026-10-07T10:00:00+09:00');
  await page.clock.setFixedTime(now);
  const db = await mockOnboarding(page, { now });
  seed(db);
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: '찬우님, 이번 달 생활비가 55만 원 남았어요' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '지출 적기' }).click();

  await expect(page.getByRole('heading', { name: '이번 달 쓴 돈을 적어요' })).toBeVisible();
  await expect(page.getByLabel('외식·배달')).toBeVisible();
  expect(db.categories).toHaveLength(18);
  await expect(page.getByText('공동 고정지출')).toBeVisible();
  await axe(page);

  await page.getByLabel('외식·배달').fill('410000');
  await page.getByLabel('장보기(식재료)').click(); // 칸을 벗어나면 저장
  await expect.poll(() => db.spends.map((x) => x.amount)).toEqual([410_000]);
  expect(db.closes[0]).toMatchObject({ plan_id: 'plan-1' });
  // 이번 달 쓴 돈 = 고정 100 + 대출 30 + 변동 41
  await expect(page.locator('.hg-spend__total')).toContainText('171');

  await page.getByRole('button', { name: '항목 추가' }).click();
  await page.getByLabel('항목 이름').fill('정수기');
  await page.getByRole('button', { name: '추가', exact: true }).click();
  await expect(page.getByLabel('정수기')).toBeVisible();

  await page.getByRole('button', { name: '다 적었어요' }).click();
  await expect(
    page.getByRole('heading', { name: '찬우님, 이번 달 생활비가 14만 원 남았어요' }),
  ).toBeVisible();
});

test('공지 띠(AD-10): 필독이 먼저, 보기로 펼침, 일반 공지는 닫으면 다시 안 보임', async ({
  page,
}) => {
  const now = new Date('2026-10-07T10:00:00+09:00');
  await page.clock.setFixedTime(now);
  const db = await mockOnboarding(page, { now });
  seed(db);
  db.notices.push(
    {
      id: 'n1',
      kind: 'info',
      title: '새 기능이 나왔어요',
      body: '',
      importance: 'normal',
      platforms: ['web'],
    },
    {
      id: 'n2',
      kind: 'maintenance',
      title: '10월 20일 새벽 점검',
      body: '오전 2시부터 4시까지 저장이 안 돼요',
      importance: 'must',
      platforms: ['desktop', 'web'],
    },
  );
  await page.goto('/');
  await expect(page.getByText('10월 20일 새벽 점검')).toBeVisible();
  await expect(page.locator('.hg-body__banner').getByRole('button', { name: '닫기' })).toHaveCount(
    0,
  );
  const band = page.locator('.hg-body__banner');
  await band.getByRole('button', { name: '보기' }).click();
  await expect(page.getByText('오전 2시부터 4시까지 저장이 안 돼요')).toBeVisible();
  await axe(page);

  db.notices.splice(1, 1);
  await page.reload();
  await expect(page.getByText('새 기능이 나왔어요')).toBeVisible();
  await page.locator('.hg-body__banner').getByRole('button', { name: '닫기' }).click();
  await expect(page.getByText('새 기능이 나왔어요')).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('이번 달')).not.toHaveCount(0);
  await expect(page.getByText('새 기능이 나왔어요')).toHaveCount(0);
});
