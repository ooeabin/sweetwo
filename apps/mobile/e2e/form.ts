import { expect, type Page } from '@playwright/test';

// 한 화면 입력(FormScreen) 도우미(2026-11-23). 좁은 창은 금액 칸을 누르면 키패드 시트, 넓은 창은 칸에 바로 입력
const narrow = (page: Page) => (page.viewportSize()?.width ?? 1280) < 768;

/** 금액 칸(매달 금액) 채우기 */
export async function fillAmount(page: Page, label: string, value: number | string) {
  if (!narrow(page)) return page.getByLabel(label, { exact: true }).fill(String(value));
  await page.getByRole('button', { name: new RegExp(`^${label.replace(/[?.*+()]/g, '\\$&')},`) }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel(label, { exact: true }).fill(String(value));
  await dlg.getByRole('button', { name: '확인' }).click();
}

/** 접힌 줄 금액 시트(목표 금액, 이미 모은 금액) */
export async function foldAmount(page: Page, label: string, value: number | string) {
  await page.getByRole('button', { name: new RegExp(`^${label.replace(/[?.*+()]/g, '\\$&')},`) }).click();
  const dlg = page.getByRole('dialog', { name: label });
  await dlg.getByLabel(label, { exact: true }).fill(String(value));
  await dlg.getByRole('button', { name: '확인' }).click();
  await expect(dlg).toHaveCount(0);
}

/** 이름: 칩이면 칩, 아니면 ‘직접 정하기’ + 이름 칸 */
export async function pickName(page: Page, name: string, chip = false) {
  if (chip) return page.getByRole('button', { name, exact: true }).click();
  await page.getByRole('button', { name: '직접 정하기', exact: true }).click();
  await page.getByLabel('이름', { exact: true }).fill(name);
}
