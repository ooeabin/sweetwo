import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockOnboarding, type MemDb } from './onboarding-mock';

// 목표 메뉴 G-01 목록, G-02 상세(docs/spec/22-goals.md). 찬우, 예빈 합류.

const axe = async (page: Page) => {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const heading = (page: Page, name: string | RegExp) =>
  expect(page.getByRole('heading', { name }).first()).toBeVisible();
const NOW = new Date('2026-10-07T10:00:00+09:00');

const goal = (
  id: string,
  template: string,
  name: string,
  priority: number,
  target: number,
  deadline: string,
  extra: Record<string, unknown> = {},
) => ({
  id,
  template,
  name,
  kind: 'once',
  owner: 'together',
  priority,
  target_amount: target,
  other_held: 0,
  deadline,
  amount_estimated: false,
  deadline_estimated: false,
  after_marriage: false,
  status: 'active',
  details: {},
  created_by: 'chanwoo',
  created_at: '2026-08-20T00:00:00Z',
  deleted_at: null,
  ...extra,
});

/** 합류한 신혼부부. 저축 가능 = 620 − 100 − 185 = 335만 */
function seed(db: MemDb) {
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
    couple_state: 'connected',
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
  db.partner = {
    id: 'yebin',
    nickname: '예빈',
    side: 'bride',
    employment: 'regular',
    monthly_income: 2_700_000,
    payday: 10,
    payday_last: false,
    allowance: 500_000,
  };
  db.goals.push(
    goal('g1', 'emergency', '비상금', 0, 5_550_000, '2027-10-01', { other_held: 1_000_000 }),
    goal('g2', 'home', '내 집 마련', 1, 150_000_000, '2031-10-01', { owner: 'me' }),
    goal('g3', 'travel', '여행', 2, 3_000_000, '2027-06-01', { status: 'paused' }),
  );
  for (const g of db.goals) g.created_by = db.me.id;
  db.plans.push({
    args: {
      p_label_month: '2026-09-01',
      p_cycle_start: '2026-09-25',
      p_cycle_end: '2026-10-24',
      p_first_adjust: 3_000_000,
      p_merged_close: false,
      p_is_temp: false,
      p_snapshot: { parts: { living: 1_850_000, goalFund: 3_000_000, emergency: 350_000 } },
      p_lines: [
        { target: 'goal', goal_id: 'g1', amount: 350_000 },
        { target: 'goal', goal_id: 'g2', amount: 3_000_000 },
      ],
    },
  });
  db.closes.push({ id: 'close-1', status: 'done', deleted_at: null });
  db.deposits.push(
    { id: 'dep-1', month_close_id: 'close-1', goal_id: 'g1', name: '비상금', amount: 350_000 },
    {
      id: 'dep-2',
      month_close_id: 'close-1',
      goal_id: 'g2',
      name: '내 집 마련',
      amount: 2_500_000,
    },
  );
}

test('목표 목록 → 상세: 진행, 월 배분, 접힌 목록, 월별 기록', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);

  // 이번 달에서 목표 탭으로
  await page.goto('/');
  await page.getByRole('link', { name: '목표' }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/goals$/);

  // 요약: 보류 목표 빼고 월 배분 합 = 저축 가능 전부(남는 돈은 주거 목표에)
  await expect(page.getByText('매달 목표에 335만 원씩 모으고 있어요')).toBeVisible();
  await expect(page.getByText('저축 가능 335만 원')).toBeVisible();

  // 비상금은 목표 목록에 없음(우리 자산, 이번 달 비상금 카드)
  await expect(page.getByRole('button', { name: /비상금/ })).toHaveCount(0);
  const home = page.getByRole('button', { name: /내 집 마련/ });
  await expect(home).toContainText('250만 / 15,000만 원');
  await expect(home.getByRole('img', { name: '담당 찬우' })).toBeVisible();
  await expect(home).toContainText(/월 \d+만 원씩, \d{4}년 \d+월 달성 예정/);

  // 보류 목표는 접힌 목록
  await expect(page.getByRole('button', { name: /여행/ })).toHaveCount(0);
  await page.getByRole('button', { name: '보류·달성·사용 완료 1개' }).click();
  await expect(page.getByRole('button', { name: /여행/ })).toContainText('보류');
  await axe(page);

  // 상세
  await home.click();
  await expect(page).toHaveURL(/\/goals\/g2$/);
  await heading(page, '내 집 마련');
  await expect(page.locator('.hg-card', { hasText: '목표 금액' })).toContainText('1억 5,000만 원');
  await expect(page.locator('.hg-card', { hasText: '보유액' })).toContainText('250만 원');
  await expect(page.locator('.hg-card', { hasText: '남은 금액' })).toContainText('1억 4,750만 원');
  await expect(page.locator('.hg-card', { hasText: '기한' })).toContainText('2031년 10월');
  const sept = page.locator('.hg-listrow', { hasText: '2026년 9월' });
  await expect(sept).toContainText('계획 300만 원');
  await expect(sept).toContainText('실제 250만 원');
  await expect(sept).toContainText('−50만 원');
  await expect(page.locator('.hg-listrow', { hasText: '만든 날' })).toContainText(
    '2026년 8월 20일',
  );
  await axe(page);

  await page.getByRole('button', { name: /^(뒤로|이전)/ }).click();
  await expect(page).toHaveURL(/\/goals$/);
});

