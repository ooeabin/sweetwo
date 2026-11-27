import { test, expect } from '@playwright/test';
import { type MemDb, mockOnboarding } from './mocks';

// 메뉴·화면 점검 PR-1(2026-11-16): 머리 ‹는 온 곳으로, 알림 제목 h1, 설정 첫 줄 ‘내 정보’
const NOW = new Date('2026-10-07T10:00:00+09:00');

function seed(db: MemDb) {
  Object.assign(db.me, {
    nickname: '찬우',
    side: 'groom',
    employment: 'regular',
    monthly_income: 3_500_000,
    payday: 25,
    payday_last: false,
    allowance: 500_000,
    onboarding_step: 'O-67',
    onboarding_done_at: '2026-09-20T01:00:00Z',
    space_id: 'space-1',
  });
  db.space = {
    id: 'space-1',
    created_by: db.me.id,
    couple_state: 'not_joined',
    marriage_status: 'married',
    base_day: 25,
  } as MemDb['space'];
}

test('알림 화면 제목은 h1, 빈 상태 ‘알림 종류 고르기’ → 알림 설정에서 ‹는 알림으로, 설정 첫 줄은 내 정보', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'narrow', '좁은 창 흐름');
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  await page.goto('/');
  await page.locator('.hg-frame__mhead').getByRole('button', { name: /^알림/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: '알림' })).toBeVisible();
  // 2026-11-27 ‘버튼·색 정리’: 맨 아래 ‘알림 설정’ 줄은 없애고 빈 상태에도 ‘알림 종류 고르기’ 하나
  await expect(page.getByRole('button', { name: '알림 설정' })).toHaveCount(0);
  await page.getByRole('button', { name: '알림 종류 고르기' }).click();
  await expect(page).toHaveURL(/\/settings\/notifications$/);
  await page.getByRole('button', { name: '뒤로' }).first().click();
  await expect(page).toHaveURL(/\/notifications$/);

  await page.goto('/settings');
  await expect(page.getByRole('button', { name: /^내 정보/ })).toBeVisible();
});

test('머리 B안(2026-11-26): ‹는 Regular 선·같은 자리, 제목 17/500, N-02 ‘모두 읽음’·W-01 ‘편집’ 머리 오른쪽 글자 동작은 15/400·글자 끝 화면 오른쪽 24', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'narrow', '좁은 창 머리');
  await page.clock.setFixedTime(NOW);
  const db = await mockOnboarding(page, { now: NOW });
  seed(db);
  const icoX = async () => {
    const ico = page.locator('.hg-back:visible > .hg-ico').first();
    return (await ico.boundingBox())?.x;
  };
  await page.goto('/salary/plan');
  const title = page.getByRole('heading', { level: 1, name: '월급 계획 템플릿' });
  await expect(title).toBeVisible();
  await expect(title).toHaveCSS('font-weight', '500'); // 머리가 다시 그려져도 다시 찾음(evaluate는 떨어진 요소에서 빈 값)
  const backMask = await page
    .locator('.hg-back:visible > .hg-ico')
    .first()
    .evaluate((e) => getComputedStyle(e).getPropertyValue('--ico'));
  expect(backMask).toContain('M165.66'); // Phosphor Regular caret-left
  const x1 = await icoX();

  await page.goto('/notifications');
  const noti = page.getByRole('heading', { level: 1, name: '알림' });
  await expect(noti).toBeVisible();
  await expect(noti).toHaveCSS('font-weight', '500');
  expect(await icoX()).toBe(x1);
  // 머리 오른쪽 글자 동작(hg-headaction, 2026-11-26): N-02 ‘모두 읽음’. W-01은 2026-11-26 ‘W-01 정리 A안’으로 글자 ‘편집’ 대신 ⋯(“더 보기”)
  // 15/400 ink-2, 누르는 칸 높이 44, 글자 끝 = 화면 오른쪽 24
  const vw = page.viewportSize()?.width ?? 0;
  const headAction = async (name: string) => {
    const b = page.getByRole('button', { name, exact: true });
    await expect(b).toHaveClass(/hg-headaction/);
    const m = await b.evaluate((e) => {
      const r = document.createRange();
      r.selectNodeContents(e);
      const cs = getComputedStyle(e);
      return {
        end: Math.round(r.getBoundingClientRect().right),
        h: e.getBoundingClientRect().height,
        size: cs.fontSize,
        weight: cs.fontWeight,
        color: cs.color,
      };
    });
    expect(m.end).toBe(vw - 24);
    expect(m.h).toBeGreaterThanOrEqual(44);
    expect(m.size).toBe('15px');
    expect(m.weight).toBe('400');
    return m;
  };
  const readAll = await headAction('모두 읽음');
  // W-01 머리 오른쪽 ⋯: 생활비 줄 하나(줄이 있으면 메뉴에 ‘편집’)
  db.splits.push({
    id: 'split-me',
    owner_user_id: String(db.me.id),
    split_line: [
      {
        id: 'l1',
        split_id: 'split-me',
        kind: 'living',
        goal_id: null,
        user_id: null,
        name: null,
        amount: 800_000,
        sort: 0,
      },
    ],
  });
  await page.goto('/salary/plan');
  await expect(page.getByRole('heading', { level: 1, name: '월급 계획 템플릿' })).toBeVisible();
  const more = page.getByRole('button', { name: '더 보기', exact: true });
  const mb = await more.boundingBox();
  expect(mb?.width).toBe(44);
  expect(mb?.height).toBe(44);
  expect(Math.round((mb?.x ?? 0) + (mb?.width ?? 0))).toBe(vw - 8); // ‹(왼쪽 8)와 좌우 대칭
  await expect(page.getByRole('button', { name: '편집', exact: true })).toHaveCount(0);
  const token = (v: string) =>
    page.evaluate((name) => {
      const d = document.createElement('i');
      d.style.color = `var(${name})`;
      document.body.append(d);
      const c = getComputedStyle(d).color;
      d.remove();
      return c;
    }, v);
  expect([await token('--ink-2'), await token('--muted')]).toContain(readAll.color);
});
