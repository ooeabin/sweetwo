import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockOnboarding, type MemDb } from './onboarding-mock';

// 제안(docs/spec/08-couple-proposal-permission.md 6장, 22-goals.md G-08). 찬우가 예빈이 보낸 제안에 답한다.

const axe = async (page: Page) => {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const heading = (page: Page, name: string | RegExp) =>
  expect(page.getByRole('heading', { name })).toBeVisible();
const NOW = new Date('2026-10-07T10:00:00+09:00');
const count = (page: Page) => page.locator('.hg-nav__count:visible');

/** 연결된 신혼부부: 찬우(시작, 25일), 예빈(합류, 10일). 예빈이 합류할 때 보낸 제안 2건 */
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
    onboarding_done_at: '2026-10-01T01:00:00Z',
    space_id: 'space-1',
  });
  db.space = {
    id: 'space-1',
    created_by: db.me.id,
    couple_state: 'connected',
    partner_nickname: '예빈',
    marriage_status: 'married',
    wedding_date: '2025-05-17',
    partner_income: 2_500_000,
    partner_income_estimated: false,
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
  db.partner = {
    id: 'yebin',
    nickname: '예빈',
    side: 'bride',
    employment: 'regular',
    monthly_income: 2_700_000,
    income_variable: false,
    payday: 10,
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
      p_snapshot: { parts: { living: 1_110_000, goalFund: 1_500_000, emergency: 390_000 } },
      p_lines: [],
    },
  });
  const base = {
    space_id: 'space-1',
    proposer: 'yebin',
    status: 'open',
    apply_on: '2026-10-25',
    seen_at: null,
    response: null,
    responded_at: null,
    oppose_count: 0,
    round_trips: 0,
    together: false,
    replaces: null,
    applied_at: null,
    version: 1,
  };
  db.proposals.push(
    {
      ...base,
      id: 'prop-1',
      item: 'allowance',
      before: { allowance: 500_000 },
      after: { allowance: 600_000 },
      created_at: '2026-10-06T01:00:00Z',
      updated_at: '2026-10-06T01:00:00Z',
    },
    {
      ...base,
      id: 'prop-2',
      item: 'split',
      before: { mode: 'custom', starter_ratio: 60 },
      after: { mode: 'half' },
      created_at: '2026-10-06T01:01:00Z',
      updated_at: '2026-10-06T01:01:00Z',
    },
  );
}

test('받은 제안: 할 일 맨 위와 탭 숫자 → G-08 좋아요, 분담은 다르게 해볼래요', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);

  await page.goto('/');
  await expect(count(page)).toHaveText('2');
  await expect(count(page)).toHaveAttribute('aria-label', '받은 제안 2개');
  const allowanceRow = page.getByRole('button', { name: /예빈님이 용돈을 바꾸자고 제안했어요/ });
  await expect(allowanceRow).toContainText('50만 원 → 60만 원');
  await expect(
    page.getByRole('button', { name: /예빈님이 분담 방식을 바꾸자고 제안했어요/ }),
  ).toContainText('찬우 60%, 예빈 40% → 반반');
  await axe(page);

  // 용돈 제안: 좋아요 / 반대만
  await allowanceRow.click();
  await heading(page, '예빈님 제안');
  await expect(page.getByText('예빈님 용돈')).toBeVisible();
  await expect(page.getByText('50만 원 → 60만 원')).toBeVisible();
  await expect(page.getByText('좋아요면 바로, 반대 없으면 10월 25일부터 적용돼요')).toBeVisible();
  await expect(page.getByRole('button', { name: '다르게 해볼래요' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '반대' })).toBeVisible();
  await axe(page);
  await expect.poll(() => db.proposals[0]?.seen_at).not.toBeNull();
  await page.getByRole('button', { name: '좋아요' }).click();

  await expect(count(page)).toHaveText('1');
  expect(db.proposals[0]).toMatchObject({ status: 'applied', response: 'like' });
  expect(db.partner?.allowance).toBe(600_000);

  // 분담 제안: 다르게 해볼래요 → 버는 만큼으로 다시 제안(이전 제안 대체)
  await page.getByRole('button', { name: /예빈님이 분담 방식을 바꾸자고 제안했어요/ }).click();
  await heading(page, '예빈님 제안');
  await page.getByRole('button', { name: '다르게 해볼래요' }).click();
  await heading(page, '다르게 해볼래요');
  await page.getByRole('radio', { name: /버는 만큼/ }).click();
  await axe(page);
  await page.getByRole('button', { name: '예빈님께 제안하기' }).click();

  await expect(page.getByText('예빈님에게 제안했어요')).toBeVisible();
  await expect(count(page)).toHaveCount(0);
  expect(db.proposals[1]).toMatchObject({ status: 'superseded' });
  expect(db.proposals[2]).toMatchObject({
    item: 'split',
    proposer: db.me.id,
    after: { mode: 'income' },
    apply_on: '2026-10-25',
    round_trips: 1,
    replaces: 'prop-2',
    status: 'open',
  });

  // 보낸 제안: 예빈이 열기 전이면 ‘보내기 취소’
  await page.goto('/proposals/prop-3');
  await heading(page, '찬우님 제안');
  await expect(page.getByRole('button', { name: '좋아요' })).toHaveCount(0);
  await axe(page);
  await page.getByRole('button', { name: '보내기 취소' }).click();
  await expect(page.getByText('제안을 거둬들였어요')).toBeVisible();
  expect(db.proposals[2]).toMatchObject({ status: 'withdrawn' });
});

