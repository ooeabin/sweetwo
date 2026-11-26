import { test, expect, type Page } from '@playwright/test';
import { emptyV22, type MemDb, mockOnboarding, seed } from './mocks';

test.use({ launchOptions: { executablePath: '/opt/pw-browsers/chromium_headless_shell' } });
const NOW = new Date('2026-10-07T10:00:00+09:00');
const TAG = process.env.SHOT_TAG ?? 'before';
const PARTNER = { id: 'yebin', nickname: '예빈', side: 'bride', employment: 'regular', monthly_income: 2_700_000, payday: 10, payday_last: false, allowance: 270_000 };
async function open(page: Page, prep: (db: MemDb) => void) {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.setViewportSize({ width: 375, height: 1000 });
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  db.v22 = emptyV22();
  prep(db);
  await page.goto('/');
  await expect(page.locator('.hg-hubbox')).toBeVisible();
  await page.waitForTimeout(500);
}
const cases: Record<string, (d: MemDb) => void> = {
  linked: (d) => {
    Object.assign(d.space ?? {}, { couple_state: 'connected', partner_nickname: '예빈' });
    d.partner = PARTNER;
    for (const g of d.goals) g.owner_user_id = null;
  },
  wedding: (d) => {
    Object.assign(d.space ?? {}, { marriage_status: 'engaged', wedding_date: '2027-03-01' });
  },
  dateless: (d) => {
    Object.assign(d.me, { payday: null, payday_none: true });
    d.checklists.length = 0;
  },
};
for (const [name, prep] of Object.entries(cases)) {
  test(`shot ${name}`, async ({ page }) => {
    await open(page, prep);
    await page.screenshot({ path: `/tmp/shots/home2-${TAG}-${name}.png`, fullPage: true });
    // 측정
    const m = await page.evaluate(() => {
      const r = (s: string) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom), Math.round(b.height)]; };
      return {
        together: r('.hg-together'), title: r('.hg-together__head'), name: r('.hg-together__name'), amount: r('.hg-together__amount'), bar: r('.hg-together__bar'), line: r('.hg-together__line'), dots: r('.hg-together__dots'),
        h12: r('.hg-hubtile--action'), h12btn: r('.hg-hubtile--action .hg-btn'), hubbox: r('.hg-hubbox'), rowAction: r('.hg-hubbox__row--action'), rowBtn: r('.hg-hubbox__row--action .hg-btn'),
      };
    });
    console.log(name, JSON.stringify(m));
  });
}
