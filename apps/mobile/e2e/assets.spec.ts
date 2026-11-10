import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { mockOnboarding, type MemDb } from './onboarding-mock';
import { setWheel } from './wheel';

/** 추가 입구: 넓은 창은 제목 줄 버튼, 좁은 창은 화면 안 회색 ‘+ … 추가’ 줄(AddRow, 2026-11-09 + 버튼 대신) */
const addEntry = (page: Page, name: string) =>
  page
    .getByRole('button', { name, exact: true })
    .or(page.locator('.hg-addrow'))
    .locator('visible=true')
    .first();

// 자산 관리 F-01 요약, F-02 자산·부채, F-03 추가, F-04 상세(docs/spec/23-assets.md). 찬우, 예빈 합류.

const axe = async (page: Page) => {
  const r = await runAxe(page);
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

test('요약: 순자산(원금 기준)과 예상, 지난달 대비, 합계(재기획: 이번 달 카드·계획·정산 요약 없음)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);

  await page.goto('/');
  // 넓은 창은 사이드바 탭, 좁은 창은 홈 자산 관리 타일(2026-11-09 하단 탭 막대 없앰)
  await page
    .getByRole('link', { name: '자산 관리' })
    .or(page.getByRole('button', { name: /^자산 관리/ }))
    .locator('visible=true')
    .first()
    .click();
  await expect(page).toHaveURL(/\/assets$/);
  // 자산(원금 기준) 3 + 8 + 2 + 파트너 합계만 400 = 1,700만, 부채 100만 → 순자산 1,600만
  const nw = page.getByRole('region', { name: '순자산', exact: true });
  await expect(nw).toContainText('1,600만 원');
  await expect(nw).toContainText('지난달보다 180만 원 늘었어요');
  // 예상 순자산과 안 판 수익은 목록 한 줄(2026-11-03)
  await expect(page.locator('.hg-listrow', { hasText: '예상 순자산' })).toContainText('1,840만 원');
  await expect(page.locator('.hg-listrow', { hasText: '예상 순자산' })).toContainText(
    '안 판 수익 +240만 원 포함',
  );
  await expect(page.getByRole('button', { name: /^자산\s*1,940만 원/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^부채\s*100만 원/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /이번 달 계획/ })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: '재정 진단' })).toHaveCount(0);
  await axe(page);

  await page.getByRole('button', { name: /^부채\s*100만 원/ }).click();
  await expect(page).toHaveURL(/\/assets\/items\?side=debt/);
  await expect(page.getByRole('button', { name: /신용대출/ })).toContainText('금액이 맞나요?');
});

test('요약: 달마다 순자산 막대(최근 6달, 이번 달만 진하게 + 값)', async ({ page }) => {
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
  const bars = page.getByRole('img', { name: '달마다 순자산, 2026년 10월 1,600만 원' });
  await expect(bars).toBeVisible();
  await expect(bars.locator('.hg-mbars__col small')).toHaveText([
    '5월',
    '6월',
    '7월',
    '8월',
    '9월',
    '10월',
  ]);
  await expect(bars.locator('.hg-mbars__col.is-now')).toContainText('1,600만');
  await axe(page);
});

