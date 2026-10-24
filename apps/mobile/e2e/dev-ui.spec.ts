import { test, expect } from '@playwright/test';
import { axe } from './axe';

// 컴포넌트 모음(/dev/ui)이 오류 없이 뜨고, 계산 예시(W-04g)가 기획서와 같고, 접근성 위반이 없는지.
test('컴포넌트 모음', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto('/dev/ui');
  await expect(page.getByRole('heading', { name: '소득의 59.3%를 썼어요' })).toBeVisible();

  const a11y = await axe(page);
  expect(a11y.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);

  await page.screenshot({ path: info.outputPath('dev-ui.png'), fullPage: true });
  expect(errors).toEqual([]);
});
