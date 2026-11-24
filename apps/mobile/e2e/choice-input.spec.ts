import { test, expect } from '@playwright/test';
import { mockOnboarding, seed } from './mocks';

// 입력 고르기 토글(2026-11-24 사용자 결정): 회색 판 + 흰 알약(hg-seg) 없음, 테두리 버튼 A 수치, 밑줄 글자 칸, 빠른 금액 칩은 고른 표시 없음. 휴대폰 크기, light.
test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const NOW = new Date('2026-10-07T10:00:00+09:00');

test('W-11: 고르기는 테두리 버튼 A 수치, 글자 칸은 밑줄, 빠른 금액 칩은 늘 회색', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/salary/items/new');
  const choice = page.locator('.hg-choice').first();
  await expect(choice).toBeVisible();
  await expect(page.locator('.hg-seg')).toHaveCount(0);
  const m = await page.evaluate(() => {
    const els = [...document.querySelectorAll('.hg-choice:not(.hg-choice--rows) .hg-choice__item')] as HTMLElement[];
    const css = (e: HTMLElement) => getComputedStyle(e);
    const sel = els.find((e) => e.classList.contains('is-on'))!;
    const off = els.find((e) => !e.classList.contains('is-on'))!;
    const gap = els.length > 1 ? els[1].getBoundingClientRect().left - els[0].getBoundingClientRect().right : 0;
    return {
      h: Math.round(off.getBoundingClientRect().height),
      radius: css(off).borderTopLeftRadius,
      offBorder: css(off).borderTopWidth,
      onBorder: css(sel).borderTopWidth,
      onShadow: css(sel).boxShadow.replace(/rgb\([^)]*\)\s*/, ''),
      onWeight: css(sel.querySelector('.hg-choice__label') as HTMLElement).fontWeight,
      offWeight: css(off.querySelector('.hg-choice__label') as HTMLElement).fontWeight,
      gap,
    };
  });
  expect(m).toMatchObject({ h: 48, radius: '12px', offBorder: '1px', onBorder: '1px', onShadow: '0px 0px 0px 0.5px', onWeight: '700', offWeight: '400', gap: 8 });
  // 직접 정하기 → 이름 칸은 테두리 상자가 아니라 아래 2px 밑줄
  await page.getByRole('button', { name: '직접 정하기', exact: true }).click();
  const name = page.getByLabel('이름', { exact: true });
  await expect(name).toBeVisible();
  const u = await name.evaluate((e) => {
    const c = getComputedStyle(e);
    return { top: c.borderTopWidth, left: c.borderLeftWidth, bottom: c.borderBottomWidth, radius: c.borderTopLeftRadius };
  });
  expect(u).toEqual({ top: '0px', left: '0px', bottom: '2px', radius: '0px' });
  // 빠른 금액 칩(10만 원)은 눌러도 고른 표시·aria-pressed 없음
  const quick = page.getByRole('group', { name: /빠른 금액/ }).getByRole('button', { name: '10만 원' });
  await quick.click();
  await expect(page.locator('.hg-quick .is-selected')).toHaveCount(0);
  await expect(quick).not.toHaveAttribute('aria-pressed', /.*/);
});
