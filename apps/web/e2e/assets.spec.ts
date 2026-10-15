import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockOnboarding, type MemDb } from './onboarding-mock';

// 우리 자산 F-01 한눈에, F-02 자산·부채, F-03 추가, F-04 상세(docs/spec/23-assets.md). 찬우, 예빈 합류.

const axe = async (page: Page) => {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const heading = (page: Page, name: string | RegExp) =>
  expect(page.getByRole('heading', { name }).first()).toBeVisible();
const NOW = new Date('2026-10-07T10:00:00+09:00');

const asset = (o: Record<string, unknown>) => ({
  principal: null,
  estimated: false,
  owner: 'person',
  visibility: 'all',
  status: 'held',
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
  deleted_at: null,
  ...o,
});

function seed(db: MemDb, joined = true) {
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
    couple_state: joined ? 'connected' : 'not_joined',
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
  db.partner = joined
    ? {
        id: 'yebin',
        nickname: '예빈',
        side: 'bride',
        employment: 'regular',
        monthly_income: 2_700_000,
        payday: 10,
        payday_last: false,
        allowance: 500_000,
      }
    : null;
  const me = String(db.me.id);
  db.assets.push(
    asset({
      id: 'a1',
      side: 'asset',
      grp: 'cash',
      kind: 'bank',
      name: '생활비 통장',
      amount: 3_000_000,
      owner: 'joint',
      owner_user_id: null,
      created_by: me,
    }),
    asset({
      id: 'a2',
      side: 'asset',
      grp: 'invest',
      kind: 'stock_kr',
      name: '내 주식',
      amount: 10_000_000,
      principal: 8_000_000,
      owner_user_id: me,
      visibility: 'sum',
      created_by: me,
    }),
    asset({
      id: 'a4',
      side: 'debt',
      grp: 'credit',
      kind: 'credit_loan',
      name: '신용대출',
      amount: 1_000_000,
      owner_user_id: me,
      created_by: me,
      updated_at: '2026-05-01T00:00:00Z',
    }),
  );
  if (joined) {
    db.assets.push(
      asset({
        id: 'a3',
        side: 'asset',
        grp: 'deposit',
        kind: 'saving',
        name: '예빈 적금',
        amount: 2_000_000,
        owner_user_id: 'yebin',
        created_by: 'yebin',
      }),
    );
    db.partnerSums.push({
      side: 'asset',
      grp: 'invest',
      n: 2,
      total: 4_400_000,
      principal_total: 4_000_000,
    });
  }
  db.assetHistory.push(
    {
      id: 1,
      asset_id: 'a2',
      amount: 9_000_000,
      source: 'manual',
      recorded_at: '2026-09-01T00:00:00Z',
    },
    {
      id: 2,
      asset_id: 'a2',
      amount: 10_000_000,
      source: 'close',
      recorded_at: '2026-09-24T03:00:00Z',
    },
  );
  db.netWorth.push(
    { month: '2026-09-01', net: 14_200_000, expected: 16_000_000 },
    { month: '2026-10-01', net: 16_000_000, expected: 18_400_000 },
  );
  db.plans.push({
    args: {
      p_label_month: '2026-09-01',
      p_cycle_start: '2026-09-25',
      p_cycle_end: '2026-10-24',
      p_first_adjust: 3_000_000,
      p_merged_close: false,
      p_is_temp: false,
      p_snapshot: { parts: { living: 1_850_000, goalFund: 3_000_000, emergency: 350_000 } },
      p_lines: [],
    },
  });
}

test('한눈에: 순자산(원금 기준)과 예상, 지난달 대비, 합계, 이번 달 계획', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);

  await page.goto('/');
  await page.getByRole('link', { name: '우리 자산' }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/assets$/);
  // 자산(원금 기준) 3 + 8 + 2 + 배우자 합계만 400 = 1,700만, 부채 100만 → 순자산 1,600만
  const nw = page.getByRole('region', { name: '순자산' });
  await expect(nw).toContainText('1,600만 원');
  await expect(nw).toContainText('예상 순자산 1,840만 원, 안 판 수익 +240만 원');
  await expect(nw).toContainText('지난달보다 180만 원 늘었어요');
  await expect(page.getByRole('button', { name: /자산 1,940만 원/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /부채 100만 원/ })).toBeVisible();
  const plan = page.getByRole('region', { name: '이번 달 계획' });
  await expect(plan).toContainText('620만 원');
  await expect(plan).toContainText('저축 가능 금액 월');
  await expect(page.getByRole('tab', { name: '재정 진단' })).toBeDisabled();
  await axe(page);

  await page.getByRole('button', { name: /부채 100만 원/ }).click();
  await expect(page).toHaveURL(/\/assets\/items\?side=debt/);
  await expect(page.getByRole('button', { name: /신용대출/ })).toContainText('금액이 맞나요?');
});

