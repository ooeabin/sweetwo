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
  rate_estimated: false,
  maturity_date: null,
  monthly_payment: null,
  interest_rate: null,
  paid_count: null,
  pay_from: null,
  goal_id: null,
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
  const plan = page.getByRole('button', { name: /이번 달 계획/ });
  await expect(plan).toContainText('620만 원');
  await expect(plan).toContainText('저축 가능 금액 월');
  await expect(page.getByRole('region', { name: '월 정산 요약' })).toContainText(
    '첫 월말 정리 뒤에 보여드려요',
  );
  await axe(page);

  await page.getByRole('button', { name: /부채 100만 원/ }).click();
  await expect(page).toHaveURL(/\/assets\/items\?side=debt/);
  await expect(page.getByRole('button', { name: /신용대출/ })).toContainText('금액이 맞나요?');
});

test('한눈에: 순자산 그래프 말풍선과 기간 탭 기억, 월 정산 요약과 지난달보다', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  // 2025년 9월부터 14달(앞의 빈 달은 그래프에서 뺌)
  db.netWorth = [
    { month: '2025-07-01', net: 0, expected: 0 },
    ...Array.from({ length: 14 }, (_, i) => {
      const d = new Date(Date.UTC(2025, 8 + i, 1)).toISOString().slice(0, 10);
      return { month: d, net: 10_000_000 + i * 300_000, expected: 10_000_000 + i * 400_000 };
    }),
  ];
  db.me.card_main = true;
  db.categories.push(
    { id: 'cat-eat', name: '외식·배달', sort: 1, enabled: true, deleted_at: null },
    { id: 'cat-shop', name: '쇼핑', sort: 2, enabled: true, deleted_at: null },
  );
  db.closes.push(
    {
      id: 'close-8',
      status: 'done',
      deleted_at: null,
      income: 6_000_000,
      closed_at: '2026-08-26T01:00:00Z',
      label_month: '2026-08-01',
      spends: [
        { category_id: 'cat-eat', amount: 400_000, deleted_at: null },
        { category_id: 'cat-shop', amount: 250_000, deleted_at: null },
      ],
      bigs: [],
      deposits: [],
    },
    {
      id: 'close-9',
      status: 'done',
      deleted_at: null,
      income: 6_000_000,
      closed_at: '2026-09-26T01:00:00Z',
      label_month: '2026-09-01',
      spends: [
        { category_id: 'cat-eat', amount: 480_000, deleted_at: null },
        { category_id: 'cat-shop', amount: 200_000, deleted_at: null },
      ],
      bigs: [],
      deposits: [{ name: '주택청약', amount: 1_000_000, deleted_at: null }],
    },
  );

  await page.goto('/assets');
  const plot = page.getByRole('slider', { name: '순자산 그래프' });
  // 처음엔 마지막 달(이번 달 = 지금 값)
  await expect(plot).toHaveAttribute('aria-valuetext', '2026년 10월, 1,600만 원, 예상 1,840만 원');
  const tabs = page.getByRole('group', { name: '기간' });
  // 14달: 1년으로 시작, 3년은 비활성
  await expect(tabs.getByRole('button', { name: '1년' })).toHaveAttribute('aria-pressed', 'true');
  await expect(tabs.getByRole('button', { name: '3년' })).toBeDisabled();
  await plot.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(plot).toHaveAttribute('aria-valuetext', '2026년 9월, 1,360만 원, 예상 1,480만 원');
  await page.keyboard.press('Home');
  await expect(plot).toHaveAttribute('aria-valuetext', /^2025년 11월/);
  await tabs.getByRole('button', { name: '6개월' }).click();
  await expect(plot).toHaveAttribute('aria-valuetext', /^2026년 10월/);
  await plot.focus();
  await page.keyboard.press('Home');
  await expect(plot).toHaveAttribute('aria-valuetext', /^2026년 5월/);

  // 월 정산 요약 = 가장 최근 정리(9월), 지난달보다 = 8월과 항목별 차이
  const sum = page.getByRole('region', { name: '9월 정산' });
  await expect(sum).toContainText('소득의');
  await expect(sum).toContainText('외식·배달+8만');
  await expect(sum).toContainText('쇼핑−5만');
  // 신용카드 주사용(O-38b)이면 변동 지출에 라벨
  await expect(sum).toContainText('지난달 카드 사용분');
  await axe(page);

  // 기간 탭은 기억
  await page.reload();
  await expect(
    page.getByRole('group', { name: '기간' }).getByRole('button', { name: '6개월' }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('자산·부채 목록: 통장 역할 배지, 투자 묶음 줄, 정렬 칩(묶음 안, 기억)', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  db.assets.push(
    asset({
      id: 'a5',
      side: 'asset',
      grp: 'cash',
      kind: 'role_account',
      name: '가족 비상금',
      amount: 1_000_000,
      owner: 'joint',
      owner_user_id: null,
      created_by: String(db.me.id),
      updated_at: '2026-10-05T00:00:00Z',
    }),
  );
  db.accounts.push(
    { id: 'acc-1', role: 'living', name: '생활비 통장', asset_id: 'a1', deleted_at: null },
    { id: 'acc-2', role: 'emergency', name: '가족 비상금', asset_id: 'a5', deleted_at: null },
  );

  await page.goto('/assets/items');
  const cash = page.getByRole('region', { name: '현금성' });
  await expect(cash.getByRole('button', { name: /생활비 통장/ })).toContainText('공동 생활비');
  await expect(cash.getByRole('button', { name: /가족 비상금/ })).toContainText('비상금');
  // 투자 비중 = (1,000 + 440) ÷ (300 + 100 + 1,000 + 200 + 440) = 71%, 손익 = 1,000 − 800
  const invest = page.getByRole('region', { name: '투자' });
  await expect(invest).toContainText('공동자금 투자 비중 71%');
  await expect(invest).toContainText('+200만 원(+25%)');

  const names = () => cash.getByRole('button').allTextContents();
  // 기본 = 금액 큰 순
  expect((await names())[0]).toContain('생활비 통장');
  const sorts = page.getByRole('group', { name: '정렬' });
  await expect(sorts.getByRole('button', { name: '금액, 내림차순' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await sorts.getByRole('button', { name: '이름' }).click();
  await expect(sorts.getByRole('button', { name: '이름, 오름차순' })).toBeVisible();
  expect((await names())[0]).toContain('가족 비상금');
  await sorts.getByRole('button', { name: '이름, 오름차순' }).click();
  expect((await names())[0]).toContain('생활비 통장');
  await axe(page);
  await page.reload();
  await expect(
    page.getByRole('group', { name: '정렬' }).getByRole('button', { name: '이름, 내림차순' }),
  ).toHaveAttribute('aria-pressed', 'true');
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

test('추가: 유형 → 이름 → 금액 → 명의 → 공개 범위 → 적금 질문 → 목표 연결', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  db.goals.push({
    id: 'g-trip',
    template: 'travel',
    name: '여행',
    kind: 'once',
    owner: 'together',
    priority: 1,
    target_amount: 3_000_000,
    other_held: 0,
    deadline: '2027-12-01',
    status: 'active',
    after_marriage: false,
    details: {},
    created_by: db.me.id,
    created_at: '2026-09-01T00:00:00Z',
    deleted_at: null,
  });

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
  await page.getByRole('button', { name: '다음' }).click();
  // 적금 유형별 질문(F-03f): 만기일 → 월 납입액 → 빠지는 통장 → 목표 연결
  await heading(page, '만기일은 언제예요?');
  await page.getByLabel('년', { exact: true }).fill('2027');
  await page.getByLabel('월', { exact: true }).fill('9');
  await page.getByLabel('일', { exact: true }).fill('30');
  await page.getByRole('button', { name: '다음' }).click();
  await heading(page, '월 납입액은요?');
  await page.getByLabel('월 납입액은요?').fill('300000');
  await page.getByRole('button', { name: '다음' }).click();
  await heading(page, '어느 통장에서 빠져나가요?');
  await page.getByRole('radio', { name: /목표자금 통장/ }).click();
  await heading(page, '어떤 목표를 위한 돈인가요?');
  await axe(page);
  await page.getByRole('radio', { name: /여행/ }).click();

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
    maturity_date: '2027-09-30',
    monthly_payment: 300_000,
    pay_from: 'goal_fund',
    goal_id: 'g-trip',
  });
  await expect(page.getByRole('button', { name: /여행 적금/ })).toContainText('여행 목표');

  // 목표 보유액에 연결 자산이 들어감
  await page.goto('/goals/g-trip');
  await expect(page.locator('.hg-card', { hasText: '기타 보유액' })).toContainText(
    '연결 자산 120만 원',
  );
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
  // 부채 유형별 질문(F-03g): 금리 → 월 상환액, 나중에 해도 됨
  await heading(page, '금리는 몇 %예요?');
  await page.getByLabel('금리는 몇 %예요?').fill('4.5');
  await page.getByRole('button', { name: '다음' }).click();
  await heading(page, '월 상환액은요?');
  await page.getByRole('button', { name: '나중에 할게요' }).click();

  await expect(page.getByText('추가했어요. 순자산이 800만 원 줄었어요')).toBeVisible();
  await expect(page.getByRole('button', { name: /자동차 할부/ })).toContainText('대신 입력');
  expect(db.assets.at(-1)).toMatchObject({
    side: 'debt',
    owner: 'person',
    owner_user_id: null,
    visibility: 'all',
    interest_rate: 4.5,
    monthly_payment: null,
  });
});

test('월 수입·지출(F-05): 내 수입·월급날은 바로, 고정지출은 바로, 생활비는 제안', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);

  await page.goto('/assets');
  await page.getByRole('button', { name: /이번 달 계획/ }).click();
  await expect(page).toHaveURL(/\/assets\/money$/);
  await heading(page, '월 수입·지출');
  const income = page.getByRole('region', { name: '월 수입' });
  await expect(income.getByRole('button', { name: /찬우/ })).toContainText('월급날 25일');
  await expect(income.getByRole('button', { name: /찬우/ })).toContainText('350만 원');
  await expect(income).toContainText('예빈');
  await expect(income.getByRole('button', { name: /예빈/ })).toHaveCount(0); // 배우자 수입은 보기만
  await expect(page.getByRole('region', { name: '저축 가능 금액' })).toContainText('335만 원');
  await axe(page);

  // 내 수입 → 월급날(사실값, 바로)
  await income.getByRole('button', { name: /찬우/ }).click();
  await heading(page, '찬우님은 한 달에 얼마 받으세요?');
  await page.getByLabel('찬우님은 한 달에 얼마 받으세요?').fill('4000000');
  await expect(page.getByText('저축 가능 금액이 월 50만 원 늘어요')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();
  await heading(page, '월급날은 며칠이에요?');
  await expect(page.getByRole('radio', { name: '25일' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('radio', { name: '말일' }).click();
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('안 나눈 돈이 없어 월말 정리에서 맞춰요')).toBeVisible();
  expect(db.me).toMatchObject({ monthly_income: 4_000_000, payday: null, payday_last: true });

  // 고정지출(바로)
  await page.getByRole('button', { name: /고정지출/ }).click();
  await heading(page, '같이 내는 돈은 한 달에 얼마예요?');
  await page.getByLabel('같이 내는 돈은 한 달에 얼마예요?').fill('1200000');
  await expect(page.getByText('저축 가능 금액이 월 20만 원 줄어요')).toBeVisible();
  await page.getByRole('button', { name: '저장' }).click();
  await expect.poll(() => db.space?.fixed_total).toBe(1_200_000);

  // 생활비 예산(배분 결정: 연결이면 제안)
  await page.getByRole('button', { name: /생활비/ }).click();
  await heading(page, '식비·생활용품 등에는 한 달에 얼마쯤 쓰세요?');
  await page.getByLabel('식비·생활용품 등에는 한 달에 얼마쯤 쓰세요?').fill('500000');
  // 월급날을 말일로 바꿔서 기준일(두 월급날 중 늦은 날)도 말일
  await expect(page.getByText('좋아요면 바로, 반대 없으면 10월 31일부터 적용돼요')).toBeVisible();
  await page.getByRole('button', { name: '예빈님께 제안하기' }).click();
  await expect(page.getByText('예빈님에게 제안했어요')).toBeVisible();
  expect(db.proposals.at(-1)).toMatchObject({
    item: 'living_budget',
    after: { living_budget: 500_000 },
  });
  expect(db.space?.living_budget).toBe(550_000);
});

test('월 수입·지출(합류 전): 용돈은 바로 저장', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db, false);

  await page.goto('/assets/money');
  await page.getByRole('button', { name: /용돈/ }).click();
  await heading(page, '찬우님 용돈은 한 달에 얼마로 할까요?');
  await page.getByLabel('찬우님 용돈은 한 달에 얼마로 할까요?').fill('400000');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page).toHaveURL(/\/assets\/money$/);
  expect(db.me.allowance).toBe(400_000);
  expect(db.proposals).toEqual([]);
});

test('재정 진단(F-06): 요약, 위험·주의 먼저, 비상금 개월, 추정, 바로가기, 한눈에 진단 줄', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  db.goals.push({
    id: 'g-e',
    template: 'emergency',
    name: '비상금',
    kind: 'once',
    owner: 'together',
    priority: 0,
    target_amount: 5_550_000,
    other_held: 3_000_000,
    deadline: '2027-10-01',
    status: 'active',
    after_marriage: false,
    details: {},
    created_by: db.me.id,
    created_at: '2026-09-01T00:00:00Z',
    deleted_at: null,
  });

  // 한눈에 진단 줄: 비상금 300 ÷ (고정 130 + 생활비 55) = 1.6개월, 기준 3개월의 54% → 주의
  await page.goto('/assets');
  const line = page.getByRole('button', { name: /재정 진단 5개 중 3개 양호/ });
  await expect(line).toContainText('비상금으로 1.6개월 생활할 수 있어요');
  await line.click();
  await expect(page).toHaveURL(/\/assets\/diagnosis$/);
  await expect(page.getByText('5개 중 3개 양호')).toBeVisible();
  const cards = page.locator('section.hg-card');
  await expect(cards.first()).toHaveAttribute('aria-label', '비상금');
  const em = page.getByRole('region', { name: '비상금' });
  await expect(em).toContainText('주의');
  await expect(em).toContainText('3개월분까지 모아봐요');
  // 월말 정리 전이라 저축률은 계획값(추정)
  const saving = page.getByRole('region', { name: '저축률' });
  await expect(saving).toContainText('월 수입의 54%를 저축하고 있어요');
  await expect(saving).toContainText('추정');
  await expect(page.getByRole('region', { name: '대출 상환 부담' })).toContainText(
    '월 수입의 4.8%를 대출 상환에 쓰고 있어요',
  );
  await expect(page.getByRole('region', { name: '투자 원칙 합의' })).toContainText('아직 몰라요');
  await axe(page);

  await em.getByRole('button', { name: '비상금 목표' }).click();
  await expect(page).toHaveURL(/\/goals\/g-e$/);
});

test('투자 원칙(O-53): 할 일에서 열고, 보수적인 쪽 허용 비중, 진단 양호, 목록 허용 비중', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  (db.partner as Record<string, unknown>).invest_answer = 'active';
  // 첫 주 다른 할 일은 끝냄 → 7일째 투자 원칙이 보임
  for (const kind of ['assets', 'loans', 'fixed_card', 'rest', 'spend_check', 'exact_values'])
    db.todos.push({
      id: `todo-${kind}`,
      kind,
      status: 'done',
      snoozed_until: null,
      deleted_at: null,
    });
  db.todos.push({
    id: 'todo-invest',
    kind: 'invest',
    screen: 'O-53',
    open_on: '2026-08-26',
    status: 'pending',
    snoozed_until: null,
    deleted_at: null,
  });

  await page.goto('/');
  await page.getByRole('button', { name: /투자 원칙 정하기/ }).click();
  await expect(page).toHaveURL(/\/assets\/principle$/);
  await page.goBack();

  await page.goto('/assets/diagnosis');
  const card = page.getByRole('region', { name: '투자 원칙 합의' });
  await expect(card).toContainText('주의');
  await expect(card).toContainText('내 답을 기다려요');
  await card.getByRole('button', { name: '지금 정하기' }).click();

  await heading(page, '같이 모은 돈, 투자는 어느 정도까지 괜찮아요?');
  await expect(page.getByText('예빈님은 ‘일부는 적극적으로’를 골랐어요')).toBeVisible();
  await axe(page);
  await page.getByRole('radio', { name: /조금은 괜찮아요/ }).click();
  await expect(page).toHaveURL(/\/assets\/diagnosis$/);
  expect(db.me.invest_answer).toBe('some');
  expect(db.todos.find((t) => t.kind === 'invest')?.status).toBe('done');
  const done = page.getByRole('region', { name: '투자 원칙 합의' });
  await expect(done).toContainText('양호');
  await expect(done).toContainText('공동자금은 30%까지 투자하기로 했어요');
  await expect(done.getByRole('button', { name: '지금 정하기' })).toHaveCount(0);

  await page.goto('/assets/items');
  await expect(page.getByRole('region', { name: '투자' })).toContainText(
    '공동자금 투자 비중 74% / 허용 30%',
  );
});

