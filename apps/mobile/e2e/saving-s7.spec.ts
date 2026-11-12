import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { chanwoo } from './supabase-mock';
import { mockOnboarding, type MemDb } from './onboarding-mock';
import { mockRealtime } from './realtime-mock';
import { seed } from './seed-home';
import { setYearMonth } from './wheel';

// QA 7구간 저금(2026-11-12): D1 합쳐서 모드 주인 있는 저금은 두 사람 모두(찬우·예빈 두 계정), Realtime(S7-02),
// 저금 내역 다시 읽기(S7-03), 오류 다시 시도(S7-04), W-10a 기한(S7-07), 회색 한 줄(S7-08·S7-09), 모은 금액 → 저금 내역(S7-10),
// 충돌 ‘내 값’ 문장(S7-11), 지우기 글자 버튼(S7-12), W-11 금액 가리기(S7-13), W-11 막힘 → W-02(S7-15)
const NOW = new Date('2026-10-07T10:00:00+09:00');
const YEBIN = 'yebin';
const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const CHANWOO_PROFILE = {
  id: chanwoo.id,
  nickname: '찬우',
  side: 'groom',
  employment: 'regular',
  monthly_income: 3_500_000,
  payday: 25,
  payday_last: false,
  allowance: 350_000,
};
const YEBIN_PROFILE = {
  id: YEBIN,
  nickname: '예빈',
  side: 'bride',
  employment: 'regular',
  monthly_income: 2_700_000,
  payday: 10,
  payday_last: false,
  allowance: 270_000,
};

/** 합쳐서: 월급 계획·체크리스트 공동, 내 집 마련은 우리 둘 것, 청약은 찬우 것(각자일 때 만든 항목) */
function joint(db: MemDb) {
  Object.assign(db.space ?? {}, {
    couple_state: 'connected',
    partner_nickname: '예빈',
    salary_mode: 'joint',
    joint_cycle_day: 25,
  });
  db.partner = { ...YEBIN_PROFILE };
  const h = db.goals.find((g) => g.id === 'goal-h');
  if (h) h.owner_user_id = null;
  for (const sp of db.splits) sp.owner_user_id = null;
  for (const c of db.checklists) c.owner_user_id = null;
}

async function open(page: Page, prep?: (db: MemDb) => void, url = '/salary/items/goal-h') {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  prep?.(db);
  await page.goto(url);
  return db;
}

test('D1 합쳐서: 찬우가 주인인 저금을 예빈도 고치고, 찬우 화면은 Realtime으로 바로 바뀜(두 계정)', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const cCtx = await browser.newContext();
  const yCtx = await browser.newContext();
  const c = await cCtx.newPage();
  const y = await yCtx.newPage();
  await c.clock.setFixedTime(NOW);
  await y.clock.setFixedTime(NOW);
  const rt = await mockRealtime(c);
  const db = await mockOnboarding(c, { now: NOW });
  seed(db);
  joint(db);
  // 예빈 기기: 같은 공간(같은 표를 나눠 씀), 나와 파트너만 바뀜
  const ydb = await mockOnboarding(y, { now: NOW });
  Object.assign(ydb, {
    me: {
      ...ydb.me,
      ...YEBIN_PROFILE,
      space_id: 'space-1',
      onboarding_done_at: '2026-10-02T00:00:00Z',
    },
    partner: { ...CHANWOO_PROFILE },
    space: db.space,
    goals: db.goals,
    splits: db.splits,
    checklists: db.checklists,
  });
  if (ydb.space) ydb.space.partner_nickname = '찬우';

  await c.goto('/salary/items/goal-e');
  await expect(c.getByRole('heading', { name: '청약' })).toBeVisible();
  await expect.poll(() => rt.subscribed('goal')).toBeGreaterThan(0);

  await y.goto('/salary/items/goal-e');
  await expect(y.getByRole('heading', { name: '청약' })).toBeVisible();
  // 보기만 안내 없음, ⋯ 메뉴와 고치기(목표 금액 정하기)가 있음
  await expect(y.getByText('보기만 할 수 있어요')).toHaveCount(0);
  await expect(y.getByRole('button', { name: '더보기' }).first()).toBeVisible();
  await expect(y.getByRole('button', { name: '목표 금액 정하기' })).toBeEnabled();
  // 이번 달 줄도 체크할 수 있음(공동 체크리스트)
  await expect(y.getByRole('checkbox', { name: '이번 달 체크' })).toBeEnabled();
  await axe(y);

  await y.goto('/salary/items/goal-e/edit/name');
  await y.getByRole('textbox').first().fill('청약 통장');
  await y.getByRole('button', { name: '저장' }).click();
  await expect(y).toHaveURL(/\/salary\/items\/goal-e$/);
  await expect(y.getByRole('heading', { name: '청약 통장' })).toBeVisible();
  expect(db.goals.find((g) => g.id === 'goal-e')?.name).toBe('청약 통장');

  // 찬우 화면: goal 변경 신호로 바로 다시 읽음(S7-02)
  rt.emit('goal', 'UPDATE', { id: 'goal-e', space_id: 'space-1' });
  await expect(c.getByRole('heading', { name: '청약 통장' })).toBeVisible();
  await cCtx.close();
  await yCtx.close();
});

