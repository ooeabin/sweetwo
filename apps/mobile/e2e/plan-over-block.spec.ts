import { test, expect, type Page } from '@playwright/test';
import { fillAmount } from './form';
import { axe as runAxe } from './axe';
import { type MemDb, mockOnboarding, mockV22Settings, seed } from './mocks';

// 월급 넘김 입력 막기(2026-11-26 사용자 결정, 06 3-3): 줄 금액 입력이 미계획 금액을 0 아래로 만들면(늘린 변경·새 줄) 주 버튼을 막고
// “월급보다 n 많아요”(금액만 빨강) + ‘월급 고치기’. 줄이는 변경·월급 고치기는 막지 않음.
// 시드: 찬우 3,500,000원, 줄 청약 44만·내 집 마련 95만·고정지출 88만·식비(생활비 묶음) 88만·용돈 35만 → 미계획 0원.
const NOW = new Date('2026-10-07T10:00:00+09:00');
const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
async function open(page: Page) {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  return db;
}
const living = (db: MemDb) =>
  db.splits[0]?.split_line.find((l) => l.kind === 'custom' && l.name === '식비');
const danger = (page: Page) =>
  page.evaluate(() => {
    const d = document.createElement('i');
    d.style.color = 'var(--danger)';
    document.body.append(d);
    const c = getComputedStyle(d).color;
    d.remove();
    return c;
  });

test('W-01 금액 시트: 늘려서 넘으면 ‘확인’ 막힘 + 금액만 빨강 + ‘월급 고치기’ → 월급 금액 시트(막지 않음)', async ({
  page,
}) => {
  const db = await open(page);
  await mockV22Settings(page, db, NOW); // 월급 바꾸기(schedule_salary_change)
  await page.goto('/salary/plan');
  await page.getByRole('button', { name: '식비 880,000원' }).click();
  const sheet = page.getByRole('dialog', { name: '식비 금액' });
  await sheet.getByRole('textbox', { name: '식비 금액' }).fill('1180000');
  await expect(sheet.getByText('월급보다 300,000원 많아요')).toBeVisible();
  const amt = sheet.locator('.hg-help .hg-over');
  await expect(amt).toHaveText('300,000원');
  expect(await amt.evaluate((el) => getComputedStyle(el).color)).toBe(await danger(page));
  const rest = await amt.locator('..').evaluate((el) => getComputedStyle(el).color);
  expect(rest).not.toBe(await danger(page));
  await expect(sheet.getByRole('button', { name: '확인' })).toBeDisabled();
  await axe(page);
  // 0 이상으로 돌리면 평소 “미계획 금액 n”, ‘확인’ 켜짐
  await sheet.getByRole('textbox', { name: '식비 금액' }).fill('780000');
  await expect(sheet.getByText('미계획 금액 100,000원')).toBeVisible();
  await expect(sheet.getByRole('button', { name: '월급 고치기' })).toHaveCount(0);
  await expect(sheet.getByRole('button', { name: '확인' })).toBeEnabled();
  // 다시 넘기고 ‘월급 고치기’ → 이 시트를 닫고 월급 금액 시트
  await sheet.getByRole('textbox', { name: '식비 금액' }).fill('1180000');
  await sheet.getByRole('button', { name: '월급 고치기' }).click();
  await expect(sheet).toHaveCount(0);
  const income = page.getByRole('dialog', { name: '월급 금액' });
  await expect(income).toBeVisible();
  // 월급을 줄여 계획이 넘어도 막지 않음(시트 보조 글만 “계획이 월급보다 n 많아요”)
  await income.getByRole('textbox', { name: '월급 금액' }).fill('3000000');
  await expect(income.getByText('계획이 월급보다 500,000원 많아요')).toBeVisible();
  await expect(income.getByRole('button', { name: '확인' })).toBeEnabled();
  await income.getByRole('button', { name: '확인' }).click();
  await expect(page.getByText('월급을 바꿨어요')).toBeVisible();
  // 입력 없이 넘은 상태: 요약 문장은 그대로, 빨강은 금액만
  const title = page.locator('.hg-plansum__title');
  await expect(title).toHaveText('계획이 월급보다 500,000원 많아요');
  await expect(title.locator('.hg-over')).toHaveText('500,000원');
  // 이미 넘친 상태에서 줄이는 변경은 아직 넘어도 막지 않음
  await page.getByRole('button', { name: '식비 880,000원' }).click();
  await sheet.getByRole('textbox', { name: '식비 금액' }).fill('680000');
  await expect(sheet.getByText('월급보다 300,000원 많아요')).toBeVisible();
  await expect(sheet.getByRole('button', { name: '확인' })).toBeEnabled();
  await sheet.getByRole('button', { name: '확인' }).click();
  await expect(sheet).toHaveCount(0);
  expect(living(db)?.amount).toBe(680_000);
});

