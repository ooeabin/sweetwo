import { expect, type Page } from '@playwright/test';

// W-01 머리 오른쪽 ⋯(화면 읽기 “더 보기”, 2026-11-26 ‘W-01 정리 A안’): 편집, 통장 잔액과 맞추기, 수입 기록, 공유하기, 추천값으로 다시 채우기
export const planMore = (page: Page) => page.getByRole('button', { name: '더 보기', exact: true });

/** ⋯ 메뉴를 열어 항목 하나를 누름 */
export async function planAction(page: Page, name: string) {
  await planMore(page).click();
  await page.getByRole('menuitem', { name, exact: true }).click();
}

/** ⋯ 메뉴 항목 글자(⋯가 없으면 빈 목록). 열었다가 Esc로 닫음 */
export async function planItems(page: Page): Promise<string[]> {
  await expect(page.locator('.hg-plancard').first()).toBeVisible();
  if ((await planMore(page).count()) === 0) return [];
  await planMore(page).click();
  const items = await page.getByRole('menuitem').allTextContents();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  return items;
}
