import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockOnboarding, type MemDb } from './onboarding-mock';

// 월급 플랜 W-01과 월급 나누기 W-02·W-02a(docs/spec/20-salary-plan.md). 찬우(신랑)와 합류한 예빈, 통장 역할을 나눔.

const axe = async (page: Page) => {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const heading = (page: Page, name: string | RegExp) =>
  expect(page.getByRole('heading', { name }).first()).toBeVisible();
const NOW = new Date('2026-10-07T10:00:00+09:00');

function seed(db: MemDb, joined = true) {
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
    couple_state: joined ? 'connected' : 'not_joined',
    partner_nickname: '예빈',
    marriage_status: 'married',
    partner_income: 2_500_000,
    partner_income_estimated: false,
    partner_income_unknown: false,
    fixed_total: 1_000_000,
    living_budget: 550_000,
    loan_repayment: 300_000,
    split_mode: 'custom',
    split_ratio: 60,
    split_deferred: false,
    account_mode: 'roles',
    base_day: 25,
    base_day_last: false,
  };
  db.partner = joined
    ? {
        id: 'yebin',
        nickname: '예빈',
        side: 'bride',
        employment: 'regular',
        monthly_income: 2_500_000,
        payday: 10,
        payday_last: false,
        allowance: 500_000,
      }
    : null;
  db.plans.push({
    args: {
      p_label_month: '2026-09-01',
      p_cycle_start: '2026-09-25',
      p_cycle_end: '2026-10-24',
      p_first_adjust: null,
      p_merged_close: false,
      p_is_temp: false,
      p_snapshot: { parts: { living: 1_850_000, goalFund: 3_000_000, emergency: 220_000 } },
      p_lines: [
        {
          target: 'account',
          account_role: 'living',
          amount: 1_850_000,
          amount_groom: 1_110_000,
          amount_bride: 740_000,
        },
        {
          target: 'account',
          account_role: 'goal_fund',
          amount: 3_000_000,
          amount_groom: 1_800_000,
          amount_bride: 1_200_000,
        },
        {
          target: 'account',
          account_role: 'emergency',
          amount: 220_000,
          amount_groom: 220_000,
          amount_bride: 0,
        },
      ],
    },
  });
  db.incomeEvents.push({
    id: 'ev',
    owner_user_id: db.me.id,
    name: '상여금',
    amount: 2_000_000,
    month: 9,
    deleted_at: null,
  });
}