test('목표 수정(연결): 금액은 제안, 영향 미리보기, 제안 중 카드와 배지, ⋯ 보류도 제안', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);

  await page.goto('/goals/g2');
  await heading(page, '내 집 마련');
  await page.getByRole('button', { name: /목표 금액/ }).click();
  await heading(page, '얼마가 필요해요?');
  const input = page.getByLabel('얼마가 필요해요?');
  await expect(input).toHaveValue(/150,?000,?000/);
  await input.fill('200000000');
  await expect(page.getByText('좋아요면 바로, 반대 없으면 10월 25일부터 적용돼요')).toBeVisible();
  await expect(page.getByRole('region', { name: '이렇게 바뀌어요' })).toContainText('예상 달성');
  await axe(page);
  await page.getByRole('button', { name: '예빈님께 제안하기' }).click();

  await expect(page.getByText('예빈님에게 제안했어요')).toBeVisible();
  await heading(page, '내 집 마련');
  const card = page.getByRole('region', { name: '찬우님 제안' });
  await expect(card).toContainText('내 집 마련 목표 금액 1억 5,000만 원 → 2억 원');
  await expect(card.getByRole('button', { name: '보내기 취소' })).toBeVisible();
  // 바뀌기 전 값 그대로
  await expect(page.getByRole('button', { name: /목표 금액/ })).toContainText('1억 5,000만 원');
  expect(db.proposals[0]).toMatchObject({
    item: 'goal_amount',
    target_id: 'g2',
    before: { target_amount: 150_000_000 },
    after: { target_amount: 200_000_000 },
    apply_on: '2026-10-25',
  });
  await axe(page);

  // ⋯ 보류 → 제안(바로 바뀌지 않음)
  await page.getByRole('button', { name: '목표 메뉴' }).click();
  await expect(page.getByRole('menuitem')).toHaveText(['이름 변경', '보류', '삭제']);
  await page.getByRole('menuitem', { name: '보류' }).click();
  await expect(page.getByRole('region', { name: '찬우님 제안' })).toHaveCount(2);
  expect(db.goals.find((g) => g.id === 'g2')?.status).toBe('active');

  // 목록: 제안 중 배지
  await page.goto('/goals');
  await expect(page.getByRole('button', { name: /내 집 마련/ })).toContainText('제안 중');

  // 비상금은 삭제 없음
  await page.goto('/goals/g1');
  await page.getByRole('button', { name: '목표 메뉴' }).click();
  await expect(page.getByRole('menuitem')).toHaveText(['이름 변경', '보류']);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
});

