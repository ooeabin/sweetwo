import { goOffline, goOnline } from './offline';
import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { type MemDb, mockOnboarding } from './mocks';

// 알림 센터(docs/spec/14-notifications.md N-01~N-03). 찬우(시작한 사람)의 센터, 예빈(합류)이 바꾼 저금 항목·경조사·월급 전 확인

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
      title: '예빈님이 내 집 마련 저축·투자를 바꿨어요',
      target: '/salary/split',
      actor_id: 'yebin',
      created_at: '2026-10-07T00:48:00Z', // 오늘 09:48 → 12분 전
    }),
    noti({
      id: '00000000-0000-4000-8000-000000000002',
      kind: 'care_day',
      title: '어머니 생신이 한 달 남았어요',
      body: '예산은 300,000원이에요',
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

  // 좁은 창 알림 종은 홈 머리에만(2026-11-09, 홈 밖 메뉴 머리는 ‹ + 제목)
  await page.goto(narrow ? '/' : '/calendar/list');
  const bell = page
    .locator(narrow ? '.hg-frame__mhead' : '.hg-appside')
    .getByRole('button', { name: /^알림/ });
  await expect(bell).toHaveClass(/hg-iconbtn--dot/);
  // 점은 그림이라 화면 읽기 이름에도(2026-11-11 QA 4구간 S4-06)
  await expect(bell).toHaveAccessibleName('알림, 새 알림이 있어요');
  // 점은 버튼 상자 모서리가 아니라 종 아이콘 오른쪽 위 어깨에 붙음(2026-11-16, 누르는 칸을 44px로 키워도), 테두리는 놓인 바탕색
  const geo = () =>
    bell.evaluate((b) => {
      const r = b.getBoundingClientRect();
      const i = (b.querySelector('.hg-ico') ?? b).getBoundingClientRect();
      const cs = getComputedStyle(b, '::after');
      return {
        dx: i.right - (r.left + parseFloat(cs.left) + 4),
        dy: r.top + parseFloat(cs.top) + 4 - i.top,
      };
    });
  await expect.poll(async () => (await geo()).dx).toBeGreaterThanOrEqual(1);
  await expect.poll(async () => (await geo()).dx).toBeLessThanOrEqual(5);
  await expect.poll(async () => (await geo()).dy).toBeGreaterThanOrEqual(1);
  await expect.poll(async () => (await geo()).dy).toBeLessThanOrEqual(5);
  await bell.click();
  if (narrow) await expect(page).toHaveURL(/\/notifications$/);
  const panel = page.getByRole('complementary', { name: '알림' });
  await expect(panel).toBeVisible();
  const today = panel.getByRole('region', { name: '오늘' });
  await expect(today).toContainText('예빈님이 내 집 마련 저축·투자를 바꿨어요');
  await expect(today).toContainText('12분 전');
  // 줄 앞 칸 없음(2026-11-20): 사람 원도 그리지 않고 모든 줄의 글자 시작 위치가 같음
  await expect(panel.locator('.hg-avatar')).toHaveCount(0);
  await expect(panel.locator('.hg-noti__item:not(.hg-noti__item--plain)')).toHaveCount(0);
  await expect(panel.getByRole('region', { name: '이번 주' })).toContainText(
    '어머니 생신이 한 달 남았어요',
  );
  await expect(panel.getByRole('region', { name: '이전' })).toContainText('9월 22일');
  // 2026-11-27 강약 기준 2차: 알림 문장 15(시간 13과 크기로 갈림), 안 읽음 700
  const msg0 = today.locator('.hg-noti__msg').first();
  await expect(msg0).toHaveCSS('font-size', '15px');
  await expect(msg0).toHaveCSS('font-weight', '700');
  await expect(today.locator('.hg-noti__time').first()).toHaveCSS('font-size', '13px');
  if (narrow) {
    // 좁은 창 알림 화면: 줄 글자는 다른 흰 화면처럼 왼쪽 24에서 시작(예전 44), ‘알림 설정’은 회색 글자 버튼
    expect(await msg0.evaluate((e) => Math.round(e.getBoundingClientRect().left))).toBe(24);
    await expect(panel.getByRole('button', { name: '알림 설정' })).toHaveClass(/hg-btn--link/);
  }
  // 열리면 첫 줄 포커스, ↓로 다음 줄(넓은 창). 좁은 창은 손가락이라 첫 줄에 포커스 테두리를 두지 않음(2026-11-03)
  if (!narrow) {
    await expect(today.getByRole('button').first()).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(
      panel.getByRole('region', { name: '이번 주' }).getByRole('button').first(),
    ).toBeFocused();
  } else await expect(today.getByRole('button').first()).not.toBeFocused();
  await axe(page);

  // 누르면 읽음 + 그 화면
  await today.getByRole('button').first().click();
  // 옛 링크 /salary/split → 월급 탭 ‘계획’(2026-11-09)
  await expect(page).toHaveURL(/\/salary\/plan$/);
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
    await expect(bell).toHaveAccessibleName('알림');
  }
});

