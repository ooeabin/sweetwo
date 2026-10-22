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
      p_snapshot: {
        parts: { living: 1_110_000, goalFund: 1_500_000, emergency: 390_000 },
        income: 6_000_000,
      },
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

  await heading(page, '9월 월급 플랜을 정리해 볼까요?');
  await axe(page);
  await page.getByRole('button', { name: '시작' }).click();

  // W-04j: 소득(미합류라도 월급 플랜 수입, 예빈 추정 포함), 변동 항목, 큰 지출
  await heading(page, '이번 달 쓴 돈을 적어요');
  await expect(page.getByRole('region', { name: '이번 달 들어온 돈' })).toContainText('600만 원');
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

  // W-04g: 199만 모음, 계획 189만의 105%. 쓴 돈 = 고정 130 + 변동 41 + 용돈 100(각 50) + 큰 지출 25 = 296 → 소득 600의 49.3%
  await heading(page, '이번 달 199만 원을 모았어요 (계획의 105%)');
  await expect(page.getByRole('region', { name: '9월 정산' })).toContainText('49.3%');
  await expect(page.getByText('예빈님 수입은 추정값으로 셌어요')).toBeVisible();
  await expect(page.getByText('찬우 50만, 예빈 50만')).toBeVisible();
  // 잘한 점(예산 55 − 변동 41), 계획 대비 표, 초과 10만 → 더 넣을 목표
  await expect(page.getByText('생활비를 계획보다 14만 원 아꼈어요')).toBeVisible();
  const table = page.getByRole('table', { name: '계획 대비' });
  await expect(table.getByRole('row', { name: /내 집 마련/ })).toContainText('150만');
  await expect(table.getByRole('row', { name: /기타 저축/ })).toContainText('+10만');
  await expect(page.getByRole('button', { name: '정리 끝내기' })).toBeDisabled();
  await axe(page);
  await page.getByRole('radio', { name: '내 집 마련' }).click();
  await page.getByRole('button', { name: '정리 끝내기' }).click();

  await heading(page, '9월 정리를 마쳤어요');
  await expect(page.getByText('바뀐 값이 없어요')).toBeVisible();
  await page.getByRole('button', { name: '이번 달로' }).click();

  // 정리를 끝내면 이번 달은 다시 남은 생활비(55 − 41)
  await heading(page, '찬우님, 이번 달 생활비 14만 원 더 쓸 수 있어요');
  expect(db.closes[0]).toMatchObject({
    status: 'done',
    income: 6_000_000,
    big_none: false,
    gap_kind: 'over',
    gap_amount: 100_000,
    gap_choice: 'extra_goal',
    gap_goal_id: 'g2',
  });
  expect(db.bigs).toEqual([
    expect.objectContaining({ kind: 'car_tax', amount: 250_000, how: 'exception' }),
  ]);
  expect(db.deposits.map((x) => [x.name, x.amount])).toEqual([
    ['비상금', 390_000],
    ['내 집 마련', 1_500_000],
    ['기타 저축', 100_000],
  ]);
});