test('받은 목표 제안: G-02에서 좋아요, 다르게 해볼래요는 목표 수정으로', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  db.proposals.push({
    id: 'prop-y',
    space_id: 'space-1',
    item: 'goal_deadline',
    target_id: 'g2',
    proposer: 'yebin',
    before: { deadline: '2031-10-01' },
    after: { deadline: '2033-12-01' },
    status: 'open',
    apply_on: '2026-10-25',
    seen_at: null,
    oppose_count: 0,
    round_trips: 0,
    together: false,
    created_at: '2026-10-06T01:00:00Z',
  });

  // 이번 달 할 일 맨 위
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: /예빈님이 내 집 마련 목표를 바꾸자고 제안했어요/ }),
  ).toContainText('2031년 10월 → 2033년 12월');

  await page.goto('/goals/g2');
  const card = page.getByRole('region', { name: '예빈님 제안' });
  await expect(card).toContainText('내 집 마련 기한 2031년 10월 → 2033년 12월');
  await expect.poll(() => db.proposals[0]?.seen_at).not.toBeNull();
  await axe(page);

  // 다르게 해볼래요 → 기한 수정 화면
  await card.getByRole('button', { name: '다르게 해볼래요' }).click();
  await heading(page, '언제까지 모을까요?');
  await page.getByRole('button', { name: /^(뒤로|이전)/ }).first().click();

  await page
    .getByRole('region', { name: '예빈님 제안' })
    .getByRole('button', { name: '좋아요' })
    .click();
  await expect(page.getByText('바로 적용했어요')).toBeVisible();
  await expect(page.getByRole('region', { name: '예빈님 제안' })).toHaveCount(0);
  expect(db.goals.find((g) => g.id === 'g2')?.deadline).toBe('2033-12-01');
  await expect(page.getByRole('button', { name: /기한/ })).toContainText('2033년 12월');
});

test('목표 수정(합류 전): 바로 저장, 보류·삭제는 되돌리기', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  Object.assign(db.space ?? {}, { couple_state: 'not_joined' });
  db.partner = null;

  await page.goto('/goals/g2');
  await page.getByRole('button', { name: /기한/ }).click();
  await heading(page, '언제까지 모을까요?');
  await page.getByLabel('년', { exact: true }).fill('2032');
  await page.getByRole('radio', { name: '3월' }).click();
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('저장했어요')).toBeVisible();
  expect(db.goals.find((g) => g.id === 'g2')?.deadline).toBe('2032-03-01');

  // 이름 변경
  await page.getByRole('button', { name: '목표 메뉴' }).click();
  await page.getByRole('menuitem', { name: '이름 변경' }).click();
  await heading(page, '목표 이름을 알려주세요');
  await page.getByLabel('목표 이름을 알려주세요').fill('우리 집');
  await page.getByRole('button', { name: '저장' }).click();
  await heading(page, '우리 집');

  // 보류 → 되돌리기
  await page.getByRole('button', { name: '목표 메뉴' }).click();
  await page.getByRole('menuitem', { name: '보류' }).click();
  await expect(page.getByText('월 0원으로 배분에서 빠져 있어요')).toBeVisible();
  expect(db.goals.find((g) => g.id === 'g2')?.status).toBe('paused');
  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect(page.getByText('월 0원으로 배분에서 빠져 있어요')).toHaveCount(0);
  expect(db.goals.find((g) => g.id === 'g2')?.status).toBe('active');

  // 삭제 → 목록으로, 되돌리기
  await page.getByRole('button', { name: '목표 메뉴' }).click();
  await page.getByRole('menuitem', { name: '삭제' }).click();
  await expect(page).toHaveURL(/\/goals$/);
  await expect(page.getByRole('button', { name: /우리 집/ })).toHaveCount(0);
  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect(page.getByRole('button', { name: /우리 집/ })).toBeVisible();
  expect(db.proposals).toEqual([]);
});

