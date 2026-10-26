import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { chanwoo } from './supabase-mock';
import { mockOnboarding } from './onboarding-mock';
import { seed } from './seed-home';

// 재기획 목표(22): G-01 묶음과 매달·예상·이번 달, G-02 넣기·빼기·꺼내 쓰기, G-03 누구 목표 → 분배표 0원 줄.
const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const NOW = new Date('2026-10-07T10:00:00+09:00');

test('G-01 목표 목록: 우리 목표 묶음, 매달·예상, 기한보다 늦어요, 이번 달', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/goals');
  await expect(page.getByText('매달 목표에 139만 원씩 모으고 있어요')).toBeVisible();
  const ours = page.getByRole('region', { name: '우리 목표' });
  const home = ours.getByRole('button', { name: /내 집 마련/ });
  await expect(home).toContainText('매달 95만 원씩, 2039년 12월 달성 예정');
  await expect(home).toContainText('기한보다 8년 2개월 늦어요');
  await expect(home).toContainText('이번 달 95만 원 넣을 차례예요');
  await expect(ours.getByRole('button', { name: /비상금/ })).toBeVisible();
  await expect(page.getByRole('region', { name: '내 목표' })).toHaveCount(0);
  await axe(page);
});

test('G-02 넣기·빼기, 꺼내 쓰기(모은 돈보다 많으면 저장 꺼짐), 모은 돈 기록', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/goals/goal-h');
  await expect(page.getByRole('heading', { name: '내 집 마련' })).toBeVisible();
  await expect(page.getByText('우리 목표').first()).toBeVisible();
  await axe(page);

  await page.getByRole('button', { name: '넣기·빼기' }).click();
  await page.getByRole('radio', { name: '넣을게요' }).click();
  await page.getByLabel('얼마를 넣을까요?').fill('500000');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('내 집 마련에 50만 원 넣었어요')).toBeVisible();
  await expect(page.getByRole('heading', { name: '내 집 마련' })).toBeVisible();
  expect(db.goalMoves).toHaveLength(1);

  await page.getByRole('button', { name: '꺼내 쓰기' }).click();
  await expect(
    page.getByRole('heading', { name: '내 집 마련에서 얼마를 꺼내 썼어요?' }),
  ).toBeVisible();
  await expect(page.getByText('지금 모은 돈은 50만 원이에요')).toBeVisible();
  await page.getByLabel('내 집 마련에서 얼마를 꺼내 썼어요?').fill('1000000');
  await expect(page.getByRole('button', { name: '저장' })).toBeDisabled();
  await page.getByLabel('내 집 마련에서 얼마를 꺼내 썼어요?').fill('200000');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('내 집 마련에서 20만 원 꺼내 썼어요')).toBeVisible();
  const history = page.getByRole('region', { name: '모은 돈 기록' });
  await expect(history).toContainText('꺼내 썼어요');
  await expect(history).toContainText('넣었어요');
});

