import { test, expect, type Page } from '@playwright/test';
import {
  emptyV22,
  type MemDb,
  mockOnboarding,
  mockSaving,
  newSavingDb,
  type SavingDb,
  seed,
} from './mocks';

// W-02 이번 달 월급 체크 화면 순서(20 W-02 0번, 2026-11-19 확정 시안).
// 날짜 알약 → 큰 금액 → 보조 한 줄 → 칩 → 줄 목록 → 수입 카드(+ 수입 적기) → 아래 고정 주 버튼. 월급날 전은 “D-n, 5개” + 비활성 버튼.
const y = async (loc: ReturnType<Page['locator']>) => {
  const box = await loc.first().boundingBox();
  expect(box).not.toBeNull();
  return box?.y ?? 0;
};

async function open(page: Page, now: Date, prep?: (db: MemDb, sv: SavingDb) => void) {
  await page.clock.setFixedTime(now);
  const db = await mockOnboarding(page, { now });
  seed(db);
  db.v22 = emptyV22();
  const sv = newSavingDb();
  prep?.(db, sv);
  await mockSaving(page, db, sv, String(db.me.id));
  await page.goto('/salary');
  return db;
}

test('월급날 확인이 남은 달: 날짜 알약 → 큰 금액 → 칩 → 목록 → 수입 카드, 주 버튼은 화면 아래 고정, 머리 링크·‘+ 추가’ 없음', async ({
  page,
}) => {
  await open(page, new Date('2026-10-07T10:00:00+09:00'));
  const pill = page.locator('.hg-datepill');
  await expect(pill).toHaveText('9월 25일 월급');
  const amt = page.locator('.hg-w02hero__amt');
  await expect(amt).toHaveText('350만 원');
  await expect(page.getByText('5개 중 0개 확인')).toHaveCount(0); // 2026-11-23 없앰
  const chips = page.getByRole('tablist', { name: '보기 고르기' });
  const first = page.locator('.hg-transfer').first();
  await expect(first).toBeVisible();
  const income = page.getByRole('group', { name: '이번 달 수입' });
  await expect(income).toBeVisible();
  await expect(income).toContainText('350만 원');
  await expect(page.getByRole('link', { name: '월급 계획 템플릿' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '지난 달 모아보기' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /추가/ })).toHaveCount(0);
  // 없앤 문구(2026-11-19)
  for (const t of [
    '계획한 350만 원 중',
    '09.25 ~ 10.24',
    '확인할 것 5개',
    '월급날에 확인할 것',
    '자동으로 나가는 것',
  ])
    await expect(page.getByText(t)).toHaveCount(0);
  expect(await y(pill)).toBeLessThan(await y(amt));
  expect(await y(amt)).toBeLessThan(await y(chips));
  expect(await y(chips)).toBeLessThan(await y(first));
  expect(await y(first)).toBeLessThan(await y(income));
  // 주 버튼은 화면 아래에 고정(스크롤 위치와 상관없이 보임)
  const confirm = page.getByRole('button', { name: '모두 계획대로 됐어요' });
  await expect(confirm).toBeInViewport();
  const vh = page.viewportSize()?.height ?? 0;
  expect((await confirm.boundingBox())?.y ?? 0).toBeGreaterThan(vh / 2);
});

test('첫 월급날 전: 날짜 알약 → 큰 금액 → “D-n, 5개” → 비활성 버튼 줄 → 수입 카드(칩·주 버튼 없음)', async ({
  page,
}) => {
  await open(page, new Date('2026-10-20T10:00:00+09:00'), (d) => {
    d.checklists.length = 0;
    if (d.v22) d.v22.noRetro = true;
    Object.assign(d.splits[0] ?? {}, { checklist_from: '2026-10-15' });
    Object.assign(d.me, { onboarding_done_at: '2026-10-15T00:00:00Z' });
  });
  const pill = page.locator('.hg-datepill');
  await expect(pill).toHaveText('10월 23일 월급');
  await expect(page.getByText('D-3, 5개')).toBeVisible();
  await expect(page.locator('.hg-w02hero__amt')).toHaveText('350만 원');
  // 고를 달이 없어 ⌄ 없음, ‹ › 없음
  await expect(page.getByRole('button', { name: '월급날 고르기' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '지난 달 보기', exact: true })).toHaveCount(0);
  const rows = page.locator('.hg-list--preview .hg-transfer');
  await expect(rows).toHaveCount(5);
  // 줄(2026-11-23 C안): 점·›·버튼 없이 보통 글자, 보조 줄 “23일에 확인해요”, 화면 읽기 “청약 44만 원, 월급날에 확인해요”
  await expect(
    rows.first().getByRole('group', { name: /^청약 .+, 월급날에 확인해요$/ }),
  ).toBeVisible();
  await expect(rows.first().getByRole('button')).toHaveCount(0);
  await expect(page.locator('.hg-transfer__dot.is-on')).toHaveCount(0);
  await expect(rows.first()).toContainText('23일에 확인해요');
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByRole('tablist', { name: '보기 고르기' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '모두 계획대로 됐어요' })).toHaveCount(0);
  const income = page.getByRole('group', { name: /수입$/ });
  await expect(income.getByRole('button')).toBeVisible();
  await expect(page.getByRole('button', { name: /추가/ })).toHaveCount(0);
  expect(await y(pill)).toBeLessThan(await y(rows));
  expect(await y(rows)).toBeLessThan(await y(income));
  await income.getByRole('button').click();
  await expect(page).toHaveURL(/\/salary\/money-in\/list/);
});

test('수입 한 줄 기록 없음 상태: 월급 기본값 350만 원 ›, 누르면 W-20b에서 “+ 수입 적기” → W-20', async ({
  page,
}) => {
  await open(page, new Date('2026-10-07T10:00:00+09:00'));
  const income = page.getByRole('group', { name: '이번 달 수입' });
  await expect(income).toContainText('350만 원');
  await income.getByRole('button').click();
  await expect(page).toHaveURL(/\/salary\/money-in\/list$/);
  await page.getByRole('button', { name: /수입 적기/ }).click();
  await expect(page).toHaveURL(/\/salary\/money-in$/);
});

test('수입 한 줄 있음 상태: 합계 130만 원 ›, 누르면 W-20b에 기록(최근 것부터)', async ({ page }) => {
  await open(page, new Date('2026-10-07T10:00:00+09:00'), (d, sv) => {
    const row = (id: string, amount: number, on: string, kind: string) => ({
      id,
      space_id: 'space-1',
      deleted_at: null,
      owner_user_id: d.me.id,
      received_on: on,
      amount,
      kind,
      created_at: `${on}T01:00:00Z`,
    });
    sv.moneyIns.push(
      row('in-0', 100_000, '2026-09-28', 'refund'),
      row('in-1', 1_000_000, '2026-09-30', 'bonus'),
      row('in-2', 200_000, '2026-10-02', 'work'),
    );
  });
  const income = page.getByRole('group', { name: '이번 달 수입' });
  await expect(income).toContainText('130만 원');
  await income.getByRole('button').click();
  await expect(page).toHaveURL(/\/salary\/money-in\/list$/);
  await expect(page.locator('.hg-fdhero__amt')).toContainText('130만 원');
  await expect(page.getByText('프리랜스·부업')).toBeVisible();
  await expect(page.getByText('+20만 원')).toBeVisible();
  await expect(page.getByText('+100만 원')).toBeVisible();
});
