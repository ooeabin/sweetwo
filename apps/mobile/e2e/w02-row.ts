import { expect, type Page } from '@playwright/test';

// W-02 줄(2026-11-23 C안): 상태 버튼 없이 줄 전체가 버튼. 화면 읽기 이름 “{이름} {금액}, 확인할 것 / 완료, 고치기 / 건너뜀, 고치기”.
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** 할 일 줄(이름 앞 오렌지 점 + ›) */
export const goRow = (page: Page, name: string) =>
  page.getByRole('button', { name: new RegExp(`^${esc(name)} [^,]+, 확인할 것$`) });
/** 끝남 줄(slate + ✓) */
export const doneRow = (page: Page, name: string) =>
  page.getByRole('button', { name: new RegExp(`^${esc(name)} [^,]+, 완료, 고치기$`) });
/** 건너뜀 줄(취소선 + –) */
export const skippedRow = (page: Page, name: string) =>
  page.getByRole('button', { name: new RegExp(`^${esc(name)} [^,]+, 건너뜀, 고치기$`) });
/** 할 일 줄을 눌러 시트에서 ‘계획대로 했어요’ */
export async function checkRow(page: Page, name: string) {
  await goRow(page, name).click();
  await page.getByRole('dialog').getByRole('button', { name: '계획대로 했어요' }).click();
}
/** 끝남 줄을 눌러 시트에서 ‘체크 풀기’ */
export async function uncheckRow(page: Page, name: string) {
  await doneRow(page, name).click();
  await page.getByRole('dialog').getByRole('button', { name: '체크 풀기' }).click();
}
export { expect };
