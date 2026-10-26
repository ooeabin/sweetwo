import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { chanwoo } from './supabase-mock';
import { mockOnboarding } from './onboarding-mock';
import { seed } from './seed-home';

// 앱 기본 틀(19): ⌘K 검색 화면(바로 하기, 목표 찾기), Ctrl+1~4 탭, Ctrl+N·‘추가’ 메뉴, 좁은 창 + 버튼,
// 오프라인 띠, 연결 해제 대기 띠.
const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const NOW = new Date('2026-10-07T10:00:00+09:00');

test('검색 화면(⌘K): 바로 하기, 목표 찾기 → 목표 상세, Esc 닫기', async ({ page }, info) => {
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
  await axe(page);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: '검색' }).first().click();
  await page.getByRole('combobox', { name: '검색' }).fill('내 집');
  await expect(dialog.getByRole('option', { name: '내 집 마련' })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/goals\/goal-h$/);
  // 찾는 게 없으면 빈 상태
  await page.keyboard.press('ControlOrMeta+k');
  await page.getByRole('combobox', { name: '검색' }).fill('없는 이름');
  await expect(page.getByText('찾는 게 없어요')).toBeVisible();
});

test('Ctrl+2 목표 탭, Ctrl+N 홈은 추가 메뉴, 목표 화면은 목표 추가', async ({ page }, info) => {
  test.skip(info.project.name === 'narrow');
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.keyboard.press('ControlOrMeta+n');
  const menu = page.getByRole('menu', { name: '추가' });
  await expect(menu.getByRole('menuitem', { name: '가진 돈·대출' })).toBeVisible();
  await menu.getByRole('menuitem', { name: '챙길 날' }).click();
  await expect(page).toHaveURL(/\/calendar\/add/);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.keyboard.press('ControlOrMeta+2');
  await expect(page).toHaveURL(/\/goals$/);
  await expect(page.getByRole('heading', { name: '목표' }).first()).toBeVisible();
  await page.keyboard.press('ControlOrMeta+n');
  await expect(page).toHaveURL(/\/goals\/new/);
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
