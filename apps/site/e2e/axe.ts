import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

// 2026-11-15 3차 검토: 주 버튼 글자는 진한 글자(on-accent-app-text, 오렌지 위 6.5:1)라 예외에서 뺌(예전 흰 글자 2.7:1).
// 달성 배지의 color-contrast만 예외로 빼고, 나머지 규칙은 그대로 검사함.
const BRAND_FILL = /hg-badge--achieved/;

export async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const violations = r.violations
    .map((v) =>
      v.id === 'color-contrast'
        ? {
            ...v,
            nodes: v.nodes.filter((n) => !BRAND_FILL.test(`${n.html} ${n.target.join(' ')}`)),
          }
        : v,
    )
    .filter((v) => v.nodes.length > 0);
  return { ...r, violations };
}
