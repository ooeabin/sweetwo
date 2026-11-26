import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { type MemDb, mockOnboarding, mockRealtime } from './mocks';
import { pickYear } from './wheel';
import { fillAmount, fillAssetName, foldAmount, foldText, openFold, pickAssetKind } from './form';

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
    asset_share_default: 'sum', // 자산 공개를 이미 고른 사람(F-03e 처음 선택은 assets-v22.spec.ts)
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

test('요약: 순자산(평가금액 기준, 원금으로 보기), 지난달 대비, 합계(재기획: 이번 달 카드·계획·정산 요약 없음)', async ({
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
  // 2026-11-13 평가금액 기준: 3 + 10 + 2 + 파트너 총액만 440 = 1,940만, 부채 100만 → 1,840만(지난달 평가 1,600만)
  const nw = page.getByRole('region', { name: '순자산', exact: true });
  await expect(nw).toContainText('18,400,000원');
  await expect(nw).toContainText('지난달보다 2,400,000원 늘었어요');
  // 예전 ‘예상 순자산’ 줄은 한 숫자 + 전환으로
  await expect(page.locator('.hg-listrow', { hasText: '예상 순자산' })).toHaveCount(0);
  // 원금으로 보기: 3 + 8 + 2 + 400 − 100 = 1,600만(지난달 원금 1,420만)
  await page.getByRole('switch', { name: /원금으로 보기/ }).click();
  await expect(nw).toContainText('16,000,000원');
  await expect(nw).toContainText('지난달보다 1,800,000원 늘었어요');
  await expect(page.getByRole('button', { name: /^자산\s*19,400,000원/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^부채\s*1,000,000원/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /이번 달 계획/ })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: '재정 진단' })).toHaveCount(0);
  await axe(page);

  await page.getByRole('button', { name: /^부채\s*1,000,000원/ }).click();
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
  const bars = page.getByRole('img', { name: '달마다 순자산, 2026년 10월 18,400,000원' });
  await expect(bars).toBeVisible();
  await expect(bars.locator('.hg-mbars__col small')).toHaveText([
    '5월',
    '6월',
    '7월',
    '8월',
    '9월',
    '10월',
  ]);
  await expect(bars.locator('.hg-mbars__col.is-now')).toContainText('1,840만');
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
  await expect(invest).toContainText('+2,000,000원(+25%)');

  const names = () => cash.getByRole('button').allTextContents();
  // 기본 = 금액 큰 순
  expect((await names())[0]).toContain('생활비 통장');
  // 2026-11-24 정렬 칩 넷 대신 글자 버튼 “금액순” 하나 + 시트(고른 것을 다시 고르면 반대로)
  await expect(page.getByRole('group', { name: '정렬' })).toHaveCount(0);
  const sortBtn = (name: string) => page.getByRole('button', { name, exact: true });
  await expect(sortBtn('금액순, 내림차순')).toBeVisible();
  await sortBtn('금액순, 내림차순').click();
  const sheet = page.getByRole('dialog', { name: '정렬' });
  await expect(sheet.getByRole('radio')).toHaveText([/이름순/, /명의순/, /금액순/, /수정일순/]);
  await expect(sheet).toContainText('큰 금액부터');
  await sheet.getByRole('radio', { name: /이름순/ }).click();
  await expect(sortBtn('이름순, 오름차순')).toBeVisible();
  expect((await names())[0]).toContain('가족 비상금');
  await sortBtn('이름순, 오름차순').click();
  await page
    .getByRole('dialog', { name: '정렬' })
    .getByRole('radio', { name: /이름순/ })
    .click();
  await expect(sortBtn('이름순, 내림차순')).toBeVisible();
  expect((await names())[0]).toContain('생활비 통장');
  await axe(page);
  await page.reload();
  await expect(sortBtn('이름순, 내림차순')).toBeVisible();
});