test('알림 센터: 금액 가리기면 문구 속 금액 •••, 빈 상태', async ({ page }, info) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/notifications');
  await expect(page.getByText('새 알림이 없어요')).toBeVisible();
  // 2026-11-20 빈 목록 안내 글자는 slate(라이트 rgb(84, 85, 87))
  if (info.project.name === 'light')
    await expect(page.getByText('새 알림이 없어요')).toHaveCSS('color', 'rgb(84, 85, 87)');
  // N-03 그림 자리는 2D 그림이 들어올 때까지 그리지 않음(2026-11-15 3차 검토, 회색 빈 자리 숨김)
  await expect(page.locator('.hg-noti__empty .hg-artslot')).toHaveCount(0);
  await axe(page);

  db.notifications.push(
    noti({
      id: '00000000-0000-4000-8000-000000000009',
      kind: 'care_day',
      title: '예산은 300,000원이에요',
      target: '/calendar/list',
      created_at: '2026-10-07T00:00:00Z',
    }),
  );
  if (info.project.name === 'narrow') {
    // 좁은 창은 머리에 눈 아이콘이 없고 설정(S-10) 스위치로(2026-11-03)
    await page.goto('/calendar/list');
    await expect(
      page.locator('.hg-frame__mhead').getByRole('button', { name: '금액 가리기' }),
    ).toHaveCount(0);
    await page.goto('/settings');
    await page.getByRole('switch', { name: /금액 가리기/ }).click();
    await expect(page.getByRole('switch', { name: /금액 가리기/ })).toBeChecked();
    await axe(page);
  } else {
    await page.goto('/calendar/list');
    await page.locator('.hg-appside').getByRole('button', { name: '금액 가리기' }).click();
  }
  await page.goto('/notifications');
  await expect(page.getByRole('complementary', { name: '알림' })).toContainText('예산은 •••이에요');
});

// 2026-11-12 QA 10구간: 같은 시각 알림도 더 불러오기에서 빠지지 않음(S10-13), 달성 줄은 아이콘 자리(S10-05),
// 문구 1줄 + 말줄임 + 툴팁(D4), 빈 상태 그림 자리(D2), Esc로 닫으면 종으로 포커스(S10-09), 오프라인 읽음은 연결되면 보냄(S10-14)
test('알림 센터: 같은 시각 더 불러오기, 달성 아이콘 자리, 1줄 말줄임, Esc 포커스, 오프라인 읽음', async ({
  page,
}, info) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  const narrow = info.project.name === 'narrow';
  // 같은 시각 31개(30개 경계에 걸림) + 맨 위 달성 알림(사람 + 아이콘)
  for (let i = 0; i < 31; i++)
    db.notifications.push(
      noti({
        id: `00000000-0000-4000-8000-${String(100 + i).padStart(12, '0')}`,
        kind: 'care_day',
        title: `경조사 ${i + 1}번이 한 달 남았어요`,
        target: '/calendar/list',
        icon: 'gift',
        read_at: '2026-10-01T00:00:00Z',
        created_at: '2026-10-01T00:00:00Z',
      }),
    );
  db.notifications.push(
    noti({
      id: '00000000-0000-4000-8000-000000000050',
      kind: 'goal_achieved',
      title: '우리 할머니 팔순 잔치와 가족 여행 겸 기념 행사 저축·투자 목표 금액을 다 모았어요',
      target: '/calendar/list',
      icon: 'trophy',
      actor_id: 'yebin',
      created_at: '2026-10-07T00:30:00Z',
    }),
  );

  await page.goto(narrow ? '/' : '/calendar/list');
  const bell = page
    .locator(narrow ? '.hg-frame__mhead' : '.hg-appside')
    .getByRole('button', { name: /^알림/ });
  await expect(bell).toHaveClass(/hg-iconbtn--dot/);
  if (narrow) await bell.click();
  else {
    await bell.focus();
    await page.keyboard.press('Enter');
  }
  const panel = page.getByRole('complementary', { name: '알림' });
  const first = panel.locator('.hg-noti__item').first();
  await expect(first).toContainText('목표 금액을 다 모았어요');
  await expect(first.locator('.hg-avatar')).toHaveCount(0);
  // 종류 그림 자리(trophy)는 그림이 들어올 때까지 없음: 글자가 왼쪽 끝부터(2026-11-15 3차 검토)
  await expect(first.locator('.hg-noti__icon, .hg-lead--slot')).toHaveCount(0);
  await expect(first).toHaveClass(/hg-noti__item--plain/);
  const msg = first.locator('.hg-noti__msg');
  await expect(msg).toHaveCSS('white-space', 'nowrap');
  await expect(msg).toHaveCSS('text-overflow', 'ellipsis');
  await expect(first).toHaveAttribute('title', /행사 저축·투자 목표 금액을 다 모았어요$/);
  expect(await first.evaluate((e) => Math.round(e.getBoundingClientRect().height))).toBe(64);

  // 끝까지 내리면 31개 모두(같은 시각이 빠지지 않음)
  await panel.locator('.hg-noti__item').nth(29).scrollIntoViewIfNeeded();
  await expect(panel.locator('.hg-noti__item')).toHaveCount(32);
  await expect(panel).toContainText('경조사 31번이 한 달 남았어요');

  if (!narrow) {
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(bell).toBeFocused();
    await bell.click();
  }

  // 오프라인에서 누르면 줄은 읽음으로 보이고, 연결되면 서버에 보냄
  await goOffline(page);
  await panel.locator('.hg-noti__item').first().click();
  await page.waitForTimeout(300);
  expect(db.notifications.find((n) => n.kind === 'goal_achieved')?.read_at ?? null).toBeNull();
  await goOnline(page);
  await expect
    .poll(() => db.notifications.find((n) => n.kind === 'goal_achieved')?.read_at ?? null)
    .not.toBeNull();
});

