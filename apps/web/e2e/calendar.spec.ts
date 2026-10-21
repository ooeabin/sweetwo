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

  await page.getByRole('button', { name: '챙길 날', exact: true }).click();
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
  await page.getByRole('button', { name: '챙길 날', exact: true }).click();
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

function seedFamily(db: MemDb) {
  db.family.push({
    id: 'f-mom',
    side: 'groom',
    relation: 'parent',
    title: '어머니',
    birth_month: 10,
    birth_day: 14,
    birth_lunar: false,
    birth_leap: false,
    birth_year: null,
    korean_age: true,
    memo: null,
    sort: 0,
    deleted_at: null,
  });
  db.cares.push({
    id: 'c-mom',
    category: 'family',
    kind: 'birthday',
    name: '어머니 생신',
    member_id: 'f-mom',
    side: 'groom',
    date_rule: 'solar_yearly',
    month: 10,
    day: 14,
    leap: false,
    once_on: null,
    budget: 300_000,
    carer: 'groom',
    alerts: [30, 7],
    status: 'todo',
    status_on: null,
    memo: null,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    deleted_at: null,
  });
}

test('가족(Y-03): 추가하면 생신·환갑·칠순·팔순·제사, 호칭 눌러 고치기', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  seedFamily(db);

  await page.goto('/calendar/list');
  const fam = page.getByRole('region', { name: '가족' });
  await expect(fam.getByRole('button', { name: '어머니 D-7' })).toBeVisible();
  await fam.getByRole('button', { name: '추가' }).click();

  await page.getByRole('radio', { name: '예빈 쪽' }).click();
  await page.getByRole('radio', { name: '부모님', exact: true }).click();
  await expect(page.getByRole('heading', { name: '뭐라고 부르세요?' })).toBeVisible();
  await page.getByRole('button', { name: '장모님' }).click();
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();

  await expect(page.getByRole('heading', { name: '생일은 언제예요?' })).toBeVisible();
  await page.getByLabel('월', { exact: true }).fill('11');
  await page.getByLabel('일', { exact: true }).fill('2');
  await page.getByLabel('태어난 해(선택)').fill('1966');
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('radio', { name: '세는 나이' }).click();
  await page.getByRole('radio', { name: '제사' }).click();
  await expect(page.getByRole('heading', { name: '장모님 제사는 언제예요?' })).toBeVisible();
  await page.getByRole('tab', { name: '음력' }).click();
  await page.getByLabel('월', { exact: true }).fill('3');
  await page.getByLabel('일', { exact: true }).fill('5');
  await page.getByRole('button', { name: '다음' }).click();
  await expect(
    page.getByRole('heading', { name: '좋아하시는 것, 필요하다고 하신 게 있나요?' }),
  ).toBeVisible();
  await page.getByLabel('메모').fill('무릎이 안 좋으시다고 하셨음');
  await page.getByRole('button', { name: '추가하기' }).click();
  await expect(page).toHaveURL(/\/calendar\/list$/);

  expect(db.family[1]).toMatchObject({
    side: 'bride',
    relation: 'parent',
    title: '장모님',
    birth_year: 1966,
    korean_age: true,
    memo: '무릎이 안 좋으시다고 하셨음',
  });
  expect(
    db.cares
      .slice(1)
      .map((c) => [c.name, c.date_rule, c.once_on ?? `${c.month}/${c.day}`, c.budget]),
  ).toEqual([
    ['장모님 생신', 'solar_yearly', '11/2', 300_000],
    ['장모님 환갑', 'once', '2026-11-02', 0],
    ['장모님 칠순', 'once', '2035-11-02', 0],
    ['장모님 팔순', 'once', '2045-11-02', 0],
    ['장모님 제사', 'lunar_yearly', '3/5', 0],
  ]);
  await expect(fam.getByRole('button', { name: '장모님 D-26' })).toBeVisible();

  // 호칭 → 수정: 호칭 바꾸면 생신 이름도
  await fam.getByRole('button', { name: '어머니 D-7' }).click();
  const title = page.getByLabel('호칭');
  await expect(title).toHaveValue('어머니');
  await title.fill('엄마');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page).toHaveURL(/\/calendar\/list$/);
  expect(db.family[0]).toMatchObject({ title: '엄마' });
  expect(db.cares[0]).toMatchObject({ name: '엄마 생신', month: 10, day: 14 });
  expect(db.cares).toHaveLength(6);
});

