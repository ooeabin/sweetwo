import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

// 웹사이트는 color-contrast를 포함해 예외 없이 검사함(주 버튼 글자는 진한 글자라 2026-11-15부터 예외 없음, 달성 배지는 웹사이트에 없음).
export async function axe(page: Page) {
  return new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
}