test('이전 값으로 돌리기(14 N-01·N-02, R-08): 돌릴 수 있는 변경 알림만 글자 버튼 → 돌림 + Toast, 그 뒤엔 없음', async ({
  page,
}, info) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  seedNotis(db);
  db.revertible = ['00000000-0000-4000-8000-000000000001'];
  const narrow = info.project.name === 'narrow';
  await page.goto(narrow ? '/notifications' : '/calendar/list');
  if (!narrow) await page.locator('.hg-appside').getByRole('button', { name: /^알림/ }).click();
  const undo = page.getByRole('button', { name: '이전 값으로 돌리기' });
  // 같이 쓰는 저금을 바꾼 알림 하나에만
  await expect(undo).toHaveCount(1);
  await axe(page);
  await undo.click();
  await expect(page.getByText('이전 값으로 돌렸어요')).toBeVisible();
  expect(db.reverted).toEqual(['00000000-0000-4000-8000-000000000001']);
  await expect(undo).toHaveCount(0);
  // 줄 자체는 그대로(누르면 그 화면)
  await expect(page.getByText('예빈님이 내 집 마련 저축·투자를 바꿨어요')).toBeVisible();
});

// 새 기기 로그인 알림(2026-11-26 사용자 결정, 15 A-08 5번): 로그인한 그 기기(링크 세션 = 지금 세션)에서는 목록·종 점에서 숨김,
// 다른 기기에서 로그인한 알림은 그대로(서버 RLS noti_hidden_here, 목업도 같은 규칙)
test('새 기기 알림: 로그인한 그 기기에서는 목록·점에 없음, 다른 기기 로그인 알림은 보임', async ({
  page,
}, info) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  const narrow = info.project.name === 'narrow';
  db.notifications.push(
    noti({
      id: '00000000-0000-4000-8000-0000000000d1',
      kind: 'new_device',
      title: '새 기기에서 로그인했어요',
      body: '본인이 아니면 바로 로그아웃해 주세요',
      target: '/new-device/s-this', // 지금 이 기기(my_sessions current)
      icon: 'shield-warning',
      created_at: '2026-10-07T00:50:00Z',
    }),
  );
  await page.goto(narrow ? '/' : '/calendar/list');
  const bell = page
    .locator(narrow ? '.hg-frame__mhead' : '.hg-appside')
    .getByRole('button', { name: /^알림/ });
  await expect(bell).toHaveAccessibleName('알림');
  await expect(bell).not.toHaveClass(/hg-iconbtn--dot/);
  await page.goto('/notifications');
  const panel = page.getByRole('complementary', { name: '알림' });
  await expect(panel.getByText('새 알림이 없어요')).toBeVisible();
  await expect(panel.getByText('새 기기에서 로그인했어요')).toHaveCount(0);
  // 다른 기기에서 로그인한 알림은 이 기기에 보임 + 점
  db.sessions.push({
    id: 's-new',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/130 Safari/537',
    created_at: '2026-10-07T00:55:00Z',
    last_used_at: '2026-10-07T00:55:00Z',
    current: false,
  });
  db.notifications.push(
    noti({
      id: '00000000-0000-4000-8000-0000000000d2',
      kind: 'new_device',
      title: '새 기기에서 로그인했어요',
      body: '본인이 아니면 바로 로그아웃해 주세요',
      target: '/new-device/s-new',
      icon: 'shield-warning',
      created_at: '2026-10-07T00:55:00Z',
    }),
  );
  await page.goto(narrow ? '/' : '/calendar/list');
  await expect(bell).toHaveClass(/hg-iconbtn--dot/);
  await page.goto('/notifications');
  await expect(panel.getByText('새 기기에서 로그인했어요')).toHaveCount(1);
  await panel.getByRole('button', { name: '모두 읽음' }).click();
  await expect(panel.getByRole('button', { name: '모두 읽음' })).toBeDisabled();
  expect(
    db.notifications.find((n) => n.id === '00000000-0000-4000-8000-0000000000d2')?.read_at,
  ).toBeTruthy();
  expect(
    db.notifications.find((n) => n.id === '00000000-0000-4000-8000-0000000000d1')?.read_at,
  ).toBeNull();
  await panel.getByText('새 기기에서 로그인했어요').click();
  await expect(page).toHaveURL(/\/new-device\/s-new$/);
  await expect(page.getByRole('button', { name: '내가 아니에요' })).toBeEnabled();
});