test('챙길 날 추가(Y-07): 직접 입력, 지난 날 안내, 달력에서 날짜 채움', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  seedFamily(db);

  await page.goto('/calendar/list');
  await page.getByRole('button', { name: '+ 추가' }).click();
  await expect(page.getByRole('heading', { name: '어떤 날이에요?' })).toBeVisible();
  await axe(page);
  await page.getByRole('radio', { name: '결혼식' }).click();
  await page.getByRole('radio', { name: '직접 입력' }).click();
  await page.getByLabel('직접 입력').fill('민지');
  await page.getByRole('button', { name: '다음' }).click();

  await page.getByLabel('년').fill('2026');
  await page.getByLabel('월').fill('9');
  await page.getByLabel('일').fill('1');
  await expect(page.getByText('이미 지난 날이에요. 기록으로 남길까요?')).toBeVisible();
  await expect(page.getByRole('button', { name: '다음' })).toBeDisabled();
  await page.getByLabel('월').fill('11');
  await page.getByLabel('일').fill('21');
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('얼마쯤 쓸까요?').fill('100000');
  await page.getByRole('button', { name: '추가하기' }).click();
  await expect(page).toHaveURL(/\/calendar\/list$/);
  expect(db.cares.at(-1)).toMatchObject({
    name: '민지 결혼식',
    category: 'couple',
    date_rule: 'once',
    once_on: '2026-11-21',
    budget: 100_000,
  });

  // 달력에서 고른 날 → 날짜 채움, 가족 고르면 그 쪽
  await page.getByRole('tab', { name: '달력' }).click();
  await page.getByRole('button', { name: /^10월 30일/ }).click();
  await page.getByRole('button', { name: '이 날에 챙길 날 추가' }).click();
  await page.getByRole('radio', { name: '집들이' }).click();
  await page.getByRole('radio', { name: /^어머니/ }).click();
  await expect(page.getByLabel('일')).toHaveValue('30');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '추가하기' }).click();
  await expect(page).toHaveURL(/\/calendar\/list$/);
  expect(db.cares.at(-1)).toMatchObject({
    name: '어머니 집들이',
    category: 'family',
    side: 'groom',
    member_id: 'f-mom',
    once_on: '2026-10-30',
    budget: 0,
  });
});

