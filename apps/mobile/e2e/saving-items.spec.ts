import { setYearMonth } from './wheel';
import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { chanwoo } from './supabase-mock';
import { mockOnboarding } from './onboarding-mock';
import { seed } from './seed-home';

// 저금 항목(20 W-10~W-12, ADR 0007): 목표 탭 없이 월급 탭 저금 줄이 목표 금액(+ 기한)을 가짐.
// 모은 돈 = 체크한 저금 합. 달성하면 축하 1회 → ‘계속 모을게요’ / ‘그만할게요’.
const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const NOW = new Date('2026-10-07T10:00:00+09:00');

test('W-02 저금 줄 진행, 시트 ‘저금 항목 보기’ → W-10 상세(목표 금액, 기한, 월 필요액, 매달)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/salary');
  // 목표 금액이 있는 저금 줄만 진행 “0원 / 1억 5,000만 원”
  await expect(page.getByText('0원 / 1억 5,000만 원')).toBeVisible();
  await axe(page);

  await page.goto('/salary/items/goal-h');
  await expect(page.getByRole('heading', { name: '내 집 마련' })).toBeVisible();
  const target = page.getByRole('region', { name: '목표 금액 정하기' });
  await expect(target).toContainText('목표 1억 5,000만 원의 0%');
  await expect(target).toContainText('2031년 10월까지');
  await expect(target).toContainText('매달');
  await expect(page.getByText('매달 95만 원씩')).toBeVisible();
  await axe(page);

  // 목표 금액이 없는 항목: 진행 대신 ‘목표 금액 정하기’
  await page.goto('/salary/items/goal-e');
  await expect(page.getByRole('heading', { name: '비상금' })).toBeVisible();
  await expect(page.getByText('목표 금액을 정하면 얼마나 모았는지 보여 드려요')).toBeVisible();
  await page.getByRole('button', { name: '목표 금액 정하기' }).click();
  await expect(page).toHaveURL(/\/salary\/items\/goal-e\/edit\/amount\?first=1$/);
  await page.getByRole('textbox').first().fill('5000000');
  await page.getByRole('button', { name: '저장' }).click();
  // 처음 정하면 기한으로 이어짐
  await expect(page).toHaveURL(/\/salary\/items\/goal-e\/edit\/deadline$/);
  expect(db.goals.find((g) => g.id === 'goal-e')?.target_amount).toBe(5_000_000);
});

test('W-11 저금 항목 추가: 이름 → 매달 → 목표 금액 → 기한 → W-10, 월급 계획 저금 줄과 이번 달 체크리스트', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/salary/items/new');
  await expect(page.getByRole('heading', { name: '무엇을 위해 모을까요?' })).toBeVisible();
  await axe(page);
  await page.getByLabel('무엇을 위해 모을까요?').fill('제주 여행');
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('heading', { name: '매달 얼마씩 모을까요?' })).toBeVisible();
  await page.getByLabel('매달 얼마씩 모을까요?').fill('200000');
  await page.getByRole('button', { name: '다음' }).click();
  await expect(
    page.getByRole('heading', { name: '모으고 싶은 목표 금액이 있나요?' }),
  ).toBeVisible();
  await page.getByLabel('모으고 싶은 목표 금액이 있나요?').fill('2000000');
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('heading', { name: '언제까지 모을까요?' })).toBeVisible();
  await setYearMonth(page, 2027, 6);
  await page.getByRole('button', { name: '추가하기' }).click();
  await expect(page).toHaveURL(/\/salary\/items\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name: '제주 여행' })).toBeVisible();
  const g = db.goals.find((x) => x.name === '제주 여행');
  expect(g).toMatchObject({
    target_amount: 2_000_000,
    deadline: '2027-06-01',
    owner_user_id: chanwoo.id,
  });
  const line = db.splits[0]?.split_line.find((l) => l.goal_id === g?.id);
  expect(line?.amount).toBe(200_000);
  // 이번 사이클 체크리스트에도 줄
  const lines = db.checklists[0]?.pay_check_line as Record<string, unknown>[];
  expect(lines.find((l) => l.goal_id === g?.id)?.planned).toBe(200_000);

  // 목표 금액 없이 모을게요: 바로 저장
  await page.goto('/salary/items/new');
  await page.getByLabel('무엇을 위해 모을까요?').fill('적금');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('매달 얼마씩 모을까요?').fill('100000');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '목표 금액 없이 모을게요' }).click();
  await expect(page.getByRole('heading', { name: '적금' })).toBeVisible();
  expect(db.goals.find((x) => x.name === '적금')?.target_amount).toBeNull();
});

