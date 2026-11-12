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

test('오프라인 띠, 연결 해제 대기 띠(받은 사람 → S-12d), 맨 위 띠는 하나만(오프라인 먼저)', async ({
  page,
  context,
}) => {
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
  // 받은 사람 띠는 요청 문구(2026-11-11 D5), 요청한 사람만 “연결 해제를 기다리고 있어요”
  await expect(page.getByText('예빈님이 연결 해제를 요청했어요')).toBeVisible();
  await expect(page.getByText('연결 해제를 기다리고 있어요')).toHaveCount(0);
  await expect(page.getByText('10월 20일에 해제돼요')).toBeVisible();
  await context.setOffline(true);
  // 받아 둔 화면이 있으면 13-9 “오프라인 / 마지막 저장 {시각}”(2026-11-12 S6-17)
  await expect(page.getByText('마지막 저장', { exact: false })).toBeVisible();
  // 맨 위 띠는 하나만, 오프라인이 먼저(2026-11-11 QA 4구간 D3): 해제 대기 띠는 다시 연결되면 보임
  await expect(page.getByText('10월 20일에 해제돼요')).toHaveCount(0);
  await expect(page.locator('.hg-body__banners .hg-banner')).toHaveCount(1);
  await context.setOffline(false);
  await expect(page.getByText('연결이 끊겼어요')).toHaveCount(0);
  await expect(page.getByText('10월 20일에 해제돼요')).toBeVisible();
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

test('좁은 창 머리(2026-11-09 홈 허브): 홈은 워드마크 + 알림 + 메뉴, 하단 탭 막대·+ 버튼 없음, 다른 메뉴는 ‹ 홈으로 + 제목', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'narrow');
  test.setTimeout(60_000);
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/');
  const head = page.locator('.hg-frame__mhead');
  // 홈: 워드마크, h1은 화면 읽기용 “홈” 하나, 바탕은 회색(hg-frame--alt)
  await expect(head.getByRole('img', { name: 'sweeTwo' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1, name: '홈' })).toBeAttached();
  await expect(page.locator('.hg-frame')).toHaveClass(/hg-frame--alt/);
  // 오른쪽은 알림, 메뉴만. 설정 톱니·검색·두 사람 아바타 없음
  await expect(head.getByRole('button')).toHaveCount(2);
  await expect(head.getByRole('button', { name: '알림', exact: true })).toBeVisible();
  await expect(head.getByRole('button', { name: '메뉴', exact: true })).toBeVisible();
  await expect(head.getByRole('button', { name: '설정' })).toHaveCount(0);
  await expect(head.locator('.hg-avatar')).toHaveCount(0);
  // 하단 탭 막대와 + 버튼은 없음
  await expect(page.locator('.hg-dock, .hg-fab')).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: '월급', exact: true }).locator('visible=true'),
  ).toHaveCount(0);
  await expect(page.getByText('함께할 사람을 초대해 주세요')).toBeVisible();
  await axe(page);

  // 다른 메뉴 첫 화면: ‹(홈으로) + 머리 제목 h1, 워드마크·알림·메뉴 없음, ‹ → 홈
  for (const [name, url] of [
    ['월급', '/salary'],
    ['자산 관리', '/assets'],
    ['캘린더', '/calendar'],
    ['설정', '/settings'],
  ] as const) {
    await page.goto(url);
    await expect(head.getByRole('heading', { level: 1, name })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(head.getByRole('img', { name: 'sweeTwo' })).toHaveCount(0);
    await expect(head.getByRole('button')).toHaveCount(1);
    await head.getByRole('button', { name: '홈으로' }).click();
    await expect(page).toHaveURL(/\/$/);
  }
  // 바탕: 월급·캘린더는 흰색, 자산 관리는 회색
  await page.goto('/salary');
  await expect(page.locator('.hg-frame')).not.toHaveClass(/hg-frame--alt/);
  await page.goto('/assets');
  await expect(page.locator('.hg-frame')).toHaveClass(/hg-frame--alt/);
});