test('D1 합쳐서: 파트너 저금 달성도 축하(W-12 → W-12a), ‘금액만 보여 주기’ 파트너 것은 보기만', async ({
  page,
}) => {
  const db = await open(
    page,
    (d) => {
      joint(d);
      const base = d.goals.find((g) => g.id === 'goal-h') as Record<string, unknown>;
      d.goals.push(
        {
          ...base,
          id: 'goal-y',
          name: '카메라',
          priority: 3,
          owner_user_id: YEBIN,
          created_by: YEBIN,
          visibility: 'all',
          target_amount: 300_000,
          deadline: null,
          start_saved: 300_000,
        },
        {
          ...base,
          id: 'goal-s',
          name: '비밀',
          priority: 4,
          owner_user_id: YEBIN,
          created_by: YEBIN,
          visibility: 'amount',
          target_amount: null,
          deadline: null,
        },
      );
      d.goalStory = { months: 1, together: 0 };
    },
    '/salary/items/goal-y',
  );
  // 예빈이 주인인 ‘카메라’는 시작할 때 모은 금액으로 이미 닿아 있음 → 찬우도 축하
  await expect(page).toHaveURL(/\/salary\/items\/goal-y\/achieved/);
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page).toHaveURL(/\/salary\/items\/goal-y\/after/);
  expect(db.goals.find((g) => g.id === 'goal-y')?.status).toBe('achieved');

  // ‘금액만 보여 주기’ 파트너 저금은 합쳐서여도 보기만(맨 위 회색 한 줄)
  await page.goto('/salary/items/goal-s');
  await expect(page.getByRole('heading', { name: '개인 저금' })).toBeVisible();
  await expect(page.locator('.hg-goaldetail > .hg-q__help')).toHaveText(
    '예빈님 저금이에요. 보기만 할 수 있어요',
  );
  await expect(page.getByRole('button', { name: '더보기' })).toHaveCount(0);
});

test('S7-08·S7-09: 보기만·그만 모음·해제 대기는 머리 아래 회색 한 줄, 해제 대기 중 고치기 비활성', async ({
  page,
}) => {
  await open(page, (db) => {
    Object.assign(db.space ?? {}, { couple_state: 'unlink_pending', partner_nickname: '예빈' });
    db.partner = { ...YEBIN_PROFILE };
  });
  await expect(page.getByRole('heading', { name: '내 집 마련' })).toBeVisible();
  const line = page.locator('.hg-goaldetail > .hg-q__help');
  await expect(line).toHaveText('연결 해제 대기 중에는 저금을 고칠 수 없어요');
  await expect(page.getByRole('button', { name: '더보기' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '고치기' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '바꾸기', exact: true })).toBeDisabled();
  // 체크는 그대로
  await expect(page.getByRole('checkbox', { name: '이번 달 체크' })).toBeEnabled();
  await axe(page);
});

test('S7-08 그만 모은 저금: 맨 위 회색 한 줄', async ({ page }) => {
  await open(page, (db) => {
    const h = db.goals.find((g) => g.id === 'goal-h');
    if (h) h.closed_at = '2026-10-05T00:00:00Z';
  });
  await expect(page.locator('.hg-goaldetail > .hg-q__help')).toHaveText('그만 모은 저금이에요');
});

test('S7-03·S7-10: 이번 달 줄을 체크하면 저금 내역이 바로 바뀜, 모은 금액을 누르면 저금 내역으로', async ({
  page,
}) => {
  await open(page);
  await expect(page.getByRole('heading', { name: '내 집 마련' })).toBeVisible();
  const history = page.getByRole('region', { name: '저금 내역' });
  await expect(history).toContainText('아직 기록이 없어요');
  await page.getByRole('checkbox', { name: '이번 달 체크' }).click();
  await expect(history).toContainText('9월 월급 95만 원');
  await page.setViewportSize({ width: 390, height: 500 });
  await page.getByRole('button', { name: /모은 금액/ }).click();
  await expect(history).toBeInViewport();
});

test('S7-04: 저금을 못 불러오면 오류 카드 + 다시 시도(W-10, W-13, W-10a)', async ({ page }) => {
  // 쿼리가 세 번 다시 시도한 뒤에 오류(화면마다 약 7초)
  test.setTimeout(120_000);
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  let fail = true;
  await page.route('**/rest/v1/rpc/space_goals*', (route) =>
    fail
      ? route.fulfill({ status: 500, body: '{}', headers: { 'Access-Control-Allow-Origin': '*' } })
      : route.fallback(),
  );
  await page.goto('/salary/items/goal-h');
  await expect(page.getByText('잠시 문제가 생겼어요')).toBeVisible({ timeout: 20_000 });
  await axe(page);
  fail = false;
  await page.getByRole('button', { name: '다시 시도' }).click();
  await expect(page.getByRole('heading', { name: '내 집 마련' })).toBeVisible();

  fail = true;
  await page.goto('/salary/items');
  await expect(page.getByText('잠시 문제가 생겼어요')).toBeVisible({ timeout: 20_000 });
  await page.goto('/salary/items/goal-h/edit/name');
  await expect(page.getByRole('heading', { name: '잠시 문제가 생겼어요' })).toBeVisible({
    timeout: 20_000,
  });
  fail = false;
  await page.getByRole('button', { name: '다시 시도' }).click();
  await expect(page.getByRole('heading', { name: '무엇을 위해 모을까요?' })).toBeVisible();
});

