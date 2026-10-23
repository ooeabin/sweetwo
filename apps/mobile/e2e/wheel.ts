import type { Page } from '@playwright/test';

/** 생년월일 휠(DateWheel)을 키보드로 맞춤: 줄마다 ↑↓를 차이만큼 누름 */
export async function setWheel(page: Page, label: string, y: number, m: number, d: number) {
  const group = page.getByRole('group', { name: label });
  for (const [name, want] of [
    ['년', y],
    ['월', m],
    ['일', d],
  ] as const) {
    const col = group.getByRole('spinbutton', { name, exact: true });
    await col.focus();
    for (let i = 0; i < 400; i++) {
      const now = Number(await col.getAttribute('aria-valuenow'));
      if (now === want) break;
      await col.press(now < want ? 'ArrowDown' : 'ArrowUp');
    }
  }
}
