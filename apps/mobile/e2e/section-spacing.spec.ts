import { test, expect, type Page } from '@playwright/test';
import { type MemDb, emptyV22, mockOnboarding, mockSaving, newSavingDb, seed } from './mocks';
import { bandGaps, belowHead, bottomBarGap, headBox } from './spacing';

// 영역 간격 기준(2026-11-24, DESIGN.md ‘영역 간격’): 대표 화면의 영역 사이를 getBoundingClientRect로 단언한다. 휴대폰 크기, light.
test.use({ viewport: { width: 390, height: 844 } });
const NOW = new Date('2026-10-07T10:00:00+09:00');

/** B.top − A.bottom (px, 소수 첫째 자리까지) */
async function gap(page: Page, a: string, b: string) {
  return page.evaluate(
    ([sa, sb]: [string, string]) => {
      const A = document.querySelector(sa);
      const B = document.querySelector(sb);
      if (!A || !B) return null;
      return (
        Math.round((B.getBoundingClientRect().top - A.getBoundingClientRect().bottom) * 10) / 10
      );
    },
    [a, b] as [string, string],
  );
}

async function open(page: Page, path: string, prep?: (db: MemDb) => void) {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  db.v22 = emptyV22();
  prep?.(db);
  const sv = newSavingDb();
  await mockSaving(page, db, sv, String(db.me.id));
  await page.goto(path);
}
/** 각자 엔진으로 연결된 예빈(사람 탭이 보임) */
const withPartner = (db: MemDb) => {
  Object.assign(db.space ?? {}, {
    couple_state: 'connected',
    partner_nickname: '예빈',
    partner_income: 2_700_000,
  });
  db.partner = {
    id: 'yebin',
    nickname: '예빈',
    side: 'bride',
    employment: 'regular',
    monthly_income: 2_700_000,
    payday: 10,
    payday_last: false,
    allowance: 500_000,
  };
};
/** 월급 계획 없음(W-02·W-21 빈 상태) */
const noPlan = (db: MemDb) => {
  const list = db.checklists[0];
  if (list) list.pay_check_line = [];
};

test('FormScreen(W-11): 섹션 사이 32, 제목과 내용 12, 띠 8 + 보이는 위 32·아래 24(2026-11-27 간격 정리)', async ({
  page,
}) => {
  await open(page, '/salary/items/new');
  await expect(page.locator('.hg-form__sec').first()).toBeVisible();
  expect(await gap(page, '.hg-form__sec:nth-of-type(1)', '.hg-form__sec:nth-of-type(2)')).toBe(32);
  expect(
    await gap(
      page,
      '.hg-form__sec:nth-of-type(1) .hg-form__q',
      // 2026-11-27: 이름 칩은 묶음(‘추천’ 제목 + 칩, NameChipGroups)이라 질문 → 칩 묶음 맨 위
      '.hg-form__sec:nth-of-type(1) .hg-chipgroups',
    ),
  ).toBe(12);
  const folds = page.locator('.hg-form__folds');
  await expect(folds).toBeVisible();
  const band = await page.evaluate(() => {
    const f = document.querySelector('.hg-form__folds') as HTMLElement;
    const r = f.getBoundingClientRect();
    const first = f.querySelector('.hg-form__fold') as HTMLElement;
    return {
      bandH: parseFloat(getComputedStyle(f, '::before').height),
      toRow:
        first.getBoundingClientRect().top -
        r.top -
        parseFloat(getComputedStyle(f, '::before').height),
    };
  });
  expect(band.bandH).toBe(8);
  // 띠 → 접힌 줄 상자 8 + 줄 안 글자까지 16 = 보이는 24
  expect(band.toRow).toBe(8);
});

test('W-02: hero 아래 32, 밑줄 탭 아래 24, 수입 줄 앞 32', async ({ page }) => {
  await open(page, '/salary');
  await expect(page.locator('.hg-w02hero')).toBeVisible();
  expect(await gap(page, '.hg-w02hero > :last-child', '.hg-linetabs')).toBe(32);
  expect(await gap(page, '.hg-linetabs', '.hg-checklist__list')).toBe(24);
  expect(await gap(page, '.hg-checklist__list', '.hg-incomeline')).toBe(32);
});