test('자산·부채 목록 → 상세: 묶음, 파트너 합계만, 공개 범위, 금액 수정, 삭제 되돌리기', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);

  await page.goto('/assets/items');
  // 2026-11-23: 하위 탭 한 줄 세 탭(요약 / 자산 / 부채)
  await expect(page.getByRole('tablist')).toHaveCount(1);
  await expect(page.getByRole('tab')).toHaveText(['요약', '자산', '부채']);
  await expect(page.getByRole('tab', { name: '자산', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  const invest = page.getByRole('region', { name: '투자' });
  await expect(invest.getByRole('button', { name: /내 주식/ })).toContainText('총액만');
  await expect(invest).toContainText('예빈님 자산 2개');
  await expect(invest).toContainText('4,400,000원');
  await expect(page.getByRole('button', { name: /생활비 통장/ })).toContainText('공동');
  await axe(page);

  // 파트너 명의는 볼 수만
  await page.getByRole('button', { name: /예빈 적금/ }).click();
  await expect(page.getByText('예빈님 항목이라 볼 수만 있어요')).toBeVisible();
  await expect(page.getByRole('button', { name: '시세 바꾸기' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '항목 메뉴' })).toHaveCount(0);

  await page.goto('/assets/a2');
  await heading(page, '내 주식');
  // 7번 안 판 수익 “+200만 원(+25%)” / “원금 800만 원”(2026-11-12 S8-13)
  await expect(page.getByRole('region', { name: '금액' })).toContainText('+2,000,000원(+25%)');
  await expect(page.getByRole('region', { name: '금액' })).toContainText('원금 8,000,000원');
  // 수정 내역은 직접 고친 것만(23 F-04 5번)
  await expect(page.getByRole('region', { name: '수정 내역' })).not.toContainText('월말 정리');
  await axe(page);
  await page.getByRole('button', { name: '시세 바꾸기' }).click();
  await page.getByRole('textbox', { name: '금액' }).fill('12000000');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('저장했어요')).toBeVisible();
  expect(db.assets.find((a) => a.id === 'a2')?.amount).toBe(12_000_000);
  await expect(page.getByRole('region', { name: '수정 내역' })).toContainText('12,000,000원');

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
  await heading(page, '자산 추가');
  await pickAssetKind(page, '예금·적금', '적금');
  await expect(page.getByLabel('이름', { exact: true })).toHaveValue('적금');
  await fillAssetName(page, '여행 적금');
  await fillAmount(page, '지금 금액', 1_200_000);
  // 합류 뒤에는 파트너 명의 새로 만들기 없음
  await expect(page.getByRole('radio', { name: /예빈/ })).toHaveCount(0);
  await page.getByRole('radio', { name: /^나/ }).click();
  // 이미 고른 내 기본값(asset_share_default)은 접힌 줄에 ‘총액만 보여 주기’
  await expect(page.getByRole('button', { name: /파트너에게 보이기.*총액만/ })).toBeVisible();
  await axe(page);
  // 적금 접힌 줄(F-03f): 만기일, 월 납입액
  const m = await openFold(page, '만기일');
  // 달력 시트(처음 보이는 달 1년 뒤 오늘 2027-10): 이전 달(9월)의 30일
  await m.getByRole('button', { name: '이전 달' }).click();
  await m.getByRole('gridcell', { name: /^2027년 9월 30일/ }).click();
  await m.getByRole('button', { name: /선택$/ }).click();
  await foldAmount(page, '월 납입액', 300_000);
  await page.getByRole('button', { name: '추가하기' }).click();

  await expect(page).toHaveURL(/\/assets\/items\?side=asset/);
  await expect(page.getByText('추가했어요. 순자산이 1,200,000원 늘었어요')).toBeVisible();
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
  await page
    .getByRole('group', { name: '묶음', exact: true })
    .getByRole('button', { name: '예금·적금' })
    .click();
  const chips = page.getByRole('group', { name: '예금·적금', exact: true });
  await expect(chips.getByRole('button')).toHaveText([
    '적금',
    '정책형 적금',
    '청년도약계좌',
    '기타(직접 입력)',
  ]);
  await chips.getByRole('button', { name: '청년도약계좌' }).click();
  await expect(page.getByLabel('이름', { exact: true })).toHaveValue('청년도약계좌');
});

