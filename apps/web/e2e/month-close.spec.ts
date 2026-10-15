import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockOnboarding, type MemDb } from './onboarding-mock';

// 월말 정리 기본 3단계(docs/spec/21-month-close.md): W-04a → W-04j → W-04k → W-04g → 끝. 찬우, 예빈 미합류.

const axe = async (page: Page) => {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const heading = (page: Page, name: string | RegExp) =>
  expect(page.getByRole('heading', { name })).toBeVisible();
const next = (page: Page) => page.getByRole('button', { name: '다음' }).click();

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
    onboarding_done_at: '2026-10-07T01:00:00Z',
    space_id: 'space-1',
  });
  db.space = {
    id: 'space-1',
    couple_state: 'not_joined',
    partner_nickname: '예빈',
    marriage_status: 'married',
    partner_income: 2_500_000,
    partner_income_estimated: true,
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
  const goal = (
    id: string,
    template: string,
    name: string,
    priority: number,
    target: number,
    deadline: string,
  ) => ({
    id,
    template,
    name,
    kind: 'once',
    priority,
    target_amount: target,
    other_held: 0,
    deadline,
    amount_estimated: false,
    deadline_estimated: false,
    after_marriage: false,
    status: 'active',
    details: {},
    deleted_at: null,
  });
  db.goals.push(
    goal('g1', 'emergency', '비상금', 0, 7_800_000, '2027-10-01'),
    goal('g2', 'home', '내 집 마련', 1, 150_000_000, '2031-10-01'),
  );
  db.plans.push({
    args: {
      p_label_month: '2026-09-01',
      p_cycle_start: '2026-09-25',
      p_cycle_end: '2026-10-24',
      p_first_adjust: 3_000_000,
      p_merged_close: false,
      p_is_temp: true,
      p_snapshot: { parts: { living: 1_110_000, goalFund: 1_500_000, emergency: 390_000 } },
      p_lines: [
        { target: 'goal', goal_id: 'g1', amount: 390_000 },
        { target: 'goal', goal_id: 'g2', amount: 1_500_000 },
      ],
    },
  });
}

test('월말 정리: 정리 기간에 시작해서 정산 요약까지', async ({ page }) => {
  const now = new Date('2026-10-23T20:00:00+09:00'); // 정리 기간(10월 22~24일)
  await page.clock.setFixedTime(now);
  const db = await mockOnboarding(page, { now });
  seed(db);
  await page.goto('/');

  await heading(page, '9월 월급 플랜 정리할 때예요');
  await page.getByRole('button', { name: '정리 시작' }).click();

  await heading(page, '9월 월급 플랜 정리를 시작할게요');
  await axe(page);
  await page.getByRole('button', { name: '시작' }).click();

  // W-04j: 소득(미합류라 내 수입), 변동 항목, 큰 지출
  await heading(page, '이번 달 쓴 돈을 적어요');
  await expect(page.getByRole('region', { name: '이번 달 들어온 돈' })).toContainText('350만 원');
  await page.getByLabel('외식·배달').fill('410000');
  await page.getByRole('button', { name: '자동차세' }).click();
  await page.getByLabel('자동차세').fill('250000');
  await axe(page);
  await next(page);

  // W-04k: 계획액을 채워 둠 + 기타 저축
  await heading(page, '이번 달 넣은 돈');
  await expect(page.getByLabel('비상금')).toHaveValue('390,000');
  await expect(page.getByLabel('내 집 마련')).toHaveValue('1,500,000');
  await page.getByLabel('기타 저축').fill('100000');
  await axe(page);
  await next(page);

  // W-04g: 199만 모음, 계획 189만의 105%. 쓴 돈 = 고정 130 + 변동 41 + 용돈 50 + 큰 지출 25 = 246 → 소득 350의 70.3%
  await heading(page, '이번 달 199만 원을 모았어요 (계획의 105%)');
  await expect(page.getByRole('region', { name: '9월 정산' })).toContainText('70.3%');
  await expect(page.getByText('예빈님이 합류하기 전이라 찬우님 돈만 셌어요')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '정리 끝내기' }).click();

  await heading(page, '9월 월급 플랜 정리 끝!');
  await expect(page.getByText('바뀐 값이 없어요')).toBeVisible();
  await page.getByRole('button', { name: '이번 달로' }).click();

  // 정리를 끝내면 이번 달은 다시 남은 생활비(55 − 41)
  await heading(page, '찬우님, 이번 달 생활비가 14만 원 남았어요');
  expect(db.closes[0]).toMatchObject({ status: 'done', income: 3_500_000, big_none: false });
  expect(db.bigs).toEqual([
    expect.objectContaining({ kind: 'car_tax', amount: 250_000, how: 'exception' }),
  ]);
  expect(db.deposits.map((x) => [x.name, x.amount])).toEqual([
    ['비상금', 390_000],
    ['내 집 마련', 1_500_000],
    ['기타 저축', 100_000],
  ]);
});