test('자산·부채 목록: 통장 역할 배지 없음, 투자 묶음 줄, 정렬 칩(묶음 안, 기억)', async ({
  page,
}) => {
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
  // 통장 역할 배지는 재기획으로 없앰
  await expect(cash.getByRole('button', { name: /생활비 통장/ })).not.toContainText('공동 생활비');
  // 투자 묶음 줄 = 안 판 수익(손익 = 1,000 − 800). 2026-11-04 투자 비중 줄은 뺌
  const invest = page.getByRole('region', { name: '투자' });
  await expect(invest).toContainText('안 판 수익');
  await expect(invest).not.toContainText('투자 비중');
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

test('자산·부채 목록 → 상세: 묶음, 파트너 합계만, 공개 범위, 금액 수정, 삭제 되돌리기', async ({
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
  await expect(invest.getByRole('button', { name: /내 주식/ })).toContainText('금액만');
  await expect(invest).toContainText('예빈님 자산 2개');
  await expect(invest).toContainText('440만 원');
  await expect(page.getByRole('button', { name: /생활비 통장/ })).toContainText('공동');
  await axe(page);

  // 파트너 명의는 볼 수만
  await page.getByRole('button', { name: /예빈 적금/ }).click();
  await expect(page.getByText('예빈님 항목이라 볼 수만 있어요')).toBeVisible();
  await expect(page.getByRole('button', { name: '시세 바꾸기' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '항목 메뉴' })).toHaveCount(0);

  await page.goto('/assets/a2');
  await heading(page, '내 주식');
  await expect(page.getByRole('region', { name: '금액' })).toContainText(
    '+200만 원, 원금 800만 원',
  );
  // 수정 내역은 직접 고친 것만(23 F-04 5번)
  await expect(page.getByRole('region', { name: '수정 내역' })).not.toContainText('월말 정리');
  await axe(page);
  await page.getByRole('button', { name: '시세 바꾸기' }).click();
  await page.getByRole('textbox', { name: '금액' }).fill('12000000');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('저장했어요')).toBeVisible();
  expect(db.assets.find((a) => a.id === 'a2')?.amount).toBe(12_000_000);
  await expect(page.getByRole('region', { name: '수정 내역' })).toContainText('1,200만 원');

  await page.getByRole('button', { name: /공개 범위/ }).click();
  await page.getByRole('radio', { name: /숨기기/ }).click();
  await expect.poll(() => db.assets.find((a) => a.id === 'a2')?.visibility).toBe('private');

  await page.getByRole('button', { name: '항목 메뉴' }).click();
  await page.getByRole('menuitem', { name: '삭제' }).click();
  await expect(page).toHaveURL(/\/assets\/items\?side=asset/);
  await expect(page.getByText('휴지통으로 옮겼어요')).toBeVisible();
  await expect(page.getByRole('button', { name: /내 주식/ })).toHaveCount(0);
  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect(page.getByRole('button', { name: /내 주식/ })).toBeVisible();
});

test('추가: 유형 → 이름 → 금액 → 명의 → 공개 범위 → 적금 질문(통장·목표 연결 없음)', async ({
  page,
}) => {
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
  await addEntry(page, '+ 추가').click();
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
  // 합류 뒤에는 파트너 명의 새로 만들기 없음
  await expect(page.getByRole('radio', { name: /예빈/ })).toHaveCount(0);
  await page.getByRole('radio', { name: /^나/ }).click();
  await heading(page, '파트너에게 공개할까요?');
  await expect(page.getByRole('radio', { name: /금액만 보여 주기/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();
  // 적금 유형별 질문(F-03f): 만기일 → 월 납입액 → 끝
  await heading(page, '만기일은 언제예요?');
  // 2026-11-04 날짜 휠(처음 값 1년 뒤 오늘 2027-10-07): 월 ↑ 한 번(9월), 일 End(30일)
  await page.getByRole('spinbutton', { name: '월' }).press('ArrowUp');
  await page.getByRole('spinbutton', { name: '일' }).press('End');
  await page.getByRole('button', { name: '다음' }).click();
  await heading(page, '월 납입액은요?');
  await page.getByLabel('월 납입액은요?').fill('300000');
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
    maturity_date: '2027-09-30',
    monthly_payment: 300_000,
  });
  expect(db.assets.at(-1)?.goal_id ?? null).toBeNull();
});

test('추가: 어드민 항목 이름 목록(AD-19)을 칩에 입힘(숨긴 기본 항목은 빠지고, 새 칩은 따르는 항목 질문)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  db.kindNames = [
    {
      id: 'k1',
      grp: 'deposit',
      base: 'term_deposit',
      name: '정기예금',
      added: false,
      hidden: true,
    },
    {
      id: 'k2',
      grp: 'deposit',
      base: 'policy_saving',
      name: '청년도약계좌',
      added: true,
      hidden: false,
    },
  ];
  await page.goto('/assets/items');
  await addEntry(page, '+ 추가').click();
  await page.getByRole('button', { name: '예금·적금' }).click();
  const chips = page.getByRole('group', { name: '예금·적금' });
  await expect(chips.getByRole('button')).toHaveText([
    '적금',
    '정책형 적금',
    '청년도약계좌',
    '기타(직접 입력)',
  ]);
  await chips.getByRole('button', { name: '청년도약계좌' }).click();
  await expect(page.getByLabel('이름을 정해주세요')).toHaveValue('청년도약계좌');
});

test('추가(합류 전): 파트너 명의는 대신 입력(모두 보여 주기), 부채는 남은 대출금', async ({
  page,
}) => {
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
  // F-04 3번: 금리도 그 자리에서 고침(입력칸 + 저장, 범위 밖이면 안내)
  await page.getByRole('button', { name: /자동차 할부/ }).click();
  await page.getByRole('button', { name: /금리/ }).click();
  const rate = page.getByRole('textbox', { name: '금리' });
  await rate.fill('45');
  await expect(page.getByText('0~30% 사이로 적어 주세요')).toBeVisible();
  await rate.fill('4.2');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByRole('button', { name: /금리/ })).toContainText('4.2%');
  expect(db.assets.at(-1)).toMatchObject({ interest_rate: 4.2, rate_estimated: false });
});