test('추가(합류 전): 파트너 명의는 대신 입력(모두 보여 주기), 부채는 남은 대출금', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db, false);

  await page.goto('/assets/new?side=debt');
  await pickAssetKind(page, '할부', '자동차 할부');
  await fillAmount(page, '남은 금액', 8_000_000);
  await page.getByRole('radio', { name: /예빈/ }).click();
  // 부채 접힌 줄(F-03g): 금리, 월 상환액은 나중에 해도 됨
  await foldText(page, '금리', '4.5');
  await page.getByRole('button', { name: '추가하기' }).click();

  await expect(page.getByText('추가했어요. 순자산이 8,000,000원 줄었어요')).toBeVisible();
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
  await expect(page.getByText('0~30% 사이로 입력해 주세요')).toBeVisible();
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
  await pickAssetKind(page, '예금·적금', '적금');
  await page.getByRole('button', { name: '잘 모르겠어요' }).click();
  await page.getByRole('button', { name: '1~3천' }).click();
  await page.getByRole('radio', { name: /^나/ }).click();
  await page.getByRole('button', { name: '추가하기' }).click();
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
  await pickAssetKind(page, '주택', '주택담보대출');
  await fillAmount(page, '남은 금액', 200_000_000);
  await page.getByRole('radio', { name: /예빈/ }).click();
  await foldAmount(page, '매달 갚는 금액', 1_200_000);
  await page.getByRole('button', { name: '추가하기' }).click();

  await expect(page.getByRole('button', { name: /주택담보대출/ })).toContainText(
    '매달 1,200,000원',
  );
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
  await expect(choice.getByRole('button', { name: /예빈님 값/ })).toContainText('3,500,000원');
  await axe(page);
  await choice.getByRole('button', { name: /예빈님 값/ }).click();
  await expect(choice).toHaveCount(0);
  expect(a1.amount).toBe(3_500_000);
  await expect(page.getByRole('region', { name: '금액' })).toContainText('3,500,000원');
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
  await expect(page.getByRole('button', { name: '자산 입력하고 순위 보기' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '무엇부터 입력해 볼까요?' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '부채도 있나요?' })).toBeVisible();
  await axe(page);
  await page
    .getByRole('group', { name: '무엇부터 입력해 볼까요?' })
    .getByRole('button', { name: '예금·적금' })
    .click();
  await heading(page, '자산 추가');
  await expect(page.getByRole('button', { name: '예금·적금', pressed: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '적금', exact: true })).toBeVisible();
});

test('자산 순위(F-08 (나)): 출생연도가 없으면 ‘출생연도 알려 주기’ → S-11i(휠을 움직여야 저장) → 또래 가구 중간값(2026-11-13 v2.2)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  db.me.birth_year = null;
  await page.goto('/assets/rank');
  await expect(page.getByText(/상위 \d+%/)).toHaveCount(0);
  const ask = page.getByRole('button', { name: /출생연도 알려 주기/ });
  await expect(ask).toContainText('또래와 비교해 드려요');
  await axe(page);
  await ask.click();
  await expect(page).toHaveURL(/\/settings\/me\/birth-year\?from=rank$/);
  await expect(page.getByRole('heading', { name: '찬우님은 몇 년생이에요?' })).toBeVisible();
  // 처음 보이는 값(올해 − 30)으로 바로 저장할 수 있음(2026-11-13 실구동)
  await expect(page.getByRole('button', { name: '저장' })).toBeEnabled();
  await pickYear(page, '출생연도', 1993);
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page).toHaveURL(/\/assets\/rank$/);
  expect(db.me.birth_year).toBe(1993);
  await expect(page.getByText('또래 가구 중간값은 155,850,000원이에요')).toBeVisible();
  await expect(page.getByRole('button', { name: /출생연도 알려 주기/ })).toHaveCount(0);
});

// ── QA 8구간(2026-11-12) ────────────────────────────────────────────────

test('F-04 저장 Toast ‘되돌리기’: 고치기 전 금액으로(S8-05), 처음 값은 수정 내역에 없음(D3)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  db.assetHistory.push({
    id: 9,
    asset_id: 'a1',
    amount: 3_000_000,
    source: 'created',
    recorded_at: '2026-09-01T00:00:00Z',
  });
  await page.goto('/assets/a1');
  await heading(page, '생활비 통장');
  await expect(page.getByRole('region', { name: '수정 내역' })).toContainText(
    '아직 수정 내역이 없어요',
  );
  await page.getByRole('button', { name: '금액 고치기' }).click();
  await page.getByRole('textbox', { name: '금액' }).fill('3500000');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('저장했어요')).toBeVisible();
  expect(db.assets.find((a) => a.id === 'a1')?.amount).toBe(3_500_000);
  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect.poll(() => db.assets.find((a) => a.id === 'a1')?.amount).toBe(3_000_000);
  await expect(page.getByRole('region', { name: '금액', exact: true })).toContainText(
    '3,000,000원',
  );
});