test('W-01(흰 바탕): 영역 사이 = 8px 회색 띠, 보이는 위 32(‘+ 추가’ 원 끝) · 아래 24(묶음 머리 글자), 영역 안 위 여백 없음', async ({
  page,
}) => {
  await open(page, '/salary/plan');
  await expect(page.locator('.hg-plancard').first()).toBeVisible();
  // 상자 간격 = 위 32 − 원 안쪽 8 + 띠 8 + 아래 24(묶음 머리는 글자 줄 상자라 그대로)
  expect(await gap(page, '.hg-plancard:nth-of-type(1)', '.hg-plancard:nth-of-type(2)')).toBe(56);
  const band = await page.evaluate(() => {
    const c = document.querySelectorAll('.hg-plancard')[1] as HTMLElement;
    const b = getComputedStyle(c, '::before');
    return { h: b.height, bg: b.backgroundColor, pad: getComputedStyle(c).paddingTop };
  });
  expect(band.h).toBe('8px');
  expect(band.bg).not.toBe('rgba(0, 0, 0, 0)');
  expect(band.pad).toBe('0px');
  const bands = await bandGaps(page);
  expect(bands.length).toBe(2);
  for (const b of bands) expect(b.below).toBe(24);
  expect(bands[1]?.above).toBe(32);
});

test('바탕: 홈만 회색(surface-alt) + 흰 상자, 그 밖은 흰 바탕(surface)', async ({ page }) => {
  test.setTimeout(90_000);
  await open(page, '/');
  await expect(page.locator('.hg-frame')).toHaveClass(/hg-frame--alt/);
  const color = (sel: string) =>
    page.evaluate((s) => {
      const el = document.querySelector(s) as HTMLElement;
      return getComputedStyle(el).backgroundColor;
    }, sel);
  const homeBg = await color('.hg-frame');
  await page.goto('/salary'); // 흰 바탕 기준(W-02, 다크는 canvas)
  await expect(page.locator('.hg-frame')).toBeVisible();
  const white = await color('.hg-frame');
  for (const path of ['/salary/plan', '/assets', '/assets/items', '/settings', '/settings/me']) {
    await page.goto(path);
    await expect(page.locator('.hg-frame')).toBeVisible();
    await expect(page.locator('.hg-frame')).not.toHaveClass(/hg-frame--alt/);
    expect(await color('.hg-frame')).toBe(white);
  }
  expect(homeBg).not.toBe(white);
});

test('시트: 제목 아래 24, 영역 사이 24', async ({ page }) => {
  await open(page, '/');
  const sheetGap = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.className = 'hg-sheet';
    document.body.append(probe);
    const g = getComputedStyle(probe).rowGap;
    probe.remove();
    return g;
  });
  expect(sheetGap).toBe('24px');
});

test('FormScreen 아래 고정 주 버튼: 윗변 위 32는 바탕으로 채우고, 스크롤 중에도 내용이 그 안에 안 보임', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await open(page, '/assets/new?side=asset');
  const bar = page.locator('.hg-stickybar');
  await expect(bar).toBeVisible();
  const r = await page.evaluate(() => {
    const b = document.querySelector('.hg-stickybar') as HTMLElement;
    const btn = b.querySelector('button') as HTMLElement;
    window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) / 2);
    const bt = btn.getBoundingClientRect().top;
    const x = btn.getBoundingClientRect().left + 20;
    const probe = (dy: number) => !!document.elementFromPoint(x, bt - dy)?.closest('.hg-stickybar');
    return {
      pad: parseFloat(getComputedStyle(b).paddingTop),
      bg: getComputedStyle(b).backgroundColor,
      fade: getComputedStyle(b, '::before').height,
      solid: [4, 16, 31].every(probe),
    };
  });
  expect(r.pad).toBe(32);
  expect(r.bg).not.toBe('rgba(0, 0, 0, 0)');
  expect(r.fade).toBe('16px');
  expect(r.solid).toBe(true);
});

// ── 간격 정리(2026-11-27 사용자 결정, DESIGN.md ‘간격 정리 2026-11-27’) ──

for (const path of ['/settings', '/salary/items/goal-h', '/settings/visibility']) {
  test(`띠 하나(${path}): 두께 8, 화면 끝까지, 보이는 위 32 · 아래 24`, async ({ page }) => {
    await open(page, path);
    await expect(page.locator('.hg-frame')).toBeVisible();
    await expect.poll(async () => (await bandGaps(page)).length).toBeGreaterThan(0);
    const bands = await bandGaps(page);
    for (const b of bands) {
      expect(b.height).toBe(8);
      expect([b.left, b.right]).toEqual([0, 390]);
    }
    // 첫 띠는 56 줄·글자 사이라 정확히 32 / 24
    expect([bands[0]?.above, bands[0]?.below]).toEqual([32, 24]);
  });
}

