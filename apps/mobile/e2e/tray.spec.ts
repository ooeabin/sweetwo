import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';

// 트레이 위젯 창(docs/spec/26-widgets.md). 데스크톱 브리지를 흉내 내어 /widget/tray만 그림.
const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};

const snapshot = {
  at: new Date().toISOString(),
  salary: {
    state: 'progress',
    label: '9월 월급',
    done: 2,
    total: 5,
    left: 3,
    payday: '2026-10-25',
  },
  task: { title: '여행 목표 금액을 정해 주세요', to: '/goals/g-trip/edit/amount' },
  days: [
    { dday: 4, name: '어머니 생신', date: '10월 11일', money: false, to: '/calendar/day/c-mom' },
    { dday: 18, name: '찬우님 월급날', date: '10월 25일', money: true, to: '/calendar/list' },
  ],
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

test('트레이 위젯: 이번 달 월급(WG-01) 체크 개수와 다음 월급날, 할 일, 다가오는 날, 누르면 앱 창으로', async ({
  page,
}) => {
  await fakeBridge(page, { signedIn: true, locked: false, snapshot, settings });
  await page.goto('/widget/tray');
  const sum = page.getByRole('button', {
    name: /9월 월급, 2개, 5개 중 2개 했어요, 다음 월급날 25일/,
  });
  await expect(sum).toBeVisible();
  await expect(page.getByRole('button', { name: /다음 할 일/ })).toContainText(
    '여행 목표 금액을 정해 주세요',
  );
  await expect(page.getByText('어머니 생신')).toBeVisible();
  await expect(page.getByText('방금 업데이트')).toBeVisible();
  await axe(page);
  await sum.click();
  await page.getByRole('button', { name: /여행 목표 금액을 정해 주세요/ }).click();
  await page.getByRole('button', { name: /어머니 생신/ }).click();
  await page.getByRole('button', { name: '앱 열기' }).click();
  expect(await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened)).toEqual(
    ['/salary', '/goals/g-trip/edit/amount', '/calendar/day/c-mom', '/'],
  );
});

test('트레이 위젯: 월말 확인 기간은 체크 안 한 줄 → W-05, 다 하면 다 나눴어요, 잠기면 안내만, 로그인 전 안내', async ({
  page,
}) => {
  await fakeBridge(page, {
    signedIn: true,
    locked: false,
    snapshot: { ...snapshot, salary: { ...snapshot.salary, state: 'review' } },
    settings,
  });
  await page.goto('/widget/tray');
  const sum = page.getByRole('button', { name: /체크 안 한 게 3개 있어요/ });
  await sum.click();
  expect(await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened)).toEqual(
    ['/salary/review'],
  );

  await fakeBridge(page, {
    signedIn: true,
    locked: false,
    snapshot: { ...snapshot, salary: { ...snapshot.salary, state: 'done', done: 5, left: 0 } },
    settings,
  });
  await page.reload();
  await expect(page.getByText('9월 월급을 다 나눴어요')).toBeVisible();

  await fakeBridge(page, { signedIn: true, locked: true, snapshot, settings });
  await page.reload();
  await expect(page.getByText('잠겨 있어요')).toBeVisible();
  await expect(page.getByText('어머니 생신')).toHaveCount(0);
  await axe(page);

  await fakeBridge(page, { signedIn: false, locked: false, snapshot: null, settings });
  await page.reload();
  await expect(page.getByText('sweeTwo를 열어 로그인해 주세요')).toBeVisible();
});