test('G-03 목표 추가: 누구 목표예요? 나 → 내 목표, 분배표 저금 묶음 맨 아래 0원 줄', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/goals');
  await page.getByRole('button', { name: '+ 목표 추가' }).click();
  await expect(page.getByRole('heading', { name: '어떤 목표를 추가할까요?' })).toBeVisible();
  await page.getByRole('tab', { name: '미래' }).click();
  await page.getByRole('button', { name: '투자 종잣돈' }).click();
  await expect(page.getByRole('heading', { name: '누구 목표예요?' })).toBeVisible();
  await axe(page);
  await page.getByRole('radio', { name: '나' }).click();
  await page.getByLabel('얼마를 모아서 시작할까요?').fill('10000000');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('textbox', { name: '년' }).fill('2028');
  await page.getByRole('radio', { name: '12월' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('radio', { name: '없어요' }).click();
  await expect(
    page.getByText('분배표에 이 목표 줄을 0원으로 만들어 둘게요. 금액은 분배표에서 정해요'),
  ).toBeVisible();
  await page.getByRole('button', { name: '추가하기' }).click();
  await expect(page.getByRole('heading', { name: '투자 종잣돈' })).toBeVisible();
  await expect(page.getByText('내 목표').first()).toBeVisible();

  const g = db.goals.find((x) => x.template === 'invest_seed');
  expect(g).toMatchObject({ owner_user_id: chanwoo.id, target_amount: 10_000_000 });
  const lines = db.splits[0]?.split_line ?? [];
  expect(lines.map((l) => [l.kind, l.amount])).toEqual([
    ['saving', 440_000],
    ['saving', 950_000],
    ['saving', 0],
    ['fixed', 880_000],
    ['living', 880_000],
    ['allowance', 350_000],
  ]);
});

test('G-02 수정은 바로 저장: 기한, 이름, 보류·삭제는 되돌리기', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/goals/goal-h');
  await page.getByRole('button', { name: /기한/ }).click();
  await expect(page.getByRole('heading', { name: '언제까지 모을까요?' })).toBeVisible();
  await page.getByRole('textbox', { name: '년' }).fill('2032');
  await page.getByRole('radio', { name: '3월' }).click();
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByRole('heading', { name: '내 집 마련' })).toBeVisible();
  expect(db.goals.find((g) => g.id === 'goal-h')?.deadline).toBe('2032-03-01');

  await page.getByRole('button', { name: '목표 메뉴' }).click();
  await page.getByRole('menuitem', { name: '이름 변경' }).click();
  await page.getByLabel('목표 이름을 알려주세요').fill('우리 집');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByRole('heading', { name: '우리 집' })).toBeVisible();

  await page.getByRole('button', { name: '목표 메뉴' }).click();
  await page.getByRole('menuitem', { name: '보류' }).click();
  await expect(page.getByText('월 0원으로 배분에서 빠져 있어요')).toBeVisible();
  expect(db.goals.find((g) => g.id === 'goal-h')?.status).toBe('paused');
  // 보류하면 분배표 저금 줄이 빠짐
  expect(db.splits[0]?.split_line.some((l) => l.goal_id === 'goal-h')).toBe(false);
  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect(page.getByText('월 0원으로 배분에서 빠져 있어요')).toHaveCount(0);

  await page.getByRole('button', { name: '목표 메뉴' }).click();
  await page.getByRole('menuitem', { name: '삭제' }).click();
  await expect(page).toHaveURL(/\/goals$/);
  await expect(page.getByRole('button', { name: /우리 집/ })).toHaveCount(0);
});

test('G-02 기한 줄이기·늘리기(연결된 부부): 제안 없이 ‘저장’, Toast ‘되돌리기’, 이번 달 이전은 안 됨', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  Object.assign(db.space ?? {}, { couple_state: 'connected', partner_nickname: '예빈' });
  await page.goto('/goals/goal-h/edit/deadline');
  await expect(page.getByRole('heading', { name: '언제까지 모을까요?' })).toBeVisible();
  // 줄이기: 2031년 10월 → 2029년 6월
  await page.getByRole('textbox', { name: '년' }).fill('2029');
  await page.getByRole('radio', { name: '6월' }).click();
  await expect(page.getByRole('button', { name: /제안하기/ })).toHaveCount(0);
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('기한을 바꿨어요')).toBeVisible();
  expect(db.goals.find((g) => g.id === 'goal-h')?.deadline).toBe('2029-06-01');
  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect.poll(() => db.goals.find((g) => g.id === 'goal-h')?.deadline).toBe('2031-10-01');
  // 늘리기: 2035년 1월. 이번 달 이전은 저장 꺼짐
  await page.goto('/goals/goal-h/edit/deadline');
  await page.getByRole('textbox', { name: '년' }).fill('2025');
  await page.getByRole('radio', { name: '1월', exact: true }).click();
  await expect(page.getByText('이번 달부터 고를 수 있어요')).toBeVisible();
  await expect(page.getByRole('button', { name: '저장' })).toBeDisabled();
  await page.getByRole('textbox', { name: '년' }).fill('2035');
  await page.getByRole('button', { name: '저장' }).click();
  await expect.poll(() => db.goals.find((g) => g.id === 'goal-h')?.deadline).toBe('2035-01-01');
});

