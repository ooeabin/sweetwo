import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { chanwoo } from './supabase-mock';
import { mockOnboarding } from './onboarding-mock';
import { seed } from './seed-home';

// 앱 기본 틀(19): ⌘K 검색 화면(바로 하기, 저금 항목 찾기), Ctrl+1~4 탭, Ctrl+N·‘추가’ 메뉴, 좁은 창 + 버튼,
// 오프라인 띠, 연결 해제 대기 띠.
const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const NOW = new Date('2026-10-07T10:00:00+09:00');

test('검색 화면(⌘K): 바로 하기, 저금 항목 찾기 → 저금 항목 상세(W-10), Esc 닫기', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'narrow');
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.keyboard.press('ControlOrMeta+k');
  const dialog = page.getByRole('dialog', { name: '검색' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('option', { name: /월급 체크하기/ })).toBeVisible();
  await expect(dialog.getByRole('option', { name: /금액 가리기/ })).toBeVisible();
  await expect(dialog.getByRole('option', { name: /저금 추가/ })).toBeVisible();
  await axe(page);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: '검색' }).click();
  await page.getByRole('combobox', { name: '검색' }).fill('내 집');
  await expect(dialog.getByRole('option', { name: '내 집 마련' })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/salary\/items\/goal-h$/);
  // 찾는 게 없으면 빈 상태
  await page.keyboard.press('ControlOrMeta+k');
  await page.getByRole('combobox', { name: '검색' }).fill('없는 이름');
  await expect(page.getByText('찾는 게 없어요')).toBeVisible();
});

test('Ctrl+2 월급 탭, Ctrl+N 홈은 추가 메뉴, 월급 탭은 저금 추가', async ({ page }, info) => {
  test.skip(info.project.name === 'narrow');
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.keyboard.press('ControlOrMeta+n');
  const menu = page.getByRole('menu', { name: '추가' });
  await expect(menu.getByRole('menuitem', { name: '자산·부채' })).toBeVisible();
  await menu.getByRole('menuitem', { name: '경조사' }).click();
  await expect(page).toHaveURL(/\/calendar\/add/);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.keyboard.press('ControlOrMeta+2');
  await expect(page).toHaveURL(/\/salary$/);
  await expect(page.getByRole('heading', { name: '월급' }).first()).toBeVisible();
  await page.keyboard.press('ControlOrMeta+n');
  await expect(page).toHaveURL(/\/salary\/items\/new/);
});

test('오프라인 띠, 연결 해제 대기 띠(받은 사람 → S-12d)', async ({ page, context }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  Object.assign(db.space ?? {}, { couple_state: 'unlink_pending', partner_nickname: '예빈' });
  db.partner = {
    id: 'yebin',
    nickname: '예빈',
    side: 'bride',
    employment: 'regular',
    monthly_income: 2_700_000,
    payday: 10,
    payday_last: false,
    allowance: 270_000,
  };
  db.unlinks.push({
    id: 'u1',
    space_id: 'space-1',
    requested_by: 'yebin',
    partner_id: chanwoo.id,
    status: 'pending',
    deadline: '2026-10-20',
    requested_at: '2026-10-06T01:00:00Z',
  });
  await page.goto('/');
  await expect(page.getByText('연결 해제를 기다리고 있어요')).toBeVisible();
  await expect(page.getByText('10월 20일에 해제돼요')).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByText('연결이 끊겼어요')).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText('연결이 끊겼어요')).toHaveCount(0);
  await page.getByRole('button', { name: '확인하기' }).click();
  await expect(page).toHaveURL(/\/settings\/couple\/unlink\/review$/);
});

test('없는 주소(13 공통 상태 19번): “찾는 화면이 없어요” + 홈으로 가기', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/calendar/nowhere/really');
  await expect(page.getByRole('heading', { name: '찾는 화면이 없어요' })).toBeAttached();
  await expect(page.getByText('지워졌거나 주소가 바뀌었어요')).toBeVisible();
  await expect(page.getByText(/Unexpected Application Error/)).toHaveCount(0);
  await axe(page);
  await page.getByRole('button', { name: '홈으로 가기' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('좁은 창 머리와 탭 막대(2026-11-09): 왼쪽 지금 자리(홈 워드마크, 다른 탭 제목 h1), 검색·두 사람 없음, 탭은 아이콘만', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'narrow');
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/');
  const head = page.locator('.hg-frame__mhead');
  const dock = page.locator('.hg-frame > .hg-dock');
  // 홈: 워드마크, h1은 화면 읽기용 “홈” 하나
  await expect(head.getByRole('img', { name: 'sweeTwo' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1, name: '홈' })).toBeAttached();
  // 오른쪽은 알림, 설정만. 검색 버튼, 두 사람 아바타·초대 버튼 없음
  await expect(head.getByRole('button')).toHaveCount(2);
  await expect(head.getByRole('button', { name: '알림', exact: true })).toBeVisible();
  await expect(head.getByRole('button', { name: '설정', exact: true })).toBeVisible();
  await expect(head.getByRole('button', { name: '검색' })).toHaveCount(0);
  await expect(head.locator('.hg-avatar')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '함께할 사람 초대하기' })).toHaveCount(0);
  // 초대는 할 일 띠에 남음
  await expect(page.getByText('함께할 사람을 초대해 주세요')).toBeVisible();
  // 탭 막대: 이름은 화면 읽기용(aria-label)만, 보이는 글자 없음
  await expect(dock).toHaveText('');
  await expect(dock.getByRole('link', { name: '홈' })).toHaveAttribute('aria-current', 'page');
  await expect(dock.getByRole('link', { name: '월급' })).not.toHaveAttribute('aria-current');
  const box = await dock.getByRole('link', { name: '월급' }).boundingBox();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  // 다른 탭: 머리 왼쪽 제목이 그 화면의 h1(보임), 워드마크 없음
  for (const [name, url] of [
    ['월급', /\/salary$/],
    ['자산 관리', /\/assets/],
    ['캘린더', /\/calendar/],
  ] as const) {
    await dock.getByRole('link', { name }).click();
    await expect(page).toHaveURL(url);
    await expect(head.getByRole('heading', { level: 1, name })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(head.getByRole('img', { name: 'sweeTwo' })).toHaveCount(0);
    await expect(dock.getByRole('link', { name })).toHaveAttribute('aria-current', 'page');
  }
  await axe(page);
});
