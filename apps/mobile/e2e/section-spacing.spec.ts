import { test, expect, type Page } from '@playwright/test';
import { emptyV22, mockOnboarding, mockSaving, newSavingDb, seed } from './mocks';

// 영역 간격 기준(2026-11-24, DESIGN.md ‘영역 간격’): 대표 화면의 영역 사이를 getBoundingClientRect로 단언한다. 휴대폰 크기, light.
test.use({ viewport: { width: 390, height: 844 } });
const NOW = new Date('2026-10-07T10:00:00+09:00');

/** B.top − A.bottom (px, 소수 첫째 자리까지) */
async function gap(page: Page, a: string, b: string) {
  return page.evaluate(
    ([sa, sb]: [string, string]) => {
      const A = document.querySelector(sa);
      const B = document.querySelector(sb);
      if (!A || !B) return null;
      return Math.round((B.getBoundingClientRect().top - A.getBoundingClientRect().bottom) * 10) / 10;
    },
    [a, b] as [string, string],
  );
}

async function open(page: Page, path: string) {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  db.v22 = emptyV22();
  const sv = newSavingDb();
  await mockSaving(page, db, sv, String(db.me.id));
  await page.goto(path);
}

test('FormScreen(W-11): 섹션 사이 32, 제목과 내용 12, 띠 8 + 아래 첫 줄 12', async ({ page }) => {
  await open(page, '/salary/items/new');
  await expect(page.locator('.hg-form__sec').first()).toBeVisible();
  expect(await gap(page, '.hg-form__sec:nth-of-type(1)', '.hg-form__sec:nth-of-type(2)')).toBe(32);
  expect(
    await gap(page, '.hg-form__sec:nth-of-type(1) .hg-form__q', '.hg-form__sec:nth-of-type(1) .hg-form__chips'),
  ).toBe(12);
  const folds = page.locator('.hg-form__folds');
  await expect(folds).toBeVisible();
  const band = await page.evaluate(() => {
    const f = document.querySelector('.hg-form__folds') as HTMLElement;
    const r = f.getBoundingClientRect();
    const first = f.querySelector('.hg-form__fold') as HTMLElement;
    return { bandH: parseFloat(getComputedStyle(f, '::before').height), toRow: first.getBoundingClientRect().top - r.top - parseFloat(getComputedStyle(f, '::before').height) };
  });
  expect(band.bandH).toBe(8);
  expect(band.toRow).toBe(12);
});

test('W-02: hero 아래 32, 밑줄 탭 아래 24, 수입 줄 앞 32', async ({ page }) => {
  await open(page, '/salary');
  await expect(page.locator('.hg-w02hero')).toBeVisible();
  expect(await gap(page, '.hg-w02hero > :last-child', '.hg-linetabs')).toBe(32);
  expect(await gap(page, '.hg-linetabs', '.hg-checklist__list')).toBe(24);
  expect(await gap(page, '.hg-checklist__list', '.hg-incomeline')).toBe(32);
});

test('홈·W-01(회색 바탕): 상자 사이 16, 상자 안 위 24', async ({ page }) => {
  await open(page, '/salary/plan');
  await expect(page.locator('.hg-plancard').first()).toBeVisible();
  expect(await gap(page, '.hg-plancard:nth-of-type(1)', '.hg-plancard:nth-of-type(2)')).toBe(16);
  const inner = await page.evaluate(() => {
    const c = document.querySelector('.hg-plancard') as HTMLElement;
    return parseFloat(getComputedStyle(c).paddingTop);
  });
  expect(inner).toBe(24);
});

test('시트: 제목 아래 24, 영역 사이 24', async ({ page }) => {
  await open(page, '/');
  const sheetGap = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.className = 'hg-sheet';
    document.body.append(probe);
    const g = getComputedStyle(probe).rowGap;
    probe.remove();
    return g;
  });
  expect(sheetGap).toBe('24px');
});