const HEAD_CASES: [string, string][] = [
  ['/salary/plan', '.hg-plansum'],
  ['/salary', '.hg-w02hero'],
  ['/salary/items/goal-h', '.hg-fdhero'],
  ['/assets/items', '.hg-linetabs'],
  ['/calendar/gifts', '.hg-linetabs'],
  ['/calendar/add', '.hg-form__sec'],
  ['/salary/items/new', '.hg-form__hero'],
];
for (const [path, first] of HEAD_CASES) {
  test(`머리 하나(${path}): 맨 위 0, 높이 56, ‹ 칸 왼쪽 8, 머리 아래 첫 상자 24`, async ({
    page,
  }) => {
    await open(page, path);
    await expect(page.locator(first).first()).toBeVisible();
    await expect.poll(() => headBox(page)).toMatchObject({ top: 0, bottom: 56, backLeft: 8 });
    await expect.poll(() => belowHead(page, first)).toBe(24);
  });
}

const TAB_CASES: [string, string][] = [
  ['/salary/plan', '.hg-planstage'],
  ['/salary', '.hg-w02hero'],
];
for (const [path, next] of TAB_CASES) {
  test(`사람 탭(${path}): 머리 → 탭 16, 탭 → 첫 내용 24(W-01·W-02 같은 자리)`, async ({ page }) => {
    await open(page, path, withPartner);
    await expect(page.locator('.hg-tabs')).toBeVisible();
    await expect.poll(() => belowHead(page, '.hg-tabs')).toBe(16);
    await expect.poll(() => gap(page, '.hg-tabs', next)).toBe(24);
  });
}

test('묶음 머리 → 첫 줄: 머리 상자 바로 아래 줄 상자(보이는 16), 마지막 줄 → ‘+ 추가’ 상자 0(F-02)', async ({
  page,
}) => {
  await open(page, '/settings/visibility');
  const head = page.locator('section.hg-stack > .hg-sechead').first();
  await expect(head).toBeVisible();
  const r = await head.evaluate((h) => {
    const t = (h.querySelector('.hg-sechead__title') as HTMLElement).getBoundingClientRect();
    const row = (h.nextElementSibling as HTMLElement).querySelector('.hg-listrow') as HTMLElement;
    const label = row.querySelector('.hg-listrow__label') as HTMLElement;
    return {
      box: Math.round(row.getBoundingClientRect().top - h.getBoundingClientRect().bottom),
      title: Math.round(t.bottom - h.getBoundingClientRect().bottom),
      text: Math.round(label.getBoundingClientRect().top - t.bottom),
    };
  });
  expect(r.box).toBe(0);
  expect(r.title).toBe(0);
  expect(r.text).toBe(16);
});

const BAR_CASES: [string, string, ((db: MemDb) => void) | undefined][] = [
  ['W-02 진행 중', '/salary', undefined],
  ['W-02 빈 상태', '/salary', noPlan],
  ['W-11 폼', '/salary/items/new', undefined],
  ['Y-07 폼', '/calendar/add', undefined],
  ['F-03 폼', '/assets/new?side=asset', undefined],
];
test('상태 화면(CS-19) 아래 꽉 찬 주 버튼도 아래 끝 → 화면 아래 16', async ({ page }) => {
  await open(page, '/calendar/nowhere/really');
  await expect(page.locator('.hg-auth__actions .hg-btn--primary')).toBeVisible();
  await expect.poll(() => bottomBarGap(page)).toBe(16);
});

for (const [name, path, prep] of BAR_CASES) {
  test(`아래 고정 주 버튼(${name}): 아래 끝 → 화면 아래 16(브라우저는 안전 영역 0)`, async ({
    page,
  }) => {
    await open(page, path, prep);
    await expect(page.locator('.hg-stickybar .hg-btn--primary').first()).toBeVisible();
    await expect.poll(() => bottomBarGap(page)).toBe(16);
  });
}

test('시트 안 옆 여백 24(화면과 같게)', async ({ page }) => {
  await open(page, '/salary/plan');
  await page
    .getByRole('button', { name: /^생활비 / })
    .first()
    .click();
  const sheet = page.getByRole('dialog', { name: '생활비 금액' });
  await expect(sheet).toBeVisible();
  const pad = await sheet.evaluate((d) => {
    const s = (d.closest('.hg-sheet') ?? d) as HTMLElement;
    const cs = getComputedStyle(s);
    return [cs.paddingLeft, cs.paddingRight, cs.borderLeftWidth];
  });
  expect(pad).toEqual(['24px', '24px', '0px']);
});
