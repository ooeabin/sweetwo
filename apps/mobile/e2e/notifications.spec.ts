import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { mockOnboarding, type MemDb } from './onboarding-mock';

// 알림 센터(docs/spec/14-notifications.md N-01~N-03). 찬우(시작한 사람)의 센터, 예빈(합류)이 바꾼 목표·챙길 날·월말 확인

const axe = async (page: Page) => {
  const r = await runAxe(page);
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

const noti = (p: Record<string, unknown>) => ({
  user_id: 'me',
  space_id: 'space-1',
  body: null,
  push_title: null,
  push_hidden: false,
  icon: null,
  actor_id: null,
  read_at: null,
  ...p,
});
function seedNotis(db: MemDb) {
  db.notifications.push(
    noti({
      id: '00000000-0000-4000-8000-000000000001',
      kind: 'partner_change',
      title: '예빈님이 내 집 마련 목표를 바꿨어요',
      target: '/goals',
      actor_id: 'yebin',
      created_at: '2026-10-07T00:48:00Z', // 오늘 09:48 → 12분 전
    }),
    noti({
      id: '00000000-0000-4000-8000-000000000002',
      kind: 'care_day',
      title: '어머니 생신이 한 달 남았어요',
      body: '예산은 30만 원이에요',
      target: '/calendar/list',
      icon: 'gift',
      created_at: '2026-10-05T00:00:00Z', // 월요일 → 이번 주
    }),
    noti({
      id: '00000000-0000-4000-8000-000000000003',
      kind: 'close_start',
      title: '9월 월급 플랜을 정리할 차례예요',
      target: '/calendar/list',
      icon: 'clipboard-text',
      read_at: '2026-09-23T00:00:00Z',
      created_at: '2026-09-22T11:00:00Z', // 이전
    }),
  );
}

test('알림 센터: 종 점, 오늘·이번 주·이전, 누르면 읽음 + 그 화면, 모두 읽음, 금액 가리기', async ({
  page,
}, info) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  seedNotis(db);
  const narrow = info.project.name === 'narrow';

  await page.goto('/calendar/list');
  const bell = page
    .locator(narrow ? '.hg-frame__mhead' : '.hg-topnav')
    .getByRole('button', { name: '알림', exact: true });
  await expect(bell).toHaveClass(/hg-iconbtn--dot/);
  await bell.click();
  if (narrow) await expect(page).toHaveURL(/\/notifications$/);
  const panel = page.getByRole('complementary', { name: '알림' });
  await expect(panel).toBeVisible();
  const today = panel.getByRole('region', { name: '오늘' });
  await expect(today).toContainText('예빈님이 내 집 마련 목표를 바꿨어요');
  await expect(today).toContainText('12분 전');
  await expect(today.locator('.hg-avatar--p2')).toHaveText('예');
  await expect(panel.getByRole('region', { name: '이번 주' })).toContainText(
    '어머니 생신이 한 달 남았어요',
  );
  await expect(panel.getByRole('region', { name: '이전' })).toContainText('9월 22일');
  // 열리면 첫 줄 포커스, ↓로 다음 줄
  await expect(today.getByRole('button').first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(
    panel.getByRole('region', { name: '이번 주' }).getByRole('button').first(),
  ).toBeFocused();
  await axe(page);

  // 누르면 읽음 + 그 화면
  await today.getByRole('button').first().click();
  await expect(page).toHaveURL(/\/goals$/);
  await expect.poll(() => db.notifications[0]?.read_at).not.toBeNull();
  await expect(page.getByRole('complementary', { name: '알림' })).toHaveCount(0);

  // 모두 읽음 → 점 사라짐
  await page.goto(narrow ? '/notifications' : '/calendar/list');
  if (!narrow) await bell.click();
  await panel.getByRole('button', { name: '모두 읽음' }).click();
  await expect(panel.getByRole('button', { name: '모두 읽음' })).toBeDisabled();
  expect(db.notifications.every((n) => n.read_at)).toBe(true);
  if (!narrow) {
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(bell).not.toHaveClass(/hg-iconbtn--dot/);
  }
});

test('알림 센터: 금액 가리기면 문구 속 금액 •••, 빈 상태', async ({ page }, info) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/notifications');
  await expect(page.getByText('새 알림이 없어요')).toBeVisible();
  await axe(page);

  db.notifications.push(
    noti({
      id: '00000000-0000-4000-8000-000000000009',
      kind: 'care_day',
      title: '예산은 30만 원이에요',
      target: '/calendar/list',
      created_at: '2026-10-07T00:00:00Z',
    }),
  );
  await page.goto('/calendar/list');
  await page
    .locator(info.project.name === 'narrow' ? '.hg-frame__mhead' : '.hg-topnav')
    .getByRole('button', { name: '금액 가리기' })
    .click();
  await page.goto('/notifications');
  await expect(page.getByRole('complementary', { name: '알림' })).toContainText('예산은 •••이에요');
});
