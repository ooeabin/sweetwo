import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { chanwoo } from './supabase-mock';
import { mockOnboarding, type MemDb } from './onboarding-mock';

// 홈(19)과 월급 체크리스트(20 W-01·W-02·W-02a·W-02 끝·W-05). 찬우 혼자(예빈 미합류), 각자, 실수령 350만, 월급날 25일.
// 9월 월급 사이클 = 9월 25일 ~ 10월 24일, 월말 확인은 10월 22일부터.

const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const NOW = new Date('2026-10-07T10:00:00+09:00');
const REVIEW = new Date('2026-10-22T10:00:00+09:00');

const LINES: [string, string | null, number][] = [
  ['saving', 'goal-e', 440_000],
  ['saving', 'goal-h', 950_000],
  ['fixed', null, 880_000],
  ['living', null, 880_000],
  ['allowance', null, 350_000],
];

/** 온보딩을 마친 찬우: 목표(비상금, 내 집 마련), 분배표, 9월 월급 체크리스트 */
function seed(db: MemDb) {
  Object.assign(db.me, {
    nickname: '찬우',
    space_id: 'space-1',
    onboarding_done_at: '2026-10-01T00:00:00Z',
    onboarding_step: 'O-60',
    monthly_income: 3_500_000,
    payday: 25,
    birth_year: 1994,
  });
  db.space = {
    id: 'space-1',
    created_by: chanwoo.id,
    couple_state: 'not_joined',
    marriage_status: 'married',
    wedding_date: '2025-05-17',
    salary_mode: 'separate',
    joint_cycle_day: null,
    holiday_shift: true,
    partner_nickname: null,
    split_ratio: null,
    partner_income: null,
    partner_income_unknown: false,
    partner_income_estimated: false,
    base_day: null,
    base_day_last: false,
    version: 1,
  };
  const goal = (id: string, template: string, name: string, priority: number, target: number) => ({
    id,
    template,
    name,
    kind: 'once',
    priority,
    target_amount: target,
    other_held: 0,
    deadline: template === 'home' ? '2031-10-01' : '2027-10-01',
    status: 'active',
    owner_user_id: null,
    details: {},
    deleted_at: null,
  });
  db.goals.push(
    goal('goal-e', 'emergency', '비상금', 0, 5_280_000),
    goal('goal-h', 'home', '내 집 마련', 1, 150_000_000),
  );
  const split_line = LINES.map(([kind, goal_id, amount], i) => ({
    id: `split-1-line-${i}`,
    split_id: 'split-1',
    kind,
    goal_id,
    user_id: kind === 'allowance' ? chanwoo.id : null,
    name: null,
    amount,
    sort: i,
  }));
  db.splits.push({ id: 'split-1', owner_user_id: chanwoo.id, split_line });
  db.checklists.push({
    id: 'checklist-1',
    split_id: 'split-1',
    owner_user_id: chanwoo.id,
    label: '9월 월급',
    cycle_start: '2026-09-25',
    cycle_end: '2026-10-24',
    state: 'open',
    pay_check_line: split_line.map((l) => ({
      ...l,
      id: `${l.id}-c`,
      planned: l.amount,
      actual: null,
      state: 'wait',
      checked_by: null,
      checked_at: null,
    })),
  });
}

const salaryCard = (page: Page) => page.getByRole('region', { name: '9월 월급' });

test('홈: 인사, 목표, 이번 달 월급 체크 → 목표에 더해짐 → 다 보냈어요', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/');

  await expect(page.getByText('찬우님, 이번 달 월급 체크가 5개 남았어요').first()).toBeVisible();
  await expect(page.getByRole('region', { name: '목표' })).toContainText('내 집 마련');
  await expect(page.getByText('이번 달 95만 원 넣을 차례예요')).toBeVisible();
  await expect(salaryCard(page)).toContainText('5개 중 0개 했어요');
  await expect(page.getByText('가진 돈을 적으면 순자산을 보여 드려요')).toBeVisible();
  await expect(page.getByText('같이 쓸 사람을 초대해 주세요')).toBeVisible();
  await axe(page);

  // 홈 카드에서 바로 체크 → Toast, 목표 카드도 “넣었어요”
  await salaryCard(page).getByRole('checkbox', { name: '내 집 마련 체크' }).click();
  await expect(page.getByText('내 집 마련에 95만 원 더했어요')).toBeVisible();
  await expect(page.getByText('이번 달 95만 원 넣었어요')).toBeVisible();
  await expect(salaryCard(page)).toContainText('5개 중 1개 했어요');
  await expect(page.getByText('찬우님, 이번 달 월급 체크가 4개 남았어요').first()).toBeVisible();

  // W-02: 남은 줄 체크 → 마지막 줄이면 W-02 끝
  await page.getByRole('button', { name: '월급 체크하기' }).first().click();
  await expect(page.getByRole('heading', { name: '9월 월급' })).toBeVisible();
  await expect(page.getByText(/09\.25 ~ 10\.24\. 5개 중 1개 했어요/)).toBeVisible();
  await axe(page);
  for (const name of ['비상금', '고정지출', '생활비', '용돈'])
    await page.getByRole('checkbox', { name: `${name} 체크` }).click();
  await expect(page.getByRole('heading', { name: '이번 달 월급을 다 나눴어요' })).toBeVisible();
  await expect(page.getByText('이번 달 목표에 139만 원 모았어요')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '확인' }).click();
  await expect(page.getByText(/찬우님, 내 집 마련까지 0% 왔어요/).first()).toBeVisible();
  await expect(page.getByText('9월 월급을 다 나눴어요', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: '월급 체크하기' })).toHaveCount(0);
});