/** 직접 만들기 → 이름, 금액, 한 번, 기한 2027년 12월, 모아둔 돈 50만 */
async function addCustom(page: Page) {
  await page.goto('/goals');
  await page.getByRole('button', { name: '+ 목표 추가' }).click();
  await heading(page, '어떤 목표를 추가할까요?');
  await axe(page);
  await page.getByRole('button', { name: '+ 직접 만들기' }).click();
  await heading(page, '무엇을 위한 돈인가요?');
  await page.getByLabel('무엇을 위한 돈인가요?').fill('캠핑 장비');
  await page.getByRole('button', { name: '다음' }).click();
  await heading(page, '얼마가 필요해요?');
  await page.getByLabel('얼마가 필요해요?').fill('2400000');
  await page.getByRole('button', { name: '다음' }).click();
  await heading(page, '한 번인가요, 매년인가요?');
  await page.getByRole('radio', { name: /한 번이에요/ }).click();
  await heading(page, '언제까지 모을까요?');
  await page.getByLabel('년', { exact: true }).fill('2027');
  await page.getByRole('radio', { name: '12월' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await heading(page, '이미 모아둔 돈이 있나요?');
  await page.getByRole('radio', { name: /새로 입력할게요/ }).click();
  await page.getByLabel('얼마 모아뒀어요?').fill('500000');
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();
}

test('목표 추가(합류 전): 직접 만들기 → 질문 → 기한 → 모아둔 돈 → 확인 → 바로 추가', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  Object.assign(db.space ?? {}, { couple_state: 'not_joined' });
  db.partner = null;

  await addCustom(page);
  // 담당 질문 없음(합류 전) → 바로 확인
  await expect(page.getByRole('heading', { name: /달성해요|추가할까요/ })).toBeVisible();
  await expect(page.getByText('우선순위는 맨 아래예요')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '추가하기' }).click();

  await expect(page).toHaveURL(/\/goals$/);
  await expect(page.getByText('목표를 추가했어요')).toBeVisible();
  await expect(page.getByRole('button', { name: /캠핑 장비/ })).toBeVisible();
  expect(db.goals.find((g) => g.name === '캠핑 장비')).toMatchObject({
    template: 'custom',
    kind: 'once',
    target_amount: 2_400_000,
    deadline: '2027-12-01',
    other_held: 500_000,
    owner: 'me',
    priority: 3,
  });
  expect(db.proposals).toEqual([]);
});

test('목표 추가(연결): 담당 고르고 예빈에게 제안, 예빈이 좋아요하면 생김', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);

  await addCustom(page);
  await heading(page, '누가 모을까요?');
  await page.getByRole('radio', { name: /같이/ }).click();
  await expect(page.getByText('좋아요면 바로, 반대 없으면 10월 25일부터 적용돼요')).toBeVisible();
  await page.getByRole('button', { name: '예빈님께 제안하기' }).click();

  await expect(page.getByText('예빈님에게 제안했어요')).toBeVisible();
  await expect(page.getByRole('button', { name: /캠핑 장비/ })).toHaveCount(0);
  expect(db.proposals[0]).toMatchObject({
    item: 'goal_add',
    target_id: null,
    after: expect.objectContaining({
      name: '캠핑 장비',
      target_amount: 2_400_000,
      deadline: '2027-12-01',
      other_held: 500_000,
      owner: 'together',
    }),
  });

  // 예빈 화면(받은 사람): 할 일 → G-08 좋아요 → 목표가 생김
  db.me.id = 'yebin-me';
  Object.assign(db.proposals[0] ?? {}, { proposer: 'chanwoo-other' });
  await page.goto('/');
  await page.getByRole('button', { name: /캠핑 장비 목표를 추가하자고 제안했어요/ }).click();
  await expect(page.getByText('캠핑 장비 목표 추가')).toBeVisible();
  await page.getByRole('button', { name: '좋아요' }).click();
  await expect(page.getByText('바로 적용했어요')).toBeVisible();
  expect(db.goals.find((g) => g.name === '캠핑 장비')).toMatchObject({ owner: 'together' });
});

