import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

// 브랜드 오렌지(#FF7716) 위 흰 글자는 대비 2.7:1로 WCAG AA 미달을 알고 씀(DESIGN.md 색).
// 그래서 주 버튼과 달성 배지의 color-contrast만 예외로 빼고, 나머지 규칙은 그대로 검사함.
const BRAND_FILL = /hg-btn--primary|hg-badge--achieved/;

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
