import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { type MemDb, mockOnboarding } from './mocks';

// Avatar(docs/design/components/Avatar.md, 2026-11-24): 사진이 안 열리면 글자 원, S-12 두 원 겹침(−12, 뒤 원이 다 보임, 글자 안 잘림)

const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const NOW = new Date('2026-10-07T10:00:00+09:00');

function seed(db: MemDb, names: { me: string; partner: string }) {
  Object.assign(db.me, {
    nickname: names.me,
    side: 'groom',
    employment: 'regular',
    monthly_income: 3_500_000,
    payday: 25,
    payday_last: false,
    allowance: 500_000,
    onboarding_step: 'O-67',
    onboarding_done_at: '2026-09-20T01:00:00Z',
    space_id: 'space-1',
    avatar_path: 'space-1/chanwoo.jpg',
    avatar_updated_at: '2026-10-01T00:00:00Z',
  });
  db.space = {
    id: 'space-1',
    created_by: db.me.id,
    couple_state: 'connected',
    salary_mode: 'separate',
    joint_cycle_day: null,
    partner_nickname: names.partner,
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
    nickname: names.partner,
    side: 'bride',
    employment: 'regular',
    monthly_income: 2_500_000,
    payday: 10,
    payday_last: false,
    allowance: 500_000,
  };
}

// 사진 파일이 안 열리는 경우(주소 만료, 저장소 오류)
const breakPhotos = (page: Page) =>
  page.route(/\/storage\/v1\/object\/sign\/avatars\/.+/, (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({ status: 404, body: 'not found' })
      : route.fallback(),
  );

test('사진 주소가 안 열리면 깨진 그림 대신 글자 원: 설정 홈(S-10), 내 정보(S-11)', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db, { me: '은호', partner: '예빈' });
  await breakPhotos(page);

  await page.goto('/settings');
  const row = page.getByRole('button', { name: /^내 정보/ });
  await expect(row.locator('.hg-avatar')).toContainText('은호');
  await expect(row.locator('.hg-avatar img')).toHaveCount(0);
  await expect(row.locator('.hg-avatar--photo')).toHaveCount(0);

  await page.goto('/settings/me');
  const big = page.locator('.hg-avatar-edit .hg-avatar');
  await expect(big).toHaveClass(/hg-avatar--xl/);
  await expect(big).toHaveText('은호');
  await expect(big.locator('img')).toHaveCount(0);
  // 이니셜이 원 안에 가운데로 들어감(원 밖으로 넘치지 않음)
  const fit = await big.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(el);
    const t = range.getBoundingClientRect();
    return {
      w: box.width,
      h: box.height,
      inside:
        t.left >= box.left && t.right <= box.right && t.top >= box.top && t.bottom <= box.bottom,
      dx: Math.abs(t.left + t.width / 2 - (box.left + box.width / 2)),
      size: parseFloat(getComputedStyle(el).fontSize),
    };
  });
  expect(fit.w).toBe(72);
  expect(fit.h).toBe(72);
  expect(fit.inside).toBe(true);
  expect(fit.dx).toBeLessThan(1.5);
  expect(fit.size).toBeLessThanOrEqual(72 * 0.4);
  await axe(page);
});

test('사진이 열리면 사진, 열리지 않으면 글자 원(같은 화면 안에서 바뀜)', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db, { me: '은호', partner: '예빈' });
  await page.goto('/settings/me');
  const big = page.locator('.hg-avatar-edit .hg-avatar');
  await expect(big.locator('img')).toHaveCount(1);
  await expect(big).toHaveClass(/hg-avatar--photo/);
  await expect(big.locator('img')).toHaveAttribute('alt', '은호');
});

for (const [label, patch, invite] of [
  ['연결됨', {}, false],
  ['연결 해제 대기', { couple_state: 'unlink_pending' }, false],
  ['초대 중', { couple_state: 'not_joined' }, true],
] as const) {
  for (const names of [
    { me: '찬우', partner: '예빈' },
    { me: '김찬우', partner: '윤예빈' },
  ]) {
    test(`우리 둘(S-12) ${label}, ${names.me} ${names.partner}: 두 원 −12 겹침, 뒤 원이 다 보이고 글자가 안 잘림`, async ({
      page,
    }) => {
      await page.clock.setFixedTime(NOW);
      const db = await mockOnboarding(page, { now: NOW });
      seed(db, names);
      db.me.avatar_path = null;
      Object.assign(db.space ?? {}, patch);
      if (invite)
        db.invites.push({
          code: 'K7M2QX',
          expires_at: '2026-10-22T00:00:00Z',
          used_at: null,
          reserved_by: null,
          reserved_until: null,
        });
      if (label === '연결 해제 대기')
        db.unlinks.push({
          id: 'u1',
          space_id: 'space-1',
          requested_by: db.me.id,
          requested_at: '2026-10-05T01:00:00Z',
          deadline: '2026-10-19',
          ratio: 50,
          plan: [],
          status: 'pending',
          cancelled_at: null,
          confirmed_at: null,
        });
      await page.goto('/settings/couple');
      const stack = page.locator('.hg-avatars--lap');
      await expect(stack).toBeVisible();
      const m = await stack.evaluate((el) => {
        const [a, b] = [...el.querySelectorAll<HTMLElement>('.hg-avatar')];
        if (!a || !b) return null;
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        const text = (e: HTMLElement) => {
          const r = document.createRange();
          r.selectNodeContents(e);
          return r.getBoundingClientRect();
        };
        const ta = text(a);
        const tb = text(b);
        const px = (e: HTMLElement) => parseFloat(getComputedStyle(e).fontSize);
        return {
          size: [ra.width, rb.width],
          overlap: ra.right - rb.left,
          topIsSecond: document.elementFromPoint(rb.left + 3, rb.top + rb.height / 2) === b,
          ring: getComputedStyle(b).boxShadow,
          // 앞 원 글자: 뒤 원 고리(2px) 왼쪽까지만, 뒤 원 글자: 자기 원 안
          aVisible: ta.left >= ra.left && ta.right <= rb.left - 2,
          bInside: tb.left >= rb.left && tb.right <= rb.right,
          fonts: [px(a), px(b)],
        };
      });
      expect(m).not.toBeNull();
      expect(m?.size).toEqual([40, 40]);
      expect(m?.overlap).toBe(12);
      expect(m?.topIsSecond).toBe(true);
      expect(m?.ring).toMatch(/0px 0px 0px 2px/);
      expect(m?.aVisible).toBe(true);
      expect(m?.bInside).toBe(true);
      for (const f of m?.fonts ?? []) expect(f).toBeGreaterThanOrEqual(8);
      await axe(page);
    });
  }
}