test('정산 요약(W-04g): 지난달보다 칩, 생활비 예산 보정 제안(미합류는 바로 맞춤), 미달이면 채우는 방법', async ({
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
  await page.getByRole('button', { name: '시작' }).click();
  await page.getByLabel('외식·배달').fill('800000');
  await page.getByRole('button', { name: '없어요' }).click();
  await next(page);
  // 내 집 마련 150만 계획인데 100만만 넣음 → 50만 미달
  await page.getByLabel('내 집 마련').fill('1000000');
  await next(page);

  const sum = page.getByRole('region', { name: '9월 정산' });
  await expect(sum.getByText('지난달보다')).toBeVisible();
  await expect(sum).toContainText('외식·배달+4만');
  // 최근 3개월 평균(80, 76, 70) = 75만, 예산 55만과 10% 넘게 다름
  await expect(sum.getByText('최근 3개월 평균 75만 원을 썼어요. 예산을 맞출까요?')).toBeVisible();
  await sum.getByRole('button', { name: '맞추기' }).click();
  await expect.poll(() => db.space?.living_budget).toBe(750_000);
  await expect(sum.getByText(/예산을 맞출까요/)).toHaveCount(0);

  await expect(
    page.getByRole('radiogroup', { name: '계획보다 50만 원 덜 모았어요. 어떻게 채울까요?' }),
  ).toBeVisible();
  await expect(page.getByText('다음 3개월 동안 17만 원씩 더 넣어요')).toBeVisible();
  await axe(page);
  await page.getByRole('radio', { name: '이번 달만 넘어가기' }).click();
  await page.getByRole('button', { name: '정리 끝내기' }).click();
  await heading(page, '9월 정리를 마쳤어요');
  expect(db.closes.find((c) => c.id === 'close-1')).toMatchObject({
    budget_fix: 'applied',
    gap_kind: 'short',
    gap_amount: 500_000,
    gap_choice: 'skip_this_month',
  });
});

test('더 꼼꼼히 정리하기: 통장 잔액(W-04b) → 목표에서 쓴 돈(W-04c) → 비상금(W-04d) → 투자(W-04e) → 대출(W-04f) → 대화 카드(W-04i)', async ({
  page,
}) => {
  const now = new Date('2026-10-23T20:00:00+09:00');
  await page.clock.setFixedTime(now);
  const db = await mockOnboarding(page, { now });
  seed(db);
  const lines = db.plans[0]?.args.p_lines as Record<string, unknown>[];
  lines.push(
    { target: 'account', account_role: 'living', amount: 1_110_000 },
    { target: 'account', account_role: 'goal_fund', amount: 1_500_000 },
    { target: 'account', account_role: 'emergency', amount: 390_000 },
  );
  const acc = (id: string, role: string, name: string, start: number) => ({
    id,
    role,
    name,
    start_balance: start,
    asset_id: null,
    sort: 0,
    deleted_at: null,
  });
  db.accounts.push(
    acc('a-living', 'living', '공동 생활비', 500_000),
    acc('a-goal', 'goal_fund', '목표자금', 10_000_000),
    acc('a-em', 'emergency', '비상금', 5_000_000),
  );
  db.goalUses.push({
    id: 'use-1',
    goal_id: 'g2',
    amount: 100_000,
    used_on: '2026-10-03',
    paid_from: 'goal_fund',
    source: 'care',
    month_close_id: null,
    care: { day: { name: '어머니 생신' } },
    deleted_at: null,
  });
  const asset = (
    id: string,
    side: string,
    grp: string,
    name: string,
    amount: number,
    monthly: number | null,
  ) => ({
    id,
    side,
    grp,
    kind: grp === 'invest' ? 'stock' : 'jeonse_loan',
    name,
    amount,
    monthly_payment: monthly,
    owner: 'joint',
    visibility: 'shared',
    status: 'held',
    deleted_at: null,
  });
  db.assets.push(
    asset('inv', 'asset', 'invest', '주식', 3_000_000, null),
    asset('loan', 'debt', 'loan', '전세대출', 100_000_000, 1_200_000),
  );

  await page.goto('/month/close/w-04a');
  await page.getByRole('button', { name: '시작' }).click();
  await page.getByRole('button', { name: '없어요' }).click();
  await next(page);
  await next(page);
  await page.getByRole('button', { name: '더 꼼꼼히 정리하기' }).click();

  // W-04b: 예상 = O-63 잔액 + 이번 나누기
  await heading(page, '지금 통장에 얼마 있나요?');
  await expect(page.getByRole('button', { name: '다음' })).toBeDisabled();
  await page.getByRole('button', { name: '계획대로라면 161만 원' }).click();
  await expect(page.getByText('계획대로예요')).toBeVisible();
  await page.getByLabel('목표자금').fill('11250000');
  await expect(page.getByText('계획보다 25만 원 적어요')).toBeVisible();
  await page.getByLabel('비상금').fill('5000000');
  await expect(page.getByText('모두 1,786만 원이에요')).toBeVisible();
  await axe(page);
  await next(page);

  // W-04c: 기록 확인 → 차액(25만 − 기록 10만 = 15만) 1질문
  await heading(page, '이번 달 목표에서 이만큼 썼어요');
  await expect(page.getByText('어머니 생신')).toBeVisible();
  await expect(page.getByText('목표자금 통장에서 10만 원')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '맞아요' }).click();
  await heading(page, '나머지 15만 원은 어느 목표에서 썼어요?');
  await expect(page.getByText('목표자금 통장이 기록보다 15만 원 더 줄었어요')).toBeVisible();
  await page.getByRole('radio', { name: '내 집 마련' }).click();

  // W-04d: 비상금이 예상(539만)보다 줄었음
  await heading(page, '이번 달 비상금을 쓴 일이 있었나요?');
  await page.getByRole('radio', { name: '있어요' }).click();
  await page.getByRole('radio', { name: '병원' }).click();

  // W-04e: 투자 평가액
  await heading(page, '투자 평가액이 바뀌었나요?');
  await page.getByLabel('주식').fill('3200000');
  await next(page);

  // W-04f: 월 상환액만큼 뺀 값
  await heading(page, '대출 잔액이 줄었죠?');
  await expect(page.getByLabel('전세대출')).toHaveValue('98,800,000');
  await page.getByRole('button', { name: '맞아요' }).click();

  // W-04i: 대화 카드 3장
  await heading(page, '이번 달 이야기해 볼까요?');
  await axe(page);
  await page.getByRole('button', { name: '넘기기' }).click();
  await page.getByRole('button', { name: '넘기기' }).click();
  await next(page);
  await expect(page.getByRole('button', { name: '정리 끝내기' })).toBeVisible();

  const close = db.closes.find((c) => c.id === 'close-1');
  expect(close).toMatchObject({
    emergency_used: true,
    emergency_reason: 'hospital',
    goal_gap_amount: 150_000,
    goal_gap_goal_id: 'g2',
  });
  expect(close?.detailed_at).toBeTruthy();
  expect(db.balances.map((b) => [b.account_id, b.amount, b.expected])).toEqual([
    ['a-living', 1_610_000, 1_610_000],
    ['a-goal', 11_250_000, 11_500_000],
    ['a-em', 5_000_000, 5_390_000],
  ]);
  expect(db.goalUses.find((u) => u.source === 'close')).toMatchObject({
    goal_id: 'g2',
    amount: 150_000,
  });
  expect(db.assets.find((a) => a.id === 'inv')?.amount).toBe(3_200_000);
  expect(db.assets.find((a) => a.id === 'loan')?.amount).toBe(98_800_000);
});

