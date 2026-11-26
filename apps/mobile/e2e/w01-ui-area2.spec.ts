import { test, expect, type Page } from '@playwright/test';
import { mockOnboarding, seed } from './mocks';
import { planAction } from './plan-menu';

// 구역 2 W-01 화면 고침(2026-11-23): 긴 시트의 ‘확인’이 화면 안, ⋯ 팝오버가 화면 안, 새 항목 강조 2초 + 시트는 그 뒤,
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

test('머리 ⋯ 팝오버는 화면 왼쪽·오른쪽 안에 들어옴', async ({ page }) => {
  await open(page, '/salary/plan');
  await page.getByRole('button', { name: '더 보기' }).click();
  const menu = page.getByRole('menu', { name: '더 보기' });
  await expect(menu).toBeVisible();
  const r = await menu.evaluate((el) => {
    const b = el.getBoundingClientRect();
    return { l: b.left, r: b.right, w: document.documentElement.clientWidth };
  });
  expect(r.l).toBeGreaterThanOrEqual(0);
  expect(r.r).toBeLessThanOrEqual(r.w);
});

test('새 항목 강조: 바탕·여백은 그대로, 이름·금액 글자만 2초간 오렌지, “같이 모을까요?” 시트는 그 뒤에', async ({
  page,
}) => {
  await open(page, '/salary/plan?new=goal-h&ask=invite');
  const row = page.locator('.hg-receipt__row.is-new');
  await expect(row).toHaveCount(1);
  const before = await row.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const main = el.querySelector('.hg-receipt__main')?.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      bg: cs.backgroundColor,
      pad: cs.padding,
      h: r.height,
      mainLeft: main?.left,
      name: getComputedStyle(el.querySelector('.hg-receipt__name') as Element).color,
      amt: getComputedStyle(el.querySelector('.hg-receipt__amt') as Element).color,
      accent: (() => {
        const p = document.createElement('i');
        document.body.append(p);
        p.style.color = 'var(--accent-app-text)';
        const c = getComputedStyle(p).color;
        p.remove();
        return c;
      })(),
    };
  });
  expect(before.bg).toBe('rgba(0, 0, 0, 0)');
  expect(before.pad).toBe('0px');
  expect(before.name).toBe(before.amt);
  expect(before.name).toBe(before.accent);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(row).toHaveCount(0, { timeout: 5000 });
  await expect(page.getByRole('dialog')).toHaveCount(1, { timeout: 3000 });
});

test('새 항목 강조: ‘동작 줄이기’면 전환 없이 오렌지 글자 2초 뒤 원래대로', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, '/salary/plan?new=goal-h');
  const row = page.locator('.hg-receipt__row.is-new');
  await expect(row).toHaveCount(1);
  const name = row.locator('.hg-receipt__name');
  expect(await name.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  expect(await row.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
  const orange = await name.evaluate((el) => getComputedStyle(el).color);
  await expect(row).toHaveCount(0, { timeout: 5000 });
  const ink = await page
    .locator('.hg-receipt__name')
    .first()
    .evaluate((el) => getComputedStyle(el).color);
  expect(ink).not.toBe(orange);
});

test('요약 문장의 퍼센트는 accent-app-text 오렌지(brand-ink 아님)', async ({ page }) => {
  await open(page, '/salary/plan');
  const r = await page.locator('.hg-plansum__title em').evaluate((el) => {
    const probe = document.createElement('i');
    document.body.append(probe);
    probe.style.color = 'var(--accent-app-text)';
    const a = getComputedStyle(probe).color;
    probe.style.color = 'var(--brand-ink)';
    const b = getComputedStyle(probe).color;
    probe.remove();
    return { c: getComputedStyle(el).color, a, b };
  });
  expect(r.c).toBe(r.a);
  expect(r.c).not.toBe(r.b);
});

test('순서 바꾸기(2026-11-26): 줄 지우기 버튼 없음, 머리 오른쪽 ‘완료’는 ⋯와 같은 자리·높이·글자 모양', async ({
  page,
}) => {
  await open(page, '/salary/plan');
  const narrow = (page.viewportSize()?.width ?? 1280) < 768;
  const more = page.getByRole('button', { name: '더 보기', exact: true });
  const mb = await more.boundingBox();
  await planAction(page, '순서 바꾸기');
  await expect(page.locator('.hg-receipt__del')).toHaveCount(0);
  await expect(more).toHaveCount(0);
  const done = page.getByRole('button', { name: '완료', exact: true });
  await expect(done).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  const db = await done.boundingBox();
  if (!mb || !db) throw new Error('no box');
  // 오른쪽 끝·세로 가운데·높이가 같아 버튼이 튀거나 옮겨지지 않음
  expect(Math.round(db.x + db.width)).toBe(Math.round(mb.x + mb.width));
  expect(Math.abs(db.y + db.height / 2 - (mb.y + mb.height / 2))).toBeLessThanOrEqual(1);
  if (narrow) {
    expect(Math.round(db.height)).toBe(Math.round(mb.height));
    // 머리 오른쪽 글자 동작(hg-headaction): 15/400 ink-2, 글자 끝 = 화면 오른쪽 24
    await expect(done).toHaveClass(/hg-headaction/);
    await expect(done).toHaveCSS('font-size', '15px');
    await expect(done).toHaveCSS('font-weight', '400');
    const end = await done.evaluate((b) => {
      const r = document.createRange();
      r.selectNodeContents(b);
      return Math.round(r.getBoundingClientRect().right);
    });
    expect(end).toBe((page.viewportSize()?.width ?? 0) - 24);
  }
  await done.click();
  await expect(more).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  const mb2 = await more.boundingBox();
  expect(mb2).toEqual(mb);
});

test('금액 시트의 빨간 버튼은 “항목 지우기”', async ({ page }) => {
  await open(page, '/salary/plan');
  await page.getByRole('button', { name: /^고정지출/ }).click();
  const sheet = page.getByRole('dialog', { name: '고정지출 금액' });
  const del = sheet.getByRole('button', { name: '고정지출 항목 지우기' });
  await expect(del).toBeVisible();
  await expect(del).toHaveText('항목 지우기');
  await expect(sheet.getByText('줄 지우기')).toHaveCount(0);
});

test('W-14 쓸 곳 메모가 비면 “메모 추가”는 아래 고정 주 버튼(2026-11-26 빈 상태 A안)', async ({
  page,
}) => {
  await open(page, '/salary/items/goal-h/notes', 844);
  const title = page.getByText('아직 메모가 없어요');
  await expect(title).toBeVisible();
  // 버튼은 하나(아래 고정 바), 목록 아래 AddRow는 없음
  await expect(page.getByRole('button', { name: /메모 추가/ })).toHaveCount(1);
  const add = page.locator('.hg-stickybar').getByRole('button', { name: '메모 추가' });
  await expect(add).toBeVisible();
  await expect(add).toHaveClass(/hg-btn--primary/);
  const b = await add.boundingBox();
  expect((b?.y ?? 0) + (b?.height ?? 0)).toBeGreaterThan(844 - 120);
});