test('다녀온 뒤 기록(Y-08): 생활비로 내면 나누기 줄, 7일 지난 날 기록하기, 작년에는', async ({
  page,
}) => {
  const DAY = new Date('2026-10-14T20:00:00+09:00');
  await page.clock.setFixedTime(DAY);
  const db = await mockOnboarding(page, { now: DAY });
  seed(db);
  seedFamily(db);
  db.goals.push({
    id: 'g-family',
    template: 'family_cost',
    name: '양가 비용',
    kind: 'yearly',
    owner: 'together',
    priority: 1,
    target_amount: 1_900_000,
    other_held: 250_000,
    deadline: '2027-04-18',
    amount_estimated: false,
    deadline_estimated: false,
    after_marriage: false,
    status: 'active',
    details: {},
    created_by: db.me.id,
    created_at: '2026-09-01T00:00:00Z',
    deleted_at: null,
  });
  db.cares.push({
    ...db.cares[0],
    id: 'c-wed',
    category: 'couple',
    kind: 'wedding',
    name: '민지 결혼식',
    member_id: null,
    side: null,
    date_rule: 'once',
    month: null,
    day: null,
    once_on: '2026-10-05',
    budget: 100_000,
    carer: 'together',
  });
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
      ],
    },
  });

  // 작년 기록
  db.careRecords.push({
    id: 'rec-old',
    care_day_id: 'c-mom',
    member_id: 'f-mom',
    occurs_on: '2025-10-14',
    amount: 250_000,
    paid_from: 'goal_fund',
    gifts: ['gift'],
    gift_name: '안마기',
    memo: null,
    deleted_at: null,
  });

  // 7일 지난 결혼식: 목록 맨 위 ‘기록하기’
  await page.goto('/calendar/list');
  const overdue = page.getByRole('region', { name: '기록하기' });
  await expect(overdue).toContainText('민지 결혼식');
  await axe(page);

  // 오늘 어머니 생신: 상세 → 다녀왔어요 → 쓴 돈(쓸 돈 채움) → 생활비 통장·카드 → 선물 → 메모
  await page.goto('/calendar/day/c-mom');
  await expect(page.getByText('작년엔 안마기를 드렸어요 (25만 원)')).toBeVisible();
  await page
    .getByRole('group', { name: '준비 상황' })
    .getByRole('button', { name: '다녀왔어요' })
    .click();
  await expect(page.getByRole('heading', { name: '얼마 썼어요?' })).toBeVisible();
  await expect(page.getByLabel('얼마 썼어요?')).toHaveValue('300,000');
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('radio', { name: /목표자금 통장/ })).toContainText(
    '양가 비용 모은 돈에서 빠져요',
  );
  await axe(page);
  await page.getByRole('radio', { name: /생활비 통장·카드/ }).click();
  await expect(page.getByRole('heading', { name: '무엇을 드렸어요?' })).toBeVisible();
  await page.getByRole('button', { name: '선물' }).click();
  await page.getByLabel('어떤 선물이에요?').fill('안마기');
  await expect(page.getByRole('status').filter({ hasText: '작년에도 드렸어요' })).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('메모').fill('좋아하셨음');
  await page.getByRole('button', { name: '저장' }).click();

  // 보유액 25만 원만큼 줄
  await expect(
    page.getByText('이번 달 월급 나누기에 ‘목표자금 → 공동 생활비 25만 원’을 넣었어요'),
  ).toBeVisible();
  await axe(page);
  expect(db.careRecords[1]).toMatchObject({
    care_day_id: 'c-mom',
    occurs_on: '2026-10-14',
    amount: 300_000,
    paid_from: 'living',
    gifts: ['gift'],
    gift_name: '안마기',
    memo: '좋아하셨음',
  });
  expect(db.goalUses).toEqual([expect.objectContaining({ goal_id: 'g-family', amount: 300_000 })]);
  expect(db.cares[0]).toMatchObject({ status: 'done', status_on: '2026-10-14' });
  await page.getByRole('button', { name: '보기' }).click();
  await expect(page).toHaveURL(/\/plan\/split$/);

  // 7일 지난 결혼식: 우리 둘이라 낸 곳 없이 각자 돈
  await page.goto('/calendar/list');
  await overdue.getByRole('button', { name: /민지 결혼식/ }).click();
  await expect(page.getByLabel('얼마 썼어요?')).toHaveValue('100,000');
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('heading', { name: '무엇을 드렸어요?' })).toBeVisible();
  await page.getByRole('button', { name: '현금' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/\/calendar\/day\/c-wed$/);
  expect(db.careRecords[2]).toMatchObject({
    care_day_id: 'c-wed',
    occurs_on: '2026-10-05',
    paid_from: 'personal',
    gifts: ['cash'],
    memo: null,
  });
  expect(db.goalUses).toHaveLength(1);
});

function seedFamilyCost(db: MemDb) {
  seedFamily(db);
  (db.space as Record<string, unknown>).wedding_date = '2025-04-18';
  const base = db.cares[0] as Record<string, unknown>;
  const day = (p: Record<string, unknown>) =>
    db.cares.push({ ...base, member_id: null, side: null, carer: 'together', ...p });
  day({
    id: 'c-s',
    kind: 'seollal',
    name: '설날',
    date_rule: 'lunar_yearly',
    month: 1,
    day: 1,
    budget: 500_000,
  });
  day({
    id: 'c-c',
    kind: 'chuseok',
    name: '추석',
    date_rule: 'lunar_yearly',
    month: 8,
    day: 15,
    budget: 500_000,
  });
  day({ id: 'c-p', kind: 'parents_day', name: '어버이날', month: 5, day: 8, budget: 200_000 });
  day({
    id: 'c-w',
    kind: 'wedding',
    name: '사촌 결혼식',
    date_rule: 'once',
    month: null,
    day: null,
    once_on: '2026-12-05',
    budget: 180_000,
  });
  db.careRecords.push(
    {
      id: 'r1',
      care_day_id: 'c-c',
      member_id: null,
      occurs_on: '2026-09-25',
      amount: 450_000,
      paid_from: 'goal_fund',
      gifts: ['cash'],
      gift_name: null,
      memo: null,
      deleted_at: null,
    },
    {
      id: 'r2',
      care_day_id: 'c-p',
      member_id: null,
      occurs_on: '2026-05-08',
      amount: 200_000,
      paid_from: 'goal_fund',
      gifts: ['cash'],
      gift_name: null,
      memo: null,
      deleted_at: null,
    },
  );
  db.goals.push({
    id: 'g-family',
    template: 'family_cost',
    name: '양가 비용',
    kind: 'yearly',
    owner: 'together',
    priority: 1,
    target_amount: 1_680_000,
    other_held: 600_000,
    deadline: '2027-04-18',
    amount_estimated: false,
    deadline_estimated: false,
    after_marriage: false,
    status: 'active',
    details: {},
    created_by: db.me.id,
    created_at: '2026-09-01T00:00:00Z',
    deleted_at: null,
  });
}