test('W-02a 다른 금액, W-01 분배표 고치기(체크 안 한 줄만 새 금액)', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/salary');
  await expect(page.getByRole('heading', { name: '9월 월급' })).toBeVisible();
  // 생활비 줄 ‘다른 금액으로 보냈어요’ → W-02a
  await page.getByRole('button', { name: '다른 금액으로 보냈어요' }).nth(3).click();
  await expect(page.getByRole('heading', { name: '얼마를 보냈어요?' })).toBeVisible();
  await page.getByLabel('얼마를 보냈어요?').fill('780000');
  await expect(page.getByText('계획보다 10만 원 적어요')).toBeVisible();
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('heading', { name: '9월 월급' })).toBeVisible();
  const living = db.checklists[0]?.pay_check_line as Record<string, unknown>[];
  expect(living.find((l) => l.kind === 'living')).toMatchObject({ state: 'checked', actual: 780_000 });

  // W-01: 고정지출 88만 → 90만, 저장 → Toast, 체크 안 한 고정지출 줄만 새 금액
  await page.getByRole('button', { name: '분배표 고치기' }).click();
  await expect(page.getByRole('heading', { name: '월급 분배표' })).toBeVisible();
  await expect(page.getByRole('button', { name: '저장' })).toBeDisabled();
  await axe(page);
  await page.getByRole('button', { name: /^고정지출/ }).click();
  await page.getByLabel('고정지출 금액').fill('900000');
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByText('2만 원이 모자라요')).toBeVisible();
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('분배표를 바꿨어요')).toBeVisible();
  const lines = db.checklists[0]?.pay_check_line as Record<string, unknown>[];
  expect(lines.find((l) => l.kind === 'fixed')).toMatchObject({ planned: 900_000, state: 'wait' });
  expect(lines.find((l) => l.kind === 'living')).toMatchObject({ state: 'checked', actual: 780_000 });
  // 비상금 목표 금액 = (90만 + 88만) × 3
  expect(db.goals.find((g) => g.template === 'emergency')?.target_amount).toBe(5_340_000);
});

test('W-05 월말 확인: 다음 월급날 3일 전부터 할 일 한 줄 → 빠진 줄 체크, 이번 달은 못 했어요', async ({
  page,
}) => {
  await page.clock.setFixedTime(REVIEW);
  const db = await mockOnboarding(page, { now: REVIEW });
  seed(db);
  await page.goto('/');
  await expect(page.getByText('9월 월급에서 체크 안 한 게 5개 있어요')).toBeVisible();
  await page
    .getByRole('status')
    .filter({ hasText: '체크 안 한 게' })
    .getByRole('button', { name: '열기' })
    .click();
  await expect(page.getByRole('heading', { name: '9월 월급, 빠진 게 있나요?' })).toBeVisible();
  await axe(page);
  await page.getByRole('checkbox', { name: '내 집 마련 체크' }).click();
  await page.getByRole('button', { name: '이번 달은 못 했어요' }).first().click();
  const lines = db.checklists[0]?.pay_check_line as Record<string, unknown>[];
  await expect.poll(() => lines.find((l) => l.goal_id === 'goal-e')?.state).toBe('skipped');
  expect(lines.find((l) => l.goal_id === 'goal-h')?.state).toBe('checked');
  await page.getByRole('button', { name: '확인' }).click();
  await expect(page).toHaveURL(/\/$/);
});