test('F-04 저장 실패: “저장하지 못했어요” + 원래 값, 권한 밖(0행)은 “볼 수만 있어요”(S8-16)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  let mode: 'fail' | 'none' = 'fail';
  await page.route('**/rest/v1/asset?*', async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    if (mode === 'fail') return route.fulfill({ status: 500, body: '{}' });
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '[]',
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  });
  await page.goto('/assets/a1');
  await heading(page, '생활비 통장');
  await page.getByRole('button', { name: '금액 고치기' }).click();
  await page.getByRole('textbox', { name: '금액' }).fill('3500000');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('저장하지 못했어요')).toBeVisible();
  await expect(page.getByRole('textbox', { name: '금액' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: '금액', exact: true })).toContainText(
    '3,000,000원',
  );
  mode = 'none';
  await page.getByRole('button', { name: '금액 고치기' }).click();
  await page.getByRole('textbox', { name: '금액' }).fill('3500000');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('예빈님 항목이라 볼 수만 있어요')).toBeVisible();
  expect(db.assets.find((a) => a.id === 'a1')?.amount).toBe(3_000_000);
});

test('합계가 999억을 넘으면 “999억+”(S8-02): 요약, 목록, 홈 타일이 멈추지 않음', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  const me = String(db.me.id);
  for (const id of ['big1', 'big2'])
    db.assets.push(
      asset({
        id,
        side: 'asset',
        grp: 'real_estate',
        kind: 'house',
        name: id === 'big1' ? '빌딩' : '땅',
        amount: 90_000_000_000,
        owner_user_id: me,
        created_by: me,
      }),
    );
  await page.goto('/assets');
  await expect(page.getByRole('region', { name: '순자산', exact: true })).toContainText('999억+');
  await page.goto('/assets/items');
  await expect(page.getByRole('tab', { name: '자산', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: '부동산' })).toContainText('999억+');
  await page.goto('/');
  await expect(page.getByRole('button', { name: /^자산 관리/ })).toContainText('999억+');
});

test('F-02 못 불러옴: 오류 카드 + 다시 시도(S8-04), 내 숨김 항목도 묶음 합계에 더함(H3)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  const me = String(db.me.id);
  db.assets.push(
    asset({
      id: 'p1',
      side: 'asset',
      grp: 'cash',
      kind: 'cash',
      name: '비상금',
      amount: 700_000,
      owner_user_id: me,
      visibility: 'private',
      created_by: me,
    }),
  );
  let fail = true;
  await page.route('**/rest/v1/asset?*', (route) =>
    fail && route.request().method() === 'GET'
      ? route.fulfill({ status: 500, body: '{}' })
      : route.fallback(),
  );
  await page.goto('/assets/items');
  await expect(page.getByText('잠시 문제가 생겼어요. 다시 시도해 주세요')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole('tab', { name: '자산', exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: '정렬' })).toHaveCount(0);
  fail = false;
  await page.getByRole('button', { name: '다시 시도' }).click();
  const cash = page.getByRole('region', { name: '현금성' });
  await expect(cash.getByRole('button', { name: /비상금/ })).toContainText('숨김');
  // 묶음 머리 합계 = 생활비 통장 300만 + 내 숨김 70만(숨기기는 파트너에게만 안 보임, 2026-11-13 H3)
  await expect(cash.locator('.hg-sechead')).toContainText('3,700,000원');
  await axe(page);
});

test('Realtime: 상대가 공동 자산을 고치면 목록이 바로 바뀜(S8-06)', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const rt = await mockRealtime(page);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/assets/items');
  await expect(page.getByRole('button', { name: /생활비 통장/ })).toContainText('3,000,000원');
  await expect.poll(() => rt.subscribed('asset')).toBeGreaterThan(0);
  const a1 = db.assets.find((a) => a.id === 'a1');
  if (a1) a1.amount = 4_200_000;
  rt.emit('asset', 'UPDATE', { id: 'a1', space_id: 'space-1' });
  await expect(page.getByRole('button', { name: /생활비 통장/ })).toContainText('4,200,000원');
});

test('마지막 본 하위 탭으로 들어감(S8-10), 넓은 창 ‘+ 추가’는 보조 버튼(S8-11)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/assets/items');
  await expect(page.getByRole('tab', { name: '자산', exact: true })).toBeVisible();
  const add = page.locator('.hg-wide-only.hg-btn');
  if (await add.isVisible()) await expect(add).toHaveClass(/hg-btn--secondary/);
  await page.goto('/');
  await page
    .getByRole('link', { name: '자산 관리' })
    .or(page.getByRole('button', { name: /^자산 관리/ }))
    .locator('visible=true')
    .first()
    .click();
  await expect(page).toHaveURL(/\/assets\/items/);
});