test('W-10a 고치기: 이름 바로 저장 + 되돌리기, 목표 금액 지우기, 지우기(휴지통) 되돌리기', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  const home = db.goals.find((g) => g.id === 'goal-h');
  if (!home) throw new Error('seed');
  await page.goto('/salary/items/goal-h');
  await page.getByRole('button', { name: '더보기' }).first().click();
  await page.getByRole('menuitem', { name: '이름 바꾸기' }).click();
  await page.getByRole('textbox').first().fill('우리 집');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('이름을 바꿨어요')).toBeVisible();
  await expect(page.getByRole('heading', { name: '우리 집' })).toBeVisible();
  expect(home.name).toBe('우리 집');

  await page.goto('/salary/items/goal-h/edit/amount');
  await page.getByRole('button', { name: '목표 금액 지우기' }).click();
  await expect(page.getByText('목표 금액을 지웠어요')).toBeVisible();
  // 목표 금액을 지우면 기한도 같이 지움
  expect(home.target_amount).toBeNull();
  expect(home.deadline).toBeNull();

  await page.goto('/salary/items/goal-h');
  await page.getByRole('button', { name: '더보기' }).first().click();
  await page.getByRole('menuitem', { name: '지우기' }).click();
  await expect(page.getByText('휴지통으로 옮겼어요')).toBeVisible();
  await expect(page).toHaveURL(/\/salary$/);
  expect(home.deleted_at).toBeTruthy();
});

test('달성: 체크로 목표 금액에 닿으면 W-12 축하 → W-12a ‘계속 모을게요’ = 목표 금액만 지우고 줄은 그대로', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  db.goals.push({
    id: 'goal-tv',
    template: 'custom',
    name: '가전 바꾸기',
    kind: 'once',
    priority: 2,
    target_amount: 300_000,
    other_held: 0,
    deadline: null,
    status: 'active',
    achieved_seen: [],
    owner_user_id: chanwoo.id,
    created_by: chanwoo.id,
    visibility: 'all',
    details: {},
    closed_at: null,
    deleted_at: null,
    created_at: '2026-06-01T00:00:00Z',
  });
  const sp = db.splits[0];
  if (!sp) throw new Error('seed');
  sp.split_line.push({
    id: 'split-1-line-tv',
    split_id: 'split-1',
    kind: 'saving',
    goal_id: 'goal-tv',
    user_id: null,
    name: null,
    amount: 300_000,
    sort: 2,
  });
  (db.checklists[0]?.pay_check_line as Record<string, unknown>[]).push({
    id: 'split-1-line-tv-c',
    split_id: 'split-1',
    kind: 'saving',
    goal_id: 'goal-tv',
    user_id: null,
    name: null,
    amount: 300_000,
    planned: 300_000,
    actual: null,
    state: 'wait',
    sort: 2,
    checked_by: null,
    checked_at: null,
  });
  db.goalStory = { months: 4, together: 0 };
  await page.goto('/salary');
  await page.getByRole('checkbox', { name: /가전 바꾸기/ }).click();
  await expect(page).toHaveURL(/\/salary\/items\/goal-tv\/achieved$/);
  await expect(page.getByText('4개월 만에 모았어요')).toBeVisible();
  expect(db.goals.find((g) => g.id === 'goal-tv')?.status).toBe('achieved');
  await axe(page);
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('heading', { name: '이 저금 항목을 어떻게 할까요?' })).toBeVisible();
  await page.getByRole('radio', { name: '계속 모을게요' }).click();
  await expect(page.getByText('목표 금액을 지우고 계속 모아요')).toBeVisible();
  const tv = db.goals.find((g) => g.id === 'goal-tv');
  expect(tv?.target_amount).toBeNull();
  expect(tv?.closed_at ?? null).toBeNull();
  expect(sp.split_line.some((l) => l.goal_id === 'goal-tv')).toBe(true);
});

