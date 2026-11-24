import { expect, type Page } from '@playwright/test';

// 한 화면 입력(FormScreen) 도우미(2026-11-23). 좁은 창은 금액 칸을 누르면 키패드 시트, 넓은 창은 칸에 바로 입력
const narrow = (page: Page) => (page.viewportSize()?.width ?? 1280) < 768;

/** 금액 칸(매달 금액) 채우기 */
export async function fillAmount(page: Page, label: string, value: number | string) {
  if (!narrow(page)) return page.getByLabel(label, { exact: true }).fill(String(value));
  await page
    .getByRole('button', { name: new RegExp(`^${label.replace(/[?.*+()]/g, '\\$&')},`) })
    .click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel(label, { exact: true }).fill(String(value));
  await dlg.getByRole('button', { name: '확인' }).click();
}

/** 접힌 줄 금액 시트(목표 금액, 이미 모은 금액) */
export async function foldAmount(page: Page, label: string, value: number | string) {
  await page
    .getByRole('button', { name: new RegExp(`^${label.replace(/[?.*+()]/g, '\\$&')},`) })
    .click();
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

/** F-03 자산·부채 추가 한 화면: 묶음 칩 → 종류 칩(2026-11-24). 이름은 종류 칩이 채움 */
export async function pickAssetKind(page: Page, grp: string, kind: string) {
  await page.getByRole('group', { name: '묶음', exact: true }).getByRole('button', { name: grp, exact: true }).click();
  await page.getByRole('group', { name: grp, exact: true }).getByRole('button', { name: kind, exact: true }).click();
}

/** 이름 칸 */
export async function fillAssetName(page: Page, name: string) {
  await page.getByLabel('이름', { exact: true }).fill(name);
}

/** 접힌 줄 눌러 시트 열기 */
export async function openFold(page: Page, label: string) {
  await page.getByRole('button', { name: new RegExp(`^${label}`) }).click();
  return page.getByRole('dialog', { name: label });
}

/** 글자 칸 시트(납입 회차, 금리) */
export async function foldText(page: Page, label: string, value: string) {
  const dlg = await openFold(page, label);
  await dlg.getByLabel(label, { exact: true }).fill(value);
  await dlg.getByRole('button', { name: '확인' }).click();
  await expect(dlg).toHaveCount(0);
}

/** 금액 칸 값 확인(예: '100,000'): 넓은 창은 칸 값, 좁은 창은 칸 버튼 이름 “라벨, 100,000원” */
export async function expectAmount(page: Page, label: string, text: string) {
  if (!narrow(page)) return expect(page.getByLabel(label, { exact: true })).toHaveValue(text);
  await expect(
    page.getByRole('button', { name: `${label}, ${text}원`, exact: true }),
  ).toBeVisible();
}