const goal = (o: Record<string, unknown>) => ({
  kind: 'once',
  owner: 'together',
  target_amount: 10_000_000,
  other_held: 0,
  deadline: '2028-12-01',
  status: 'active',
  after_marriage: false,
  details: {},
  created_at: '2026-09-01T00:00:00Z',
  deleted_at: null,
  ...o,
});
const firstWeekTodos = (db: MemDb, open: string) => {
  for (const kind of [
    'assets',
    'loans',
    'fixed_card',
    'rest',
    'invest',
    'spend_check',
    'exact_values',
  ])
    db.todos.push({
      id: `todo-${kind}`,
      kind,
      screen: 'O-41',
      open_on: '2026-08-21',
      status: kind === open ? 'pending' : 'done',
      snoozed_until: null,
      deleted_at: null,
    });
};

test('자산 정리하기(O-41~43): 쓰던 통장 안내, 전세면 부동산 미리 선택, 고른 것마다 금액, 목돈은 목표로', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db, false);
  (db.space as Record<string, unknown>).housing = 'jeonse';
  db.accounts.push({
    id: 'acc-1',
    role: 'living',
    name: '생활비 통장',
    asset_id: 'a1',
    deleted_at: null,
  });
  db.goals.push(
    goal({ id: 'g-home', template: 'home', name: '집', priority: 1, created_by: db.me.id }),
    goal({ id: 'g-e', template: 'emergency', name: '비상금', priority: 2, created_by: db.me.id }),
  );
  firstWeekTodos(db, 'assets');

  await page.goto('/');
  await page.getByRole('button', { name: /자산 정리하기/ }).click();
  await heading(page, '지금 가진 돈을 골라주세요');
  await expect(page.getByText('쓰던 통장 1개는 이미 넣어뒀어요')).toBeVisible();
  const chips = page.getByRole('group', { name: '지금 가진 돈을 골라주세요' });
  await expect(chips.getByRole('button', { name: '부동산' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await chips.getByRole('button', { name: '청약' }).click();
  await chips.getByRole('button', { name: '결혼 후 남은 목돈' }).click();
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();

  // 칩 순서: 청약 → 부동산 → 결혼 후 남은 목돈
  await heading(page, '청약은 얼마예요?');
  await expect(page.getByText('청약 1/3')).toBeVisible();
  await page.getByLabel('청약은 얼마예요?').fill('5000000');
  await page.getByLabel('납입 회차는요?').fill('24');
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();

  await heading(page, '부동산은 얼마예요?');
  await page.getByRole('tab', { name: '같이' }).click();
  await page.getByLabel('부동산은 얼마예요?').fill('100000000');
  await page.getByRole('button', { name: '다음' }).click();

  await heading(page, '결혼 후 남은 목돈은 얼마예요?');
  await page.getByRole('tab', { name: '예빈' }).click();
  await page.getByLabel('결혼 후 남은 목돈은 얼마예요?').fill('8000000');
  await page.getByRole('button', { name: '다음' }).click();

  await heading(page, '이 돈을 어느 목표에 넣을까요?');
  await expect(page.getByRole('radio', { name: /비상금/ })).toContainText('추천');
  await page.getByRole('radio', { name: /비상금/ }).click();
  await expect(page).toHaveURL(/\/$/);

  const byName = (n: string) => db.assets.find((a) => a.name === n);
  expect(byName('청약')).toMatchObject({
    grp: 'subscription',
    amount: 5_000_000,
    paid_count: 24,
    owner: 'person',
    owner_user_id: db.me.id,
    visibility: 'sum',
  });
  expect(byName('부동산')).toMatchObject({ grp: 'real_estate', owner: 'joint', visibility: 'all' });
  expect(byName('결혼 후 남은 목돈')).toMatchObject({
    grp: 'cash',
    owner: 'person',
    owner_user_id: null,
    goal_id: 'g-e',
  });
  expect(db.todos.find((t) => t.kind === 'assets')?.status).toBe('done');
});

test('대출 정리하기(O-44~47): 대출마다 남은 돈, 금리(모르면 평균 추정), 월 상환 → 합계가 대출 상환을 대신', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  firstWeekTodos(db, 'loans');

  await page.goto('/');
  await page.getByRole('button', { name: /대출 정리하기/ }).click();
  await heading(page, '갚고 있는 대출이 있나요?');
  const chips = page.getByRole('group', { name: '갚고 있는 대출이 있나요?' });
  // 없어요는 단독, 대출 상환 합계가 있었으면 확인
  await chips.getByRole('button', { name: '없어요' }).click();
  await expect(page.getByText('처음에 대출 상환이 월 30만 원이라고 했어요')).toBeVisible();
  await chips.getByRole('button', { name: '주택' }).click();
  await expect(chips.getByRole('button', { name: '없어요' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await chips.getByRole('button', { name: '학자금' }).click();
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();

  await heading(page, '주택 남은 돈은요?');
  await expect(page.getByText('주택 1/2')).toBeVisible();
  // 합류 뒤라 배우자 명의는 없음
  await expect(page.getByRole('tab', { name: '예빈' })).toHaveCount(0);
  await page.getByRole('tab', { name: '같이' }).click();
  await page.getByLabel('주택 남은 돈은요?').fill('150000000');
  await page.getByRole('button', { name: '다음' }).click();
  await heading(page, '금리는 몇 %예요?');
  await page.getByRole('button', { name: '잘 모르겠어요' }).click();
  await heading(page, '한 달에 얼마씩 갚아요?');
  await page.getByLabel('한 달에 얼마씩 갚아요?').fill('700000');
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();

  await heading(page, '학자금 남은 돈은요?');
  await page.getByLabel('학자금 남은 돈은요?').fill('5000000');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('금리는 몇 %예요?').fill('1.7');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('한 달에 얼마씩 갚아요?').fill('200000');
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page).toHaveURL(/\/$/);

  expect(db.assets.find((a) => a.name === '주택')).toMatchObject({
    side: 'debt',
    grp: 'housing_loan',
    kind: 'jeonse_loan',
    owner: 'joint',
    amount: 150_000_000,
    interest_rate: 4,
    rate_estimated: true,
    monthly_payment: 700_000,
  });
  expect(db.assets.find((a) => a.name === '학자금')).toMatchObject({
    interest_rate: 1.7,
    rate_estimated: false,
    monthly_payment: 200_000,
  });
  // 기존 신용대출(월 상환 없음) + 70만 + 20만
  expect(db.space?.loan_repayment).toBe(900_000);
  expect(db.todos.find((t) => t.kind === 'loans')?.status).toBe('done');
});

test('고정지출 나누기·생활비 카드(O-37, O-38b): 그룹만 고른 건 세부 항목부터, 같이 내는 항목 합계가 고정지출 합계를 대신', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  db.fixed.push(
    {
      id: 'f1',
      group_key: 'housing',
      name: '주거',
      burden: 'shared',
      sort: 0,
      monthly_amount: null,
      deleted_at: null,
    },
    {
      id: 'f2',
      group_key: 'telecom',
      name: '휴대폰',
      burden: 'personal',
      sort: 1,
      monthly_amount: null,
      deleted_at: null,
    },
    {
      id: 'f3',
      group_key: 'telecom',
      name: '인터넷·TV',
      burden: 'shared',
      sort: 2,
      monthly_amount: null,
      deleted_at: null,
    },
  );
  firstWeekTodos(db, 'fixed_card');

  await page.goto('/');
  await page.getByRole('button', { name: /고정지출 나누기/ }).click();
  await heading(page, '어디에 나가는 돈이에요?');
  await page.getByRole('group', { name: '주거' }).getByRole('button', { name: '월세' }).click();
  await page.getByRole('group', { name: '주거' }).getByRole('button', { name: '관리비' }).click();
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();

  // 같이 내는 항목만: 인터넷·TV, 월세, 관리비(휴대폰은 각자)
  await heading(page, '인터넷·TV에 한 달에 얼마 나가요?');
  await expect(page.getByText('인터넷·TV 1/3')).toBeVisible();
  await page.getByLabel('인터넷·TV에 한 달에 얼마 나가요?').fill('30000');
  await page.getByRole('button', { name: '다음' }).click();
  await heading(page, '월세에 한 달에 얼마 나가요?');
  await page.getByLabel('월세에 한 달에 얼마 나가요?').fill('600000');
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('관리비에 한 달에 얼마 나가요?').fill('150000');
  await page.getByRole('button', { name: '다음' }).click();

  await heading(page, '생활비는 주로 신용카드로 쓰나요?');
  expect(db.space?.fixed_total).toBe(780_000);
  expect(db.fixed.find((r) => r.id === 'f1')?.deleted_at).toBeTruthy();
  await axe(page);
  await page.getByRole('radio', { name: '네' }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(db.me.card_main).toBe(true);
  expect(db.todos.find((t) => t.kind === 'fixed_card')?.status).toBe('done');
});

test('상여금·다른 수입(O-34, O-35, O-35b): 상여금 행마다 기록, 다른 수입은 월 수입에 더함', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  firstWeekTodos(db, 'rest');

  await page.goto('/');
  await page.getByRole('button', { name: /나머지 목표/ }).click();
  await heading(page, '상여금이나 성과급도 있나요?');
  await axe(page);
  await page.getByRole('radio', { name: '있어요' }).click();

  await heading(page, '보통 몇 월에 얼마쯤 받아요?');
  await page.getByLabel('1번째 월').selectOption('12');
  await page
    .getByRole('group', { name: '보통 몇 월에 얼마쯤 받아요?' })
    .getByRole('textbox')
    .nth(1)
    .fill('2000000');
  await expect(page.getByText('1년에 200만 원 받아요')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();

  await heading(page, '월급 말고 들어오는 돈이 또 있나요?');
  const chips = page.getByRole('group', { name: '월급 말고 들어오는 돈이 또 있나요?' });
  await chips.getByRole('button', { name: '부업·N잡' }).click();
  await chips.getByRole('button', { name: '월세·임대 수입' }).click();
  await page.getByRole('button', { name: '다음' }).click();

  await heading(page, '부업·N잡은 한 달에 얼마쯤이에요?');
  await expect(page.getByText('들쭉날쭉하면 적게 벌 때 기준으로 적어 주세요')).toBeVisible();
  await page.getByLabel('부업·N잡은 한 달에 얼마쯤이에요?').fill('300000');
  await page.getByRole('button', { name: '다음' }).click();
  await heading(page, '월세·임대 수입은 한 달에 얼마쯤이에요?');
  await page.getByLabel('월세·임대 수입은 한 달에 얼마쯤이에요?').fill('500000');
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page).toHaveURL(/\/$/);

  expect(db.incomeEvents).toMatchObject([{ name: '상여금', amount: 2_000_000, month: 12 }]);
  expect(db.incomeItems.map((r) => [r.kind, r.monthly_amount])).toEqual([
    ['side_job', 300_000],
    ['rent', 500_000],
  ]);
  expect(db.me.other_income).toBe(800_000);
  expect(db.todos.find((t) => t.kind === 'rest')?.status).toBe('done');

  // 월 수입에 더해짐: 찬우 350만 + 다른 수입 80만
  await page.goto('/assets/money');
  const mine = page.getByRole('button', { name: /다른 수입 80만 원 포함/ });
  await expect(mine).toContainText('430만 원');
});

test('나머지 목표(O-22~25): 순서 → 1순위 모아둔 돈 → 다음 목표 질문·기한·모아둔 돈 → 매달 목표 → 상여금으로', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  const me = db.me.id;
  db.goals.push(
    goal({ id: 'g-e', template: 'emergency', name: '비상금', priority: 0, created_by: me }),
    goal({
      id: 'g-home',
      template: 'home',
      name: '내 집 마련',
      priority: 1,
      details: { price: 500_000_000, ratio: 30 },
      target_amount: 150_000_000,
      deadline: '2031-10-01',
      created_by: me,
    }),
    goal({
      id: 'g-buy',
      template: 'big_purchase',
      name: '명품·큰 물건 구입',
      priority: 2,
      target_amount: null,
      deadline: null,
      created_by: me,
    }),
    goal({
      id: 'g-old',
      template: 'retirement',
      name: '노후·연금',
      priority: 3,
      kind: 'monthly',
      target_amount: null,
      deadline: null,
      created_by: me,
    }),
  );
  firstWeekTodos(db, 'rest');

  await page.goto('/');
  await page.getByRole('button', { name: /나머지 목표/ }).click();
  await heading(page, '어떤 것부터 모을까요?');
  await axe(page);
  await page.getByRole('button', { name: '이 순서로 할게요' }).click();

  // 1순위는 질문을 끝냈으니 모아둔 돈만
  await heading(page, '이 목표에 이미 모아둔 돈이 있나요?');
  await expect(page.getByText('1순위')).toBeVisible();
  await page.getByRole('radio', { name: '없어요' }).click();

  await heading(page, '무엇을 사고 싶어요?');
  await expect(page.getByText('2순위')).toBeVisible();
  await page.getByLabel('무엇을 사고 싶어요?').fill('노트북');
  await page.getByRole('button', { name: '다음' }).click();
  await heading(page, '얼마예요?');
  await page.getByLabel('얼마예요?').fill('2000000');
  await page.getByRole('button', { name: '다음' }).click();

  await heading(page, '언제까지 모을까요?');
  await page.getByLabel('언제까지 모을까요?').fill('2027');
  await expect(page.getByText(/매달 .* 모으면 돼요/)).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();

  await heading(page, '이 목표에 이미 모아둔 돈이 있나요?');
  await page.getByRole('radio', { name: '가진 자산에서 고르기' }).click();
  await page.getByRole('button', { name: /생활비 통장/ }).click();
  await page.getByRole('button', { name: '다음' }).click();

  await heading(page, '한 달에 얼마씩 넣을까요?');
  await page.getByLabel('한 달에 얼마씩 넣을까요?').fill('300000');
  await page.getByRole('button', { name: '다음' }).click();

  // 남은 목표가 없으면 상여금(O-34)
  await heading(page, '상여금이나 성과급도 있나요?');
  const byId = (id: string) => db.goals.find((g) => g.id === id) as Record<string, unknown>;
  expect((byId('g-home').details as Record<string, unknown>)._held).toBe(true);
  expect(byId('g-buy')).toMatchObject({ target_amount: 2_000_000, deadline: '2027-10-01' });
  expect((byId('g-buy').details as Record<string, unknown>).what).toBe('노트북');
  expect(db.assets.find((a) => a.id === 'a1')?.goal_id).toBe('g-buy');
  expect(byId('g-old')).toMatchObject({ kind: 'monthly', target_amount: 300_000 });
});
