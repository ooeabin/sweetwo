import type { Page } from '@playwright/test';

/** 분석 이벤트(개발 빌드 콘솔 ‘[analytics]’)를 모음(2026-11-13 PR 14: 스펙마다 따로 있던 것을 하나로) */
export function events(page: Page) {
  const out: { name: string; props: Record<string, unknown> }[] = [];
  page.on('console', async (m) => {
    if (m.type() !== 'debug' || !m.text().startsWith('[analytics]')) return;
    const [, name, props] = await Promise.all(m.args().map((a) => a.jsonValue()));
    out.push({ name: String(name), props: (props ?? {}) as Record<string, unknown> });
  });
  return out;
}