test('지출 추가(W-01e): 0원보다 큰 새 줄이 넘으면 ‘추가하기’ 막힘, 0원 줄은 추가 가능', async ({
  page,
}) => {
  await open(page);
  await page.goto('/salary/plan');
  await page.getByRole('button', { name: '+ 지출 추가' }).click();
  const pick = page.getByRole('dialog', { name: '무엇을 추가할까요?' });
  if (await pick.count()) await pick.getByRole('button', { name: '지출' }).click();
  await expect(page.getByRole('heading', { name: '지출 추가', level: 1 })).toBeVisible();
  await page
    .getByRole('group', { name: '지출 이름' })
    .getByRole('button', { name: '관리비' })
    .click();
  await fillAmount(page, '매달 얼마씩?', 100000);
  await expect(page.getByText('월급보다 100,000원 많아요')).toBeVisible();
  const add = page.getByRole('button', { name: '추가하기' });
  await expect(add).toBeDisabled();
  await expect(page.getByRole('button', { name: '월급 고치기' })).toBeVisible();
  await axe(page);
  await fillAmount(page, '매달 얼마씩?', 0);
  await expect(add).toBeEnabled();
  await add.click();
  await expect(page.getByText('관리비를 추가했어요')).toBeVisible();
});

test('W-11 매달 금액이 넘으면 ‘추가하기’ 막힘, ‘월급 고치기’ → W-01 월급 금액 시트', async ({
  page,
}) => {
  await open(page);
  await page.goto('/salary/items/new?from=split');
  await page.getByRole('button', { name: '여행', exact: true }).click();
  await fillAmount(page, '매달 얼마씩?', 300000);
  await expect(page.getByText('월급보다 300,000원 많아요')).toBeVisible();
  await expect(page.locator('.hg-over')).toHaveText('300,000원');
  await expect(page.getByRole('button', { name: '추가하기' })).toBeDisabled();
  await axe(page);
  await page.getByRole('button', { name: '월급 고치기' }).click();
  await expect(page).toHaveURL(/\/salary\/plan$/);
  await expect(page.getByRole('dialog', { name: '월급 금액' })).toBeVisible();
});

test('홈 H-15 ‘월급 계획 템플릿’ 줄: 넘으면 “월급보다 500,000원 많아요”(금액만 빨강, 2026-11-26)', async ({
  page,
}) => {
  const db = await open(page);
  Object.assign(db.me, { monthly_income: 3_000_000 });
  await page.goto('/');
  const row = page.locator('.hg-hubbox__row', { hasText: '월급 계획 템플릿' });
  await expect(row.locator('.hg-hubbox__main')).toHaveText('월급보다 500,000원 많아요');
  const amt = row.locator('.hg-over');
  await expect(amt).toHaveText('500,000원');
  expect(await amt.evaluate((el) => getComputedStyle(el).color)).toBe(await danger(page));
  const rest = await row.locator('.hg-hubbox__main').evaluate((el) => getComputedStyle(el).color);
  expect(rest).not.toBe(await danger(page));
  await expect(row).toHaveAttribute('aria-label', '월급 계획 템플릿, 월급보다 500,000원 많아요');
  await axe(page);
});