test('G-03 직접 만들기(우리 둘): 이름, 금액, 한 번, 기한, 이미 모은 돈 → 상세', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/goals');
  await page.getByRole('button', { name: '+ 목표 추가' }).click();
  await axe(page);
  await page.getByRole('button', { name: '+ 직접 만들기' }).click();
  await page.getByRole('radio', { name: '우리 둘' }).click();
  await page.getByLabel('무엇을 위한 돈인가요?').fill('캠핑 장비');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('얼마가 필요해요?').fill('2400000');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('radio', { name: /한 번이에요/ }).click();
  await page.getByRole('textbox', { name: '년' }).fill('2027');
  await page.getByRole('radio', { name: '12월' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await expect(
    page.getByRole('heading', { name: '이 목표로 이미 모은 돈이 있나요?' }),
  ).toBeVisible();
  await page.getByRole('radio', { name: '있어요' }).click();
  await page.getByLabel('얼마 모아뒀어요?').fill('500000');
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();
  await axe(page);
  await page.getByRole('button', { name: '추가하기' }).click();
  await expect(page.getByRole('heading', { name: '캠핑 장비' })).toBeVisible();
  expect(db.goals.find((g) => g.name === '캠핑 장비')).toMatchObject({
    template: 'custom',
    kind: 'once',
    target_amount: 2_400_000,
    deadline: '2027-12-01',
    other_held: 500_000,
    owner_user_id: null,
  });
});

test('G-05 달성: 축하 → 매달 넣던 돈 다른 목표 → 썼어요(얼마) → 남은 돈 비상금 → 고른 목표 저금 줄에 더함', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  db.goals.push({
    id: 'goal-tv',
    template: 'appliance',
    name: '가전 바꾸기',
    kind: 'once',
    priority: 2,
    target_amount: 1_000_000,
    other_held: 1_000_000,
    deadline: '2027-03-01',
    status: 'achieved',
    achieved_seen: [],
    freed_lines: { 'split-1': 300_000 },
    owner_user_id: null,
    details: {},
    deleted_at: null,
    created_at: '2026-06-01T00:00:00Z',
  });
  db.goalStory = { months: 4, together: 0 };
  await page.goto('/goals');
  await expect(page).toHaveURL(/\/goals\/goal-tv\/achieved$/);
  await expect(page.getByText('4개월 만에 모았어요')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();
  await expect(
    page.getByRole('heading', { name: '매달 넣던 30만 원은 어디로 보낼까요?' }),
  ).toBeVisible();
  await page.getByRole('radio', { name: '다른 목표' }).click();
  await expect(
    page.getByRole('heading', { name: '가전 바꾸기에 모은 100만 원, 썼나요?' }),
  ).toBeVisible();
  await page.getByRole('radio', { name: '썼어요' }).click();
  await expect(page.getByRole('heading', { name: '얼마 썼어요?' })).toBeVisible();
  await page.getByLabel('얼마 썼어요?').fill('800000');
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('heading', { name: '남은 20만 원은 어떻게 할까요?' })).toBeVisible();
  await page.getByRole('radio', { name: '비상금에 넣기' }).click();
  await expect(page.getByRole('heading', { name: '어느 목표에 더할까요?' })).toBeVisible();
  await page.getByRole('radio', { name: '내 집 마련' }).click();
  await expect(page).toHaveURL(/\/goals\/goal-h$/);
  await expect(page.getByText('내 집 마련 저금 줄에 30만 원을 더했어요')).toBeVisible();
  expect(db.goals.find((g) => g.id === 'goal-tv')?.status).toBe('used');
  const line = db.splits[0]?.split_line.find((l) => l.goal_id === 'goal-h');
  expect(line?.amount).toBe(1_250_000);
  // 남은 20만 원은 비상금으로(빼기 + 넣기)
  expect(db.goalMoves.filter((m) => m.goal_id === 'goal-e').map((m) => m.amount)).toEqual([
    200_000,
  ]);
});

test('달성 지켜보기: 모은 돈(이미 모은 돈 + 체크한 저금 + 넣기)이 목표 금액이 되면 축하로', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  const h = db.goals.find((g) => g.id === 'goal-h');
  if (h) h.other_held = 149_500_000;
  await page.goto('/goals/goal-h');
  await expect(page).toHaveURL(/\/goals\/goal-h$/);
  // 넣기 50만 원 → 1억 5,000만 원
  db.goalMoves.push({
    id: 'mv-1',
    goal_id: 'goal-h',
    kind: 'in',
    amount: 500_000,
    created_by: db.me.id,
    created_at: NOW.toISOString(),
    deleted_at: null,
  });
  await page.goto('/goals');
  await expect(page).toHaveURL(/\/goals\/goal-h\/achieved$/);
  expect(db.goals.find((g) => g.id === 'goal-h')?.status).toBe('achieved');
});