test('월급 플랜(W-01): 진행 문구, 돈 흐름, 들어오는 돈, 계획액과 담당 칩(내 칩 = 바로 옮겼어요)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);

  await page.goto('/');
  await page.getByRole('button', { name: '월급 플랜 보기' }).click();
  await expect(page).toHaveURL(/\/plan$/);
  await heading(page, '이번 달 남은 기간 플랜');
  await expect(page.getByText('9.25 ~ 10.24')).toBeVisible();
  await expect(page.getByText('5곳 중 0곳 나눴어요')).toBeVisible();
  await expect(
    page.getByRole('img', { name: /공동 생활비 185만 원, 목표자금 300만 원, 비상금 22만 원/ }),
  ).toBeVisible();
  await expect(page.getByText('상여금 200만 원이 들어오는 달이에요')).toBeVisible();
  const living = page.getByRole('region', { name: '계획액' });
  await expect(living).toContainText('185만 원');
  await axe(page);

  // 내 칩을 누르면 바로 완료, 배우자 칩은 보기만
  await page.getByRole('button', { name: '찬우 9.25 111만' }).click();
  await expect(page.getByRole('button', { name: '찬우 9.25 111만' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByText('5곳 중 1곳 나눴어요')).toBeVisible();
  // 예빈 월급날 10일(토) → 직전 영업일 9일(금)로 표시
  await expect(page.getByRole('button', { name: '예빈 10.9 74만' })).toBeDisabled();
});

test('월급 나누기(W-02): 옮겼어요·취소, 다른 금액(W-02a), 대신 체크, 먼저 체크 알림, 다 끝나면 끝 화면', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);

  await page.goto('/');
  await heading(page, '찬우님, 9월 월급 나누기가 3곳 남았어요');
  await page.getByRole('button', { name: '월급 나누기' }).first().click();
  await expect(page).toHaveURL(/\/plan\/split$/);
  await heading(page, '월급 나누기');
  await expect(page.getByRole('checkbox')).toHaveCount(3);
  await axe(page);

  await page.getByRole('checkbox', { name: '공동 생활비 통장 옮겼어요' }).click();
  await expect(page.getByRole('checkbox', { name: '공동 생활비 통장 옮겼어요' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('button', { name: '취소' }).click();
  await expect(page.getByRole('checkbox', { name: '공동 생활비 통장 옮겼어요' })).toHaveAttribute(
    'aria-checked',
    'false',
  );

  // 다른 금액: 계획보다 적게
  await page.getByRole('button', { name: '다른 금액을 옮겼어요' }).nth(1).click();
  await heading(page, '얼마를 옮겼어요?');
  await page.getByLabel('얼마를 옮겼어요?').fill('1700000');
  await expect(page.getByText('계획보다 10만 원 적어요')).toBeVisible();
  await page.getByRole('button', { name: '확인' }).click();
  await expect(page).toHaveURL(/\/plan\/split$/);
  await expect(page.getByText('170만 원 옮겼어요')).toBeVisible();
  const lines = db.plans[0]?.args.p_lines as Record<string, unknown>[];
  expect(lines[1]).toMatchObject({ groom_done_amount: 1_700_000, groom_done_by: db.me.id });

  // 예빈 탭: 보기만, ‘대신 체크’를 켜면 체크
  await page.getByRole('tab', { name: /예빈/ }).click();
  await expect(page.getByRole('checkbox')).toHaveCount(2);
  await expect(page.getByRole('checkbox').first()).toBeDisabled();
  await page.getByRole('button', { name: '예빈님 대신 체크' }).click();
  await page.getByRole('checkbox', { name: '공동 생활비 통장 옮겼어요' }).click();
  await expect(page.getByRole('checkbox', { name: '공동 생활비 통장 옮겼어요' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  expect(lines[0]).toMatchObject({ bride_done_amount: 740_000, bride_done_by: db.me.id });

  // 먼저 체크한 사람이 있으면 알림
  Object.assign(lines[2] ?? {}, {
    groom_done_at: '2026-10-07T00:00:00Z',
    groom_done_amount: 220_000,
  });
  await page.getByRole('tab', { name: /찬우/ }).click();
  await page.getByRole('checkbox', { name: '비상금 통장 옮겼어요' }).click();
  await expect(page.getByText('예빈님이 먼저 체크했어요')).toBeVisible();
  await page.getByRole('checkbox', { name: '공동 생활비 통장 옮겼어요' }).click();

  // 내 몫이 다 끝나면 끝 화면 + 배우자 진행
  await expect(page.getByText('월급을 다 나눴어요')).toBeVisible();
  await expect(page.getByText('예빈 1/2')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '닫기' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('월급 플랜(합류 전): 월급 나누기 없이 미리보기 한 줄', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db, false);
  await page.goto('/plan');
  await expect(page.getByText('예빈님이 합류하면 여기서 월급을 나눠요')).toBeVisible();
  await expect(page.getByRole('button', { name: '월급 나누기' })).toHaveCount(0);
});

test('이번 달만 바꾸기(W-01a): 차이는 목표자금이 받고 미리보기, 되돌리기. 옮긴 줄은 못 바꿈', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/plan');
  await page.getByRole('button', { name: '공동 생활비 이번 달만 바꾸기' }).click();
  await heading(page, '공동 생활비에 이번 달 얼마 넣을까요?');
  await page.getByLabel('공동 생활비에 이번 달 얼마 넣을까요?').fill('2050000');
  await expect(page.getByText('목표자금 300만 원 → 280만 원')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page).toHaveURL(/\/plan$/);
  const lines = db.plans[0]?.args.p_lines as Record<string, unknown>[];
  expect(lines[0]).toMatchObject({
    amount: 2_050_000,
    amount_groom: 1_230_000,
    amount_bride: 820_000,
  });
  expect(lines[1]).toMatchObject({ amount: 2_800_000 });
  await expect(page.getByRole('region', { name: '계획액' })).toContainText('205만 원');
  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect(page.getByRole('region', { name: '계획액' })).toContainText('185만 원');
  expect(lines[1]).toMatchObject({ amount: 3_000_000 });

  // 옮긴 줄은 못 바꿈(빠지는 곳 목표자금을 옮겼으면 공동 생활비도)
  await page.getByRole('button', { name: '찬우 9.25 180만' }).click();
  await expect(page.getByRole('button', { name: '찬우 9.25 180만' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: '공동 생활비 이번 달만 바꾸기' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '비상금 이번 달만 바꾸기' })).toHaveCount(0);
});

test('들어오는 돈(W-07): 월별 목록, 추가(이름 → 금액 → 몇 월에), 지우기와 되돌리기', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/plan');
  await page.getByRole('button', { name: /상여금 200만 원이 들어오는 달이에요/ }).click();
  await expect(page).toHaveURL(/\/plan\/income$/);
  await expect(page.getByRole('region', { name: '9월' })).toContainText('상여금');
  await axe(page);

  await page.getByRole('button', { name: '+ 추가' }).click();
  await page.getByLabel('어떤 돈이에요?').fill('연말정산 환급');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('얼마예요?').fill('800000');
  await page.getByRole('button', { name: '다음' }).click();
  await heading(page, '몇 월에 들어와요?');
  await page.getByRole('radio', { name: '2월', exact: true }).click();
  await page.getByRole('radio', { name: '올해만' }).click();
  await axe(page);
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page).toHaveURL(/\/plan\/income$/);
  await expect(page.getByRole('region', { name: '2월' })).toContainText('80만 원');
  expect(db.incomeEvents.at(-1)).toMatchObject({
    name: '연말정산 환급',
    amount: 800_000,
    month: 2,
    yearly: false,
  });

  await page.getByRole('button', { name: '연말정산 환급 지우기' }).click();
  await expect(page.getByRole('region', { name: '2월' })).toHaveCount(0);
  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect(page.getByRole('region', { name: '2월' })).toBeVisible();
});