test('W-12a ‘그만할게요’: 월급 계획 줄이 빠지고 W-01 접힌 묶음, 되돌리기로 다시 모음', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  const home = db.goals.find((g) => g.id === 'goal-h');
  if (!home) throw new Error('seed');
  Object.assign(home, { status: 'achieved', achieved_seen: [chanwoo.id] });
  await page.goto('/salary/items/goal-h/after');
  await expect(page.getByRole('heading', { name: '이 저금 항목을 어떻게 할까요?' })).toBeVisible();
  await page.getByRole('radio', { name: '그만할게요' }).click();
  await expect(page.getByText('그만 모으기로 했어요')).toBeVisible();
  expect(home.closed_at).toBeTruthy();
  expect(db.splits[0]?.split_line.some((l) => l.goal_id === 'goal-h')).toBe(false);
  await page.goto('/salary/items/goal-h');
  await expect(page.getByText('그만 모은 저금 항목이에요')).toBeVisible();
  await page.goto('/salary/split');
  await expect(page.getByText('그만 모은 저금 항목 1개')).toBeVisible();
});

test('각자 모드 파트너 저금 항목: 보기만, ‘금액만 보여 주기’면 “개인 저금”, S-13 내 저금 항목 공개 범위', async ({
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
      priority: 2,
      owner_user_id: 'yebin',
      created_by: 'yebin',
      visibility: 'amount',
      target_amount: 2_000_000,
    },
    {
      ...base,
      id: 'goal-c',
      name: '찬우 자전거',
      priority: 3,
      owner_user_id: chanwoo.id,
      visibility: 'all',
      target_amount: 1_000_000,
    },
  );
  await page.goto('/salary/items/goal-y');
  await expect(page.getByRole('heading', { name: '개인 저금' })).toBeVisible();
  await expect(page.getByText('예빈님 저금 항목이에요')).toBeVisible();
  // 보기만: ⋯ 메뉴, 고치기 버튼 없음
  await expect(page.getByRole('button', { name: '더보기' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '고치기' })).toHaveCount(0);
  await expect(page.getByText('예빈 카메라')).toHaveCount(0);

  await page.goto('/settings/visibility');
  const pick = page.getByRole('button', { name: /찬우 자전거/ });
  await expect(pick).toContainText('모두 보여 주기');
  await pick.click();
  await page
    .getByRole('dialog', { name: '찬우 자전거 공개 범위' })
    .getByRole('radio', { name: '금액만 보여 주기' })
    .click();
  await expect.poll(() => db.goals.find((g) => g.id === 'goal-c')?.visibility).toBe('amount');
  await axe(page);
});

test('충돌 선택(30 동기화 2장): 파트너가 1분 안에 같은 칸을 바꿨으면 “어느 쪽으로 할까요?”', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  if (db.space) db.space.partner_nickname = '예빈';
  const home = db.goals.find((g) => g.id === 'goal-h');
  if (!home) throw new Error('seed');
  await page.goto('/salary/items/goal-h/edit/amount');
  await expect(page.getByRole('textbox').first()).toBeVisible();
  // 화면을 연 뒤 파트너가 30초 전에 1억 2,000만 원으로 바꿈
  Object.assign(home, {
    target_amount: 120_000_000,
    updated_by: 'yebin-id',
    updated_at: new Date(NOW.getTime() - 30_000).toISOString(),
  });
  await page.getByRole('textbox').first().fill('130000000');
  await page.getByRole('button', { name: '저장' }).click();
  const choice = page.getByRole('group', { name: '어느 쪽으로 할까요?' });
  await expect(choice).toContainText('예빈님이 방금 이 값을 바꿨어요');
  await expect(choice.getByRole('button', { name: /내 값/ })).toContainText('1억 3,000만 원');
  await expect(choice.getByRole('button', { name: /예빈님 값/ })).toContainText('1억 2,000만 원');
  expect(home.target_amount).toBe(120_000_000);
  await choice.getByRole('button', { name: /내 값/ }).click();
  await expect(page).toHaveURL(/\/salary\/items\/goal-h$/);
  expect(home.target_amount).toBe(130_000_000);
});