test('배우자 내 목표 ‘금액만 보여 주기’: G-01 배우자 묶음에 이름 대신 개인 목표, S-13 내 목표 공개 범위', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  Object.assign(db.space ?? {}, { couple_state: 'connected', partner_nickname: '예빈' });
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
  const base = db.goals.find((g) => g.id === 'goal-h') as Record<string, unknown>;
  db.goals.push(
    {
      ...base,
      id: 'goal-y',
      name: '예빈 카메라',
      template: 'hobby',
      priority: 1,
      owner_user_id: 'yebin',
      visibility: 'amount',
      target_amount: 2_000_000,
    },
    {
      ...base,
      id: 'goal-c',
      name: '찬우 자전거',
      template: 'hobby',
      priority: 1,
      owner_user_id: chanwoo.id,
      visibility: 'all',
      target_amount: 1_000_000,
    },
  );
  await page.goto('/goals');
  const theirs = page.getByRole('region', { name: /예빈님 목표/ });
  await expect(theirs.getByRole('button', { name: /개인 목표/ })).toBeVisible();
  await expect(page.getByText('예빈 카메라')).toHaveCount(0);
  await page.goto('/settings/visibility');
  const pick = page.getByRole('combobox', { name: '찬우 자전거 공개 범위' });
  await expect(pick).toHaveValue('all');
  await pick.selectOption('amount');
  await expect.poll(() => db.goals.find((g) => g.id === 'goal-c')?.visibility).toBe('amount');
  await axe(page);
});

test('G-02 정보·도움말·월별 기록, 삭제 되돌리기, 매년 목표 내년 금액', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  const home = db.goals.find((g) => g.id === 'goal-h') as Record<string, unknown>;
  home.created_by = db.me.id;
  const line = (db.checklists[0]?.pay_check_line as Record<string, unknown>[]).find(
    (l) => l.goal_id === 'goal-h',
  ) as Record<string, unknown>;
  Object.assign(line, {
    state: 'checked',
    actual: 950_000,
    checked_by: db.me.id,
    checked_at: '2026-09-26T01:00:00Z',
  });
  await page.goto('/goals/goal-h');
  await expect(page.getByRole('heading', { name: '내 집 마련' })).toBeVisible();
  const records = page.getByRole('region', { name: '월별 기록' });
  await expect(records.getByRole('cell', { name: '9월 월급' })).toBeVisible();
  await expect(records.getByRole('cell', { name: '넣었어요' })).toBeVisible();
  await expect(page.getByRole('button', { name: /청약·정책대출 체크리스트/ })).toBeVisible();
  await axe(page);

  // 매년 목표: 쓰는 달(10월)에 꺼내 쓰면 내년 금액을 한 번 물음
  db.goals.push({
    ...home,
    id: 'goal-t',
    name: '여행',
    template: 'travel',
    kind: 'yearly',
    priority: 2,
    target_amount: 3_000_000,
    other_held: 3_000_000,
    deadline: '2026-10-01',
  });
  await page.goto('/goals/goal-t/spend');
  await page.getByLabel(/여행에서 얼마를/).fill('2500000');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(
    page.getByRole('heading', { name: '내년 여행도 300만 원으로 할까요?' }),
  ).toBeVisible();
  await page.getByRole('radio', { name: '바꿀래요' }).click();
  await page.getByLabel('내년에는 얼마가 필요해요?').fill('3500000');
  await page.getByRole('button', { name: '저장' }).click();
  await expect.poll(() => db.goals.find((g) => g.id === 'goal-t')?.target_amount).toBe(3_500_000);

  // 삭제 → Toast 되돌리기
  await page.goto('/goals/goal-t');
  await page.getByRole('button', { name: '목표 메뉴' }).click();
  await page.getByRole('menuitem', { name: '삭제' }).click();
  await expect(page.getByText('삭제했어요')).toBeVisible();
  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect.poll(() => db.goals.find((g) => g.id === 'goal-t')?.deleted_at ?? null).toBeNull();
});
