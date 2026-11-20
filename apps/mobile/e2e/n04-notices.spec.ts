import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { mockOnboarding, seed } from './mocks';

// N-04 공지(docs/spec/14-notifications.md, 2026-11-16): 서랍 ‘공지’와 홈 공지 띠 ‘보기’가 들어오는 앱 안 공지 화면.
// 지금 노출 중인 공지 + 끝난 지 90일 안 지난 공지, 줄 = 제목 + 날짜, 눌러 펼침, 빈 상태는 문구만
const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const NOW = new Date('2026-10-07T10:00:00+09:00');
const SHOTS = process.env.NOTICE_SHOTS; // 있으면 이 폴더에 화면을 찍음(사람 확인용)

const NOTICES: Record<string, unknown>[] = [
  {
    id: 'n-now',
    kind: 'info',
    title: '10월 20일 새벽 점검',
    body: '오전 2시부터 4시까지 저장이 안 돼요.\n미리 저장해 주세요.',
    importance: 'normal',
    platforms: ['mobile'],
    starts_at: '2026-10-05T00:00:00Z',
    ends_at: '2026-10-21T00:00:00Z',
    active: true,
  },
  {
    id: 'n-past',
    kind: 'info',
    title: '새 기능 안내',
    body: '월급날 확인 목록이 생겼어요.',
    importance: 'normal',
    platforms: ['mobile'],
    starts_at: '2026-09-01T00:00:00Z',
    ends_at: '2026-09-10T00:00:00Z',
    active: false,
  },
];

async function open(page: Page, notices: Record<string, unknown>[] = NOTICES) {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  db.notices.push(...notices);
  return db;
}

test('공지 목록: 노출 중 + 지난 공지(최근 순), 줄 = 제목 + 날짜, 눌러 본문 펼침, axe', async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  await open(page);
  await page.goto('/notices');
  await expect(page.getByRole('heading', { name: '공지', level: 1 })).toBeVisible();
  const rows = page.locator('.hg-acc__q');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('10월 20일 새벽 점검');
  await expect(rows.nth(0)).toContainText('10월 5일');
  await expect(rows.nth(0)).toContainText('새 공지'); // 안 읽음(화면 읽기 글자)
  await expect(rows.nth(1)).toContainText('새 기능 안내');
  await expect(rows.nth(1)).toContainText('9월 1일 (끝난 공지)');
  await expect(rows.nth(1).locator('.hg-acc__dot')).toHaveCount(0); // 지난 공지는 점 없음
  // 펼치기 전 본문은 숨김, 누르면 보임(줄바꿈 그대로) + 읽음이라 점이 꺼짐
  await expect(page.getByText('오전 2시부터 4시까지')).toBeHidden();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/list-${info.project.name}.png` });
  await rows.nth(0).click();
  await expect(rows.nth(0)).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('오전 2시부터 4시까지')).toBeVisible();
  await expect(rows.nth(0).locator('.hg-acc__dot')).toHaveCount(0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/open-${info.project.name}.png` });
  await axe(page);
});

test('홈 공지 띠 ‘보기’ → N-04에서 그 공지가 펼쳐진 채 열림. ‹은 온 곳(홈)으로', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const db = await open(page, [{ ...NOTICES[0], importance: 'must' }]);
  await page.goto('/');
  await expect(db.notices).toHaveLength(1);
  const band = page.locator('.hg-banner--line');
  await expect(band).toContainText('10월 20일 새벽 점검');
  await band.getByRole('button', { name: '보기' }).click();
  await expect(page).toHaveURL(/\/notices\?open=n-now$/);
  await expect(page.locator('.hg-acc__q').first()).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('미리 저장해 주세요.')).toBeVisible();
  await page.getByRole('button', { name: '뒤로' }).first().click();
  await expect(page).toHaveURL(/\/$/);
});

test('홈 공지 띠 높이: 제목 한 줄이면 52px 이하(할 일 띠와 같거나 낮게), 버튼 누르는 칸은 44px 이상', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'light');
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await page.goto('/');
  const band = page.locator('.hg-banner--line');
  await expect(band).toContainText('10월 20일 새벽 점검');
  const box = await band.boundingBox();
  expect(box?.height ?? 99).toBeLessThanOrEqual(52);
  const todo = page.locator('.hg-hubband');
  if (await todo.count())
    expect(box?.height ?? 99).toBeLessThanOrEqual((await todo.boundingBox())?.height ?? 0);
  // 보이는 버튼은 작아도 누르는 칸(::after)은 44px 이상
  for (const name of ['보기', '닫기']) {
    const hit = await band.getByRole('button', { name }).evaluate((el) => {
      const r = el.getBoundingClientRect();
      const a = getComputedStyle(el, '::after');
      return {
        h: Math.max(r.height, parseFloat(a.height) || 0),
        w: Math.max(r.width, parseFloat(a.width) || 0),
      };
    });
    expect(hit.h).toBeGreaterThanOrEqual(44);
    expect(hit.w).toBeGreaterThanOrEqual(44);
  }
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/band.png` });
});

test('공지가 없으면 “지금은 공지가 없어요”만(할 일 버튼 없음)', async ({ page }, info) => {
  test.setTimeout(120_000);
  await open(page, []);
  await page.goto('/notices');
  await expect(page.getByText('지금은 공지가 없어요')).toBeVisible();
  await expect(page.locator('.hg-empty button')).toHaveCount(0);
  // 2026-11-20 빈 목록 안내 글자는 slate(라이트 rgb(84, 85, 87))
  if (info.project.name === 'light')
    await expect(page.getByText('지금은 공지가 없어요')).toHaveCSS('color', 'rgb(84, 85, 87)');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/empty-${info.project.name}.png` });
  await axe(page);
  // 바로 열렸을 때 ‹은 홈으로
  await page.getByRole('button', { name: '뒤로' }).first().click();
  await expect(page).toHaveURL(/\/$/);
});