test('양가 비용(Y-06): 회차 쓴 돈·모아둔 돈·매달 모을 돈·항목, 단가 고치면 예빈님께 제안', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  seedFamilyCost(db);

  await page.goto('/calendar/list');
  const card = page.getByRole('region', { name: '이번 회차 양가 비용' });
  await expect(card).toContainText('168만 원 중 65만 원 썼어요');
  await expect(card).toContainText('모아둔 돈 60만 원');
  await card.getByRole('button', { name: '보기' }).click();

  await expect(page).toHaveURL(/\/calendar\/family-cost$/);
  const top = page.getByRole('region', { name: '이번 회차 양가 비용' });
  await expect(top).toContainText('2026년 4월 18일 ~ 2027년 4월 17일');
  await expect(top).toContainText('모아둔 돈 60만 원으로 다음 챙길 날까지 충분해요');
  // (168만 − 65만 − 60만) ÷ 6개월 = 7만 1,667 → 1천 원 올림
  await expect(page.getByText('매달 7만 2,000원씩 모으면 돼요')).toBeVisible();
  await expect(page.getByText('아직 안 쓴 103만 원을 남은 6개월에 나눠서요')).toBeVisible();
  const months = page.getByRole('region', { name: '달마다 나갈 돈' });
  await expect(months).toContainText('12월');
  const items = page.getByRole('region', { name: '항목' });
  await expect(items).toContainText('설·추석');
  await expect(items).toContainText('50만 원 × 2번');
  await expect(items).toContainText('부모님 생신');
  await axe(page);

  await items.getByRole('button', { name: '수정' }).click();
  await expect(page).toHaveURL(/\/calendar\/family-cost\/edit$/);
  await page.getByLabel('부모님 생신').fill('250000');
  await expect(page.getByText('30만 원 → 25만 원')).toBeVisible();
  await expect(page.getByText('1년 163만 원')).toBeVisible();
  await expect(page.getByText('매달 7만 2,000원 → 6만 4,000원')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '예빈님께 제안하기' }).click();
  await expect(page).toHaveURL(/\/calendar\/family-cost$/);
  expect(db.proposals.at(-1)).toMatchObject({
    item: 'family_budget',
    after: {
      target_amount: 1_630_000,
      holiday: 500_000,
      birthday: 250_000,
      parents_day: 200_000,
      other: 180_000,
    },
  });
  expect(db.cares[0]).toMatchObject({ budget: 300_000 });
  await expect(page.getByText('답을 기다리는 제안이 있어요')).toBeVisible();
  await page.getByRole('button', { name: '제안 보기' }).click();
  await expect(page).toHaveURL(/\/proposals\/prop-/);
  await expect(page.getByText('1년 168만 원 → 1년 163만 원')).toBeVisible();
});

test('양가 비용(Y-06): 배우자 미합류면 바로 저장', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  seedFamilyCost(db);
  (db.space as Record<string, unknown>).couple_state = 'not_joined';
  db.partner = null;

  await page.goto('/calendar/family-cost/edit');
  await page.getByLabel('설·추석').fill('400000');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page).toHaveURL(/\/calendar\/family-cost$/);
  expect(
    db.cares.filter((c) => c.kind === 'seollal' || c.kind === 'chuseok').map((c) => c.budget),
  ).toEqual([400_000, 400_000]);
  expect(db.goals.find((g) => g.id === 'g-family')).toMatchObject({ target_amount: 1_480_000 });
  await expect(page.getByRole('region', { name: '이번 회차 양가 비용' })).toContainText(
    '148만 원 중 65만 원 썼어요',
  );
});

