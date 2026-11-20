import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { chanwoo, emptyV22, type MemDb, mockOnboarding, seed } from './mocks';

// 구역 1 홈 점검(2026-11-20, 19 H-04·H-10·H-16·H-06·H-08, 25 S-20): 사용자 결정 7건 중 홈·도움말 5건
const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const NOW = new Date('2026-10-07T10:00:00+09:00');
const PARTNER = {
  id: 'yebin',
  nickname: '예빈',
  side: 'bride',
  employment: 'regular',
  monthly_income: 2_700_000,
  payday: 10,
  payday_last: false,
  allowance: 270_000,
};
const care = (o: Record<string, unknown>) => ({
  id: 'c-1',
  category: 'couple',
  kind: 'custom',
  name: '어머니 생신',
  member_id: null,
  side: null,
  date_rule: 'solar_yearly',
  month: 10,
  day: 14,
  leap: false,
  once_on: null,
  budget: 300_000,
  carer: 'together',
  alerts: [30, 7],
  status: 'todo',
  status_on: null,
  memo: null,
  secret: false,
  auto: null,
  auto_moves: true,
  created_by: chanwoo.id,
  created_at: '2026-09-01T00:00:00Z',
  ...o,
});

async function open(page: Page, prep?: (db: MemDb) => void, url = '/') {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  db.v22 = emptyV22();
  prep?.(db);
  await page.goto(url);
  return db;
}
const asset = (o: Record<string, unknown>) => ({
  id: 'a1',
  side: 'asset',
  grp: 'deposit',
  kind: 'deposit',
  name: '공동 예금',
  amount: 30_000_000,
  principal: null,
  owner: 'joint',
  owner_user_id: null,
  visibility: 'all',
  status: 'held',
  deleted_at: null,
  ...o,
});

test('H-10 보조 줄은 한 줄(목표 금액 있으면 “0%, 1억 5,000만 원 중”). “…님은 아직 같이 모으기에 없어요”는 카드에 없음', async ({
  page,
}) => {
  await open(page, (d) => {
    Object.assign(d.space ?? {}, { couple_state: 'connected', partner_nickname: '예빈' });
    d.partner = PARTNER;
  });
  const slide = page.locator('.hg-together__slide').first();
  await expect(slide).toBeVisible();
  await expect(slide.locator('.hg-together__line')).toHaveText(['0%, 1억 5,000만 원 중']);
  await expect(page.locator('.hg-together')).not.toContainText('같이 모으기에 없어요');
});

test('H-10 목표 금액이 없으면 보조 한 줄은 “이번 달 +95만 원”', async ({ page }) => {
  await open(page, (d) => {
    for (const g of d.goals) Object.assign(g, { target_amount: null, deadline: null });
    const c = d.checklists[0];
    for (const l of (c?.pay_check_line ?? []) as Record<string, unknown>[])
      Object.assign(l, {
        state: 'checked',
        checked_by: chanwoo.id,
        checked_at: '2026-10-01T00:00:00Z',
      });
  });
  const slide = page.locator('.hg-together__slide').first();
  await expect(slide.locator('.hg-together__line')).toHaveText(['이번 달 +95만 원']);
  await expect(slide.locator('.hg-together__bar')).toHaveCount(0);
});

test('H-04 자산 관리 타일: 이름표 “순자산”, 마이너스 그대로, 값 아래 “자산 …, 부채 …”, 금액 가리기면 둘 다 가림', async ({
  page,
}) => {
  await open(page, (d) => {
    d.assets.push(
      asset({}),
      asset({
        id: 'd1',
        side: 'debt',
        grp: 'credit',
        kind: 'credit_loan',
        name: '대출',
        amount: 50_000_000,
      }),
    );
  });
  const tile = page.getByRole('button', { name: /^자산 관리/ });
  await expect(tile.locator('.hg-hubtile__sub')).toHaveText('순자산');
  await expect(tile.locator('.hg-hubtile__value')).toHaveText('−2,000만 원');
  await expect(tile.locator('.hg-hubtile__foot')).toHaveText('자산 3,000만 원, 부채 5,000만 원');
  await expect(tile).toHaveClass(/hg-hubtile--point/);
  await axe(page);
  await page.evaluate(() => localStorage.setItem('sweetwo.masked', '1'));
  await page.reload();
  const masked = page.getByRole('button', { name: /^자산 관리/ });
  await expect(masked.locator('.hg-hubtile__value')).toHaveText('•••');
  await expect(masked.locator('.hg-hubtile__foot')).toHaveText('자산 •••, 부채 •••');
});

test('H-04 자산 0개면 기존 동기 문구 그대로(이름표·작은 줄 없음)', async ({ page }) => {
  await open(page);
  const tile = page.getByRole('button', { name: /^자산 관리/ });
  await expect(tile).toContainText('내 순자산, 또래 중 어디쯤일까요?');
  await expect(tile.locator('.hg-hubtile__foot')).toHaveCount(0);
});