test('추가: 잘 모르겠어요 → 구간 칩 → ‘추정’으로 저장, 목록에 추정 알약', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/assets/items');
  await addEntry(page, '+ 추가').click();
  await page.getByRole('button', { name: '예금·적금' }).click();
  await page.getByRole('button', { name: '적금', exact: true }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await heading(page, '현재 금액은 얼마예요?');
  await page.getByRole('button', { name: '잘 모르겠어요' }).click();
  await page.getByRole('button', { name: '1~3천' }).click();
  await heading(page, '누구 명의예요?');
  await page.getByRole('radio', { name: /^나/ }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await heading(page, '만기일은 언제예요?');
  // 유형별 질문은 나중에(F-03f)
  await page.getByRole('button', { name: '나중에 할게요' }).click();
  await heading(page, '월 납입액은요?');
  await page.getByRole('button', { name: '나중에 할게요' }).click();
  await expect(page).toHaveURL(/\/assets\/items\?side=asset/);
  expect(db.assets.at(-1)).toMatchObject({ amount: 20_000_000, estimated: true });
  const row = page.getByRole('button', { name: /^적금/ });
  await expect(row).toContainText('추정');
});

test('주택 대출(F-03g): 월 상환액을 먼저 묻고 금리는 다음, 목록 줄에 “매달”', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db, false);

  await page.goto('/assets/new?side=debt');
  await page.getByRole('button', { name: '주택' }).click();
  await page.getByRole('button', { name: '주택담보대출' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await heading(page, '남은 대출금은 얼마예요?');
  await page.getByLabel('남은 대출금은 얼마예요?').fill('200000000');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('radio', { name: /예빈/ }).click();
  await heading(page, '월 상환액은요?');
  await page.getByLabel('월 상환액은요?').fill('1200000');
  await page.getByRole('button', { name: '다음' }).click();
  await heading(page, '금리는 몇 %예요?');
  await page.getByRole('button', { name: '나중에 할게요' }).click();

  await expect(page.getByRole('button', { name: /주택담보대출/ })).toContainText('매달 120만 원');
  expect(db.assets.at(-1)).toMatchObject({ monthly_payment: 1_200_000, interest_rate: null });
});

test('F-04 금액 충돌(30 동기화 2장): 예빈님이 1분 안에 같은 금액을 바꿨으면 고르기 → 예빈님 값이면 그대로', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/assets/a1');
  await heading(page, '생활비 통장');
  await page.getByRole('button', { name: '금액 고치기' }).click();
  const a1 = db.assets.find((a) => a.id === 'a1');
  if (!a1) throw new Error('seed');
  Object.assign(a1, {
    amount: 3_500_000,
    updated_by: 'yebin',
    updated_at: new Date(NOW.getTime() - 20_000).toISOString(),
  });
  await page.getByRole('textbox', { name: '금액' }).fill('2800000');
  await page.getByRole('button', { name: '저장' }).click();
  const choice = page.getByRole('group', { name: '어느 쪽으로 할까요?' });
  await expect(choice).toContainText('예빈님이 방금 이 값을 바꿨어요');
  await expect(choice.getByRole('button', { name: /예빈님 값/ })).toContainText('350만 원');
  await axe(page);
  await choice.getByRole('button', { name: /예빈님 값/ }).click();
  await expect(choice).toHaveCount(0);
  expect(a1.amount).toBe(3_500_000);
  await expect(page.getByRole('region', { name: '금액' })).toContainText('350만 원');
});