test('드린 기록(Y-09): 가족별·연도별, 작년에도 드렸어요 / 쓸 돈 고치면 양가 비용 목표 금액 맞춤', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  seedFamilyCost(db);
  const gift = (id: string, on: string, amount: number) => ({
    id,
    care_day_id: 'c-mom',
    member_id: 'f-mom',
    occurs_on: on,
    amount,
    paid_from: 'goal_fund',
    gifts: ['gift', 'meal'],
    gift_name: '안마기',
    memo: null,
    deleted_at: null,
  });
  db.careRecords.push(gift('r3', '2025-10-14', 250_000), gift('r4', '2024-10-14', 200_000));

  await page.goto('/calendar/list');
  await page.getByRole('button', { name: '드린 기록' }).click();
  await expect(page).toHaveURL(/\/calendar\/gifts$/);
  const mom = page.getByRole('region', { name: '어머니, 찬우 쪽' });
  await expect(mom).toContainText('모두 45만 원');
  await expect(mom.getByRole('button').first()).toContainText(
    '2025년 10월 14일, 안마기, 식사, 작년에도 드렸어요',
  );
  await expect(mom.getByRole('button').nth(1)).not.toContainText('작년에도');
  await expect(page.getByRole('region', { name: '그 밖의 날' })).toContainText('추석');
  await axe(page);

  await page.getByRole('tab', { name: '연도별' }).click();
  await expect(page.getByRole('region', { name: '2026년' })).toContainText('모두 65만 원');
  await expect(page.getByRole('region', { name: '2024년' })).toContainText('어머니 생신');
  await axe(page);
  await page.getByRole('region', { name: '2025년' }).getByRole('button').first().click();
  await expect(page).toHaveURL(/\/calendar\/day\/c-mom$/);

  // 쓸 돈 30만 → 40만: ‘양가 비용’ 목표 금액 168만 → 178만
  await page.goto('/calendar/day/c-mom/budget');
  await page.getByLabel('얼마쯤 쓸까요?').fill('400000');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page).toHaveURL(/\/calendar\/day\/c-mom$/);
  await expect.poll(() => db.goals.find((g) => g.id === 'g-family')?.target_amount).toBe(1_780_000);
});

