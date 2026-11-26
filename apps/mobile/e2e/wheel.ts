import { expect, type Page } from '@playwright/test';

const esc = (t: string) => t.replace(/[?.*+()]/g, '\\$&');

/** 폼 한 줄(hg-dline)을 눌러 엶. label을 주면 그 이름으로 시작하는 줄, 없으면 화면(또는 열린 시트) 안 첫 줄 */
function openLine(page: Page, label?: string | RegExp) {
  const line =
    label === undefined
      ? page.locator('button.hg-dline').first()
      : page.getByRole('button', {
          name: typeof label === 'string' ? new RegExp(`^${esc(label)}, `) : label,
        });
  return line.click();
}

/** 열린 연·월 칸(YearMonthPanel: 연도 ‹ › + 12개월)에서 그 연·월을 고름(주 버튼은 안 누름) */
export async function setYearMonth(page: Page, y: number, m: number) {
  const panel = page.locator('.hg-picksheet__ym').last();
  const year = panel.locator('.hg-picksheet__year');
  for (let i = 0; i < 120; i++) {
    const now = Number(((await year.textContent()) ?? '').replace('년', ''));
    if (now === y) break;
    await panel.getByRole('button', { name: now < y ? '다음 해' : '이전 해' }).click();
  }
  await panel.getByRole('radio', { name: `${m}월`, exact: true }).click();
}

/** 연·월 한 줄(YearMonthField)을 눌러 시트에서 고르고 “선택” */
export async function pickYearMonth(page: Page, y: number, m: number, label?: string | RegExp) {
  const before = await page.getByRole('dialog').count(); // 다른 시트 위에서 열릴 수도 있음(W-11 기한)
  await openLine(page, label);
  await setYearMonth(page, y, m);
  await page.getByRole('dialog').last().getByRole('button', { name: /선택$/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(before);
}

/** 연도 한 줄(YearField, 출생연도)을 눌러 시트에서 그 해를 고르고 “선택” */
export async function pickYear(page: Page, label: string, y: number) {
  await openLine(page, label);
  const dlg = page.getByRole('dialog', { name: label });
  await dlg.getByRole('radio', { name: `${y}년`, exact: true }).click();
  await dlg.getByRole('button', { name: `${y}년 선택` }).click();
  await dlg.waitFor({ state: 'hidden' });
}

/** 일 한 줄(DayField, W-01 나가는 날)을 눌러 시트에서 1~31 또는 말일을 고르고 “…로 하기” */
export async function pickDay(page: Page, label: string, d: number | 'last') {
  await openLine(page, label);
  const dlg = page.getByRole('dialog', { name: label });
  await dlg.getByRole('radio', { name: d === 'last' ? '말일' : String(d), exact: true }).click();
  await dlg.getByRole('button', { name: /하기$/ }).click();
  await dlg.waitFor({ state: 'hidden' });
}

const DOW_LONG = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

/**
 * 달력 시트에서 날을 고름(DateSheet, 2026-11-24). 이미 열린 시트(dlg)에서 쓰거나, label이 있으면 폼 날짜 한 줄을 눌러 열고 “선택”까지 누름.
 * 다른 달이면 월 머리 ⌄로 연·월 칸을 열어 맞추고 “보기”로 돌아옴. 음력이면 시트 맨 위 ‘음력’을 먼저 고름.
 */
export async function pickDate(
  page: Page,
  label: string,
  ymd: string,
  opts: { lunar?: boolean } = {},
) {
  await page
    .getByRole('button', { name: new RegExp(`^${label.replace(/[?.*+()]/g, '\\$&')}, `) })
    .click();
  const dlg = page.getByRole('dialog', { name: label });
  await pickInSheet(page, dlg, ymd, opts);
  await dlg.getByRole('button', { name: /선택$/ }).click();
  await dlg.waitFor({ state: 'hidden' });
}

/** 열린 달력 시트 안에서 그 날을 눌러 고르기까지(주 버튼은 안 누름) */
export async function pickInSheet(
  page: Page,
  dlg: ReturnType<Page['getByRole']>,
  ymd: string,
  opts: { lunar?: boolean } = {},
) {
  const [y = 0, m = 1, d = 1] = ymd.split('-').map(Number);
  if (opts.lunar) await dlg.getByRole('radio', { name: '음력' }).click();
  const head = dlg.getByRole('button', { name: /연·월 고르기/ });
  const cur = (await head.getAttribute('aria-label')) ?? '';
  if (!cur.startsWith(`${y}년 ${m}월,`)) {
    await head.click();
    await setYearMonth(page, y, m);
    await dlg.getByRole('button', { name: /보기$/ }).click();
  }
  const name = opts.lunar
    ? `음력 ${y}년 ${m}월 ${d}일`
    : `${y}년 ${m}월 ${d}일 ${DOW_LONG[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}`;
  await dlg.getByRole('gridcell', { name }).click();
}
