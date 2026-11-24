import { test, expect, type Page } from '@playwright/test';
import { mockOnboarding, seed } from './mocks';

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

test('편집 모드 지우기는 회색 아이콘 버튼(44px, “{이름} 지우기”), 금액 줄 가운데·카드 오른쪽 끝', async ({
  page,
}) => {
  await open(page, '/salary/plan');
  await page.getByRole('button', { name: '편집하기' }).click();
  const del = page.getByRole('button', { name: '고정지출 지우기', exact: true });
  await expect(del).toBeVisible();
  await expect(del).not.toHaveText(/지우기/);
  const r = await del.evaluate((el) => {
    const b = el.getBoundingClientRect();
    const row = el.closest('.hg-receipt__row') as HTMLElement;
    const amt = row.querySelector('.hg-receipt__amt')?.getBoundingClientRect();
    const card = el.closest('.hg-plancard')?.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const ink2 = document.createElement('i');
    document.body.append(ink2);
    ink2.style.color = 'var(--ink-2)';
    const g = getComputedStyle(ink2).color;
    ink2.remove();
    return {
      w: b.width,
      h: b.height,
      cy: b.top + b.height / 2,
      ay: amt ? amt.top + amt.height / 2 : 0,
      right: b.right - 12,
      cardRight: card?.right ?? 0,
      color: cs.color,
      g,
      hasIcon: !!el.querySelector('.hg-ico--minus-circle'),
    };
  });
  expect(r.w).toBeGreaterThanOrEqual(44);
  expect(r.h).toBeGreaterThanOrEqual(44);
  expect(r.color).toBe(r.g);
  expect(r.hasIcon).toBe(true);
  expect(Math.abs(r.cy - r.ay)).toBeLessThanOrEqual(2);
  expect(r.right).toBeLessThanOrEqual(r.cardRight);
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

test('W-14 쓸 곳 메모가 비면 “+ 메모 추가”는 빈 상태 문구 바로 아래', async ({ page }) => {
  await open(page, '/salary/items/goal-h/notes', 844);
  const title = page.getByText('아직 메모가 없어요');
  await expect(title).toBeVisible();
  const add = page.getByRole('button', { name: /메모 추가/ });
  await expect(add).toBeVisible();
  const [a, b] = await Promise.all([title.boundingBox(), add.boundingBox()]);
  expect(a && b && b.y - (a.y + a.height)).toBeLessThan(80);
});