test('서프라이즈: 배우자 생일 숨기기, 비밀 표시, 낸 곳 없이 기록, 숨기기 끄기 확인, Y-07 배우자 날', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  seedFamily(db);
  // 예빈이 P-04에서 답한 생일(10월 3일)이 미리 채워짐
  db.partnerBirthday = { month: 10, day: 3 };

  await page.goto('/calendar/list');
  const ask = page.getByRole('region', { name: '예빈님 생일은 언제예요?' });
  await ask.getByRole('button', { name: '생일을 알려주세요' }).click();
  await expect(page.getByRole('heading', { name: '예빈님 생일은 언제예요?' })).toBeVisible();
  await expect(page.getByRole('switch', { name: '예빈님에게 숨기기' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.getByLabel('월', { exact: true })).toHaveValue('10');
  await expect(page.getByLabel('일', { exact: true })).toHaveValue('3');
  await page.getByLabel('일', { exact: true }).fill('9');
  await axe(page);
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page).toHaveURL(/\/calendar\/list$/);
  const bd = db.cares.at(-1);
  expect(bd).toMatchObject({
    category: 'couple',
    kind: 'partner_birthday',
    name: '예빈 생일',
    month: 10,
    day: 9,
    secret: true,
    carer: 'groom',
  });
  await expect(page.getByRole('region', { name: '예빈님 생일은 언제예요?' })).toHaveCount(0);

  // 상세: 우리 둘, 비밀 + 찬우님만
  await page.goto(`/calendar/day/${String(bd?.id)}`);
  await expect(page.getByRole('region', { name: '예빈 생일' })).toContainText('우리 둘, 비밀');
  await expect(page.getByRole('region', { name: '미리 알림' })).toContainText('찬우님만');
  await axe(page);

  // 기록: 낸 곳 없이 각자 돈
  await page
    .getByRole('group', { name: '준비 상황' })
    .getByRole('button', { name: '다녀왔어요' })
    .click();
  await page.getByLabel('얼마 썼어요?').fill('150000');
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('heading', { name: '무엇을 드렸어요?' })).toBeVisible();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  expect(db.careRecords.at(-1)).toMatchObject({ care_day_id: bd?.id, paid_from: 'personal' });

  // 숨기기 끄기: 한 번 확인
  const sw = page.getByRole('switch', { name: '예빈님에게 숨기기' });
  await sw.click();
  await expect(page.getByText('예빈님에게 보여요. 그동안 기록도 함께 보여요')).toBeVisible();
  await page.getByRole('button', { name: '취소' }).click();
  expect(bd).toMatchObject({ secret: true });
  await sw.click();
  await page.getByRole('button', { name: '보여주기' }).click();
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  expect(bd).toMatchObject({ secret: false });

  // Y-07: 배우자의 날이면 숨기기 기본 켜짐
  await page.goto('/calendar/list');
  await page.getByRole('button', { name: '+ 추가' }).click();
  await page.getByRole('radio', { name: '기타' }).click();
  await page.getByRole('radio', { name: '예빈', exact: true }).click();
  await page.getByLabel('년').fill('2026');
  await page.getByLabel('월').fill('12');
  await page.getByLabel('일').fill('24');
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('switch', { name: '예빈님에게 숨기기' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('button', { name: '추가하기' }).click();
  await expect(page).toHaveURL(/\/calendar\/list$/);
  expect(db.cares.at(-1)).toMatchObject({
    name: '예빈',
    category: 'couple',
    secret: true,
    carer: 'groom',
  });
});

test('공휴일: 빨간 숫자와 이름, 설·추석 연휴 띠, 월급날이 쉬는 날이면 직전 영업일(끄면 그대로)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  db.holidays.push(
    { date: '2026-09-24', name: '추석 연휴', kind: 'holiday' },
    { date: '2026-09-25', name: '추석', kind: 'holiday' },
    { date: '2026-09-26', name: '추석 연휴', kind: 'holiday' },
    { date: '2026-10-03', name: '개천절', kind: 'holiday' },
    { date: '2026-10-05', name: '대체공휴일(개천절)', kind: 'substitute' },
    { date: '2026-10-09', name: '한글날', kind: 'holiday' },
  );

  await page.goto('/calendar/month');
  const hangul = page.getByRole('button', { name: '10월 9일, 한글날' });
  await expect(hangul).toHaveClass(/is-holiday/);
  await expect(hangul).toContainText('한글날');
  await expect(page.getByRole('button', { name: '10월 5일, 대체공휴일(개천절)' })).toHaveClass(
    /is-holiday/,
  );
  await expect(page.getByRole('button', { name: /^10월 6일/ })).not.toHaveClass(/is-holiday/);
  // 예빈 월급날 10일(토) → 9일 한글날 → 8일(목)
  await page.getByRole('button', { name: '10월 8일, 일정 1개' }).click();
  await expect(page.getByRole('button', { name: /예빈 월급날/ })).toBeVisible();
  await axe(page);

  // 9월: 추석 연휴 띠, 고른 날 목록 맨 위에 이름
  await page.getByRole('button', { name: '이전 달' }).click();
  const chuseok = page.getByRole('button', { name: /^9월 25일, 추석/ });
  await expect(chuseok).toHaveClass(/is-festive/);
  await expect(page.getByRole('button', { name: /^9월 24일, 추석 연휴/ })).toHaveClass(
    /is-festive/,
  );
  await expect(page.getByRole('button', { name: /^9월 27일/ })).not.toHaveClass(/is-festive/);
  await chuseok.click();
  await expect(page.locator('.hg-cal__event.is-holiday')).toHaveText('추석');
  await axe(page);

  // 앞당기기 끄면 10일 그대로
  (db.space as Record<string, unknown>).holiday_shift = false;
  await page.reload();
  await page.getByRole('tab', { name: '목록' }).click();
  await expect(page.getByRole('region', { name: '돈 날짜' })).toContainText('예빈 월급날10월 10일');
});