test('자산 순위(F-01 0번, F-08, H-01 1a): 안 봄 → 확인하기 → 순위 저장 → 이번 달 봄, 홈에도 같은 줄', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  // 연령대 비교: 찬우 1993년생 + 예빈 1995년생 → 평균 32세(2026년) → 30대
  db.me.birth_year = 1993;
  if (db.partner) Object.assign(db.partner, { birth_year: 1995 });
  await page.goto('/assets');
  const row = page.getByRole('button', { name: /우리 자산은 상위 몇 %일까요\?/ });
  await expect(row).toBeVisible();
  await expect(row).toContainText('광고'); // 누르기 전 광고 알림(AdMob 정책)
  await axe(page);
  // 브라우저는 광고 브리지가 없어 바로 순위
  await row.click();
  await expect(page).toHaveURL(/\/assets\/rank$/);
  await expect(page.getByText(/상위 \d+%예요/).first()).toBeVisible();
  await expect(page.getByText('우리 자산은 전체 가구 중')).toBeVisible();
  await expect(page.getByText('전체 가구 중앙값')).toBeVisible();
  await expect(page.getByRole('heading', { name: '30대 가구와 비교' })).toBeVisible();
  await expect(page.getByText('30대 가구 중앙값')).toBeVisible();
  await expect(
    page.getByText(/30대 가구 (중간보다 .+ 많아요|가운데 중간보다 아래예요)/),
  ).toBeVisible();
  await expect(page.getByText(/^상위 \d+%까지$/)).toBeVisible();
  await expect(page.getByText(/남았어요$/)).toBeVisible();
  await expect(page.getByText(/\d+월(보다 .+(올랐어요|내려갔어요)|과 같아요)/)).toBeVisible(); // 지난달 기록이 있음
  await expect(page.getByText('부채 비율')).toBeVisible();
  await expect(page.getByText('30대 가구 평균 30%')).toBeVisible();
  await expect(page.getByText('자산 중 금융자산')).toBeVisible();
  await expect(page.getByText('가구주 나이별 공공 통계 기준')).toBeVisible();
  await axe(page);
  await expect.poll(() => db.me.rank_month).toBe('2026-10-01');
  const pct = Number(db.me.rank_pct);
  expect(pct).toBeGreaterThanOrEqual(1);
  expect(pct).toBeLessThanOrEqual(99);

  await page.goto('/assets');
  const seen = page.getByRole('button', { name: new RegExp(`우리 자산 상위 ${pct}%예요`) });
  await expect(seen).toBeVisible();
  await expect(seen).not.toContainText('광고');
  await expect(seen).toContainText('10월 기준, 자세히 보기');

  await page.goto('/');
  await expect(
    page.getByRole('button', { name: new RegExp(`우리 자산 상위 ${pct}%예요`) }),
  ).toBeVisible();

  // 순자산이 바뀌면 지난번 값 + 새로 확인하기(광고)
  db.me.rank_net = 1;
  await page.goto('/assets');
  const stale = page.getByRole('button', { name: new RegExp(`지난번엔 상위 ${pct}%였어요`) });
  await expect(stale).toContainText('새로 확인하기');
  await expect(stale).toContainText('광고');
});

test('자산 관리 빈 상태(F-01): 순위 줄 + 묶음 타일로 항목별 등록, 누르면 그 묶음을 고른 F-03a', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db, false);
  db.assets.length = 0;
  db.partnerSums.length = 0;
  await page.goto('/assets');
  await expect(page.getByText('자산을 적으면 상위 몇 %인지 알려 드려요')).toBeVisible();
  await expect(page.getByRole('heading', { name: '무엇부터 적어 볼까요?' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '갚을 돈도 있나요?' })).toBeVisible();
  await axe(page);
  await page
    .getByRole('group', { name: '무엇부터 적어 볼까요?' })
    .getByRole('button', { name: '예금·적금' })
    .click();
  await heading(page, '무엇을 추가할까요?');
  await expect(page.getByRole('button', { name: '예금·적금', pressed: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '적금', exact: true })).toBeVisible();
});

test('자산 순위(F-08): 출생연도가 없으면 ‘출생연도 알려 주기’ → S-11i(휠을 움직여야 저장) → F-08 연령대 비교(2026-11-10 온보딩 O-13 뺌)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  db.me.birth_year = null;
  if (db.partner) Object.assign(db.partner, { birth_year: null });
  await page.goto('/assets/rank');
  await expect(page.getByText(/상위 \d+%예요/).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /가구와 비교/ })).toHaveCount(0);
  const ask = page.getByRole('button', { name: /출생연도 알려 주기/ });
  await expect(ask).toContainText('또래와 비교해 드려요');
  await axe(page);
  await ask.click();
  await expect(page).toHaveURL(/\/settings\/me\/birth-year\?from=rank$/);
  await expect(page.getByRole('heading', { name: '찬우님은 몇 년생이에요?' })).toBeVisible();
  // 처음 위치(올해 − 30)가 그대로 답이 되지 않게: 움직이기 전에는 저장 못 함
  await expect(page.getByRole('button', { name: '저장' })).toBeDisabled();
  await setWheel(page, '찬우님은 몇 년생이에요?', 1993);
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page).toHaveURL(/\/assets\/rank$/);
  expect(db.me.birth_year).toBe(1993);
  await expect(page.getByRole('heading', { name: '30대 가구와 비교' })).toBeVisible();
  await expect(page.getByRole('button', { name: /출생연도 알려 주기/ })).toHaveCount(0);
});