test('금리는 0~30% 소수 1자리(D5, F-03g와 F-04 같음), 보증금은 팔기 없음(S8-15)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db, false);
  const me = String(db.me.id);
  db.assets.push(
    asset({
      id: 'dep',
      side: 'asset',
      grp: 'real_estate',
      kind: 'deposit_money',
      name: '전세 보증금',
      amount: 200_000_000,
      principal: 200_000_000,
      owner_user_id: me,
      created_by: me,
    }),
  );
  await page.goto('/assets/dep/sold');
  await expect(page).toHaveURL(/\/assets$/);

  await page.goto('/assets/new?side=debt');
  await pickAssetKind(page, '신용', '신용대출');
  await fillAssetName(page, '카드 대출');
  await fillAmount(page, '남은 금액', 5_000_000);
  await page.getByRole('radio', { name: '나' }).click();
  const dlg = await openFold(page, '금리');
  const rate = dlg.getByLabel('금리', { exact: true });
  await rate.fill('30.5');
  await expect(dlg.getByText('0~30% 사이로 입력해 주세요')).toBeVisible();
  await expect(dlg.getByRole('button', { name: '확인' })).toBeDisabled();
  await rate.fill('4.25');
  await expect(dlg.getByText('0~30% 사이로 입력해 주세요')).toBeVisible();
  await rate.fill('4.5');
  await expect(dlg.getByText('0~30% 사이로 입력해 주세요')).toHaveCount(0);
});

test('F-04 맨 위는 W-10 모양(오렌지 채움 버튼 없음), 값 고치기는 시트, 만기일은 달력 시트(type=date 없음)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  const me = String(db.me.id);
  db.assets.push(
    asset({
      id: 'sv1',
      side: 'asset',
      grp: 'deposit',
      kind: 'saving',
      name: '여행 적금',
      amount: 12_000_000,
      maturity_date: '2027-05-20',
      owner_user_id: me,
      created_by: me,
    }),
  );
  await page.goto('/assets/sv1');
  await heading(page, '여행 적금');
  const hero = page.locator('.hg-fdhero');
  await expect(hero.locator('.hg-fdhero__label')).toHaveText('금액');
  await expect(hero.locator('.hg-fdhero__amt')).toHaveText('12,000,000원');
  // 같은 동작은 항목 줄(›), 오렌지 채움 작은 버튼이나 옅은 오렌지 판 없음
  await expect(page.getByRole('button', { name: '금액 고치기' })).toHaveClass(/hg-listrow/);
  await expect(page.locator('.hg-btn--primary, .hg-btn--secondary')).toHaveCount(0);
  await axe(page);
  await page.getByRole('button', { name: /만기일/ }).click();
  const sheet = page.getByRole('dialog', { name: '만기일' });
  await expect(sheet.getByRole('grid')).toBeVisible();
  await expect(sheet.getByRole('spinbutton')).toHaveCount(0);
  await expect(page.locator('input[type="date"]')).toHaveCount(0);
  await sheet.getByRole('gridcell', { name: /^2027년 5월 21일/ }).click();
  await sheet.getByRole('button', { name: /선택$/ }).click();
  await expect(page.getByText('저장했어요')).toBeVisible();
  // 금액 고치기: 금액 칸 + 아래 고정 주 버튼 ‘저장’
  await page.getByRole('button', { name: '금액 고치기' }).click();
  await expect(page.locator('.hg-stickybar').getByRole('button', { name: '저장' })).toBeVisible();
  await page.getByRole('textbox', { name: '금액' }).fill('13000000');
  await page.locator('.hg-stickybar').getByRole('button', { name: '저장' }).click();
  expect(db.assets.find((a) => a.id === 'sv1')?.amount).toBe(13_000_000);
});

test('추가(합류 전, 애칭 없음): 명의 선택지와 목록 보조는 “파트너”로(2026-11-24)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db, false);
  Object.assign(db.space ?? {}, { partner_nickname: null });
  await page.goto('/assets/new?side=debt');
  await pickAssetKind(page, '할부', '자동차 할부');
  await fillAmount(page, '남은 금액', 8_000_000);
  await expect(page.getByRole('radio', { name: '파트너', exact: true })).toBeVisible();
  await page.getByRole('radio', { name: '파트너', exact: true }).click();
  await foldText(page, '금리', '4.5');
  await page.getByRole('button', { name: '추가하기' }).click();
  const row = page.getByRole('button', { name: /자동차 할부/ });
  await expect(row).toContainText('파트너');
  await expect(row).toContainText('대신 입력');
});
