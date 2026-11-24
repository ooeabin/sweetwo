import type { Page } from '@playwright/test';

/** 날짜 휠(DateWheel)을 키보드로 맞춤: 줄마다 ↑↓를 차이만큼 누름. 연도만 휠이면 m, d 없이 */
export async function setWheel(page: Page, label: string, y: number, m?: number, d?: number) {
  const group = page.getByRole('group', { name: label });
  const cols: [string, number | undefined][] = [
    ['년', y],
    ['월', m],
    ['일', d],
  ];
  for (const [name, want] of cols) {
    if (want === undefined) continue;
    const col = group.getByRole('spinbutton', { name, exact: true });
    await col.focus();
    for (let i = 0; i < 400; i++) {
      const now = Number(await col.getAttribute('aria-valuenow'));
      if (now === want) break;
      await col.press(now < want ? 'ArrowDown' : 'ArrowUp');
    }
  }
}

/** 연·월 휠(YearMonthInput)을 맞춤. 화면에 휠이 하나일 때 */
export async function setYearMonth(page: Page, y: number, m: number) {
  for (const [name, want] of [
    ['년', y],
    ['월', m],
  ] as const) {
    const col = page.getByRole('spinbutton', { name, exact: true });
    await col.focus();
    for (let i = 0; i < 400; i++) {
      const now = Number(await col.getAttribute('aria-valuenow'));
      if (now === want) break;
      await col.press(now < want ? 'ArrowDown' : 'ArrowUp');
    }
  }
}

const DOW_LONG = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

/**
 * 달력 시트에서 날을 고름(DateSheet, 2026-11-24). 이미 열린 시트(dlg)에서 쓰거나, label이 있으면 폼 날짜 한 줄을 눌러 열고 “선택”까지 누름.
 * 다른 달이면 월 머리 ⌄로 연·월 휠을 열어 맞추고 “보기”로 돌아옴. 음력이면 시트 맨 위 ‘음력’을 먼저 고름.
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