test('S7-07·S7-12: 목표 금액을 처음 정한 뒤 기한은 1년 뒤 + 필요액 + ‘기한 없이 모을게요’, 지우기는 글자 버튼', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const db = await open(page, undefined, '/salary/items/goal-e');
  await page.getByRole('button', { name: '목표 금액 정하기' }).click();
  await page.getByRole('textbox').first().fill('12000000');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page).toHaveURL(/\/salary\/items\/goal-e\/edit\/deadline\?first=1$/);
  // 처음 값 1년 뒤(2027년 10월): 1,200만 원 ÷ 13개월 = 93만 원
  await expect(page.getByText('매달 93만 원이 필요해요')).toBeVisible();
  await expect(page.getByText(/지금대로면 기한보다 \d+개월 늦어요/)).toBeVisible();
  await page.getByRole('button', { name: '기한 없이 모을게요' }).click();
  await expect(page).toHaveURL(/\/salary\/items\/goal-e$/);
  expect(db.goals.find((g) => g.id === 'goal-e')?.deadline ?? null).toBeNull();

  await page.goto('/salary/items/goal-h/edit/amount');
  await expect(page.getByRole('button', { name: '목표 금액 지우기' })).toHaveClass(/hg-btn--link/);
  await page.goto('/salary/items/goal-h/edit/deadline');
  await expect(page.getByRole('button', { name: '기한 지우기' })).toHaveClass(/hg-btn--link/);
  await expect(page.getByRole('button', { name: '기한 없이 모을게요' })).toHaveCount(0);
  await axe(page);
});

test('S7-11: 충돌에서 ‘내 값’을 고르면 그 칸의 문장(기한을 바꿨어요)', async ({ page }) => {
  const db = await open(page, undefined, '/salary/items/goal-h/edit/deadline');
  if (db.space) db.space.partner_nickname = '예빈';
  await expect(page.getByRole('heading', { name: '언제까지 모을까요?' })).toBeVisible();
  const home = db.goals.find((g) => g.id === 'goal-h');
  Object.assign(home ?? {}, {
    deadline: '2032-01-01',
    updated_by: 'yebin-id',
    updated_at: new Date(NOW.getTime() - 30_000).toISOString(),
  });
  await setYearMonth(page, 2033, 6);
  await page.getByRole('button', { name: '저장' }).click();
  const choice = page.getByRole('group', { name: '어느 쪽으로 할까요?' });
  await expect(choice).toBeVisible();
  await choice.getByRole('button', { name: /내 값/ }).click();
  await expect(page.locator('.hg-toast')).toContainText('기한을 바꿨어요');
});

test('S7-13·S7-15: W-11b 여유 자금은 금액 가리기를 따름, 월급 계획이 없거나 해제 대기면 W-02 + 이유 Toast', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('sweetwo.masked', '1'));
  await open(page, undefined, '/salary/items/new/a');
  await page.getByRole('textbox').first().fill('여행');
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByText('지금 여유 자금 •••')).toBeVisible();

  await open(
    page,
    (db) => {
      Object.assign(db.space ?? {}, { couple_state: 'unlink_pending', partner_nickname: '예빈' });
    },
    '/salary/items/new/a',
  );
  await expect(page).toHaveURL(/\/salary$/);
  await expect(page.locator('.hg-toast')).toContainText(
    '연결 해제 대기 중에는 저금을 추가할 수 없어요',
  );

  await open(
    page,
    (db) => {
      db.splits.length = 0;
    },
    '/salary/items/new/a',
  );
  await expect(page).toHaveURL(/\/salary$/);
  await expect(page.locator('.hg-toast')).toContainText('월급이 생기면 저금을 추가할 수 있어요');
});

test('S7-02: W-13 저금 목록도 상대 변경을 Realtime으로 바로 받음', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const rt = await mockRealtime(page);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  joint(db);
  await page.goto('/salary/items');
  await expect(page.locator('.hg-goallist')).toBeVisible();
  await expect.poll(() => rt.subscribed('goal')).toBeGreaterThan(0);
  const h = db.goals.find((g) => g.id === 'goal-h');
  if (h) h.name = '우리 집';
  rt.emit('goal', 'UPDATE', { id: 'goal-h', space_id: 'space-1' });
  await expect(page.locator('.hg-goalrow__name').filter({ hasText: '우리 집' })).toBeVisible();
});
