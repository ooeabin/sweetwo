import { test, expect, type Page } from '@playwright/test';
import { axe as runAxe } from './axe';
import { fakeBridge } from './fake-bridge';
import { mockSupabase, SB } from './mocks';

// 파트너 합류(docs/spec/18-partner-join.md). 예빈이 찬우의 초대 링크로 합류한다.

const axe = async (page: Page) => {
  const r = await runAxe(page);
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
};
const heading = (page: Page, name: string | RegExp) =>
  expect(page.getByRole('heading', { name })).toBeVisible();

const mockPreview = (page: Page) =>
  page.route(`${SB}/rest/v1/rpc/invite_preview`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ inviter_nickname: '찬우', status: 'ok' }]),
      headers: { 'Access-Control-Allow-Origin': '*' },
    }),
  );

test('로그인 전: 초대한 사람을 보여 주고, 합류하기 → 로그인 뒤 돌아올 자리 기억', async ({
  page,
}) => {
  await mockSupabase(page);
  await mockPreview(page);
  await page.goto('/i/K7M2QX');
  await heading(page, '찬우님이 초대했어요');
  await expect(page.getByText('둘이 같이 쓰는 공간에 합류해요')).toBeVisible();
  await axe(page);
  await page.getByRole('button', { name: '합류하기' }).click();
  await heading(page, '찬우님 공간에 합류할 계정을 골라요');
  await axe(page);
  const back = await page.evaluate(
    () => localStorage.getItem('sweetwo.return-to') ?? sessionStorage.getItem('sweetwo.return-to'),
  );
  expect(back).toBe('/i/K7M2QX?go=1');
});

test('O-01 ‘코드 입력하기’ → P-01 코드 입력 → 초대 확인 → 합류하기 → A-02 초대 문구', async ({
  page,
}) => {
  await mockSupabase(page);
  await mockPreview(page);
  await page.goto('/');
  await page.getByRole('button', { name: '코드 입력하기' }).click();
  await heading(page, '받은 초대 코드를 넣어 주세요');
  await expect(page.getByText('파트너가 보낸 6자리 코드예요')).toBeVisible();
  const next = page.getByRole('button', { name: '다음' });
  const input = page.getByLabel('초대 코드');
  await expect(next).toBeDisabled();
  await input.fill('k7m2q1'); // 1은 코드에 안 쓰는 글자
  await expect(input).toHaveValue('K7M2Q1');
  await expect(page.getByText('코드를 다시 확인해 주세요')).toBeVisible();
  await expect(next).toBeDisabled();
  await axe(page);
  await input.fill('k7m2qx');
  await input.press('Enter');
  await expect(page).toHaveURL(/\/i\/K7M2QX$/);
  await heading(page, '찬우님이 초대했어요');
  await page.getByRole('button', { name: '합류하기' }).click();
  await heading(page, '찬우님 공간에 합류할 계정을 골라요');
  await page.getByRole('button', { name: /^(뒤로|이전)/ }).click();
  await heading(page, '찬우님이 초대했어요');
});

// 2026-11-13 v2.2(15 O-01, 18 P-01): 첫 실행에 설치 리퍼러(Android)·클립보드(iOS)에 초대 코드가 있으면 시트로 먼저 물음.
// 브리지(window.sweetwo.inviteCode)가 코드를 주면 “받은 초대 코드로 합류할까요?” → 합류하기 = P-01(코드 채움). 한 번만
test('첫 실행 초대 코드 자동 입력: 시트 → 합류하기 = P-01, 다시 열면 묻지 않음, ‘아니요’면 O-01 그대로', async ({
  page,
}) => {
  await mockSupabase(page);
  await mockPreview(page);
  await fakeBridge(page, { inviteCode: { code: 'k7m2qx', source: 'clipboard' } });
  const ev: unknown[] = [];
  page.on('console', async (m) => {
    if (m.type() === 'debug' && m.text().startsWith('[analytics]'))
      ev.push(await Promise.all(m.args().map((a) => a.jsonValue())));
  });
  await page.goto('/');
  const sheet = page.getByRole('dialog', { name: '받은 초대 코드로 합류할까요?' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('초대 코드 K 7 M 2 Q X')).toHaveCount(1);
  await axe(page);
  await sheet.getByRole('button', { name: '합류하기' }).click();
  await expect(page).toHaveURL(/\/i\/K7M2QX$/);
  await heading(page, '찬우님이 초대했어요');
  expect(ev).toContainEqual([
    '[analytics]',
    'invite_code_autofilled',
    { source: 'clipboard', result: 'join' },
  ]);
  // 이 기기에서는 한 번만
  await page.evaluate(() => localStorage.removeItem('sweetwo.started'));
  await page.goto('/start');
  await heading(page, '같이 모으는 돈, 둘이 같이 봐요');
  await expect(sheet).toHaveCount(0);
});

test('첫 실행 초대 코드: ‘아니요, 새로 시작할게요’면 시트만 닫힘', async ({ page }) => {
  await mockSupabase(page);
  await fakeBridge(page, { inviteCode: { code: 'K7M2QX', source: 'referrer' } });
  await page.goto('/');
  const sheet = page.getByRole('dialog', { name: '받은 초대 코드로 합류할까요?' });
  await sheet.getByRole('button', { name: '아니요, 새로 시작할게요' }).click();
  await expect(sheet).toHaveCount(0);
  await heading(page, '같이 모으는 돈, 둘이 같이 봐요');
  await expect(page.getByRole('button', { name: '시작하기' })).toBeVisible();
});