test('놓친 달: 이번 달 맨 위 ‘지난달 정리’ → 지금 정리하기(그 플랜으로 정리, 늦은 정리)', async ({
  page,
}) => {
  const now = new Date('2026-10-27T10:00:00+09:00');
  await page.clock.setFixedTime(now);
  const db = await mockOnboarding(page, { now });
  seed(db);
  const sep = (db.plans[0] as { args: Record<string, unknown> }).args;
  sep.id = 'plan-9';
  db.plans.unshift({
    args: {
      ...sep,
      id: 'plan-10',
      p_label_month: '2026-10-01',
      p_cycle_start: '2026-10-25',
      p_cycle_end: '2026-11-24',
      p_lines: [],
    },
  });
  await page.goto('/');
  await page.getByText('지난달 정리').click();
  await heading(page, '9월 정리가 아직 남았어요');
  await expect(page.getByText('10월 플랜은 이미 시작했어요')).toBeVisible();
  await expect(page.getByText('그달 쓴 돈과 넣은 돈을 한 번에 적어요')).toBeVisible();
  await axe(page);
  await page.getByRole('radio', { name: /지금 정리하기/ }).click();

  await heading(page, '9월 월급 플랜을 정리해 볼까요?');
  await page.getByRole('button', { name: '시작' }).click();
  await page.getByRole('button', { name: '없어요' }).click();
  await next(page);
  await next(page);
  await expect(page.getByText(/예산을 맞출까요/)).toHaveCount(0);
  await page.getByRole('button', { name: '정리 끝내기' }).click();
  await heading(page, '9월 정리를 마쳤어요');
  expect(db.closes.find((c) => c.plan_id === 'plan-9')).toMatchObject({
    status: 'done',
    late: true,
  });
  await page.getByRole('button', { name: '이번 달로' }).click();
  await expect(page.getByText('지난달 정리')).toHaveCount(0);
});

