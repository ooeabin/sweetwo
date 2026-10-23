import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// 트레이 위젯 창(docs/spec/26-widgets.md). 데스크톱 브리지를 흉내 내어 /widget/tray만 그림.
const axe = async (page: Page) => {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};

const snapshot = {
  at: new Date().toISOString(),
  kind: 'split',
  amount: 2_400_000,
  over: false,
  pct: 67,
  done: 2,
  total: 3,
  payday: 25,
  closeDays: null,
  task: { title: '고정지출 채우기', to: '/assets/week/fixed' },
  days: [
    { dday: 4, name: '예빈님 월급날', date: '10월 10일', money: true, to: '/calendar' },
    {
      dday: 18,
      name: '10월 월급 플랜 정리할 때예요',
      date: '10월 24일',
      money: true,
      to: '/calendar',
    },
  ],
  to: '/plan/split',
  unlink: false,
};

async function fakeBridge(page: Page, state: Record<string, unknown>) {
  await page.addInitScript((st) => {
    const w = window as unknown as { __opened: string[]; sweetwo: unknown };
    w.__opened = [];
    w.sweetwo = {
      widget: {
        state: () => Promise.resolve(st),
        onChange: () => () => undefined,
        open: (p: string) => {
          w.__opened.push(p);
          return Promise.resolve();
        },
        hide: () => Promise.resolve(),
      },
    };
  }, state);
}
const settings = { tray: true, showAmounts: false, goalId: null };

test('트레이 위젯: 금액 가림(기본) → 비율과 건수, 할 일, 다가오는 날, 누르면 앱 창으로', async ({
  page,
}) => {
  await fakeBridge(page, { signedIn: true, locked: false, snapshot, settings });
  await page.goto('/widget/tray');
  const sum = page.getByRole('button', { name: /월급 나누기, 금액 가림, 다음 월급날 25일/ });
  await expect(sum).toContainText('67%');
  await expect(sum).toContainText('3곳 중 2곳 나눴어요');
  await expect(page.getByText('240만 원')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /다음 할 일/ })).toContainText('고정지출 채우기');
  await expect(page.getByText('예빈님 월급날')).toBeVisible();
  await expect(page.getByText('방금 업데이트')).toBeVisible();
  await axe(page);
  await sum.click();
  await page.getByRole('button', { name: /고정지출 채우기/ }).click();
  await page.getByRole('button', { name: '앱 열기' }).click();
  expect(await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened)).toEqual(
    ['/plan/split', '/assets/week/fixed', '/'],
  );
});

test('트레이 위젯: 금액 보이기 켜면 금액, 잠기면 안내만, 로그인 전 안내', async ({ page }) => {
  await fakeBridge(page, {
    signedIn: true,
    locked: false,
    snapshot,
    settings: { ...settings, showAmounts: true },
  });
  await page.goto('/widget/tray');
  await expect(page.getByRole('button', { name: /이번 달 안 나눈 돈, 240만 원/ })).toBeVisible();

  await fakeBridge(page, { signedIn: true, locked: true, snapshot, settings });
  await page.reload();
  await expect(page.getByText('잠겨 있어요')).toBeVisible();
  await expect(page.getByText('예빈님 월급날')).toHaveCount(0);
  await axe(page);

  await fakeBridge(page, { signedIn: false, locked: false, snapshot: null, settings });
  await page.reload();
  await expect(page.getByText('sweeTwo를 열어 로그인해 주세요')).toBeVisible();
});
