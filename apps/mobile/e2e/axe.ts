import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

// 브랜드 오렌지(#FF7716) 위 흰 글자는 대비 2.7:1로 WCAG AA 미달을 알고 씀(DESIGN.md 색).
// 그래서 주 버튼과 달성 배지의 color-contrast만 예외로 빼고, 나머지 규칙은 그대로 검사함.
const BRAND_FILL = /hg-btn--primary|hg-badge--achieved/;

// 2026-11-09 브랜드 색 규칙(당근처럼 오렌지 하나): 흰 바탕 위 오렌지 글자(약 2.7:1)도 알고 씀.
// 예외는 14px 이상 + 600 이상의 짧은 강조 숫자, 띠 안 흰 작은 버튼, 고른 바꾸기 칩만(2026-11-09 글자 버튼은 모두 회색이라 예외 없음. tokens.css `--brand` 주석, DESIGN.md 색, CLAUDE.md 브랜드 색).
// 체크 원, 진행 원·막대, + 버튼(FAB)은 글자가 없는 그래픽이라 axe color-contrast 대상이 아님.
// 이 선택자에 걸리는 요소(또는 그 안의 글자)만 color-contrast에서 뺌. 나머지 규칙과 요소는 그대로 검사함.
const ORANGE_TEXT = [
  '.hg-sechead__count b', // “저금 1/2”의 한 개수
  '.hg-amountin > .hg-quick > .hg-chip.is-selected', // 고른 바꾸기 칩(W-11b)
  ':is(.hg-banner--todo, .hg-banner--line) .hg-btn--secondary', // 띠 안 흰 작은 버튼의 오렌지 글자
].join(', ');

export async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const violations = await Promise.all(
    r.violations.map(async (v) => {
      if (v.id !== 'color-contrast') return v;
      const keep = await Promise.all(
        v.nodes.map(async (n) => {
          if (BRAND_FILL.test(`${n.html} ${n.target.join(' ')}`)) return false;
          const sel = n.target.length === 1 ? n.target[0] : undefined;
          if (typeof sel !== 'string') return true;
          const orange = await page
            .evaluate(([s, o]) => !!document.querySelector(s)?.closest(o), [
              sel,
              ORANGE_TEXT,
            ] as const)
            .catch(() => false);
          return !orange;
        }),
      );
      return { ...v, nodes: v.nodes.filter((_, i) => keep[i]) };
    }),
  );
  return { ...r, violations: violations.filter((v) => v.nodes.length > 0) };
}