test('메뉴 서랍(Drawer, 2026-11-09): 줄 묶음, 지금 화면 굵게, 줄 → 화면(뒤로 = 홈), Esc·✕·막으로 닫힘', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'narrow');
  test.setTimeout(90_000);
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/');
  // 불러오는 중 틀이 홈 틀로 바뀐 뒤(☰ 버튼이 새로 그려짐)
  await expect(page.locator('.hg-hubhero')).toBeVisible();
  const menuBtn = page.getByRole('button', { name: '메뉴', exact: true });
  await expect(menuBtn).toHaveAttribute('aria-expanded', 'false');
  await menuBtn.click();
  const drawer = page.getByRole('dialog', { name: '메뉴' });
  await expect(drawer).toBeVisible();
  await expect(menuBtn).toHaveAttribute('aria-expanded', 'true');
  // 파트너 합류 전이라 ‘초대하기’ 있음. 묶음 4개
  expect(await drawer.locator('.hg-drawer__item').allTextContents()).toEqual([
    '홈',
    '월급',
    '자산 관리',
    '캘린더',
    '내 정보',
    '설정',
    '우리 둘',
    '초대하기',
    '공지',
    '문의',
    '도움말',
  ]);
  await expect(drawer.locator('.hg-drawer__group')).toHaveCount(4);
  await expect(drawer.getByRole('button', { name: '홈', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(drawer.getByRole('button', { name: '월급', exact: true })).not.toHaveAttribute(
    'aria-current',
  );
  // 머리: 알림 종 + 닫기
  await expect(drawer.getByRole('button', { name: '알림', exact: true })).toBeVisible();
  await expect(drawer.getByRole('button', { name: '닫기' })).toBeVisible();
  await axe(page);
  // ✕로 닫힘, 포커스는 ☰로
  await drawer.getByRole('button', { name: '닫기' }).click();
  await expect(drawer).toHaveCount(0);
  await expect(menuBtn).toBeFocused();
  // 막을 누르면 닫힘
  await menuBtn.click();
  await page.mouse.click(10, 400);
  await expect(drawer).toHaveCount(0);

  // 줄 → 화면, 뒤로 가면 홈
  for (const [name, url] of [
    ['월급', /\/salary$/],
    ['자산 관리', /\/assets$/],
    ['캘린더', /\/calendar\/list$/],
    ['내 정보', /\/settings\/me$/],
    ['설정', /\/settings$/],
    ['우리 둘', /\/settings\/couple$/],
    ['초대하기', /\/settings\/couple\?invite=1$/],
    ['문의', /\/settings\/help\/inquiries$/],
    ['도움말', /\/settings\/help$/],
  ] as const) {
    await page.goto('/');
    await expect(page.locator('.hg-hubhero')).toBeVisible();
    await menuBtn.click();
    await drawer.getByRole('button', { name, exact: true }).click();
    await expect(page).toHaveURL(url);
    await expect(drawer).toHaveCount(0);
  }
  await page.goto('/');
  await expect(page.locator('.hg-hubhero')).toBeVisible();
  await menuBtn.click();
  await drawer.getByRole('button', { name: '월급', exact: true }).click();
  await expect(page).toHaveURL(/\/salary$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  // 알림 종 → 알림 화면
  await menuBtn.click();
  await drawer.getByRole('button', { name: '알림', exact: true }).click();
  await expect(page).toHaveURL(/\/notifications$/);

  // 합류하면 ‘초대하기’ 없음
  Object.assign(db.space ?? {}, { couple_state: 'connected', partner_nickname: '예빈' });
  db.partner = {
    id: 'yebin',
    nickname: '예빈',
    monthly_income: 2_700_000,
    payday: 10,
    payday_last: false,
  };
  await page.goto('/');
  await expect(page.locator('.hg-hubhero')).toBeVisible();
  await menuBtn.click();
  await expect(drawer.getByRole('button', { name: '우리 둘', exact: true })).toBeVisible();
  await expect(drawer.getByRole('button', { name: '초대하기' })).toHaveCount(0);
});

test('메뉴 서랍 키보드만으로(2026-11-09): Enter로 열고, Tab은 서랍 안에서 돌고, Esc로 닫으면 ☰로 포커스, ‘동작 줄이기’면 미끄러짐 없음', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'narrow');
  await page.clock.setFixedTime(NOW);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/');
  // 불러오는 중 틀이 홈 틀로 바뀐 뒤(☰ 버튼이 새로 그려짐)
  await expect(page.locator('.hg-hubhero')).toBeVisible();
  const menuBtn = page.getByRole('button', { name: '메뉴', exact: true });
  await menuBtn.focus();
  await page.keyboard.press('Enter');
  const drawer = page.getByRole('dialog', { name: '메뉴' });
  await expect(drawer).toBeVisible();
  await expect(drawer).toBeFocused();
  expect(
    await page.locator('.hg-drawer').evaluate((el) => getComputedStyle(el).animationName),
  ).toBe('none');
  // 앞으로 Tab: 알림 → 닫기 → 홈 … 도움말 → 다시 알림(서랍 밖으로 나가지 않음)
  const inside = () => page.evaluate(() => !!document.activeElement?.closest('.hg-drawer'));
  for (let i = 0; i < 16; i++) {
    await page.keyboard.press('Tab');
    expect(await inside()).toBe(true);
  }
  await page.keyboard.press('Shift+Tab');
  expect(await inside()).toBe(true);
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  await expect(menuBtn).toBeFocused();
  // 줄을 키보드로 골라 이동
  await page.keyboard.press('Enter');
  await expect(drawer).toBeVisible();
  await drawer.getByRole('button', { name: '자산 관리', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/assets$/);
});

test('메뉴 서랍(2026-11-11 QA 4구간 S4-09·S4-15·S4-20): 열린 동안 뒤 화면 inert + 스크롤 잠금, 줄 묶음 이름은 “메뉴 목록”, 넓은 창이 되면 닫힘', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'narrow');
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/');
  await expect(page.locator('.hg-hubhero')).toBeVisible();
  await page.getByRole('button', { name: '메뉴', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: '메뉴' });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('navigation', { name: '메뉴 목록' })).toBeVisible();
  expect(
    await page.evaluate(() => ({
      inert: !!document.querySelector('.hg-frame')?.closest('[inert]'),
      drawerInert: !!document.querySelector('.hg-drawer')?.closest('[inert]'),
      overflow: getComputedStyle(document.body).overflow,
    })),
  ).toEqual({ inert: true, drawerInert: false, overflow: 'hidden' });
  await axe(page);
  // 넓은 창(태블릿 가로)이 되면 닫히고 뒤 화면이 돌아옴
  await page.setViewportSize({ width: 1180, height: 820 });
  await expect(drawer).toHaveCount(0);
  expect(
    await page.evaluate(() => ({
      inert: !!document.querySelector('.hg-frame')?.closest('[inert]'),
      overflow: getComputedStyle(document.body).overflow,
    })),
  ).toEqual({ inert: false, overflow: 'visible' });
});