test('H-16 다가오는 날 상자(최대 2개, D-n) → 달력, H-08 타일 보조 줄은 “이번 달 일정 n개”', async ({
  page,
}) => {
  await open(page, (d) => {
    d.cares.push(
      care({ id: 'c-mom' }),
      care({
        id: 'c-100',
        name: '사귄 지 100일',
        date_rule: 'once',
        month: null,
        day: null,
        once_on: '2026-10-30',
      }),
      care({
        id: 'c-far',
        name: '설 명절',
        date_rule: 'once',
        month: null,
        day: null,
        once_on: '2026-12-01',
      }),
    );
  });
  const box = page.locator('.hg-hubup');
  await expect(box).toBeVisible();
  await expect(box.locator('.hg-hubup__title')).toHaveText('다가오는 날');
  await expect(box.locator('.hg-hubup__row')).toHaveCount(2);
  await expect(box.locator('.hg-hubup__name')).toHaveText(['어머니 생신', '사귄 지 100일']);
  await expect(box.locator('.hg-hubup__dday')).toHaveText(['D-7', 'D-23']);
  // 맨 아래(반 칸 타일 둘 아래)
  const top = (sel: string) =>
    page
      .locator(sel)
      .first()
      .evaluate((el) => el.getBoundingClientRect().top);
  expect(await top('.hg-hubup')).toBeGreaterThan(await top('.hg-hubtile'));
  await expect(page.getByRole('button', { name: /^캘린더/ })).toContainText('이번 달 일정 2개');
  await axe(page);
  await box.click();
  await expect(page).toHaveURL(/\/calendar$/);
});

test('H-16 일정이 없으면 상자를 안 그림, 캘린더 타일은 “이번 달 일정이 없어요”', async ({
  page,
}) => {
  await open(page);
  await expect(page.getByRole('button', { name: /^캘린더/ })).toContainText(
    '이번 달 일정이 없어요',
  );
  await expect(page.locator('.hg-hubup')).toHaveCount(0);
});

test('H-06 할 일 시트 8번 줄: 줄 사이 회색 “이미 정했어요” 대신 오른쪽 알약 “정했어요”(체크 아이콘), 누르면 띠를 닫음', async ({
  page,
}) => {
  const db = await open(page, (d) => {
    Object.assign(d.space ?? {}, {
      couple_state: 'connected',
      partner_nickname: '예빈',
      shared_living: true,
    });
    d.partner = PARTNER;
  });
  await page.locator('.hg-hubband').first().click();
  const sheet = page.getByRole('dialog', { name: '할 일' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('이미 정했어요', { exact: true })).toHaveCount(0);
  const row = sheet.locator('.hg-tasksheet__row');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('같이 쓰는 생활비를 나눠 볼까요?');
  const pill = row.locator('.hg-tasksheet__done');
  await expect(pill).toHaveText('정했어요');
  await expect(pill.locator('.hg-ico')).toHaveCount(1);
  await expect(row.locator('.hg-chevron')).toHaveCount(0);
  const box = await pill.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(28);
  await axe(page);
  await pill.click();
  await expect.poll(() => db.v22?.tasks ?? []).toContain('split_suggest');
  await expect(sheet).toHaveCount(0);
});

test('S-20 도움말: 기본 “자주 묻는 질문” 대표 5개 + 묶음 칩 5개, 칩을 고르면 그 묶음만, 검색하면 칩을 무시', async ({
  page,
}) => {
  await open(page, undefined, '/settings/help');
  const chips = page.getByRole('group', { name: '묶음' }).getByRole('button');
  await expect(chips).toHaveText([
    '시작하기',
    '둘이 쓰기',
    '쓰는 법',
    '기기와 보안',
    '데이터와 계정',
  ]);
  await expect(page.getByRole('heading', { name: '자주 묻는 질문' })).toBeVisible();
  const qs = page.locator('.hg-acc__q');
  await expect(qs).toHaveCount(5);
  await expect(qs.first()).toContainText('통장을 연결하지 않나요?');
  await axe(page);
  await chips.nth(1).click();
  await expect(chips.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: '둘이 쓰기' })).toBeVisible();
  await expect(qs.first()).toContainText('파트너는 어떻게 초대하나요?');
  expect(await qs.count()).toBeGreaterThan(1);
  await expect(page.getByRole('button', { name: '통장을 연결하지 않나요?' })).toHaveCount(0);
  // 검색은 칩을 무시하고 전체에서
  const search = page.getByRole('searchbox', { name: '자주 묻는 질문에서 찾기' });
  await search.fill('통장을 연결');
  await expect(page.getByRole('button', { name: '통장을 연결하지 않나요?' })).toBeVisible();
  await search.fill('');
  await expect(page.getByRole('heading', { name: '둘이 쓰기' })).toBeVisible();
  // 같은 칩을 다시 누르면 기본으로
  await chips.nth(1).click();
  await expect(page.getByRole('heading', { name: '자주 묻는 질문' })).toBeVisible();
  await expect(qs).toHaveCount(5);
  // 문의·약관·버전 상자는 그대로
  await expect(page.getByRole('button', { name: '문의하기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '버전' })).toBeVisible();
});
