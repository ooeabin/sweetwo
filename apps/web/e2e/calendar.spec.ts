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

test('처음 등록(Y-02) → 목록·달력에 챙길 날 → 상세(Y-05) 챙길 사람·준비 상황·쓸 돈', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  (db.space as Record<string, unknown>).wedding_date = '2025-04-18';
  (db.space as Record<string, unknown>).couple_state = 'not_joined';
  db.partner = null;

  await page.goto('/calendar/list');
  await page.getByRole('button', { name: '양가 부모님 생신부터 챙겨보기' }).click();
  await expect(page.getByRole('heading', { name: '양가 부모님을 챙겨드릴게요' })).toBeVisible();
  // 예빈 쪽 아버지는 빼기
  await page
    .getByRole('group', { name: '예빈 쪽' })
    .getByRole('button', { name: '아버지' })
    .click();
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();

  await expect(page.getByRole('heading', { name: '아버지 생신은 언제예요?' })).toBeVisible();
  await page.getByLabel('월', { exact: true }).fill('10');
  await page.getByLabel('일', { exact: true }).fill('20');
  await page.getByRole('button', { name: '다음' }).click();
  // 찬우 쪽 어머니: 음력 8월 3일
  await page.getByRole('tab', { name: '음력' }).click();
  await page.getByLabel('월', { exact: true }).fill('8');
  await page.getByLabel('일', { exact: true }).fill('3');
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();
  // 예빈 쪽 어머니: 나중에
  await page.getByRole('button', { name: '나중에 할게요' }).click();

  await expect(
    page.getByRole('heading', { name: '명절에 양가에 얼마쯤 쓸 것 같아요?' }),
  ).toBeVisible();
  await page.getByLabel('명절에 양가에 얼마쯤 쓸 것 같아요?').fill('500000');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('부모님 생신에는 한 분께 얼마쯤 드릴까요?').fill('300000');
  await page.getByRole('button', { name: '다음' }).click();

  // 1년 = 50만 × 2 + 30만 × 3 = 190만, 다음 결혼기념일(2027-04-18)까지 6개월 → 31만 7천
  await expect(
    page.getByRole('heading', { name: '1년에 190만 원이에요. 매달 31만 7,000원씩 모아두면 돼요' }),
  ).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '이대로 하기' }).click();
  await expect(page).toHaveURL(/\/calendar\/list$/);

  expect(db.family).toHaveLength(3);
  expect(db.cares.map((c) => c.name)).toEqual([
    '아버지 생신',
    '어머니 생신',
    '어머니 생신',
    '설날',
    '추석',
    '어버이날',
    '결혼기념일',
  ]);
  expect(db.goals.at(-1)).toMatchObject({
    template: 'family_cost',
    kind: 'yearly',
    target_amount: 1_900_000,
    deadline: '2027-04-18',
  });

  // 다음 챙길 날: 아버지 생신 10월 20일 D-13
  const next = page.getByRole('region', { name: '다음 챙길 날' });
  await expect(next).toContainText('D-13');
  await expect(next).toContainText('아버지 생신');
  await expect(next).toContainText('10월 20일, 찬우님이 챙겨요');
  const soon = page.getByRole('region', { name: '60일 안 챙길 날' });
  // 음력 8월 3일 생신은 올해 지났고 내년은 60일 밖
  await expect(soon).toContainText('아버지 생신');
  await expect(soon).not.toContainText('어머니 생신');
  await axe(page);

  // 달력: 10월 20일 막대, 고른 날 일정 → 상세
  await page.getByRole('tab', { name: '달력' }).click();
  await page.getByRole('button', { name: '10월 20일, 일정 1개' }).click();
  await page.getByRole('button', { name: /아버지 생신/ }).click();
  await expect(page).toHaveURL(/\/calendar\/day\//);
  await expect(page.getByRole('region', { name: '아버지 생신' })).toContainText('D-13');
  await page.getByRole('tab', { name: '같이 챙겨요' }).click();
  await page
    .getByRole('group', { name: '준비 상황' })
    .getByRole('button', { name: '준비 중' })
    .click();
  await expect(
    page.getByRole('group', { name: '준비 상황' }).getByRole('button', { name: '준비 중' }),
  ).toHaveAttribute('aria-pressed', 'true');
  expect(db.cares[0]).toMatchObject({
    carer: 'together',
    status: 'preparing',
    status_on: '2026-10-20',
  });
  await axe(page);

  // 음력 생신 상세: (음력 8월 3일)
  await page.goto('/calendar/day/care_day-2');
  await expect(page.getByText('(음력 8월 3일)')).toBeVisible();
  await page.getByRole('button', { name: /쓸 돈/ }).click();
  await page.getByLabel('얼마쯤 쓸까요?').fill('400000');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByRole('button', { name: /쓸 돈/ })).toContainText('40만 원');
});
