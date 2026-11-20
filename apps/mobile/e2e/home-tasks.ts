import { expect, type Locator, type Page } from '@playwright/test';

// 홈 할 일 띠(19 ‘띠 하나로 묶기’, 2026-11-16 4차 검토): 할 일이 하나면 그 띠, 둘 이상이면 띠 하나(첫 할 일 문장 + “+n”, 읽기 이름 “할 일 n개”) → 목록 시트(“할 일”)

// 묶음 띠(2026-11-20): 가장 앞선 할 일 문장 + 오른쪽 “+n”, 화면 읽기 이름은 “할 일 n개”
const isGroup = async (band: Locator) => (await band.locator('.hg-hubband__more').count()) > 0;

/** 할 일 하나를 누를 곳: 띠가 하나면 그 띠, 둘이면 “할 일 n개” 띠를 눌러 연 시트의 그 줄 */
export async function homeTask(page: Page, text: string): Promise<Locator> {
  const band = page.locator('.hg-hubband').first();
  await expect(band).toBeVisible();
  if (!(await isGroup(band))) return band;
  await band.click();
  return page.getByRole('dialog', { name: '할 일' }).getByRole('button', { name: text });
}

/** 지금 홈 할 일 문장들(시트를 열었으면 닫고 돌아옴) */
export async function homeTaskTexts(page: Page): Promise<string[]> {
  const band = page.locator('.hg-hubband').first();
  await expect(band).toBeVisible();
  if (!(await isGroup(band))) return [(await band.innerText()).trim()];
  await band.click();
  const sheet = page.getByRole('dialog', { name: '할 일' });
  await expect(sheet).toBeVisible();
  const out = await sheet.locator('.hg-listrow__label').allInnerTexts();
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  return out;
}