test('받은 제안: 반대하면 보류, 함께 정하기 표시', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  Object.assign(db.proposals[1] ?? {}, { round_trips: 2, together: true });

  await page.goto('/proposals/prop-2');
  await heading(page, '예빈님 제안');
  await expect(page.getByText('함께 정하기')).toBeVisible();
  await expect(page.getByText('다음 월말 정리에서 함께 정해요')).toBeVisible();
  await axe(page);

  await page.goto('/proposals/prop-1');
  await heading(page, '예빈님 제안');
  await page.getByRole('button', { name: '반대' }).click();
  await expect(page.getByText('보류했어요. 다음 월말 정리에서 함께 다뤄요')).toBeVisible();
  expect(db.proposals[0]).toMatchObject({ status: 'held', oppose_count: 1 });
  expect(db.partner?.allowance).toBe(500_000);
});

test('월말 정리(연결, 혼자 정리): W-04h 받은 제안, 보정 제안은 묶음으로 → W-04 끝 “제안으로 보냈어요”', async ({
  page,
}) => {
  const now = new Date('2026-10-23T20:00:00+09:00');
  await page.clock.setFixedTime(now);
  const db = await mockOnboarding(page, { now });
  seed(db);
  db.categories.push({
    id: 'cat-eat',
    name: '외식·배달',
    sort: 1,
    enabled: true,
    deleted_at: null,
  });
  const old = (id: string, month: string, eat: number) => ({
    id,
    plan_id: `old-${id}`,
    status: 'done',
    deleted_at: null,
    income: 6_000_000,
    closed_at: `${month.slice(0, 7)}-26T01:00:00Z`,
    label_month: month,
    spends: [{ category_id: 'cat-eat', amount: eat, deleted_at: null }],
    bigs: [],
    deposits: [],
  });
  db.closes.push(old('c8', '2026-07-01', 700_000), old('c9', '2026-08-01', 760_000));

  await page.goto('/month/close/w-04a');
  await expect(page.getByText('바꾼 값은 끝에서 예빈님께 제안으로 가요')).toBeVisible();
  await page.getByRole('button', { name: '시작' }).click();
  await page.getByLabel('외식·배달').fill('800000');
  await page.getByRole('button', { name: '없어요' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '다음' }).click();

  // W-04h: 받은 제안 2건(좋아요 / 다르게 해볼래요 / 반대), 생활비 예산은 읽기만
  await heading(page, '다음 달 플랜, 바꿀 게 있을까요?');
  await expect(page.getByText('예빈님 용돈 50만 원 → 60만 원')).toBeVisible();
  await expect(page.getByRole('button', { name: '다르게 해볼래요' })).toHaveCount(1);
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();

  // W-04g: 보정 제안 맞추기 = 묶음 제안(하나씩 알리지 않음)
  await page.getByRole('button', { name: '맞추기' }).click();
  await expect
    .poll(() => db.proposals.find((p) => p.item === 'living_budget')?.month_close_id)
    .toBe('close-1');
  expect(db.space?.living_budget).toBe(550_000);
  await page.getByRole('button', { name: '정리 끝내기' }).click();

  await heading(page, '9월 월급 플랜 정리 끝!');
  await expect(page.getByText('바뀐 값 1개를 예빈님께 제안으로 보냈어요')).toBeVisible();
  await expect(page.getByText('생활비 예산 55만 원 → 75만 원')).toBeVisible();
  await expect(page.getByText('제안 중')).toBeVisible();
  expect(db.rpc).toContain('send_close_bundle');
  await axe(page);
});

test('월말 정리 제안 응답(W-04p): 하나 반대하면 “나머지 1개 좋아요”', async ({ page }) => {
  const now = new Date('2026-10-23T21:00:00+09:00');
  await page.clock.setFixedTime(now);
  const db = await mockOnboarding(page, { now });
  seed(db);
  for (const p of db.proposals) p.month_close_id = 'close-9';
  await page.goto('/month/close/w-04p/close-9');
  await heading(page, '예빈님이 9월 월급 플랜을 정리했어요');
  await expect(page.getByText('반대 없으면 10월 25일부터 적용돼요').first()).toBeVisible();
  await expect(page.getByRole('button', { name: '모두 좋아요' })).toBeVisible();
  await axe(page);
  await page
    .getByRole('region', { name: '예빈님 제안' })
    .last()
    .getByRole('button', { name: '반대' })
    .click();
  await expect(page.getByRole('button', { name: '나머지 1개 좋아요' })).toBeVisible();
  await page.getByRole('button', { name: '나머지 1개 좋아요' }).click();
  await expect(page.getByText('모두 답했어요')).toBeVisible();
  expect(db.proposals.map((p) => p.status).sort()).toEqual(['applied', 'held']);
});
