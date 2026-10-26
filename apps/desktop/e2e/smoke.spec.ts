import { _electron as electron, expect, test } from '@playwright/test';
import { join } from 'node:path';

// 데스크톱 앱이 뜨고, 브리지가 정해진 모양만 노출하는지(빌드 결과 out/로 실행).
test('데스크톱 실행', async () => {
  const app = await electron.launch({
    args: [join(__dirname, '..'), '--no-sandbox'],
  });
  const win = await app.firstWindow();
  await expect(win.locator('.hg-root')).toBeVisible();
  const bridge = await win.evaluate(() => Object.keys(window.sweetwo ?? {}).sort());
  expect(bridge).toEqual([
    'appVersion',
    'auth',
    'cache',
    'lock',
    'notify',
    'onInvite',
    'onNavigate',
    'update',
    'version',
    'widget',
  ]);
  // 자동 업데이트(S-19): 설치하지 않고 실행하면 꺼져 있음
  expect(await win.evaluate(() => window.sweetwo?.update?.check())).toEqual({ status: 'idle' });
  // 트레이 위젯(26): 로그인 전에는 값 없음, 설정 기본값(트레이 켜짐, 금액 가림)
  const state = await win.evaluate(() => window.sweetwo?.widget?.state());
  expect(state).toMatchObject({
    signedIn: false,
    snapshot: null,
    settings: { tray: true, showAmounts: false, goalId: null },
  });
  // 브리지로 받은 값은 검사(형식이 틀리면 거절)
  const bad = await win.evaluate(() =>
    window.sweetwo?.widget?.update({ kind: 'x' }).then(
      () => 'ok',
      () => 'rejected',
    ),
  );
  expect(bad).toBe('rejected');
  // 토큰과 콜백 code는 렌더러에 없다
  const authKeys = await win.evaluate(() => Object.keys(window.sweetwo?.auth ?? {}).sort());
  expect(authKeys).toEqual(['cancel', 'getAccessToken', 'onEvent', 'reopen', 'signOut', 'start']);
  // 로그인 전 첫 실행 → O-01
  await expect(win.getByRole('button', { name: '시작하기' })).toBeVisible({ timeout: 15_000 });
  const nodeLeak = await win.evaluate(() => typeof (globalThis as { require?: unknown }).require);
  expect(nodeLeak).toBe('undefined');
  await app.close();
});
