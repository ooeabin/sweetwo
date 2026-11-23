import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { type MemDb, mockOnboarding, seed } from './mocks';

// W-21 지난 달 모아보기(20 W-21, 2026-11-17): 서랍 ‘월급 > 지난 달 모아보기’, 줄 → W-02 지난 달 보기, 빈 상태, 날짜 없는 사람 기간.
const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const NOW = new Date('2026-10-07T10:00:00+09:00');

/** 지난 사이클 하나: states = 줄 상태(저금 줄 먼저). 건너뜀이면 checked_by 없음(닫을 때 건너뜀, 늦은 확인 대상) */
function past(
  db: MemDb,
  id: string,
  start: string,
  end: string,
  states: string[],
  planned: number[] = [],
) {
  const cur = db.checklists[0] as Record<string, unknown>;
  const lines = (cur.pay_check_line as Record<string, unknown>[]).slice(0, states.length);
  db.checklists.push({
    ...cur,
    id,
    label: id,
    cycle_start: start,
    cycle_end: end,
    state: 'done',
    pay_check_line: lines.map((l, i) => ({
      ...l,
      id: `${String(l.id)}-${id}`,
      state: states[i],
      planned: planned[i] ?? l.planned,
      actual: null,
      checked_by: states[i] === 'checked' ? db.me.id : null,
      checked_at: states[i] === 'checked' ? `${start}T01:00:00Z` : null,
    })),
  });
}

test('지난 달 모아보기: 서랍 줄 → 최근 것부터 결과·모은 금액·수입, 줄 → W-02 지난 달 보기(‹ = 모아보기)', async ({
  page,
}, info) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  Object.assign(db.me, { monthly_income: 3_500_000 });
  // 달마다 계획 금액이 달라야 오른쪽 모은 금액과 보조 ‘계획한 월급’이 달마다 다르게 나옴
  past(db, 'aug', '2026-08-25', '2026-09-24', ['checked', 'skipped'], [1_000_000, 500_000]);
  past(db, 'jul', '2026-07-25', '2026-08-24', ['checked', 'checked'], [2_000_000, 700_000]);
  past(db, 'jun', '2026-06-25', '2026-07-24', ['skipped', 'checked'], [300_000, 400_000]);
  if (info.project.name === 'narrow') {
    await page.goto('/');
    await expect(page.locator('.hg-together')).toBeVisible();
    await page.getByRole('button', { name: '메뉴', exact: true }).click();
    await page
      .getByRole('dialog', { name: '메뉴' })
      .getByRole('button', { name: '지난 달 모아보기', exact: true })
      .click();
  } else {
    // 넓은 창: 사이드바 월급 탭에는 서랍이 없어 주소로 연다(W-02 머리 링크는 2026-11-18 없앰)
    await page.goto('/salary/archive');
  }
  await expect(page).toHaveURL(/\/salary\/archive/);
  await expect(page.getByRole('heading', { name: '지난 달 모아보기', level: 1 })).toBeVisible();
  const rows = page.locator('.hg-list .hg-listrow');
  await expect(rows).toHaveCount(3);
  // 최근 것부터(7월 25일은 토요일이라 앞당긴 24일): 8월(늦은 확인 1개), 7월(모두 계획대로), 6월(건너뜀 섞임, 늦은 확인 기간 지남)
  await expect(rows.nth(0)).toContainText('8월 25일 월급');
  await expect(rows.nth(0)).toContainText('확인할 것 1개');
  // 오른쪽 큰 숫자 = 그 달 모은 금액, 보조 = 계획한 월급(달마다 다름, 지금 실수령 350만 원이 아님)
  await expect(rows.nth(0)).toContainText('계획한 월급 150만 원');
  await expect(rows.nth(0).locator('.hg-listrow__value')).toContainText('100만 원');
  await expect(rows.nth(1)).toContainText('계획한 월급 270만 원');
  await expect(rows.nth(1).locator('.hg-listrow__value')).toContainText('270만 원');
  await expect(rows.nth(2)).toContainText('계획한 월급 70만 원');
  await expect(rows.nth(2).locator('.hg-listrow__value')).toContainText('40만 원');
  await expect(page.locator('.hg-list')).not.toContainText('350만');
  await expect(rows.nth(1)).toContainText('7월 24일 월급');
  await expect(rows.nth(1)).toContainText('계획대로 됐어요');
  await expect(rows.nth(2)).toContainText('확인을 마쳤어요');
  await axe(page);

  // 줄 → W-02 지난 달 보기(읽기 전용), ‹ → 모아보기
  await page.locator('.hg-list .hg-listrow').nth(1).click();
  await expect(page.locator('.hg-datepill')).toHaveText('7월 24일 월급');
  // 2026-11-23: 머리 제목은 “지난 달 모아보기”(예전 “월급”), 본문 제목은 “이번 달” 대신 그 달
  await expect(page.getByRole('heading', { name: '지난 달 모아보기', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: '월급', level: 1, exact: true })).toHaveCount(0);
  await expect(page.getByText('7월도 계획대로!')).toBeVisible();
  await expect(page.getByText('이번 달도 계획대로!')).toHaveCount(0);
  // 2026-11-23: 수입 카드 이름표도 그 달(“이번 달 수입” 아님)
  await expect(page.locator('.hg-incomecard')).toContainText('7월 수입');
  await expect(page.locator('.hg-incomecard')).not.toContainText('이번 달 수입');
  await expect(page.locator('.hg-transfer__dot.is-on')).toHaveCount(0);
  await page.getByRole('button', { name: '뒤로' }).locator('visible=true').first().click();
  await expect(page).toHaveURL(/\/salary\/archive/);
  await expect(page.locator('.hg-list .hg-listrow')).toHaveCount(3);
});

test('지난 달 모아보기: 지난 달이 없으면 빈 상태', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/salary/archive');
  await expect(page.getByText('아직 지난 달 기록이 없어요')).toBeVisible();
  await axe(page);
});

test('지난 달 모아보기: 날짜 없는 사람은 끝난 30일 기간별 수입 합', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  Object.assign(db.me, { payday_none: true, payday: null });
  (db as unknown as { moneyIns?: unknown[] }).moneyIns = undefined;
  await page.goto('/salary/archive');
  // 기록이 없으면 빈 상태(기간 계산은 core 단위 시험)
  await expect(page.getByRole('heading', { name: '지난 달 모아보기', level: 1 })).toBeVisible();
  await expect(page.getByText('아직 지난 달 기록이 없어요')).toBeVisible();
});

test('지난 달 모아보기: 금액 가리기(눈)를 따름', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await page.addInitScript(() => localStorage.setItem('sweetwo.masked', '1'));
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  past(db, 'aug', '2026-08-25', '2026-09-24', ['checked', 'checked'], [1_000_000, 500_000]);
  await page.goto('/salary/archive');
  const first = page.locator('.hg-list .hg-listrow').first();
  await expect(first).toContainText('•••');
  await expect(first).not.toContainText('150만');
  await expect(first).not.toContainText('100만');
});