test('놓친 달: 2개월 이상 밀리면 쉬어가기만, 그달 합계만 적고 끝', async ({ page }) => {
  const now = new Date('2026-10-27T10:00:00+09:00');
  await page.clock.setFixedTime(now);
  const db = await mockOnboarding(page, { now });
  seed(db);
  const sep = (db.plans[0] as { args: Record<string, unknown> }).args;
  sep.id = 'plan-9';
  db.plans.unshift({
    args: {
      ...sep,
      id: 'plan-10',
      p_label_month: '2026-10-01',
      p_cycle_start: '2026-10-25',
      p_cycle_end: '2026-11-24',
      p_lines: [],
    },
  });
  db.plans.push({
    args: {
      ...sep,
      id: 'plan-8',
      p_label_month: '2026-08-01',
      p_cycle_start: '2026-08-25',
      p_cycle_end: '2026-09-24',
      p_lines: [],
    },
  });
  await page.goto('/month/missed');
  await heading(page, '8~9월 정리가 밀렸어요');
  await expect(page.getByRole('radio', { name: /지금 정리하기/ })).toHaveCount(0);
  await page.getByRole('radio', { name: /쉬어가기/ }).click();
  await page.getByRole('button', { name: '시작' }).click();
  await page.getByRole('button', { name: '없어요' }).click();
  await next(page);
  await next(page);
  await heading(page, '9월 정리를 마쳤어요');
  await expect(page.getByText('그달 합계를 적었어요')).toBeVisible();
  expect(db.closes.find((c) => c.plan_id === 'plan-9')).toMatchObject({
    status: 'done',
    late: true,
    rested: true,
  });
  expect(db.plans.map((p) => p.args.status ?? 'created')).toEqual([
    'created',
    'skipped',
    'skipped',
  ]);
});

test('실제 수입(W-04a2): 변동 수입자만, 기준보다 적으면 다음 달 보충 안내, 소득 확인에 반영', async ({
  page,
}) => {
  const now = new Date('2026-10-23T20:00:00+09:00');
  await page.clock.setFixedTime(now);
  const db = await mockOnboarding(page, { now });
  seed(db);
  db.me.income_variable = true;
  await page.goto('/month/close/w-04a');
  await page.getByRole('button', { name: '시작' }).click();
  await heading(page, '이번 달 실제 들어온 돈은 얼마예요?');
  await expect(page.getByRole('button', { name: '다음' })).toBeDisabled();
  await axe(page);
  await page.getByLabel('이번 달 실제 들어온 돈은 얼마예요?').fill('3000000');
  await next(page);
  await expect(page.getByText('다음 달에 비상금에서 생활비로 50만 원을 채워요')).toBeVisible();
  await heading(page, '이번 달 쓴 돈을 적어요');
  // 소득 = 플랜 수입 600만 − (기준 350 − 실제 300)
  await expect(page.getByRole('region', { name: '이번 달 들어온 돈' })).toContainText('550만 원');
  expect(db.rpc).toContain('answer_actual_income');
});