test('+ 버튼(FAB) 없음, 화면 안 ‘+ … 추가’ 줄(2026-11-09): 월급 저금 묶음 끝, 자산·부채 목록 끝, 캘린더 일정 머리', async ({
  page,
}) => {
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  db.assets.push({
    id: 'a1',
    side: 'asset',
    grp: 'cash',
    kind: 'bank',
    name: '생활비 통장',
    amount: 3_000_000,
    principal: null,
    owner: 'person',
    owner_user_id: chanwoo.id,
    visibility: 'all',
    status: 'held',
    created_by: chanwoo.id,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    deleted_at: null,
  });
  // 월급 W-02: 저금 묶음 끝
  await page.goto('/salary');
  await expect(page.locator('.hg-fab, .hg-dock')).toHaveCount(0);
  const saving = page.getByRole('region', { name: '저금', exact: true });
  await saving.getByRole('button', { name: '저금 추가', exact: true }).click();
  await expect(page).toHaveURL(/\/salary\/items\/new/);
  // 자산 관리 F-02: 보던 쪽 목록 끝
  await page.goto('/assets/items');
  await page.getByRole('button', { name: '자산 추가', exact: true }).click();
  await expect(page).toHaveURL(/\/assets\/new\?side=asset/);
  // 캘린더 Y-01: ‘일정’ 머리 오른쪽
  await page.goto('/calendar/list');
  await page
    .getByRole('region', { name: '일정' })
    .getByRole('button', { name: '경조사 추가', exact: true })
    .click();
  await expect(page).toHaveURL(/\/calendar\/add/);
});

test('포커스 테두리(2026-11-11): 손가락·마우스로 서랍을 닫아 ☰로 포커스가 돌아와도 테두리 없음, 키보드(Tab)면 보임', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'narrow');
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/');
  await expect(page.locator('.hg-hubhero')).toBeVisible();
  const menuBtn = page.getByRole('button', { name: '메뉴', exact: true });
  const ring = () => menuBtn.evaluate((el) => getComputedStyle(el).outlineStyle);
  await menuBtn.click();
  const drawer = page.getByRole('dialog', { name: '메뉴' });
  await expect(drawer).toBeVisible();
  // 서랍 안 첫 칸에도 테두리 없음
  const focusedRing = () =>
    page.evaluate(() =>
      document.activeElement ? getComputedStyle(document.activeElement).outlineStyle : 'none',
    );
  expect(await focusedRing()).toBe('none');
  await drawer.getByRole('button', { name: '닫기' }).click();
  await expect(drawer).toBeHidden();
  await expect(menuBtn).toBeFocused();
  await expect(page.locator('html')).toHaveAttribute('data-input', 'pointer');
  expect(await ring()).toBe('none');
  // 키보드로 옮기면 테두리 보임
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(page.locator('html')).toHaveAttribute('data-input', 'keyboard');
  await expect(menuBtn).toBeFocused();
  expect(await ring()).toBe('solid');
});