test('서랍 ‘공지’: 안 읽은 공지가 있으면 점, 읽으면 점 없음, 지난 공지만 있어도 줄은 보임', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'narrow');
  test.setTimeout(120_000);
  await open(page, NOTICES);
  await page.goto('/');
  await expect(page.locator('.hg-together, .hg-hubtile').first()).toBeVisible();
  const menuBtn = page.getByRole('button', { name: '메뉴', exact: true });
  const drawer = page.getByRole('dialog', { name: '메뉴' });
  await menuBtn.click();
  await expect(drawer.locator('.hg-drawer__dot')).toHaveCount(1);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/drawer-dot-${info.project.name}.png` });
  await drawer.getByRole('button', { name: /^공지/ }).click();
  await expect(page).toHaveURL(/\/notices$/);
  await page.locator('.hg-acc__q').first().click(); // 읽음
  await page.goto('/');
  await expect(page.locator('.hg-together, .hg-hubtile').first()).toBeVisible();
  await menuBtn.click();
  await expect(drawer.getByRole('button', { name: '공지', exact: true })).toBeVisible();
  await expect(drawer.locator('.hg-drawer__dot')).toHaveCount(0);
});

test('서랍 ‘공지’: 지난 공지만 있어도 줄은 보이고 점은 없음. 공지가 하나도 없으면 줄 없음', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'narrow');
  test.setTimeout(120_000);
  const db = await open(page, [NOTICES[1] ?? {}]);
  await page.goto('/');
  await expect(page.locator('.hg-together, .hg-hubtile').first()).toBeVisible();
  const menuBtn = page.getByRole('button', { name: '메뉴', exact: true });
  const drawer = page.getByRole('dialog', { name: '메뉴' });
  await menuBtn.click();
  await expect(drawer.getByRole('button', { name: '공지', exact: true })).toBeVisible();
  await expect(drawer.locator('.hg-drawer__dot')).toHaveCount(0);
  await page.keyboard.press('Escape');
  db.notices.length = 0;
  await page.goto('/');
  await expect(page.locator('.hg-together, .hg-hubtile').first()).toBeVisible();
  await menuBtn.click();
  await expect(drawer.getByRole('button', { name: '공지' })).toHaveCount(0);
});

test('서랍 ‘공지’ 점 회귀(2026-11-20): 읽은 공지가 있어도 안 읽은 공지가 있으면 점, 모두 읽으면 점 없음, 홈 공지 띠와 같이 있어도 점', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'narrow');
  test.setTimeout(120_000);
  await open(page, [
    NOTICES[0] ?? {},
    { ...(NOTICES[0] ?? {}), id: 'n-new', title: '새 기능 안내 2' },
  ]);
  await page.goto('/');
  await expect(page.locator('.hg-banner--line')).toBeVisible();
  const menuBtn = page.getByRole('button', { name: '메뉴', exact: true });
  const drawer = page.getByRole('dialog', { name: '메뉴' });
  await menuBtn.click();
  await expect(drawer.getByRole('button', { name: /^공지/ })).toContainText('새 공지');
  await expect(drawer.locator('.hg-drawer__dot')).toHaveCount(1);
  // 하나만 읽음(홈 띠 ‘보기’ → N-04에서 펼쳐짐) → 다른 새 공지가 있어 점은 그대로
  await page.keyboard.press('Escape');
  await page.goto('/notices?open=n-now');
  await expect(page.locator('.hg-acc__q').first()).toHaveAttribute('aria-expanded', 'true');
  await page.goto('/');
  await expect(page.locator('.hg-together, .hg-hubtile').first()).toBeVisible();
  await menuBtn.click();
  await expect(drawer.locator('.hg-drawer__dot')).toHaveCount(1);
  // 나머지도 읽으면 점 없음
  await drawer.getByRole('button', { name: /^공지/ }).click();
  await page.locator('.hg-acc__q', { hasText: '새 기능 안내 2' }).click();
  await page.goto('/');
  await expect(page.locator('.hg-together, .hg-hubtile').first()).toBeVisible();
  await menuBtn.click();
  await expect(drawer.getByRole('button', { name: '공지', exact: true })).toBeVisible();
  await expect(drawer.locator('.hg-drawer__dot')).toHaveCount(0);
});