test('자산·부채 목록 → 상세: 묶음, 배우자 합계만, 공개 범위, 금액 수정, 삭제 되돌리기', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);

  await page.goto('/assets/items');
  await expect(page.getByRole('tab', { name: '자산 1,940만 원' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  const invest = page.getByRole('region', { name: '투자' });
  await expect(invest.getByRole('button', { name: /내 주식/ })).toContainText('합계만');
  await expect(invest).toContainText('예빈님 자산 2개');
  await expect(invest).toContainText('440만 원');
  await expect(page.getByRole('button', { name: /생활비 통장/ })).toContainText('공동');
  await axe(page);

  // 배우자 명의는 볼 수만
  await page.getByRole('button', { name: /예빈 적금/ }).click();
  await expect(page.getByText('예빈님 항목이라 볼 수만 있어요')).toBeVisible();
  await expect(page.getByRole('button', { name: '수정' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '삭제' })).toHaveCount(0);

  await page.goto('/assets/a2');
  await heading(page, '내 주식');
  await expect(page.getByRole('region', { name: '금액' })).toContainText(
    '+200만 원, 원금 800만 원',
  );
  await expect(page.getByRole('region', { name: '월별 기록' })).toContainText('월말 정리');
  await axe(page);
  await page.getByRole('button', { name: '수정' }).click();
  await page.getByRole('textbox', { name: '금액' }).fill('12000000');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('저장했어요')).toBeVisible();
  expect(db.assets.find((a) => a.id === 'a2')?.amount).toBe(12_000_000);
  await expect(page.getByRole('region', { name: '월별 기록' })).toContainText('1,200만 원');

  await page.getByRole('button', { name: /공개 범위/ }).click();
  await page.getByRole('radio', { name: /비공개/ }).click();
  await expect.poll(() => db.assets.find((a) => a.id === 'a2')?.visibility).toBe('private');

  await page.getByRole('button', { name: '삭제' }).click();
  await expect(page).toHaveURL(/\/assets\/items\?side=asset/);
  await expect(page.getByText('휴지통으로 옮겼어요')).toBeVisible();
  await expect(page.getByRole('button', { name: /내 주식/ })).toHaveCount(0);
  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect(page.getByRole('button', { name: /내 주식/ })).toBeVisible();
});

test('추가: 유형 → 이름 → 금액 → 명의 → 공개 범위 → 목록과 토스트', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);

  await page.goto('/assets/items');
  await page.getByRole('button', { name: '+ 추가' }).first().click();
  await heading(page, '무엇을 추가할까요?');
  await page.getByRole('button', { name: '예금·적금' }).click();
  await axe(page);
  await page.getByRole('button', { name: '적금', exact: true }).click();
  await heading(page, '이름을 정해주세요');
  await expect(page.getByLabel('이름을 정해주세요')).toHaveValue('적금');
  await page.getByLabel('이름을 정해주세요').fill('여행 적금');
  await page.getByRole('button', { name: '다음' }).click();
  await heading(page, '현재 금액은 얼마예요?');
  await page.getByLabel('현재 금액은 얼마예요?').fill('1200000');
  await page.getByRole('button', { name: '다음' }).click();
  await heading(page, '누구 명의예요?');
  // 합류 뒤에는 배우자 명의 새로 만들기 없음
  await expect(page.getByRole('radio', { name: /예빈/ })).toHaveCount(0);
  await page.getByRole('radio', { name: /^나/ }).click();
  await heading(page, '배우자에게 공개할까요?');
  await expect(page.getByRole('radio', { name: /합계만 공개/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await axe(page);
  await page.getByRole('button', { name: '추가하기' }).click();

  await expect(page).toHaveURL(/\/assets\/items\?side=asset/);
  await expect(page.getByText('추가했어요. 순자산이 120만 원 늘었어요')).toBeVisible();
  await expect(page.getByRole('button', { name: /여행 적금/ })).toBeVisible();
  expect(db.assets.at(-1)).toMatchObject({
    side: 'asset',
    grp: 'deposit',
    kind: 'saving',
    name: '여행 적금',
    amount: 1_200_000,
    owner: 'person',
    owner_user_id: db.me.id,
    visibility: 'sum',
  });
});

test('추가(합류 전): 배우자 명의는 대신 입력(전체 공개), 부채는 남은 대출금', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db, false);

  await page.goto('/assets/new?side=debt');
  await page.getByRole('button', { name: '할부' }).click();
  await page.getByRole('button', { name: '자동차 할부' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await heading(page, '남은 대출금은 얼마예요?');
  await page.getByLabel('남은 대출금은 얼마예요?').fill('8000000');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('radio', { name: /예빈/ }).click();

  await expect(page.getByText('추가했어요. 순자산이 800만 원 줄었어요')).toBeVisible();
  await expect(page.getByRole('button', { name: /자동차 할부/ })).toContainText('대신 입력');
  expect(db.assets.at(-1)).toMatchObject({
    side: 'debt',
    owner: 'person',
    owner_user_id: null,
    visibility: 'all',
  });
});
