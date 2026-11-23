import { test, expect, type Page } from '@playwright/test';
import { mockOnboarding, seed } from './mocks';

// 구역 2 W-01 화면 고침(2026-11-23): 긴 시트의 ‘확인’이 화면 안, ⋯ 팝오버가 화면 안, 새 줄 강조 2초 + 시트는 그 뒤,
// 편집 모드 ‘지우기’ 회색. 휴대폰 크기(375x640)에서 확인한다.
const NOW = new Date('2026-10-07T10:00:00+09:00');

async function open(page: Page, url: string, h = 640) {
  await page.setViewportSize({ width: 375, height: h });
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto(url);
  return db;
}

test('줄 고치기 시트가 낮은 화면보다 길어도 ‘확인’은 화면 안(본문만 스크롤)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); // 올라오는 움직임이 끝난 자리로 잼
  await open(page, '/salary/plan', 420);
  await page.getByRole('button', { name: /^고정지출/ }).click();
  const sheet = page.getByRole('dialog', { name: '고정지출 금액' });
  await expect(sheet).toBeVisible();
  const ok = sheet.getByRole('button', { name: '확인', exact: true });
  await expect(ok).toBeVisible();
  const r = await page.evaluate(() => {
    const s = document.querySelector('.hg-sheet')?.getBoundingClientRect();
    const b = document.querySelector('.hg-sheet__actions button')?.getBoundingClientRect();
    const body = document.querySelector('.hg-sheet__body');
    return {
      vh: window.innerHeight,
      sheetTop: s?.top ?? -1,
      sheetBottom: s?.bottom ?? 9999,
      btnBottom: b?.bottom ?? 9999,
      scrolls: !!body && body.scrollHeight > body.clientHeight,
    };
  });
  expect(r.sheetTop).toBeGreaterThanOrEqual(0);
  expect(r.sheetBottom).toBeLessThanOrEqual(r.vh + 1);
  expect(r.btnBottom).toBeLessThanOrEqual(r.vh);
  expect(r.scrolls).toBe(true);
});

test('저축·투자 ⋯ 팝오버는 화면 왼쪽·오른쪽 안에 들어옴', async ({ page }) => {
  await open(page, '/salary/plan');
  await page.getByRole('button', { name: '더보기' }).click();
  const menu = page.getByRole('menu', { name: '더보기' });
  await expect(menu).toBeVisible();
  const r = await menu.evaluate((el) => {
    const b = el.getBoundingClientRect();
    return { l: b.left, r: b.right, w: document.documentElement.clientWidth };
  });
  expect(r.l).toBeGreaterThanOrEqual(0);
  expect(r.r).toBeLessThanOrEqual(r.w);
});

test('새 줄 강조: 옅은 오렌지 2초 뒤 사라지고, “같이 모을까요?” 시트는 그 뒤에', async ({
  page,
}) => {
  await open(page, '/salary/plan?new=goal-h&ask=invite');
  const row = page.locator('.hg-receipt__row.is-new');
  await expect(row).toHaveCount(1);
  const bg = await row.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).not.toBe('rgba(0, 0, 0, 0)');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(row).toHaveCount(0, { timeout: 5000 });
  await expect(page.getByRole('dialog')).toHaveCount(1, { timeout: 3000 });
});

test('새 줄 강조: ‘동작 줄이기’면 애니메이션 없이 표시', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, '/salary/plan?new=goal-h');
  const row = page.locator('.hg-receipt__row.is-new');
  await expect(row).toHaveCount(1);
  expect(await row.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  expect(await row.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(
    'rgba(0, 0, 0, 0)',
  );
  await expect(row).toHaveCount(0, { timeout: 5000 });
});

test('편집 모드 ‘지우기’는 빨강이 아닌 회색 글자 버튼', async ({ page }) => {
  await open(page, '/salary/plan');
  await page.getByRole('button', { name: '편집하기' }).click();
  const del = page.getByRole('button', { name: '고정지출 지우기' });
  await expect(del).toBeVisible();
  const done = page.getByRole('button', { name: '완료' }).first();
  const [a, b] = await Promise.all([
    del.evaluate((el) => getComputedStyle(el).color),
    done.evaluate((el) => getComputedStyle(el).color),
  ]);
  expect(a).toBe(b);
  await expect(del).not.toHaveClass(/danger/);
});
