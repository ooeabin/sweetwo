import { test, expect } from '@playwright/test';
import { mockOnboarding, seed } from './mocks';

// 입력 고르기 토글(2026-11-24 사용자 결정): 회색 판 + 흰 알약(hg-seg) 없음, 고르기 버튼은 A 테두리 버튼(14:40 되돌림), 카드 줄은 F, 밑줄 글자 칸, 빠른 금액 칩은 고른 표시 없음. 휴대폰 크기, light.
test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const NOW = new Date('2026-10-07T10:00:00+09:00');

test('W-11: 고르기 버튼은 떨어진 테두리 버튼, 글자 칸은 밑줄, 빠른 금액 칩은 늘 회색', async ({ page }, info) => {
  test.skip(info.project.name !== 'light', '색 수치는 light만');
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/salary/items/new');
  const choice = page.locator('.hg-choice').first();
  await expect(choice).toBeVisible();
  await expect(page.locator('.hg-seg')).toHaveCount(0);
  const m = await page.evaluate(() => {
    const css = (e: Element | null) => getComputedStyle(e as HTMLElement);
    const box = document.querySelector('.hg-choice:not(.hg-choice--rows)');
    const sel = document.querySelector('.hg-choice:not(.hg-choice--rows) .hg-choice__item.is-on');
    const off = document.querySelector('.hg-choice:not(.hg-choice--rows) .hg-choice__item:not(.is-on)');
    const r0 = sel?.getBoundingClientRect();
    const r1 = off?.getBoundingClientRect();
    return {
      plateBg: css(box).backgroundColor,
      gap: r0 && r1 ? Math.abs(r1.left - r0.right) : -1,
      h: Math.round(r1?.height ?? 0),
      radius: css(off).borderTopLeftRadius,
      offBorder: css(off).borderTopWidth,
      offBorderColor: css(off).borderTopColor,
      offBg: css(off).backgroundColor,
      onBg: css(sel).backgroundColor,
      onBorder: css(sel).borderTopWidth,
      onBorderColor: css(sel).borderTopColor,
      onShadow: css(sel).boxShadow,
      onColor: css(sel?.querySelector('.hg-choice__label') ?? null).color,
      offColor: css(off?.querySelector('.hg-choice__label') ?? null).color,
      onWeight: css(sel?.querySelector('.hg-choice__label') ?? null).fontWeight,
      offWeight: css(off?.querySelector('.hg-choice__label') ?? null).fontWeight,
    };
  });
  // A 테두리 버튼: 판 없음, 칸 사이 8·높이 48·radius 12·흰 바탕, 안 고름 hairline 1px + 400, 고름 ink 테두리 + 안쪽 0.5px(합 1.5px) + 700, 오렌지 없음
  expect(m.plateBg).toBe('rgba(0, 0, 0, 0)');
  expect(m).toMatchObject({
    gap: 8, h: 48, radius: '12px', offBorder: '1px', offBg: 'rgb(255, 255, 255)', onBg: 'rgb(255, 255, 255)',
    onBorder: '1px', onWeight: '700', offWeight: '400',
  });
  expect(m.onBorderColor).not.toBe(m.offBorderColor);
  expect(m.onShadow).toContain('inset');
  expect(m.onShadow).not.toMatch(/255, 119, 22/);
  expect(m.onColor).not.toBe(m.offColor);
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