test('순서 바꾸기(G-06): 위·아래 버튼, 합류 전은 바로 저장 + 되돌리기, 연결은 제안', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  db.goals.push(goal('g4', 'travel', '여행', 3, 3_000_000, '2027-06-01'));
  for (const g of db.goals) g.created_by = db.me.id;
  Object.assign(db.space ?? {}, { couple_state: 'not_joined' });
  db.partner = null;

  await page.goto('/goals');
  await page.getByRole('button', { name: '순서 바꾸기' }).click();
  await heading(page, '어떤 것부터 모을까요?');
  const list = page.getByRole('list', { name: '어떤 것부터 모을까요?' });
  await expect(list.getByRole('listitem')).toHaveCount(2); // 비상금, 보류 목표 빼고
  await expect(page.getByRole('button', { name: '내 집 마련 위로' })).toBeDisabled();
  await page.getByRole('button', { name: '여행 위로' }).click();
  await expect(list.getByRole('listitem').first()).toContainText('여행');
  await expect(page.getByRole('button', { name: '여행 아래로' })).toBeFocused();
  await expect(page.getByText('여행, 2개 중 1번째로 옮겼어요')).toBeAttached();
  await axe(page);
  await page.getByRole('button', { name: '이 순서로 할게요' }).click();

  await expect(page).toHaveURL(/\/goals$/);
  await expect(page.getByText('순서를 바꿨어요')).toBeVisible();
  expect(db.goals.find((g) => g.id === 'g4')?.priority).toBe(1);
  expect(db.goals.find((g) => g.id === 'g2')?.priority).toBe(2);
  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect.poll(() => db.goals.find((g) => g.id === 'g4')?.priority).toBe(3);

  // 연결된 부부는 제안
  Object.assign(db.space ?? {}, { couple_state: 'connected' });
  db.partner = {
    id: 'yebin',
    nickname: '예빈',
    side: 'bride',
    monthly_income: 2_700_000,
    payday: 10,
    payday_last: false,
    allowance: 500_000,
    employment: 'regular',
  };
  await page.goto('/goals/order');
  await page.getByRole('button', { name: '여행 위로' }).click();
  await page.getByRole('button', { name: '예빈님께 제안하기' }).click();
  await expect(page.getByText('예빈님에게 제안했어요')).toBeVisible();
  expect(db.proposals[0]).toMatchObject({ item: 'goal_order', after: { order: ['g4', 'g2'] } });
});

test('충돌 조정(G-04): 부족 배너 → 조정하기 → 기한 늘리기 바로 적용, 연결이면 지출 줄이기 제안', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  // 내 집 마련 기한을 2028년 10월로 → 월 필요액이 저축 가능 금액보다 큼
  Object.assign(db.goals.find((g) => g.id === 'g2') ?? {}, { deadline: '2028-10-01' });
  Object.assign(db.space ?? {}, { couple_state: 'not_joined' });
  db.partner = null;

  await page.goto('/goals');
  await expect(page.getByText(/저축 가능 금액보다 월 .+ 많아요/)).toBeVisible();
  await page.getByRole('button', { name: '조정하기' }).click();
  await heading(page, /목표가 저축 가능 금액보다 월 .+ 많아요/);
  await expect(page.getByRole('radio', { name: /기한 늘리기/ })).toContainText(
    '내 집 마련 2028년 10월 →',
  );
  await axe(page);
  await page.getByRole('radio', { name: /기한 늘리기/ }).click();
  await page.getByRole('button', { name: '이렇게 바꿀게요' }).click();
  await expect(page.getByText('바꿨어요')).toBeVisible();
  await expect(page).toHaveURL(/\/goals$/);
  expect(String(db.goals.find((g) => g.id === 'g2')?.deadline) > '2028-10-01').toBe(true);
  await expect(page.getByRole('button', { name: '조정하기' })).toHaveCount(0);

  // 연결: 조금 모자라면 지출 줄이기 → 생활비 예산 제안
  Object.assign(db.goals.find((g) => g.id === 'g2') ?? {}, { deadline: '2030-06-01' });
  Object.assign(db.space ?? {}, { couple_state: 'connected' });
  db.partner = {
    id: 'yebin',
    nickname: '예빈',
    side: 'bride',
    monthly_income: 2_700_000,
    payday: 10,
    payday_last: false,
    allowance: 500_000,
    employment: 'regular',
  };
  await page.goto('/goals/adjust');
  await page.getByRole('radio', { name: /지출 줄이기/ }).click();
  await expect(page.getByText('좋아요면 바로, 반대 없으면 10월 25일부터 적용돼요')).toBeVisible();
  await page.getByRole('button', { name: '예빈님께 제안하기' }).click();
  await expect(page.getByText('예빈님에게 제안했어요')).toBeVisible();
  expect(db.proposals.map((p) => p.item)).toContain('living_budget');
  expect(db.space?.living_budget).toBe(550_000);
});

test('목표 추가: 가진 자산에서 고르기 → 만든 목표에 연결, 보유액 = 합계', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  Object.assign(db.space ?? {}, { couple_state: 'not_joined' });
  db.partner = null;
  db.assets.push({
    id: 'as-1',
    side: 'asset',
    grp: 'cash',
    kind: 'bank',
    name: '캠핑 통장',
    amount: 600_000,
    principal: null,
    owner: 'joint',
    owner_user_id: null,
    visibility: 'all',
    status: 'held',
    goal_id: null,
    created_by: db.me.id,
    deleted_at: null,
  });

  await page.goto('/goals/new');
  await page.getByRole('button', { name: '+ 직접 만들기' }).click();
  await page.getByLabel('무엇을 위한 돈인가요?').fill('캠핑 장비');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('얼마가 필요해요?').fill('2400000');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('radio', { name: /한 번이에요/ }).click();
  await page.getByLabel('년', { exact: true }).fill('2027');
  await page.getByRole('radio', { name: '12월' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await heading(page, '이미 모아둔 돈이 있나요?');
  await page.getByRole('radio', { name: /가진 자산에서 고르기/ }).click();
  await page.getByRole('button', { name: /캠핑 통장 60만/ }).click();
  await expect(page.getByText('보유액 60만 원')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '추가하기' }).click();

  await expect(page).toHaveURL(/\/goals$/);
  const g = db.goals.find((x) => x.name === '캠핑 장비');
  expect(g).toMatchObject({ other_held: 0 });
  expect(db.assets.find((a) => a.id === 'as-1')?.goal_id).toBe(g?.id);
  await expect(page.getByRole('button', { name: /캠핑 장비/ })).toContainText('60만 / 240만 원');
});

test('달성(G-05): 축하 한 번 → 보낼 곳 → 썼어요 → 생활비로 냄(나누기 줄) → 남은 돈 비상금 → 고른 곳으로', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  db.goals.push(
    goal('g4', 'big_purchase', '가전 바꾸기', 3, 4_000_000, '2027-03-01', {
      other_held: 4_000_000,
      created_by: db.me.id,
    }),
  );
  const plan = db.plans[0]?.args as { p_lines: Record<string, unknown>[] };
  plan.p_lines.push({ target: 'goal', goal_id: 'g4', amount: 250_000 });
  db.goalStory = { months: 16, together: 14 };

  await page.goto('/');
  await expect(page).toHaveURL(/\/goals\/g4\/achieved$/);
  await expect(page.getByText('목표 달성')).toBeVisible();
  await expect(page.getByRole('heading', { name: '가전 바꾸기' })).toBeVisible();
  await expect(page.getByText('400만 원', { exact: true })).toBeVisible();
  await expect(page.getByText('16개월 중 14번은 둘이 함께 모았어요')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();

  await heading(page, '매달 모으던 25만 원은 어디로 보낼까요?');
  await axe(page);
  await page.getByRole('radio', { name: '다른 목표' }).click();

  await heading(page, '가전 바꾸기에 모은 400만 원, 썼나요?');
  await page.getByRole('radio', { name: '썼어요' }).click();
  await heading(page, '얼마 썼어요?');
  await page.getByLabel('얼마 썼어요?').fill('3800000');
  await page.getByRole('button', { name: '다음' }).click();
  await heading(page, '380만 원, 어디서 냈어요?');
  await axe(page);
  await page.getByRole('radio', { name: '생활비 통장·카드' }).click();
  await expect(
    page.getByText('이번 달 월급 나누기에 ‘목표자금 → 공동 생활비 380만 원’을 넣었어요'),
  ).toBeVisible();
  await heading(page, '남은 20만 원은 비상금으로 옮겨요');
  await page.getByRole('button', { name: '확인' }).click();
  await expect(page).toHaveURL(/\/goals\/order$/);

  expect(db.goals.find((g) => g.id === 'g4')).toMatchObject({ status: 'used' });
  expect(db.goals.find((g) => g.id === 'g1')).toMatchObject({ other_held: 1_200_000 });
  expect(db.goalUses).toContainEqual(
    expect.objectContaining({ goal_id: 'g4', amount: 3_800_000, source: 'achieved' }),
  );

  // 다시 열어도 축하는 없음, 목록에는 ‘사용 완료’와 쓴 돈
  await page.goto('/goals');
  await page.getByRole('button', { name: /보류·달성·사용 완료 2개/ }).click();
  await expect(page.getByRole('button', { name: /가전 바꾸기/ })).toContainText('380만 원 썼어요');
  await expect(page).toHaveURL(/\/goals$/);
});
